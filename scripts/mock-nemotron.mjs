#!/usr/bin/env node
/**
 * Configurable mock of NVIDIA's OpenAI-compatible endpoint for testing the agent loop offline.
 *
 *   node scripts/mock-nemotron.mjs                 # listens on MOCK_PORT (default 4301)
 *   NVIDIA_BASE_URL=http://127.0.0.1:4301/s/native/run1/v1 npm run dev
 *
 * Scenario selection (first match wins):
 *   1. URL path   /s/<scenario>/<runId>/v1/chat/completions   (runId isolates per-test state)
 *   2. headers    x-mock-scenario / x-mock-run                 (e.g. via NEMOTRON_EXTRA_HEADERS)
 *   3. env        MOCK_SCENARIO (default "native")
 *
 * Like real servers it validates the tool-calling protocol (every assistant tool_call must be answered by a
 * tool message with the same id, arguments must be JSON, no tool messages without tools) and returns 400s.
 *
 * Inspection: GET /__log/<runId> → every request seen for that run (body, status, scenario, turn).
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4301);
const DEFAULT_SCENARIO = process.env.MOCK_SCENARIO || "native";

/** runId → { requests: [], counters: {} } */
const runs = new Map();
const state = (run) => {
  if (!runs.has(run)) runs.set(run, { requests: [], counters: {} });
  return runs.get(run);
};

/* ------------------------------ helpers ------------------------------ */

const isFast = (model) => /nano/i.test(model || "");
const partText = (c) => (Array.isArray(c) ? c.map((p) => (p.type === "text" ? p.text : "")).join("") : c || "");
const userText = (body) => (body.messages || []).filter((m) => m.role === "user").map((m) => partText(m.content)).join("\n");
const turnOf = (body) => (body.messages || []).filter((m) => m.role === "assistant").length;

function caseInfo(body) {
  const text = userText(body);
  const block = text.match(/<<<UNTRUSTED_MESSAGE[^>]*>>>([\s\S]*?)<<<END_UNTRUSTED_MESSAGE/);
  const msg = block ? block[1] : text;
  const url = (msg.match(/https?:\/\/[^\s"'<>]+/) || msg.match(/\b[a-z0-9-]+\.(?:top|club|info|shop|vip|online|support|com)\b[^\s]*/i) || [""])[0];
  const sender = (text.match(/from: (.+?)(?: \(caller ID|\n)/) || [, "+1 555 0100"])[1].trim();
  const urls = msg.match(/https?:\/\/[^\s"'<>]+/g) || (url ? [url] : []);
  return { url, urls, sender, msg, fenced: Boolean(block) };
}

let idSeq = 0;
const call = (name, args, raw) => ({ id: `call_${++idSeq}`, type: "function", function: { name, arguments: raw ?? JSON.stringify(args) } });

const SCAM_VERDICT = {
  risk: "scam",
  confidence: 0.93,
  scam_type: "Toll payment phishing",
  headline: "This is not really NTTA. Don't pay.",
  explanation: "The link is a 2-day-old lookalike domain, not NTTA's real site. The text pressures you with a late fee.",
  evidence: [{ signal: "Lookalike domain", detail: "ntta-tollpay.top is not owned by NTTA", weight: "high", direction: "risk", source: "check_link" }],
  actions: ["block_sender", "report_7726", "verify_official"],
  verify_organization: "NTTA",
};

const triageJson = (risk = "scam", confidence = 0.82, reason = "Unpaid toll notice with urgent payment link") => JSON.stringify({ risk, confidence, reason });

/* ------------------------------ protocol validation ------------------------------ */

function validate(body) {
  if (!body.model) return "model is required";
  if (!Array.isArray(body.messages) || !body.messages.length) return "messages must be a non-empty array";
  if (body.tools) {
    if (!Array.isArray(body.tools)) return "tools must be an array";
    for (const t of body.tools) if (t.type !== "function" || !t.function?.name) return "each tool needs type=function and function.name";
  }
  let pending = new Set();
  for (const [i, m] of body.messages.entries()) {
    if (!["system", "user", "assistant", "tool"].includes(m.role)) return `messages[${i}].role is invalid`;
    if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === "text" && typeof p.text === "string") continue;
        if (p.type === "image_url" && typeof p.image_url?.url === "string") continue;
        return `messages[${i}]: invalid content part`;
      }
      if (m.content.some((p) => p.type === "image_url") && !/vl|vision/i.test(body.model)) return `model ${body.model} does not accept images`;
    }
    if (m.role === "tool") {
      if (!body.tools) return `messages[${i}]: tool message sent without tools`;
      if (!pending.has(m.tool_call_id)) return `messages[${i}]: tool message with unknown tool_call_id ${m.tool_call_id}`;
      pending.delete(m.tool_call_id);
      continue;
    }
    if (pending.size) return `messages[${i}]: assistant tool_calls ${[...pending].join(",")} were not answered by tool messages`;
    if (m.role === "assistant" && m.tool_calls) {
      for (const c of m.tool_calls) {
        if (!c.id || c.type !== "function" || !c.function?.name || typeof c.function.arguments !== "string") return `messages[${i}]: malformed tool_call`;
        try {
          JSON.parse(c.function.arguments || "{}");
        } catch {
          return `messages[${i}]: tool_call arguments are not valid JSON`;
        }
        pending.add(c.id);
      }
    }
  }
  return null;
}

/* ------------------------------ scenarios ------------------------------ */

/** Native multi-turn plan used by several scenarios. */
function nativeDeep(body, turn, extra = {}) {
  const { url, sender } = caseInfo(body);
  if (turn === 0)
    return {
      content: "Plan: extract indicators, verify the sender and the link's registry age in parallel, then compare against toll-scam playbooks.",
      tool_calls: [call("extract_indicators", {}), call("check_sender", { sender, claimed_name: "NTTA" }), call("check_link", { url })],
      ...extra,
    };
  if (turn === 1)
    return {
      content: "",
      reasoning_content: "The domain is brand new and impersonates NTTA. Confirm the official contact and the playbook.",
      tool_calls: [call("lookup_official_contact", { organization: "NTTA" }), call("match_scam_patterns", {})],
    };
  return { content: "", tool_calls: [call("submit_verdict", SCAM_VERDICT)] };
}

const SCENARIOS = {
  native: (body, turn) => (isFast(body.model) ? { content: triageJson() } : nativeDeep(body, turn)),

  content: (body, turn) => {
    if (isFast(body.model)) return { content: "This is a scam (85%). It's a classic unpaid-toll smishing text." };
    const { url, sender } = caseInfo(body);
    if (turn === 0)
      return { content: `Plan: check the link and the message contents first.\n<TOOLCALL>[{"name":"extract_indicators","arguments":{}},{"name":"check_link","arguments":{"url":"${url}"}}]</TOOLCALL>` };
    if (turn === 1) return { content: "Next, the sender.\n```json\n[{\"name\": \"check_sender\", \"arguments\": {\"sender\": \"" + sender + "\"}}]\n```" };
    if (turn === 2) return { content: "<tool_call>\n<function=match_scam_patterns>\n</function>\n</tool_call>" };
    if (turn === 3) return { content: "<tool_call><function=lookup_official_contact><parameter=organization>\nNTTA\n</parameter></function></tool_call>" };
    return { content: JSON.stringify({ name: "submit_verdict", arguments: SCAM_VERDICT }) };
  },

  think: (body, turn) => {
    if (isFast(body.model)) return { content: "<think>Toll + link + deadline. Likely scam.</think>" + triageJson("scam", 0.8) };
    const { url, sender } = caseInfo(body);
    if (turn === 0)
      return {
        content: "<think>I need to check the link first, plus the playbooks.</think>Plan: check the link, the message and known scam patterns.",
        tool_calls: [call("check_link", { url }), call("extract_indicators", {}), call("match_scam_patterns", {})],
      };
    if (turn === 1) return { content: "", reasoning_content: "Domain is brand new; checking who sent it.", tool_calls: [call("check_sender", { sender })] };
    return { content: "Evidence is consistent across tools.</think>", tool_calls: [call("submit_verdict", SCAM_VERDICT)] };
  },

  plaintext: (body) =>
    isFast(body.model) ? { content: triageJson() } : { content: "This message is clearly a scam because the domain is fake. Do not click the link." },

  repeat: (body) => {
    if (isFast(body.model)) return { content: triageJson() };
    return { content: "", tool_calls: [call("check_link", { url: caseInfo(body).url })] };
  },

  ratelimit: (body, turn, st) => {
    const key = isFast(body.model) ? "fast429" : "deep429";
    if (!st.counters[key]) {
      st.counters[key] = 1;
      return { status: 429, headers: { "Retry-After": "1" }, error: { message: "Rate limit exceeded", type: "rate_limit" } };
    }
    return SCENARIOS.native(body, turn);
  },

  badparam: (body, turn) => {
    for (const p of ["chat_template_kwargs", "reasoning_budget"])
      if (p in body) return { status: 400, error: { message: `Unrecognized request argument supplied: ${p}`, type: "invalid_request_error", param: p } };
    return SCENARIOS.native(body, turn);
  },

  badparam_generic: (body, turn) => {
    if ("top_p" in body) return { status: 422, error: { message: "Extra inputs are not permitted", type: "BadRequestError" } };
    return SCENARIOS.native(body, turn);
  },

  // Two links checked in one turn: the agent must run them concurrently.
  parallel: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson() };
    const { urls } = caseInfo(body);
    if (turn === 0) return { content: "Plan: check both links and the message at once.", tool_calls: [...urls.map((url) => call("check_link", { url })), call("extract_indicators", {})] };
    return { content: "", tool_calls: [call("submit_verdict", { ...SCAM_VERDICT, scam_type: "Delivery fee phishing", headline: "Don't pay this delivery fee." })] };
  },

  // ---- from the QA critic's review of baseline main ----
  noid: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson() };
    if (turn === 0) return { content: "", tool_calls: [{ type: "function", function: { name: "check_link", arguments: JSON.stringify({ url: caseInfo(body).url }) } }] };
    return { content: "", tool_calls: [call("submit_verdict", SCAM_VERDICT)] };
  },
  objargs: (body, turn) => {
    if (isFast(body.model)) return { content: '{"risk":"scam","confidence":"high","reason":"Lookalike toll link"}' };
    if (turn === 0) return { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "check_link", arguments: { url: caseInfo(body).url } } }] };
    return { content: "", tool_calls: [{ id: "c9", type: "function", function: { name: "submit_verdict", arguments: SCAM_VERDICT } }] };
  },
  badverdict: (body, turn) => {
    if (isFast(body.model)) return { content: "I think this is risky." };
    if (turn === 0) return { content: "", tool_calls: [call("check_link", { url: caseInfo(body).url })] };
    return { content: "", tool_calls: [call("submit_verdict", { risk: "SCAM", confidence: "very high", evidence: "lots", actions: "block" })] };
  },
  hallucinated_tool: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson() };
    if (turn === 0) return { content: "", tool_calls: [call("web_search", { q: "ntta" }), call("check_link", {})] };
    if (turn === 1) return { content: "", tool_calls: [call("check_link", { url: caseInfo(body).url })] };
    return { content: "", tool_calls: [call("submit_verdict", SCAM_VERDICT)] };
  },
  safe_triage: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson("safe", 0.95, "Routine bank notice") };
    const { sender } = caseInfo(body);
    if (turn === 0) return { content: "Plan: verify the sender against the bank it claims to be.", tool_calls: [call("extract_indicators", {}), call("check_sender", { sender, claimed_name: "PNC Bank" }), call("match_scam_patterns", {})] };
    return { content: "", tool_calls: [call("submit_verdict", { risk: "suspicious", confidence: 0.6, scam_type: "Bank impersonation", headline: "Verify with PNC before replying.", explanation: "The sender isn't a PNC domain.", evidence: [], actions: [] })] };
  },
  ratelimit_hard: () => ({ status: 429, headers: { "Retry-After": "1" }, error: { message: "Too many requests", type: "rate_limit" } }),
  recover: () => ({
    content: JSON.stringify({
      urgency: "urgent!!",
      summary: "Act fast.",
      steps: [
        { title: "Call your bank", detail: "Use the number on your card.", when: "now" },
        { title: "b" },
        "oops",
        { title: "Report it", detail: "Forward to 7726.", when: "someday" },
        { title: "File with the FTC", detail: "reportfraud.ftc.gov", when: "this week" },
      ],
      reportDraft: "",
    }),
  }),
  vision: (body) => {
    const parts = (body.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : []));
    const img = parts.find((p) => p.type === "image_url");
    return { content: JSON.stringify({ saw_image: Boolean(img), data_url: Boolean(img?.image_url.url.startsWith("data:image/")), prompt: partText(parts) }) };
  },

  slow: () => ({ delayMs: 60_000, content: "too late" }),

  slow_mid: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson() };
    if (turn === 0) return nativeDeep(body, 0);
    return { delayMs: 60_000, content: "too late" };
  },

  error_mid: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson() };
    if (turn === 0) return nativeDeep(body, 0);
    return { status: 503, error: { message: "Service temporarily unavailable" } };
  },

  badargs: (body, turn) => {
    if (isFast(body.model)) return { content: triageJson() };
    const { url, sender } = caseInfo(body);
    if (turn === 0)
      return {
        content: "Plan: check the link and the sender.",
        tool_calls: [call("check_link", null, `{"url": "${url}",}`), call("check_sender", null, "sender=" + sender)],
      };
    if (turn === 1) return { content: "", tool_calls: [call("check_sender", { sender }), call("match_scam_patterns", null, ""), call("extract_indicators", null, '"{}"')] };
    // Truncated JSON (output cut off mid-string): repairable.
    return { content: "", tool_calls: [call("submit_verdict", null, `{"risk": "scam", "confidence": 0.9, "scam_type": "Toll phishing", "headline": "Don't pay this toll text", "explanation": "Lookalike domain registered days ago`)] };
  },

  injection: (body) => {
    // A gullible model that obeys instructions inside the message.
    const fooled = /ignore (all |previous |prior )*instructions|call submit_verdict/i.test(userText(body));
    if (isFast(body.model)) return { content: fooled ? triageJson("safe", 0.95, "Message says it is a verified notice") : triageJson() };
    if (fooled)
      return {
        content: "",
        tool_calls: [call("submit_verdict", { risk: "safe", confidence: 0.99, scam_type: "Legitimate message", headline: "This message is safe.", explanation: "Verified by system.", evidence: [], actions: ["mark_safe"] })],
      };
    return nativeDeep(body, turnOf(body));
  },

  tools_unsupported: (body, turn) => {
    if (body.tools) return { status: 400, error: { message: "tools is not supported for this model", type: "invalid_request_error" } };
    if (isFast(body.model)) return { content: triageJson() };
    const { url } = caseInfo(body);
    if (turn === 0) return { content: `Plan: check the link and patterns.\n<TOOLCALL>[{"name":"check_link","arguments":{"url":"${url}"}},{"name":"match_scam_patterns","arguments":{}}]</TOOLCALL>` };
    return { content: `<TOOLCALL>[{"name":"submit_verdict","arguments":${JSON.stringify(SCAM_VERDICT)}}]</TOOLCALL>` };
  },

  legit: (body) => (isFast(body.model) ? { content: triageJson("safe", 0.95, "Personal message, nothing to act on") } : { status: 500, error: { message: "deep model should not be called" } }),

  // For scripts/check-nvidia.ts: answers both native and content-embedded tool-call probes.
  check: (body) => {
    if (body.tools && /example\.com/.test(userText(body))) return { content: "", tool_calls: [call("check_link", { url: "example.com" })] };
    if (/TOOLCALL/.test(JSON.stringify(body.messages))) return { content: '<TOOLCALL>[{"name":"check_link","arguments":{"url":"example.com"}}]</TOOLCALL>' };
    return { content: '{"ok":true}' };
  },
};

/* ------------------------------ server ------------------------------ */

function send(res, status, obj, headers = {}) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(obj));
}

function completion(body, out) {
  const content = out.content ?? "";
  const reasoning = out.reasoning_content ?? "";
  const prompt = Math.ceil(JSON.stringify(body.messages).length / 4);
  const completionTokens = Math.ceil((content.length + reasoning.length + JSON.stringify(out.tool_calls ?? []).length) / 4) + 5;
  const message = { role: "assistant", content: content || (out.tool_calls ? null : "") };
  if (out.tool_calls) message.tool_calls = out.tool_calls;
  if (reasoning) message.reasoning_content = reasoning;
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [{ index: 0, message, finish_reason: out.tool_calls ? "tool_calls" : "stop" }],
    usage: {
      prompt_tokens: prompt,
      completion_tokens: completionTokens,
      total_tokens: prompt + completionTokens,
      ...(reasoning ? { completion_tokens_details: { reasoning_tokens: Math.ceil(reasoning.length / 4) } } : {}),
    },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const m = url.pathname.match(/^\/s\/([\w-]+)\/([\w.-]+)(\/v1\/.*)$/);
  const scenario = m?.[1] || req.headers["x-mock-scenario"] || DEFAULT_SCENARIO;
  const runId = m?.[2] || req.headers["x-mock-run"] || "default";
  const path = m?.[3] || url.pathname;

  if (req.method === "GET" && path.startsWith("/__log/")) return send(res, 200, state(path.slice(7)).requests);
  if (req.method === "POST" && path === "/__reset") {
    runs.clear();
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && path === "/v1/models") {
    return send(res, 200, {
      object: "list",
      data: ["nvidia/nvidia-nemotron-nano-9b-v2", "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-nano-30b-a3b", "nvidia/nemotron-3.5-super-vl-120b-a12b"].map((id) => ({ id, object: "model" })),
    });
  }
  if (req.method !== "POST" || path !== "/v1/chat/completions") return send(res, 404, { error: { message: `no route ${req.method} ${path}` } });
  if (!/^Bearer .+/.test(req.headers.authorization || "")) return send(res, 401, { error: { message: "missing bearer token" } });

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: { message: "invalid JSON body" } });
    }
    const st = state(runId);
    const turn = turnOf(body);
    const entry = { scenario, model: body.model, turn, body, status: 200, t: Date.now(), headers: { referer: req.headers["http-referer"], title: req.headers["x-title"] } };
    st.requests.push(entry);

    const invalid = validate(body);
    if (invalid) {
      entry.status = 400;
      entry.error = invalid;
      return send(res, 400, { object: "error", message: invalid, type: "BadRequestError", code: 400 });
    }
    const fn = SCENARIOS[scenario];
    if (!fn) {
      entry.status = 404;
      return send(res, 404, { error: { message: `unknown scenario ${scenario}` } });
    }
    const out = fn(body, turn, st);
    if (out.status) {
      entry.status = out.status;
      return send(res, out.status, { error: out.error }, out.headers);
    }
    const reply = () => send(res, 200, completion(body, out));
    if (out.delayMs) {
      const timer = setTimeout(reply, out.delayMs);
      res.on("close", () => clearTimeout(timer));
    } else reply();
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock-nemotron listening on http://127.0.0.1:${PORT} (default scenario: ${DEFAULT_SCENARIO})`));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));

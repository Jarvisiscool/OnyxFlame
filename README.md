# Second Look

**An AI agent that investigates every suspicious text, voicemail and link before you act on it.**
Built for HackUTD 2026: T-Mobile *Safe Signal* challenge + NVIDIA *Nemotron Beyond a Chatbot* track.

Scam detection usually ends at a label. Second Look runs an investigation the moment a message lands. It redacts your personal data, triages with a small Nemotron model, and escalates risky messages to a larger Nemotron model. That model **plans and calls tools** to verify what the message claims: who really sent it, how old the link's domain is, whether it impersonates a brand, what the real company says it never asks for. You get a plain-language verdict with honest confidence, one-tap protection, a recovery plan if you already responded, and practice so you spot the next one yourself.

**Before, during and after a threat:**

| | What the customer gets |
|---|---|
| **Before** | *Practice*: Nemotron writes practice messages based on the scams that actually reached you |
| **During** | *Live protection*: the agent investigates automatically on arrival. Scam text is blurred, and you can block, report to 7726, or check with the real company in one tap |
| **After** | *Recovery*: tell it what you did (tapped, typed a password, sent money, shared a code) and get a personalized, ordered plan plus a pre-filled FTC report |

---

## How Nemotron is used (NVIDIA track)

| Requirement | How Second Look meets it |
|---|---|
| **Beyond a chatbot** | The user never types a prompt. The agent is triggered by an incoming message and acts on its own. |
| **Multi-step workflows** | Redact → triage (Nemotron Nano) → route → investigate (Nemotron Super plans tool calls across several turns) → structured verdict via a `submit_verdict` tool → deterministic guardrails |
| **Tool integration** | 6 function-calling tools: `extract_indicators`, `check_sender` (carrier network intelligence), `check_link` (live **RDAP** domain registry + lookalike/homoglyph detector), `lookup_official_contact`, `match_scam_patterns`, `submit_verdict` |
| **Real-world applicability** | Measured on a labeled synthetic set (`npm run eval`), privacy-first design, recorded replay for reliability |

**Going further:**
- **Two-model routing.** Nemotron Nano answers routine messages alone. Only risky ones pay for the Super investigation. The Results tab reports the share of messages that took the fast path.
- **Nemotron as data engine.** `npm run generate` has Nemotron write labeled synthetic scam and legitimate messages for evaluation. *Practice* uses Nemotron to write custom training rounds.
- **Visible reasoning.** The trace shows every tool call, its arguments, its findings and timing, plus the model's reasoning.
- **Guardrails around the model.** If Nemotron says "safe" but tools found a lookalike domain or a code request, the verdict is raised and the UI says why. If it claims high confidence that no tool supports, confidence is capped.

## T-Mobile judging criteria

- **Creativity:** an investigator, not a classifier. It verifies what the message claims against carrier signals and real registries.
- **Impact:** covers before, during and after a threat. It also catches the hardest cases: caller-ID-spoofed bank calls, SIM-swap code theft, "Hi Mom" texts.
- **Usability:** a native-feeling phone UI with one-sentence verdicts and one-tap actions.
- **Security & privacy:** card numbers, SSNs, one-time codes, account numbers, names and addresses are redacted *before* any model sees the text. All data is synthetic.
- **Detection quality:** the Results tab compares rules-only against the Nemotron agent on the same labeled set. It reports catch rate, false-alarm rate and precision.
- **Honest confidence:** every verdict shows a calibrated %, says what it couldn't confirm, and "Suspicious" exists so it doesn't have to bluff.

---

## Run it

```bash
npm install
cp .env.example .env.local      # paste your key from build.nvidia.com
npm run check                   # verifies key, lists Nemotron models, tests tool calling
npm run dev                     # http://localhost:3000
```

No key? The app still runs in **offline mode**: the same tools in a fixed order with a rule-based verdict. It's clearly labeled in the UI.

**OpenRouter instead of build.nvidia.com:** set `NVIDIA_BASE_URL=https://openrouter.ai/api/v1`, put your OpenRouter key in `NVIDIA_API_KEY`, and set both model variables to `nvidia/nemotron-3-super-120b-a12b:free` (or another Nemotron model listed there).

### Scripts

| Command | What it does |
|---|---|
| `npm run check` | Confirms your key works, lists the Nemotron models you can use, and checks that the deep model makes tool calls |
| `npm run eval` | Scores rules-only and the Nemotron agent on the labeled set → `src/data/eval-results.json` (shown in Results) |
| `npm run generate -- 30` | Nemotron writes 30 more labeled synthetic messages → `src/data/eval-set.generated.json` |

### Demo-day checklist

1. `npm run check`. If a model isn't available, set `NEMOTRON_FAST_MODEL` / `NEMOTRON_DEEP_MODEL` in `.env.local`.
2. Click through all 9 demo messages once with the key set. Each live run is saved to `recordings/`.
3. `npm run eval` so the Results tab shows real Nemotron numbers.
4. Commit `recordings/` and `src/data/eval-results.json`.
5. If the Wi-Fi is bad on stage, turn on **Replay saved runs** in the header. Recorded Nemotron runs stream back with their original timing.
6. Press **N** to deliver the next demo message.

---

## Architecture

```
incoming message
   │
   ├─ redact()                        src/lib/redact.ts          personal data never leaves
   ├─ triage    Nemotron Nano         src/lib/agent.ts           JSON risk + confidence
   ├─ route     fast path | escalate
   ├─ investigate  Nemotron Super  ⇄  src/lib/tools/*            function calling, ≤7 turns
   │      extract_indicators · check_sender · check_link (RDAP) ·
   │      lookup_official_contact · match_scam_patterns · submit_verdict
   ├─ applyGuardrails()                                          deterministic safety layer
   └─ stream events (NDJSON) → UI    src/app/api/analyze/route.ts
```

- `src/app/api/analyze`: streams agent events, records live runs, replays them on request
- `src/app/api/recover`: personalized recovery plan (Nemotron) with offline fallback
- `src/app/api/gym`: practice rounds written by Nemotron with offline fallback
- `src/components/`: phone UI, agent trace, practice, results

### What's real and what's simulated

- **Real:** Nemotron calls, RDAP domain lookups for real domains, lookalike detection, redaction, scam-pattern library, guardrails.
- **Simulated:** carrier network signals (number age, STIR/SHAKEN attestation, sending volume, spam reports) and registry entries for our *invented* scam domains (`src/data/simulated-network.ts`). A carrier already has this data. Second Look defines the API it would plug into.
- **All messages are synthetic.** Phone numbers use fictional 555 ranges. No real customer data is used anywhere.

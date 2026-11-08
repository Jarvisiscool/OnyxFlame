export type Channel = "sms" | "email" | "voicemail";

export interface InboxMessage {
  id: string;
  channel: Channel;
  /** Phone number, short code, or email address of the sender */
  from: string;
  /** Name the sender claims to be (what the phone shows) */
  displayName?: string;
  body: string;
  receivedAt: string;
  /** Ground-truth label for synthetic data only. Never sent to the model. */
  label?: "scam" | "legit" | "suspicious";
}

export type Risk = "safe" | "suspicious" | "scam";

export interface Evidence {
  signal: string;
  detail: string;
  weight: "high" | "medium" | "low";
  direction: "risk" | "safe";
  source: string;
}

export type ActionId =
  | "block_sender"
  | "report_7726"
  | "delete_message"
  | "verify_official"
  | "warn_family"
  | "mark_safe"
  | "open_recovery";

export interface SuggestedAction {
  id: ActionId;
  label: string;
  reason?: string;
}

export interface VerifyContact {
  org: string;
  how: string;
  url?: string;
}

export interface Verdict {
  risk: Risk;
  /** 0..1 */
  confidence: number;
  scamType: string;
  headline: string;
  explanation: string;
  evidence: Evidence[];
  actions: SuggestedAction[];
  verifyContact?: VerifyContact;
  /** What the agent is unsure about — shown so users get honest confidence */
  uncertainty?: string;
  /** Set when a deterministic guardrail changed the model's call */
  guardrail?: string;
}

export type RunMode = "live" | "replay" | "offline";

/**
 * Token usage reported by the endpoint's `usage` block (absent if the provider didn't return it).
 * Shape matches what the UI reads (src/components/events.ts). Each model call's usage is attached to exactly
 * one rendered event (triage, plan, thought, first tool_call of the turn, or the verdict), so summing
 * `usage` over all events gives the run total without double counting.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Reasoning tokens, when the provider breaks them out */
  reasoningTokens?: number;
}

/** Where a tool call came from: the model, the agent's verification sweep, the rules fallback after a model failure, or offline rules. */
export type ToolOrigin = "model" | "verifier" | "fallback" | "rules";

export interface ModelMetrics {
  calls: number;
  ms: number;
  tokens: TokenUsage;
}

export interface RunMetrics {
  /** Wall-clock time spent waiting on model calls */
  llmMs: number;
  /** Wall-clock time spent in tool batches */
  toolMs: number;
  tokens: TokenUsage;
  byModel: Record<string, ModelMetrics>;
  /** Overall time budget for the run */
  budgetMs: number;
  /** True when the rules finished the run because the model couldn't */
  fallback?: boolean;
  /** True when any model step failed (triage unavailable, fallback, rate limit). Degraded runs aren't recorded. */
  degraded?: boolean;
}

export type AgentEvent =
  | { type: "start"; mode: RunMode; models: { fast: string; deep: string }; t: number; budgetMs?: number }
  | { type: "redaction"; redacted: string; items: { kind: string; count: number }[]; t: number }
  | {
      type: "triage";
      model: string;
      risk: Risk;
      confidence: number;
      reason: string;
      ms: number;
      t: number;
      usage?: TokenUsage;
    }
  | { type: "route"; decision: "fast_path" | "escalate"; reason: string; t: number }
  | { type: "thought"; model: string; text: string; t: number; turn?: number; ms?: number; usage?: TokenUsage }
  /** The investigation plan: stated by the deep model, derived from its first tool batch, or the rules' fixed plan. */
  | { type: "plan"; model: string; text: string; steps: string[]; source: "model" | "derived" | "rules"; t: number; ms?: number; usage?: TokenUsage }
  /** One model round-trip, with latency and token usage for the metrics strip. */
  | {
      type: "llm_call";
      model: string;
      purpose: "triage" | "investigate";
      turn?: number;
      ms: number;
      /** Named `tokens` (not `usage`) so UI token sums don't count a call twice */
      tokens?: TokenUsage;
      /** Tool calls the model requested in this turn */
      toolCalls: number;
      /** native = OpenAI tool_calls; content = parsed from the message text (e.g. <TOOLCALL>…) */
      format?: "native" | "content" | "none";
      /** Reasoning mode requested for this call (off | on | low | token budget) */
      thinking?: string;
      t: number;
    }
  | {
      type: "tool_call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      t: number;
      origin?: ToolOrigin;
      turn?: number;
      format?: "native" | "content";
      /** Model that requested the call ("rules" for verifier/fallback/offline calls) */
      model?: string;
      ms?: number;
      usage?: TokenUsage;
    }
  | {
      type: "tool_result";
      id: string;
      name: string;
      summary: string;
      signals: Evidence[];
      data: unknown;
      ms: number;
      t: number;
      origin?: ToolOrigin;
      error?: string;
    }
  /** Deterministic safety layer (verification sweep + guardrails) ran; `changed` when it altered the model's call. */
  | { type: "guardrail"; changed: boolean; note?: string; ms: number; t: number }
  | { type: "verdict"; verdict: Verdict; model: string; t: number; ms?: number; usage?: TokenUsage }
  | { type: "notice"; level: "info" | "warn"; text: string; t: number }
  | { type: "done"; totalMs: number; llmCalls: number; toolCalls: number; t: number; metrics?: RunMetrics };

export type AnalyzeRequest = {
  message: InboxMessage;
  replay?: boolean;
};

export type WhatHappened =
  | "clicked_link"
  | "entered_info"
  | "sent_money"
  | "shared_code"
  | "called_back";

export interface RecoveryStep {
  title: string;
  detail: string;
  when: "now" | "today" | "this week";
}

export interface RecoveryPlan {
  urgency: "critical" | "high" | "moderate";
  summary: string;
  steps: RecoveryStep[];
  reportDraft: string;
  source: RunMode;
}

export interface GymCard {
  id: string;
  from: string;
  displayName?: string;
  body: string;
  isScam: boolean;
  tells: string[];
}

/* ---------------- Practice lessons (Nemotron-written, with an offline fallback) ---------------- */

export type LessonQuestionType = "mcq" | "scam_or_legit";

export interface LessonQuestion {
  id: string;
  type: LessonQuestionType;
  channel: Channel;
  from: string;
  /** Email subject line */
  subject?: string;
  body: string;
  /** Question text for multiple choice ("What's the biggest giveaway?") */
  prompt?: string;
  /** Multiple-choice options (3-4) */
  options?: string[];
  /** For mcq: the exact option text. For scam_or_legit: "scam" or "legit". */
  answer: string;
  /** Short phrases, copied from the body where possible, so the UI can highlight them */
  tells: string[];
  explanation: string;
  /** Inbox style to draw an email in (generic look, no logos) */
  look?: "gmail" | "outlook";
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Lesson {
  id: string;
  topic: string;
  lesson: { title: string; points: string[]; example: string };
  questions: LessonQuestion[];
  flashcards: Flashcard[];
  source?: RunMode;
}

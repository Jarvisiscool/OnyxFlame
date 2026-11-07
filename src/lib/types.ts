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

export type AgentEvent =
  | { type: "start"; mode: RunMode; models: { fast: string; deep: string }; t: number }
  | { type: "redaction"; redacted: string; items: { kind: string; count: number }[]; t: number }
  | {
      type: "triage";
      model: string;
      risk: Risk;
      confidence: number;
      reason: string;
      ms: number;
      t: number;
    }
  | { type: "route"; decision: "fast_path" | "escalate"; reason: string; t: number }
  | { type: "thought"; model: string; text: string; t: number }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown>; t: number }
  | {
      type: "tool_result";
      id: string;
      name: string;
      summary: string;
      signals: Evidence[];
      data: unknown;
      ms: number;
      t: number;
    }
  | { type: "verdict"; verdict: Verdict; model: string; t: number }
  | { type: "notice"; level: "info" | "warn"; text: string; t: number }
  | { type: "done"; totalMs: number; llmCalls: number; toolCalls: number; t: number };

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

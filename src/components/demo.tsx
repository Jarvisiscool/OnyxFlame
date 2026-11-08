"use client";
import type { FamilyLine } from "@/data/demo-family";

import { createContext, useContext } from "react";
import type { InboxMessage, RecoveryPlan, WhatHappened } from "@/lib/types";
import type { Run } from "./useAnalysis";

export type Screen =
  | { name: "lock" }
  | { name: "home"; focusChecker?: boolean }
  | { name: "activity" }
  | { name: "practice" }
  | { name: "ask"; about?: string }
  | { name: "thread"; id: string }
  | { name: "pause"; id: string }
  | { name: "timeline"; id: string; recover?: boolean };

export type Line = string;
export type Decision = "reported" | "safe";
export type SheetName = "labels" | "blocklist" | "report" | "addMember";

export interface RecoveryState {
  what?: WhatHappened;
  plan?: RecoveryPlan;
  loading?: boolean;
  /** They didn't tap or type anything: no recovery needed */
  none?: boolean;
  checked: boolean[];
}

export interface LessonInfo {
  source: "live" | "offline" | "replay";
  title: string;
  personalized: string[];
}

export interface Labels {
  texts: boolean;
  calls: boolean;
  pause: boolean;
}

export interface Ctl {
  inbox: InboxMessage[];
  checks: InboxMessage[];
  runs: Record<string, Run>;
  screen: Screen;
  go: (s: Screen) => void;
  line: Line;
  setLine: (l: Line) => void;
  decisions: Record<string, Decision>;
  report: (id: string, quiet?: boolean) => void;
  markSafe: (id: string) => void;
  blocked: string[];
  unblock: (sender: string) => void;
  recovery: Record<string, RecoveryState>;
  recover: (id: string, what: WhatHappened | "nothing") => void;
  toggleStep: (id: string, i: number) => void;
  check: (text: string) => void;
  retry: (id: string) => void;
  toast: (text: string) => void;
  sheet: SheetName | null;
  openSheet: (s: SheetName | null) => void;
  labels: Labels;
  setLabels: (l: Labels) => void;
  seenTypes: string[];
  streak: number;
  finishLesson: () => void;
  reports: number;
  lessonInfo: LessonInfo | null;
  setLessonInfo: (l: LessonInfo | null) => void;
  find: (id: string) => InboxMessage | undefined;
  family: FamilyLine[];
  addMember: (m: { name: string; relation: string; age: number; phone?: string }) => void;
  removeMember: (id: string) => void;
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
}

export const DemoCtx = createContext<Ctl | null>(null);

export function useDemo() {
  const c = useContext(DemoCtx);
  if (!c) throw new Error("useDemo outside DemoCtx");
  return c;
}

/** The demo-inbox id a delivered message came from ("toll-1731..." → "toll"). */
export const baseId = (id: string) => id.replace(/-\d+$/, "");

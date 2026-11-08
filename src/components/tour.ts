/** Scripted walkthrough for recording a demo video. Each scene runs an action, shows a caption, then waits. */
export type TourAction = { kind: "reset" } | { kind: "deliver" } | { kind: "step"; key: string } | { kind: "none" };

export interface TourScene {
  action: TourAction;
  caption: string;
  ms: number;
}

export const TOUR: TourScene[] = [
  { action: { kind: "step", key: "home" }, caption: "Meet Maria. Second Look protects her whole family from scams: before, during and after a threat.", ms: 5000 },
  { action: { kind: "deliver" }, caption: "A toll text arrives. Second Look checks it privately, before Maria even opens it.", ms: 7000 },
  { action: { kind: "step", key: "lock" }, caption: "Warned on the lock screen: likely scam, fake toll text. Report and block, or not a scam.", ms: 5500 },
  { action: { kind: "step", key: "thread" }, caption: "Inside the message: one plain reason, honest confidence, and two clear choices.", ms: 6000 },
  { action: { kind: "step", key: "pause" }, caption: "Maria taps the link anyway. Instead of the scam site, she gets a calm pause and the safe way forward.", ms: 7000 },
  { action: { kind: "step", key: "timeline" }, caption: "Already tapped it? A recovery timeline guides every next step, and checks back in tomorrow.", ms: 7000 },
  { action: { kind: "deliver" }, caption: "Real messages pass quietly. A genuine verification code just gets a green tick.", ms: 5500 },
  { action: { kind: "step", key: "dad" }, caption: "On a family plan, Maria sees Dad's alerts, never his messages. Frank paused and asked her first.", ms: 6500 },
  { action: { kind: "step", key: "sofia" }, caption: "Sofia gets the same protection, in a calm, teen-friendly tone.", ms: 5000 },
  { action: { kind: "step", key: "activity" }, caption: "Every check, block and report in one place. Each report helps protect other customers.", ms: 5000 },
  { action: { kind: "step", key: "practice" }, caption: "Before the next threat: Nemotron builds a quick lesson across texts, voicemail and email.", ms: 7000 },
  { action: { kind: "step", key: "home" }, caption: "Under the hood: Nemotron agents investigate with real tools, and safety rules double-check every call.", ms: 6500 },
  { action: { kind: "none" }, caption: "Second Look. Detection is the start. Feeling protected is the product.", ms: 5000 },
];

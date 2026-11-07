import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentEvent, InboxMessage } from "./types";

/**
 * Demo insurance: every successful live Nemotron run is saved to /recordings.
 * With replay on, the UI streams the saved run instead of calling the API,
 * so bad Wi-Fi or rate limits can't break the demo. Commit the folder before presenting.
 */
const DIR = path.join(process.cwd(), "recordings");

export function recordingKey(m: InboxMessage) {
  return createHash("sha1").update(`${m.channel}|${m.from}|${m.displayName ?? ""}|${m.body}`).digest("hex").slice(0, 16);
}

export async function loadRecording(m: InboxMessage): Promise<AgentEvent[] | null> {
  try {
    const raw = await fs.readFile(path.join(DIR, `${recordingKey(m)}.json`), "utf8");
    return JSON.parse(raw).events as AgentEvent[];
  } catch {
    return null;
  }
}

export async function saveRecording(m: InboxMessage, events: AgentEvent[]) {
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(
      path.join(DIR, `${recordingKey(m)}.json`),
      JSON.stringify({ message: { ...m, label: undefined }, recordedAt: new Date().toISOString(), events }, null, 2),
    );
  } catch {
    // Read-only filesystems (e.g. serverless) simply skip recording.
  }
}

export async function countRecordings() {
  try {
    return (await fs.readdir(DIR)).filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

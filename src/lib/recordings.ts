import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentEvent, InboxMessage } from "./types";
import { redact } from "./redact";

/**
 * Demo insurance: every successful live Nemotron run is saved to /recordings.
 * With replay on, the UI streams the saved run instead of calling the API,
 * so bad Wi-Fi or rate limits can't break the demo. Commit the folder before presenting.
 *
 * Privacy: the raw message body is never written. Files hold the redacted text (the same text
 * the models saw) and are looked up by a one-way hash of the original message.
 */
const DIR = path.join(process.cwd(), "recordings");

export function recordingKey(m: InboxMessage) {
  return createHash("sha256").update(`${m.channel}|${m.from}|${m.displayName ?? ""}|${m.body}`).digest("hex").slice(0, 16);
}

/** Keys written by earlier versions (sha1), so old recordings keep replaying. */
function legacyKey(m: InboxMessage) {
  return createHash("sha1").update(`${m.channel}|${m.from}|${m.displayName ?? ""}|${m.body}`).digest("hex").slice(0, 16);
}

export async function loadRecording(m: InboxMessage): Promise<AgentEvent[] | null> {
  for (const key of [recordingKey(m), legacyKey(m)]) {
    try {
      const raw = await fs.readFile(path.join(DIR, `${key}.json`), "utf8");
      const events = JSON.parse(raw).events as AgentEvent[];
      if (Array.isArray(events) && events.length) return events;
    } catch {
      // try the next key
    }
  }
  return null;
}

/** What a recording file stores about the message: never the raw body. */
export function recordedMessage(m: InboxMessage) {
  return { id: m.id, channel: m.channel, from: m.from, displayName: m.displayName, redactedBody: redact(m.body).redacted };
}

export async function saveRecording(m: InboxMessage, events: AgentEvent[]) {
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(
      path.join(DIR, `${recordingKey(m)}.json`),
      JSON.stringify({ key: recordingKey(m), message: recordedMessage(m), recordedAt: new Date().toISOString(), events }, null, 2),
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

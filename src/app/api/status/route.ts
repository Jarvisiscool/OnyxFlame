import { connection } from "next/server";
import { hasNvidiaKey, FAST_MODEL, DEEP_MODEL } from "@/lib/nemotron";
import { countRecordings } from "@/lib/recordings";

export async function GET() {
  await connection();
  return Response.json({
    live: hasNvidiaKey(),
    fastModel: FAST_MODEL,
    deepModel: DEEP_MODEL,
    recordings: await countRecordings(),
  });
}

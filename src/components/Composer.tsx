"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, InboxMessage } from "@/lib/types";

const EXAMPLES: { label: string; m: Pick<InboxMessage, "from" | "displayName" | "body" | "channel"> }[] = [
  { label: "Fake USPS", m: { channel: "sms", from: "+1 (469) 555-0131", body: "USPS: Your package is on hold due to an invalid address. Update within 12 hours: usps-redelivery.info/track" } },
  { label: "Real-looking bank alert", m: { channel: "sms", from: "+1 (430) 555-0205", body: "PNC: Your account ending in 4421 has a low balance. View details in the PNC Mobile app." } },
  { label: "Jury duty call", m: { channel: "voicemail", from: "+1 (430) 555-0116", body: "This is Officer Grant with the Dallas County Sheriff. You missed jury duty and there is a warrant for your arrest. You can resolve this today with a payment. Call 214-555-0190." } },
];

export function Composer({ onSend, onClose }: { onSend: (m: Omit<InboxMessage, "id" | "receivedAt">) => void; onClose: () => void }) {
  const [channel, setChannel] = useState<Channel>("sms");
  const [from, setFrom] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [body, setBody] = useState("");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(560px,92vw)] rounded-2xl bg-panel p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        className="p-6"
        onSubmit={(e) => {
          if (!body.trim()) {
            e.preventDefault();
            return;
          }
          onSend({ channel, from: from.trim() || "+1 (430) 555-0199", displayName: displayName.trim() || undefined, body: body.trim() });
        }}
      >
        <h2 className="font-display text-2xl font-bold">Send a test message</h2>
        <p className="mt-1 text-sm text-muted">Paste any text, email snippet or voicemail. Personal details are redacted before the model sees it.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setChannel(ex.m.channel);
                setFrom(ex.m.from);
                setDisplayName(ex.m.displayName ?? "");
                setBody(ex.m.body);
              }}
              className="rounded-full border border-line px-3 py-1 text-[13px] font-medium hover:border-ink/40"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
          <label className="grid gap-1 text-[13px] font-semibold">
            Type
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="rounded-lg border border-line bg-panel px-2 py-2 text-sm font-normal">
              <option value="sms">Text</option>
              <option value="voicemail">Voicemail</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            From
            <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="+1 (430) 555-0199" className="rounded-lg border border-line px-3 py-2 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Caller ID name <span className="sr-only">(optional)</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Optional, e.g. PNC Bank" className="rounded-lg border border-line px-3 py-2 text-sm font-normal" />
          </label>
        </div>
        <label className="mt-3 grid gap-1 text-[13px] font-semibold">
          Message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} required placeholder="Paste the message here" className="rounded-lg border border-line px-3 py-2 text-sm font-normal leading-snug" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink-soft">
            Deliver to phone
          </button>
        </div>
      </form>
    </dialog>
  );
}

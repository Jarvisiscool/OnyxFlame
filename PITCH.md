# Pitch & demo script (3 minutes)

Press **N** to deliver each message. Keep the phone on the left and the agent trace on the right.

## 0:00 – The problem (20 s)
"Scam texts don't look like scams anymore. They come from a real-looking toll agency, your bank's caller ID, your own carrier. Detection tools stop at a label. People need someone to check *before* they tap."

## 0:20 – A scam arrives (50 s) · message 1: NTTA toll text
- A banner drops in: *Second Look is checking…*
- Point at the trace: "No one typed a prompt. The message triggered the agent. First it **redacts personal data on the device**. Then Nemotron Nano triages and escalates to Nemotron Super, which **plans its own investigation**."
- Tool calls: "Sender: overseas number, texted 40,000 people today. Link: `ntta-tollpay.top`, a lookalike **registered two days ago**. Directory: NTTA never collects tolls by text."
- Verdict: "Scam, 97%, in plain language. The text is blurred. One tap blocks it, one reports it to 7726."

## 1:10 – It doesn't cry wolf (25 s) · messages 2 and 4: Amazon code, T-Mobile bill
- "A real one-time code. Nano handles it alone in about a second, no deep investigation." Show **Fast path**.
- "A real T-Mobile bill with a link. The agent checks it, finds the official domain, which is decades old on the live RDAP registry, and a registered sender. Looks safe."

## 1:35 – The hard one (35 s) · message 3: PNC "safe account" voicemail
- "Caller ID says PNC Bank. The network can't verify it: STIR/SHAKEN level C. The message asks you to move money and to keep it secret from branch staff. That's a classic script."
- Tap **I already responded → I sent money**: "If it's too late, it switches to recovery. Call your bank now with the number on your card, then the 7726 report, then a pre-filled FTC report."

## 2:10 – Honest confidence (15 s) · message 6: "Hi Emily" wrong number
- "Not everything is black and white. Suspicious, 61%. It says what it couldn't confirm instead of bluffing."

## 2:25 – Before and proof (25 s)
- **Practice tab:** "Nemotron writes practice rounds based on the scams that actually reached you."
- **Results tab:** "Measured on labeled synthetic data: catch rate, false alarms, precision, Nemotron vs rules."

## 2:50 – Close (10 s)
"Second Look turns the carrier's network data plus Nemotron's reasoning into protection before, during and after a scam. Customers feel protected the whole way through."

---

## Likely judge questions

**Why two models?** Most texts are benign. Nano clears them cheaply and fast. Super's tool-using investigation runs only when there's something to verify.

**What if the model is wrong?** Deterministic guardrails sit on top. A lookalike domain or code request can't be called "safe", and confidence the evidence doesn't support gets capped. The UI shows when a guardrail fired.

**Is the carrier data real?** It's simulated and labeled as such. A carrier already has number age, caller-ID attestation, volume and spam reports. We designed the tool interface it would plug into. Domain registration data for real domains is live RDAP.

**Privacy?** Redaction runs before any model call, and the trace shows what was removed. All demo data is synthetic.

**What's next?** On-device Nemotron Nano for the triage step, voice-call transcription for live calls, and a family "guardian" mode that alerts a trusted contact.

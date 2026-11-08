"use client";

import { useState } from "react";
import { useDemo } from "./demo";
import { Icon, Logo } from "./ui";

/**
 * Demo sign-in: phone number + one-time code. Synthetic account only:
 * nothing is sent anywhere, and the code is shown on screen.
 */
const DEMO_CODE = "482913";

export function Login() {
  const d = useDemo();
  const [phone, setPhone] = useState("(469) 555-0134");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="view login">
      <div className="view-scroll">
        <div className="pad login-pad">
          <div className="login-brand">
            <Logo />
            <span>Second Look</span>
          </div>
          <h1>Calm scam protection for your whole family</h1>
          <p className="login-sub">Checks texts, calls and links privately before you act on them.</p>

          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sent) {
                if (phone.replace(/\D/g, "").length < 10) return setErr("Enter a 10-digit phone number.");
                setErr("");
                setSent(true);
                return;
              }
              if (code !== DEMO_CODE) return setErr("That code doesn't match. Use the demo code shown below.");
              setErr("");
              d.signIn();
            }}
          >
            <label>
              Mobile number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" disabled={sent} />
            </label>
            {sent && (
              <label>
                6-digit code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="••••••"
                />
              </label>
            )}
            {err && (
              <p className="form-err" role="alert">
                {err}
              </p>
            )}
            <button className="btn primary" type="submit">
              {sent ? "Sign in" : "Text me a code"}
            </button>
            {sent && (
              <p className="note">
                Demo code: <b className="tnum">{DEMO_CODE}</b>.{" "}
                <button type="button" className="link-btn" onClick={() => setCode(DEMO_CODE)}>
                  Fill it in
                </button>
              </p>
            )}
          </form>

          <p className="note login-privacy">
            <Icon name="lock" size={14} /> Demo account with synthetic data only. Second Look never asks for your password or a code by text.
          </p>
        </div>
      </div>
    </div>
  );
}

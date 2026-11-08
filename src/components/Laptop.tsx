"use client";

import { useEffect } from "react";
import { useDemo } from "./demo";
import { Icon, Logo } from "./ui";
import { Home, Activity, FamilyLine } from "./Home";
import { Thread, CalmPause } from "./Thread";
import { Timeline } from "./Timeline";
import { Lesson } from "./Lesson";
import { Sheet } from "./Sheets";
import { Login } from "./Login";
import { Ask } from "./Ask";
import { NotifCard } from "./Phone";
import { Judges } from "./Judges";
import { ThemeToggle } from "./ThemeToggle";

type Status = { live: boolean; fastModel: string; deepModel: string; recordings: number } | null;

/**
 * Second Look for laptop users: the same app as a desktop web app, with a sidebar,
 * a desktop notification for the two-stage warning, and "How it was checked" as a right rail.
 */
export function Laptop({
  notifId,
  dismissNotif,
  toastText,
  judgeId,
  status,
}: {
  notifId: string | null;
  dismissNotif: () => void;
  toastText: string | null;
  judgeId: string | null;
  status: Status;
}) {
  const d = useDemo();
  const s = d.screen;
  const notif = notifId ? d.find(notifId) : undefined;
  const notifRisk = notifId ? d.runs[notifId]?.verdict?.risk : undefined;

  useEffect(() => {
    if (notifRisk !== "safe") return;
    const t = setTimeout(dismissNotif, 3500);
    return () => clearTimeout(t);
  }, [notifRisk, notifId, dismissNotif]);

  let view: React.ReactNode;
  if (!d.signedIn) view = <Login />;
  else if (s.name === "thread") view = <Thread id={s.id} />;
  else if (s.name === "pause") view = <CalmPause key={s.id} id={s.id} />;
  else if (s.name === "timeline") view = <Timeline key={s.id} id={s.id} recover={s.recover} />;
  else if (s.name === "practice") view = <Lesson />;
  else if (s.name === "ask") view = <Ask key={s.about ?? "all"} about={s.about} />;
  else if (s.name === "activity") view = <Activity />;
  else view = d.line === "maria" ? <Home focusChecker={s.name === "home" ? s.focusChecker : undefined} /> : <FamilyLine id={d.line} />;

  const nav = [
    { id: "home", label: "Home", icon: "home", go: () => { d.setLine("maria"); d.go({ name: "home" }); } },
    { id: "activity", label: "Activity", icon: "list", go: () => d.go({ name: "activity" }) },
    { id: "practice", label: "Practice", icon: "target", go: () => d.go({ name: "practice" }) },
    { id: "ask", label: "Ask about scams", icon: "msg", go: () => d.go({ name: "ask" }) },
  ];
  const cur = s.name === "lock" ? "home" : s.name;
  const showNotif = notif && d.signedIn && !(s.name === "thread" && s.id === notif.id);

  return (
    <div className="laptop-full" role="region" aria-label="Second Look on a laptop">
          <div className={`laptop-app${d.signedIn ? "" : " signed-out"}`}>
            {d.signedIn && (
              <aside className="lt-side" aria-label="Second Look">
                <div className="lt-brand">
                  <Logo /> Second Look
                </div>
                <nav className="lt-nav" aria-label="App">
                  {nav.map((n) => (
                    <button key={n.id} onClick={n.go} aria-current={cur === n.id && (n.id !== "home" || d.line === "maria") ? "page" : undefined}>
                      <Icon name={n.icon} size={18} /> {n.label}
                    </button>
                  ))}
                </nav>
                <div className="lt-fam">
                  <div className="lt-h">Family plan</div>
                  {[{ id: "maria", name: "Bob", sub: "You" }, ...d.family.map((f) => ({ id: f.id, name: f.name, sub: f.relation }))].map((l) => (
                    <button
                      key={l.id}
                      aria-pressed={d.line === l.id && s.name === "home"}
                      onClick={() => {
                        d.setLine(l.id);
                        d.go({ name: "home" });
                      }}
                    >
                      <span className="av">{l.name[0]}</span>
                      <span>
                        {l.name}
                        <small>{l.sub}</small>
                      </span>
                    </button>
                  ))}
                  {d.family.length < 5 && (
                    <button className="add" onClick={() => d.openSheet("addMember")}>
                      <span className="av">+</span> Add someone
                    </button>
                  )}
                </div>
                <div className="lt-foot">
                  <ThemeToggle />
                  <button onClick={d.signOut}>Sign out</button>
                </div>
              </aside>
            )}
            <main className="lt-main">
              {view}
              {showNotif && (
                <div className="lt-notif" role="status">
                  <NotifCard msg={notif} onClose={dismissNotif} />
                </div>
              )}
              {d.sheet && <Sheet />}
              {toastText && (
                <div className="toast" role="status">
                  {toastText}
                </div>
              )}
            </main>
            {d.signedIn && (
              <aside className="lt-rail" aria-label="How it was checked">
                <Judges id={judgeId} status={status} />
              </aside>
            )}
          </div>
    </div>
  );
}

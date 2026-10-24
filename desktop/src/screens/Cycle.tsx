import { useEffect, useMemo, useState } from "react";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { Stepper } from "../components/Stepper";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { toast } from "../platform/toast";
import { useStore } from "../store";
import { todayISO, addDays, fmtDate, monthKey, monthLabel } from "@core/format";
import type { CycleFlow, CycleState } from "@core/types";
import {
  ABSORBENCY_NOTE,
  BUDDY_EMOJIS,
  DOCTOR_NOTE,
  HYGIENE_NOTES,
  PHASES,
  PRODUCTS,
  SAMPLE_BUDDY_NOTE,
  SYMPTOMS,
  addCustomSymptom,
  buddyShareLine,
  buddyTitle,
  changeOvertimeLine,
  clearDay,
  cycleCsv,
  cycleNotices,
  dayInWindow,
  dismissAbsorbency,
  estimateLine,
  forecast,
  forecastDetail,
  guessPhase,
  listedSymptoms,
  lowStash,
  lowStashLine,
  markEnd,
  markStart,
  packingTarget,
  rememberPeriod,
  removeCustomSymptom,
  rematchLine,
  restockPack,
  searchCycleDays,
  setBleeding,
  setBuddy,
  setChangeHours,
  setChangeKind,
  setFlowLevel,
  setStashCarry,
  setStashCount,
  setStashLow,
  setStashPack,
  skipBuddyIntro,
  saveBuddyIntro,
  showAbsorbency,
  startChangeTimer,
  stopChangeTimer,
  symptomLabel,
  timerCopy,
  togglePacked,
  toggleSymptom,
  typicalCompare,
  ovulationLine,
} from "@core/cycle";
import { doctorParagraphs, doctorReport, textPdf } from "@core/cycleReport";
import { allowNotify, syncCycleNotices } from "../platform/notify";
import { isTauri } from "../platform/env";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FLOWS: { id: CycleFlow; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
];

function clock(iso: string, format: "12h" | "24h") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: format === "12h" });
}

function Bools({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  // A switch, not an Off/On press-pair: one control, truthful direction.
  return (
    <label className="switch">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="sr-only">Toggle</span>
    </label>
  );
}

/**
 * Cycle on desktop: the phone's calendar, day editor, timer, stash, logs,
 * phases, doctor report and exports — one shared document. Reminders use
 * the webview's notifications and fire while the app is open.
 */
export function Cycle() {
  const { db, update } = useStore();
  const today = todayISO();
  const setCycle = (cycle: CycleState) => update((d) => ({ ...d, cycle }));

  const [cursor, setCursor] = useState(monthKey(today));
  const [selected, setSelected] = useState(today);
  const [pastStart, setPastStart] = useState("");
  const [pastEnd, setPastEnd] = useState("");
  const [name, setName] = useState(db.cycle.buddyName);
  const [emoji, setEmoji] = useState(db.cycle.buddyEmoji);
  const [introNote, setIntroNote] = useState(db.cycle.buddyNote || SAMPLE_BUDDY_NOTE);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [nudgeBlocked, setNudgeBlocked] = useState(false);

  // Buddy-line alarms (period window, change timer), synced from shared data.
  const hide = db.settings.privacyMode;
  useEffect(() => {
    const notices = cycleNotices(db.cycle, db.settings.quietHours, today);
    syncCycleNotices(
      notices.map((notice) => ({ id: notice.id, title: notice.title, at: new Date(notice.at) })),
      { pink: db.cycle.pinkCalendar, hide },
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    db.cycle.buddyName,
    db.cycle.periodNudge,
    db.cycle.changeNudge,
    db.cycle.changeEndsAt,
    db.cycle.changeRematchAt,
    db.cycle.paused,
    db.cycle.pinkCalendar,
    db.cycle.days.map((d) => d.date + (d.ended ? "e" : "")).join("|"),
    db.settings.quietHours.enabled,
    db.settings.quietHours.from,
    db.settings.quietHours.to,
    hide,
  ]);

  const next = useMemo(() => forecast(db.cycle, today), [db.cycle, today]);
  const typical = typicalCompare(db.cycle.days, today);
  const phase = guessPhase(db.cycle, today);
  const log = db.cycle.days.find((d) => d.date === selected);
  const todayLog = db.cycle.days.find((d) => d.date === today);
  const chosen = log ? listedSymptoms(log) : [];
  const lows = lowStash(db.cycle);
  const shareLine = buddyShareLine(db.cycle.buddyName);
  const packFor = packingTarget(db.cycle, today);
  const packed = packFor !== null && db.cycle.packedFor === packFor;
  const pinkOn = db.cycle.pinkCalendar;
  const introDue = db.cycle.buddyIntroSeen !== true && !db.cycle.buddyName;
  const report = doctorReport(db.cycle, today);
  const found = useMemo(() => searchCycleDays(db.cycle.days, query), [db.cycle.days, query]);

  const [year, month] = cursor.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const patchDays = (days: CycleState["days"]) => setCycle({ ...db.cycle, days });

  const saveNamed = async (name: string, body: string, mime: string) => {
    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({ defaultPath: name, filters: [{ name: mime === "application/pdf" ? "PDF" : "CSV", extensions: [mime === "application/pdf" ? "pdf" : "csv"] }] });
      if (!path) return;
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("write_export_file", { path, contents: body });
      return;
    }
    const url = URL.createObjectURL(new Blob([body], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleNudge = async (prop: "periodNudge" | "changeNudge", value: boolean) => {
    if (value && !(await allowNotify())) {
      setNudgeBlocked(true);
      return;
    }
    setNudgeBlocked(false);
    setCycle({ ...db.cycle, [prop]: value });
  };

  const pick = (iso: string) => {
    setSelected(iso);
    if (iso.slice(0, 7) !== cursor) setCursor(monthKey(iso));
  };

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">Journal · calendar · stash · reminders</p>
          <h1>Cycle</h1>
        </div>
      </ScreenToolbar>
      <div className="split">
        <div className="workcol">
        {introDue ? (
          <div className="card">
            <div className="row">
              <p style={{ margin: 0, flex: 1 }}>Cycle works on its own. A buddy is only a name for reminders.</p>
            </div>
            <div className="field inline">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
            </div>
            <input value={introNote} onChange={(e) => setIntroNote(e.target.value)} />
            <div className="row small muted">You can change this note later on the calendar card.</div>
            <div className="add-row">
              <button onClick={() => setCycle(skipBuddyIntro(db.cycle))}>Skip</button>
              <button className="primary" onClick={() => setCycle(saveBuddyIntro(db.cycle, name.trim(), emoji, introNote.trim()))}>
                Save
              </button>
            </div>
          </div>
        ) : null}

        <div className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>Calendar</h2>
            {shareLine ? (
              <button
                className="small-btn"
                onClick={async () => {
                  if (typeof navigator.share === "function") {
                    try {
                      await navigator.share({ text: shareLine });
                      return;
                    } catch {
                      /* fall through to the clipboard */
                    }
                  }
                  try {
                    await navigator.clipboard.writeText(shareLine);
                    toast({ kind: "ok", title: "Buddy line copied", sub: fmtDate(today) });
                  } catch {
                    toast({ kind: "err", title: "The clipboard refused", sub: "Share is unavailable" });
                  }
                }}
              >
                Copy buddy line
              </button>
            ) : null}
          </div>

          <button
            className="chip"
            onClick={() => {
              setName(db.cycle.buddyName);
              setEmoji(db.cycle.buddyEmoji);
              setIntroNote(db.cycle.buddyNote || SAMPLE_BUDDY_NOTE);
              setBuddyOpen((p) => !p);
            }}
          >
            {db.cycle.buddyEmoji ? `${db.cycle.buddyEmoji} ${db.cycle.buddyName}` : "Name a buddy"}
          </button>
          {db.cycle.buddyNote ? <p className="muted small" style={{ margin: "6px 0 0" }}>{db.cycle.buddyNote}</p> : null}
          {rematchLine(db.cycle) ? <p className="muted small" style={{ margin: "4px 0 0" }}>{rematchLine(db.cycle)}</p> : null}
          {changeOvertimeLine(db.cycle) ? <p className="small" style={{ margin: "4px 0 0" }}>{changeOvertimeLine(db.cycle)}</p> : null}

          {next ? (
            <>
              <div className="two-stack" style={{ gap: 4, marginTop: 12 }}>
                <span style={{ fontWeight: 700 }}>{next.line}</span>
                <span className="muted">{estimateLine(next)}</span>
                {typical ? <span className="muted small">{typical.line}</span> : null}
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>Log a period to see a guess.</p>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <span>Month</span>
            <span className="pager" role="group" aria-label="Month">
              <button onClick={() => shift(-1)} aria-label="Previous month" data-testid="cycle-prev-month">
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
              <span className="pager-title">{monthLabel(cursor) ?? cursor}</span>
              <button onClick={() => shift(1)} aria-label="Next month" data-testid="cycle-next-month">
                <ChevronRight size={15} strokeWidth={2} />
              </button>
            </span>
          </div>
          <div className="weeklet">
            {WEEK.map((label) => (
              <span key={label} className="row small muted" style={{ justifyContent: "center", display: "flex" }}>
                {label}
              </span>
            ))}
          </div>
          <div className="cal">
            {cells.map((day, index) => {
              if (!day) return <span key={`e${index}`} />;
              const iso = `${cursor}-${String(day).padStart(2, "0")}`;
              const dayLog = db.cycle.days.find((d) => d.date === iso);
              const flow = dayLog?.bleeding === "flow";
              const spotting = dayLog?.bleeding === "spotting";
              const inWindow = !flow && dayInWindow(iso, next);
              return (
                <button
                  key={iso}
                  className={`cal-day${flow ? " flow" : ""}${inWindow ? " window" : ""}${spotting ? " spot" : ""}${iso === selected ? " sel" : ""}${iso === today ? " now" : ""}`}
                  title={iso === selected ? fmtDate(iso) : undefined}
                  onClick={() => pick(iso)}
                >
                  <span className="mono">{day}</span>
                  {spotting ? <i /> : null}
                </button>
              );
            })}
          </div>

          {packFor ? (
            <div className="row" style={{ marginTop: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={packed} onChange={() => setCycle(togglePacked(db.cycle, packFor))} />
                <span>Pack a spare ({fmtDate(packFor)})</span>
              </label>
            </div>
          ) : null}

          <div className="row small muted" style={{ marginTop: 12 }}>Selected day · {fmtDate(selected)}</div>
          <div className="add-row">
            <button className={log?.bleeding === "spotting" ? "chip on" : "chip"} onClick={() => patchDays(setBleeding(db.cycle.days, selected, log?.bleeding === "spotting" ? "none" : "spotting"))}>
              Spotting
            </button>
            <button className={log?.bleeding === "flow" ? "chip on" : "chip"} onClick={() => patchDays(setBleeding(db.cycle.days, selected, log?.bleeding === "flow" ? "none" : "flow"))}>
              Flow
            </button>
            {log?.ended ? <span className="chip on">Marked as the end</span> : null}
            <button className="chip" onClick={() => patchDays(clearDay(db.cycle.days, selected))}>Clear day</button>
          </div>
          {log?.bleeding === "flow" ? (
            <div className="add-row">
              {FLOWS.map((item) => (
                <button key={item.id} className={log.flow === item.id ? "chip on" : "chip"} onClick={() => patchDays(setFlowLevel(db.cycle.days, selected, log.flow === item.id ? null : item.id))}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="add-row" style={{ marginTop: 6 }}>
            {SYMPTOMS.map((item) => (
              <button key={item.id} className={chosen.includes(item.id) ? "chip on" : "chip"} onClick={() => patchDays(toggleSymptom(db.cycle.days, selected, item.id))}>
                {item.label}
              </button>
            ))}
            {db.cycle.customSymptoms.map((symptom) => (
              <button key={symptom} className={chosen.includes(symptom) ? "chip on" : "chip"} onClick={() => patchDays(toggleSymptom(db.cycle.days, selected, symptom))}>
                {symptom}
              </button>
            ))}
          </div>
          <div className="add-row">
            <input className="filter" style={{ width: 200 }} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a symptom" />
            <button
              onClick={() => {
                const trimmed = custom.trim();
                if (!trimmed) return;
                const added = addCustomSymptom(db.cycle, trimmed);
                if (added === db.cycle) return;
                setCycle({ ...added, days: toggleSymptom(added.days, selected, added.customSymptoms.at(-1) ?? trimmed) });
                setCustom("");
              }}
            >
              Add symptom
            </button>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className={todayLog?.bleeding === "flow" && !todayLog.ended ? "primary" : ""} onClick={() => patchDays(markStart(db.cycle.days, today))}>
              Started today
            </button>
            <button onClick={() => {
              const ended = markEnd(db.cycle.days, today);
              if (ended === db.cycle.days) return;
              patchDays(ended);
            }}>Ended today</button>
          </div>

          <div className="two-stack" style={{ gap: 8, marginTop: 14 }}>
            <div className="field inline">
              <span>Past period start</span>
              <input className="mono" value={pastStart} onChange={(e) => setPastStart(e.target.value)} placeholder="2026-03-01" />
            </div>
            <div className="field inline">
              <span>Past period end</span>
              <input className="mono" value={pastEnd} onChange={(e) => setPastEnd(e.target.value)} placeholder="2026-03-03" />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              onClick={() => {
                const days = rememberPeriod(db.cycle.days, pastStart, pastEnd);
                if (days === db.cycle.days) return;
                patchDays(days);
              }}
            >
              Remember these dates
            </button>
          </div>

          {buddyOpen ? (
            <div style={{ marginTop: 12 }}>
              <div className="field inline">
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mango" />
              </div>
              <div className="muted small">This stays in the app. A reminder only says the name.</div>
              <div className="add-row">
                {BUDDY_EMOJIS.map((item) => (
                  <button key={item} className={item === emoji ? "chip on" : "chip"} onClick={() => setEmoji(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <input value={introNote} onChange={(e) => setIntroNote(e.target.value)} />
              <p className="muted small">The reminder, if you turn one on, says “{buddyTitle(name.trim()) || "Name needs attention"}”. No date and no detail.</p>
              <div className="row">
                <button
                  className="primary"
                  onClick={() => {
                    setCycle(setBuddy(db.cycle, name.trim(), emoji));
                    setBuddyOpen(false);
                  }}
                >
                  Save
                </button>
                <button onClick={() => setBuddyOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="workcol">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Change timer</h2>
          <p className="muted small">{timerCopy(db.cycle.changeKind)}</p>
          <div className="add-row">
            {PRODUCTS.map((item) => (
              <button key={item.id} className={db.cycle.changeKind === item.id ? "chip on" : "chip"} onClick={() => setCycle(setChangeKind(db.cycle, item.id))}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="row">
            <div className="grow">
              <div>Replace every</div>
              <div className="muted small">The reminder fires when the timer ends.</div>
            </div>
            <Stepper
              value={db.cycle.changeHours}
              min={1}
              onChange={(n) => setCycle(setChangeHours(db.cycle, n))}
              suffix="h"
              testid="cycle-change-hours"
              label=""
            />
          </div>
          {db.cycle.changeEndsAt ? <p>Ends {clock(db.cycle.changeEndsAt, db.settings.timeFormat)}</p> : null}
          {rematchLine(db.cycle) ? <p className="muted small">{rematchLine(db.cycle)}</p> : null}
          {changeOvertimeLine(db.cycle) ? <p className="small">{changeOvertimeLine(db.cycle)}</p> : null}
          <button onClick={() => setCycle(db.cycle.changeEndsAt ? stopChangeTimer(db.cycle) : startChangeTimer(db.cycle, new Date()))}>
            {db.cycle.changeEndsAt ? "Stop timer" : "Start timer"}
          </button>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Stash</h2>
          <div className="stash-rows">
            {db.cycle.stash.map((item) => (
              <div key={item.kind} className="stash-row">
                <div className="who">
                  <div className="name">{PRODUCTS.find((p) => p.id === item.kind)?.label}</div>
                  <button
                    className="stash-low"
                    title="The count under which the count tints warm — click to change"
                    onClick={() => setCycle(setStashLow(db.cycle, item.kind, item.lowAt >= 9 ? 0 : item.lowAt + 1))}
                    data-testid={`stash-low-${item.kind}`}
                  >
                    Low from {item.lowAt}
                  </button>
                </div>
                <Stepper
                  label="Home"
                  value={item.count}
                  onChange={(n) => setCycle(setStashCount(db.cycle, item.kind, n))}
                  warnBelow={item.lowAt}
                  testid={`stash-home-${item.kind}`}
                />
                <Stepper
                  label="Bag"
                  value={item.carry}
                  onChange={(n) => setCycle(setStashCarry(db.cycle, item.kind, n))}
                  testid={`stash-bag-${item.kind}`}
                />
                <Stepper
                  label="Pack"
                  value={item.pack}
                  onChange={(n) => setCycle(setStashPack(db.cycle, item.kind, n))}
                  testid={`stash-pack-${item.kind}`}
                />
                <button
                  className="stash-restock"
                  title={`Full pack of ${PRODUCTS.find((p) => p.id === item.kind)?.label ?? item.kind} — buy fresh, count resets`}
                  aria-label={`Restock ${PRODUCTS.find((p) => p.id === item.kind)?.label ?? item.kind}`}
                  onClick={() => setCycle(restockPack(db.cycle, item.kind))}
                  data-testid={`stash-restock-${item.kind}`}
                >
                  <RefreshCcw size={15} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
          <p className="stash-legend">
            <span className="dot" aria-hidden="true"></span>
            Home counts at or under the low mark tint warm. The low mark cycles out of the row's own label.
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Your logs</h2>
          <input className="filter" style={{ width: "100%" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Heavy, cramps…" />
          {found.slice(0, 12).map((day) => (
            <button key={day.id} className="row" style={{ background: "none", border: 0, margin: 0, cursor: "pointer", textAlign: "left", padding: "8px 0", borderBottom: "1px solid var(--line)", display: "block", width: "100%" }} onClick={() => pick(day.date)}>
              <span>{fmtDate(day.date)}</span>
              <br />
              <span className="muted small">{[day.bleeding, day.flow, ...listedSymptoms(day).map(symptomLabel)].filter(Boolean).join(" · ") || "Noted"}</span>
            </button>
          ))}
          {query && found.length === 0 ? <p className="muted small">Nothing in your logs.</p> : null}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>What some people notice</h2>
          {next ? (
            <>
              <p>{estimateLine(next)}</p>
              <p>{forecastDetail(next)}</p>
              {next.paused ? null : <p>{ovulationLine(next)}</p>}
            </>
          ) : (
            <p className="muted small">Log a period to see a guess.</p>
          )}
          <div className="two-stack">
            {PHASES.map((item) => (
              <div key={item.id} className={item.id === phase ? "resultbox" : undefined}>
                <span className="resultcap">{item.title}{item.id === phase ? " · guess" : ""}</span>
                <div className="muted small">{item.line}</div>
              </div>
            ))}
          </div>
          <p className="small" style={{ marginTop: 10 }}>{DOCTOR_NOTE}</p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Buying and care</h2>
          <p className="small">{HYGIENE_NOTES.map((line) => <span key={line}>{line}<br /></span>)}</p>
          {showAbsorbency(db.cycle) ? (
            <div className="resultbox">
              <span>{ABSORBENCY_NOTE}</span>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="small-btn" onClick={() => setCycle(dismissAbsorbency(db.cycle))}>Leave it as it is</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Reminders</h2>
          {nudgeBlocked ? <p className="small" style={{ color: "var(--error)" }}>Notifications are off</p> : null}
          <div className="row">
            <div className="grow">
              <div>Period reminder</div>
              <div className="muted small">One line, the day the guess window opens.</div>
            </div>
            <Bools value={db.cycle.periodNudge} onChange={(v) => toggleNudge("periodNudge", v)} />
          </div>
          <div className="row">
            <div className="grow">
              <div>Change reminder</div>
              <div className="muted small">Fires when the timer ends. Same line.</div>
            </div>
            <Bools value={db.cycle.changeNudge} onChange={(v) => toggleNudge("changeNudge", v)} />
          </div>
          <div className="row">
            <div className="grow">
              <div>Pause guesses</div>
              <div className="muted small">A gap longer than 90 days is already left out.</div>
            </div>
            <Bools value={db.cycle.paused} onChange={(v) => setCycle({ ...db.cycle, paused: v })} />
          </div>
          <div className="row">
            <div className="grow">
              <div>Pink calendar</div>
              <div className="muted small">A soft pink tint on this calendar and on cycle reminders.</div>
            </div>
            <Bools value={db.cycle.pinkCalendar} onChange={(v) => setCycle({ ...db.cycle, pinkCalendar: v })} />
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Doctor report</h2>
          <div className="add-row">
            <button className={db.cycle.reportName === "private" ? "chip on" : "chip"} onClick={() => setCycle({ ...db.cycle, reportName: "private" })}>
              Initials
            </button>
            <button className={db.cycle.reportName === "normal" ? "chip on" : "chip"} onClick={() => setCycle({ ...db.cycle, reportName: "normal" })}>
              Full name
            </button>
          </div>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>{report}</p>
          <div className="row">
            <button onClick={() => void saveNamed(`nucleus-visit-${today}.pdf`, textPdf(doctorParagraphs(db.cycle, today)), "application/pdf")}>Save PDF</button>
            {db.cycle.customSymptoms.map((symptom) => (
              <button key={symptom} className="small-btn" onClick={() => setCycle(removeCustomSymptom(db.cycle, symptom))}>
                Remove {symptom}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row">
            <button onClick={() => void saveNamed(`nucleus-private-${today}.csv`, cycleCsv(db.cycle.days), "text/csv")}>Save a private file</button>
            {shareLine ? <div className="muted small grow">{shareLine}</div> : <div className="muted small grow">Name a buddy on the calendar before sharing.</div>}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Select } from "../components/Select";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${h}:00` }));
import { ScreenToolbar } from "../components/ScreenToolbar";
import { useStore } from "../store";
import type { Rule, RuleAction, RuleTriggerKind } from "@core/types";
import { dryRun, evaluateRule, markFired, reminders, ruleSentence, TRIGGERS, triggerMeta } from "@core/rules";
import { num, todayISO } from "@core/format";
import { notificationsSupported, permissionState, requestPermission, scheduledCount, syncReminders } from "../platform/notify";

const newRule = (): Rule => ({
  id: `rule-${todayISO()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  trigger: { kind: "renewal", value: 3 },
  actions: ["attention"],
  enabled: true,
  createdAt: new Date().toISOString(),
});

const NO_PERM: { granted: boolean; canAskAgain: boolean; undetermined: boolean } = { granted: false, canAskAgain: false, undetermined: false };

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="seg">
      <button className={value ? "" : "on"} onClick={() => onChange(false)}>
        Off
      </button>
      <button className={value ? "on" : ""} onClick={() => onChange(true)}>
        On
      </button>
    </span>
  );
}

/**
 * Rules on desktop: the phone's rule editor over the same core engine —
 * when…/then… with a live sentence and a dry run. Reminders use the
 * webview's notifications while the app is open.
 */
export function Rules() {
  const { db, update } = useStore();
  const [edit, setEdit] = useState<Rule | null>(null);
  const [perm, setPerm] = useState(NO_PERM);
  const [scheduled, setScheduled] = useState(0);
  const fresh = useMemoRuleKey(db);

  // Quiet hours live with the rule engine (rules.ts shifts alarm times out of them).
  const quiet = db.settings.quietHours;
  const setQuietHours = (next: Partial<typeof quiet>) =>
    update((d) => ({ ...d, settings: { ...d.settings, quietHours: { ...d.settings.quietHours, ...next } } }));

  const applyReminders = async () => {
    const list = reminders(db);
    const keys = await syncReminders(list);
    const once = list.filter((r) => r.once && keys.includes(r.key)).map((r) => r.key);
    if (once.length) update((d) => markFired(d, once));
    setScheduled(await scheduledCount());
  };

  useEffect(() => {
    void applyReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh]);

  useEffect(() => {
    void permissionState().then((p) => {
      setPerm(p);
      setScheduled(0);
      void scheduledCount().then(setScheduled);
    });
  }, []);

  const wantsReminders = db.rules.some((r) => r.enabled && r.actions.includes("notify"));

  const grant = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p.granted) await applyReminders();
  };

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">Auto-actions on every save</p>
          <h1>Rules</h1>
        </div>
      </ScreenToolbar>
      <div className="workcol">
        <div className="card">
          <div className="row">
            <h2 style={{ margin: 0, flex: 1 }}>Rules</h2>
            <button className="primary" onClick={() => setEdit(newRule())}>
              New rule
            </button>
          </div>

          {db.rules.length === 0 ? (
            <p className="muted">
              A rule is one sentence: when something is about to happen, Nucleus shows it in Attention or reminds you. All of it is evaluated on this computer.
            </p>
          ) : null}

          {db.rules.map((r) => {
            const meta = triggerMeta(r.trigger.kind);
            const hits = evaluateRule(db, r);
            return (
              <div key={r.id} className="row" style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                <div className="grow">
                  <div>
                    <b>{r.name || meta.label}</b>
                  </div>
                  <div className="muted small">{hits.length ? `Matching now · ${hits.length}` : "Nothing matching right now"}</div>
                </div>
                <Toggle value={r.enabled} onChange={(v) => update((d) => ({ ...d, rules: d.rules.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)) }))} />
              </div>
            );
          })}

          {db.rules.map((r) => (
            <div key={`row-${r.id}`} className="row" style={{ padding: "2px 0 10px" }}>
              <div className="grow">
                <div className="small">{ruleSentence(r)}</div>
                {evaluateRule(db, r)
                  .slice(0, 3)
                  .map((h) => (
                    <div key={h.key} className="muted small">
                      · {h.title}
                    </div>
                  ))}
              </div>
              <button className="small-btn" onClick={() => setEdit(r)}>
                Edit
              </button>
              <button
                className="small-btn"
                onClick={() => {
                  update((d) => ({ ...d, rules: d.rules.filter((x) => x.id !== r.id) }));
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="workcol">
        {wantsReminders ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Reminders</h2>
            {perm.granted ? (
              <>
                <p className="muted small">
                  {scheduled} reminder{scheduled === 1 ? "" : "s"} are ready. They fire while this app is open — the phone keeps its own schedules.
                </p>
                <button onClick={() => void applyReminders()}>Re-sync reminders</button>
              </>
            ) : perm.canAskAgain || perm.undetermined ? (
              <>
                <p className="muted small">Nucleus needs permission to post reminders. Dated rules fire at 9 am on the day.</p>
                <button className="primary" onClick={() => void grant()}>
                  Allow reminders
                </button>
              </>
            ) : (
              <p className="muted small">Notifications are turned off for this browser or webview. dated rules still show in Attention.</p>
            )}
          </div>
        ) : null}

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Quiet hours</h2>
          <div className="row">
            <div className="grow">
              <div>Move alarms out of quiet hours</div>
              <div className="muted small">A reminder that lands inside them is shifted to the end.</div>
            </div>
            <Toggle value={quiet.enabled} onChange={(v) => setQuietHours({ enabled: v })} />
          </div>
          <div className="row">
            <span>From</span>
            <span className="add-row-field" style={{ width: 92 }}>
              <Select value={String(quiet.from)} onChange={(h) => setQuietHours({ from: Number(h) })} ariaLabel="Quiet from" options={HOURS} />
            </span>
            <span>to</span>
            <span className="add-row-field" style={{ width: 92 }}>
              <Select value={String(quiet.to)} onChange={(h) => setQuietHours({ to: Number(h) })} ariaLabel="Quiet to" options={HOURS} />
            </span>
          </div>
        </div>
      </div>

      {edit ? <RuleSheet rule={edit} onClose={() => setEdit(null)} onSaved={() => void applyReminders()} /> : null}
    </>
  );
}

function RuleSheet({ rule, onClose, onSaved }: { rule: Rule; onClose: () => void; onSaved: () => void }) {
  const { db, update } = useStore();
  const [kind, setKind] = useState<RuleTriggerKind>(rule.trigger.kind);
  const [value, setValue] = useState(String(rule.trigger.value));
  const [name, setName] = useState(rule.name);
  const [actions, setActions] = useState<RuleAction[]>(rule.actions);
  const meta = triggerMeta(kind);
  const v = Number(value) || meta.options[0];
  const draft: Rule = { ...rule, name: name.trim() || meta.label, trigger: { kind, value: v }, actions };
  const run = dryRun(db, draft);
  const exists = db.rules.some((r) => r.id === rule.id);
  const moduleOff = !db.settings.modules.find((m) => m.id === meta.module)?.enabled;
  const toggle = (a: RuleAction) => setActions((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  return (
    <div className="pal-overlay" onClick={onClose}>
      <div className="card wide-card" style={{ maxWidth: 640, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0, flex: 1 }}>{exists ? "Edit rule" : "New rule"}</h2>
          <button className="small-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="row small muted">When…</div>
        <div className="add-row">
          {TRIGGERS.map((t) => (
            <button
              key={t.kind}
              className={kind === t.kind ? "chip on" : "chip"}
              onClick={() => {
                setKind(t.kind);
                setValue(String(t.options[Math.floor(t.options.length / 2)]));
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="row small muted">{meta.unit === "%" ? "Threshold" : meta.unit === "amount" ? "Amount" : `How many ${meta.unit}`}</div>
        <div className="add-row">
          {meta.options.map((o) => (
            <button key={o} className={v === o ? "chip on" : "chip"} onClick={() => setValue(String(o))}>
              {meta.unit === "%" ? `${o}%` : num(o, 0)}
            </button>
          ))}
          <input className="filter mono" style={{ width: 110 }} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>

        <div className="row small muted">Then…</div>
        <div className="add-row">
          <button className={actions.includes("attention") ? "chip on" : "chip"} onClick={() => toggle("attention")}>
            Show in Attention
          </button>
          <button className={actions.includes("notify") ? "chip on" : "chip"} onClick={() => toggle("notify")}>
            Remind me
          </button>
        </div>

        <div className="field inline" style={{ marginTop: 10 }}>
          <span>Name this rule</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={meta.label} />
        </div>

        <div className="resultbox" style={{ marginTop: 10 }}>
          <span className="resultcap">Your rule</span>
          <div>{ruleSentence(draft)}</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Dry run: this would have fired about {run.count} time{run.count === 1 ? "" : "s"} in the {run.window}.
          </div>
        </div>

        {moduleOff ? <p className="small" style={{ color: "var(--warn)" }}>The {meta.module} module is switched off, so this rule will stay quiet until you turn it back on.</p> : null}
        {actions.includes("notify") ? <p className="muted small">Reminders fire while this app is open; the phone keeps its own OS schedules.</p> : null}

        {exists ? (
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="small-btn"
              onClick={() => {
                update((d) => ({ ...d, rules: [...d.rules, { ...draft, id: `rule-${todayISO()}-${Math.random().toString(36).slice(2, 8)}`, name: `${draft.name} copy`, createdAt: new Date().toISOString() }] }));
                onClose();
              }}
            >
              Duplicate this rule
            </button>
          </div>
        ) : null}

        <div className="add-row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={!actions.length} onClick={() => {
            update((d) => ({ ...d, rules: exists ? d.rules.map((r) => (r.id === draft.id ? draft : r)) : [...d.rules, draft] }));
            onClose();
            onSaved();
          }}>
            {exists ? "Save rule" : "Create rule"}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Re-run the sync pass when the rule inputs change (rule ids, triggers, settings). */
function useMemoRuleKey(db: Parameters<typeof reminders>[0]): string {
  return JSON.stringify([
    db.rules.map((r) => [r.id, r.name, r.enabled, r.trigger.kind, r.trigger.value, r.actions.join(",")]),
    db.settings.remindersEnabled,
    db.settings.quietHours,
    Object.keys(db.ruleFires).length,
    !notificationsSupported,
  ]);
}

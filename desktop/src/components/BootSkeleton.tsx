/**
 * First-paint skeleton (§8). The bones are rebuilt from the layout they stand
 * in for — a Money-list row's geometry (40px icon square, 62%/38% text
 * lanes) — so the swap to real content shifts nothing inside the frame. The
 * sweep is the digest's 1.8s breath on cubic-bezier(.65,0,.35,1) holding at
 * 60%/100% (40% dwell, never a metronome blink), ≈7% ink over --panel-2
 * because white would glare on warm paper. Rows stagger .15/.2/.35s,
 * top-heavier reads first. The region is aria-busy with role="status".
 * `html[data-hidden]` pauses the sweep (same convention as toasts/undo);
 * reduced motion shows static bones that still read as "loading".
 *
 * The demo's 1.4s simulated gap is deliberately not ported — this mounts on
 * the real `!ready` gate and leaves the moment the document resolves.
 */

const ROW_DELAYS_MS = [0, 150, 200, 350, 350, 350];

export function BootSkeleton() {
  return (
    <div className="boot">
      <section
        className="boot-frame"
        aria-busy="true"
        aria-label="Opening your document"
        data-testid="boot-skeleton"
      >
        <p className="sr-only" role="status" aria-live="polite">
          Opening your document…
        </p>
        {ROW_DELAYS_MS.map((delay, i) => (
          <div className="sk-row" key={i} style={{ "--skd": `${delay}ms` } as React.CSSProperties}>
            <span className="sk-bone sk-ic" />
            <span className="sk-bone sk-lane ls" />
            <span className="sk-bone sk-lane ss" />
          </div>
        ))}
      </section>
    </div>
  );
}

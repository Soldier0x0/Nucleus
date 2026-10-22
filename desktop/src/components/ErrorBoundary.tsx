import { Component, type ReactNode } from "react";

/**
 * Stops one broken screen from taking the whole window down (a render error
 * used to blank the app, as the Tools grid did). The boundary is mounted once
 * around the whole app and again around the screen column with a per-section
 * key, so a crash shows a recoverable card — sidebar stays alive, the document
 * is untouched by definition, and "Try again" remounts the screen fresh.
 */
type Props = { children: ReactNode; screenLabel: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown) {
    console.error(`[nucleus] ${this.props.screenLabel} crashed:`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card" style={{ marginTop: 16 }} data-testid="screen-error">
        <h2>“{this.props.screenLabel}” hit a snag</h2>
        <p className="muted">
          Nothing was lost — the document is untouched. The screen just failed to draw.
        </p>
        <p className="mono small" style={{ wordBreak: "break-all" }}>
          {this.state.error.message}
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="small-btn" onClick={() => this.setState({ error: null })} data-testid="screen-error-try-again">
            Try again
          </button>
          <button className="small-btn" onClick={() => window.location.reload()}>
            Reload Nucleus
          </button>
        </div>
      </section>
    );
  }
}

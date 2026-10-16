/**
 * LAN HTTP transport for the sync screens (desktop plan D2).
 *
 * One short request per call, aimed at `http://host:port` on the local
 * network, with every failure turned into a `SyncError` the UI can show in
 * plain words. The Rust server on the desktop reads one request per
 * connection and answers within five seconds (or says it is locked), so the
 * phone gives up shortly after that.
 */
import { SyncError } from "./syncClient";

export type HttpReply = { status: number; body: string };

export const SYNC_TIMEOUT_MS = 6000;

export async function syncFetch(host: string, port: number, path: string, init: RequestInit = {}, timeoutMs: number = SYNC_TIMEOUT_MS): Promise<HttpReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    const reply = await fetch(`http://${host}:${port}${path}`, { ...init, signal: controller.signal });
    return { status: reply.status, body: await reply.text() };
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError(err instanceof Error && err.name === "AbortError" ? "timeout" : "unreachable");
  } finally {
    clearTimeout(timer);
  }
}

export function postSyncJson(host: string, port: number, path: string, body: string, timeoutMs: number = SYNC_TIMEOUT_MS): Promise<HttpReply> {
  return syncFetch(host, port, path, { method: "POST", headers: { "Content-Type": "application/json" }, body }, timeoutMs);
}

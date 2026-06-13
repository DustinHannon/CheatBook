// ─── Custom Yjs provider over Supabase Realtime broadcast + awareness ───
// Transport for collaborative editing without a dedicated websocket server:
//   • doc updates fan out over a per-note broadcast channel
//   • awareness (live cursors/selections + identity) rides the same channel
//   • cold state loads from / persists to the `yjs_documents` table (CRDT log)
// Exposes `.awareness` and `.doc` so TipTap's Collaboration + CollaborationCaret
// bind to it exactly like HocuspocusProvider.
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { loadYjsState, saveYjsState } from '../api';

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type SyncStatus = 'connecting' | 'synced' | 'offline';

// Supabase Realtime drops broadcasts over ~256KB (base64 inflates ~33%); keep a
// safety margin. Oversize sync-responses are skipped — the joiner already
// cold-loaded persisted state from yjs_documents, so it isn't left empty.
const MAX_BROADCAST_B64 = 200 * 1024;

export class SupabaseYjsProvider {
  doc: Y.Doc;
  awareness: Awareness;
  noteId: string;
  synced = false;

  private supabase: SupabaseClient;
  private channel: RealtimeChannel;
  private joined = false;
  private outbox: Uint8Array[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private statusCb?: (s: SyncStatus) => void;
  private instanceId = Math.random().toString(36).slice(2);
  private destroyed = false;

  constructor(supabase: SupabaseClient, noteId: string, doc: Y.Doc, onStatus?: (s: SyncStatus) => void) {
    this.supabase = supabase;
    this.noteId = noteId;
    this.doc = doc;
    this.awareness = new Awareness(doc);
    this.statusCb = onStatus;

    this.doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', this.onUnload);

    this.channel = supabase.channel(`cb-note:${noteId}`, { config: { broadcast: { self: false, ack: false } } });
    this.connect();
  }

  private setStatus(s: SyncStatus) { this.synced = s === 'synced'; this.statusCb?.(s); }

  private async connect() {
    this.setStatus('connecting');
    this.channel
      .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
        if (this.destroyed) return;
        try { Y.applyUpdate(this.doc, fromB64(payload.u), this); } catch { /* drop corrupt update */ }
      })
      .on('broadcast', { event: 'yjs-sync-request' }, ({ payload }) => {
        if (this.destroyed) return;
        try {
          const b64 = toB64(Y.encodeStateAsUpdate(this.doc, fromB64(payload.sv)));
          if (b64.length <= MAX_BROADCAST_B64) this.send('yjs-sync-response', { u: b64, to: payload.from });
        } catch { /* ignore malformed state vector */ }
      })
      .on('broadcast', { event: 'yjs-sync-response' }, ({ payload }) => {
        if (this.destroyed) return;
        if (payload.to && payload.to !== this.instanceId) return;
        try { Y.applyUpdate(this.doc, fromB64(payload.u), this); this.setStatus('synced'); } catch { /* drop corrupt response */ }
      })
      .on('broadcast', { event: 'awareness' }, ({ payload }) => {
        if (this.destroyed) return;
        try { applyAwarenessUpdate(this.awareness, fromB64(payload.u), 'remote'); } catch { /* drop corrupt awareness */ }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.joined = true;
          // Cold-load persisted CRDT state, then reconcile with live peers.
          try {
            const persisted = await loadYjsState(this.supabase, this.noteId);
            if (persisted) Y.applyUpdate(this.doc, persisted, this);
          } catch { /* fresh doc */ }
          this.flushOutbox();
          this.send('yjs-sync-request', { sv: toB64(Y.encodeStateVector(this.doc)), from: this.instanceId });
          // Re-broadcast our awareness so peers render our cursor.
          this.broadcastAwareness([this.doc.clientID]);
          this.setStatus('synced');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.setStatus('offline');
        }
      });
  }

  private send(event: string, payload: Record<string, unknown>) {
    if (!this.joined) return;
    this.channel.send({ type: 'broadcast', event, payload });
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;               // came from a peer / cold-load — don't echo
    if (!this.joined) { this.outbox.push(update); }
    else this.channel.send({ type: 'broadcast', event: 'yjs-update', payload: { u: toB64(update) } });
    this.scheduleSave();
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === 'remote') return;
    this.broadcastAwareness([...added, ...updated, ...removed]);
  };

  private broadcastAwareness(clients: number[]) {
    if (!this.joined || !clients.length) return;
    const u = encodeAwarenessUpdate(this.awareness, clients);
    this.channel.send({ type: 'broadcast', event: 'awareness', payload: { u: toB64(u) } });
  }

  private flushOutbox() {
    for (const u of this.outbox) this.channel.send({ type: 'broadcast', event: 'yjs-update', payload: { u: toB64(u) } });
    this.outbox = [];
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 1500);
  }

  // Raw save with no destroyed-guard, so destroy()/unload can force a final flush.
  private async doSave() {
    try { await saveYjsState(this.supabase, this.noteId, Y.encodeStateAsUpdate(this.doc)); } catch { /* retried on next edit */ }
  }

  async persist() {
    if (this.destroyed) return;
    await this.doSave();
  }

  private onUnload = () => {
    // Best-effort final flush on tab close (an async write in beforeunload is
    // unreliable, but beats losing the trailing debounce window).
    void this.doSave();
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'unload');
  };

  destroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    // Authoritative final flush BEFORE marking destroyed — the debounce timer was
    // just cleared, so the trailing <=1.5s of edits would otherwise be lost.
    void this.doSave();
    this.destroyed = true;
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy');
    this.broadcastAwareness([this.doc.clientID]);
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.onUnload);
    this.supabase.removeChannel(this.channel);
    this.awareness.destroy();
  }
}

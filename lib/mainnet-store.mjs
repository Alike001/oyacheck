// Durable single-purchase mainnet pilot. No keys, signatures or rental tokens
// belong in this database. All spending reservations commit BEFORE external I/O.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, safe:true });
const cleanHash = value => /^0x[a-fA-F0-9]{64}$/.test(value || '') ? value : null;

export class MainnetStore {
  constructor(file) {
    if (!isAbsolute(file)) throw fail('storage-required', 'An absolute persistent database path is required', 503);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    chmodSync(file, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions(owner TEXT PRIMARY KEY, expires INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS purchases(
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_id TEXT NOT NULL, binding TEXT NOT NULL,
        plan TEXT NOT NULL, fingerprint TEXT NOT NULL, expires INTEGER NOT NULL,
        state TEXT NOT NULL, started INTEGER, transaction_hash TEXT, result TEXT,
        failure TEXT, settlement TEXT, UNIQUE(owner,request_id)) STRICT;
      CREATE TABLE IF NOT EXISTS attempts(
        payer TEXT PRIMARY KEY, purchase_id TEXT UNIQUE NOT NULL, owner TEXT NOT NULL,
        token TEXT NOT NULL, atomic INTEGER NOT NULL CHECK(atomic>0 AND atomic<=10000),
        day TEXT NOT NULL) STRICT;`);
  }
  close() { this.db.close(); }
  atomic(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  session(cookie) {
    const owner = digest(cookie);
    this.db.prepare('INSERT OR IGNORE INTO sessions VALUES(?,?)').run(owner, Date.now() + 86400_000);
    if (!this.db.prepare('SELECT owner FROM sessions WHERE owner=? AND expires>?').get(owner, Date.now())) throw fail('session-expired', 'Open a new local session', 403);
    return owner;
  }
  get(id, owner) {
    const row = this.db.prepare(`SELECT * FROM purchases WHERE id=? ${owner ? 'AND owner=?' : ''}`).get(...(owner ? [id, owner] : [id]));
    if (!row) throw fail('not-found', 'Purchase not found', 404);
    if (row.state === 'executing' && row.started < Date.now() - 120_000) {
      this.db.prepare("UPDATE purchases SET state='needs-review',failure='interrupted' WHERE id=? AND state='executing'").run(id);
      row.state = 'needs-review'; row.failure = 'interrupted';
    }
    if (['quoted','requested'].includes(row.state) && row.expires <= Date.now()) {
      this.db.prepare("UPDATE purchases SET state='expired' WHERE id=? AND state IN ('quoted','requested')").run(id);
      row.state = 'expired';
    }
    const current=this.db.prepare('SELECT * FROM purchases WHERE id=?').get(id);
    return { ...current, plan: JSON.parse(current.plan), result: current.result ? JSON.parse(current.result) : null };
  }
  existing(owner, requestId, binding) {
    const row = this.db.prepare('SELECT id,binding FROM purchases WHERE owner=? AND request_id=?').get(owner, requestId);
    if (!row) return null;
    if (row.binding !== binding) throw fail('idempotency-conflict', 'Request ID is already bound to another investigation');
    return this.get(row.id, owner);
  }
  create(owner, requestId, binding, plan) {
    return this.atomic(() => {
      const existing = this.existing(owner, requestId, binding);
      if (existing) return existing;
      const count = this.db.prepare('SELECT count(*) AS n FROM purchases WHERE owner=?').get(owner).n;
      if (count >= 100) throw fail('session-limit', 'This session has reached its preparation limit', 429);
      const id = randomUUID(), expires = Date.now() + 90_000;
      const fingerprint = digest(JSON.stringify({ id, owner, plan, expires }));
      this.db.prepare("INSERT INTO purchases(id,owner,request_id,binding,plan,fingerprint,expires,state) VALUES(?,?,?,?,?,?,?,'quoted')")
        .run(id, owner, requestId, binding, JSON.stringify(plan), fingerprint, expires);
      return this.get(id, owner);
    });
  }
  transition(owner, id, action, fingerprint) {
    return this.atomic(() => {
      const row = this.get(id, owner);
      if (fingerprint !== row.fingerprint) throw fail('approval-mismatch', 'The approved plan does not match the server quote', 403);
      if (action === 'request' && row.state === 'requested') return row;
      if (action === 'cancel' && row.state === 'cancelled') return row;
      if (!['quoted','requested'].includes(row.state)) throw fail('not-approvable', 'This purchase can no longer be changed');
      this.db.prepare('UPDATE purchases SET state=? WHERE id=?').run(action === 'cancel' ? 'cancelled' : 'requested', id);
      return this.get(id, owner);
    });
  }
  claim(id, fingerprint) {
    return this.atomic(() => {
      const row = this.get(id);
      if (row.fingerprint !== fingerprint || row.state !== 'requested') throw fail('operator-approval-required', 'A fresh user request and its exact operator-approved fingerprint are required', 403);
      const p = row.plan;
      if (!Number.isSafeInteger(p.atomic) || p.atomic <= 0 || p.atomic > 10000) throw fail('spend-limit', 'Price exceeds the immutable pilot ceiling');
      const day = new Date().toISOString().slice(0,10);
      const total = this.db.prepare('SELECT coalesce(sum(atomic),0) AS n FROM attempts WHERE owner=? AND day=?').get(row.owner,day).n;
      if (total + p.atomic > 10000) throw fail('spend-limit', 'Per-user daily pilot ceiling reached');
      // One irreversible reservation per payer across ALL supported tokens and
      // process restarts. Ambiguous/failed attempts never restore this allowance.
      if (this.db.prepare('SELECT payer FROM attempts WHERE payer=?').get(p.payer.toLowerCase())) throw fail('pilot-already-used', 'Payer pilot allowance is already reserved; reconcile the existing attempt');
      if (this.db.prepare("SELECT id FROM purchases WHERE state='executing'").get()) throw fail('busy', 'An operator purchase is already running');
      this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?,?)').run(p.payer.toLowerCase(),id,row.owner,p.token,p.atomic,day);
      this.db.prepare("UPDATE purchases SET state='executing',started=? WHERE id=?").run(Date.now(),id);
      return this.get(id);
    });
  }
  recordTransaction(id, transaction) {
    const tx = cleanHash(transaction);
    if (tx) this.db.prepare('UPDATE purchases SET transaction_hash=? WHERE id=?').run(tx,id);
  }
  finish(id, result, failure = null) {
    return this.atomic(()=>{
      const row=this.get(id);
      const state=result ? (row.settlement ? 'complete' : 'verification-required') : (row.settlement ? 'settled-unfulfilled' : 'needs-review');
      this.db.prepare('UPDATE purchases SET state=?,result=?,failure=? WHERE id=?')
        .run(state,result ? JSON.stringify(result) : null,failure,id);
      return this.get(id);
    });
  }
  reconcile(id, transaction, settledAtomic) {
    return this.atomic(() => {
      const row = this.get(id);
      if (!['needs-review','verification-required','settled-unfulfilled','complete'].includes(row.state)) throw fail('not-reconcilable', 'Only a completed or interrupted attempt can be reconciled');
      if (!cleanHash(transaction) || (row.transaction_hash && row.transaction_hash.toLowerCase() !== transaction.toLowerCase())) throw fail('receipt-mismatch', 'Receipt hash differs from the recorded payment');
      if (!Number.isSafeInteger(settledAtomic) || settledAtomic <= 0 || settledAtomic > row.plan.atomic) throw fail('receipt-mismatch', 'Settled cost exceeds the approved price');
      this.db.prepare('UPDATE purchases SET state=?,transaction_hash=?,settlement=? WHERE id=?')
        .run(row.result ? 'complete' : 'settled-unfulfilled',transaction,JSON.stringify({atomic:settledAtomic,verifiedAt:new Date().toISOString()}),id);
      return this.get(id);
    });
  }
}

export function publicPurchase(row) {
  const { id, plan, fingerprint, expires, state, transaction_hash, result, failure, settlement } = row;
  return { id, plan, fingerprint, expires, state, transaction:transaction_hash, result, failure,
    settlement:settlement ? JSON.parse(settlement) : null,
    explorerUrl:transaction_hash ? `https://celoscan.io/tx/${transaction_hash}` : null };
}

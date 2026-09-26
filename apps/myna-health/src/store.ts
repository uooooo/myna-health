import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Intent } from './intent.ts';

export class IntentStore {
  private db: DatabaseSync;

  constructor(path = process.env.DATA_PATH ?? './data/demo.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        nonce TEXT,
        nullifier TEXT
      );
      CREATE TABLE IF NOT EXISTS consumed_proofs (
        action TEXT NOT NULL,
        nullifier TEXT NOT NULL,
        PRIMARY KEY (action, nullifier)
      );
    `);
  }

  close() { this.db.close(); }

  create(intent: Intent): Intent {
    this.db.prepare('INSERT INTO intents (id, body, status) VALUES (?, ?, ?)')
      .run(intent.id, JSON.stringify(intent), intent.status);
    return intent;
  }

  get(id: string): Intent | null {
    const row = this.db.prepare('SELECT body, status, nonce, nullifier FROM intents WHERE id = ?').get(id) as
      | { body: string; status: Intent['status']; nonce: string | null; nullifier: string | null }
      | undefined;
    if (!row) return null;
    return { ...JSON.parse(row.body) as Intent, status: row.status, rpNonce: row.nonce ?? undefined, nullifier: row.nullifier ?? undefined };
  }

  setNonce(id: string, nonce: string): void {
    const result = this.db.prepare("UPDATE intents SET nonce = ? WHERE id = ? AND status = 'pending'").run(nonce, id);
    if (result.changes !== 1) throw new Error('Intent is not pending');
  }

  resolve(id: string, status: 'approved' | 'rejected', nullifier?: string): Intent {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const intent = this.get(id);
      if (!intent || intent.status !== 'pending') throw new Error('Intent is not pending');
      if (Date.now() / 1000 >= intent.expiresAt) throw new Error('Intent has expired');
      if (status === 'approved') {
        if (!nullifier) throw new Error('Nullifier required');
        this.db.prepare('INSERT INTO consumed_proofs (action, nullifier) VALUES (?, ?)').run(intent.action, nullifier);
      }
      this.db.prepare("UPDATE intents SET status = ?, nullifier = ? WHERE id = ? AND status = 'pending'")
        .run(status, nullifier ?? null, id);
      this.db.exec('COMMIT');
      return { ...intent, status, nullifier };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  execute(id: string): Intent {
    const result = this.db.prepare("UPDATE intents SET status = 'executed' WHERE id = ? AND status = 'approved'").run(id);
    if (result.changes !== 1) throw new Error('A verified approval is required');
    return this.get(id)!;
  }
}

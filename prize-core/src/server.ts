import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { makeIntent, assertPending, type Intent } from './intent.ts';
import { IntentStore } from './store.ts';
import { inspectEns } from './ens.ts';
import { issueRpSignature, verifyWorldProof, worldConfigFromEnv, type WorldProof } from './world.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const app = express();
const store = new IntentStore();
const port = Number(process.env.PORT || 8787);
app.use(express.json({ limit: '32kb' }));

function sendError(res: express.Response, error: unknown) {
  res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
}

app.get('/api/config', (_req, res) => {
  const world = worldConfigFromEnv();
  res.json({ worldConfigured: !!world, demoMode: process.env.DEMO_MODE === 'true', chain: 'sepolia' });
});

app.get('/api/ens', async (req, res) => {
  try {
    if (typeof req.query.name !== 'string') throw new Error('name is required');
    res.json(await inspectEns(req.query.name, typeof req.query.key === 'string' ? req.query.key : undefined));
  } catch (error) { sendError(res, error); }
});

app.post('/api/intents', (req, res) => {
  try {
    const intent = makeIntent(req.body);
    res.status(201).json(store.create(intent));
  } catch (error) { sendError(res, error); }
});

app.get('/api/intents/:id', (req, res) => {
  const intent = store.get(String(req.params.id));
  if (!intent) return res.status(404).json({ error: 'Not found' });
  res.json(intent);
});

app.post('/api/intents/:id/world-request', (req, res) => {
  try {
    const world = worldConfigFromEnv();
    if (!world) throw new Error('World credentials are not configured');
    const intent = store.get(String(req.params.id));
    if (!intent) throw new Error('Intent not found');
    const request = issueRpSignature(intent, world);
    store.setNonce(intent.id, request.rp_context.nonce);
    res.json(request);
  } catch (error) { sendError(res, error); }
});

app.post('/api/intents/:id/world-verify', async (req, res) => {
  try {
    const world = worldConfigFromEnv();
    if (!world) throw new Error('World credentials are not configured');
    const intent = store.get(String(req.params.id));
    if (!intent) throw new Error('Intent not found');
    const nullifier = await verifyWorldProof(intent, req.body as WorldProof, world);
    res.json(store.resolve(intent.id, 'approved', nullifier));
  } catch (error) { sendError(res, error); }
});

app.post('/api/intents/:id/reject', (req, res) => {
  try { res.json(store.resolve(String(req.params.id), 'rejected')); }
  catch (error) { sendError(res, error); }
});

app.post('/api/intents/:id/execute', (req, res) => {
  try { res.json(store.execute(String(req.params.id))); }
  catch (error) { sendError(res, error); }
});

// Walkthrough mode is isolated from the World verifier and cannot create a verified approval.
app.post('/api/intents/:id/demo-approve', (req, res) => {
  if (process.env.DEMO_MODE !== 'true') return res.status(404).json({ error: 'Unavailable' });
  try {
    const intent = store.get(String(req.params.id));
    if (!intent) throw new Error('Intent not found');
    assertPending(intent);
    // This endpoint only previews the UX. It deliberately leaves the intent pending.
    res.json({ preview: true, action: intent.action, message: 'Demo preview only: no World approval was recorded.' });
  } catch (error) { sendError(res, error); }
});

const dist = resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*splat', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}

app.listen(port, () => console.log(`Prize core API: http://localhost:${port}`));

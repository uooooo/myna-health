import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IDKitRequestWidget, proofOfHuman, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import './style.css';
import { parseMedicationXml, type ImportedMedicalRecord } from '../../../packages/mynaportal-adapter/src/index.ts';

type RecordSample = { patient?: string; patientName?: string; ageBand?: string; medicine?: string; medicineCode?: string; dispensedAt?: string; facility?: string; recordId?: string; [key: string]: unknown };
type DemoCase = { id: string; label: string; note?: string; record: RecordSample; policy?: Record<string, unknown>; issuerPublicKey?: unknown; holderSecret?: unknown; [key: string]: unknown };
type DemoResponse = { cases: DemoCase[] } | DemoCase[];
type Policy = { name: string; chain?: string; resolver?: string | null; recordId?: string | null; source?: string; policy?: { acceptedDrugCodes: [string,string,string,string]; minDay: number; maxDay: number; context: string }; issuerPublicKey?: { ax: string; ay: string }; [key: string]: unknown };
type ZkProof = { proof: unknown; publicSignals: string[] };
type ProofReceipt = { id: string; status?: string; proof?: unknown; publicSignals?: string[]; digest?: string; verifiedFacts?: string[]; hiddenFields?: string[]; reason?: string; error?: string };
type Verification = { valid: boolean; reason?: string; verifiedFacts?: string[]; method?: string };
type Redemption = { status: string; txHash?: string; chain?: string; reason?: string };
type Intent = { id: string; status: string; action: string; expiresAt: number };
type WorldRequest = { app_id: `app_${string}`; action: string; environment: 'staging' | 'production'; rp_context: RpContext };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}
function short(value: unknown, head = 12, tail = 8) {
  if (typeof value !== 'string' || !value) return '—';
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}
function display(value: unknown, visible: boolean) {
  if (!visible) return '••••••••';
  return value === undefined || value === null || value === '' ? '—' : String(value);
}
function normalizeCases(response: DemoResponse): DemoCase[] {
  return Array.isArray(response) ? response : response.cases ?? [];
}

async function generateBrowserProof(sample: DemoCase, named: Policy): Promise<ZkProof> {
  if (!named.policy || !named.issuerPublicKey || !sample.holderSecret) throw new Error('Policy or private witness is missing');
  const kernel = await import('../../../packages/proof-kernel/src/index.ts');
  return kernel.proveEligibility(
    sample.record as unknown as import('../../../packages/proof-kernel/src/index.ts').SignedRecord,
    named.policy, named.issuerPublicKey, String(sample.holderSecret),
    { wasm: '/proofs/eligibility.wasm', zkey: '/proofs/eligibility_final.zkey' },
  );
}

function App() {
  const [cases, setCases] = useState<DemoCase[]>([]);
  const [caseId, setCaseId] = useState('');
  const [importedRecord, setImportedRecord] = useState<ImportedMedicalRecord | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [policyName, setPolicyName] = useState('care.mynahealth.eth');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [policyState, setPolicyState] = useState<'loading' | 'live' | 'unavailable'>('loading');
  const [config, setConfig] = useState<{ worldConfigured: boolean; demoMode: boolean; chain: string } | null>(null);
  const [proof, setProof] = useState<ProofReceipt | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [worldRequest, setWorldRequest] = useState<WorldRequest | null>(null);
  const [worldOpen, setWorldOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sample = cases.find(item => item.id === caseId) ?? null;
  const source = importedRecord ? { patient: importedRecord.patientName, medicine: importedRecord.entries[0]?.drugName, medicineCode: importedRecord.entries[0]?.drugCode, dispensedAt: importedRecord.entries[0]?.dispensedAt, facility: importedRecord.entries[0]?.institutionName, recordId: 'LOCAL XML' } : sample?.record;

  useEffect(() => {
    api<DemoResponse>('/api/demo/cases').then(result => { const next = normalizeCases(result); setCases(next); setCaseId(next[0]?.id ?? ''); }).catch(cause => setError(`Demo fixtures unavailable: ${String(cause)}`));
    api<typeof config>('/api/config').then(setConfig).catch(() => setConfig(null));
    void loadPolicy('care.mynahealth.eth');
  }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  async function loadPolicy(name: string) {
    setPolicyState('loading'); setPolicy(null);
    try { const result = await api<Policy>(`/api/policy?name=${encodeURIComponent(name)}`); setPolicy(result); setPolicyState('live'); }
    catch (cause) { setPolicyState('unavailable'); setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  function selectCase(id: string) {
    setCaseId(id); setImportedRecord(null); setProof(null); setVerification(null); setRedemption(null); setIntent(null); setWorldRequest(null); setError('');
  }
  const expectedCode = policy?.policy?.acceptedDrugCodes.filter(code => code !== '0').join(' · ');
  const dateWindow = policy?.policy ? new Date(policy.policy.minDay * 86400000).toISOString().slice(0,10) + ' → ' + new Date(policy.policy.maxDay * 86400000).toISOString().slice(0,10) : undefined;
  const step = redemption?.status === 'redeemed' ? 3 : verification?.valid ? 3 : proof ? 2 : 1;
  const proofText = proof?.proof ? JSON.stringify(proof.proof) : '';

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-symbol">M</span><span><strong>MynaHealth</strong><small>Private medical proofs</small></span></div><div className="topbar-right"><span className="network"><i /> {policy?.chain?.toUpperCase() ?? 'CONNECTING'}</span><span className="topbar-divider" /><span>ETHGLOBAL TOKYO 2026</span></div></header>
    <main>
      <section className="hero"><div className="hero-kicker"><span /> PRIVATE DATA · PUBLIC PROOF</div><h1>Prove the condition.<br /><em>Keep the record.</em></h1><p>Demonstrate a treatment condition without disclosing the medical record. A named policy defines the rule; the proof is generated and checked cryptographically.</p><div className="hero-meta"><span><b>01</b> Local witness</span><span><b>02</b> ENS policy</span><span><b>03</b> Verifiable receipt</span></div></section>
      <section className="demo-bar"><div><span className="demo-label">DEMO DATASET</span><strong>Synthetic Japanese dispensing records</strong><p>Fictional identities and medication codes. Patient data remains in this browser.</p></div><label className="case-select">SCENARIO<select value={caseId} onChange={event => selectCase(event.target.value)} disabled={!cases.length}><option value="" disabled>{cases.length ? 'Select a case' : 'Loading fixtures…'}</option>{cases.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></section>
      <section className="workflow" aria-label="Proof workflow"><div className={`workflow-item ${step >= 1 ? 'active' : ''}`}><span>01</span><div>Load record<small>Private input</small></div></div><div className="workflow-rule" /><div className={`workflow-item ${step >= 2 ? 'active' : ''}`}><span>02</span><div>Generate proof<small>Browser witness → ZK</small></div></div><div className="workflow-rule" /><div className={`workflow-item ${step >= 3 ? 'active' : ''}`}><span>03</span><div>Verify &amp; redeem<small>On-chain outcome</small></div></div></section>
      <section className="panel-grid">
        <article className="panel record-panel"><div className="panel-top"><span className="panel-index">01 / SOURCE</span><span className="state-pill private">PRIVATE · BROWSER</span></div><h2>Medical record</h2><p className="panel-description">Only the required condition leaves the private source as a zero knowledge proof.</p><div className="document"><div className="document-heading"><div><small>調剤記録 · {importedRecord ? 'LOCAL XML / UNVERIFIED' : 'SYNTHETIC'}</small><strong>{display(source?.facility, showRecord)}</strong></div><span className="document-seal">架空</span></div><div className="document-rule" /><div className="record-row"><span>患者氏名</span><strong>{display(source?.patient ?? source?.patientName, showRecord)}</strong></div><div className="record-row"><span>年齢区分</span><strong>{display(source?.ageBand, showRecord)}</strong></div><div className="record-row"><span>薬剤</span><strong>{display(source?.medicine, showRecord)}</strong></div><div className="record-row"><span>薬剤コード</span><strong className="mono">{display(source?.medicineCode, showRecord)}</strong></div><div className="record-row"><span>調剤日</span><strong className="mono">{display(source?.dispensedAt, showRecord)}</strong></div><div className="document-foot"><span>RECORD {short(source?.recordId, 9, 4)}</span><span>{importedRecord ? 'NOT ATTESTED' : 'LOCAL SAMPLE'}</span></div></div><label className="xml-import">Import MyNa medication XML <input type="file" accept=".xml,text/xml,application/xml" onChange={event => { const file = event.target.files?.[0]; if (!file) return; void run(async () => { const parsed = parseMedicationXml(await file.text()); setImportedRecord(parsed); setProof(null); setVerification(null); setRedemption(null); setIntent(null); setShowRecord(true); }); event.target.value = ''; }} /></label>{importedRecord && <p className="inline-help">Parsed locally using the YZK-IF-002 layout. XML alone does not prove it came from MyNaPortal, so proof issuance is disabled for this import.</p>}<button className="text-action" onClick={() => setShowRecord(value => !value)}>{showRecord ? 'Hide private fields' : 'Reveal sample record'} <span>↗</span></button><div className="scenario-note"><span>SELECTED CASE</span><p>{sample?.note ?? 'Select a synthetic record to inspect the proving flow.'}</p></div></article>
        <article className="panel policy-panel"><div className="panel-top"><span className="panel-index">02 / RULE</span><span className={`state-pill ${policyState === 'live' ? 'connected' : ''}`}>{policyState === 'live' ? policy?.source === 'ENSv2' ? 'LIVE ENS LOOKUP' : 'DEMO POLICY' : policyState === 'loading' ? 'RESOLVING' : 'NOT RESOLVED'}</span></div><h2>ENS policy</h2><p className="panel-description">The named rule defines which signed treatment entries can be proven.</p><label className="field-label">POLICY NAME<div className="input-row"><input value={policyName} onChange={event => setPolicyName(event.target.value)} spellCheck={false} /><button onClick={() => void run(() => loadPolicy(policyName))} disabled={busy || !policyName.trim()} aria-label="Resolve ENS policy">↗</button></div></label><div className="policy-sheet"><div className="policy-sheet-head"><span>POLICY / {policy?.source === 'ENSv2' ? 'ENSV2' : 'DEMO'}</span><span>{policyState === 'live' ? 'RESOLVED' : 'AWAITING POLICY'}</span></div><div className="policy-line"><span>Resolver</span><code>{short(policy?.resolver, 10, 6)}</code></div><div className="policy-line"><span>Record ID</span><code>{short(policy?.recordId, 10, 6)}</code></div><div className="policy-line"><span>Accepted codes</span><code>{expectedCode ?? '—'}</code></div><div className="policy-line"><span>Date window</span><code>{dateWindow ?? '—'}</code></div><div className="policy-sheet-foot">SOURCE: {policy?.source?.toUpperCase() ?? 'ENSV2 API'}</div></div><button className="primary-action" disabled={busy || policyState !== 'live' || !sample || !!importedRecord} onClick={() => run(async () => { const generated = await generateBrowserProof(sample!, policy!); const result = await api<ProofReceipt>('/api/proofs', { proof: generated.proof, publicSignals: generated.publicSignals, policyName, caseId }); setProof(result); setVerification(null); setRedemption(null); setIntent(null); if (result.status === 'rejected') setError(result.reason ?? result.error ?? 'Proof rejected.'); })}>{busy ? 'Generating proof…' : 'Generate ZK proof'} <span>→</span></button>{policyState !== 'live' && <p className="inline-help">Resolve the policy to enable generation.</p>}</article>
        <article className="panel receipt-panel"><div className="panel-top"><span className="panel-index">03 / OUTPUT</span><span className={`state-pill ${verification?.valid ? 'connected' : ''}`}>{redemption?.status === 'redeemed' ? 'REDEEMED' : verification?.valid ? 'PROOF VERIFIED' : verification?.valid === false ? 'PROOF REJECTED' : 'AWAITING PROOF'}</span></div><h2>Proof receipt</h2><p className="panel-description">The receipt separates verified facts from the fields that remain private.</p><div className="receipt-sheet"><div className="receipt-header"><span className="receipt-mark">∴</span><div><small>MYNAHEALTH / RECEIPT</small><strong>{proof ? short(proof.id, 15, 5) : 'No proof generated'}</strong></div></div><div className="receipt-section"><span className="receipt-label">VERIFIED FACTS</span><div className="fact-list">{verification?.valid ? (verification.verifiedFacts?.length ? verification.verifiedFacts.map((fact, index) => <p key={index}><i />{fact}</p>) : <p><i />Policy condition satisfied</p>) : <p className="muted">Awaiting cryptographic verification</p>}</div></div><div className="receipt-section"><span className="receipt-label">HIDDEN FIELDS</span><p className="hidden-fields">{proof?.hiddenFields?.join(' · ') ?? 'Patient name · exact record · source document'}</p></div><div className="receipt-section"><span className="receipt-label">PROOF BYTES</span><code className="proof-bytes">{proof ? short(proofText, 24, 18) : '—'}</code></div><div className="receipt-section no-border"><span className="receipt-label">ON-CHAIN TX</span><code className="proof-bytes">{redemption?.txHash ? short(redemption.txHash, 17, 12) : '—'}</code></div></div><button className="primary-action verify-action" disabled={busy || !proof} onClick={() => run(async () => { const result = await api<Verification>(`/api/proofs/${proof!.id}/verify`, {}); setVerification(result); if (!result.valid) setError(result.reason ?? 'Proof rejected.'); })}>{busy ? 'Checking…' : caseId.includes('replay') && verification ? 'Verify again · replay test' : 'Verify proof'} <span>→</span></button>{verification?.valid && <button className="secondary-action" disabled={busy || !config?.worldConfigured} onClick={() => run(async () => { const created = await api<Intent>('/api/proofs/' + proof!.id + '/world-intent', {}); setIntent(created); const request = await api<WorldRequest>(`/api/intents/${created.id}/world-request`, {}); setWorldRequest(request); setWorldOpen(true); })}>Confirm person with World ID <span>↗</span></button>}{verification?.valid && !config?.worldConfigured && <p className="inline-help">World ID is not configured. Redemption remains unavailable.</p>}{intent?.status === 'approved' && <button className="primary-action" disabled={busy || !config?.chain || config.chain === 'demo'} onClick={() => run(async () => { const result = await api<Redemption>(`/api/proofs/${proof!.id}/redeem`, { intentId: intent.id }); setRedemption(result); if (result.status !== 'redeemed') setError(result.reason ?? `Redemption status: ${result.status}`); })}>Redeem verified proof <span>→</span></button>}{intent?.status === 'approved' && config?.chain === 'demo' && <p className="inline-help">On-chain redemption requires a deployed ENS policy gate.</p>}{worldRequest && intent && <IDKitRequestWidget open={worldOpen} onOpenChange={setWorldOpen} app_id={worldRequest.app_id} action={worldRequest.action} action_description="Redeem medical proof" rp_context={worldRequest.rp_context} environment={worldRequest.environment} allow_legacy_proofs={false} preset={proofOfHuman({ signal: proof!.digest })} handleVerify={async (worldProof: IDKitResult) => { await api(`/api/intents/${intent.id}/world-verify`, worldProof); }} onSuccess={() => { setWorldOpen(false); void api<Intent>(`/api/intents/${intent.id}`).then(setIntent).catch(cause => setError(String(cause))); }} onError={cause => setError(String(cause))} />}</article>
      </section>
      {error && <div className="error-bar" role="alert"><span>REQUEST DID NOT COMPLETE</span><p>{error}</p><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    </main>
    <footer><span>MYNAHEALTH / ETHGLOBAL TOKYO 2026</span><span>DEMO PROOFS USE SYNTHETIC RECORDS · XML IMPORT STAYS LOCAL</span><span>ENSV2 + ZERO KNOWLEDGE + WORLD ID</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);

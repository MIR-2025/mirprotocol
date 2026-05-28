import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Protocol docs directory
const PROTOCOL_DIR = path.join(__dirname, 'protocol');

// Spec document metadata — single source of truth for slug, title, file, and short description.
const SPEC_DOCS = [
  { slug: '01-overview', num: '01', title: 'Overview', file: '01-overview.md', desc: 'Architecture, properties, scope' },
  { slug: '02-terminology', num: '02', title: 'Terminology', file: '02-terminology.md', desc: 'Defined terms' },
  { slug: '03-claim-format', num: '03', title: 'Claim Format', file: '03-claim-format.md', desc: 'Claim structure, fields, types, encoding' },
  { slug: '04-signature-model', num: '04', title: 'Signature Model', file: '04-signature-model.md', desc: 'Canonical serialization, Ed25519, number handling' },
  { slug: '05-domain-key-discovery', num: '05', title: 'Domain Key Discovery', file: '05-domain-key-discovery.md', desc: 'DNS TXT, .well-known/mir.json, key lifecycle' },
  { slug: '06-verification-process', num: '06', title: 'Verification Process', file: '06-verification-process.md', desc: 'Deterministic verification algorithm, error codes' },
  { slug: '07-registry-role', num: '07', title: 'Registry Role', file: '07-registry-role.md', desc: 'What registries do and do not provide' },
  { slug: '08-security-considerations', num: '08', title: 'Security Considerations', file: '08-security-considerations.md', desc: 'Cryptographic and operational security' },
  { slug: '09-threat-model', num: '09', title: 'Threat Model', file: '09-threat-model.md', desc: 'Attack surface and mitigations' },
  { slug: '10-non-goals', num: '10', title: 'Non-Goals', file: '10-non-goals.md', desc: 'Explicit exclusions' },
  { slug: '11-conformance', num: '11', title: 'Conformance', file: '11-conformance.md', desc: 'MUST/SHOULD checklist and error codes' },
];

// Configure marked for spec docs
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Helper: render a protocol markdown file
function renderProtocolDoc(filename) {
  const filePath = path.join(PROTOCOL_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return marked.parse(raw);
}

// Health check — for load balancer and uptime monitoring.
router.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Home page
router.get('/', (req, res) => {
  res.render('index', { specDocs: SPEC_DOCS });
});

// Specification index
router.get('/spec', (req, res) => {
  res.render('spec-index', { specDocs: SPEC_DOCS });
});

// Individual spec documents
router.get('/spec/:slug', (req, res) => {
  const doc = SPEC_DOCS.find(d => d.slug === req.params.slug);
  if (!doc) return res.status(404).render('404');

  const html = renderProtocolDoc(doc.file);
  if (!html) return res.status(404).render('404');

  const currentIndex = SPEC_DOCS.indexOf(doc);
  const prevDoc = currentIndex > 0 ? SPEC_DOCS[currentIndex - 1] : null;
  const nextDoc = currentIndex < SPEC_DOCS.length - 1 ? SPEC_DOCS[currentIndex + 1] : null;

  res.render('spec-doc', {
    doc,
    content: html,
    specDocs: SPEC_DOCS,
    prevDoc,
    nextDoc,
  });
});

// SDK page
router.get('/sdk', (req, res) => {
  res.render('sdk');
});

// Test vectors page
router.get('/test-vectors', (req, res) => {
  // Load test vector data
  const tvDir = path.join(__dirname, 'test-vectors');
  const vectors = [];
  const dirs = ['01-valid-claim', '02-tampered-payload', '03-wrong-key', '04-expired-key', '05-key-rotation', '06-canonicalization-trap'];

  for (const dir of dirs) {
    const expectedPath = path.join(tvDir, dir, 'expected.json');
    const claimPath = path.join(tvDir, dir, 'claim.json');
    if (!fs.existsSync(expectedPath) || !fs.existsSync(claimPath)) continue;
    try {
      const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
      const claim = JSON.parse(fs.readFileSync(claimPath, 'utf-8'));
      vectors.push({ dir, expected, claim });
    } catch (err) {
      console.error(`[test-vectors] failed to parse ${dir}:`, err.message);
    }
  }

  res.render('test-vectors', { vectors });
});

// Schema page
router.get('/schema', (req, res) => {
  const schemaPath = path.join(PROTOCOL_DIR, 'schemas', 'mir-claim.schema.json');
  let schema = null;
  if (fs.existsSync(schemaPath)) {
    schema = fs.readFileSync(schemaPath, 'utf-8');
  }
  res.render('schema', { schema });
});

export default router;

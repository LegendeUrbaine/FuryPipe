import { assertFuryLocalEndpoint } from '../src/fury-local-fabric.js';

const baseUrlValue = process.env.FURYPIPE_DOCUMENT_SUMMARY_BASE_URL?.trim();
const model = process.env.FURYPIPE_DOCUMENT_SUMMARY_MODEL?.trim();

if (!baseUrlValue || !model) {
  console.log(JSON.stringify({
    status: 'NOT_CONFIGURED',
    validation: 'genuine-local-model-document-summary',
    required: ['FURYPIPE_DOCUMENT_SUMMARY_BASE_URL', 'FURYPIPE_DOCUMENT_SUMMARY_MODEL'],
    detail: 'No explicitly configured local model was available; no deterministic fixture was promoted to inference evidence.',
  }));
  process.exit(0);
}

const endpoint = assertFuryLocalEndpoint(baseUrlValue);
const url = new URL('v1/chat/completions', endpoint.href.endsWith('/') ? endpoint.href : `${endpoint.href}/`);
const document = [
  'FURYPIPE-DOCUMENT-ALPHA',
  'Le projet Aster a déplacé sa fenêtre de livraison au 17 minutes après le début du déploiement.',
  'La responsable Noor demande un résumé court qui distingue le fait observé de la proposition suivante.',
  'Le prochain contrôle doit comparer le journal signé avec la copie locale avant toute relance.',
].join('\n');
const prompt = [
  'Résume le document suivant en trois puces françaises.',
  'Le résumé doit mentionner exactement les éléments observés Aster, 17 minutes et Noor.',
  'N’invente aucune information et ne réponds pas par une simple salutation.',
  '',
  document,
].join('\n');

const response = await fetch(url, {
  method: 'POST',
  redirect: 'manual',
  signal: AbortSignal.timeout(120_000),
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    model,
    stream: false,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  }),
});

if (!response.ok) {
  throw new Error(`configured local model answered HTTP ${response.status}`);
}
const body = await response.json() as {
  choices?: readonly [{ message?: { content?: unknown } }];
};
const content = body.choices?.[0]?.message?.content;
if (typeof content !== 'string' || content.trim().length < 40) {
  throw new Error('configured local model returned no usable document summary');
}
const normalized = content.toLocaleLowerCase('fr-FR');
for (const required of ['aster', '17 minutes', 'noor']) {
  if (!normalized.includes(required)) throw new Error(`document summary omitted required observed fact: ${required}`);
}
if (/^\s*(hello|hi|bonjour)[!.]?\s*$/iu.test(content.trim())) {
  throw new Error('configured local model returned a generic greeting instead of a summary');
}

console.log(JSON.stringify({
  status: 'PASS',
  validation: 'genuine-local-model-document-summary',
  transport: 'configured-local-openai-compatible',
  baseUrl: endpoint.origin,
  model,
  responseBytes: Buffer.byteLength(content, 'utf8'),
  observedFacts: ['Aster', '17 minutes', 'Noor'],
  executionAuthority: false,
}));

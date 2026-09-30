// Local-only English smoke test. Credentials stay in memory; raw evidence is private.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {exportPageKnowledgeGaps} from './export-page-knowledge.mjs';
import aesEncrypt from '../navigation-knowledge/sources/umc-admin-portal-target/src/utils/aesEncrypt.ts';

const config = Object.fromEntries(fs.readFileSync(new URL('.env.local', import.meta.url), 'utf8')
  .split('\n').filter(line => line && !line.startsWith('#') && line.includes('='))
  .map(line => {const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];}));
const base = 'http://localhost:18086';
const question = process.argv[2] || 'How many license applications do I currently have pending? Please summarize by status.';
const testAccount = process.env.NMA_TEST_ACCOUNT || config.NMA_TEST_ACCOUNT;
const testPassword = process.env.NMA_TEST_PASSWORD || config.NMA_TEST_PASSWORD;
if (!testAccount || !testPassword) throw new Error('Set NMA_TEST_ACCOUNT and NMA_TEST_PASSWORD in test/.env.local or the process environment.');
const login = await fetch(base + '/api/AdminUser/Login', {method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({loginProvider: testAccount, providerKey: aesEncrypt(testPassword)})});
if (!login.ok) throw new Error('Portal login HTTP ' + login.status);
const loginText = await login.text();
if (!loginText) throw new Error('Portal login returned empty response');
const body = JSON.parse(loginText);
const auth = body.data;
if (!auth?.token || !auth.id) throw new Error('Test login failed; check the private test credential configuration.');
const headers = {Authorization: 'Bearer ' + auth.token, 'Content-Type': 'application/json',
  'X-User-Id': auth.id, 'X-Tenant-Id': 'umc:global:' + auth.id};
const api = async (path, options = {}) => {
  const r = await fetch(base + '/dsh-api/api/v1' + path, {...options, headers});
  if (!r.ok) throw new Error('DSH HTTP ' + r.status);
  return r.json();
};
const conversation = await api('/conversations', {method: 'POST', body: JSON.stringify({workspace: 'admin-portal'})});
const id = conversation.conversationId;
if (!id) throw new Error('Conversation ID missing');
await api('/conversations/' + id + '/messages', {method: 'POST', body: JSON.stringify({content: question,
  clientMessageId: randomUUID(), responseLanguage: 'en'})});
console.log(JSON.stringify({conversationId: id, question, startedAt: new Date().toISOString()}));
let history;
const started = Date.now();
while (Date.now() - started < 210000) {
  history = await api('/conversations/' + id + '/history');
  if (history.events?.some(e => ['turn.completed', 'turn.failed', 'runtime.error'].includes(e.eventType))) break;
  await new Promise(resolve => setTimeout(resolve, 2000));
}
const loginAudit = await fetch(base + '/dsh-audit/api/v1/audit-auth/login', {method: 'POST',
  headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: config.AUDIT_BOOTSTRAP_USERNAME,
    password: config.AUDIT_BOOTSTRAP_PASSWORD})});
if (!loginAudit.ok) throw new Error('Audit login HTTP ' + loginAudit.status);
const cookie = loginAudit.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const audit = await (await fetch(base + '/dsh-audit/api/v1/audit/conversations/' + id + '?pageSize=100',
  {headers: {Cookie: cookie}})).json();
const directory = new URL('runtime/generic-v3/', import.meta.url);
fs.mkdirSync(directory, {recursive: true});
fs.writeFileSync(new URL(id + '.json', directory), JSON.stringify({capturedAt: new Date().toISOString(), question,
  conversationId: id, durationMs: Date.now() - started, history, audit}, null, 2), {mode: 0o600});
console.log(JSON.stringify({conversationId: id, durationMs: Date.now() - started,
  events: history.events?.map(e => ({type: e.eventType, ...(['reader.result', 'assistant.message', 'runtime.error'].includes(e.eventType)
    ? {data: e.data} : {})}))}));
const readerResult = history.events?.find(e => e.eventType === 'reader.result')?.data;
for (const file of exportPageKnowledgeGaps(readerResult)) {
  console.log(JSON.stringify({pageKnowledgeMaintenanceFile: file.pathname}));
}
if (!readerResult || readerResult.pipeline !== 'generic_v3' ||
    (!readerResult.outputs?.length && !readerResult.knowledgeQuotes?.length)) process.exitCode = 1;

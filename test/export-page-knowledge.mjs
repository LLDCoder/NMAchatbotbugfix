// Export page-maintenance metadata only. Questions, answers and values stay in test evidence.
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export function exportPageKnowledgeGaps(readerResult, directory = new URL('../navigation-knowledge/artifacts/KB/pending/', import.meta.url)) {
  const pages = new Map();
  for (const record of readerResult?.knowledgeGap?.records || []) {
    if (record.kind !== 'knowledge_gap') continue;
    const portal = record.applicability?.portal || 'unknown';
    for (const route of record.applicability?.pageRefs || []) {
      if (typeof route !== 'string' || !route.startsWith('/') || route.includes('?') || route.includes('#')) continue;
      const key = portal + ':' + route;
      const page = pages.get(key) || {portal, route, codes: new Set(), sources: new Set()};
      for (const code of record.payload?.blocks || []) {
        if (typeof code === 'string' && /^[a-z][a-z0-9_]{0,100}$/.test(code)) page.codes.add(code);
      }
      for (const source of record.sources || []) {
        if (typeof source.reference === 'string') page.sources.add(source.reference);
      }
      pages.set(key, page);
    }
  }
  const files = [];
  for (const [key, page] of pages) {
    const slug = (page.portal + '-' + page.route).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 70);
    const fingerprint = createHash('sha256').update(key).digest('hex').slice(0, 12);
    const folder = new URL(slug + '-' + fingerprint + '/', directory);
    const file = new URL('pending.json', folder);
    let previous;
    if (fs.existsSync(file)) {
      previous = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (previous.page?.portal !== page.portal || previous.page?.route !== page.route) throw new Error('Page maintenance identity mismatch');
      for (const code of previous.observedGaps || []) page.codes.add(code);
      for (const ref of previous.sourceRefs || []) page.sources.add(ref);
    }
    const document = {
      schemaVersion: 'page-maintenance/1.0',
      page: {portal: page.portal, route: page.route}, status: 'pending',
      items: previous?.items || [{section: 'page_documentation', missing:
        'Verify page identity, views, entity keys, field meanings, metric/filter scope, read operations and deployed source version; update the relevant page sections using the observed gaps.'}],
      observedGaps: [...page.codes].sort(), sourceRefs: [...page.sources].sort(), containsLiveBusinessValues: false,
      observedGapsAreHistorical: true, resolvedRuntimeIssues: previous?.resolvedRuntimeIssues || [],
    };
    fs.mkdirSync(folder, {recursive: true});
    fs.writeFileSync(file, JSON.stringify(document, null, 2) + '\n', {mode: 0o600});
    files.push(file);
  }
  return files;
}

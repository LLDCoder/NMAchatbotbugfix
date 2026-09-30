"""Bounded evidence retrieval. Business meanings remain in retrieved documents.

This module does not assume that optional upstream retrieval modes are supported.
Every supplemental scope/document comes from the current authorized manifest.
"""
import asyncio
from collections import Counter, OrderedDict
import hashlib
import math
import re
import time
from contextvars import ContextVar

import httpx

from .reader_knowledge import (hydrate_packages, bounded_knowledge,
                               KNOWLEDGE_DEADLINE, KNOWLEDGE_MANIFEST, KnowledgeBudgetExpired, document_query)
from .knowledge_errors import retrieval_failure
from .reader_text import words, normalized_text

_STOP = set('a an the of for and or to in on by with from this that my me is are '
            'be do does which what how many show list current unknown'.split())
RETRIEVAL_BUDGET = ContextVar('reader_retrieval_budget', default=None)


def terms(text):
    return {w for w in words(text, split_identifiers=True) if len(w) > 1 and w not in _STOP}


def business_query(task, *, include_planner_query=True):
    """Preserve semantic conditions, not technical paths from planner keywords."""
    values = [task.businessObject, task.businessFocus, task.requestedScope, task.requestedGrain,
              *task.requestedAttributes, *task.requestedMeasures, *task.requestedOrdering, *task.groupBy,
              *task.filters, task.timeField, task.timeRange, task.view]
    if include_planner_query and not re.search(r'https?://|/[A-Za-z0-9_./-]+', task.searchQuery):
        # The planner's business query retains conditional/hypothetical wording
        # that intentionally is not a live-data filter in TaskSpec.
        values.append(task.searchQuery)
    words = ' '.join(dict.fromkeys(v for v in values if v and v != 'unknown'))
    words = re.sub(r'https?://\S+|/[A-Za-z0-9_./?=&%-]+', ' ', words)
    return ' '.join(words.split())[:1800] or ' '.join(re.sub(
        r'https?://\S+|/[A-Za-z0-9_./?=&%-]+', ' ', task.searchQuery).split())[:1800]


def engineering_reference(item):
    # Purpose metadata wins. The fallback identifies generic generated indexes,
    # never a business page, directory, JSON format, or archive lifecycle.
    metadata = item.get('metadata') or {}
    purpose = item.get('purpose') or (metadata.get('purpose') if isinstance(metadata, dict) else None)
    if purpose:
        return purpose == 'engineering_reference'
    return bool(re.search(r'(?:inventory|catalog|navigation-graph)\.json$',
                          str(item.get('source_name') or item.get('sourceName') or item.get('name') or ''), re.I))


def document_key(item):
    return (item.get('document_id') or item.get('documentId') or item.get('id') or item.get('chunkId'),
            item.get('document_version') or item.get('documentVersion') or '')


def diverse(items, limit=32):
    """Round-robin documents without merging same-named files or versions."""
    groups = OrderedDict()
    seen = set()
    for item in items:
        identity = (*document_key(item), item.get('id') or item.get('chunkId'),
                    hashlib.sha256(str(item.get('content', item.get('text', ''))).encode()).hexdigest())
        if identity not in seen:
            groups.setdefault(document_key(item), []).append(item)
            seen.add(identity)
    output = []
    while groups and len(output) < limit:
        for key in list(groups):
            output.append(groups[key].pop(0))
            if not groups[key]:
                del groups[key]
            if len(output) == limit:
                break
    return output


def rank_documents(manifests, query, references=()):
    ready = [m for m in manifests if m.get('status') == 'done' and m.get('id')
             and isinstance(m.get('name'), str)]
    vocab = {m['id']: terms(m['name']) for m in ready}
    frequencies = Counter(t for v in vocab.values() for t in v)
    requested = terms(re.sub(r'https?://\S+|/[A-Za-z0-9_./?=&%-]+', ' ', query))
    refs = '\n'.join(str(r) for r in references).casefold()
    ranked = []
    for m in ready:
        exact = m['name'].casefold() in refs or query.strip().casefold() == m['name'].casefold()
        score = sum(math.log(1 + len(ready) / frequencies[t]) for t in requested & vocab[m['id']])
        if score or exact:
            ranked.append((not exact, engineering_reference(m), -score, m['id'], m))
    return [item[-1] for item in sorted(ranked)]


def retain_verified_definitions(result, limit):
    """Hydration appends complete definitions; arrival order must not evict them.

    Reserve the bounded hydration lane using verified runtime receipts, never
    a filename, a graph summary, or a self-declared 'complete' flag. Remaining
    slots still use document diversity for ordinary reference evidence.
    """
    receipts = {(r.get('documentId'), str(r.get('version')), r.get('contentHash'))
                for r in result.get('documentVersions', [])}
    verified, references = [], []
    for chunk in result.get('chunks', []):
        content = chunk.get('content')
        proof = (chunk.get('document_id'), str(chunk.get('document_version')), chunk.get('content_hash'))
        is_verified = (proof in receipts and chunk.get('source_type') != 'graph'
                       and isinstance(content, str)
                       and hashlib.sha256(content.encode()).hexdigest() == chunk.get('content_hash'))
        (verified if is_verified else references).append(chunk)
    ordered = [*sorted(verified, key=engineering_reference),
               *sorted(references, key=engineering_reference)]
    retained = diverse(ordered, limit)
    kept = {c.get('document_id') for c in retained if c in verified}
    omitted = sorted({c.get('document_id') for c in verified} - kept)
    return retained, omitted


async def retrieve_evidence(client, query, folder_id, top_k, context, umc_token=None):
    """One root query, up to two discovered scopes, two document continuations.

    Existing JSON hydration adds its own bounded reconstruction calls. The
    enclosing Reader deadline cancels every child; optional failures remain gaps.
    """
    started = time.monotonic()
    snapshots = KNOWLEDGE_MANIFEST.get()
    snapshot_key = (folder_id, hashlib.sha256(str(umc_token or '').encode()).hexdigest())
    snapshot = snapshots.get(snapshot_key) if snapshots is not None else None
    if snapshot is None:
        before = (await bounded_knowledge('retrieval_manifest', (client.manifest if callable(getattr(client, 'manifest', None)) else client.files)(
            folder_id, recursive=True, umc_token=umc_token))).get('items', [])
        manifest_seconds = time.monotonic() - started
        if snapshots is not None:
            snapshots[snapshot_key] = (before, manifest_seconds)
    else:
        # A turn is pinned to its initial authorized directory. Fresh mandatory
        # after-checks still reject any consumed file changed or revoked since.
        before, manifest_seconds = snapshot
    clock = KNOWLEDGE_DEADLINE.get()
    if clock is not None:
        # The second manifest request has the same shape and remains mandatory.
        clock['verificationReserve'] = max(clock.get('minimumVerificationReserve', 8),
                                           manifest_seconds * 2)
    manifest = {m.get('id'): m for m in before}
    attempts, failures = [], []
    budget = RETRIEVAL_BUDGET.get()
    if budget is None:
        budget = {'remaining': 4}

    async def fetch(text, scope, stage, *, optional=False, document=None):
        if optional:
            lanes = budget.get('lanes')
            if budget['remaining'] <= 0 or (lanes is not None and lanes.get(context['purpose'], 0) <= 0):
                failures.append({'code': 'knowledge_supplement_budget_exhausted', 'stage': stage,
                                 'documentId': document})
                return {'chunks': []}
            budget['remaining'] -= 1
            if lanes is not None:
                lanes[context['purpose']] -= 1
        try:
            body = {'query': text[:2000], 'folder_id': scope, 'top_k': top_k}
            if document:
                body['source_refs'] = ['kbfile:' + document]
            result = await bounded_knowledge(stage, client._post('/search', body,
                umc_token=umc_token), optional=optional)
            attempts.append({'stage': stage, 'query': text[:2000], 'folderId': scope,
                             'documentId': document, 'returnedChunks': len(result.get('chunks', [])),
                             'actualChannels': result.get('completed_channels', [])})
            return result
        except (httpx.HTTPError, ValueError, TypeError, KnowledgeBudgetExpired) as exc:
            failure = retrieval_failure(exc) or {'code': 'knowledge_search_failed'}
            attempts.append({'stage': stage, 'query': text[:2000], 'folderId': scope,
                             'documentId': document, 'status': 'failed', **failure})
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in {401, 403}:
                raise
            if not optional:
                raise
            code = 'knowledge_supplement_timeout' if isinstance(exc, KnowledgeBudgetExpired) else 'knowledge_supplement_fetch_failed'
            failures.append({**(retrieval_failure(exc) or {'code': code}), 'stage': stage,
                             'documentId': document, 'errorType': type(exc).__name__})
            return {'chunks': []}

    variants = list(dict.fromkeys(context.get('queryVariants', [])))[:2]
    variants = [v for v in variants if normalized_text(v) != normalized_text(query)]
    primary_failure = None
    async def primary():
        nonlocal primary_failure
        try:
            return await fetch(query, folder_id, 'primary_search')
        except httpx.HTTPStatusError as exc:
            primary_failure = retrieval_failure(exc)
            if not variants or not primary_failure or primary_failure['code'] != 'knowledge_retrieval_channels_incomplete':
                raise
            # Each alternate still needs every configured channel to complete.
            failures.append({**primary_failure, 'stage': 'primary_search'})
            return {'chunks': []}
    # Admit the mandatory canonical query before optional expansion. The
    # upstream may serialize graph/vector work; speculative variants must not
    # occupy that queue while the only mandatory evidence request waits.
    # Variants still run and remain independently checked in all channels.
    root = await primary()
    searches = []
    try:
        searches.extend(asyncio.create_task(fetch(v, folder_id, 'expanded_search', optional=True)) for v in variants)
        expanded = await asyncio.gather(*searches)
    finally:
        for pending in searches:
            if not pending.done():
                pending.cancel()
        await asyncio.gather(*searches, return_exceptions=True)
    if primary_failure:
        recovered = next((r for r in expanded if r.get('chunks')), None)
        if recovered is None:
            return {'chunks': [], 'consistencyError': primary_failure['code'], 'retrievalError': primary_failure,
                    'hydrationGaps': failures, 'retrievalPlan': {'purpose': context['purpose'],
                    'queries': attempts, 'queryVariants': variants, 'supplementFailures': failures,
                    'primaryRecovered': False}}
        root = {**recovered, 'chunks': []}
    # Fuse query lanes before document diversification; a large translated
    # result list cannot drown evidence from the original canonical intent.
    ranks, candidates = {}, {}
    for result in [root, *expanded]:
        seen = set()
        for rank, chunk in enumerate(result.get('chunks', []), 1):
            key = (chunk.get('document_id'), chunk.get('id'), str(chunk.get('content', '')))
            if key in seen:
                continue
            seen.add(key)
            candidates.setdefault(key, chunk)
            ranks[key] = ranks.get(key, 0) + 1/(60 + rank)
    chunks = [candidates[k] for k in sorted(candidates, key=lambda k: -ranks[k])]
    ranking_query = ' '.join([query, *variants])
    def references_in(values):
        # The wrapper repeats its own filename; it is not a cross-reference.
        return [str(c.get('content', '')).casefold().replace(str(c.get('source_name', '')).casefold(), '')
                for c in values if not engineering_reference(c)]
    references = [*context.get('documentReferences', []), *references_in(chunks)]
    ranked = rank_documents(before, ranking_query, references)
    # An exact filename lookup is already a document continuation, not a reason
    # to fan out into unrelated files that happen to share a token.
    exact = any(m['name'].casefold() == query.strip().casefold() for m in before)
    has_business_evidence = any(not engineering_reference(c) for c in chunks)
    scopes = list(dict.fromkeys(m.get('folder_id') for m in ranked
                              if not engineering_reference(m) and m.get('folder_id')
                              and m['folder_id'] != folder_id))[:2] if not exact and not has_business_evidence else []
    scoped = await asyncio.gather(*(fetch(query, scope, 'scope_search', optional=True) for scope in scopes))
    for result in scoped:
        chunks.extend(result.get('chunks', []))
    # Only discovered, ready documents can influence continuation selection.
    chunks = [c for c in chunks if manifest.get(c.get('document_id'), {}).get('status') == 'done']
    references.extend(references_in(chunks))
    ranked = rank_documents(before, ranking_query, references)
    primary_docs = {c.get('document_id') for c in chunks if not engineering_reference(c)}
    # A single incidental filename token (e.g. a scope adjective) is not a
    # reason to expand an unrelated handbook. Follow actual hits/references,
    # or a substantive filename match when primary search missed a document.
    explicit_refs = '\n'.join(references).casefold()
    documents = [m for m in ranked if not engineering_reference(m)
                 and not m['name'].lower().endswith('.json')
                 and (m['id'] in primary_docs or m['name'].casefold() in explicit_refs
                      or len(terms(m['name']) & terms(ranking_query)) >= 2)][:2] if not exact else []
    if context['purpose'] == 'page_fields' and any(str(c.get('source_name', '')).lower().endswith('.json') for c in chunks):
        # Hydrating the selected page definitions has priority over more prose.
        # Semantic gaps can request their own bounded business follow-up later.
        documents = []
    if context['purpose'] == 'page_fields' and not exact:
        # Missing page packages cannot be hydrated until at least one source
        # chunk has been retrieved. Discover them only from the authorized,
        # ready manifest, with an explicit reference or substantive name match.
        # A hit on a different JSON file is not evidence that this page is known.
        missing_packages = [m for m in ranked if not engineering_reference(m)
                            and m['name'].lower().endswith('.json') and m['id'] not in primary_docs
                            and (m['name'].casefold() in explicit_refs
                                 or len(terms(m['name']) & terms(ranking_query)) >= 2)]
        documents = (missing_packages + documents)[:2]
    if exact:
        # An explicitly named ready package must not depend on winning semantic
        # search again. Hydration still verifies bytes and before/after manifests.
        documents = [m for m in before if m.get('status') == 'done'
                     and m.get('name', '').casefold() == query.strip().casefold()
                     and m['name'].lower().endswith('.json')][:2]
    direct_documents = [m for m in documents if m['name'].lower().endswith('.json')
                        and callable(getattr(client, 'document', None))]
    search_documents = [m for m in documents if m not in direct_documents]
    continuations = await asyncio.gather(*(fetch(document_query(m['name'], query), m.get('folder_id') or folder_id,
        'reference_sections', optional=True, document=m['id']) for m in search_documents))
    for m, result in zip(search_documents, continuations):
        # A filename query may return unrelated documents. It only fills the
        # selected document, never confers scope on those incidental hits.
        chunks.extend(c for c in result.get('chunks', []) if c.get('document_id') == m['id'])
    identities = {}
    for chunk in chunks:
        key = (chunk.get('document_id'), chunk.get('id'))
        if key in identities and identities[key] != chunk.get('content'):
            return {'chunks': [], 'consistencyError': 'knowledge_document_changed',
                    'hydrationGaps': [{'code': 'knowledge_document_changed', 'documentId': key[0]}]}
        identities[key] = chunk.get('content')
    gathered = {**root, 'chunks': chunks}
    result = await hydrate_packages(client, gathered, folder_id, top_k, umc_token,
                                    query=query, manifest_before=before,
                                    document_ids=[m['id'] for m in direct_documents])
    if not result.get('consistencyError'):
        # Preserve source order within each document. Engineering references are
        # deprioritized, not removed by extension or directory assumptions.
        result['chunks'], omitted = retain_verified_definitions(result, min(32, max(1, top_k)))
        result['hydrationGaps'] = [*result.get('hydrationGaps', []),
            *({'code': 'knowledge_evidence_budget_exhausted', 'documentId': doc} for doc in omitted)]
    result['retrievalPlan'] = {'purpose': context['purpose'], 'queries': attempts,
                             'queryVariants': variants, 'fusion': 'reciprocal_rank_then_document_diversity',
                             'primaryRecovered': primary_failure is not None,
                             'documentBudget': 2, 'scopeBudget': 2,
                             'selectedDocuments': [m['id'] for m in documents],
                             'directDocumentIds': [m['id'] for m in direct_documents],
                             'candidateChunks': len(chunks), 'retainedChunks': len(result.get('chunks', [])),
                             'supplementFailures': failures}
    result['hydrationGaps'] = [*result.get('hydrationGaps', []), *failures]
    return result

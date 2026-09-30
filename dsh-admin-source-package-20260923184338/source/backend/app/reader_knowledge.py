"""Bounded reconstruction of a versioned JSON document, never unrelated RAG text."""
import hashlib
import json
import re
import time
import asyncio
import copy
import httpx
from .knowledge_errors import retrieval_failure
from contextvars import ContextVar

MAX_DOCUMENT_BYTES = 1024 * 1024
KNOWLEDGE_TRACE = ContextVar("reader_knowledge_trace", default=None)
KNOWLEDGE_PINNED = ContextVar("reader_knowledge_pinned", default=None)
KNOWLEDGE_DEADLINE = ContextVar("reader_knowledge_deadline", default=None)
KNOWLEDGE_MANIFEST = ContextVar("reader_knowledge_manifest", default=None)


class KnowledgeBudgetExpired(TimeoutError):
    pass


async def bounded_knowledge(stage, operation, *, optional=False):
    """Reserve time for the mandatory manifest check; cancel only optional work.

    The mutable clock is shared by all children of one retrieval, never across
    requests. External cancellation is deliberately not converted to a gap.
    """
    clock = KNOWLEDGE_DEADLINE.get()
    if clock is None:
        return await timed_knowledge(stage, operation)
    remaining = clock['deadline'] - time.monotonic()
    allowance = remaining - (clock.get('verificationReserve', 0) if optional else 0)
    if optional:
        allowance = min(allowance, clock.get('optionalSeconds', 12))
    if allowance <= 0:
        if hasattr(operation, 'close'):
            operation.close()
        raise KnowledgeBudgetExpired(stage)
    try:
        return await asyncio.wait_for(timed_knowledge(stage, operation), allowance)
    except TimeoutError as exc:
        raise KnowledgeBudgetExpired(stage) from exc


async def timed_knowledge(stage, operation):
    started = time.monotonic()
    status = "interrupted"
    try:
        result = await operation
        status = "passed"
        return result
    finally:
        trace = KNOWLEDGE_TRACE.get()
        if trace is not None:
            trace.append({"stage": stage, "status": status, "durationMs": round((time.monotonic()-started)*1000)})


def manifest_version(item):
    return tuple(item.get(k) for k in ("id", "updated_at", "size", "status", "name", "folder_id", "sha256"))


def document_query(name, query):
    """Keep the retrieval anchor when continuing a discovered file.

    A filename alone can lose all graph entities although the source contains
    applicable relations. Scope is still the exact authorized source reference;
    all configured channels must independently complete successfully.
    """
    name = str(name)
    query = str(query).strip()
    return name if not query or query.casefold() == name.casefold() else (name + ' ' + query)[:2000]


def reconstruct_package(chunks, manifest):
    """Require one document, contiguous chunks, exact overlaps, size and valid JSON.

    The caller also checks the file manifest before/after retrieval. This is a
    consistency receipt, not a claim of transactional upstream snapshots.
    """
    if (manifest.get("status") != "done" or not manifest.get("updated_at")
            or not isinstance(manifest.get("size"), int)
            or not 0 < manifest["size"] <= MAX_DOCUMENT_BYTES):
        return None
    parts = {}
    for chunk in chunks:
        if chunk.get("document_id") != manifest.get("id"):
            continue
        # Graph evidence may carry this file's provenance, but its entity or
        # relationship text is not a byte segment of the original JSON file.
        # Keep source-file reconstruction independent from derived evidence.
        if chunk.get('source_type') not in (None, 'file'):
            continue
        match = re.fullmatch(r"kbfile:" + re.escape(manifest["id"]) + r"-chunk-(\d+)", str(chunk.get("id", "")))
        if not match or chunk.get("source_name") != manifest.get("name"):
            return None
        index, text = int(match[1]), chunk.get("content")
        if not isinstance(text, str) or index > 63 or (index in parts and parts[index] != text):
            return None
        parts[index] = text
    if not parts or sorted(parts) != list(range(len(parts))):
        return None
    first = parts[0]
    if "{" not in first:
        return None
    text = first[first.index("{"):]
    for index in range(1, len(parts)):
        part = parts[index]
        overlaps = [i for i in range(32, min(len(text), len(part), 8192) + 1) if text.endswith(part[:i])]
        if not overlaps:
            return None
        text += part[max(overlaps):]
        if len(text.encode()) > MAX_DOCUMENT_BYTES:
            return None
    # The upstream tokenizer strips the terminal newline, not document data.
    if manifest["size"] - len(text.encode()) not in (0, 1, 2):
        return None
    if manifest.get('sha256'):
        matches = [candidate for candidate in (text, text + '\n', text + '\r\n')
                   if len(candidate.encode()) == manifest['size']
                   and hashlib.sha256(candidate.encode()).hexdigest() == manifest['sha256']]
        if not matches:
            return None
        text = matches[0]
    try:
        parsed = json.loads(text)
    except ValueError:
        return None
    if not isinstance(parsed, dict) or not isinstance(parsed.get("records"), list):
        return None
    return {"id": "kbfile:" + manifest["id"] + "#complete", "document_id": manifest["id"],
            "source_name": manifest["name"], "content": text,
            "content_hash": hashlib.sha256(text.encode()).hexdigest(),
            "document_version": str(manifest["updated_at"]),
            "hydration": {"method": "contiguous_overlap_size_json", "chunks": len(parts),
                          "manifestVersion": list(manifest_version(manifest))}}


async def hydrate_packages(client, result, folder_id, top_k, umc_token=None, *, query="", manifest_before=None,
                           document_ids=()):
    chunks = result.get("chunks", [])
    before = manifest_before if manifest_before is not None else (await timed_knowledge(
        "directory_before", (client.manifest if callable(getattr(client, "manifest", None)) else client.files)(folder_id, recursive=True, umc_token=umc_token))).get("items", [])
    directory_version = hashlib.sha256(json.dumps(sorted((manifest_version(x) for x in before), key=str), default=str).encode()).hexdigest()
    before_map = {x.get('id'): x for x in before}
    pinned = KNOWLEDGE_PINNED.get() or {}
    if any(tuple(version) != manifest_version(before_map.get(doc_id, {})) for doc_id, version in pinned.items()):
        return {**result, 'chunks': [], 'consistencyError': 'knowledge_document_changed',
                'directoryVersion': directory_version, 'hydrationGaps': [{'code': 'knowledge_document_changed'}]}
    # Indexing unrelated documents does not invalidate current evidence. Only
    # ready, identified files may supply new chunks, and all consumed manifests
    # are pinned across the turn and checked before/after every retrieval.
    chunks = [c for c in chunks if before_map.get(c.get('document_id'), {}).get('status') == 'done']
    eligible = {x.get("id") for x in before if x.get('status') == 'done' and isinstance(x.get("size"), int) and 0 < x["size"] <= MAX_DOCUMENT_BYTES}
    json_chunks = [c for c in chunks if str(c.get("source_name", "")).lower().endswith(".json")
                   and c.get("document_id") in eligible]
    # Prefer exact page applicability over incidental endpoint references.
    # This uses the supplied query and document metadata, never business names.
    routes = set(re.findall(r"/[A-Za-z0-9_./-]+", query.casefold()))
    def priority(chunk):
        text = chunk.get("content", "")
        applicability = " ".join(re.findall(r'"(?:pageRefs|pageRef)"\s*:\s*(?:\[[^\]]{0,2000}\]|"[^"\n]+")', text)).casefold()
        hits = sum('"' + route + '"' in applicability for route in routes)
        structured = bool(re.search(r'"(?:records|packageStatus|applicability|bindings)"\s*:', text))
        exact_name = query.strip().casefold() == str(before_map.get(chunk.get('document_id'), {}).get('name', '')).casefold()
        return (not exact_name, -hits, not structured)
    json_chunks.sort(key=priority)
    # A ready file explicitly discovered in the authorized manifest need not
    # win a second semantic search just to obtain its bytes. No invented IDs,
    # archived versions, or unverified text can enter through this path.
    requested = [doc_id for doc_id in document_ids if doc_id in eligible
                 and str(before_map[doc_id].get('name', '')).lower().endswith('.json')]
    ids = list(dict.fromkeys([*requested, *(c["document_id"] for c in json_chunks)]))[:3]
    manifests = {x["id"]: x for x in before if x.get("id") in ids}
    # Cache is bounded, client-local and partitioned by caller and directory
    # version. Fresh authorized manifests are still checked before AND after.
    cache = getattr(client, "_reader_document_cache", None)
    if cache is None:
        cache = client._reader_document_cache = {}
    scope = hashlib.sha256(str(umc_token or "").encode()).hexdigest()
    cache_keys = {doc_id: (scope, folder_id, manifest_version(manifests[doc_id]), doc_id) for doc_id in ids}
    complete, gaps = {}, []
    async def hydrate_one(doc_id):
        manifest = manifests.get(doc_id)
        if not manifest:
            gaps.append({"documentId": doc_id, "code": "knowledge_document_manifest_missing"})
            return
        cached = cache.get(cache_keys[doc_id])
        cache_hit = bool(cached and time.monotonic()-cached[0] < 300)
        package = copy.deepcopy(cached[1]) if cache_hit else reconstruct_package(chunks, manifest)
        if cache_hit and package and KNOWLEDGE_TRACE.get() is not None:
            KNOWLEDGE_TRACE.get().append({"stage": "document_cache", "status": "passed", "durationMs": 0})
        if package is None and callable(getattr(client, 'document', None)):
            document = await bounded_knowledge('document_content', client.document(
                doc_id, folder_id, umc_token=umc_token), optional=True)
            content = document.get('content')
            receipt = document.get('manifest', {})
            if (manifest_version(receipt) != manifest_version(manifest)
                    or not isinstance(content, str)
                    or len(content.encode()) != manifest['size']
                    or hashlib.sha256(content.encode()).hexdigest() != manifest.get('sha256')
                    or document.get('content_hash') != manifest.get('sha256')):
                raise ValueError('knowledge_document_integrity_mismatch')
            parsed = json.loads(content)
            if not isinstance(parsed, dict) or not isinstance(parsed.get('records'), list):
                raise ValueError('knowledge_document_format_invalid')
            package = {'id': 'kbfile:' + doc_id + '#complete', 'document_id': doc_id,
                       'source_name': manifest['name'], 'content': content,
                       'content_hash': manifest['sha256'], 'document_version': str(manifest['updated_at']),
                       'hydration': {'method': 'authorized_document_sha256',
                                     'manifestVersion': list(manifest_version(manifest))}}
        if package is None:
            # The authorized recursive manifest supplies this file's directory.
            # Search there so unrelated sibling documents cannot consume the
            # upstream top-k before this file's continuation is returned.
            # This only narrows a discovered file; it never invents a scope.
            document_folder = manifest.get("folder_id") or folder_id
            extra = await bounded_knowledge("document_chunks", client._post("/search", {"query": document_query(manifest["name"], query), "folder_id": document_folder,
                                       "source_refs": ["kbfile:" + doc_id],
                                       "top_k": min(100, max(32, top_k))}, umc_token=umc_token), optional=True)
            gathered = [*chunks, *extra.get("chunks", [])]
            package = reconstruct_package(gathered, manifest)
            if package is None:
                # A filename query can omit the tail. One bounded continuation
                # query uses the retrieved document boundary, never page rules.
                own = [c for c in gathered if c.get("document_id") == doc_id and isinstance(c.get("content"), str)]
                own.sort(key=lambda c: str(c.get("id", "")))
                if own:
                    boundary = own[-1]["content"][-1000:]
                    continuation = await bounded_knowledge("document_continuation", client._post("/search", {"query": boundary, "folder_id": document_folder,
                        "source_refs": ["kbfile:" + doc_id],
                        "top_k": min(100, max(32, top_k))}, umc_token=umc_token), optional=True)
                    package = reconstruct_package([*gathered, *continuation.get("chunks", [])], manifest)
        if package:
            complete[doc_id] = package
        else:
            gaps.append({"documentId": doc_id, "code": "knowledge_document_incomplete"})
    failed = set()
    async def hydrate_safely(doc_id):
        try:
            await hydrate_one(doc_id)
        except (httpx.HTTPError, ValueError, TypeError, KeyError, KnowledgeBudgetExpired) as exc:
            failed.add(doc_id)
            # Preserve independent verified documents. Never retain fragments
            # from a document whose hydration request failed, or exception text
            # that can contain upstream URLs, tokens or private document data.
            gap = {'documentId': doc_id, 'code': 'knowledge_document_fetch_failed',
                   'errorType': type(exc).__name__}
            gap.update(retrieval_failure(exc) or {})
            if isinstance(exc, KnowledgeBudgetExpired):
                gap['code'] = 'knowledge_supplement_timeout'
            if isinstance(exc, httpx.HTTPStatusError):
                gap['httpStatus'] = exc.response.status_code
            gaps.append(gap)
    # One document failure does not cancel independently verified documents.
    # Cancellation of the enclosing deadline still cancels all child requests.
    async with asyncio.TaskGroup() as group:
        for doc_id in ids:
            group.create_task(hydrate_safely(doc_id))
    after = {x["id"]: x for x in (await bounded_knowledge("directory_after", (client.manifest if callable(getattr(client, "manifest", None)) else client.files)(folder_id, recursive=True, umc_token=umc_token))).get("items", [])}
    after_version = hashlib.sha256(json.dumps(sorted((manifest_version(x) for x in after.values()), key=str), default=str).encode()).hexdigest()
    consumed = set(pinned) | {c['document_id'] for c in chunks} | set(complete)
    if any(manifest_version(before_map.get(doc_id, {})) != manifest_version(after.get(doc_id, {})) for doc_id in consumed):
        return {**result, "chunks": [], "directoryVersion": after_version,
                'consistencyError': 'knowledge_document_changed',
                "hydrationGaps": [{"code": "knowledge_document_changed"}]}
    pinned_versions = {doc_id: list(manifest_version(after[doc_id])) for doc_id in consumed}
    for doc_id in list(complete):
        if manifest_version(manifests[doc_id]) != manifest_version(after.get(doc_id, {})):
            del complete[doc_id]
            gaps.append({"documentId": doc_id, "code": "knowledge_document_changed"})
    for doc_id, package in complete.items():
        cache[cache_keys[doc_id]] = (time.monotonic(), copy.deepcopy(package))
    while len(cache) > 16:
        del cache[min(cache, key=lambda key: cache[key][0])]
    return {**result, "directoryVersion": after_version, "pinnedVersions": pinned_versions,
            "consistency": "referenced_documents",
            "chunks": [{**c, 'document_version': str(after[c['document_id']].get('updated_at', ''))}
                       for c in chunks if c.get("document_id") not in complete and c.get("document_id") not in failed] + list(complete.values()),
            "hydrationGaps": gaps,
            "documentVersions": [{"documentId": k, "version": v["document_version"],
                                  "contentHash": v["content_hash"]} for k, v in complete.items()]}

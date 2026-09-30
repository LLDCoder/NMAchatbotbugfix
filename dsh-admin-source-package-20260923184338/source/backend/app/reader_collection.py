"""Lossless, bounded transport for trusted gateway computation receipts."""
import hashlib
import json
import math
import re

MAX_ROWS = 5000
MAX_BYTES = 5_000_000
RESTRICTED = re.compile(r'password|passwd|secret|token|authorization|cookie|email|e.?mail|passport|national.?id|emirates.?id|phone|mobile|address|credential|base64|binary|content', re.I)


def projection_hash(rows):
    return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':')).encode()).hexdigest()


def validate_analysis_sources(plan, sources):
    """Fail at the real collection boundary before semantic binding can mask it."""
    from .generic_reader import PipelineError
    for step in plan.steps:
        if step.op != 'read_rows' or step.sourceId not in sources:
            continue
        source = sources[step.sourceId]
        if source.get('collectionFailure'):
            raise PipelineError(source['collectionFailure'], 'runtime', details={
                'sourceId': step.sourceId, 'stepId': step.id,
                'collectionDiagnostics': source.get('collectionDiagnostics', {})})
        if source.get('kind') == 'projected_collection':
            receipt = source.get('collectionReceipt') or {}
            missing = sorted(set(step.fields) - set(receipt.get('fields', [])))
            if missing:
                raise PipelineError('analysis_projection_not_collected', 'planning', details={
                    'sourceId': step.sourceId, 'stepId': step.id, 'missingFields': missing,
                    'collectedFields': receipt.get('fields', []),
                    'correction': 'These fields were not collected. Obtain a new validated collection before using them, or leave the dependent requirement unfulfilled. Missing projections are not observed null values.'})


def observed_projection_fields(row_schemas, path, requested, documented):
    """A documented leaf beneath an observed null parent is unknown, not absent."""
    schemas = [row for row in row_schemas if row.get('path') == path]
    if not schemas:
        return set()
    observed = set.intersection(*(set(row.get('fields', [])) for row in schemas))
    nullable = set.intersection(*(set(row.get('nullableFields', [])) for row in schemas))
    return observed | {field for field in requested if field in documented and any(
        field.startswith(parent + '.') for parent in nullable)}



def validate_observed_collection_identity(spec, source, task, knowledge, page):
    """Reject a positively observed null/empty key before any collection request.

    Schema absence is not evidence of non-nullness. Suggestions are documented
    grain choices with nonempty captured samples, not proofs of full uniqueness.
    The planner must choose; this function never edits a key or drops a row.
    """
    from types import SimpleNamespace
    from urllib.parse import urlsplit
    from .generic_reader import PipelineError, pointer, row_scalar, TRUNCATION
    from .reader_bindings import applicable_bindings
    from .reader_requirements import requirements_for, _semantic_match

    context = source.get('collectionContext')
    if not isinstance(context, dict):
        return
    raw_schemas = context.get('rowSchemas')
    if not isinstance(raw_schemas, list):
        return
    schemas = [row for row in raw_schemas if isinstance(row, dict)
        and row.get('path') == spec.rowsPath and type(row.get('sampledRows')) is int
        and 0 < row['sampledRows'] <= 100]
    if not schemas:
        return
    def field_name(value):
        return (isinstance(value, str) and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.]{0,100}', value)
                and not RESTRICTED.search(value))
    nullable = {field for row in schemas
                for field in (row['nullableFields'] if isinstance(row.get('nullableFields'), list) else [])
                if field_name(field)}
    evidence = source.get('fieldEvidence')
    evidence = evidence if isinstance(evidence, dict) else {}
    empty_hashes = {projection_hash(None), projection_hash('')}
    sampled = max(row['sampledRows'] for row in schemas)
    bad = []
    for field in spec.identityFields:
        if not field_name(field):
            continue  # Existing projection/policy checks own invalid field names.
        known_null = any(field == parent or field.startswith(parent + '.') for parent in nullable)
        for index in range(sampled):
            proof = evidence.get(spec.rowsPath + '/' + str(index) + '/' + field.replace('.', '/'), {})
            if (isinstance(proof, dict) and proof.get('status') == 'complete'
                    and proof.get('kind') == 'scalar' and proof.get('valueHash') in empty_hashes):
                known_null = True
        if known_null:
            bad.append(field)
    if not bad:
        return

    choices = []
    try:
        rows = pointer(source['data'], spec.rowsPath)
    except (PipelineError, KeyError, TypeError):
        rows = None
    # A complete observed sample is necessary to recommend another key. Neither
    # truncated schema inventories nor an empty sample can supply that proof.
    if (len(schemas) == 1 and schemas[0].get('fieldsTruncated') is False
            and schemas[0].get('nullableFieldsTruncated') is False
            and isinstance(schemas[0].get('fields'), list)
            and all(field_name(f) for f in schemas[0]['fields'])
            and isinstance(rows, list) and len(rows) == sampled
            and all(isinstance(row, dict) for row in rows)):
        facts = applicable_bindings(knowledge, {spec.sourceId: source})
        catalog = {fact['knowledgeBindingId']: fact for fact in facts}
        grain = next((r for r in requirements_for(task) if r['kind'] == 'grain'), None)
        records = {item['record']['id']: item['record'] for item in knowledge.items.values()
                   if isinstance(item.get('record'), dict) and item['record'].get('id')}
        for fact in facts:
            record = records.get(fact['recordId'], {})
            fields = fact['fields']
            if (not grain or fact['kind'] != 'grain' or fact['recordId'] in knowledge.conflicted
                    or fact.get('conditions')
                    or not re.fullmatch(r'[A-Za-z0-9_.#-]{1,200}', fact['knowledgeBindingId'])
                    or urlsplit(page).path not in record.get('applicability', {}).get('pageRefs', [])
                    or fact['operationRef'] != source.get('operationRef') or fact['sourcePath'] != spec.rowsPath
                    or spec.sourceId not in fact.get('contextVerifiedSourceIds', [])
                    or not 1 <= len(fields) <= 5 or len(set(fields)) != len(fields)
                    or not all(field_name(f) for f in fields)
                    or not set(fields) <= set(schemas[0].get('fields', []))
                    or any(f == parent or f.startswith(parent + '.') for f in fields for parent in nullable)
                    or not _semantic_match(SimpleNamespace(knowledgeBindingId=fact['knowledgeBindingId'],
                        sourcePath=spec.rowsPath, fields=fields), grain, source, catalog)):
                continue
            try:
                values = [row_scalar(row, field) for row in rows for field in fields]
            except PipelineError:
                continue
            if any(value is None or value == '' or isinstance(value, (dict, list))
                    or isinstance(value, str) and value in TRUNCATION for value in values):
                continue
            choices.append({'knowledgeBindingId': fact['knowledgeBindingId'], 'fields': list(fields)})
        if len(choices) > 5:
            choices = []  # Do not silently select among an over-budget set of alternatives.
    raise PipelineError('collection_identity_observed_empty', 'planning', details={
        'sourceId': spec.sourceId, 'rowsPath': spec.rowsPath,
        'observedEmptyIdentityFields': bad, 'documentedGrainKeyCandidates': choices,
        'correction': 'The current observed sample contains a null or empty identity component. '
            'Choose the complete documented key for this requested grain on the same source/path, '
            'using the supplied semanticBindings and observed schema. Candidate keys only passed '
            'the captured-sample check; full collection still verifies them. Do not automatically '
            'drop a composite-key component, substitute another entity, fill a key or discard rows. '
            'If no valid key is established, return collections=[] and preserve the missing requirements.'})


def has_attested_empty_page(source, spec):
    """Permit documented projection planning, never conclude a zero population.

    An empty first response has no row fields to observe. The gateway must still
    collect the same authorized operation twice and validate its full receipt.
    """
    from .generic_reader import PipelineError, pointer
    context = source.get('collectionContext') or {}
    if (source.get('kind') != 'api_response' or source.get('truncated') is not False
            or context.get('mode') != 'page_number_two_pass'
            or not re.fullmatch(r'[a-f0-9]{64}', str(context.get('contextRef', '')))
            or spec.rowsPath.rsplit('/', 1)[0] != spec.totalPath.rsplit('/', 1)[0]
            or (context.get('parameterHashes') or {}).get(spec.pageField) != projection_hash(spec.firstPage)):
        return False
    schemas = [row for row in context.get('rowSchemas', []) if row.get('path') == spec.rowsPath]
    if not schemas or any(row.get('sampledRows') != 0 or row.get('fields') != []
            or row.get('fieldsTruncated') is not False for row in schemas):
        return False
    data = source.get('data')
    if not isinstance(data, dict) or data.get('isSuccess') is False or data.get('success') is False:
        return False
    try:
        rows, total = pointer(data, spec.rowsPath), pointer(data, spec.totalPath)
    except PipelineError:
        return False
    if not isinstance(rows, list) or rows or type(total) is not int or total != 0:
        return False
    evidence = source.get('fieldEvidence') or {}
    return all(isinstance(evidence.get(path), dict)
        and evidence[path].get('status') == 'complete'
        and evidence[path].get('kind') == kind
        and evidence[path].get('valueHash') == projection_hash(value)
        for path, kind, value in [(spec.rowsPath, 'array', rows), (spec.totalPath, 'scalar', total)])


def checked_collections(receipts):
    """Never truncate a full-collection receipt. Reject an invalid one instead."""
    if not isinstance(receipts, list) or len(receipts) > 2:
        return [{'completeness': 'incomplete', 'reason': 'collection_receipt_invalid'}]
    results = []
    for receipt in receipts:
        operation = receipt.get('operationRef', '') if isinstance(receipt, dict) else ''
        failed = {'operationRef': operation, 'completeness': 'incomplete', 'reason': 'collection_receipt_invalid'}
        if not isinstance(receipt, dict):
            results.append(failed)
            continue
        if re.fullmatch(r'[a-f0-9]{64}', str(receipt.get('contextRef', ''))):
            failed['contextRef'] = receipt['contextRef']
        if receipt.get('completeness') != 'complete':
            code = receipt.get('reason', '')
            failed['reason'] = code if re.fullmatch(r'collection_[a-z_]+', str(code)) else failed['reason']
            # Retain bounded structural diagnostics, never failed row values.
            for key in ['pagesRead', 'startedAt', 'finishedAt', 'bytesRead']:
                value = receipt.get(key)
                if type(value) is int and 0 <= value <= MAX_BYTES or isinstance(value, str) and len(value) <= 64:
                    failed[key] = value
            comparison = receipt.get('comparison')
            if isinstance(comparison, dict):
                safe = {key: value for key, value in comparison.items() if key in {
                    'equivalent', 'orderChanged', 'firstRowCount', 'secondRowCount',
                    'addedIdentityCount', 'removedIdentityCount', 'changedIdentityCount'}
                    and (type(value) is bool or type(value) is int and 0 <= value <= MAX_ROWS)}
                fields = comparison.get('changedFields', [])
                if isinstance(fields, list):
                    safe['changedFields'] = [f for f in fields[:20] if isinstance(f, str)
                        and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.]{0,100}', f) and not RESTRICTED.search(f)]
                failed['comparison'] = safe
            source_diagnostic = receipt.get('sourceDiagnostic')
            if isinstance(source_diagnostic, dict):
                states = {'ambiguous_source', 'context_mismatch', 'capture_missing',
                          'policy_denied', 'response_not_successful'}
                safe = {}
                if isinstance(source_diagnostic.get('sourceState'), str) and source_diagnostic['sourceState'] in states:
                    safe['sourceState'] = source_diagnostic['sourceState']
                response_state = source_diagnostic.get('responseState')
                if isinstance(response_state, str) and response_state in {
                        'not_observed', 'success', 'access_denied', 'not_found', 'other_http_response'}:
                    safe['responseState'] = response_state
                count = source_diagnostic.get('matchingSourceCount')
                if type(count) is int and 0 <= count <= 1000:
                    safe['matchingSourceCount'] = count
                for key in ['candidateObserved', 'capturePresent', 'captureContextMatches',
                            'policyAllowed', 'responseSuccessful']:
                    if type(source_diagnostic.get(key)) is bool:
                        safe[key] = source_diagnostic[key]
                if safe:
                    failed['sourceDiagnostic'] = safe
            dependency = receipt.get('dependency')
            if isinstance(dependency, dict):
                failed['dependency'] = {key: value for key, value in dependency.items()
                    if (key == 'upstreamStatus' and type(value) is int and 100 <= value <= 599)
                    or (key == 'attempts' and type(value) is int and 1 <= value <= 3)
                    or (key == 'errorType' and isinstance(value, str) and re.fullmatch(r'[A-Za-z]{1,80}', value))}
            results.append(failed)
            continue
        rows, fields, identity = receipt.get('rows'), receipt.get('fields'), receipt.get('identityFields')
        try:
            if (receipt.get('schemaVersion') != 'projected-collection/1'
                    or receipt.get('stablePasses') != 2 or receipt.get('snapshotIsolation') is not False
                    or not isinstance(fields, list) or not 1 <= len(fields) <= 20
                    or any(not isinstance(f, str) or RESTRICTED.search(f) for f in fields)
                    or not isinstance(identity, list) or not identity or not set(identity) <= set(fields)
                    or not isinstance(rows, list) or len(rows) > MAX_ROWS
                    or type(receipt.get('total')) is not int or len(rows) != receipt['total']
                    or len(rows) != receipt.get('rowCount')):
                raise ValueError()
            if (not isinstance(receipt.get('operationRef'), str) or not receipt['operationRef']
                    or not re.fullmatch(r'[a-f0-9]{64}', str(receipt.get('contextRef', '')))
                    or any(not isinstance(receipt.get(key), str) or not receipt[key].startswith('/')
                           for key in ['rowsPath', 'totalPath'])
                    or not isinstance(receipt.get('finishedAt'), str) or not receipt['finishedAt']
                    or len(set(fields)) != len(fields) or len(set(identity)) != len(identity)):
                raise ValueError()
            statuses = receipt.get('fieldStatus', {})
            if (not isinstance(statuses, dict) or not set(statuses) <= set(fields)
                    or any(status not in {'complete', 'null', 'collection_field_missing',
                        'collection_scalar_fields_required', 'collection_value_not_safe',
                        'collection_derivation_unverified'} for status in statuses.values())
                    or any(statuses.get(key, 'complete') != 'complete' for key in identity)):
                raise ValueError()
            for row in rows:
                if not isinstance(row, dict) or set(row) != set(fields):
                    raise ValueError()
                if any(isinstance(v, (dict, list)) or isinstance(v, str) and len(v) > 500
                       or isinstance(v, float) and not math.isfinite(v) for v in row.values()):
                    raise ValueError()
                if any(row[k] is None or row[k] == '' for k in identity):
                    raise ValueError()
            if len(json.dumps(receipt).encode()) > MAX_BYTES or projection_hash(rows) != receipt.get('projectionHash'):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            results.append(failed)
            continue
        results.append(receipt)
    return results

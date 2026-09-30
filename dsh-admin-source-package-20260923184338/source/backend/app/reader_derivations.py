"""Compile page-owned clock definitions over complete, stable source fields.

No page names, status codes or business timezones belong in this executor.
Derived values carry their input receipt and one fixed reference instant.
"""
import copy
import json
import math
from datetime import datetime, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from .reader_collection import RESTRICTED, projection_hash, observed_projection_fields, has_attested_empty_page
from .reader_temporal import timestamp


def compile_derivations(knowledge, page, source, spec):
    from .generic_reader import PipelineError
    candidates = {}
    for item in knowledge.items.values():
        record = item.get('record') or {}; payload = record.get('payload') or {}
        binding = payload.get('sourceBinding') or {}
        if (record.get('status') != 'active'
                or urlsplit(page).path not in record.get('applicability', {}).get('pageRefs', [])
                or binding.get('operationRef') != source.get('operationRef')
                or binding.get('sourcePath') != spec.rowsPath):
            continue
        for rule in payload.get('temporalDerivations', []):
            if not isinstance(rule, dict) or rule.get('field') not in spec.fields:
                continue
            field = rule['field']
            candidates.setdefault(field, {})[projection_hash(rule)] = (rule, record, item)
    rules, proofs = [], []
    for field, versions in candidates.items():
        if len(versions) != 1:
            raise PipelineError('collection_derivation_conflict', 'knowledge_gap')
        rule, record, item = next(iter(versions.values()))
        if (set(rule) - {'field', 'operator', 'startField', 'endField', 'endNull', 'sourceTimezone',
                         'nullWhen', 'requiresNonNull', 'nullStartValue', 'description'}
                or rule.get('operator') not in {'elapsed_minutes', 'elapsed_days', 'calendar_days'}
                or rule.get('endNull') != 'reference_time'
                or rule.get('nullStartValue') not in (None, 0)):
            raise PipelineError('collection_derivation_unsupported', 'engine_capability_gap')
        try:
            ZoneInfo(rule['sourceTimezone'])
            nulls = rule.get('nullWhen', [])
            if not isinstance(nulls, list) or len(nulls) > 8 or any(
                    set(c) != {'field', 'equals'} or isinstance(c['equals'], (dict, list)) for c in nulls):
                raise ValueError()
            dependencies = list(dict.fromkeys([rule['startField'], rule['endField'],
                *rule.get('requiresNonNull', []), *(c['field'] for c in nulls)]))
            import re
            if (len(dependencies) > 16 or field in dependencies or field in spec.identityFields or
                    any(not isinstance(f, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.]{0,100}', f)
                        or RESTRICTED.search(f) for f in dependencies)):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            raise PipelineError('collection_derivation_invalid', 'knowledge_gap') from None
        documented = record['payload'].get('fields', {})
        schemas = (source.get('collectionContext') or {}).get('rowSchemas', [])
        observed = observed_projection_fields(schemas, spec.rowsPath, dependencies, set(documented))
        if has_attested_empty_page(source, spec):
            observed.update(f for f in dependencies if f in documented)
        if any(f not in documented or f not in observed for f in dependencies):
            raise PipelineError('collection_derivation_inputs_unverified', 'source_data', details={
                'field': field, 'missingFields': [f for f in dependencies if f not in documented or f not in observed]})
        rules.append({**rule, 'dependencies': dependencies})
        proofs.append({'recordId': record['id'], 'revision': record['revision'],
            'documentId': item['documentId'], 'field': field, 'definitionHash': projection_hash(rule)})
    derived = {r['field'] for r in rules}
    fields = list(dict.fromkeys([f for f in spec.fields if f not in derived] +
                               [f for r in rules for f in r['dependencies']]))
    if len(fields) > 20:
        raise PipelineError('collection_projection_budget_exceeded', 'planning')
    return {'fields': fields, 'requestedFields': list(spec.fields), 'rules': rules, 'proofs': proofs}


def apply_derivations(receipt, compiled):
    """Called only after the original gateway receipt passes all checks."""
    from .generic_reader import PipelineError
    if not compiled['rules'] or receipt.get('completeness') != 'complete':
        return receipt
    if receipt['fields'] != compiled['fields']:
        raise PipelineError('collection_receipt_context_mismatch', 'runtime')
    try:
        reference = datetime.fromisoformat(receipt['startedAt'].replace('Z', '+00:00'))
        if reference.tzinfo is None:
            raise ValueError()
    except (ValueError, KeyError):
        raise PipelineError('time_reference_unverified', 'execution_configuration') from None
    result = copy.deepcopy(receipt)
    statuses = result.setdefault('fieldStatus', {})
    diagnostics = {}
    for rule in compiled['rules']:
        field = rule['field']; unknown = 0
        for row in result['rows']:
            unavailable = any(statuses.get(f, 'complete') not in {'complete', 'null'} for f in rule['dependencies'])
            # A documented pause dominates missing timestamps, but never a
            # missing/unobserved predicate input.
            paused = any(c['field'] in row and type(row[c['field']]) is type(c['equals'])
                         and row[c['field']] == c['equals'] for c in rule.get('nullWhen', []))
            value = None
            if unavailable or (not paused and any(row.get(f) is None for f in rule.get('requiresNonNull', []))):
                unknown += 1
            elif not paused:
                start = timestamp(row.get(rule['startField']), rule)
                raw_end = row.get(rule['endField'])
                end = reference if raw_end is None else timestamp(raw_end, rule)
                if start is None:
                    if row.get(rule['startField']) is None:
                        value = rule.get('nullStartValue')
                    else:
                        unknown += 1
                elif end is None:
                    unknown += 1
                else:
                    if rule['operator'] == 'calendar_days':
                        zone = ZoneInfo(rule['sourceTimezone'])
                        value = (end.astimezone(zone).date() - start.astimezone(zone).date()).days
                    else:
                        value = (end.astimezone(timezone.utc) - start.astimezone(timezone.utc)).total_seconds() / 60
                        if rule['operator'] == 'elapsed_days':
                            value /= 1440
                    if not math.isfinite(value):
                        value = None; unknown += 1
            row[field] = value
        statuses[field] = 'collection_derivation_unverified' if unknown else (
            'null' if any(r[field] is None for r in result['rows']) else 'complete')
        nulls = sum(r[field] is None for r in result['rows'])
        diagnostics[field] = {'computedRows': len(result['rows']) - nulls,
                              'documentedNullRows': nulls - unknown, 'unverifiedRows': unknown}
    requested = compiled['requestedFields']
    result['rows'] = [{f: r[f] for f in requested} for r in result['rows']]
    result['fields'] = requested
    result['fieldStatus'] = {f: statuses.get(f, 'complete') for f in requested}
    result['derivation'] = {'referenceUtc': reference.isoformat(), 'inputProjectionHash': receipt['projectionHash'],
        'inputFields': receipt['fields'], 'definitions': compiled['proofs'],
        'fieldDiagnostics': diagnostics,
        'kind': 'fixed_reference_computation', 'snapshotIsolation': False}
    result['projectionHash'] = projection_hash(result['rows'])
    return result

"""Prove no exact identity match in a fully collected, authorized lookup view."""
from .reader_collection import projection_hash


def verified_lookup_absence(task, definitions, sources):
    from .generic_reader import pointer, PipelineError
    from .reader_record_request import validate_scalar_record_identity, record_filter_identifiers
    validate_scalar_record_identity(task.recordIdentity)
    if any(record_filter_identifiers(value) for value in getattr(task, 'filters', [])):
        return None
    if not task.recordIdentity or not definitions or not sources:
        return None
    proofs = []
    for source_id, source in sources.items():
        relevant = [d for d in definitions if d.get('operationRef') == source.get('operationRef')]
        if not relevant:
            continue
        receipt = source.get('collectionReceipt') or {}
        if (source.get('truncated') or source.get('collectionFailure')
                or receipt.get('completeness') != 'complete'
                or receipt.get('stablePasses', 0) < 2
                or receipt.get('operationRef') != source.get('operationRef')):
            return None
        for definition in relevant:
            field = definition.get('identityField')
            if not field or receipt.get('rowsPath') != definition.get('sourcePath'):
                return None
            try:
                rows = pointer(source['data'], definition['sourcePath'])
            except (PipelineError, KeyError):
                return None
            if (not isinstance(rows, list) or receipt.get('rowCount') != len(rows)
                    or receipt.get('total') != len(rows)
                    or receipt.get('projectionHash') != projection_hash(rows)
                    or field not in receipt.get('fields', [])
                    or (rows and receipt.get('fieldStatus', {}).get(field) != 'complete')):
                return None
            # An independently proven empty population has no row from which to derive
            # fieldStatus. All declared-field, complete/stable, total and hash checks
            # above still apply; nonempty rows retain complete field evidence.
            if any(not isinstance(row, dict) or row.get(field) is None
                   or str(row[field]) == task.recordIdentity for row in rows):
                return None
            proofs.append({'sourceId': source_id, 'operationRef': source['operationRef'],
                'bindingId': definition['bindingId'], 'field': field,
                'rowCount': len(rows), 'capturedAt': receipt.get('finishedAt'),
                'projectionHash': receipt['projectionHash']})
    if not proofs:
        return None
    return {'recordIdentity': task.recordIdentity, 'scope': 'checked_authorized_view',
            'sources': proofs, 'globalAbsence': False}

"""A verified empty population can satisfy an unspecified list's display shape."""
from .reader_collection import checked_collections, projection_hash


def empty_list_shape_proof(task, output, nodes, sources, lineage):
    """Prove only the display shape; per-output business context is checked later.

    No field value or requested attribute is inferred. A normal preview, a list
    emptied by a transformation, or a failed/partial collection cannot qualify.
    """
    from .generic_reader import PipelineError, pointer
    if (task.outputShape != 'list' or task.requestedAttributes
            or output.get('role') != 'detail' or output.get('value') != []
            or output.get('unknownCount') or output.get('unavailableFields')
            or not lineage or any(ref.get('completeness') != 'complete' for ref in lineage)
            or any(node.op not in {'read_rows', 'distinct', 'project', 'sort'} for node in nodes)):
        return None
    reads = [node for node in nodes if node.op == 'read_rows']
    if not reads or {ref.get('sourceId') for ref in lineage} != {node.sourceId for node in reads}:
        return None
    proofs = []
    for node in reads:
        source = sources.get(node.sourceId, {})
        receipt = source.get('collectionReceipt') or {}
        context = source.get('collectionContext') or {}
        data = source.get('data')
        if (source.get('kind') != 'projected_collection' or source.get('truncated') is not False
                or source.get('completeness') != 'complete' or source.get('collectionFailure')
                or not source.get('principalScopeRef') or not source.get('observationRef')
                or context.get('mode') != 'page_number_two_pass'
                or context.get('contextRef') != receipt.get('contextRef')
                or node.path != receipt.get('rowsPath')
                or source.get('operationRef') != receipt.get('operationRef')
                or not isinstance(data, dict) or data.get('isSuccess') is False or data.get('success') is False
                or data.get('statusCode', 200) != 200):
            return None
        try:
            rows = pointer(data, receipt.get('rowsPath', ''))
            total = pointer(data, receipt.get('totalPath', ''))
        except PipelineError:
            return None
        full = checked_collections([{**receipt, 'rows': rows}])[0]
        if (rows != [] or type(total) is not int or total != 0
                or full.get('completeness') != 'complete' or full.get('total') != 0
                or full.get('consistency') != 'two_pass_observation'
                or full.get('comparison', {}).get('equivalent') is not True
                or any(type(full.get('comparison', {}).get(key)) is not int or full['comparison'][key] != 0
                       for key in ['firstRowCount', 'secondRowCount', 'addedIdentityCount',
                                   'removedIdentityCount', 'changedIdentityCount'])
                or full.get('comparison', {}).get('changedFields') != []):
            return None
        refs = [ref for ref in lineage if ref.get('sourceId') == node.sourceId]
        if any(ref.get('fieldBinding') != node.path or
               any(ref.get(key) != source.get(key) for key in
                   ['operationRef', 'principalScopeRef', 'observationRef', 'capturedAt']) for ref in refs):
            return None
        proofs.append({'sourceId': node.sourceId, 'sourcePath': node.path,
            'operationRef': source['operationRef'], 'observationRef': source['observationRef'],
            'contextRef': full['contextRef'], 'receiptHash': projection_hash(full),
            'total': 0, 'stablePasses': 2})
    return {'covers': 'unspecified_list_shape_only', 'sources': proofs}

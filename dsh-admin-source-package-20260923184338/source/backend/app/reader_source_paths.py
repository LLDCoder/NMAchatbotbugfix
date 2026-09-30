"""Explain a missing observed path without relocating data or inventing a read."""


def read_source_path(source_id, path, sources):
    from .generic_reader import PipelineError, pointer
    source = sources[source_id]
    try:
        return pointer(source['data'], path)
    except PipelineError as error:
        if error.code != 'field_missing':
            raise
        alternatives = []
        for key, candidate in sources.items():
            if key == source_id or candidate.get('ready') is False or candidate.get('collectionFailure'):
                continue
            try:
                pointer(candidate['data'], path)
            except PipelineError:
                continue
            alternatives.append({'sourceId': key, 'operationRef': candidate.get('operationRef', '')})
        raise PipelineError('field_missing', error.category, details={
            'sourceId': source_id, 'operationRef': source.get('operationRef', ''),
            'path': path, 'pointerRoot': 'source.data',
            'observedSourcesContainingPath': alternatives,
            'correction': 'This path is absent from this observed response. A documented path for a different '
                'operation is not a field on this source. Use another source only if its operation, parent '
                'identity, field binding and completeness independently match. These path candidates do not '
                'grant access or prove relevance. If the required related operation was not observed, retain '
                'that missing read and omit its unsupported output; do not repeat the same nonexistent path '
                'or let it discard other independently supported outputs.'}) from None

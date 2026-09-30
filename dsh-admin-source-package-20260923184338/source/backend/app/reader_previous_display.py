"""Present proven public blocks once; never rewrite hidden context as new facts.

The narrow optimization covers one complete empty detail/observation pair.
A single complete plain empty detail has a separate display protocol.
Partial, nonempty and dated snapshot answers keep their existing renderers.
"""
from hashlib import sha256
import json
import re


def _hash(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                             separators=(',', ':')).encode()).hexdigest()


def _empty_pair(outputs, *, allow_derived=False):
    if (not isinstance(outputs, list) or len(outputs) != 2
            or {o.get('role') for o in outputs} != {'detail', 'observation'}
            or len({o.get('id') for o in outputs}) != 2):
        return False
    primary = next(o for o in outputs if o['role'] == 'detail')
    observed = next(o for o in outputs if o['role'] == 'observation')
    for output in outputs:
        if (not output.get('id') or not output.get('label')
                or output.get('value') != [] or output.get('displayRows', []) != []
                or output.get('dataCompleteness') != 'complete'
                or any(output.get(k) for k in ('unknownCount', 'unavailableFields',
                    'verifiedAbsences', 'verifiedInterpretations', 'snapshotResponseDates',
                    'snapshotScopeProof', 'groupDomainProof'))
                or not output.get('requirementIds') or len(output.get('evidence', [])) != 1):
            return False
        ref = output['evidence'][0]
        proof = output.get('emptyListProof') or {}
        sources = proof.get('sources') or []
        if (ref.get('completeness') != 'complete' or ref.get('populationComplete') is not True
                or any(ref.get(k) for k in ('unknownRows', 'unavailableReason', 'timeInterval'))
                or proof.get('covers') != 'unspecified_list_shape_only' or len(sources) != 1):
            return False
        if ref.get('derivation'):
            from .reader_empty_display_proof import empty_derivation
            if not allow_derived or not empty_derivation(ref['derivation']):
                return False
        source = sources[0]
        if (type(source.get('total')) is not int or source['total'] != 0
                or type(source.get('stablePasses')) is not int or source['stablePasses'] < 2
                or any(not ref.get(k) for k in ('page', 'capturedAt', 'principalScopeRef',
                    'sourceId', 'observationRef', 'operationRef', 'fieldBinding'))
                or any(source.get(k) != ref[k] for k in ('sourceId', 'observationRef', 'operationRef'))
                or source.get('sourcePath') != ref['fieldBinding']
                or any(not isinstance(source.get(k), str) or not re.fullmatch(r'[0-9a-f]{64}', source[k])
                       for k in ('contextRef', 'receiptHash'))):
            return False
    return (primary['evidence'] == observed['evidence']
        and primary['emptyListProof'] == observed['emptyListProof']
        and primary.get('fieldLabels') == observed.get('fieldLabels')
        and set(observed['requirementIds']) <= set(primary['requirementIds']))


SINGLE_SCHEMA = 'previous-public-single-empty-display/1'
SINGLE_TRANSPORT = 'previous-public-single-empty-transport/1'


def _single_empty_detail(outputs):
    """A plain single result needs its own complete witness, never a fake pair."""
    if not isinstance(outputs, list) or len(outputs) != 1:
        return False
    output = outputs[0]
    if (not isinstance(output, dict) or output.get('role') != 'detail'
            or not output.get('id') or not output.get('label')
            or output.get('value') != [] or output.get('displayRows', []) != []
            or output.get('dataCompleteness') != 'complete'
            or any(output.get(k) for k in ('unknownCount', 'unavailableFields',
                'verifiedAbsences', 'verifiedInterpretations', 'snapshotResponseDates',
                'snapshotScopeProof', 'groupDomainProof'))
            or not output.get('requirementIds') or len(output.get('evidence', [])) != 1):
        return False
    ref = output['evidence'][0]
    proof = output.get('emptyListProof') or {}
    sources = proof.get('sources') or []
    if (not isinstance(ref, dict) or 'derivation' in ref
            or ref.get('completeness') != 'complete' or ref.get('populationComplete') is not True
            or any(ref.get(k) for k in ('unknownRows', 'unavailableReason', 'timeInterval'))
            or proof.get('covers') != 'unspecified_list_shape_only' or len(sources) != 1):
        return False
    source = sources[0]
    return (isinstance(source, dict)
        and type(source.get('total')) is int and source['total'] == 0
        and type(source.get('stablePasses')) is int and source['stablePasses'] >= 2
        and all(ref.get(k) for k in ('page', 'capturedAt', 'principalScopeRef',
            'sourceId', 'observationRef', 'operationRef', 'fieldBinding'))
        and all(source.get(k) == ref[k] for k in ('sourceId', 'observationRef', 'operationRef'))
        and source.get('sourcePath') == ref['fieldBinding']
        and all(isinstance(source.get(k), str) and re.fullmatch(r'[0-9a-f]{64}', source[k])
                for k in ('contextRef', 'receiptHash')))


def _wrap_single_display(projection, display, source):
    """Reuse only the reviewed transport codec, never the derived protocol."""
    from copy import deepcopy
    from .generic_reader import clean
    from .reader_empty_display_proof import _flatten
    from .service import DSHService
    try:
        payload = {'projection': deepcopy(projection), 'display': deepcopy(display), 'source': deepcopy(source)}
        if (display.get('schemaVersion') != SINGLE_SCHEMA
                or clean(payload, max_items=1000) != payload
                or DSHService.audit_payload(payload, max_depth=32) != payload):
            return None
        proof = {'schemaVersion': SINGLE_TRANSPORT, 'sourceNodes': _flatten(payload), 'contentHash': _hash(payload)}
        carrier = {'previousAnswer': {'publicDisplayProof': proof}}
        if clean(carrier, max_items=200) != carrier or DSHService.audit_payload(carrier) != carrier:
            return None
        return proof
    except (ValueError, TypeError, KeyError, AttributeError):
        return None


def _restore_single_display(projection):
    from copy import deepcopy
    from .reader_empty_display_proof import _restore
    from .reader_public_rewrite import compile_rewrite, SOURCE_KEY
    from .service import DSHService
    try:
        proof = projection['publicDisplayProof']
        if set(proof) != {'schemaVersion', 'sourceNodes', 'contentHash'} or proof['schemaVersion'] != SINGLE_TRANSPORT:
            return None
        payload = _restore(proof['sourceNodes'])
        if set(payload) != {'projection', 'display', 'source'} or _hash(payload) != proof['contentHash']:
            return None
        original = payload['projection']
        current = {k: v for k, v in projection.items() if k != 'publicDisplayProof'}
        if ('publicDisplayProof' in original or SOURCE_KEY in original
                or current not in (original, DSHService.audit_payload({'previousAnswer': original})['previousAnswer'])):
            return None
        display = payload['display']
        if display.get('schemaVersion') != SINGLE_SCHEMA:
            return None
        if _display_contract(original, '\n'.join(display['sourceAnswerLines']), display['sourceLanguage']) != display:
            return None
        restored = deepcopy(original)
        rewritten = compile_rewrite(original, display, payload['source'], structured=True)
        restored['publicDisplayProof'] = rewritten or display
        if rewritten:
            restored[SOURCE_KEY] = payload['source']
        return restored
    except (ValueError, TypeError, KeyError, AttributeError):
        return None


def _display_contract(projection, original, source_language):
    try:
        return _checked_display_contract(projection, original, source_language)
    except (KeyError, TypeError, ValueError, AttributeError):
        return None


def _checked_display_contract(projection, original, source_language):
    """Reconstruct every original public block, with exact source spans."""
    from .generic_reader import render_generic_answer, safe_text, clean, _public_context_text
    from .reader_locale import text
    if (source_language not in {'en', 'ar'} or not isinstance(original, str)
            or not projection.get('verified')
            or projection.get('kind') not in {'simplify', 'simplify_navigation'}
            or projection.get('completeness') != 'complete'
            or projection.get('businessResultComplete') is False
            or any(projection.get(k) for k in ('observedPageContext', 'snapshotScopeProof',
                'snapshotScopeLabels', 'unconfirmedRequirements', 'sourceMissing', 'currentIdentity'))
            or projection.get('liveDataRead') is not False
            or projection.get('currentStatusClaimed') is not False
            or not (_empty_pair(projection.get('outputs'), allow_derived=True)
                    or _single_empty_detail(projection.get('outputs')))):
        return None
    context = projection.get('context') or {}
    if (not context.get('scope') or context.get('time') not in (None, '', 'unknown', 'current observation')
            or any(k not in {'scope', 'grain', 'population', 'filterScope', 'time', 'caveats'} for k in context)):
        return None
    # The readable layer carries original context evidence separately. Keep
    # the v37 public-text proof byte-for-byte unchanged; the outer layer checks
    # that additional source binding and reparses every rewritten clause.
    state = {k: v for k, v in projection.items() if k not in {'publicDisplayProof', 'publicRewriteSource'}}
    original_lines = original.split('\n')
    # Runtime clean() folds whitespace in each string. Preserve line boundaries
    # structurally, rather than hashing text which that boundary would change.
    # Unsupported sanitization/transport shapes stay on the existing path;
    # no original text or context is shortened to fit the optimization.
    if (len(original_lines) > 1000 or any(safe_text(line) != line for line in original_lines)
            or clean(state, max_items=1000) != state):
        return None
    # Reconstruct just the ordinary successful rendering. Exact equality also
    # excludes extra guidance, warnings, drafts or special answer wrappers.
    raw_context = {k: ([{'value': v} for v in value] if k == 'caveats' else
                       value if k == 'scope' else {'value': value})
                   for k, value in context.items()}
    view = {'result': 'success', 'analysisStatus': 'complete', 'requirementsSatisfied': True,
            'completeness': 'complete', 'outputs': projection['outputs'], 'context': raw_context}
    if render_generic_answer(view, source_language) != original:
        return None
    tr = lambda value: text(value, source_language)
    header = tr('Current page results:')
    empty = 'لم يتم العثور على سجلات مطابقة.' if source_language == 'ar' else 'No matching rows.'
    output_blocks = [safe_text(o['label']) + (tr(' (observation)') if o['role'] == 'observation' else '')
                     + ':\n' + empty for o in projection['outputs']]
    blocks = [{'kind': 'scope', 'quote': tr('Scope: ') + tr(context['scope']) + '.'}]
    references = sorted({ref['derivation']['referenceUtc'] for output in projection['outputs']
                         for ref in output['evidence'] if ref.get('derivation')})
    for reference in references:
        label = 'الوقت المرجعي للحساب' if source_language == 'ar' else 'Calculation reference time'
        blocks.append({'kind': 'calculation_time', 'referenceUtc': reference, 'quote': f'{label}: {reference}.'})
    for key, label in (('grain', 'Unit'), ('population', 'Population'), ('filterScope', 'Filter scope')):
        value = context.get(key)
        if value and _public_context_text(value):
            blocks.append({'kind': key, 'quote': tr(label) + ': ' + safe_text(value) + '.'})
    hidden = []
    for index, value in enumerate(context.get('caveats', [])):
        if _public_context_text(value):
            blocks.append({'kind': 'caveat', 'contextIndex': index, 'quote': safe_text(value)})
        else:
            hidden.append({'kind': 'caveat', 'contextIndex': index,
                           'reason': 'not_presented_in_verified_original_rendering'})
    prefix = header + ''.join('\n\n' + block for block in output_blocks)
    if prefix + '\n\n' + '\n'.join(block['quote'] for block in blocks) != original:
        return None
    cursor = len(header)
    displayed_outputs = []
    for output, block in zip(projection['outputs'], output_blocks):
        cursor += 2
        displayed_outputs.append({'outputId': output['id'], 'label': output['label'],
            'quoteLines': block.split('\n'), 'sourceSpan': {'start': cursor, 'end': cursor + len(block)}})
        cursor += len(block)
    cursor += 2
    for block in blocks:
        block['sourceSpan'] = {'start': cursor, 'end': cursor + len(block['quote'])}
        cursor += len(block['quote']) + 1
    single = _single_empty_detail(projection['outputs'])
    return {'schemaVersion': SINGLE_SCHEMA if single else
                'previous-public-empty-display/2' if references else 'previous-public-empty-display/1',
        'sourceRequestId': projection['sourceRequestId'], 'sourceLanguage': source_language,
        'sourceAnswerLines': original_lines, 'sourceAnswerSHA256': sha256(original.encode()).hexdigest(),
        'projectionHash': _hash(state), 'publicBlocks': blocks, 'outputBlocks': displayed_outputs,
        'unpresentedContext': hidden, 'combinedEmptyOutputIds': [o['id'] for o in projection['outputs']],
        'claim': ('verified_single_empty_source_not_a_prior_simplification_claim' if single else
                  'same_verified_empty_source_presented_once_not_a_prior_simplification_claim')}


def public_empty_display(projection, original, source_result=None):
    """Only the saved, actual answer can establish original visibility."""
    for language in ('en', 'ar'):
        contract = _display_contract(projection, original, language)
        if contract:
            if contract['schemaVersion'] == SINGLE_SCHEMA:
                if source_result is None:
                    return None
                from .reader_public_rewrite import source_context
                return _wrap_single_display(projection, contract, source_context(source_result))
            if contract['schemaVersion'] == 'previous-public-empty-display/2':
                if source_result is None:
                    return None
                from .reader_public_rewrite import source_context
                from .reader_empty_display_proof import wrap_derived_display
                return wrap_derived_display(projection, contract, source_context(source_result))
            if source_result is not None:
                from .reader_public_rewrite import source_context, compile_rewrite, SOURCE_KEY
                source = source_context(source_result)
                rewritten = compile_rewrite(projection, contract, source)
                if rewritten:
                    projection[SOURCE_KEY] = source
                    return rewritten
            return contract
    return None


def render_public_empty_display(projection, language):
    """Check the entire contract again; preserve public wording verbatim."""
    from .generic_reader import safe_text
    proof = projection.get('publicDisplayProof')
    if not isinstance(proof, dict):
        return None
    if proof.get('schemaVersion') == SINGLE_TRANSPORT:
        restored = _restore_single_display(projection)
        return render_public_empty_display(restored, language) if restored else None
    from .reader_empty_display_proof import SCHEMA as DERIVED_SCHEMA, restore_derived_display
    if proof.get('schemaVersion') == DERIVED_SCHEMA:
        restored = restore_derived_display(projection)
        return render_public_empty_display(restored, language) if restored else None
    from .reader_public_rewrite import SCHEMA, SOURCE_KEY, compile_rewrite, render_clauses
    wrapper = proof if proof.get('schemaVersion') == SCHEMA else None
    if wrapper:
        proof = wrapper.get('originalDisplayProof')
        if not isinstance(proof, dict):
            return None
    elif SOURCE_KEY in projection:
        return None
    original_lines = proof.get('sourceAnswerLines')
    if not isinstance(original_lines, list) or not all(isinstance(line, str) for line in original_lines):
        return None
    expected = _display_contract(projection, '\n'.join(original_lines), proof.get('sourceLanguage'))
    if not expected or proof != expected:
        return None
    if wrapper and compile_rewrite(projection, proof, projection.get(SOURCE_KEY),
            structured=proof.get('schemaVersion') in {SINGLE_SCHEMA, 'previous-public-empty-display/2'}) != wrapper:
        return None
    def literal(value):
        return re.sub(r'([\\`*_{}\[\]()<>!|])', r'\\\1', safe_text(value))
    ar = language == 'ar'
    times = ', '.join(literal(t) for t in projection['observedAt'])
    historical = (f'نتيجة القراءة السابقة في {times}؛ لم تُحدَّث ولا تمنح صلاحية الوصول إلى سجلات إضافية.' if ar else
                  f'Earlier read at {times}; not refreshed and grants no additional record access.')
    result = ('النتيجة: لم توجد صفوف مطابقة.' if ar else 'Result: no matching rows.')
    labels = '\n'.join('- ' + literal(o['label']) for o in proof['outputBlocks'])
    # Labels are both retained. Matching source evidence, not a guessed lexical
    # similarity or equal numeric value, justifies the single empty conclusion.
    result += '\n' + labels
    context = [literal(block['quote']) for block in proof['publicBlocks']]
    if wrapper:
        headline, context = render_clauses(wrapper, language, literal)
        if headline:
            result = headline
    navigation = ' · '.join('[' + literal(n['label']) + '](' + n['route'] + ')'
                            for n in projection['navigation'])
    lines = [result, *context, historical] if wrapper else [historical, result, *context]
    if navigation:
        lines.append(('التنقل إلى الصفحة: ' if ar else 'Page navigation: ') + navigation)
    return '\n\n'.join(lines)

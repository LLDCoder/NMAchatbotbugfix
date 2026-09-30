"""Preserve acceptance uncertainty when presenting an observed prior result.

This only describes the result of a completed earlier turn. It never supplies
live values, row authorization, missing business rules or repaired computation.
"""
from copy import deepcopy
from hashlib import sha256


def observed_partial_result(result):
    """Admit acceptance gaps with actual outputs, never an error or refusal."""
    missing = result.get('missing')
    outputs = result.get('outputs')
    gaps = result.get('gaps') or []
    if (result.get('result') != 'not_confirmed' or result.get('analysisStatus') != 'partial'
            or result.get('requirementsSatisfied') is not False
            or result.get('failureCategory') or result.get('clarification')
            or not isinstance(missing, list) or not missing
            or not isinstance(outputs, list) or not outputs
            or not isinstance(gaps, list) or not gaps
            or any(not isinstance(code, str) or not (code.startswith('requested_') or
                       code in {'requirements_incomplete', 'stage_quality_incomplete'}) for code in missing)
            or {gap.get('code') for gap in gaps if isinstance(gap, dict)} != set(missing)
            or any(not isinstance(gap, dict) or gap.get('category') != 'acceptance' for gap in gaps)
            or not set(result.get('qualityBlockers') or []) <= {'analysis', 'task_completion'}):
        return False
    coverage = result.get('requirementCoverage')
    if (not isinstance(coverage, list) or not coverage
            or any(not isinstance(item, dict) or not item.get('id') for item in coverage)
            or not any(item.get('status') == 'unfulfilled' for item in coverage)):
        return False
    satisfied = {item['id']: set(item.get('outputIds') or []) for item in coverage if item.get('status') == 'satisfied'}
    return all(isinstance(output, dict) and output.get('id') and output.get('label')
               and output.get('role') in {'detail', 'observation', 'total', 'breakdown'}
               and isinstance(output.get('evidence'), list) and bool(output['evidence'])
               and any(output['id'] in ids for ids in satisfied.values()) for output in outputs)


def partial_answer_matches(result, answer):
    """A body from the native turn must actually display its structured output."""
    if not observed_partial_result(result) or not isinstance(answer, str) or not answer.strip():
        return False
    # Reconstruct the deterministic partial rendering, including its warnings.
    # Merely mentioning an output label must not admit an error, an altered
    # value or a body that silently omitted uncertainty. An incompatible older
    # rendering stays unavailable rather than being guessed equivalent.
    from .generic_reader import render_generic_answer
    return any(answer.strip() == render_generic_answer(result, language).strip()
               for language in ('en', 'ar'))


def partial_uncertainty(result, answer):
    """Keep all original missing/coverage data; disclose it as historical."""
    return {'sourceResultStatus': result['result'], 'sourceAnalysisStatus': result['analysisStatus'],
            'sourceRequirementsSatisfied': False, 'sourceAnswerSHA256': sha256(answer.encode()).hexdigest(),
            'sourceMissing': deepcopy(result['missing']), 'sourceGaps': deepcopy(result['gaps']),
            'sourceQualityBlockers': deepcopy(result.get('qualityBlockers') or []),
            'sourceRequirementCoverage': deepcopy(result['requirementCoverage']),
            'unconfirmedRequirements': [{key: item[key] for key in ('id', 'kind', 'value', 'status', 'reason') if key in item}
                for item in result['requirementCoverage'] if item.get('status') != 'satisfied'],
            'presentationOnly': True, 'businessResultComplete': False}


def confirmed_context_only(context, result):
    """Do not promote the planner's explicitly unverified context into a fact."""
    unconfirmed = {item.get('kind') for item in result['requirementCoverage'] if item.get('status') != 'satisfied'}
    return {key: value for key, value in context.items()
            if key not in unconfirmed and not (key == 'filterScope' and 'filter' in unconfirmed)}

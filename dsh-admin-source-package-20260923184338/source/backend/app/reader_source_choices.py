"""Compact applicability evidence for observed multi-context source selection."""
from types import SimpleNamespace
from .reader_requirements import requirements_for, _semantic_match, _context_match
from .reader_bindings import applicable_bindings


def source_choices(task, knowledge, sources):
    facts=applicable_bindings(knowledge,sources)
    catalog={f['knowledgeBindingId']:f for f in facts}
    result=[]
    for req in requirements_for(task):
        choices=[]
        for fact in facts:
            binding=SimpleNamespace(knowledgeBindingId=fact['knowledgeBindingId'],
                sourcePath=fact['sourcePath'],fields=fact['fields'])
            for sid in fact['applicableSourceIds']:
                source=sources[sid]
                if not _semantic_match(binding,req,source,catalog):continue
                # Scope/population always need an explicit captured context;
                # the later evaluator imposes exactly the same constraint.
                if (req['kind'] in {'scope','population'} or 'contextParameters' in fact) and not _context_match(fact,source):continue
                if source.get('ready') is False or not source.get('principalScopeRef'):continue
                choices.append({'sourceId':sid,'knowledgeBindingId':fact['knowledgeBindingId'],
                    'sourcePath':fact['sourcePath'],'fields':list(fact['fields']),
                    'principalScopeRef':source['principalScopeRef']})
        result.append({'requirementId':req['id'],'kind':req['kind'],'value':req['value'],'choices':choices})
    return result


def validate_read_continuation(task, selection, choices):
    """An observed, applicable source should be read before toggling its view.

    This is a planner correction, not an automatic selection or completion.
    Named-record, ordering, explicit-view and attribute reads may require UI
    work not established by this narrow context-coverage predicate.
    """
    if (not selection.nextActions or len(task.requestedMeasures)<2 or task.recordIdentity
            or task.requestedAttributes or task.requestedOrdering or task.view):return
    requirements=requirements_for(task)
    lookup={x['requirementId']:x for x in choices}
    if not requirements or any(not lookup.get(r['id'],{}).get('choices') for r in requirements):return
    principals=[{c.get('principalScopeRef') for c in lookup[r['id']]['choices']
                 if c.get('principalScopeRef')} for r in requirements]
    if not set.intersection(*principals):return
    from .generic_reader import PipelineError
    raise PipelineError('observed_requirement_sources_not_selected','planning',details={
        'requirementSourceChoices':choices,
        'correction':'Every requested clause already has a captured source with an applicable documented context. '
            'Select the needed observed source IDs together and nextActions=[]; different measures can consume '
            'different contexts of one operation. Keep the task, membership and all filters unchanged. '
            'Do not repeat a tab/filter operation to obtain a response already captured. Source applicability '
            'is not task completion: complete pagination, field, computation and per-output validation still run.'})

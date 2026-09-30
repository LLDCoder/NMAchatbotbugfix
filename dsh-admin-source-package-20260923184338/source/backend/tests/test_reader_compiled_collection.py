import json
import pytest
from types import SimpleNamespace
from app.generic_reader import KnowledgeStore, collection_definition_proofs, bind_collection_evidence, PipelineError
from app.generic_reader_contracts import ExtractCitation
from test_reader_routing_v03 import package


@pytest.mark.parametrize('missing', [False, True])
def test_complete_physical_schema_uses_program_citations_not_model_transcription(missing):
    data = package(); record = data['records'][0]
    record['payload'] = {'sourceBinding': {'operationRef': 'GET /api/crystals', 'sourcePath': '/rows'},
        'fields': {'key': 'Entity key', 'color': 'Observed color'},
        'pagination': {'pageIndex': 'Page number', 'pageSize': 'Page size', 'rowsPath': '/rows', 'totalPath': '/total'}}
    if missing: del record['payload']['fields']['color']
    k = KnowledgeStore(); k.add({'chunks': [{'source_name': 'crystals.json', 'content': json.dumps(data)}]})
    pid = k.prompt()[0]['passages'][0]['sourceId']
    spec = SimpleNamespace(rowsPath='/rows', totalPath='/total', fields=['key','color'],
        pageField='pageIndex', sizeField='pageSize', evidence=[ExtractCitation(sourceId=pid, quote='fabricated field explanation')])
    proofs = collection_definition_proofs(k, '/work/crystals', 'GET /api/crystals', spec)
    assert bind_collection_evidence(k, spec, proofs) is (not missing)
    if missing:
        with pytest.raises(PipelineError, match='knowledge_citation_invalid'): k.cite(spec.evidence)
    else:
        assert all(not c.quote for c in spec.evidence)
        assert k.cite(spec.evidence)
        assert spec.fields == ['key','color']


def test_wrong_page_cannot_compile_away_an_invalid_quote():
    data = package(); k = KnowledgeStore(); k.add({'chunks': [{'content': json.dumps(data)}]})
    spec = SimpleNamespace(rowsPath='/rows', totalPath='/total', fields=['key'], pageField='pageIndex', sizeField='pageSize', evidence=[])
    assert not bind_collection_evidence(k, spec, collection_definition_proofs(k, '/wrong', 'GET /api/crystals', spec))


def test_grouped_count_compiles_total_from_same_distinct_population_and_localizes_label():
    from app.reader_bindings import bind_analysis_evidence
    from app.generic_reader import execute_analysis
    from test_reader_requirement_coverage import fixture
    task, plan, sources, knowledge = fixture()
    task.outputShape = 'count'
    plan.steps = [s for s in plan.steps if s.op != 'count']
    group = next(s for s in plan.steps if s.op == 'group_count')
    next(b for b in plan.requirementBindings if b.requirementId == 'measure_0').stepIds = [group.id]
    bind_analysis_evidence(plan, task, knowledge, sources, language='ar')
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']
    total = next(o for o in result['outputs'] if o['role'] == 'total')
    assert total['label'] == 'العدد الإجمالي' and total['value'] == 3
    assert plan.steps[-1].inputs == group.inputs
    bind_analysis_evidence(plan, task, knowledge, sources, language='ar')
    assert len([s for s in plan.steps if s.op == 'count']) == 1

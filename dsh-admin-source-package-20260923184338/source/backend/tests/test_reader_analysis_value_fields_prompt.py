"""Prompt-only contract and controlled projections, not a live X03 acceptance replay."""
import ast
import copy
import json
from pathlib import Path

import pytest

from app import generic_reader
from app.generic_reader import KnowledgeStore, execute_analysis, GenericKnowledgeReader
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_bindings import bind_analysis_evidence
from test_reader_generic_completion import detail_fixture
from test_projected_collection import gateway

SAVED = json.loads((Path(__file__).parent/'fixtures/analysis_value_fields_x03_v37.json').read_text())


def analysis_call():
    tree = ast.parse(Path(generic_reader.__file__).read_text())
    return next(n for n in ast.walk(tree) if isinstance(n, ast.Call)
                and isinstance(n.func, ast.Attribute) and n.func.attr=='structured'
                and n.args and isinstance(n.args[0], ast.Name) and n.args[0].id=='AnalysisPlan')


def test_existing_analysis_input_already_supplies_full_bindings_without_parallel_metadata():
    call = analysis_call()
    instruction = ast.literal_eval(call.args[1])
    assert 'retain ALL required, authorized public value fields' in instruction
    assert 'not merely in a hidden read or requirementBinding' in instruction
    assert 'Do not treat two status labels, bilingual fields or a code/display pair as interchangeable' in instruction
    assert 'binding alone does not authorize disclosure' in instruction
    assert 'preserve the missing requirement and its partial result' in instruction
    assert 'drop an original condition' in instruction
    values = {ast.literal_eval(k):v for k,v in zip(call.args[2].keys,call.args[2].values)}
    assert ast.unparse(values['semanticBindings']) == 'planning_bindings(self.knowledge, selected)'
    assert 'valueFields' not in values and 'missingProjectedFields' not in values


@pytest.mark.parametrize('language,missing', [('en','changeStatusObj.statusName'),('ar','changeStatusObj.nameEn')])
def test_actual_two_plans_omit_one_required_field_but_controlled_new_model_projection_keeps_all(language, missing):
    case = SAVED['cases'][language]
    task = TaskSpec.model_validate(case['task']); plan = AnalysisPlan.model_validate(case['plan'])
    before = copy.deepcopy((task.model_dump(),plan.model_dump()))
    binding = next(b for b in plan.requirementBindings if b.requirementId=='attribute_1')
    output = next(s for s in plan.steps if s.expose and 'timeline' in s.id)
    assert set(binding.fields)-set(output.fields)=={missing}
    assert next(c for c in case['requirementCoverage'] if c['id']=='attribute_1')['status']=='unfulfilled'
    assert case['relatedReadDefinitions'][0]['projections'][0]['fields']==sorted(binding.fields)
    # Authored model-reply example only; no production code changes this plan.
    reply=plan.model_copy(deep=True)
    final=next(s for s in reply.steps if s.id==output.id)
    final.fields=[*final.fields,missing]
    expected=plan.model_dump()
    next(s for s in expected['steps'] if s['id']==output.id)['fields'].append(missing)
    assert reply.model_dump()==expected
    assert set(binding.fields)<=set(final.fields)
    assert (task.model_dump(),plan.model_dump())==before
    assert reply.missing==plan.missing
    if language=='en':assert task.businessFocus=='transferred to another department' and reply.missing==['population_transfer_scope']
    else:assert task.businessFocus==''  # Recorded omission, never declared faithful merely by this test.
    # Full object/population proof is still absent in captured result. No full-chain success asserted.
    assert any('object' in x['requirementIds'] for x in case['withheldOutputContexts'])


def synthetic_compound_fixture(complete=False, unavailable=False):
    task,plan,sources,old=detail_fixture()
    task.requestedAttributes=['color','state']
    source=sources['detail'];source['data']['data'].update(shade='deep',state='ready')
    if unavailable:source['data']['data']['shade']=None
    source['fieldEvidence']=gateway._reader_field_evidence(source['data'],source['data'])
    record=copy.deepcopy(next(iter(old.items.values()))['record'])
    next(b for b in record['payload']['bindings'] if b['kind']=='attribute')['fields']=['color','shade']
    record['payload']['bindings'].append({'id':'state','kind':'attribute','concept':'state','fields':['state'],
        'operationRef':source['operationRef'],'sourcePath':'/data'})
    kb=KnowledgeStore();kb.add({'chunks':[{'id':'compound-fixture','content':json.dumps({'records':[record]})}]})
    ref=kb.prompt()[0]['passages'][0]['sourceId'];raw=plan.model_dump()
    for name in ['grain','population','filterScope','time']:raw['context'][name]['evidence']=[{'sourceId':ref}]
    read=raw['steps'][0];read.update(fields=['key','color','shade','state'],expose=False,evidence=[{'sourceId':ref}])
    raw['steps'].extend([{'id':'color_output','op':'project','inputs':['detail'],
        'fields':['color','shade'] if complete else ['color'],'label':'Color','role':'detail','expose':True,'evidence':[{'sourceId':ref}]},
        {'id':'state_output','op':'project','inputs':['detail'],'fields':['state'],'label':'State','role':'detail','expose':True,'evidence':[{'sourceId':ref}]}])
    raw['requirementBindings'][2]['stepIds']=['color_output']
    raw['requirementBindings'].append({'requirementId':'attribute_1','sourceId':'detail',
        'knowledgeBindingId':'specimen.detail#state','stepIds':['state_output']})
    return task,AnalysisPlan.model_validate(raw),sources,kb


@pytest.mark.parametrize('complete',[False,True])
def test_existing_local_execution_accepts_partial_and_controlled_complete_plan_without_planning_error(complete):
    task,plan,sources,kb=synthetic_compound_fixture(complete=complete)
    original_fields=next(s for s in plan.steps if s.id=='color_output').fields[:]
    bind_analysis_evidence(plan,task,kb,sources)
    analysis=execute_analysis(plan,sources,kb,[],task=task)
    coverage={c['id']:c for c in analysis['requirementCoverage']}
    assert coverage['attribute_1']['status']=='satisfied'
    assert coverage['attribute_0']['status']==('satisfied' if complete else 'unfulfilled')
    assert analysis['requirementsSatisfied'] is complete
    assert next(s for s in plan.steps if s.id=='color_output').fields==original_fields
    reader=GenericKnowledgeReader(None,None,portal_base_url='https://portal.test')
    result=reader.finish(task=task,analysis=analysis).result.public_json()
    assert next(x for x in result['outputs'] if x['id']=='state_output')['value']==[{'state':'ready'}]
    if not complete:assert 'requested_attribute_unverified' in result['missing']


def test_source_unknown_field_remains_partial_even_with_full_projection():
    task,plan,sources,kb=synthetic_compound_fixture(complete=True,unavailable=True)
    bind_analysis_evidence(plan,task,kb,sources)
    analysis=execute_analysis(plan,sources,kb,[],task=task)
    assert not analysis['requirementsSatisfied']
    color=next(x for x in analysis['outputs'] if x['id']=='color_output')
    assert 'shade' in color['unavailableFields']
    assert next(c for c in analysis['requirementCoverage'] if c['id']=='attribute_1')['status']=='satisfied'

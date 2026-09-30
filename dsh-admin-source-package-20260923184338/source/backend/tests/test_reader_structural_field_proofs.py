import pytest
from app.generic_reader import execute_analysis
from app.generic_reader_contracts import Step,RequirementBinding
from app.reader_bindings import bind_analysis_evidence
from test_reader_requirement_coverage import fixture


def setup(rogue=False):
    task,plan,sources,knowledge=fixture()
    task=task.model_copy(update={'outputShape':'list','requestedMeasures':[],'groupBy':[],'requestedAttributes':[]})
    fields=['publicNumber','phase']+(['unmappedColumn'] if rogue else [])
    for item in knowledge.items.values():
        for f in (item.get('record') or {}).get('payload',{}).get('bindings',[]):
            if f['kind']=='object':f['displayFields']=['publicNumber']
    for index,row in enumerate(sources['queue']['data']['data']['items']):
        row['publicNumber']='S-'+row['specimenKey'];row['unmappedColumn']='unsupported'
    ref=knowledge.prompt()[0]['passages'][0]['sourceId']
    plan.steps=plan.steps[:2]+[Step(id='show',op='project',inputs=['entities'],fields=fields,
        label='Specimens',role='detail',expose=True,evidence=[{'sourceId':ref}])]
    plan.steps[0].fields+=['publicNumber','unmappedColumn'] if rogue else ['publicNumber']
    plan.requirementBindings=[b for b in plan.requirementBindings if not b.requirementId.startswith(('group','measure'))]
    plan.requirementBindings.append(RequirementBinding(requirementId='detail',sourceId='queue',sourcePath='/data/items',
        fields=fields,stepIds=['show'],knowledgeBindingId='',evidence=[{'sourceId':ref}]))
    return task,plan,sources,knowledge


def test_structural_list_citations_include_actual_field_and_public_label_definitions():
    t,p,s,k=setup();bind_analysis_evidence(p,t,k,s)
    result=execute_analysis(p,s,k,[],task=t)
    assert result['requirementsSatisfied'],result['requirementCoverage']
    assert result['outputs'][0]['value']==[
        {'publicNumber':'S-a','phase':'Warm'},{'publicNumber':'S-b','phase':'Cold'},
        {'publicNumber':'S-c','phase':'Uncatalogued'}]


def test_observed_column_without_field_meaning_is_not_certified():
    t,p,s,k=setup(True);bind_analysis_evidence(p,t,k,s)
    result=execute_analysis(p,s,k,[],task=t)
    assert not result['requirementsSatisfied']
    assert next(x for x in result['requirementCoverage'] if x['id']=='detail')['status']=='unfulfilled'

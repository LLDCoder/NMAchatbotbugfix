import pytest
from app.reader_page_clarification import page_clarification
from app.generic_reader import PipelineError
from test_reader_page_clarification import fixture

@pytest.mark.parametrize('language', ['en','ar'])
@pytest.mark.parametrize('declared',[False,True])
def test_duplicate_term_resolution_preserves_other_attributes(language,declared):
    t,k,_,rule=fixture();rule.update(slot='requestedOrdering',aliases=['rank','المرتبة'],resolvesDuplicateAttributes=declared)
    t.requestedOrdering=['rank'];t.requestedAttributes=['label','rank','not rank','المرتبة','rank history'];t.businessFocus='active'
    for c,value in zip(rule['choices'],['priority','importance']):c['attributeValue']=value
    c,_=page_clarification(t,k,['/specimens'],language)
    for option,value in zip(c.options,['priority','importance']):
        updates={u.field:u.value for u in option.updates}
        assert updates.get('requestedAttributes')==(['label',value,'not rank',value,'rank history'] if declared else None)
        assert 'businessFocus' not in updates
    assert t.requestedAttributes[1]=='rank'

@pytest.mark.parametrize('fault',['absent','empty','recursive','wrong_slot'])
def test_invalid_cross_slot_definition_fails_without_silent_deletion(fault):
    t,k,_,rule=fixture();rule.update(slot='requestedOrdering',aliases=['rank'],resolvesDuplicateAttributes=True)
    t.requestedOrdering=['rank'];t.requestedAttributes=['rank'];t.businessFocus='active'
    for c in rule['choices']:c['attributeValue']='priority'
    if fault=='absent':rule['choices'][0].pop('attributeValue')
    if fault=='empty':rule['choices'][0]['attributeValue']=''
    if fault=='recursive':rule['choices'][0]['attributeValue']='rank'
    if fault=='wrong_slot':rule['slot']='requestedAttributes'
    with pytest.raises(PipelineError,match='page_clarification_definition_invalid'):
        page_clarification(t,k,['/specimens'],'ar')

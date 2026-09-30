import pytest
from app.generic_reader import render_generic_answer

@pytest.mark.parametrize('lang,phrase',[('en','applicable form version'),('ar','إصدار النموذج المنطبق')])
def test_unknown_form_version_is_explained_without_claiming_no_matching_documents(lang,phrase):
    evidence={'outputs':[{'id':'materials','label':'Materials','role':'observation','value':[],
        'evidence':[{'completeness':'bounded','unavailableReason':'form_version_unverified'}]}],
        'requirementsSatisfied':False,'missing':['form_version_unverified']}
    answer=render_generic_answer(evidence,lang)
    assert phrase in answer and 'form_version_unverified' not in answer
    assert 'No matching rows' not in answer and 'لم يتم العثور' not in answer

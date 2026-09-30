import pytest
from app.generic_reader import render_generic_answer

@pytest.mark.parametrize('language',['en','ar'])
@pytest.mark.parametrize('kind',['scope','record','object','attribute'])
def test_withholding_reason_distinguishes_scope_identity_and_semantic_evidence(language,kind):
    evidence={'withheldOutputCount':1,'outputs':[],
              'requirementCoverage':[{'kind':kind,'status':'unfulfilled'}]}
    answer=render_generic_answer(evidence,language)
    if kind=='scope':assert ('scope' if language=='en' else 'نطاق') in answer
    elif kind=='record':assert ('identity' if language=='en' else 'هوية') in answer
    else:
        assert ('field meanings' if language=='en' else 'معاني الحقول') in answer
        assert ('scope' if language=='en' else 'نطاق') not in answer
    assert ('denied' if language=='en' else 'مرفوض') not in answer

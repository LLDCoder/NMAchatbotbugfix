import copy
import pytest
from app.reader_intent_aliases import bind_domain_compositions


def facts():
 domain={'operationRef':'GET /team','sourcePath':'/rows','keyField':'id','labelField':'name'}
 base={'recordId':'page.members','operationRef':'GET /tasks','sourcePath':'/rows','fields':['ownerId']}
 return [{**base,'kind':'filter','concept':'managed team','aliases':['team I manage'],
          'knowledgeBindingId':'page.members#scope','membershipDomain':domain},
         {**base,'kind':'group','concept':'officer','aliases':['employee'],
          'knowledgeBindingId':'page.members#owner','groupDomain':copy.deepcopy(domain)}]


def apply(entries, value):
 bind_domain_compositions(entries,{'requirements':[{'id':'filter_0','kind':'filter','value':value}]})
 return entries[0].get('intentAliases',[])


@pytest.mark.parametrize('text',['officers in the team I manage','employees of the team I manage'])
def test_composed_membership_retains_two_exact_kb_definitions(text):
 result=apply(facts(),text)
 assert result and result[0]['value']==text
 assert result[0]['evidenceBindingIds']==['page.members#scope','page.members#owner']


@pytest.mark.parametrize('text',['officers not in the team I manage','officers in another team',
 'officers in the Licensing team I manage','external employees of the team I manage'])
def test_composition_does_not_drop_conditions_or_infer_business_synonyms(text):
 assert not apply(facts(),text)


@pytest.mark.parametrize('mutation',['source','domain','record'])
def test_composition_requires_same_evidence_domain(mutation):
 entries=facts()
 if mutation=='source':entries[1]['operationRef']='GET /other'
 elif mutation=='domain':entries[1]['groupDomain']['sourcePath']='/other'
 else:entries[1]['recordId']='another-page'
 assert not apply(entries,'officers in the team I manage')

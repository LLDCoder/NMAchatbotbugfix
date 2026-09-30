import copy
import pytest
from types import SimpleNamespace
from app.reader_intent_aliases import bind_translation_alternatives
from app.reader_requirements import _semantic_match


def fixture():
    fact={'kind':'attribute','concept':'assigned group','aliases':['المجموعة المعينة'],
          'operationRef':'GET /items','sourcePath':'/item','fields':['groupName']}
    context={'question':'اعرض الاسم والمجموعة المعينة.','requirements':[{'id':'attribute_1','kind':'attribute','value':'assigned badge/group'}],
             'terms':[{'requirementId':'attribute_1','sourceText':'assigned badge/group','english':'assigned badge/group','arabic':'المجموعة المعينة'}]}
    return [fact],context


def test_literal_page_alias_can_narrow_only_an_explicit_translation_alternative():
    facts,ctx=fixture();before=copy.deepcopy(ctx)
    bind_translation_alternatives(facts,ctx)
    assert facts[0]['intentAliases'][0]['resolvedAlias']=='assigned group'
    assert ctx==before
    binding=SimpleNamespace(knowledgeBindingId='fact',sourcePath='/item',fields=['groupName'])
    assert _semantic_match(binding,ctx['requirements'][0],{'operationRef':'GET /items'},{'fact':facts[0]})
    assert not _semantic_match(binding,{**ctx['requirements'][0],'id':'attribute_0'},
                               {'operationRef':'GET /items'},{'fact':facts[0]})


@pytest.mark.parametrize('change',['not_literal','different_alias','different_meaning','qualifier','filter','ambiguous','not_alternative','changed_source'])
def test_alias_resolution_cannot_invent_equivalence_or_drop_qualifiers(change):
    facts,ctx=fixture()
    if change=='not_literal':ctx['question']='اعرض الاسم فقط.'
    if change=='different_alias':facts[0]['aliases']=['حقل آخر']
    if change=='different_meaning':facts[0]['concept']='assigned owner'
    if change=='qualifier':
        ctx['requirements'][0]['value']='assigned badge/group excluding temporary'
        ctx['terms'][0]['sourceText']=ctx['requirements'][0]['value']
    if change=='filter':ctx['requirements'][0]['kind']='filter'
    if change=='ambiguous':facts.append({**facts[0],'concept':'assigned badge'})
    if change=='not_alternative':ctx['requirements'][0]['value']=ctx['terms'][0]['sourceText']='assigned badge'
    if change=='changed_source':ctx['terms'][0]['sourceText']='unrelated property'
    bind_translation_alternatives(facts,ctx)
    assert not any(f.get('intentAliases') for f in facts)


def count_fixture():
    fact={'kind':'measure','concept':'count of queued parcels',
        'aliases':['الطرود المنتظرة'], 'operator':'count',
        'operationRef':'GET /parcels','sourcePath':'/data/items','fields':['id']}
    ctx={'question':'لخّص الطرود المنتظرة حسب الموظف.',
        'requirements':[{'id':'measure_0','kind':'measure','value':'count of queued/suspended parcels'}],
        'terms':[{'requirementId':'measure_0','sourceText':'count of queued/suspended parcels',
                 'english':'count of queued/suspended parcels','arabic':'عدد الطرود المنتظرة/الموقوفة'}]}
    return [fact],ctx


def test_count_translation_uses_same_page_literal_alias_and_does_not_rewrite_request():
    facts,ctx=count_fixture();before=copy.deepcopy(ctx)
    bind_translation_alternatives(facts,ctx)
    assert ctx==before
    assert facts[0]['intentAliases'][0]['resolvedAlias']=='count of queued parcels'
    assert facts[0]['intentAliases'][0]['originalQuote']=='الطرود المنتظرة'


@pytest.mark.parametrize('change',['no_literal','other_meaning','qualifier','non_count','scope','conflict','substring'])
def test_count_alias_proof_cannot_change_population_or_choose_between_documented_meanings(change):
    facts,ctx=count_fixture()
    if change=='no_literal':ctx['question']='لخّص الطرود.'
    if change=='other_meaning':facts[0]['concept']='count of cancelled parcels'
    if change=='qualifier':
        ctx['requirements'][0]['value'] += ' excluding returned'
        ctx['terms'][0]['sourceText']=ctx['requirements'][0]['value']
    if change=='non_count':facts[0]['operator']='sum'
    if change=='scope':ctx['requirements'][0]['kind']='scope'
    if change=='conflict':facts.append({**facts[0],'concept':'count of suspended parcels'})
    if change=='substring':facts[0]['aliases']=['منتظرة']
    bind_translation_alternatives(facts,ctx)
    assert not any(f.get('intentAliases') for f in facts)

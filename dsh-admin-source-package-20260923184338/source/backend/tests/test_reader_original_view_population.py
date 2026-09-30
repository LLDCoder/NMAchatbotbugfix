import copy
from types import SimpleNamespace
import pytest
from app.reader_requirements import _semantic_match, semantic_bindings


def fixture():
    base={'operationRef':'POST /api/Parcel/MyQueue','sourcePath':'/data/items','fields':['id']}
    records=[{'id':'facts','kind':'field_semantics','status':'active','revision':2,'payload':{
        'pageRef':'/customs/parcels','view':'queue','bindings':[
            {**base,'id':'population','kind':'population','concept':'pending','aliases':['قائمة المعالجة'],'contextParameters':{'keyword':''}},
            {**base,'id':'scope','kind':'scope','concept':'personal','aliases':['my'],'contextParameters':{'keyword':''}},
            {**base,'id':'object','kind':'object','concept':'parcel'}]}},
        {'id':'page','kind':'page_definition','status':'active','revision':3,'payload':{
            'pageIdentity':{'route':'/customs/parcels'},'routing':{'views':[{'id':'queue','label':'Queue','aliases':['قائمة المعالجة']}]}}}]
    context={'question':'اعرض الطرود في قائمة المعالجة الخاصة بي.',
        'requirements':[{'id':k,'kind':k,'value':v}for k,v in [('object','parcel'),('scope','personal'),('view','queue'),('population','in processing')]],
        'terms':[{'requirementId':'population','sourceText':'in processing','english':'in processing','arabic':'قائمة المعالجة'}]}
    source={'operationRef':base['operationRef'],'sourceViewProof':{'page':'/customs/parcels','view':'queue','authority':'active_page_operation_context','definitions':[
        {'recordId':'facts','revision':2,'view':'queue','operationRef':base['operationRef'],'sourcePath':base['sourcePath'],'contextBindingIds':['facts#population']}]}}
    return records,context,source


def evaluate(records,context,source):
    kb=SimpleNamespace(items={str(i):{'record':r,'documentId':str(i)}for i,r in enumerate(records)},intent_lexical_context=context)
    facts={f['knowledgeBindingId']:f for f in semantic_bindings(kb)}
    binding=SimpleNamespace(knowledgeBindingId='facts#population',sourcePath='/data/items',fields=['id'])
    req=next(r for r in context['requirements']if r['id']=='population')
    return _semantic_match(binding,req,source,facts),facts.get('facts#population',{})


def test_unproven_canonical_translation_cannot_become_a_population_fact():
    records,context,source=fixture();before=copy.deepcopy(context)
    result,fact=evaluate(records,context,source)
    assert not result and context==before
    assert not fact.get('intentAliases')
    # A literal native requirement already defined by the active fact remains
    # supported. No English translation equivalence is inferred from this.
    next(r for r in context['requirements']if r['id']=='population')['value']='قائمة المعالجة'
    assert evaluate(records,context,source)[0]


@pytest.mark.parametrize('prefix',['status ','state ','status = ','not ','without ','except ','الحالة ','حالة ','وحالتها ','ليس ','وليس ','غير ','باستثناء '])
def test_explicit_predicate_or_negation_does_not_use_native_view_bridge(prefix):
    records,context,source=fixture();context['question']=prefix+context['question']
    assert not evaluate(records,context,source)[0]


@pytest.mark.parametrize('change',['scope','object','view','missing_quote','changed_qe_anchor','changed_qe_translation','inactive_view','conflicting_view','missing_population_alias','source_page','source_view','source_authority','source_record','source_revision','source_operation','source_path','source_context_binding','missing_source_proof','extra_population_predicate'])
def test_exact_page_scope_definition_and_actual_source_proof_required(change):
    records,context,source=fixture()
    if change in {'scope','object','view'}:
        next(r for r in context['requirements']if r['id']==change)['value']='other'
    elif change=='missing_quote':context['question']='Show my parcels in processing.'
    elif change=='changed_qe_anchor':context['terms'][0]['sourceText']='pending'
    elif change=='changed_qe_translation':context['terms'][0]['english']='ready'
    elif change=='inactive_view':records[1]['status']='inactive'
    elif change=='conflicting_view':records.append(copy.deepcopy(records[1]));records[-1]['revision']=4
    elif change=='missing_population_alias':records[0]['payload']['bindings'][0]['aliases']=[]
    elif change.startswith('source_'):
        key=change.removeprefix('source_');proof=source['sourceViewProof']
        if key in {'page','view','authority'}:proof[key]='other'
        else:
            key={'record':'recordId','revision':'revision','operation':'operationRef','path':'sourcePath','context_binding':'contextBindingIds'}[key]
            proof['definitions'][0][key]=[] if key=='contextBindingIds' else 'other'
    elif change=='missing_source_proof':source.pop('sourceViewProof')
    elif change=='extra_population_predicate':
        next(r for r in context['requirements']if r['id']=='population')['value']='in processing and approved'
        context['terms'][0].update(sourceText='in processing and approved',english='in processing and approved')
    assert not evaluate(records,context,source)[0]


@pytest.mark.parametrize('value',['overdue in processing','urgent in processing','in processing only','all in processing','in-processing-urgent'])
def test_native_quote_does_not_erase_canonical_qualifiers(value):
    records,context,source=fixture()
    next(r for r in context['requirements']if r['id']=='population')['value']=value
    context['terms'][0].update(sourceText=value,english=value)
    before=copy.deepcopy(context)
    assert not evaluate(records,context,source)[0]
    assert context==before

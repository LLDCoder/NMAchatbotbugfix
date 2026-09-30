import asyncio

from app.generic_reader import GenericKnowledgeReader, KnowledgeStore
from app.reader_knowledge_selection import split_passages
from app.generic_reader_contracts import Citation
from app.principal import Principal
from test_reader_retrieval_coverage import chunk, coverage_fixture
from test_generic_reader_v3 import Gateway


def test_late_relevant_document_is_selected_before_unrelated_early_documents():
    store = KnowledgeStore()
    for i in range(50):
        store.add({'chunks': [chunk('noise'+str(i), 0, 'Technical index and deployment configuration.')]})
    store.add({'chunks': [chunk('policy', 4,
        'Separate read models may display different states; no synchronization interval is established.', 'Read views.md')]})
    prompt = store.prompt(queries=['Why do separate read models display different states?'])
    assert any(d['documentId'] == 'policy' for d in prompt)
    assert len(prompt) == 32
    assert store.last_selection['poolItems'] == 51
    assert store.last_selection['excludedItems'] == 19
    assert {e['reason'] for e in store.last_selection['excludedSample']} == {'context_budget'}


def test_relevant_section_after_old_16000_character_cut_is_addressable():
    store = KnowledgeStore()
    text = ('Unrelated installation settings.\n' * 650) + '\nSpecimen restoration requires an applicable expiry policy.\n'
    store.add({'chunks': [chunk('long', 1, text)]})
    prompt = store.prompt(queries=['Specimen restoration expiry policy'])
    passages = prompt[0]['passages']
    target = next(p for p in passages if 'Specimen restoration' in p['text'])
    assert target['sourceStart'] > 16000
    assert sum(len(p['text']) for p in passages) <= 5000
    assert text[target['sourceStart']:target['sourceEnd']] == target['text']
    ref = Citation(sourceId=target['sourceId'])
    store.cite([ref], required=True)
    prior = store.citation_text(ref)
    store.prompt(queries=['installation settings'], required_source_ids=[ref.sourceId])
    assert store.citation_text(ref) == prior
    assert any(p['sourceId'] == ref.sourceId for d in store.last_selection['inputs'] for p in d['passages'])


def test_split_offsets_reconstruct_full_text_including_long_line():
    text = 'Prefix\n' + 'x'*3501 + '\nTail'
    segments = split_passages(text)
    assert ''.join(t for _, _, t in segments) == text
    assert all(text[start:end] == part and len(part) <= 1000 for start, end, part in segments)


def test_independent_requirements_retain_different_sources_and_conflicting_rules():
    store = KnowledgeStore()
    for i in range(35):
        store.add({'chunks': [chunk('a'+str(i), 0, 'Specimen eligibility and applicability.') ]})
    store.add({'chunks': [chunk('b', 0, 'Certificate expiry rules include suspended certificates.')]})
    store.add({'chunks': [chunk('c', 0, 'Certificate expiry rules exclude suspended certificates.')]})
    prompt = store.prompt(queries=['Specimen eligibility', 'Certificate expiry suspended'])
    assert {'b', 'c'} <= {d['documentId'] for d in prompt}


def test_stage_audit_identifies_actual_supplied_passages():
    task, knowledge, refs, data = coverage_fixture()
    class Planner:
        inputs = []
        async def generic_reader_json(self, **kwargs):
            self.inputs.append(kwargs['data'])
            return data
    planner = Planner()
    reader = GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test')
    reader.knowledge = knowledge
    import time
    reader.deadline = time.monotonic()+60
    reader.secrets = ()
    asyncio.run(reader.check_knowledge(Principal('person', 'tenant', 'req'), task))
    manifests = reader.audit['knowledgeInputs']
    assert len(manifests) == len(planner.inputs)
    for audit, sent in zip(manifests, planner.inputs):
        assert {p['sourceId'] for d in audit['inputs'] for p in d['passages']} == {
            p['sourceId'] for d in sent['knowledge'] for p in d['passages']}
        assert all(len(p['sha256']) == 64 for d in audit['inputs'] for p in d['passages'])

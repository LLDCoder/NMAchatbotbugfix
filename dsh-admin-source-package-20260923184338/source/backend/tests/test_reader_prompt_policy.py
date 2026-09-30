"""Integration checks for the runtime language policy, not business aliases."""
import asyncio
import copy
import time

import pytest

from app.generic_reader import GenericKnowledgeReader, validate_selection
from app.generic_reader_contracts import SourceSelection
from app.reader_prompt_policy import PROMPT_POLICY_VERSION, stage_language_policy
from app.service import DSHService
from test_generic_reader_v3 import Gateway, store, reference


@pytest.mark.parametrize('question,language,arabic_expected', [
    ('اعرض السجل AB-407 باستثناء العناصر المغلقة.', 'ar', True),
    ('Show AB-407; answer in Arabic.', 'ar', True),
    ('اعرض السجل AB-407 وأجب بالإنجليزية.', 'en', True),
    ('Show AB-407, excluding closed items.', 'en', False),
    ('Which required documents are missing from this application?', 'en', False),
    ('ما الوثائق المطلوبة الناقصة لهذا الطلب؟', 'ar', True),
    ('Give me all customer contact details linked to this ticket.', 'en', False),
    ('اعرض بيانات العميل المرتبط بالتذكرة.', 'ar', True),
])
def test_policy_survives_correction_and_uses_runtime_language(question, language, arabic_expected):
    knowledge = store()
    responses = [dict(stage='source_selection', sourceIds=['forged'], rationale=[reference(knowledge)], missing=[]),
                 dict(stage='source_selection', sourceIds=['liveRows'], rationale=[reference(knowledge)], missing=[])]
    class CapturePlanner:
        def __init__(self):
            self.calls = []
        async def generic_reader_json(self, **kwargs):
            self.calls.append(copy.deepcopy(kwargs))
            return responses[len(self.calls)-1]
    async def run():
        planner = CapturePlanner()
        reader = GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test')
        reader.current_question = question
        reader.canonical_question = 'Show AB-407, excluding closed items.'
        reader.response_language = language
        reader.knowledge = knowledge
        reader.deadline = time.monotonic() + 30
        sources = {'liveRows': {'field': 'recordCode', 'value': 'AB-407'}}
        result = await reader.structured(SourceSelection, 'Select an observed source.',
            {'responseLanguage': 'wrong-upstream-language', 'pageState': {'controls': [{'name': 'Search'}]},
             'sources': sources}, lambda p: validate_selection(p, sources, knowledge))
        return reader, planner, result
    reader, planner, result = asyncio.run(run())
    assert result.sourceIds == ['liveRows']
    assert len(planner.calls) == 2  # Unobserved source still fails; language policy cannot weaken validation.
    first, repair = planner.calls
    assert first['instruction'] == repair['instruction']
    assert repair['correction'] and not first['correction']
    assert first['data']['responseLanguage'] == language
    assert first['data']['originalQuestion'] == question
    assert first['data']['sources']['liveRows']['value'] == 'AB-407'
    assert first['data']['pageState']['controls'][0]['name'] == 'Search'
    assert ('دعم العربية' in first['instruction']) is arabic_expected
    assert reader.audit['promptInvocations'][0]['policyVersion'] == PROMPT_POLICY_VERSION
    assert len(reader.audit['promptInvocations'][0]['instructionFingerprint']) > 10
    assert 'originalQuestion' not in reader.audit['promptInvocations'][0]


def test_language_transition_does_not_translate_machine_contract_or_leak_prior_question():
    ar = stage_language_policy('AnalysisPlan', 'ar', 'كم عددها؟')
    en = stage_language_policy('AnalysisPlan', 'en', 'How many are there?')
    assert 'كم عددها' not in en
    assert 'دعم العربية' in ar and 'دعم العربية' not in en
    # The common semantic/evidence contract is the same; Arabic adds comprehension, not authorization.
    assert ar.startswith(en)


def test_runtime_presentation_keeps_arabic_output_separate_from_source_facts():
    prompt = DSHService._runtime_system_prompt('admin_portal_reader', 'ar', '', '')
    assert 'Required response language: ARABIC' in prompt
    assert 'اكتب بالعربية الفصحى' in prompt
    assert 'quoted labels, literal source values, identifiers and links exact' in prompt
    assert 'Do not invent records, counts, permissions, policies, links, or sources.' in prompt

import pytest

from app.portal_reader import question_is_conceptual, knowledge_supports_result, knowledge_fact_evidence, ReaderResult


def test_repeated_manual_fields_keep_their_own_section_and_page():
    context = {'ok': True, 'chunks': [{'content': '## Semantic node: Alpha - **section:** Alpha - **page:** `/alpha` '
        '- **meaning:** Alpha records show the original request. - **content:** Reference; Status. '
        '## Semantic node: Beta - **section:** Beta - **page:** `/beta` '
        '- **meaning:** Beta records show the final decision. - **content:** Decision; Reviewer.'}]}
    evidence = knowledge_fact_evidence(context)
    alpha = [item for item in evidence if item['section'] == 'Alpha']
    beta = [item for item in evidence if item['section'] == 'Beta']
    assert any(item['text'] == 'Reference; Status.' for item in alpha)
    assert any(item['text'] == 'Decision; Reviewer.' for item in beta)
    assert all(item['page'] == '`/alpha`' for item in alpha)
    assert all(item['page'] == '`/beta`' for item in beta)
    assert knowledge_supports_result(ReaderResult(status='success', summary='', facts=(
        'Alpha records show the original request.',)), context)
    assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=(
        'Alpha content: Decision; Reviewer.',)), context)


def test_control_distinction_does_not_overwrite_the_parent_business_distinction():
    context = {'ok': True, 'chunks': [{'content': '## Semantic node: Work - **section:** Work - **page:** `/work` '
        '- **distinguish_from:** Queue membership does not prove personal assignment. '
        '### Control: Search - **name:** Search - **distinguish_from:** The Apply button.'}]}
    fact = 'Queue membership does not prove personal assignment.'
    assert any(item['text'] == fact for item in knowledge_fact_evidence(context))
    assert knowledge_supports_result(ReaderResult(status='success', summary='', facts=(fact,)), context)
    assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=(
        'Queue membership proves personal assignment.',)), context)


def test_a_compound_fact_cannot_join_independent_semantic_sections():
    context = {'ok': True, 'chunks': [{'content': '## Semantic node: Alpha - **meaning:** Alpha has 12 records. '
        '## Semantic node: Beta - **meaning:** Beta has 29 records.'}]}
    assert knowledge_supports_result(ReaderResult(status='success', summary='', facts=('Alpha has 12 records.',)), context)
    assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=(
        'Alpha has 12 records; Beta has 29 records.',)), context)
from test_admin_portal_reader import Gateway, Planner, run_reader


@pytest.mark.parametrize('question', [
    'What information differs between the Books and Movies lists?',
    'Does Completed mean each row has a status literally named Completed?',
    'Does Fine Amount tell me what was paid, or does it only establish a fine?',
    'Do these figures alone prove which record I must approve?',
    'Does the empty search prove the account never existed?',
    'Can an Account ID alone identify a specific profile?',
    'What does Operational Insights measure?',
    'What does this report cover?',
    'What date and member criteria are available in that view?',
    'Which filters are supported on this list?',
    'How is a violation record different from an inspection task?',
    'How are Account ID and Media File No. related on these profile records?',
    'Why does one list show Assigned Time and the other Last Update?',
    'Does Fine Amount tell me how much has actually been collected?',
    'Are Appeal No. and Violation No. the same identifier?',
    'Can you confirm a task was deleted just because this search found nothing?',
    'What information does Team Performance provide?',
])
def test_business_meaning_questions_are_conceptual(question):
    assert question_is_conceptual(question)


@pytest.mark.parametrize('question', [
    'Show three completed records.',
    'How many members are in this team?',
    'Find task REF-123.',
    'Is case REF-123 completed?',
])
def test_live_record_requests_are_not_conceptual(question):
    assert not question_is_conceptual(question)


@pytest.mark.parametrize('context', [None, {'resolvedIntent': {'slots': {
    'recordIdentity': {'source': 'previous', 'value': 'REF-123', 'evidence': 'REF-123'},
    'view': {'source': 'previous', 'value': 'Completed', 'evidence': 'Completed'},
}}}])
def test_evidence_limit_question_does_not_request_an_individual_decision(context):
    fact = 'Aggregate figures do not prove which individual record requires approval.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'answerShape': 'detail',
                       'facts': [fact], 'missing': []})
    outcome = run_reader(gateway, planner, question='Can these figures alone prove which individual record I must approve?',
                         conversation_context=context)
    assert outcome.result.status == 'success'
    assert not any(call[0] == 'admin.portal.read' for call in gateway.calls)


def test_explicit_record_identity_still_requires_live_evidence():
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': 'A recorded approval is required.'}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'answerShape': 'detail',
                       'facts': ['A recorded approval is required.'], 'missing': []},
                      {'mode': 'knowledge_only', 'result': 'not_confirmed', 'facts': [], 'missing': ['record_read_required']})
    outcome = run_reader(gateway, planner, question='Does REF-123 prove approval?',
                         conversation_context={'resolvedIntent': {'slots': {
                             'recordIdentity': {'source': 'current', 'value': 'REF-123', 'evidence': 'REF-123'},
                         }}})
    assert outcome.result.status != 'success'
    assert planner.calls[1][2]['planningDirective']['requirePortalRead'] is True


def test_flattened_manual_fields_retain_separate_polarity_and_verbatim_evidence():
    content = ('## Semantic node: Example - **meaning:** An aggregated comparison of permit categories. '
               '- **distinguish_from:** These summaries do not establish individual approval. '
               '- **content:** Issued; Active; Expired.')
    context = {'ok': True, 'chunks': [{'content': content}]}
    evidence = knowledge_fact_evidence(context)
    assert evidence[0]['text'] == 'An aggregated comparison of permit categories.'
    assert knowledge_supports_result(ReaderResult(status='success', summary='', facts=(evidence[0]['text'],)),context)
    assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=('These summaries establish individual approval.',)),context)


def test_source_named_subject_can_introduce_its_exact_meaning():
    context = {'ok': True, 'chunks': [{'content': '## Semantic node: Example Analytics - **section:** Example Analytics '
        '- **meaning:** A category-level comparison of issuance, lifecycle state, geography, and user types. '
        '- **evidence_limits:** Aggregate figures do not establish an approval decision.'}]}
    result = ReaderResult(status='success', summary='', facts=(
        'Example Analytics is a category-level comparison of issuance, lifecycle state, geography, and user types.',
        'Aggregate figures do not establish an approval decision.',
    ))
    assert knowledge_supports_result(result,context)
    assert any(row['field']=='evidence_limits' for row in knowledge_fact_evidence(context))


def test_declared_knowledge_field_label_can_qualify_its_own_content():
    context = {'ok': True, 'chunks': [{'content':
        '## Semantic node: Catalog - **field_distinctions:** Edition and Print Year are separate fields. '
        'An edition value is not a year. The category schemas must not be merged. '
        '- **meaning:** A list of published records.'}]}
    result = ReaderResult(status='success', summary='', facts=(
        'field_distinctions: Edition and Print Year are separate fields. An edition value is not a year. '
        'The category schemas must not be merged.',))
    assert knowledge_supports_result(result, context)
    for fact in ('field_distinctions: An edition value is a year.',
                 'meaning: Edition and Print Year are separate fields.'):
        assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=(fact,)), context)


def test_declared_subject_and_field_can_qualify_only_their_own_content():
    context = {'ok': True, 'chunks': [{'content': '## Semantic node: Catalog list - **section:** Catalog '
        '- **content:** Reference No.; Amount; Status. - **meaning:** Published entries.'}]}
    for fact in ('Catalog list content: Reference No.; Amount; Status.', 'Catalog content: Reference No.; Amount; Status.'):
        assert knowledge_supports_result(ReaderResult(status='success', summary='', facts=(fact,)), context)
    for fact in ('Other list content: Reference No.; Amount; Status.', 'Catalog meaning: Reference No.; Amount; Status.'):
        assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=(fact,)), context)


def test_failed_grounding_retains_only_supported_facts_without_claiming_completion():
    fact = 'Reference No. and Source Task identify separate business objects.'
    invented = 'All records are automatically approved.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'answerShape': 'detail',
        'facts': [fact, invented], 'missing': []},
        {'mode': 'knowledge_only', 'result': 'not_confirmed', 'facts': [], 'missing': ['unsupported']})
    outcome = run_reader(gateway, planner, question='Explain the distinction between Reference No. and Source Task.')
    assert outcome.result.status == 'not_confirmed'
    assert outcome.result.facts == (fact,)
    assert outcome.result.missing == ('knowledge_not_grounded',)
    assert not any(call[0] == 'admin.portal.read' for call in gateway.calls)


def test_fact_evidence_preserves_node_context_and_prioritizes_requested_section():
    context = {'ok': True, 'chunks': [
        {'content': '- **section:** Catalog - **page:** `/catalog` - **meaning:** Published records.'},
        {'content': '- **section:** Team Performance - **page:** `/reports` - **meaning:** Member-level comparison.'},
    ]}
    evidence = knowledge_fact_evidence(context, 'What information does Team Performance provide?')
    assert evidence[0] == {'chunkIndex': 1, 'section': 'Team Performance', 'page': '`/reports`',
                           'field': 'meaning', 'text': 'Member-level comparison.'}
    assert not knowledge_supports_result(ReaderResult(status='success', summary='', facts=('`/reports`',)), context)


def test_conceptual_followup_does_not_force_live_read_from_inherited_view():
    fact = 'Queue membership does not prove personal ownership.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'answerShape': 'detail',
                       'facts': [fact], 'missing': []})
    outcome = run_reader(gateway, planner, question='Does queue membership prove personal ownership?',
                         conversation_context={'resolvedIntent': {'slots': {
                             'view': {'source': 'previous', 'value': 'Completed', 'evidence': 'Completed'},
                             'answerShape': {'source': 'current', 'value': 'detail', 'evidence': 'Does'},
                         }}})
    assert outcome.result.status == 'success'
    assert outcome.audit_evidence['stage'] == 'knowledge_only'
    assert not any(call[0] == 'admin.portal.read' for call in gateway.calls)


def test_available_criteria_followup_uses_manual_without_reading_member_rows():
    fact = 'Select Team Member and start/end date criteria are both available.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'answerShape': 'overview',
                       'facts': [fact], 'missing': []})
    outcome = run_reader(gateway, planner, question='What date and member criteria are available in that view?',
                         conversation_context={'resolvedIntent': {'slots': {
                             'view': {'source': 'previous', 'value': 'Team Members', 'evidence': 'Team Members'},
                             'answerShape': {'source': 'current', 'value': 'overview', 'evidence': 'What criteria'},
                         }}})
    assert outcome.result.status == 'success'
    assert not any(call[0] == 'admin.portal.read' for call in gateway.calls)


def test_grounded_explanation_can_fill_unspecified_presentation_shape():
    fact = 'An empty successful query is different from a failed query.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'facts': [fact], 'missing': []})
    outcome = run_reader(gateway, planner, question='What is the difference between an empty query and a failed query?',
                         conversation_context={'resolvedIntent': {'slots': {
                             'answerShape': {'source': 'current', 'value': 'detail', 'evidence': 'difference'},
                         }}})
    assert outcome.result.status == 'success'
    assert outcome.result.answer_shape == 'detail'
    assert outcome.result.facts == (fact,)
    assert len(planner.calls) == 1


@pytest.mark.parametrize('question', [
    'How is a request record different from an event record?',
    'How are Request ID and Event No. related on these records?',
    'Why does one list show Received Time and the other Last Update?',
    'Does Amount tell me how much has actually been collected?',
    'Are Request No. and Event No. the same identifier?',
    'Can you confirm a record was deleted just because this search found nothing?',
    'What information does Team Performance provide?',
])
def test_documented_field_semantics_do_not_replay_previous_query(question):
    fact = 'The documented fields describe separate concepts.'
    gateway = Gateway(knowledge_result={'ok': True, 'result': {'chunks': [{'content': fact}]}})
    planner = Planner({'mode': 'knowledge_only', 'result': 'success', 'answerShape': 'detail',
                       'facts': [fact], 'missing': []})
    outcome = run_reader(gateway, planner, question=question,
                         conversation_context={'resolvedIntent': {'slots': {
                             'view': {'source': 'previous', 'value': 'Completed', 'evidence': 'Completed'},
                             'answerShape': {'source': 'current', 'value': 'detail', 'evidence': question},
                         }}})
    assert outcome.result.status == 'success'
    assert not any(call[0] == 'admin.portal.read' for call in gateway.calls)

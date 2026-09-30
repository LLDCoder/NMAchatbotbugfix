import pytest

from app.generic_reader import PipelineError
from app.reader_guidance import guidance_task
from app.reader_knowledge_coverage import KnowledgeCoverage, knowledge_requirements, validate_coverage
from app.reader_answers import AnswerBlockCheck, validate_answer_review
from test_reader_context_v3 import task
from test_reader_answer_acceptance import fixture


class Citations:
    def cite(self, evidence, **kwargs):
        return []


@pytest.mark.parametrize('gap', ['current_record', 'current_eligibility', 'unrequested_extension'])
def test_static_coverage_cannot_fail_for_live_or_unrequested_requirements(gap):
    t = guidance_task(task(readOnly=False, needsLiveData=True), 'Change the selected item.')
    p = KnowledgeCoverage(stage='knowledge_coverage', checks=[
        {'requirementId': r['id'], 'status': 'partial', 'reason': 'Current eligibility is unknown.',
         'missingEvidenceType': gap} for r in knowledge_requirements(t)])
    with pytest.raises(PipelineError, match='knowledge_gap_outside_task_scope'):
        validate_coverage(p, t, Citations())
    assert all(c.status == 'partial' for c in p.checks)  # Never force a pass.


@pytest.mark.parametrize('gap', ['business_definition', 'procedure_step', 'applicability_rule', 'requested_policy'])
def test_real_missing_policy_remains_incomplete_for_static_answers(gap):
    t = guidance_task(task(readOnly=False), 'Change the item without the stated condition.')
    p = KnowledgeCoverage(stage='knowledge_coverage', checks=[
        {'requirementId': r['id'], 'status': 'partial', 'reason': 'The requested condition is undocumented.',
         'missingEvidenceType': gap} for r in knowledge_requirements(t)])
    validate_coverage(p, t, Citations())
    assert all(c.status == 'partial' for c in p.checks)


def test_live_task_keeps_current_eligibility_gap():
    t = task(needsLiveData=True)
    p = KnowledgeCoverage(stage='knowledge_coverage', checks=[
        {'requirementId': r['id'], 'status': 'partial', 'reason': 'Current eligibility is unknown.',
         'missingEvidenceType': 'current_eligibility'} for r in knowledge_requirements(t)])
    validate_coverage(p, t, Citations())
    assert all(c.status == 'partial' for c in p.checks)


def test_reviewer_cannot_accept_a_static_example_as_a_current_record_fact():
    from app.reader_answers import AnswerBlock, KnowledgeAnswerDraft, verified_answer_blocks
    t, prior, review, quotes = fixture()
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[AnswerBlock(
        id='historical_example', text='A historical example is claimed to be current.',
        requirementIds=[c.requirementId for c in review.checks], quoteIndexes=[0])])
    review.blockChecks = [AnswerBlockCheck(blockId='historical_example', supported=True,
        languageMatches=True, customerFacing=True, containsUnverifiedRecordFacts=True,
        reason='A manual example with the same identifier was copied into this answer.')]
    validate_answer_review(review, t, quotes, prior, draft.blocks)
    assert not review.blockChecks[0].supported
    assert not verified_answer_blocks(draft, review)
    assert all(c.status != 'covered' for c in review.checks)


@pytest.mark.parametrize('prose', [
    'Resolve the workflow task identifier before opening the page.',
    'The workflow task is a separate identifier.',
    'The workflow task is identified separately.',
    'The form submits through the confirmation handler.',
    'افتح الصفحة باستخدام معرّف مهمة سير العمل.',
    'صفحة التفاصيل تتطلب معرّف مهمة السجل، لذا لا تستخدم كرابط مستقل.',
])
def test_internal_identifier_resolution_is_not_customer_navigation(prose):
    from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft
    t, _, review, quotes = fixture()
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation', 'text': prose,
        'requirementIds': [review.checks[0].requirementId], 'quoteIndexes': [0]}])
    with pytest.raises(PipelineError, match='knowledge_answer_implementation_text'):
        validate_answer_draft(draft, t, quotes)


def test_every_covered_supporting_passage_reaches_answer_not_just_the_first():
    from app.reader_answers import complete_coverage_quotes
    class Knowledge(Citations):
        def citation_text(self, c):
            return {'step': 'Use the documented form.', 'condition': 'Only when the action is available.'}[c.sourceId]
        def source(self, c):
            return {'sourceName': 'Page definition'}
    coverage = [{'requirementId': 'next_step', 'status': 'covered',
        'evidence': [{'sourceId': 'step'}, {'sourceId': 'condition'}]}]
    result = complete_coverage_quotes([], coverage, Knowledge())
    assert [q['sourceId'] for q in result] == ['step', 'condition']
    assert complete_coverage_quotes(result, coverage, Knowledge()) == result
    with pytest.raises(PipelineError, match='knowledge_answer_evidence_budget_exceeded'):
        complete_coverage_quotes([], coverage, Knowledge(), max_quotes=1)


@pytest.mark.parametrize('fault', ['missing_point', 'unlinked_point', 'unanswered_point', 'none'])
def test_required_business_condition_must_be_in_actual_answer(fault):
    from app.reader_answers import AnswerBlock, AnswerPointCheck
    t, prior, review, quotes = fixture()
    rid = review.checks[0].requirementId
    prior[0]['requiredPoints'] = ['Use the documented form.', 'The stated precondition must hold.']
    block = AnswerBlock(id='steps', text='Use the documented form when the precondition holds.',
        requirementIds=[rid], quoteIndexes=[0])
    review.blockChecks = [AnswerBlockCheck(blockId='steps', supported=True, languageMatches=True,
        customerFacing=True, reason='Supported conditional procedure.')]
    review.checks[0].pointChecks = [AnswerPointCheck(pointIndex=i, covered=True,
        answerBlockIds=['steps'], reason='The actual text states this point.') for i in range(2)]
    if fault == 'missing_point':
        review.checks[0].pointChecks.pop()
        with pytest.raises(PipelineError, match='knowledge_answer_points_incomplete'):
            validate_answer_review(review, t, quotes, prior, [block])
        return
    if fault == 'unlinked_point': review.checks[0].pointChecks[1].answerBlockIds = ['uncited_block']
    if fault == 'unanswered_point': review.checks[0].pointChecks[1].covered = False
    validate_answer_review(review, t, quotes, prior, [block])
    assert (review.checks[0].status == 'covered') == (fault == 'none')


def test_review_can_link_an_existing_cited_statement_without_rewriting_it():
    from app.reader_answers import AnswerBlock, AnswerPointCheck
    t, prior, review, quotes = fixture()
    rid = review.checks[0].requirementId; other = review.checks[1].requirementId
    prior[0]['requiredPoints'] = ['The stated condition applies.']
    block = AnswerBlock(id='scope', text='The stated condition applies.', requirementIds=[other], quoteIndexes=[0])
    review.blockChecks = [AnswerBlockCheck(blockId='scope', supported=True, languageMatches=True,
        customerFacing=True, reason='The condition is explicitly stated and cited.')]
    review.checks[0].pointChecks = [AnswerPointCheck(pointIndex=0, covered=True,
        answerBlockIds=['scope'], reason='The actual scope block states the condition.')]
    validate_answer_review(review, t, quotes, prior, [block])
    assert review.checks[0].status == 'covered'
    assert set(block.requirementIds) == {rid, other}
    assert block.text == 'The stated condition applies.'


@pytest.mark.parametrize('point', ['GET /api/specimens/query is the route.',
    'Resolve the workflow task identifier.', 'Use taskId for the workflow.',
    'source-inspected-20260924 is the snapshot.'])
def test_static_answer_points_cannot_require_implementation_metadata(point):
    t = guidance_task(task(readOnly=False), 'Explain the procedure.')
    p = KnowledgeCoverage(stage='knowledge_coverage', checks=[
        {'requirementId': r['id'], 'status': 'covered', 'reason': 'Referenced rule.',
         'requiredPoints': [point]} for r in knowledge_requirements(t)])
    with pytest.raises(PipelineError, match='knowledge_answer_points_not_business_facing'):
        validate_coverage(p, t, Citations())


def test_consistency_review_cannot_turn_an_incidental_prefix_into_an_answer_requirement():
    from app.reader_knowledge_coverage import validate_review_points
    before = {'object': {'status': 'covered', 'requiredPoints': ['A submitted service request.']}}
    candidate = KnowledgeCoverage(stage='knowledge_coverage', checks=[{
        'requirementId': 'object', 'status': 'covered', 'reason': 'Meaning documented.',
        'requiredPoints': ['A submitted service request; the prefix denotes a particular category.']}])
    with pytest.raises(PipelineError, match='knowledge_review_points_changed'):
        validate_review_points(candidate, before)
    candidate.checks[0].status = 'partial'
    candidate.checks[0].reason = 'An essential condition has no applicable evidence.'
    validate_review_points(candidate, before)  # Still allowed to challenge real omissions.
    assert candidate.checks[0].status == 'partial'


def test_catalog_provenance_repair_does_not_accept_an_unsupported_business_instruction():
    from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft, verified_answer_blocks
    t, prior, review, quotes = fixture()
    rid = review.checks[0].requirementId
    quotes.append({'sourceId': 'session_current', 'text': '{"routes":["/example/items"]}'})
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation', 'text': 'Open [Items](/example/items) to waive the prerequisite.',
        'requirementIds': [rid], 'quoteIndexes': [0]}])
    validate_answer_draft(draft, t, quotes, ['/example/items'])
    assert draft.blocks[0].quoteIndexes == [0, len(quotes)-1]
    review.blockChecks = [AnswerBlockCheck(blockId='navigation', supported=True, languageMatches=True,
        customerFacing=True, reason='The page exists but the offered bypass is not established.',
        unsupportedClaims=['The prerequisite can be waived.'])]
    validate_answer_review(review, t, quotes, prior, draft.blocks)
    assert not verified_answer_blocks(draft, review)


def test_catalog_prefix_and_unauthorized_routes_do_not_receive_repaired_provenance():
    from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft
    t, _, review, quotes = fixture()
    quotes.append({'sourceId': 'session_current', 'text': '{"routes":["/example/items/detail"]}'})
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation', 'text': 'Open [Items](/example/items).',
        'requirementIds': [review.checks[0].requirementId], 'quoteIndexes': [0]}])
    with pytest.raises(PipelineError, match='knowledge_answer_navigation_citation_missing'):
        validate_answer_draft(draft, t, quotes, ['/example/items'])
    with pytest.raises(PipelineError, match='knowledge_answer_navigation_unverified'):
        validate_answer_draft(draft, t, quotes, [])


def test_coverage_correction_reports_all_independent_technical_points_together():
    t = guidance_task(task(readOnly=False), 'Explain the procedure.')
    requirements = knowledge_requirements(t)
    plan = KnowledgeCoverage(stage='knowledge_coverage', checks=[{
        'requirementId': r['id'], 'status': 'covered', 'reason': 'Described procedure.',
        'requiredPoints': ['Use the confirmation handler.' if i else 'Use taskId.']
    } for i, r in enumerate(requirements)])
    with pytest.raises(PipelineError) as caught:
        validate_coverage(plan, t, Citations())
    assert len(caught.value.details['invalidPoints']) == len(requirements)

import pytest

from app.generic_reader import PipelineError
from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft
from test_reader_answer_acceptance import fixture


@pytest.mark.parametrize('text', [
    'The detail page is /example/items/details and requires its record number.',
    'افتح صفحة التفاصيل /example/items/details مع رقم السجل.',
    'Open [/example/items](/example/items).',
])
def test_unusable_route_cannot_bypass_verified_navigation_as_plain_prose(text):
    task, requirements, _, quotes = fixture()
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation', 'text': text,
        'requirementIds': [requirements[0]['requirementId']], 'quoteIndexes': [0]}])
    with pytest.raises(PipelineError, match='knowledge_answer_bare_route'):
        validate_answer_draft(draft, task, quotes, ['/example/items'])


def test_cited_authorized_link_and_business_status_comparison_remain_readable():
    task, requirements, _, _ = fixture()
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation',
        'text': 'Compare Paid/Pending in the [Items list](/example/items). The ratio is 1/2.',
        'requirementIds': [requirements[0]['requirementId']], 'quoteIndexes': [0]}])
    validate_answer_draft(draft, task, [{'text': 'Authorized items list /example/items'}], ['/example/items'])

import pytest
from pydantic import ValidationError
from app.reader_metadata import bound_catalog_reason
from app.generic_reader_contracts import CatalogRecall

@pytest.mark.parametrize('reason',['Catalog explanation. '*40,'شرح سبب استدعاء الصفحة. '*40])
def test_overlong_non_decisional_explanation_cannot_block_valid_catalog_shape(reason):
    raw={'stage':'catalog_recall','candidateIds':['allowed-id'],'reason':reason}
    result,receipt=bound_catalog_reason(raw,500)
    assert CatalogRecall.model_validate(result).candidateIds==['allowed-id']
    assert raw['reason']==reason and receipt['decisionFieldsChanged'] is False
    assert receipt['originalCharacters']==len(reason)


def test_bounding_does_not_repair_invalid_candidate_list_or_accept_extra_fields():
    raw={'stage':'catalog_recall','candidateIds':['a']*6,'reason':'x'*600,'permission':'grant'}
    result,_=bound_catalog_reason(raw,500)
    with pytest.raises(ValidationError):CatalogRecall.model_validate(result)
    assert result['candidateIds']==raw['candidateIds'] and result['permission']=='grant'


def test_non_string_reason_still_requires_model_correction():
    raw={'stage':'catalog_recall','candidateIds':[],'reason':['not a string']}
    result,receipt=bound_catalog_reason(raw,500)
    assert receipt is None
    with pytest.raises(ValidationError):CatalogRecall.model_validate(result)


def test_structured_catalog_continues_after_non_decisional_text_bound():
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from app.generic_reader import GenericKnowledgeReader
    planner=SimpleNamespace(generic_reader_json=AsyncMock(return_value={
        'stage':'catalog_recall','candidateIds':['authorized'],'reason':'explanation '*80}))
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://portal.test')
    async def call(stage,awaitable,cap):return await awaitable
    reader.call=call
    def validate(result):assert result.candidateIds==['authorized']
    result=asyncio.run(reader.structured(CatalogRecall,'Recall pages.',{},validate))
    assert result.candidateIds==['authorized'] and planner.generic_reader_json.call_count==1
    assert reader.audit['modelMetadataBounds'][0]['decisionFieldsChanged'] is False


def test_invalid_model_contract_is_planning_failure_not_page_load_failure():
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from app.generic_reader import GenericKnowledgeReader,PipelineError
    planner=SimpleNamespace(generic_reader_json=AsyncMock(return_value={
        'stage':'catalog_recall','candidateIds':[],'reason':['bad type']}))
    reader=GenericKnowledgeReader(None,planner,portal_base_url='https://portal.test')
    async def call(stage,awaitable,cap):return await awaitable
    reader.call=call
    with pytest.raises(PipelineError) as error:asyncio.run(reader.structured(CatalogRecall,'Recall pages.',{}))
    assert error.value.category=='planning' and error.value.details['stage']=='CatalogRecall'
    assert error.value.details['validationErrors'][0]['path']==['reason']

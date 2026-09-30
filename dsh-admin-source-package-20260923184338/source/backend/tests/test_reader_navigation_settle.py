import asyncio
import pytest
from test_projected_collection import gateway


@pytest.mark.parametrize('initially_settled', [True, False])
def test_initial_navigation_wait_is_not_repeated_but_health_is_still_checked(monkeypatch, initially_settled):
    class Page:url='https://portal.test/record'
    waits=[]
    async def settle(page):waits.append('settle')
    async def observe(page,limit):return {'readHealth':{'healthy':False,'pending':['/api/record']},'rowSummaries':[]}
    monkeypatch.setattr(gateway,'_settle_page',settle)
    monkeypatch.setattr(gateway,'_observe_semantics',observe)
    request=gateway.AdminPortalReadRequest(startPath='/record',actions=[{'type':'observe'}])
    result=asyncio.run(gateway._execute_reader_actions(Page(),request,'https://portal.test',initially_settled=initially_settled))
    assert len(waits)==(0 if initially_settled else 1)
    assert not result[3] and result[4]['readHealth']['healthy'] is False

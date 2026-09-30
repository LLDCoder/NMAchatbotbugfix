"""In-flight APIs must finish before a Dashboard context receipt can be issued."""
import asyncio
import pytest
from test_projected_collection import gateway


class Page:
    def __init__(self): self.listeners = {}
    def on(self, event, callback): self.listeners.setdefault(event, []).append(callback)
    def remove_listener(self, event, callback): self.listeners[event].remove(callback)
    def emit(self, event):
        for callback in tuple(self.listeners.get(event, [])): callback()
    def empty(self): return not any(self.listeners.values())


def health(): return {'pending': {}, 'failed': {}, 'blocked': [], 'responseCaptureTasks': set()}


def test_already_settled_and_blocked_telemetry_do_not_require_an_event():
    p=Page();h=health();h['blocked']=['/api/clientlog/report']
    asyncio.run(gateway._settle_dashboard_requests(p,h));assert p.empty()


@pytest.mark.parametrize('resource', ['business', 'identity_support'])
def test_allowed_pending_api_without_response_task_must_finish(resource):
    async def run():
        p=Page();h=health();h['pending'][1]=resource
        t=asyncio.create_task(gateway._settle_dashboard_requests(p,h));await asyncio.sleep(0)
        assert not t.done()
        p.emit('response');await asyncio.sleep(0);assert not t.done()
        h['pending'].clear();p.emit('requestfinished')
        await asyncio.wait_for(t,0.1);assert p.empty()
    asyncio.run(run())


def test_last_two_late_responses_and_their_body_captures_all_finish():
    async def run():
        p=Page();h=health();h['pending'].update({1:'needs-attention-a',2:'needs-attention-b'})
        done=[];gates=[asyncio.Event(),asyncio.Event()]
        async def capture(i): await gates[i].wait();done.append(i)
        t=asyncio.create_task(gateway._settle_dashboard_requests(p,h));await asyncio.sleep(0)
        for i in range(2):
            c=asyncio.create_task(capture(i));h['responseCaptureTasks'].add(c)
            c.add_done_callback(h['responseCaptureTasks'].discard)
            p.emit('response');h['pending'].pop(i+1);p.emit('requestfinished');await asyncio.sleep(0)
        gates[0].set();await asyncio.sleep(0);assert not t.done()
        gates[1].set();await asyncio.wait_for(t,0.1)
        assert sorted(done)==[0,1] and not h['responseCaptureTasks'] and p.empty()
    asyncio.run(run())


def test_new_request_during_capture_is_not_mistaken_for_completion():
    async def run():
        p=Page();h=health();gate=asyncio.Event();capture=asyncio.create_task(gate.wait())
        h['responseCaptureTasks'].add(capture);capture.add_done_callback(h['responseCaptureTasks'].discard)
        t=asyncio.create_task(gateway._settle_dashboard_requests(p,h));await asyncio.sleep(0)
        h['pending'][2]='late-request';gate.set();await asyncio.sleep(0);await asyncio.sleep(0);assert not t.done()
        h['pending'].clear();p.emit('requestfinished');await asyncio.wait_for(t,0.1);assert p.empty()
    asyncio.run(run())


@pytest.mark.parametrize('failure_kind', ['http_error','network_error'])
def test_failed_request_is_never_reclassified_as_settled(failure_kind):
    async def run():
        p=Page();h=health();h['pending'][1]='required'
        t=asyncio.create_task(gateway._settle_dashboard_requests(p,h));await asyncio.sleep(0)
        h['pending'].clear();h['failed']['required']=1;p.emit('response' if failure_kind=='http_error' else 'requestfailed')
        with pytest.raises(RuntimeError,match='dashboard_context_requests_unsettled'):await t
        assert p.empty()
    asyncio.run(run())


@pytest.mark.parametrize('hung', ['request','capture'])
def test_original_outer_budget_still_cancels_hung_source_and_removes_listeners(hung):
    async def run():
        p=Page();h=health()
        if hung=='request':h['pending'][1]='required'
        else:
            capture=asyncio.create_task(asyncio.Event().wait());h['responseCaptureTasks'].add(capture)
            capture.add_done_callback(h['responseCaptureTasks'].discard)
        with pytest.raises(TimeoutError):
            async with asyncio.timeout(0.01):await gateway._settle_dashboard_requests(p,h)
        assert p.empty()
    asyncio.run(run())

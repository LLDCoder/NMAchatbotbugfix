import unittest
from unittest.mock import patch, AsyncMock
import httpx
from fastapi import HTTPException
import app
from pydantic import ValidationError

class MailGraphTests(unittest.IsolatedAsyncioTestCase):
    async def test_document_filter_is_forwarded_without_changing_acl_context(self):
        request=app.SearchRequest(query='Crystal lifecycle',folder_id='authorized-folder',source_refs=['kbfile:doc-1'])
        with patch.multiple(app,SEARCH_CONTRACT='mailgraph',REQUIRED_CHANNELS=()),patch.object(app,'_request',new_callable=AsyncMock) as call:
            call.return_value={'chunks':[]}
            await app.search(request)
        body=call.call_args.kwargs['json']
        self.assertEqual(body['folder_id'],'authorized-folder')
        self.assertEqual(body['source_refs'],['kbfile:doc-1'])
        self.assertFalse(body['semantic_cache'])
        self.assertFalse(body['adaptive_top_k'])

    async def test_unsupported_filter_is_explicit_and_never_silently_dropped(self):
        request=app.SearchRequest(query='Crystal lifecycle',folder_id='scope',source_refs=['kbfile:doc-1'])
        with patch.object(app,'SEARCH_CONTRACT','public'),patch.object(app,'_request',new_callable=AsyncMock) as call:
            with self.assertRaises(HTTPException) as cm:await app.search(request)
            self.assertEqual(cm.exception.detail['code'],'knowledge_source_filter_unsupported')
            call.assert_not_called()
        with self.assertRaises(ValidationError):
            app.SearchRequest(query='Crystal lifecycle',folder_id='scope',source_refs=['https://untrusted.test'])

    async def request_sequence(self, statuses, *, timeout=30):
        seen=[];factory=httpx.AsyncClient
        def handle(request):
            seen.append(request.headers['X-Request-ID'])
            status=statuses[min(len(seen)-1,len(statuses)-1)]
            return httpx.Response(status,json={'chunks':[]} if status==200 else {'detail':'private upstream diagnostics'})
        def client(**kwargs):
            self.assertLessEqual(kwargs['timeout'],timeout)
            return factory(transport=httpx.MockTransport(handle),**kwargs)
        with patch.multiple(app,SEARCH_CONTRACT='mailgraph',RETRY_ATTEMPTS=3,TIMEOUT_SECONDS=timeout),patch.object(app.httpx,'AsyncClient',client),patch.object(app.asyncio,'sleep',new_callable=AsyncMock):
            try:return await app._request('POST','/search',json={}),seen
            except HTTPException as exc:return exc,seen

    async def test_snapshot_retry_uses_a_new_request(self):
        result,seen=await self.request_sequence([409,200])
        self.assertEqual(result,{'chunks':[]})
        self.assertEqual(len(seen),2)
        self.assertEqual(len(set(seen)),2)

    async def test_exhausted_snapshot_retry_remains_an_error(self):
        result,seen=await self.request_sequence([409])
        self.assertEqual(len(seen),3)
        self.assertEqual(result.status_code,424)
        self.assertEqual(result.detail['code'],'knowledge_snapshot_changed')
        self.assertNotIn('private',str(result.detail))

    async def test_permission_denial_is_not_retried(self):
        result,seen=await self.request_sequence([403,200])
        self.assertEqual(len(seen),1)
        self.assertEqual(result.detail['code'],'knowledge_access_denied')

    async def test_retry_does_not_start_beyond_total_budget(self):
        result,seen=await self.request_sequence([409],timeout=.001)
        self.assertEqual(len(seen),1)
        self.assertEqual(result.detail['code'],'knowledge_snapshot_changed')

    def test_missing_or_failed_channel_cannot_be_success(self):
        full={'chunks':[],'completed_channels':['bm25','vector','graph'],'channels':{k:{'status':'ok'} for k in ['bm25','vector','graph']},'degraded':False}
        with patch.object(app,'REQUIRED_CHANNELS',('bm25','vector','graph')):
            self.assertEqual(app._validate_search(full)['retrievalStatus'],'no_results')
            for delta in [{'completed_channels':['vector']},{'degraded':True},{'channels':{'bm25':{'status':'timeout'}}}]:
                with self.assertRaises(HTTPException) as cm:app._validate_search({**full,**delta})
                self.assertEqual(cm.exception.status_code,424)

if __name__=='__main__':unittest.main()

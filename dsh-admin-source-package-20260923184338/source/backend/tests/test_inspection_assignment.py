import json
from types import SimpleNamespace

import pytest
from app.inspection_assignment import classify_assignment, assignment_answer, assignment_references
from app.portal_reader import _inspection_assignment_rows, bounded_portal_read_result, ReaderResult
from app.service import _reader_conversation_context
from test_admin_portal_reader import Gateway, run_reader, user_info_for_paths
from test_platform_portal_reader import gateway as executor

QUESTION='Are these tasks assigned to me, or are they simply in the inspection queue?'
NUMBERS=['IN-2026-100','IN-2026-200']


def context(numbers=NUMBERS):
    return {'previousIntent': {'resultStatus':'success','assignmentSource': {
        'page':'/inspection/tasks','selectedState':'Queued Tasks','taskNumbers':numbers}}}


def observation(rows, path='/api/admin/inspection/tasks', healthy=True):
    return {'readHealth':{'healthy':healthy},'apiDiscovery':{'candidates':[{
        'operationKey':'GET '+path,'path':path,'method':'GET','status':200,'policyState':'allowed',
        'responseEvidence':{'data':{'items':rows}},'responseEvidenceTruncated':True,
        'assignmentEvidence':rows}]}}


def result(rows):
    return {'ok':True,'result':{'result':'success','observation':observation(rows)}}


@pytest.mark.parametrize('row,expected',[
    ({'assignmentState':'Unassigned'},'unassigned'),
    ({'assignmentState':'Unassigned','inspectorName':'someone'},'unknown'),
    ({'assignmentState':'Unassigned','inspectors':[{'inspectorId':'admin-7'}]},'unknown'),
    ({'assignmentState':'Assigned','inspectors':[{'inspectorId':'admin-7'}]},'you'),
    ({'assignmentState':'Assigned','inspectors':[{'inspectorId':'admin-8'}]},'others'),
    ({'assignmentState':'Assigned','inspectors':[{'inspectorId':'admin-8'},{'inspectorId':'admin-7'}]},'you'),
    ({'assignmentState':'Assigned','inspectorName':'same login display name'},'unknown'),
    ({'assignmentState':'Assigned','inspectors':[{'inspectorName':'admin-7'}]},'unknown'),
    ({'assignmentState':'Assigned','inspectors':[]},'unknown'),
    ({'assignmentState':'Assigned','inspectors':[{'inspectorId':''}]},'unknown'),
    ({'statusName':'Queued','inspectorName':None},'unknown'),
    ({'createdBy':'admin-7','userId':'admin-7'},'unknown'),
])
def test_explicit_state_and_identifiers_are_required(row,expected):
    assert classify_assignment(row,'admin-7')==expected


def test_context_keeps_same_task_numbers_not_old_assignments_or_other_modules():
    r=ReaderResult(status='success',page='/inspection/tasks',summary='tasks',answer_shape='list',
        facts=(json.dumps({'Task No.':NUMBERS[0],'Inspector':'old-private-owner'}),)).public_json()
    e=lambda seq,kind,payload: SimpleNamespace(seq=seq,event_type=kind,event_json=payload)
    latest=e(3,'user.message',{'content':QUESTION})
    ctx=_reader_conversation_context([e(1,'user.message',{'content':'Show inspection tasks.'}),e(2,'reader.result',r),latest],latest)
    assert ctx['previousIntent']['assignmentSource']['taskNumbers']==NUMBERS[:1]
    assert 'old-private-owner' not in str(ctx)
    assert not assignment_references({**r,'result':'not_confirmed'})
    assert not assignment_references({**r,'page':'/dashboard'})


def test_followup_rechecks_exact_prior_tasks_and_does_not_substitute_new_rows():
    rows=[{'taskNo':n,'assignmentState':'Unassigned'} for n in [*NUMBERS,'IN-2026-999']]
    g=Gateway(info={'ok':True,'result':user_info_for_paths('/inspection/tasks')},portal_result=result(rows))
    out=run_reader(g,question=QUESTION,conversation_context=context())
    assert out.result.status=='success'
    answer=assignment_answer(out.result.public_json(),'en')
    assert 'none is assigned to you' in answer and all(n in answer for n in NUMBERS) and '999' not in answer
    assert g.events==['GetUserInfo','knowledge.search','admin.portal.read']


def test_assigned_row_requires_detail_and_compares_admin_id():
    class DetailGateway(Gateway):
        async def invoke(self,principal,tool,arguments,**kwargs):
            if tool!='admin.portal.read':return await super().invoke(principal,tool,arguments,**kwargs)
            self.calls.append((tool,arguments))
            row={'taskNo':NUMBERS[0],'assignmentState':'Assigned'}
            if arguments['actions'][0]['type']=='show_detail':row['inspectors']=[{'inspectorId':'admin-7'}]
            return result([row])
    g=DetailGateway(info={'ok':True,'result':user_info_for_paths('/inspection/tasks')})
    out=run_reader(g,question=QUESTION,conversation_context=context(NUMBERS[:1]))
    assert json.loads(out.result.facts[0])['Assignment']=='you'
    assert 'admin-7' not in str(out.result.facts)
    assert [c[1]['actions'][0]['type'] for c in g.calls if c[0]=='admin.portal.read']==['observe','show_detail']


def test_missing_tasks_do_not_mean_unassigned():
    g=Gateway(info={'ok':True,'result':user_info_for_paths('/inspection/tasks')},portal_result=result([]))
    out=run_reader(g,question=QUESTION,conversation_context=context())
    assert out.result.status=='not_confirmed'
    assert all(json.loads(f)['Assignment']=='unknown' for f in out.result.facts)


def test_no_context_and_permission_revocation_do_not_query_or_guess():
    for ctx,paths,expected in [({},('/inspection/tasks',),'not_confirmed'),(context(),('/dashboard',),'no_permission')]:
        g=Gateway(info={'ok':True,'result':user_info_for_paths(*paths)})
        out=run_reader(g,question=QUESTION,conversation_context=ctx)
        assert out.result.status==expected and not g.calls


def test_assignment_projection_survives_bounds_but_rejects_foreign_or_unhealthy_sources():
    row={'taskNo':NUMBERS[0],'assignmentState':'Assigned','inspectors':[{'inspectorId':'admin-7'}]}
    bounded=bounded_portal_read_result(result([row])['result'])['observation']
    assert _inspection_assignment_rows(bounded)[NUMBERS[0]]==row
    assert not _inspection_assignment_rows(observation([row],path='/api/admin/inspection/violations'))
    assert not _inspection_assignment_rows(observation([row],healthy=False))


def test_gateway_preserves_assignment_fields_after_large_detail_and_never_profile_pii():
    data={**{f'irrelevant{i}':'x' for i in range(80)},'taskNo':NUMBERS[0],'assignmentState':'Assigned',
          'inspectors':[{'inspectorId':'admin-7','inspectorName':'private-name'}],'email':'private@example.test'}
    p=executor._inspection_assignment_evidence({'data':data},'GET /api/admin/inspection/tasks/{id}')
    assert classify_assignment(p[0],'admin-7')=='you' and 'private' not in str(p)
    assert not executor._inspection_assignment_evidence({'data':data},'GET /api/AdminUser/GetUserInfo')
    data['inspectors']=[{'inspectorId':'other'}]*21
    assert classify_assignment(executor._inspection_assignment_evidence({'data':data},'GET /api/admin/inspection/tasks/{id}')[0],'admin-7')=='unknown'

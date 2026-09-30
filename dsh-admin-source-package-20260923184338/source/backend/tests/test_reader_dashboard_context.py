import copy
import pytest
from app.reader_dashboard_context import dashboard_read_context, verify_dashboard_context
from app.reader_collection import projection_hash
from app.generic_reader import PipelineError
from app.portal_reader import bounded_portal_read_result


def hint():
    return {'route': '/dashboard', 'view': '', 'routeAuthorized': True,
            'filters': [{'name':'timeFilter','value':'{"preset":"last30","days":30}'},
                        {'name':'department','value':'license'}, {'name':'roleVariant','value':'manager'}]}


def receipt(expected):
    return {'verified':True,'route':'/dashboard','view':'','sameOrigin':True,
            'principalHash':projection_hash('u'),
            'requestedFiltersHash':projection_hash(expected['filters']),
            'browserTimezone':{'requested':expected['browserTimezone'],'observed':expected['browserTimezone'],
                               'resolvedRequested':expected['browserTimezone']}}


def test_exact_applied_context_is_a_constraint_not_a_fact():
    current=hint(); expected=dashboard_read_context('/dashboard',current,'u')
    assert expected=={'route':'/dashboard','view':'','filters':current['filters'],'userId':'u','browserTimezone':'UTC'}
    assert current['routeAuthorized'] is True and 'filtersVerified' not in expected
    verify_dashboard_context(expected,{'dashboardContextReceipt':receipt(expected)},'u')


@pytest.mark.parametrize('kind',['other_read_route','other_browser_route','unauthorized','empty','missing'])
def test_no_general_replay_on_other_pages_or_empty_hints(kind):
    current=hint(); route='/dashboard'
    if kind=='other_read_route':route='/happiness/tickets'
    if kind=='other_browser_route':current['route']='/happiness/tickets'
    if kind=='unauthorized':current['routeAuthorized']=False
    if kind=='empty':current['filters']=[]
    if kind=='missing':current=None
    assert dashboard_read_context(route,current,'u') is None


@pytest.mark.parametrize('kind',['missing','other_user','wrong_filter','other_page','other_view','not_verified','foreign_origin'])
def test_receipt_is_required_and_bound_to_current_user_route_view_and_filters(kind):
    expected=dashboard_read_context('/dashboard',hint(),'u');actual=receipt(expected)
    if kind=='missing':actual={}
    if kind=='other_user':actual['principalHash']=projection_hash('other')
    if kind=='wrong_filter':actual['requestedFiltersHash']=projection_hash([])
    if kind=='other_page':actual['route']='/happiness/tickets'
    if kind=='other_view':actual['view']='Completed'
    if kind=='not_verified':actual['verified']=False
    if kind=='foreign_origin':actual['sameOrigin']=False
    with pytest.raises(PipelineError,match='dashboard_page_context_unverified'):
        verify_dashboard_context(expected,{'dashboardContextReceipt':actual},'u')


def test_receipt_survives_existing_tool_result_projection():
    expected=dashboard_read_context('/dashboard',hint(),'u')
    result=bounded_portal_read_result({'observation':{'dashboardContextReceipt':receipt(expected)}})
    verify_dashboard_context(expected,result['observation'],'u')


def test_view_constraint_is_not_silently_dropped_or_reinterpreted():
    current=hint();current['view']='unrecognized-view'
    assert dashboard_read_context('/dashboard',current,'u')['view']=='unrecognized-view'


def test_tool_gateway_forwards_constraint_to_authorized_platform_boundary():
    import asyncio
    from app.tool_gateway import ToolGateway
    from app.principal import Principal
    class Platform:
        portal_base_url='https://fixture.test'
        async def admin_portal_read(self,payload,**kwargs):
            self.payload=payload;self.kwargs=kwargs
            return {'status':'success','observation':{'dashboardContextReceipt':receipt(payload['dashboardContext'])}}
    platform=Platform();gateway=ToolGateway(None,platform)
    expected=dashboard_read_context('/dashboard',hint(),'u')
    principal=Principal(user_id='u',tenant_id='tenant',request_id='r',umc_token='fixture-token')
    result=asyncio.run(gateway.invoke(principal,'admin.portal.read',
        {'startPath':'/dashboard','actions':[{'type':'observe'}],'dashboardContext':expected},allowed_tools=['admin.portal.read']))
    assert result['ok'] and platform.payload['dashboardContext']==expected
    assert platform.kwargs['user_id']=='u'
    verify_dashboard_context(expected,result['result']['observation'],'u')


def test_absent_principal_does_not_change_non_dashboard_collection_path():
    principal=None
    assert dashboard_read_context('/other',hint(),getattr(principal,'user_id',None)) is None
    assert dashboard_read_context('/dashboard',{'route':'/dashboard','routeAuthorized':True,'filters':[]},getattr(principal,'user_id',None)) is None
    verify_dashboard_context(None,{},getattr(principal,'user_id',None))


def test_dashboard_applied_constraints_without_principal_are_explicitly_rejected():
    for principal in [None,object()]:
        with pytest.raises(PipelineError,match='dashboard_identity_unverified'):
            dashboard_read_context('/dashboard',hint(),getattr(principal,'user_id',None))


def test_browser_timezone_hint_is_carried_without_changing_applied_filters():
    current=hint();current['browserTimezone']='Asia/Dubai'
    expected=dashboard_read_context('/dashboard',current,'u')
    assert expected['browserTimezone']=='Asia/Dubai' and expected['filters']==current['filters']
    verify_dashboard_context(expected,{'dashboardContextReceipt':receipt(expected)},'u')


@pytest.mark.parametrize('kind',['missing','wrong_requested','wrong_observed','empty','no_resolved'])
def test_dashboard_timezone_evidence_is_required_and_consistent(kind):
    current=hint();current['browserTimezone']='Asia/Dubai'
    expected=dashboard_read_context('/dashboard',current,'u');actual=receipt(expected)
    if kind=='missing':actual.pop('browserTimezone')
    if kind=='wrong_requested':actual['browserTimezone']['requested']='UTC'
    if kind=='wrong_observed':actual['browserTimezone']['observed']='UTC'
    if kind=='empty':actual['browserTimezone']['observed']=''
    if kind=='no_resolved':actual['browserTimezone'].pop('resolvedRequested')
    with pytest.raises(PipelineError,match='dashboard_page_context_unverified'):
        verify_dashboard_context(expected,{'dashboardContextReceipt':actual},'u')


def test_equivalent_iana_alias_is_supported_only_with_observed_canonical_match():
    current=hint();current['browserTimezone']='Etc/UTC'
    expected=dashboard_read_context('/dashboard',current,'u');actual=receipt(expected)
    actual['browserTimezone'].update(observed='UTC',resolvedRequested='UTC')
    verify_dashboard_context(expected,{'dashboardContextReceipt':actual},'u')


@pytest.mark.parametrize('zone',['Asia/Dubai','UTC','Etc/UTC'])
def test_gateway_context_timezone_options_are_narrow_and_validated(zone):
    from test_projected_collection import gateway
    current=hint();current['browserTimezone']=zone
    context=gateway.DashboardReadContext.model_validate(dashboard_read_context('/dashboard',current,'u'))
    assert gateway._dashboard_browser_context_options(context)=={'timezone_id':zone}
    assert gateway._dashboard_browser_context_options(None)=={}


@pytest.mark.parametrize('zone',['','not/a-zone','../UTC','/etc/localtime','UTC;anything'])
def test_gateway_rejects_invalid_timezone_hints(zone):
    from test_projected_collection import gateway
    current=hint();current['browserTimezone']=zone
    with pytest.raises(ValueError):
        gateway.DashboardReadContext.model_validate(dashboard_read_context('/dashboard',current,'u'))

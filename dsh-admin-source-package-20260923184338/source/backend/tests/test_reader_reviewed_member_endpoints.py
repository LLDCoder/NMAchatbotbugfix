import pytest
from test_reader_network_policy import gateway, FakeRoute

@pytest.mark.parametrize('area',['content','customer-happiness'])
def test_only_reviewed_member_read_method_and_origin_are_registered(area):
    path='/api/'+area+'/team-management/members'
    for method,origin,suffix,allowed in [('GET','https://portal.test','',True),
        ('POST','https://portal.test','',False),('GET','https://other.test','',False),
        ('POST','https://portal.test','/one/emergency-leave',False),
        ('POST','https://portal.test','/one/resume-work',False),('GET','https://portal.test','/reassignment',False)]:
        request=FakeRoute(method,origin+path+suffix,'fetch').request
        assert gateway._reader_api_configured_policy_allows(request,'https://portal.test') is allowed

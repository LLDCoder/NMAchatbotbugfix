import copy
import pytest
from app.generic_reader import PipelineError
from app.reader_collection import projection_hash
from app.reader_group_domain import complete_observed_domain


def fixture():
    rows = [{'key':'a','label':'Member A'}, {'key':'b','label':'Member B'}]
    source = {'operationRef':'GET /api/roster','data':{'rows':rows},
              'principalScopeRef':'viewer','capturedAt':'now',
              'fieldEvidence':{'/rows':{'status':'complete','valueHash':projection_hash(rows)}}}
    fact = {'knowledgeBindingId':'page#owner','groupDomain':{'operationRef':'GET /api/roster',
            'sourcePath':'/rows','keyField':'key','labelField':'label'}}
    refs = [{'principalScopeRef':'viewer','capturedAt':'now'}]
    return [{'owner':'a','count':3}], fact, {'roster':source}, refs


def test_zero_members_use_observed_identity_not_hardcoded_names():
    groups, fact, sources, refs = fixture()
    result, display, proof = complete_observed_domain(groups,'owner',fact,sources,refs)
    assert result == [{'owner':'a','count':3},{'owner':'b','count':0}]
    assert display == [{'owner':'Member A','count':3},{'owner':'Member B','count':0}]
    assert proof['zeroGroupsAdded'] == 1 and proof['memberCount'] == 2
    assert groups == [{'owner':'a','count':3}]  # no source mutation


@pytest.mark.parametrize('fault', ['other_viewer','stale','truncated','duplicate','unknown','unassigned','forged','wrong_scope'])
def test_domain_never_silently_drops_or_relabels_unverified_members(fault):
    groups, fact, sources, refs = fixture();source=sources['roster']
    if fault == 'other_viewer':source['principalScopeRef']='someone-else'
    if fault == 'stale':source['capturedAt']='yesterday'
    if fault == 'truncated':source['fieldEvidence']['/rows']['status']='bounded'
    if fault == 'forged':source['data']['rows'][0]['label']='Changed label'
    if fault == 'duplicate':
        source['data']['rows'].append(source['data']['rows'][0].copy())
        source['fieldEvidence']['/rows']['valueHash']=projection_hash(source['data']['rows'])
    if fault == 'unknown':groups.append({'owner':'outside','count':7})
    if fault == 'unassigned':groups.append({'owner':None,'count':5})
    if fault == 'wrong_scope':fact['groupDomain']['contextParameters']={'team':'other'}
    before=copy.deepcopy(groups)
    with pytest.raises(PipelineError):complete_observed_domain(groups,'owner',fact,sources,refs)
    assert groups==before


def test_report_mode_keeps_all_tasks_and_zero_members_without_claiming_roster_membership():
    groups, fact, sources, refs = fixture()
    groups += [{'owner': 'outside', 'count': 7}, {'owner': None, 'count': 5}]
    values, display, proof = complete_observed_domain(groups, 'owner', fact, sources, refs, allow_unmatched=True)
    assert sum(row['count'] for row in values) == sum(row['count'] for row in display) == 15
    assert {'owner': 'Member B', 'count': 0} in display
    assert {'owner': 'Outside verified member list', 'count': 7} in display
    assert {'owner': 'Assignment key unavailable', 'count': 5} in display
    assert proof['unmatchedRowCount'] == 12
    assert proof['membershipConfirmed'] is False
    assert not any(row['owner'] == 'outside' for row in display)

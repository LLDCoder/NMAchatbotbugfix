import pytest
from app.generic_reader import bind_read_actions, PipelineError
from app.generic_reader_contracts import SourceSelection
from app.portal_reader import ReadOnlyPortalPolicy, UserPermissionContext
from test_generic_reader_v3 import store, reference


def fixture(role='textbox', supplied=True, value=''):
    kb=store();action={'type':'filter','selector':'#criterion','evidence':[reference(kb)]}
    if supplied:action['value']=value
    plan=SourceSelection.model_validate({'stage':'source_selection','sourceIds':[], 'rationale':[], 'missing':[], 'nextActions':[action]})
    observed={'filterControls':[{'role':role,'label':'Criterion','selector':'#criterion','options':['Red','Blue'] if role=='combobox' else [],'selected':['Red'],'filterSurface':True}]}
    return plan,observed,kb,ReadOnlyPortalPolicy('https://portal.test'),UserPermissionContext(roles=('Reader',),pages=('/work/crystals',)),'/work/crystals'


@pytest.mark.parametrize('role',['textbox','combobox'])
def test_explicit_clear_survives_binding_to_the_current_control(role):
    assert bind_read_actions(*fixture(role))==[{'type':'filter','selector':'#criterion','value':''}]


@pytest.mark.parametrize('supplied',[False,True])
def test_missing_or_null_value_is_not_a_request_to_clear(supplied):
    with pytest.raises(PipelineError,match='filter_value_missing'):
        bind_read_actions(*fixture(supplied=supplied,value=None))


@pytest.mark.parametrize('fault',['other_page','unknown_selector','not_filter_surface'])
def test_clear_does_not_relax_page_or_control_authority(fault):
    args=list(fixture())
    if fault=='other_page':args[4]=UserPermissionContext(roles=('Reader',),pages=('/other',))
    elif fault=='unknown_selector':args[0].nextActions[0].selector='#unobserved'
    else:args[1]['filterControls'][0]['filterSurface']=False
    with pytest.raises(PipelineError):bind_read_actions(*args)


def test_unobserved_nonempty_choice_is_still_rejected():
    with pytest.raises(PipelineError,match='filter_value_not_observed'):
        bind_read_actions(*fixture('combobox',value='Green'))

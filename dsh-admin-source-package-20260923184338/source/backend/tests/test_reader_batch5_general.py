from test_reader_clock_and_identity import fixture, collect
from app.reader_derivations import compile_derivations, apply_derivations
from app.reader_collection import checked_collections
from app.generic_reader_contracts import Step
from app.reader_scalars import scalar_compare, scalar_equal, valid_condition_value
from test_projected_collection import gateway


def test_elapsed_days_preserve_fraction_completed_clock_and_pauses():
    rows, captured, spec, kb, source, rule = fixture()
    rule['operator'] = 'elapsed_days'
    compiled = compile_derivations(kb, '/specimens', source, spec)
    spec.fields = compiled['fields']
    receipt, _ = collect(rows, captured, spec)
    receipt['startedAt'] = '2026-09-02T18:00:00+00:00'
    result = apply_derivations(checked_collections([receipt])[0], compiled)
    assert [r['clock'] for r in result['rows']] == [1.5, 30/1440, None]


def test_sort_has_no_implicit_top_twenty_limit():
    step = Step(id='ordered', op='sort', inputs=['rows'], field='rank', label='All ordered records', evidence=[])
    assert step.limit is None
    assert Step(id='top', op='sort', inputs=['rows'], field='rank', limit=5, label='Top five', evidence=[]).limit == 5


def test_membership_is_typed_and_finite_not_numeric_interval():
    assert scalar_compare(1, 'in', [1, 2])
    assert scalar_compare(4, 'not_in', [1, 2])
    assert not scalar_compare(True, 'in', [1, 2])
    assert not scalar_equal([True], [1])
    assert not scalar_compare('1', 'in', [1, 2])
    assert not valid_condition_value('in', [])
    assert not valid_condition_value('in', [{'code': 1}])
    assert not valid_condition_value('in', list(range(51)))


def test_nested_lookup_fields_do_not_hide_direct_row_columns():
    row = {'aLookup': {'x'+str(i): i for i in range(60)},
           'zKey': 123, 'zClock': 42, 'zNullable': None, 'password': 'hidden'}
    schema = gateway._collection_row_schemas({'data': {'items': [row]}})[0]
    assert {'zKey', 'zClock', 'zNullable'} <= set(schema['fields'])
    assert schema['fieldsTruncated']
    assert 'password' not in schema['fields']


def test_filter_recomputes_observed_nulls_but_preserves_missing_receipts():
    from test_reader_requirement_coverage import fixture
    from app.generic_reader import execute_analysis
    from app.generic_reader_contracts import Step
    for fault in ['excluded_null', 'retained_null', 'missing_receipt']:
        rows = [{'specimenKey': 'a', 'phase': 'Review', 'zone': 'East'},
                {'specimenKey': 'b', 'phase': 'Submitted', 'zone': None}]
        if fault == 'retained_null': rows[0]['zone'] = None
        task, plan, sources, kb = fixture(rows)
        source = sources['queue']; source['kind'] = 'api_response'
        source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
        if fault == 'missing_receipt': del source['fieldEvidence']['/data/items/0/zone']
        evidence = [c.model_dump() for c in plan.steps[0].evidence]
        plan.steps[0].unknownPolicy = 'report'
        plan.steps = [plan.steps[0], Step(id='keep', op='filter', inputs=['rows'], field='phase',
            operand='Review', label='Employee events', expose=False, evidence=evidence),
            Step(id='display', op='project', inputs=['keep'], fields=['zone'], role='detail',
                label='Selected attributes', evidence=evidence)]
        plan.requirementBindings = []
        result = execute_analysis(plan, sources, kb, [])
        output = result['outputs'][0]
        assert output['unavailableFields'] == ([] if fault == 'excluded_null' else ['zone'])
        assert output['value'] == [{'zone': 'East' if fault == 'excluded_null' else None}]


def test_identity_timeout_retries_once_but_never_permission_or_exhausted_budget():
    import asyncio
    from app.generic_reader import GenericKnowledgeReader
    from app.portal_reader import ReaderTimeoutBudget
    from app.principal import Principal
    from test_generic_reader_v3 import Gateway, Planner
    for mode, expected_calls in [('transient', 2), ('persistent', 2), ('denied', 1), ('total', 1)]:
        class IdentityGateway(Gateway):
            calls = 0
            async def get_user_info(self, principal):
                self.calls += 1
                if mode == 'denied':
                    return {'ok': False, 'code': 'permission_denied'}
                if mode != 'transient' or self.calls == 1:
                    await asyncio.sleep(.02)
                # Deliberately mismatched identity stops execution before any data read.
                return {'ok': True, 'result': {'data': {'id': 'another-person'}}}
        gateway = IdentityGateway()
        runner = GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test',
            timeout_budget=ReaderTimeoutBudget(total_seconds=1.001 if mode == 'total' else 2,
                                              get_user_info_seconds=.002))
        outcome = asyncio.run(runner.run(Principal('person-1', 'tenant', 'req'), 'Show my open records.'))
        assert gateway.calls == expected_calls
        assert not gateway.events  # No page or knowledge access before identity is verified.
        assert outcome.result.public_json()['failureCategory'] == (
            'permission' if mode in {'transient', 'denied'} else 'runtime')


def test_missing_sort_direction_is_repairable_planning_error_not_permission_denial():
    import pytest
    from app.generic_reader import bind_read_actions, PipelineError
    from app.generic_reader_contracts import SourceSelection
    from app.portal_reader import ReadOnlyPortalPolicy, UserPermissionContext
    from app.reader_gaps import classify_gap
    from test_generic_reader_v3 import store, reference
    kb=store();policy=ReadOnlyPortalPolicy('https://portal.test')
    permission=UserPermissionContext(roles=('Reader',), pages=('/work/crystals',))
    plan=SourceSelection.model_validate({'stage':'source_selection','sourceIds':[], 'rationale':[], 'missing':[],
        'nextActions':[{'type':'sort','name':'Score','role':'columnheader','evidence':[reference(kb)]}]})
    observed={'columnHeaders':['Score'], 'controls':[{'name':'Score','role':'columnheader'}]}
    with pytest.raises(PipelineError, match='sort_direction_required') as err:
        bind_read_actions(plan,observed,kb,policy,permission,'/work/crystals')
    assert err.value.category == 'planning'
    assert classify_gap(err.value.code) == 'planning'
    plan.nextActions[0].direction='descending'
    assert bind_read_actions(plan,observed,kb,policy,permission,'/work/crystals')[0]['direction']=='descending'
    denied=UserPermissionContext(roles=('Reader',),pages=('/other',))
    with pytest.raises(PipelineError,match='page_not_permitted') as err:
        bind_read_actions(plan,observed,kb,policy,denied,'/work/crystals')
    assert err.value.category == 'permission'
    ambiguous={'columnHeaders':['Score'], 'controls':[
        {'name':'Score','role':'columnheader','selector':'#left'},
        {'name':'Score','role':'columnheader','selector':'#right'}]}
    with pytest.raises(PipelineError,match='observed_control_not_unique'):
        bind_read_actions(plan,ambiguous,kb,policy,permission,'/work/crystals')

    plan.nextActions[0].selector='#right'
    assert bind_read_actions(plan,ambiguous,kb,policy,permission,'/work/crystals')[0]['selector']=='#right'
    plan.nextActions[0].selector='#missing'
    with pytest.raises(PipelineError,match='observed_control_not_unique'):
        bind_read_actions(plan,ambiguous,kb,policy,permission,'/work/crystals')


def test_display_label_is_not_a_physical_field_permission():
    from test_reader_generic_completion import detail_fixture
    from app.generic_reader import execute_analysis, render_generic_answer, PipelineError
    from app.reader_bindings import bind_analysis_evidence
    import pytest
    for label in ['Address and status', 'العنوان والحالة', 'Email verification status']:
        task, plan, sources, kb = detail_fixture()
        plan.steps[0].label = label
        bind_analysis_evidence(plan, task, kb, sources)
        result = execute_analysis(plan, sources, kb, [], task=task)
        assert result['requirementsSatisfied']
        assert label in render_generic_answer(result, 'en')
    for field in ['email', 'address', 'password', 'accessToken']:
        task, plan, sources, kb = detail_fixture()
        plan.steps[0].fields.append(field)
        with pytest.raises(PipelineError, match='output_field_restricted'):
            execute_analysis(plan, sources, kb, [], task=task)


def test_literal_secrets_in_display_labels_still_redacted():
    from test_reader_generic_completion import detail_fixture
    from app.generic_reader import execute_analysis, render_generic_answer
    from app.reader_bindings import bind_analysis_evidence
    task, plan, sources, kb = detail_fixture()
    plan.steps[0].label = 'Contact person@example.test / Bearer example-token'
    bind_analysis_evidence(plan, task, kb, sources)
    answer = render_generic_answer(execute_analysis(plan, sources, kb, [], task=task), 'en')
    assert 'person@example.test' not in answer and 'example-token' not in answer
    assert '[redacted]' in answer


def test_structural_list_binding_reuses_only_its_live_read_citations():
    from test_reader_generic_completion import detail_fixture
    from app.generic_reader import execute_analysis
    from app.reader_bindings import bind_analysis_evidence
    from app.generic_reader_contracts import RequirementBinding
    task, plan, sources, kb = detail_fixture()
    task.requestedAttributes = []
    task.outputShape = 'list'
    plan.requirementBindings = [b for b in plan.requirementBindings if b.requirementId != 'attribute_0']
    binding = RequirementBinding(requirementId='detail',sourceId='detail',sourcePath='/data',
        fields=['color'],stepIds=['detail'],evidence=[],knowledgeBindingId='')
    plan.requirementBindings.append(binding)
    bind_analysis_evidence(plan,task,kb,sources)
    assert binding.evidence
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert result['requirementsSatisfied'],result['requirementCoverage']
    binding.fields=['undocumented']
    result=execute_analysis(plan,sources,kb,[],task=task)
    assert not result['requirementsSatisfied']
    assert next(x for x in result['requirementCoverage'] if x['id']=='detail')['status']=='unfulfilled'

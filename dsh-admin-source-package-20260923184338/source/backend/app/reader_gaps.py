"""Maintenance classifications are executable capability metadata, not business rules."""


def classify_gap(code, fallback='knowledge_gap'):
    if code in {'upstream_session_expired'}:
        return 'permission'
    if code in {'upstream_source_not_found'}:
        return 'runtime'
    if code == 'record_type_conflict':
        return 'clarification'
    if code == 'page_read_dependency_unavailable':
        return 'runtime'
    if code == 'page_read_access_denied':
        return 'permission'
    if code in {'page_read_not_registered', 'page_read_not_allowed', 'page_read_not_readonly'}:
        return 'execution_configuration'
    if code in {'reader_policy_blocked', 'time_reference_unverified'}:
        return 'execution_configuration'
    if code in {'output_field_restricted', 'upstream_access_denied', 'identity_mismatch', 'page_permission_denied'}:
        return 'permission'
    if code in {'stage_timeout', 'total_timeout', 'collection_dependency_unavailable', 'source_response_unavailable',
                'knowledge_supplement_timeout', 'knowledge_verification_timeout', 'knowledge_retrieval_timeout',
                'knowledge_retrieval_channels_incomplete', 'knowledge_upstream_unavailable'}:
        return 'runtime'
    if code in {'unsupported_operator', 'time_expression_unsupported', 'form_encoding_unsupported',
                'form_condition_unsupported', 'collection_pagination_unsupported', 'output_group_budget_exceeded'}:
        return 'engine_capability_gap'
    if code in {'source_not_observed_or_not_permitted', 'duplicate_source_selection', 'select_sources_or_read_next', 'knowledge_citation_invalid', 'requirement_binding_invalid', 'analysis_binding_inapplicable',
                'routing_condition_conflict', 'routing_lookup_goal_required', 'stage_contract_invalid',
                'requirement_output_unreachable', 'analysis_measure_condition_missing', 'analysis_ordering_condition_missing',
                'analysis_form_operator_required',
                'domain_label_ambiguous', 'group_domain_membership_mismatch', 'routing_available_evidence_not_probed',
                'collection_lookup_plan_missing', 'membership_definition_inapplicable', 'membership_filter_not_requested', 'intent_population_measure_conflict',
                'invalid_source_binding', 'knowledge_coverage_page_mismatch', 'sort_direction_required',
                'detail_identity_required', 'invalid_filter_values', 'filter_value_required',
                'invalid_action_parameters', 'invalid_action_count', 'query_cannot_apply_filters', 'page_limit_exceeded'}:
        return 'planning'
    if code in {'grouping_value_unavailable', 'filter_value_unavailable', 'time_values_unavailable',
                'field_unavailable', 'field_missing', 'field_evidence_incomplete', 'form_data_unavailable', 'source_field_unobserved',
                'membership_key_unavailable', 'group_domain_source_unverified', 'group_domain_incomplete',
                'group_domain_condition_unknown', 'sort_field_invalid'}:
        return 'source_data'
    if code.startswith('requested_') or code in {'requirements_incomplete', 'stage_quality_incomplete', 'requested_context_unverified', 'requested_grouping_unfulfilled', 'knowledge_answer_coverage_unverified', 'knowledge_answer_incomplete', 'knowledge_requirements_incomplete'}:
        return 'acceptance'
    return fallback


def gap_items(codes, fallback='knowledge_gap'):
    actions = {'execution_configuration': 'Verify trusted execution configuration.',
               'permission': 'Verify current upstream identity and field access.',
               'runtime': 'Inspect dependency and stage diagnostics.',
               'engine_capability_gap': 'Implement or extend the generic executor contract.',
               'planning': 'Correct the plan using applicable bindings and existing evidence.',
               'source_data': 'Read the required complete field or report its actual unavailability.',
               'acceptance': 'Inspect individual unmet requirements; preserve verified outputs.',
               'knowledge_gap': 'Provide versioned page definitions with exact source references.'}
    return [{'code': code, 'category': category, 'resolvedByKnowledgeImport': category == 'knowledge_gap',
             'action': actions.get(category, actions['runtime'])}
            for code in dict.fromkeys(codes) for category in [classify_gap(code, fallback)]]

"""Keep absent page knowledge distinct from a user's unresolved choice."""


def validate_semantic_options(draft, candidate, knowledge, routes, language):
    if not candidate.clarification:
        return
    from .generic_reader import PipelineError
    from .reader_page_clarification import page_clarification

    semantic_fields = {'requestedMeasures', 'requestedAttributes', 'requestedOrdering', 'groupBy'}
    changes = [update for option in candidate.clarification.options for update in option.updates
        if update.field in semantic_fields and getattr(draft, update.field)
        and update.value != getattr(draft, update.field)]
    unresolved = {field for field in candidate.clarification.missingSlots
        if field in semantic_fields and getattr(draft, field)}
    if not changes and not unresolved:
        return
    documented, _ = page_clarification(draft, knowledge, routes, language)
    allowed = {(update.field, repr(update.value)) for option in documented.options for update in option.updates} if documented else set()
    unsupported = sorted({update.field for update in changes if (update.field, repr(update.value)) not in allowed})
    if not candidate.clarification.options and unresolved and documented is None:
        unsupported = sorted(set(unsupported) | unresolved)
    if unsupported:
        raise PipelineError('clarification_semantic_alternatives_unverified', 'planning', details={
            'fields': unsupported,
            'correction': 'These choices change explicit requested meanings without a matching active page '
                'ambiguity rule. Missing fields or definitions are knowledge gaps, not user ambiguity. '
                'Keep the requested requirements and do not offer to drop or substitute them. Remove this '
                'clarification and continue the supported read; report unsupported requirements as missing. '
                'A genuine documented ambiguity may use its exact page-defined choices.'})

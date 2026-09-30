"""Literal navigation labels are source text, never translated business aliases."""
import re


# This is navigation syntax, not a registry of business labels or statuses.
# Unquoted/implicit references remain with the ordinary intent/knowledge flow.
_NAMED_VIEW = re.compile(
    r'(?<!\w)(?:view|tab|و?(?:ال)?(?:عرض|تبويب))\s+(?:'
    r'«(?P<guillemet>[^«»\n]{1,160})»|'
    r'“(?P<curly>[^“”\n]{1,160})”|'
    r'"(?P<double>[^"\n]{1,160})"|'
    r"'(?P<single>[^'\n]{1,160})')", re.I)
_NEGATION = re.compile(
    r'(?<!\w)(?:not|except|excluding|without|instead|و?(?:لا|ليس|غير|بغير|باستثناء|بدون))(?!\w)', re.I)
_STATUS = re.compile(r'(?<!\w)(?:status|state|حالة|الحالة|وحالة|وحالتها|حالته|حالتها)(?!\w)', re.I)


def _navigation_label(value):
    """Strip only a complete quoted navigation wrapper, never business words."""
    if not isinstance(value, str):
        return None
    mention = _NAMED_VIEW.fullmatch(value)
    if not mention:
        # QE may express the same label as '"Label" view' in English.
        suffix = re.fullmatch(r'(.+)\s+(?:view|tab)', value, re.I)
        mention = _NAMED_VIEW.fullmatch('view ' + suffix.group(1)) if suffix else None
    return next((v for v in mention.groupdict().values() if v is not None), None) if mention else value


def literal_named_view(context, requested_view):
    """Return one exact original named UI label; no translation supplies a label."""
    question = context.get('question')
    requirements = [r for r in context.get('requirements', []) if r.get('kind') == 'view']
    if (not isinstance(question, str) or not requested_view or len(requirements) != 1
            or requirements[0].get('value') != requested_view or _NEGATION.search(question)):
        return None
    matches = list(_NAMED_VIEW.finditer(question))
    if len(matches) != 1:
        return None
    match = matches[0]
    group = next(key for key, value in match.groupdict().items() if value is not None)
    label = match.group(group)
    if label != label.strip() or not label:
        return None
    # QE identifies which immutable slot this original label belongs to. It
    # cannot invent the label or its business meaning: both must independently
    # match the original quoted input and an active same-page definition.
    terms = [term for term in context.get('terms', []) if term.get('requirementId') == 'view']
    if len(terms) != 1 or terms[0].get('sourceText') != requested_view:
        return None
    def anchors_label(value):
        if value == label:
            return True
        mention = _NAMED_VIEW.fullmatch(value) if isinstance(value, str) else None
        return bool(mention and label in mention.groupdict().values())
    if not any(anchors_label(terms[0].get(language)) for language in ('english', 'arabic')):
        return None
    return {'quote': label, 'sourceSpan': {'start': match.start(group), 'end': match.end(group)},
            'authority': 'original_explicit_quoted_navigation_label'}


def allows_population_reference(context, reference, requested_view, population):
    """A duplicated view label may name a documented queue, never a status test."""
    # Recheck the original quote and the immutable view slot. A resolved view
    # ID alone says nothing about what a separately extracted population meant.
    if literal_named_view(context, requested_view) != reference:
        return False
    terms = [term for term in context.get('terms', []) if term.get('requirementId') == 'population']
    if (len(terms) != 1 or terms[0].get('sourceText') != population
            or reference['quote'] not in [terms[0].get('english'), terms[0].get('arabic')]):
        return False
    if requested_view.casefold() != population.casefold():
        view_term = next(term for term in context['terms'] if term.get('requirementId') == 'view')
        # When the view slot already holds its canonical ID, require its QE
        # label to retain the WHOLE population phrase in the same language.
        # The independent literal quote / active definition checks still own
        # the meaning; this is not a translation alias or qualifier removal.
        if not any(isinstance(terms[0].get(language), str)
                and terms[0][language].casefold() == population.casefold()
                and (_navigation_label(view_term.get(language)) or '').casefold() == population.casefold()
                for language in ('english', 'arabic')):
            return False
    question = context.get('question', '')
    if _STATUS.search(question) or _NEGATION.search(question):
        return False
    span = reference['sourceSpan']
    outside = question[:span['start']] + question[span['end']:]
    # An independently stated phrase, in either the canonical or original
    # label language, is not the quoted UI label.
    if any(re.search(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', outside, re.I)
            for phrase in (population, reference['quote'])):
        return False
    return True

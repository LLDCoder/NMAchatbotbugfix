"""Keep a page-defined property once, as an output rather than a population."""
import re
from .reader_requirements import semantic_bindings, _words
from .generic_reader_contracts import SlotUpdate


def collapse_property_focus(task, knowledge):
    """Only the same exact field alias, optionally wrapped by a display noun, may deduplicate.

    Never strip a qualifier, negate a filter, change scope, or infer an alias
    from language similarity. The requested property itself stays unchanged.
    """
    if task.outputShape != 'detail' or not task.businessFocus or not task.requestedAttributes:
        return task, []
    # Presentation nouns are grammatical wrappers, not business aliases.
    # Remove at most one wrapper; all comparison/negation/population words stay.
    text = task.businessFocus.strip()
    bare = re.sub(r'\s+(?:indicator|metric|value|field|attribute)$', '', text, flags=re.I)
    bare = re.sub(r'^(?:value|field|attribute|indicator|metric) of\s+', '', bare, flags=re.I)
    focus = {frozenset(_words(text)), frozenset(_words(bare))} - {frozenset()}
    if not focus:
        return task, []
    wanted = {frozenset(_words(a)) for a in task.requestedAttributes if _words(a)}
    facts = semantic_bindings(knowledge)
    if any(f['kind'] in {'population', 'filter'} and focus & {frozenset(_words(n))
            for n in [f['concept'], *f.get('aliases', [])]} for f in facts):
        return task, []
    meanings = {frozenset(_words(f['concept'])) for f in facts if f['kind'] == 'attribute'
        and focus & {frozenset(_words(n)) for n in [f['concept'], *f.get('aliases', [])]}}
    if len(meanings) != 1:
        return task, []
    matches = []
    for fact in facts:
        if fact['kind'] != 'attribute' or fact.get('conditions'):
            continue
        names = {frozenset(_words(n)) for n in [fact['concept'], *fact.get('aliases', [])] if _words(n)}
        if focus & names and wanted & names:
            matches.append(fact)
    # Do not choose between different documented meanings of the same phrase.
    if len({frozenset(_words(f['concept'])) for f in matches}) != 1:
        return task, []
    proof = sorted(f['knowledgeBindingId'] for f in matches)
    revised = task.model_copy(deep=True)
    revised.businessFocus = ''
    revised.slotUpdates = [s for s in revised.slotUpdates if s.field != 'businessFocus'] + [
        SlotUpdate(field='businessFocus', value='', source='knowledge',
                   evidence='Duplicate of retained requested property: ' + ', '.join(proof)[:350])]
    return revised, proof

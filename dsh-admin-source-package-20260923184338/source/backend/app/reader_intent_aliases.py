"""Resolve explicit translation alternatives using literal, page-defined aliases."""
import re
from .reader_text import words, normalized_text


def bind_domain_compositions(entries, context):
    """Compose a KB-defined member label with its exact membership domain.

    Only grammatical glue is removed. Negation, ownership, departments and
    additional predicates remain significant; no business synonym is inferred.
    """
    def semantic_words(value):
        return words(value) - {'the', 'in', 'of'}
    for requirement in context.get('requirements', []):
        if requirement.get('kind') != 'filter':
            continue
        value = requirement.get('value', '')
        requested = semantic_words(value)
        for fact in entries:
            domain = fact.get('membershipDomain')
            if fact.get('kind') != 'filter' or not domain or fact.get('domainSelection'):
                continue
            groups = [g for g in entries if g.get('kind') == 'group'
                and g.get('recordId') == fact.get('recordId')
                and g.get('groupDomain') == domain
                and g.get('operationRef') == fact.get('operationRef')
                and g.get('sourcePath') == fact.get('sourcePath')
                and set(g.get('fields', [])) == set(fact.get('fields', []))]
            for group in groups:
                for scope in [fact['concept'], *fact.get('aliases', [])]:
                    for noun in [group['concept'], *group.get('aliases', [])]:
                        left, right = semantic_words(scope), semantic_words(noun)
                        if not left or not right or requested != left | right:
                            continue
                        fact.setdefault('intentAliases', []).append({
                            'requirementId': requirement['id'], 'value': value,
                            'resolvedAlias': scope, 'memberAlias': noun,
                            'evidenceBindingIds': [fact['knowledgeBindingId'], group['knowledgeBindingId']],
                            'reason': 'same_document_and_domain_member_scope_composition'})
                        break
                    else:
                        continue
                    break


def bind_translation_alternatives(entries, context):
    """Keep the user's requirement unchanged; attach a bounded lexical proof.

    Only slash-separated word alternatives can be narrowed, with no discarded
    qualifiers. The same active field fact must define both the selected term
    and an original-language phrase actually present in the user's question.
    Count measures require the same exact concept/alias proof and a count operator.
    This cannot resolve filters, scope, identities or invent computation rules.
    """
    question=normalized_text(context.get('question',''))
    requirements={r['id']:r for r in context.get('requirements',[])}
    for term in context.get('terms',[]):
        req=requirements.get(term.get('requirementId'),{})
        value=req.get('value','')
        if req.get('kind') not in {'attribute', 'measure'} or term.get('sourceText')!=value:continue
        alternatives=re.findall(r'\b[A-Za-z]+(?:/[A-Za-z]+)+\b',value)
        if not alternatives or len(alternatives)>2:continue
        variants=[value]
        for token in alternatives:
            variants=[v.replace(token,choice,1) for v in variants for choice in token.split('/')]
        if len(variants)>8:continue
        quotes=[normalized_text(term.get(k,'')) for k in ['english','arabic']]
        # Word boundaries for Latin; ordinary Arabic clitics may attach before
        # a field phrase. Quoted phrases must still occur literally, unchanged.
        quotes=[q for q in quotes if q and re.search(r'(?<![A-Za-z0-9_])'+re.escape(q)+r'(?!\w)',question)]
        matches=[]
        for fact in entries:
            if fact['kind'] != req['kind']:continue
            if req['kind'] == 'measure' and fact.get('operator') != 'count':continue
            names=[fact['concept'],*fact.get('aliases',[])]
            supported=[v for v in variants if any(words(v)==words(n) for n in names)]
            originals=[q for q in quotes if any(normalized_text(n)==q for n in names)]
            if req['kind'] == 'measure':
                # A normalized count phrase may add grammatical 'count of'.
                # Its source-language noun phrase must itself be an explicit
                # page alias occurring in the original question, never a
                # translated guess from the model or a partial English term.
                originals += [normalized_text(n) for n in names
                    if re.search(r'[\u0600-\u06ff]', n)
                    and re.search(r'(?<!\w)'+re.escape(normalized_text(n))+r'(?!\w)',question)]
            if supported and originals:matches.append((fact,supported,originals))
        meanings={frozenset(words(v)) for _,vs,_ in matches for v in vs}
        if len(meanings)!=1:continue
        for fact,variants,quotes in matches:
            fact.setdefault('intentAliases',[]).append({'requirementId':req['id'],'value':value,
                'resolvedAlias':variants[0],'originalQuote':quotes[0],
                'reason':'same_page_fact_defines_literal_phrase_and_one_translation_alternative'})

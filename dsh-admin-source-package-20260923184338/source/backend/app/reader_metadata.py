"""Bound non-decisional model annotations without changing executable fields."""
import hashlib


def bound_catalog_reason(raw, limit):
    if not isinstance(raw, dict) or type(limit) is not int or limit < 1:
        return raw, None
    value=raw.get('reason')
    if not isinstance(value,str) or len(value)<=limit:
        return raw,None
    clipped=value[:limit-1]+'…'
    return {**raw,'reason':clipped},{'field':'reason','originalCharacters':len(value),
        'retainedCharacters':len(clipped),'originalSha256':hashlib.sha256(value.encode()).hexdigest(),
        'reason':'bounded_non_decisional_catalog_annotation','decisionFieldsChanged':False}

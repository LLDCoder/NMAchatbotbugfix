"""Language-neutral lexical normalization. Never rewrite source values or IDs."""
import re
import unicodedata


def normalized_text(value):
    value = unicodedata.normalize('NFKC', str(value)).casefold()
    value = re.sub(r'[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]', '', value)
    value = value.translate(str.maketrans('أإآٱ', 'اااا'))
    return ''.join(str(unicodedata.decimal(c)) if c.isdecimal() else c for c in value)


def words(value, *, split_identifiers=False):
    value = str(value)
    if split_identifiers:
        value = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', value).replace('_', ' ')
    tokens = re.findall(r'\w+', normalized_text(value), re.UNICODE)
    # English inflection is lexical only; Arabic words must not become empty
    # sets or inherit English suffix rules. Business aliases come from the KB.
    return {w[:-3]+'y' if w.isascii() and w.endswith('ies') else
            w[:-1] if w.isascii() and w.endswith('s') and not w.endswith('ss') else w
            for w in tokens}

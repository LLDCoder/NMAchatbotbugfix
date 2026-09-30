"""Bounded requirement-aware context selection; no page or business rules."""
from collections import Counter
import hashlib
import math
from .reader_retrieval import terms


def rank_items(items, queries):
    """Rank before document diversification, retaining input order on ties.

    Ranking chooses context, never resolves conflicting definitions or grants
    authority. Every requirement gets a chance to contribute a candidate.
    """
    wanted = [terms(q) for q in queries if terms(q)]
    if not wanted:
        return items
    vocab = [terms(item['text'] + ' ' + item['sourceName']) for item in items]
    frequencies = Counter(t for v in vocab for t in v)
    weights = {t: math.log(1 + len(items)/n) for t, n in frequencies.items()}
    scores = [[sum(weights[t] for t in q & v) / max(1, sum(weights.get(t, 1) for t in q))
               for q in wanted] for v in vocab]
    # Select by requirements round-robin, then fill by overall relevance.
    selected, seen = [], set()
    lanes = [[i for i in sorted(range(len(items)), key=lambda i: (-scores[i][column], -max(scores[i]), i))
              if scores[i][column] > 0] for column in range(len(wanted))]
    while any(lanes):
        for lane in lanes:
            while lane and lane[0] in seen:
                lane.pop(0)
            if lane:
                i = lane.pop(0)
                selected.append(items[i]); seen.add(i)
    selected.extend(items[i] for i in sorted(range(len(items)),
                    key=lambda i: (-max(scores[i], default=0), -sum(scores[i]), i)) if i not in seen)
    return selected


def split_passages(text, size=1000):
    """Stable offsets and IDs remain valid when a later stage changes ranking."""
    result, current, start, position = [], '', 0, 0
    for line in text.splitlines(keepends=True):
        # Bound individual long lines too, including minified reference text.
        for offset in range(0, len(line), size):
            piece = line[offset:offset+size]
            if current and len(current)+len(piece) > size:
                result.append((start, position, current))
                current, start = '', position
            current += piece
            position += len(piece)
    if current:
        result.append((start, position, current))
    return result


def choose_passages(item, queries, limit, required=()):
    passages = split_passages(item['text'])
    preferred = set(required)
    if item['record'] or not any(terms(q) for q in queries):
        order = list(range(len(passages)))
    else:
        candidates = [{'text': p[2], 'sourceName': '', 'index': i}
                      for i, p in enumerate(passages)]
        order = [p['index'] for p in rank_items(candidates, queries)]
    # Retain already-cited evidence for the consistency/review step when bounded.
    order.sort(key=lambda i: (item['storeKey']+':p'+str(i)) not in preferred)
    chosen, used = [], 0
    for i in order:
        if used+len(passages[i][2]) <= limit:
            chosen.append(i); used += len(passages[i][2])
        elif item['record']:
            break  # A record must keep its original order; never splice JSON.
    return [(i, *passages[i]) for i in sorted(chosen)]


def input_manifest(documents):
    """Identify the actual stage input without duplicating private text in audit."""
    return [{k: doc[k] for k in ['documentId', 'documentVersion', 'chunkId', 'recordId', 'truncated']} |
            {'passages': [{'sourceId': p['sourceId'], 'characters': len(p['text']),
                           'sha256': hashlib.sha256(p['text'].encode()).hexdigest()}
                          for p in doc['passages']]} for doc in documents]

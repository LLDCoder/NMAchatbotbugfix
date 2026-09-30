"""Shared timeout limits for the bounded Admin Portal Reader."""

import math
import re


def requested_record_limit(question: str) -> int | None:
    """Recognize explicit output cardinality, never dates, totals or thresholds."""
    words = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
             'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10}
    match = re.search(r'\b(?:show|list|give|return|display|provide)\s+(?:(?:me|us)\s+)?'
                      r'(?:(?:only|up to|the|first)\s+)*'
                      r'(?P<n>\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+'
                      r'(?P<noun>[a-z]+)', question, re.I)
    if not match or match['noun'].lower() in {'day','days','week','weeks','month','months','year','years','hour','hours','percent'}:
        return None
    n = words.get(match['n'].lower()) or int(match['n'])
    return n if 1 <= n <= 20 else None


# Page capture plus at most two policy-checked auxiliary reads share this cap.
PORTAL_EXECUTION_TIMEOUT_SECONDS = 65.0
PLATFORM_CLIENT_GRACE_SECONDS = 5.0
READER_TOTAL_TIMEOUT_SECONDS = 90.0
MIN_READER_TOTAL_TIMEOUT_SECONDS = 10.0
# Multi-stage retrieval and complete read-only pagination need independent
# dependency budgets. Keep a finite configurable ceiling; the default is 90s.
MAX_READER_TOTAL_TIMEOUT_SECONDS = 300.0
MIN_PLATFORM_TIMEOUT_SECONDS = 1.0
MAX_PLATFORM_TIMEOUT_SECONDS = 180.0


def bounded_reader_total_timeout(configured_seconds: float) -> float:
    value = float(configured_seconds)
    if not math.isfinite(value):
        raise ValueError("reader total timeout must be finite")
    return min(max(value, MIN_READER_TOTAL_TIMEOUT_SECONDS), MAX_READER_TOTAL_TIMEOUT_SECONDS)


def effective_platform_timeout(configured_seconds: float) -> float:
    """Keep the HTTP client alive longer than the browser executor's cap."""

    value = float(configured_seconds)
    if not math.isfinite(value):
        raise ValueError("platform timeout must be finite")
    return min(
        max(value, PORTAL_EXECUTION_TIMEOUT_SECONDS + PLATFORM_CLIENT_GRACE_SECONDS),
        MAX_PLATFORM_TIMEOUT_SECONDS,
    )

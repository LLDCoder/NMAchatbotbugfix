import pytest

from app.portal_reader import ReaderResult, knowledge_supports_result


def _context(*chunks: str) -> dict:
    return {
        "ok": True,
        "chunks": [{"content": content} for content in chunks],
    }


def _result(fact: str) -> ReaderResult:
    return ReaderResult(status="success", summary="", facts=(fact,))


def test_same_chunk_source_sentences_can_support_one_semicolon_compound_fact() -> None:
    context = _context(
        "The active `To Do` tab names the current authorized queue. "
        "Record ownership, personal assignment, and department ownership are not confirmed by that label."
    )
    fact = (
        "The active `To Do` tab names the current authorized queue; "
        "record ownership, personal assignment, and department ownership are not confirmed by that label."
    )

    assert knowledge_supports_result(_result(fact), context)


def test_one_matching_clause_cannot_support_an_unrelated_clause() -> None:
    context = _context("The selected tab controls the queue view.")
    fact = "Managers can approve refunds; the selected tab controls the queue view."

    assert not knowledge_supports_result(_result(fact), context)


def test_compound_fact_cannot_stitch_support_across_chunks() -> None:
    context = _context(
        "Applications can be filtered by status.",
        "Licenses can be renewed by managers.",
    )
    fact = "Applications can be filtered by status; licenses can be renewed by managers."

    assert not knowledge_supports_result(_result(fact), context)


@pytest.mark.parametrize(
    ("source_clause", "contradicting_clause"),
    [
        ("The queue tab is not a status filter.", "The queue tab is a status filter"),
        ("The page shows 10 rows.", "The page shows 12 rows"),
    ],
)
def test_one_supported_clause_cannot_hide_a_contradiction(
    source_clause: str,
    contradicting_clause: str,
) -> None:
    context = _context(source_clause + " The selected tab controls the queue view.")
    fact = contradicting_clause + "; the selected tab controls the queue view."

    assert not knowledge_supports_result(_result(fact), context)


def test_paraphrase_cannot_add_a_number_missing_from_the_source() -> None:
    context = _context("The payment records have a maximum page size.")
    fact = "The payment records have a maximum page size of 10."

    assert not knowledge_supports_result(_result(fact), context)


def test_exact_decimal_value_is_not_split_as_a_sentence_boundary() -> None:
    fact = "Processing takes 1.5 days."

    assert knowledge_supports_result(_result(fact), _context(fact))


def test_existing_exact_comma_multiclause_sentence_remains_supported() -> None:
    fact = "Queue A identifies waiting work, category B separates review subjects, date C records entry time."

    assert knowledge_supports_result(_result(fact), _context(fact))


def test_existing_reasonable_single_sentence_paraphrase_remains_supported() -> None:
    context = _context("The Licensing applications list supports filtering by application status and date.")
    fact = "The applications list can be filtered using status and date."

    assert knowledge_supports_result(_result(fact), context)

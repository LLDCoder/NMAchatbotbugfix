from app.portal_reader import ReaderResult, knowledge_supports_result, project_knowledge_result


SOURCE_NAME = "Admin-Portal-User-Manual-v1.md"
ENVELOPE = (
    "【知识库文件】 文件名：Admin-Portal-User-Manual-v1.md 目录：/umc 分段：3 "
    "【文档路径】Admin-Portal-User-Manual-v1 > Admin Portal User Manual v1 > Semantic node: Queue "
    "【来源行】25-36 【内容类型】heading,list 【切分版本】markdown-v2 "
)
BODY = (
    "## Semantic node: Queue "
    "- **meaning:** The queue tabs select a work view. "
    "- **distinguish_from:** Status is a field on each row."
)


def _raw_result(content: str, *, source_name: str = SOURCE_NAME) -> dict:
    return {
        "ok": True,
        "code": "ok",
        "result": {
            "chunks": [
                {
                    "content": content,
                    "source_name": source_name,
                    "score": 0.91,
                }
            ]
        },
    }


def test_projection_strips_complete_markdown_v2_envelope_and_keeps_provenance() -> None:
    projected = project_knowledge_result(_raw_result(ENVELOPE + BODY))

    assert projected["chunks"] == [{"content": BODY, "source_name": SOURCE_NAME, "score": 0.91}]
    assert "【知识库文件】" not in projected["chunks"][0]["content"]


def test_projection_does_not_strip_incomplete_or_source_mismatched_envelopes() -> None:
    incomplete = "A manual may mention 【切分版本】markdown-v2 without being a retrieval envelope."
    mismatched = ENVELOPE + BODY

    assert project_knowledge_result(_raw_result(incomplete))["chunks"][0]["content"] == incomplete
    assert project_knowledge_result(_raw_result(mismatched, source_name="Another-Manual.md"))["chunks"][0]["content"] == mismatched


def test_projection_truncation_is_measured_after_envelope_removal() -> None:
    projected = project_knowledge_result(_raw_result(ENVELOPE + "Short body."), max_content=20)

    assert projected["chunks"][0]["content"] == "Short body."
    assert "truncated" not in projected["chunks"][0]


def test_checker_uses_body_for_legacy_projected_envelope_context() -> None:
    context = {
        "ok": True,
        "chunks": [{"content": ENVELOPE + BODY, "source_name": SOURCE_NAME}],
    }
    exact = ReaderResult(status="success", summary="", facts=("Status is a field on each row.",))
    paraphrase = ReaderResult(status="success", summary="", facts=("Each row contains a status field.",))

    assert knowledge_supports_result(exact, context)
    assert knowledge_supports_result(paraphrase, context)


def test_checker_rejects_retrieval_metadata_and_markdown_structure_as_facts() -> None:
    context = project_knowledge_result(_raw_result(ENVELOPE + BODY))
    rejected = (
        ENVELOPE + "## Semantic node: Queue - **meaning:** A",
        "## Semantic node: Queue",
        "- **meaning:** The queue tabs select a work view.",
        "## Semantic node: Queue - **meaning:** The queue tabs select a work view. - **distinguish_from:** Sta",
    )

    for fact in rejected:
        assert not knowledge_supports_result(ReaderResult(status="success", summary="", facts=(fact,)), context)

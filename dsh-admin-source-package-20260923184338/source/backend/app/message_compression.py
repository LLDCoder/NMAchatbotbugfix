"""One model pass for long input; never truncate or silently discard a task."""
import asyncio
import hashlib
import re
import time
from datetime import datetime, timezone

import httpx


MESSAGE_COMPRESSION_THRESHOLD_CHARS = 10_000
MESSAGE_COMPRESSION_TARGET_CHARS = 8_000


class MessageCompressionError(Exception):
    def __init__(self, code: str, metadata: dict | None = None):
        super().__init__(code)
        self.code = code
        self.metadata = metadata or {}


def message_source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def numeric_literals(text: str) -> set[str]:
    """Keep exact numeric/record/date tokens, including numbers in tail clauses."""
    return {token for token in re.findall(r"[A-Za-z0-9]+(?:[-_./:][A-Za-z0-9]+)*", text)
            if any(char.isdigit() for char in token)}


async def prepare_reader_input(question: str, llm, *, timeout_seconds: float) -> tuple[str, dict | None]:
    if len(question) <= MESSAGE_COMPRESSION_THRESHOLD_CHARS:
        return question, None
    # Use the same credential redaction as intent analysis, with no text limit.
    from .generic_reader import safe_text
    model_input = safe_text(question)
    started = time.perf_counter()
    metadata = {
        "status": "failed", "originalChars": len(question),
        "sourceSha256": message_source_hash(question),
        "thresholdChars": MESSAGE_COMPRESSION_THRESHOLD_CHARS,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "model": llm.settings.llm_model,
    }
    try:
        # Exactly one request: invalid output and dependency errors never retry.
        candidate = await asyncio.wait_for(llm.compress_user_message(model_input), timeout=timeout_seconds)
        if not isinstance(candidate, dict) or candidate.get("complete") is not True:
            raise MessageCompressionError("incomplete_summary")
        summary = candidate.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            raise MessageCompressionError("invalid_summary")
        summary = safe_text(summary).strip()
        if not summary or len(summary) > MESSAGE_COMPRESSION_THRESHOLD_CHARS:
            raise MessageCompressionError("summary_too_long")
        if not numeric_literals(model_input).issubset(numeric_literals(summary)):
            raise MessageCompressionError("missing_numeric_literals")
        metadata.update(status="compressed", effectiveChars=len(summary), effectiveQuestion=summary,
                        usage=candidate.get("usage", {}))
    except (asyncio.TimeoutError, httpx.TimeoutException):
        metadata["failureCode"] = "compression_timeout"
    except httpx.HTTPError:
        metadata["failureCode"] = "compression_unavailable"
    except (ValueError, TypeError):
        metadata["failureCode"] = "invalid_summary"
    except MessageCompressionError as exc:
        metadata["failureCode"] = exc.code
    metadata["completedAt"] = datetime.now(timezone.utc).isoformat()
    metadata["durationMs"] = round((time.perf_counter() - started) * 1000, 1)
    if metadata["status"] != "compressed":
        raise MessageCompressionError(metadata["failureCode"], metadata)
    return summary, metadata


def compression_failure_message(language: str) -> str:
    messages = {
        "zh": "这条消息较长，我尝试压缩一次，但未能确认摘要完整保留了请求条件，因此尚未继续分析。原文已保留，请将内容分成几条消息后重试。",
        "en": "This message is long. I tried to summarize it once, but could not confirm that the summary preserved the request. Analysis has stopped and your original message is saved. Please split it into smaller messages and try again.",
        "ar": "هذه الرسالة طويلة. حاولت تلخيصها مرة واحدة، لكن لم أتمكن من التأكد من احتفاظ الملخص بشروط الطلب كاملة. لم أتابع التحليل وتم حفظ رسالتك الأصلية. يرجى تقسيم المحتوى إلى رسائل أقصر والمحاولة مجدداً.",
    }
    return messages.get(language, messages["en"])

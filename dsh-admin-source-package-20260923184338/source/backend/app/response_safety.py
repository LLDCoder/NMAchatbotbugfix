"""Safety checks for model text that is about to become a public response."""

import json
import re


_URL_PATTERN = re.compile(r"https?://[^\s)\]>\"']+", re.IGNORECASE)
_MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\(([^\s)]+)\)", re.IGNORECASE)


def strip_unverified_links(content: str, evidence: object) -> str:
    """Keep only links that were supplied by trusted tool evidence.

    Tool-backed replies can cite a record URL when the Tool actually returned
    one. A model must not manufacture a Portal navigation link from an ID,
    title, or general knowledge. Source titles remain available for knowledge
    citations even when the evidence contains no URL.
    """

    serialized_evidence = json.dumps(evidence, ensure_ascii=False, default=str)
    allowed_urls = {
        match.group(0).rstrip(".,;:!?")
        for match in _URL_PATTERN.finditer(serialized_evidence)
    }

    def markdown_replacement(match: re.Match[str]) -> str:
        label, target = match.group(1), match.group(2).rstrip(".,;:!?")
        return match.group(0) if target in allowed_urls else label

    sanitized = _MARKDOWN_LINK_PATTERN.sub(markdown_replacement, content)

    def bare_url_replacement(match: re.Match[str]) -> str:
        url = match.group(0)
        core_url = url.rstrip(".,;:!?")
        suffix = url[len(core_url):]
        return url if core_url in allowed_urls else suffix

    return _URL_PATTERN.sub(bare_url_replacement, sanitized)


def is_internal_tool_protocol(content: str) -> bool:
    """Detect a model draft that exposes a tool invocation instead of an answer."""
    candidate = content.strip()
    lowered = candidate.casefold()
    # Some compatible model endpoints emit their native DSML/XML tool-call
    # serialization as content. It may be prefixed by ordinary prose, so it
    # cannot be detected by parsing the whole response as JSON.
    if "dsml" in lowered and any(marker in lowered for marker in ("tool_calls", "invoke name=", "parameter name=")):
        return True
    if re.search(r"<\s*(?:tool_calls?|function_calls?)\b", lowered) and re.search(r"<\s*(?:invoke|function)\b", lowered):
        return True
    if candidate.startswith("JSON\n"):
        candidate = candidate[5:].strip()
    if candidate.startswith("```json") and candidate.endswith("```"):
        candidate = candidate[7:-3].strip()
    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError:
        return False
    if not isinstance(payload, dict):
        return False
    return bool({"tool", "toolName", "name"} & set(payload)) and bool({"args", "arguments", "parameters"} & set(payload))

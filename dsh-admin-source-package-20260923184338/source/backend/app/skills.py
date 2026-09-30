import re
from typing import Any


def requested_response_language(text: str) -> str | None:
    """Return an explicitly requested output language, when one is present.

    Explicit requests must win over script heuristics: Arabic users may ask for
    English and English users may ask for Arabic in the same turn.
    """
    value = str(text or "")
    if re.search(r"\b(?:in|answer|respond|reply|write)\s+(?:in\s+)?english\b|بال(?:لغة\s+)?الإنجليزية|بالإنجليزية", value, re.I):
        return "en"
    if re.search(r"\b(?:in|answer|respond|reply|write)\s+(?:in\s+)?arabic\b|بال(?:لغة\s+)?العربية|بالعربية", value, re.I):
        return "ar"
    if re.search(r"\b(?:in|answer|respond|reply|write)\s+(?:in\s+)?chinese\b|用中文|中文回答|中文回复", value, re.I):
        return "zh"
    return None


def _language_prose(text: str) -> str:
    """Exclude opaque literals from language votes, never from the actual request."""

    value = str(text or "")
    value = re.sub(r"```[\s\S]*?```|`[^`\n]*`", " ", value)
    value = re.sub(r"https?://\S+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", " ", value)
    # Identifiers can contain many Latin letters while conveying no English
    # prose. Require a digit and a letter; ordinary hyphenated words remain.
    value = re.sub(r"(?<![A-Za-z0-9_])(?=[A-Za-z0-9_-]*[0-9])"
                   r"(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_]+(?:[-_][A-Za-z0-9_]+)*"
                   r"(?![A-Za-z0-9_])", " ", value)
    return value


def _message_language_counts(text: str) -> dict[str, int]:
    """Count the letters of each supported script; digits and emoji are ignored."""

    value = _language_prose(text)
    return {
        "ar": sum(
            1
            for char in value
            if char.isalpha() and char != "\u0640" and ("\u0600" <= char <= "\u06ff"
            or "\u0750" <= char <= "\u077f"
            or "\u08a0" <= char <= "\u08ff"
            or "\ufb50" <= char <= "\ufdff"
            or "\ufe70" <= char <= "\ufeff")
        ),
        "en": sum(1 for char in value if ("A" <= char <= "Z") or ("a" <= char <= "z")),
        "zh": sum(1 for char in value if "\u3400" <= char <= "\u4dbf" or "\u4e00" <= char <= "\u9fff"),
    }


# A script needs at least this many letters before it can decide the reply
# language.  Bare identifiers such as "HC-02-2026-5239576" carry two Latin
# letters and are not evidence that the user wrote English.
_MIN_LANGUAGE_LETTERS = 3


def detect_message_language(text: str) -> str:
    """Return the message's own language when one script clearly dominates, else ""."""

    counts = _message_language_counts(text)
    eligible = {code: count for code, count in counts.items() if count >= _MIN_LANGUAGE_LETTERS}
    if not eligible:
        return ""
    top = max(eligible.values())
    winners = [code for code, count in eligible.items() if count == top]
    return winners[0] if len(winners) == 1 else ""


# Scripts outside the supported English/Arabic pair.  Kana is checked before
# Han so a Japanese sentence is reported as Japanese, not Chinese.  Two or more
# characters are required, so a quoted foreign name inside an English question
# does not trigger the supported-language note.
_UNSUPPORTED_SCRIPT_RANGES: tuple[tuple[str, str, str], ...] = (
    ("ja", "\u3040", "\u30ff"),
    ("ko", "\uac00", "\ud7af"),
    ("zh", "\u3400", "\u4dbf"),
    ("zh", "\u4e00", "\u9fff"),
    ("ru", "\u0400", "\u04ff"),
    ("el", "\u0370", "\u03ff"),
    ("he", "\u0590", "\u05ff"),
    ("hi", "\u0900", "\u097f"),
    ("th", "\u0e00", "\u0e7f"),
)

# A Latin-script message can still be French, Spanish, German, Italian or Dutch.
# Only function words and accented letters are used, and words that also exist
# in English ("die", "de") are deliberately excluded.
_NON_ENGLISH_LATIN = re.compile(
    r"\b(?:le|les|des|une|est|pour|avec|merci|bonjour|salut|montrez|affichez|vous|pla[iî]t|"
    r"el|los|las|una|para|con|gracias|hola|mu[eé]strame|muestra|estado|"
    r"der|das|und|nicht|bitte|danke|sie|mir|meinen|meine|zeigen|"
    r"lo|gli|grazie|ciao|mostrami|mostra|stato|"
    r"het|een|niet|bedankt|mijn|laat|zien|tonen)\b"
    r"|[äöüßñáéíóúãõçèêëïîôû]",
    re.I,
)


def detect_unsupported_message_language(text: str) -> str:
    """Return a code when the message is written outside English and Arabic.

    The reader answers in English or Arabic only, so this decides whether the
    reply needs the short note about the supported languages.
    """

    value = _language_prose(text)
    counts = _message_language_counts(value)
    supported_letters = counts["en"] + counts["ar"]
    for code, start, end in _UNSUPPORTED_SCRIPT_RANGES:
        script_count = sum(1 for char in value if start <= char <= end)
        # Two characters minimum, and the foreign script has to dominate: a
        # quoted foreign name inside an English question is not a language.
        if script_count >= 2 and script_count >= supported_letters:
            return code
    if counts["en"] >= _MIN_LANGUAGE_LETTERS:
        stopword = re.search(
            r"\b(?:le|les|des|une|est|pour|avec|merci|bonjour|salut|montrez|affichez|vous|pla[iî]t|"
            r"el|los|las|una|para|con|gracias|hola|mu[eé]strame|muestra|estado|"
            r"der|das|und|nicht|bitte|danke|sie|mir|meinen|meine|zeigen|"
            r"lo|gli|grazie|ciao|mostrami|mostra|stato|"
            r"het|een|niet|bedankt|mijn|laat|zien|tonen)\b",
            value,
            re.I,
        )
        accents = len(re.findall(r"[äöüßñáéíóúãõçèêëïîôû]", value, re.I))
        if stopword or accents >= 2:
            return "latin-other"
    return ""


def message_language_notice(language: str) -> str:
    """The note appended when the question arrived in an unsupported language."""

    return {
        "ar": (
            "ملاحظة: يدعم هذا المساعد اللغتين الإنجليزية والعربية فقط، وقد أُجيب هنا بالعربية. "
            "يمكنك إعادة السؤال بالإنجليزية أو العربية للتفاصيل نفسها."
        ),
        "en": (
            "Note: this assistant answers in English and Arabic only, and the reply above is in English. "
            "Please re-ask in English or Arabic for the same detail."
        ),
        "zh": (
            "提示：该助手仅支持英文和阿拉伯文回答，以上内容以英文给出。"
            "如需同一细节，请用英文或阿拉伯文重新提问。"
        ),
    }.get(language, (
        "Note: this assistant answers in English and Arabic only, and the reply above is in English. "
        "Please re-ask in English or Arabic for the same detail."
    ))


def response_language_for(text: str, preferred_language: str | None = None) -> str:
    """Choose the output language.

    Order: an explicit request inside the message, then the language the message
    itself is written in, then the portal language the caller selected.  The
    portal language is a fallback only: it decides when the message carries no
    decidable language (identifiers, digits, symbols or emoji only) or when two
    scripts are equally represented.
    """

    explicit = requested_response_language(text)
    if explicit in {"en", "ar"}:
        return explicit
    if explicit:
        return preferred_language if preferred_language in {"en", "ar"} else "en"

    # A question written in an unsupported language is still answered, but only
    # in English or Arabic: keep the portal's supported language when it is one
    # of those, otherwise use English.
    if detect_unsupported_message_language(text):
        return preferred_language if preferred_language in {"en", "ar"} else "en"

    detected = detect_message_language(text)
    if detected:
        return detected

    counts = _message_language_counts(text)
    eligible = {code: count for code, count in counts.items() if count >= _MIN_LANGUAGE_LETTERS}
    if eligible:
        top = max(eligible.values())
        winners = [code for code, count in eligible.items() if count == top]
        if preferred_language in winners:
            return preferred_language
        return "ar" if "ar" in winners else winners[0]

    if preferred_language in {"en", "ar"}:
        return preferred_language
    return "en"


# Runtime selection is fixed to these two generic capabilities.
DEFAULT_SKILL_DEFINITIONS: tuple[dict[str, Any], ...] = (
    {
        "skill_id": "admin_portal_reader",
        "name": "Admin Portal reader",
        "allowed_tools": ["knowledge.search", "admin.portal.read"],
        "dependencies": ["knowledge_gateway", "admin_portal_reader"],
        "content": (
            "Read the current Admin Portal state using the caller's verified GetUserInfo permissions. "
            "Use only knowledge.search and admin.portal.read. Visit only pages needed for the question, "
            "never perform a mutation, and distinguish success, no_data, no_permission, load_failed, and not_confirmed.\n"
            "RESPONSE RULES: every answer that reports portal information must also describe it - what the values mean, "
            "which page, tab or area they come from, and the scope limit that applies. When the request cannot be "
            "completed, explain what was checked, why it could not be confirmed, and the concrete next step instead of "
            "returning a bare refusal."
        ),
    },
    {
        "skill_id": "general_knowledge",
        "name": "General knowledge-base guidance",
        "allowed_tools": ["knowledge.search"],
        "dependencies": ["knowledge_gateway"],
        "content": (
            "WHEN TO USE: General knowledge-base questions outside an Admin deployment.\n"
            "DO NOT USE WHEN: The user asks for current Admin Portal page state; use admin_portal_reader.\n"
            "PREREQUISITES: Knowledge-base evidence.\n"
            "RESPONSE RULES: Answer from retrieved evidence, state limitations when evidence is unavailable, and never invent account results, policy requirements, or API capabilities."
        ),
    },
)

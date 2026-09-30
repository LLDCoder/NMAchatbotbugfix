import pytest
from pydantic import ValidationError

from app.api import message_feedback_change
from app.db import MessageFeedback
from app.schemas import MessageFeedbackCreate


def test_message_feedback_schema_accepts_vote_and_clear():
    assert MessageFeedbackCreate(rating="up").rating == "up"
    assert MessageFeedbackCreate(rating="down").rating == "down"
    assert MessageFeedbackCreate(rating=None).rating is None


def test_message_feedback_schema_rejects_unknown_rating():
    with pytest.raises(ValidationError):
        MessageFeedbackCreate(rating="neutral")


def test_message_feedback_model_targets_one_assistant_event():
    feedback = MessageFeedback(
        tenant_id="tenant",
        user_id="user",
        conversation_id="conversation",
        assistant_event_seq=7,
        rating="up",
    )
    assert feedback.assistant_event_seq == 7
    assert feedback.rating == "up"


def test_message_feedback_audit_captures_create_change_and_clear():
    changed, action, payload = message_feedback_change(None, 7, "down", "inaccurate")
    assert changed is True
    assert action == "create"
    assert payload["previousRating"] is None
    assert payload["rating"] == "down"
    assert payload["reason"] == "inaccurate"

    existing = MessageFeedback(rating="down", reason="inaccurate")
    changed, action, payload = message_feedback_change(existing, 7, "up", "irrelevant")
    assert changed is True
    assert action == "change"
    assert payload["previousReason"] == "inaccurate"
    assert payload["rating"] == "up"
    assert payload["reason"] is None

    changed, action, payload = message_feedback_change(existing, 7, None, None)
    assert changed is True
    assert action == "clear"
    assert payload["previousRating"] == "down"
    assert payload["rating"] is None


def test_message_feedback_audit_is_idempotent_for_same_state():
    existing = MessageFeedback(rating="down", reason="inaccurate")

    changed, action, payload = message_feedback_change(existing, 7, "down", "inaccurate")

    assert changed is False
    assert action == "noop"
    assert payload["previousRating"] == payload["rating"] == "down"
    assert payload["previousReason"] == payload["reason"] == "inaccurate"

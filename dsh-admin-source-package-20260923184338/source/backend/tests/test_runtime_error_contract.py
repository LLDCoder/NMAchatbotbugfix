from app.service import runtime_error_payload


def test_runtime_error_event_has_stable_code_without_exception_details() -> None:
    payload = runtime_error_payload("request-1", RuntimeError("private server diagnostic"))

    assert payload == {
        "requestId": "request-1",
        "code": "runtime_failed",
        "error": "RuntimeError",
    }
    assert "private server diagnostic" not in str(payload)

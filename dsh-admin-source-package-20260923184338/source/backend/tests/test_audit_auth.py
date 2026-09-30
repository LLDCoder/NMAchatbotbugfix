import unittest

from pydantic import ValidationError

from app.audit_auth import (
    LoginRateLimiter,
    hash_password,
    issue_session_token,
    normalize_username,
    session_token_digest,
    validate_password_policy,
    verify_password,
)
from app.schemas import AuditOperatorCreate, AuditPasswordReset


class AuditAuthenticationTests(unittest.TestCase):
    def test_password_hash_is_salted_and_verifiable(self):
        first = hash_password("ExamplePass1")
        second = hash_password("ExamplePass1")

        self.assertNotEqual(first, second)
        self.assertTrue(verify_password("ExamplePass1", first))
        self.assertFalse(verify_password("wrong-password", first))
        self.assertFalse(verify_password("ExamplePass1", "not-a-valid-hash"))

    def test_password_policy_requires_length_case_and_number(self):
        self.assertEqual(validate_password_policy("ExamplePass1"), "ExamplePass1")
        for invalid in ("Short1", "alllowercase1", "ALLUPPERCASE1", "NoNumbers"):
            with self.subTest(password=invalid), self.assertRaises(ValueError):
                validate_password_policy(invalid)

    def test_operator_schemas_apply_password_policy(self):
        operator = AuditOperatorCreate(
            username="admin-chatbot",
            displayName="Administrator",
            role="Administrator",
            password="ExamplePass1",
        )
        self.assertEqual(operator.display_name, "Administrator")
        with self.assertRaises(ValidationError):
            AuditPasswordReset(password="weakpass")

    def test_session_tokens_store_only_a_digest(self):
        token, digest = issue_session_token()

        self.assertNotEqual(token, digest)
        self.assertEqual(session_token_digest(token), digest)
        self.assertEqual(len(digest), 64)

    def test_login_rate_limiter_blocks_and_resets(self):
        limiter = LoginRateLimiter()

        self.assertIsNone(limiter.check("local\nadmin", limit=2, window_seconds=60, now=1.0))
        self.assertIsNone(limiter.check("local\nadmin", limit=2, window_seconds=60, now=2.0))
        self.assertEqual(limiter.check("local\nadmin", limit=2, window_seconds=60, now=3.0), 59)
        limiter.reset("local\nadmin")
        self.assertIsNone(limiter.check("local\nadmin", limit=2, window_seconds=60, now=4.0))

    def test_usernames_are_normalized_for_unique_lookup(self):
        self.assertEqual(normalize_username("  Admin-Chatbot  "), "admin-chatbot")


if __name__ == "__main__":
    unittest.main()

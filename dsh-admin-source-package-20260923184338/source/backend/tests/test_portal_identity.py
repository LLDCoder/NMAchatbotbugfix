from app.config import Settings


def test_admin_portal_uses_admin_user_info_endpoint() -> None:
    settings = Settings(
        umc_portal="admin",
        umc_admin_base_url="https://admin.example.test",
    )

    assert settings.umc_user_info_endpoint == "https://admin.example.test/api/AdminUser/GetUserInfo"

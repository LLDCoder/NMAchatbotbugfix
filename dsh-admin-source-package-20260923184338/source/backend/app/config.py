from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from .reader_limits import (
    MAX_PLATFORM_TIMEOUT_SECONDS,
    MAX_READER_TOTAL_TIMEOUT_SECONDS,
    MIN_PLATFORM_TIMEOUT_SECONDS,
    MIN_READER_TOTAL_TIMEOUT_SECONDS,
    READER_TOTAL_TIMEOUT_SECONDS,
)


class Settings(BaseSettings):
    app_name: str = "DSH External Service"
    environment: str = "development"
    reader_pipeline: Literal["legacy", "generic_v3"] = "legacy"
    reader_artifacts_dir: str = "/reader-artifacts"
    reader_business_timezone: str = "UTC"
    reader_routing_mode: Literal["catalog", "single"] = "catalog"
    reader_clarification_ttl_seconds: int = Field(default=1800, ge=60, le=86400)
    database_url: str = "postgresql+asyncpg://dsh:dsh@postgres:5432/dsh"
    # Deployment-only controls for instances sharing an existing database.
    database_init_enabled: bool = True
    audit_cleanup_enabled: bool = True
    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "*"
    runtime_idle_ttl_seconds: int = 900
    runtime_graceful_shutdown_seconds: int = 45
    warm_pool_min_idle: int = 1
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "deepseek-v4-flash"
    llm_timeout_seconds: float = 60.0
    reader_total_timeout_seconds: float = Field(
        default=READER_TOTAL_TIMEOUT_SECONDS,
        ge=MIN_READER_TOTAL_TIMEOUT_SECONDS,
        le=MAX_READER_TOTAL_TIMEOUT_SECONDS,
        allow_inf_nan=False,
    )
    reader_max_candidates_before_drill: int = Field(default=10, ge=1, le=32)
    # Operator-editable instructions are added to each generated system
    # prompt. Built-in language, safety, and evidence rules remain enforced.
    system_prompt: str = ""
    # UMC access is request-scoped: the frontend supplies the caller's
    # umctoken in Authorization and DSH forwards it to the anonymous proxies.
    # It is deliberately not a persisted configuration value.
    # This repository is an Admin-only deployment. Unknown legacy portal
    # variables are ignored by Settings rather than changing runtime routing.
    umc_portal: str = "admin"
    umc_admin_base_url: str = "https://umc-adminportal.sol.daypop.ai"
    # Audit records are retained independently from user-visible conversation
    # history. The sweeper runs periodically and removes expired audit rows.
    audit_retention_days: int = 30
    audit_cleanup_interval_seconds: int = 3600
    # Audit access is owner-scoped by default. An explicitly configured UMC
    # user allowlist can be granted an operator-only all-account scope.
    # Keep this disabled by default so a customer-facing console cannot read
    # other users' conversations merely by selecting the admin portal.
    audit_admin_enabled: bool = False
    audit_admin_user_ids: str = ""
    audit_bootstrap_username: str = ""
    audit_bootstrap_password: str = ""
    audit_bootstrap_display_name: str = "Administrator"
    audit_session_idle_seconds: int = 1800
    audit_session_max_age_seconds: int = 8 * 60 * 60
    audit_cookie_secure: bool = False
    audit_login_max_failures: int = 5
    audit_login_lock_seconds: int = 15 * 60
    audit_login_rate_max_attempts: int = 10
    audit_login_rate_window_seconds: int = 60
    audit_session_retention_days: int = 7
    audit_security_event_retention_days: int = 90
    knowledge_gateway_url: str = "http://knowledge-gateway:8101"
    knowledge_timeout_seconds: float = 30.0
    knowledge_retry_attempts: int = 2
    knowledge_default_folder_id: str = ""
    knowledge_top_k: int = 32
    platform_gateway_url: str = "http://platform-gateway:8102"
    platform_timeout_seconds: float = Field(
        default=50.0,
        ge=MIN_PLATFORM_TIMEOUT_SECONDS,
        le=MAX_PLATFORM_TIMEOUT_SECONDS,
        allow_inf_nan=False,
    )

    @staticmethod
    def _portal_base(value: str) -> str:
        base = (value or "").strip().rstrip("/")
        if base.lower().endswith("/login"):
            base = base[:-len("/login")].rstrip("/")
        return base

    @property
    def umc_base_url(self) -> str:
        return self._portal_base(self.umc_admin_base_url)

    @property
    def umc_portal_name(self) -> str:
        return "admin"

    @property
    def umc_user_info_endpoint(self) -> str:
        """Return the portal-specific endpoint used to validate browser tokens."""
        return f"{self.umc_base_url}/api/AdminUser/GetUserInfo"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


# This catalog drives the test console. Keep secrets explicitly marked so the
# API can mask them even when operators inspect the configuration from a
# browser. Database/Redis URLs are editable for deployment hand-off but need a
# container restart before the SQLAlchemy/Redis clients can use them.
CONFIG_CATALOG: tuple[dict[str, object], ...] = (
    {"key": "llm_base_url", "label": "LLM Base URL", "env": "LLM_BASE_URL", "secret": False, "restartRequired": False, "group": "模型"},
    {"key": "llm_api_key", "label": "LLM API Key", "env": "LLM_API_KEY", "secret": True, "restartRequired": False, "group": "模型"},
    {"key": "llm_model", "label": "模型名称", "env": "LLM_MODEL", "secret": False, "restartRequired": False, "group": "模型"},
    {"key": "llm_timeout_seconds", "label": "LLM 超时（秒）", "env": "LLM_TIMEOUT_SECONDS", "secret": False, "restartRequired": False, "group": "模型"},
    {"key": "reader_total_timeout_seconds", "label": "Portal Reader 总超时（秒）", "env": "READER_TOTAL_TIMEOUT_SECONDS", "secret": False, "restartRequired": False, "description": "包含权限、知识检索、规划和页面读取的单轮总预算。", "group": "外部 Tool"},
    {"key": "reader_max_candidates_before_drill", "label": "Reader 下钻前候选接口数", "env": "READER_MAX_CANDIDATES_BEFORE_DRILL", "secret": False, "restartRequired": False, "description": "相关且在当前网络模式下可选择的去重接口超过此数量时，最多执行一轮安全页面下钻。", "group": "外部 Tool"},
    {"key": "system_prompt", "label": "系统提示词（可编辑）", "env": "SYSTEM_PROMPT", "secret": False, "restartRequired": False, "multiline": True, "description": "作为全局追加指令注入每轮系统提示词；内置语言、安全和证据规则仍然优先。", "group": "DSH 行为"},
    {"key": "database_url", "label": "Database URL", "env": "DATABASE_URL", "secret": True, "restartRequired": True, "group": "基础设施"},
    {"key": "redis_url", "label": "Redis URL", "env": "REDIS_URL", "secret": True, "restartRequired": True, "group": "基础设施"},
    {"key": "knowledge_gateway_url", "label": "知识库 Tool URL", "env": "KNOWLEDGE_GATEWAY_URL", "secret": False, "restartRequired": False, "group": "外部 Tool"},
    {"key": "knowledge_default_folder_id", "label": "知识库默认目录 ID", "env": "KNOWLEDGE_DEFAULT_FOLDER_ID", "secret": False, "restartRequired": False, "group": "外部 Tool"},
    {"key": "knowledge_top_k", "label": "知识库 top_k", "env": "KNOWLEDGE_TOP_K", "secret": False, "restartRequired": False, "group": "外部 Tool"},
    {"key": "knowledge_timeout_seconds", "label": "知识库超时（秒）", "env": "KNOWLEDGE_TIMEOUT_SECONDS", "secret": False, "restartRequired": False, "group": "外部 Tool"},
    {"key": "platform_timeout_seconds", "label": "Portal Reader 超时（秒）", "env": "PLATFORM_TIMEOUT_SECONDS", "secret": False, "restartRequired": False, "description": "只读 Admin Portal Reader 的内部网关请求超时。", "group": "外部 Tool"},
    {"key": "umc_admin_base_url", "label": "Admin Portal Base URL", "env": "UMC_ADMIN_BASE_URL", "secret": False, "restartRequired": False, "group": "UMC Portal"},
    {"key": "audit_retention_days", "label": "链路审计留存天数", "env": "AUDIT_RETENTION_DAYS", "secret": False, "restartRequired": False, "description": "审计表保留最近 N 天；会话历史不受此项影响。", "group": "链路审计"},
    {"key": "audit_cleanup_interval_seconds", "label": "审计清理周期（秒）", "env": "AUDIT_CLEANUP_INTERVAL_SECONDS", "secret": False, "restartRequired": False, "description": "后台周期清理审计过期记录，最短按 60 秒执行。", "group": "链路审计"},
    {"key": "audit_admin_enabled", "label": "启用全局审计管理员范围", "env": "AUDIT_ADMIN_ENABLED", "secret": False, "restartRequired": False, "options": ["false", "true"], "description": "仅允许配置的管理员查看所有账号和租户的对话；默认关闭。", "group": "链路审计"},
    {"key": "audit_admin_user_ids", "label": "审计管理员 UMC 用户 ID", "env": "AUDIT_ADMIN_USER_IDS", "secret": True, "restartRequired": False, "description": "逗号分隔的 UMC User ID。仅在管理员范围开关打开且当前账号命中时生效；隔离的管理员控制台可使用 *。", "group": "链路审计"},
)


def config_catalog() -> list[dict[str, object]]:
    """Return a JSON-safe copy of the editable configuration catalog."""

    return [dict(item) for item in CONFIG_CATALOG]

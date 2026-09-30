from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, delete, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncAttrs, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import get_settings
from .console_auth import CONSOLE_PASSWORD_CONFIG_KEY, DEFAULT_CONSOLE_PASSWORD


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(AsyncAttrs, DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversation_session"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "conversation_id", name="uq_conversation_owner"),
        Index("ix_conversation_owner", "tenant_id", "user_id", "conversation_id"),
        Index("ix_conversation_audit_order", "last_activity_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    tenant_id: Mapped[str] = mapped_column(String(128), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    dsh_session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    runtime_profile: Mapped[str] = mapped_column(String(128), default="default")
    runtime_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="READY")
    last_seq: Mapped[int] = mapped_column(Integer, default=0)
    workspace: Mapped[str] = mapped_column(String(256), default="default")
    skill_profile: Mapped[str] = mapped_column(String(128), default="default")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SessionEvent(Base):
    __tablename__ = "session_event"
    __table_args__ = (
        UniqueConstraint("conversation_id", "seq", name="uq_event_sequence"),
        Index("ix_event_conversation_seq", "conversation_id", "seq"),
        Index("ix_event_owner", "tenant_id", "user_id", "conversation_id"),
        Index("ix_event_conversation_created", "conversation_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(128), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    dsh_session_id: Mapped[str] = mapped_column(String(64), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(64))
    event_json: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditRecord(Base):
    """Durable chain-of-custody record for conversation and runtime activity."""

    __tablename__ = "audit_record"
    __table_args__ = (
        Index("ix_audit_created_at", "created_at"),
        Index("ix_audit_conversation_created", "conversation_id", "created_at"),
        Index("ix_audit_conversation_category_created", "conversation_id", "category", "created_at", "id"),
        Index("ix_audit_request", "request_id"),
        Index("ix_audit_runtime", "runtime_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(128), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    dsh_session_id: Mapped[str] = mapped_column(String(64), index=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    runtime_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    record_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ReaderClarificationClaim(Base):
    """One persisted consumption per conversation/clarification, across workers."""
    __tablename__ = "reader_clarification_claim"
    conversation_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    clarification_id: Mapped[str] = mapped_column(String(192), primary_key=True)
    task_fingerprint: Mapped[str] = mapped_column(String(64))
    request_id: Mapped[str] = mapped_column(String(128))
    consumed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditOperator(Base):
    """A named account for the dedicated Admin audit console."""

    __tablename__ = "audit_operator"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(32), index=True)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", index=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditOperatorSession(Base):
    """Revocable, opaque browser session for one audit operator."""

    __tablename__ = "audit_operator_session"
    __table_args__ = (Index("ix_audit_operator_session_expiry", "expires_at", "revoked_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operator_id: Mapped[int] = mapped_column(ForeignKey("audit_operator.id", ondelete="CASCADE"), index=True)
    token_digest: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditOperatorEvent(Base):
    """Security trail for audit-console authentication and account changes."""

    __tablename__ = "audit_operator_event"
    __table_args__ = (Index("ix_audit_operator_event_created", "created_at", "id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_operator_id: Mapped[int | None] = mapped_column(ForeignKey("audit_operator.id", ondelete="SET NULL"), nullable=True, index=True)
    target_operator_id: Mapped[int | None] = mapped_column(ForeignKey("audit_operator.id", ondelete="SET NULL"), nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(254), default="")
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    remote_address: Mapped[str] = mapped_column(String(128), default="")
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MessageIdempotency(Base):
    __tablename__ = "message_idempotency"
    __table_args__ = (UniqueConstraint("conversation_id", "client_message_id", name="uq_client_message"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    client_message_id: Mapped[str] = mapped_column(String(128))
    user_event_seq: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
class MessageFeedback(Base):
    __tablename__ = "message_feedback"
    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "assistant_event_seq",
            "tenant_id",
            "user_id",
            name="uq_message_feedback_owner_response",
        ),
        Index("ix_message_feedback_owner", "tenant_id", "user_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(128), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True)
    assistant_event_seq: Mapped[int] = mapped_column(Integer)
    rating: Mapped[str] = mapped_column(String(8))
    reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ConfigEntry(Base):
    __tablename__ = "config_entry"
    __table_args__ = (UniqueConstraint("scope", "key", name="uq_config_scope_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scope: Mapped[str] = mapped_column(String(128), index=True)
    key: Mapped[str] = mapped_column(String(128))
    version: Mapped[int] = mapped_column(Integer, default=1)
    value: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), default=dict)
    updated_by: Mapped[str] = mapped_column(String(128), default="system")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Skill(Base):
    __tablename__ = "skill"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uq_skill_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(256))
    version: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(64), default="ops")
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    scope: Mapped[str] = mapped_column(String(128), default="system")
    enabled: Mapped[bool] = mapped_column(default=False)
    allowed_tools: Mapped[list[str]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), default=list)
    dependencies: Mapped[list[str]] = mapped_column(JSONB().with_variant(JSON, "sqlite"), default=list)
    content: Mapped[str] = mapped_column(Text, default="")
    updated_by: Mapped[str] = mapped_column(String(128), default="system")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


async def bootstrap_audit_operator(session: AsyncSession, settings: Any) -> bool:
    """Create the first audit Administrator from explicit deployment input."""

    bootstrap_username = settings.audit_bootstrap_username.strip()
    bootstrap_password = settings.audit_bootstrap_password
    if bool(bootstrap_username) != bool(bootstrap_password):
        raise RuntimeError("AUDIT_BOOTSTRAP_USERNAME and AUDIT_BOOTSTRAP_PASSWORD must be configured together")
    if bootstrap_password:
        from .audit_auth import validate_password_policy

        try:
            validate_password_policy(bootstrap_password)
        except ValueError as exc:
            raise RuntimeError(f"AUDIT_BOOTSTRAP_PASSWORD {exc}") from exc
    if not bootstrap_username:
        return False

    operator_count = int((await session.execute(select(func.count(AuditOperator.id)))).scalar_one())
    if operator_count != 0:
        return False

    from .audit_auth import AUDIT_ROLE_ADMINISTRATOR, hash_password, normalize_username

    username = normalize_username(bootstrap_username)
    operator = AuditOperator(
        username=username,
        display_name=settings.audit_bootstrap_display_name.strip() or username,
        password_hash=hash_password(bootstrap_password),
        role=AUDIT_ROLE_ADMINISTRATOR,
    )
    session.add(operator)
    await session.flush()
    session.add(AuditOperatorEvent(
        target_operator_id=operator.id,
        username=username,
        event_type="account.bootstrap",
        detail={"role": AUDIT_ROLE_ADMINISTRATOR},
    ))
    return True


async def purge_expired_audit_data(
    session: AsyncSession,
    settings: Any,
    *,
    now: datetime | None = None,
) -> dict[str, int]:
    current = now or datetime.now(timezone.utc)
    audit_cutoff = current - timedelta(days=max(1, int(settings.audit_retention_days)))
    session_cutoff = current - timedelta(days=max(1, int(settings.audit_session_retention_days)))
    event_cutoff = current - timedelta(days=max(1, int(settings.audit_security_event_retention_days)))

    audit_result = await session.execute(delete(AuditRecord).where(AuditRecord.created_at < audit_cutoff))
    session_result = await session.execute(delete(AuditOperatorSession).where(or_(
        AuditOperatorSession.expires_at < session_cutoff,
        AuditOperatorSession.revoked_at < session_cutoff,
    )))
    event_result = await session.execute(delete(AuditOperatorEvent).where(AuditOperatorEvent.created_at < event_cutoff))
    return {
        "auditRecords": int(audit_result.rowcount or 0),
        "operatorSessions": int(session_result.rowcount or 0),
        "operatorEvents": int(event_result.rowcount or 0),
    }


settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    # Seed the two fixed generic runtime Skills.
    from .skills import DEFAULT_SKILL_DEFINITIONS

    async with SessionLocal() as session:
        changed = await bootstrap_audit_operator(session, settings)
        console_password = await session.execute(
            select(ConfigEntry).where(
                ConfigEntry.scope == "system",
                ConfigEntry.key == CONSOLE_PASSWORD_CONFIG_KEY,
            )
        )
        if console_password.scalar_one_or_none() is None:
            session.add(
                ConfigEntry(
                    scope="system",
                    key=CONSOLE_PASSWORD_CONFIG_KEY,
                    version=1,
                    value={"value": DEFAULT_CONSOLE_PASSWORD},
                    updated_by="system",
                )
            )
            changed = True
        retained_skill_ids = tuple(definition["skill_id"] for definition in DEFAULT_SKILL_DEFINITIONS)
        removed = await session.execute(delete(Skill).where(~Skill.skill_id.in_(retained_skill_ids)))
        changed = changed or bool(removed.rowcount)
        removed_versions = await session.execute(
            delete(Skill).where(Skill.skill_id.in_(retained_skill_ids), Skill.version != 1)
        )
        changed = changed or bool(removed_versions.rowcount)
        for definition in DEFAULT_SKILL_DEFINITIONS:
            result = await session.execute(select(Skill).where(Skill.skill_id == definition["skill_id"], Skill.version == 1))
            existing_skill = result.scalar_one_or_none()
            if existing_skill:
                desired_values = {
                    "name": definition["name"],
                    "source": "builtin",
                    "status": "PUBLISHED",
                    "scope": "system",
                    "enabled": True,
                    "allowed_tools": definition["allowed_tools"],
                    "dependencies": definition["dependencies"],
                    "content": definition["content"],
                    "updated_by": "system",
                }
                for field, desired in desired_values.items():
                    if getattr(existing_skill, field) != desired:
                        setattr(existing_skill, field, desired)
                        changed = True
                continue
            session.add(
                Skill(
                    skill_id=definition["skill_id"],
                    name=definition["name"],
                    version=1,
                    source="builtin",
                    status="PUBLISHED",
                    scope="system",
                    enabled=True,
                    allowed_tools=definition["allowed_tools"],
                    dependencies=definition["dependencies"],
                    content=definition["content"],
                    updated_by="system",
                )
            )
            changed = True
        if changed:
            await session.commit()

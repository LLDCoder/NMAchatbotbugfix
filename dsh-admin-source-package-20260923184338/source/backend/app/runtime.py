import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4


RUNTIME_STATES = {"CLEAN_IDLE", "STARTING", "READY", "BUSY", "DRAINING", "CLEANING", "DEAD"}


@dataclass
class RuntimeLease:
    conversation_id: str
    profile: str
    runtime_id: str
    state: str = "STARTING"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class RuntimeManager:
    """MVP instance manager.

    The lease boundary mirrors the architecture: one logical runtime lease per
    conversation, no cross-conversation reuse, and explicit drain/cleanup states.
    A production deployment can replace ``_start_runtime`` with a Docker/K8s
    launcher without changing the API or persistence contracts.
    """

    def __init__(self, idle_ttl_seconds: int = 900) -> None:
        self.idle_ttl_seconds = idle_ttl_seconds
        self._leases: dict[str, RuntimeLease] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def lock_for(self, conversation_id: str) -> asyncio.Lock:
        return self._locks.setdefault(conversation_id, asyncio.Lock())

    async def ensure_runtime(self, conversation_id: str, profile: str) -> RuntimeLease:
        async with self.lock_for(conversation_id):
            existing = self._leases.get(conversation_id)
            if existing and existing.state in {"READY", "BUSY"}:
                existing.last_activity_at = datetime.now(timezone.utc)
                return existing
            lease = RuntimeLease(conversation_id=conversation_id, profile=profile, runtime_id=f"rt_{uuid4().hex[:16]}")
            self._leases[conversation_id] = lease
            await asyncio.sleep(0)
            lease.state = "READY"
            return lease

    async def mark_busy(self, conversation_id: str) -> RuntimeLease | None:
        async with self.lock_for(conversation_id):
            lease = self._leases.get(conversation_id)
            if lease:
                lease.state = "BUSY"
                lease.last_activity_at = datetime.now(timezone.utc)
            return lease

    async def release(self, conversation_id: str) -> None:
        async with self.lock_for(conversation_id):
            lease = self._leases.get(conversation_id)
            if lease:
                lease.state = "DRAINING"
                await asyncio.sleep(0)
                lease.state = "CLEANING"
                self._leases.pop(conversation_id, None)

    def get(self, conversation_id: str) -> RuntimeLease | None:
        return self._leases.get(conversation_id)

    async def sweep(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [
            conversation_id
            for conversation_id, lease in self._leases.items()
            if lease.state == "READY" and (now - lease.last_activity_at).total_seconds() > self.idle_ttl_seconds
        ]
        for conversation_id in expired:
            await self.release(conversation_id)


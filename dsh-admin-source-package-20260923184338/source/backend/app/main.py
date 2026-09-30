import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import make_router
from .config import get_settings
from .console_auth import ConsoleAuthMiddleware
from .db import ConfigEntry, SessionLocal, init_db
from .llm import LLMAdapter
from .knowledge import KnowledgeGatewayClient
from .platform import PlatformGatewayClient
from .runtime import RuntimeManager
from .service import DSHService, EventBroker
from sqlalchemy import select


settings = get_settings()
runtime_manager = RuntimeManager(settings.runtime_idle_ttl_seconds)
broker = EventBroker()
llm = LLMAdapter(settings)
knowledge = KnowledgeGatewayClient(settings)
platform = PlatformGatewayClient(settings)
service = DSHService(runtime_manager, llm, broker, knowledge, platform)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_init_enabled:
        await init_db()
    # Re-apply operator-managed live settings after every container restart.
    # The DB/Redis URLs remain restart-only because their pools are constructed
    # before the application lifespan begins.
    async with SessionLocal() as db:
        entries = list((await db.execute(select(ConfigEntry).where(ConfigEntry.scope == "system"))).scalars().all())
        await service.apply_config_entries(entries)
    stop = asyncio.Event()

    async def sweeper() -> None:
        while not stop.is_set():
            await asyncio.sleep(30)
            await runtime_manager.sweep()

    async def audit_sweeper() -> None:
        while not stop.is_set():
            with suppress(Exception):
                await service.purge_expired_audit()
            interval = max(60, int(service.settings.audit_cleanup_interval_seconds))
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue

    task = asyncio.create_task(sweeper())
    tasks = [task]
    if settings.audit_cleanup_enabled:
        tasks.append(asyncio.create_task(audit_sweeper()))
    try:
        yield
    finally:
        stop.set()
        for background_task in tasks:
            background_task.cancel()
        for background_task in tasks:
            with suppress(asyncio.CancelledError):
                await background_task


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(ConsoleAuthMiddleware, get_password=lambda: service.console_password)
app.include_router(make_router(service))


@app.get("/healthz")
async def healthz():
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "readerPipeline": service.settings.reader_pipeline,
        "llmConfigured": bool(service.settings.llm_base_url and service.settings.llm_api_key),
        "runtimeMode": "embedded-lease-mvp",
        "umcPortal": settings.umc_portal_name,
        "umcBaseUrl": settings.umc_base_url,
        "knowledgeGateway": settings.knowledge_gateway_url,
        "platformGateway": settings.platform_gateway_url,
    }


@app.get("/")
async def root():
    return {"service": settings.app_name, "docs": "/docs", "health": "/healthz"}

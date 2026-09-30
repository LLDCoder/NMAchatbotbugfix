import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app import main
from app.config import Settings


class SharedDatabaseStartupTests(unittest.IsolatedAsyncioTestCase):
    async def run_lifespan(self, initialize, cleanup, fail=False):
        settings = Settings(database_init_enabled=initialize, audit_cleanup_enabled=cleanup)
        entry = object()
        db = AsyncMock()
        db.execute.return_value = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [entry]))
        session = AsyncMock()
        session.__aenter__.return_value = db
        service = SimpleNamespace(settings=settings, apply_config_entries=AsyncMock(), purge_expired_audit=AsyncMock())
        with patch.object(main, 'settings', settings), patch.object(main, 'service', service), patch.object(main, 'SessionLocal', return_value=session), patch.object(main, 'init_db', new_callable=AsyncMock) as init:
            before = set(asyncio.all_tasks())
            try:
                async with main.lifespan(main.app):
                    await asyncio.sleep(0)
                    service.apply_config_entries.assert_awaited_once_with([entry])
                    self.assertEqual(init.await_count, int(initialize))
                    self.assertEqual(service.purge_expired_audit.await_count, int(cleanup))
                    if fail:
                        raise RuntimeError('shutdown test')
            except RuntimeError:
                if not fail:
                    raise
            await asyncio.sleep(0)
            self.assertEqual(set(asyncio.all_tasks()), before)

    async def test_shared_database_preserves_config_without_bootstrap_or_cleanup(self):
        await self.run_lifespan(False, False)

    async def test_existing_default_startup_behavior(self):
        await self.run_lifespan(True, True)

    async def test_background_tasks_stop_on_exception(self):
        await self.run_lifespan(False, True, fail=True)

    async def test_database_entries_cannot_enable_deployment_only_flags(self):
        settings = Settings(database_init_enabled=False, audit_cleanup_enabled=False)
        with patch.object(main.service, 'settings', settings):
            entries = [SimpleNamespace(key=key, value={'value': True}) for key in ('database_init_enabled', 'audit_cleanup_enabled')]
            await main.service.apply_config_entries(entries)
            self.assertFalse(settings.database_init_enabled)
            self.assertFalse(settings.audit_cleanup_enabled)

#!/usr/bin/env python3
"""NMA local Agent and remote-interface debug launchers (Python 3.10+)."""
import argparse
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PORTAL = ROOT / 'navigation-knowledge/sources/umc-admin-portal-target'
RUNTIME = HERE / 'runtime'
PORTS = {'local': 18086, 'debug': 18087}


def run(args, **kwargs):
    return subprocess.run([str(x) for x in args], check=True, **kwargs)


def read_env(mode):
    path = HERE / f'.env.{mode}'
    if not path.exists():
        raise SystemExit(f'Missing {path}. Run: python3 test/env.py init')
    result = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            key, value = line.split('=', 1)
            result[key] = value.strip().strip("'\"")
    return result


def compose(*args, **kwargs):
    return run(['docker', 'compose', '-p', 'nma-admin-local', '--env-file',
                HERE / '.env.local', '-f', HERE / 'compose.yml', '-f',
                HERE / 'compose.local.yml', *args], **kwargs)


def init(modes=('local', 'debug')):
    RUNTIME.mkdir(exist_ok=True)
    shared = {
        'UMC_ADMIN_BASE_URL': 'http://77.242.240.158:18081',
        'KNOWLEDGE_BASE_URL': 'http://77.242.240.158:18085/api/platform/api/v1',
        'KNOWLEDGE_PUBLIC_PATH': '/public/knowledge',
    }
    configurations = {
        'local': {**shared, 'ENVIRONMENT': 'local', 'POSTGRES_PASSWORD': secrets.token_hex(24),
            'KNOWLEDGE_BASE_URL': 'http://host.docker.internal:28001',
            'KNOWLEDGE_PUBLIC_PATH': '/api/knowledge',
            'KNOWLEDGE_SEARCH_CONTRACT': 'mailgraph',
            'KNOWLEDGE_REQUIRED_CHANNELS': 'bm25,vector,graph',
            'KNOWLEDGE_GATEWAY_TOKEN': '',
            'KNOWLEDGE_SUBJECT_ID': 'nma-local-agent',
            'KNOWLEDGE_TENANT_ID': 'knowledge_default',
            'KNOWLEDGE_SUBJECT_ROLES': 'viewer',
            'AUDIT_BOOTSTRAP_USERNAME': 'admin-chatbot',
            'AUDIT_BOOTSTRAP_PASSWORD': os.environ.get('NMA_AUDIT_PASSWORD') or secrets.token_urlsafe(20) + 'aA1!',
            'CONSOLE_BOOTSTRAP_PASSWORD': secrets.token_urlsafe(32),
            'AUDIT_COOKIE_SECURE': 'false',
            'CORS_ORIGINS': 'http://localhost:18086,http://127.0.0.1:18086',
            'PLATFORM_BASE_URL': 'http://77.242.240.158:18085/api/platform',
            'KNOWLEDGE_DEFAULT_FOLDER_ID': '34a89aa7b43b473d8326cf6540fc3894',
            'LLM_BASE_URL': 'https://api.deepseek.com', 'LLM_MODEL': 'deepseek-v4-flash', 'LLM_API_KEY': '',
            'NMA_TEST_ACCOUNT': '', 'NMA_TEST_PASSWORD': ''},
        'debug': {**shared, 'DSH_API_TARGET': 'http://77.242.240.158:18081/dsh-api',
            'DSH_CONSOLE_TARGET': 'http://77.242.240.158:18081/dsh-audit'},
    }
    for mode in modes:
        values = configurations[mode]
        path = HERE / f'.env.{mode}'
        if path.exists():
            print(f'Keep existing {path.name}')
            continue
        with open(path, 'x', opener=lambda p, flags: os.open(p, flags, 0o600)) as f:
            f.write('# Private runtime configuration. Never commit or publish.\n')
            f.write(''.join(f"{k}='{v}'\n" for k, v in values.items()))
        print(f'Created {path.name} (mode 600)')


def portal_pid(mode):
    p = RUNTIME / f'portal-{mode}.pid'
    if not p.exists(): return None
    pid = int(p.read_text())
    try:
        command = subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True)
        return pid if str(PORTAL / 'node_modules/vite/bin/vite.js') in command and f'--port {PORTS[mode]}' in command else None
    except subprocess.CalledProcessError:
        return None


def portal_start(mode):
    if portal_pid(mode):
        print(f'{mode} Portal already running on port {PORTS[mode]}; restart to reload .env changes.')
        return
    with socket.socket() as s:
        if s.connect_ex(('127.0.0.1', PORTS[mode])) == 0:
            raise SystemExit(f'Port {PORTS[mode]} is occupied by another process; it was not stopped.')
    if not (PORTAL / 'node_modules/vite/bin/vite.js').exists():
        run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=PORTAL, env={**os.environ, 'HUSKY': '0'})
    conf = read_env(mode)
    env = {**os.environ, 'VITE_API_BASE_URL': '', 'VITE_DSH_API_BASE_URL': '/dsh-api',
           '__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS': 'host.docker.internal',
           'VITE_AI_CHATBOT_ENABLED': 'true',
           'VITE_NMA_ENVIRONMENT': mode, 'VITE_CACHE_DIR': f'node_modules/.vite-nma-{mode}',
           'VITE_API_PROXY_TARGET': conf['UMC_ADMIN_BASE_URL'],
           'VITE_ADMIN_SWAGGER_PROXY_TARGET': conf['UMC_ADMIN_BASE_URL'],
           'VITE_DSH_PROXY_TARGET': conf.get('DSH_API_TARGET', 'http://127.0.0.1:8001'),
           'VITE_DSH_CONSOLE_PROXY_TARGET': conf.get('DSH_CONSOLE_TARGET', 'http://127.0.0.1:18112'),
           'VITE_NMA_AUDIT_ASSETS_DIR': str(ROOT / 'dsh-admin-source-package-20260923184338/source/frontend') if mode == 'debug' else '',
           'VITE_DEV_SERVER_PORT': str(PORTS[mode])}
    RUNTIME.mkdir(exist_ok=True)
    with (RUNTIME / f'portal-{mode}.log').open('ab') as log:
        proc = subprocess.Popen(['node', str(PORTAL / 'node_modules/vite/bin/vite.js'),
                                 '--mode', 'daypopdevelopment', '--host', '127.0.0.1',
                                 '--port', str(PORTS[mode]), '--strictPort'],
                                cwd=PORTAL, env=env, stdin=subprocess.DEVNULL,
                                stdout=log, stderr=log, start_new_session=True)
    (RUNTIME / f'portal-{mode}.pid').write_text(str(proc.pid))
    for _ in range(60):
        if proc.poll() is not None:
            raise SystemExit(f'Portal failed; see test/runtime/portal-{mode}.log')
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORTS[mode]}/__env/meta.json', timeout=2) as response:
                if json.load(response)['environment'] == mode:
                    host = 'localhost' if mode == 'local' else '127.0.0.1'
                    print(f'{mode}: http://{host}:{PORTS[mode]}/__env/')
                    return
        except (OSError, ValueError, KeyError):
            time.sleep(1)
    raise SystemExit(f'Portal startup timed out; inspect test/runtime/portal-{mode}.log')


def portal_stop(mode):
    pid = portal_pid(mode)
    if pid:
        os.killpg(pid, signal.SIGTERM)
        for _ in range(100):
            with socket.socket() as probe:
                if probe.connect_ex(('127.0.0.1', PORTS[mode])) != 0:
                    break
            time.sleep(0.1)
        else:
            raise SystemExit(f'Portal {mode} did not release its port after SIGTERM.')
    (RUNTIME / f'portal-{mode}.pid').unlink(missing_ok=True)


def check(mode):
    conf = read_env(mode)
    base = f'http://127.0.0.1:{PORTS[mode]}'
    failures = []
    for path, content_type in [('/', 'text/html'), ('/__env/', 'text/html'),
            ('/__env/meta.json', 'application/json'), ('/dsh-audit/', 'text/html'),
            ('/dsh-audit/styles.css', 'text/css'), ('/dsh-audit/audit-app.js', 'javascript'),
            ('/swagger/index.html', 'text/html'), ('/dsh-audit/healthz', 'application/json'),
            ('/dsh-api/api/v1/console/session', 'application/json')]:
        try:
            with urllib.request.urlopen(base + path, timeout=30) as response:
                data = response.read()
                assert response.status == 200 and content_type in response.headers.get('Content-Type', '') and data
                if path == '/__env/': assert b'NMA / LAB' in data
                if path == '/__env/meta.json': assert json.loads(data)['environment'] == mode
                if path == '/dsh-audit/healthz':
                    health = json.loads(data)
                    assert health['status'] == 'ok' and health['umcPortal'] == 'admin'
                    if mode == 'local':
                        assert health['environment'] == mode
                        print('Local LLM configured:', health['llmConfigured'])
                print('PASS', path)
        except Exception as exc:
            failures.append(path)
            print('FAIL', path, str(exc))
    # A missing asset must not silently return SPA HTML.
    try:
        urllib.request.urlopen(base + '/dsh-audit/nma-missing-asset.css', timeout=15)
        failures.append('missing asset returned 200')
    except urllib.error.HTTPError as exc:
        if exc.code != 404: failures.append('missing asset did not return 404')
    if mode == 'local':
        probe = "import urllib.request,json; r=urllib.request.urlopen('http://localhost:8101/folders/tree',timeout=35); x=json.load(r); assert isinstance(x.get('items'),list); print('PASS remote knowledge via local gateway, folders:',len(x['items']))"
        try: compose('exec', '-T', 'knowledge-gateway', 'python', '-c', probe)
        except subprocess.CalledProcessError: failures.append('knowledge upstream')
    else:
        try:
            with urllib.request.urlopen(conf['KNOWLEDGE_BASE_URL'] + conf['KNOWLEDGE_PUBLIC_PATH'] + '/folders/tree', timeout=35) as response:
                assert isinstance(json.load(response)['items'], list)
            print('PASS remote knowledge endpoint')
        except Exception as exc:
            print('FAIL remote knowledge', str(exc)); failures.append('remote knowledge')
    if failures: raise SystemExit('Failed checks: ' + ', '.join(failures))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'up', 'down', 'restart', 'status', 'check', 'build', 'portal'])
    parser.add_argument('mode', nargs='?', choices=['local', 'debug', 'all'], default='all')
    args = parser.parse_args()
    modes = ('local', 'debug') if args.mode == 'all' else (args.mode,)
    if args.command == 'init': return init(modes)
    for mode in modes:
        if args.command in ('up', 'restart'):
            if args.command == 'restart': portal_stop(mode)
            if mode == 'local': compose('up', '-d', '--build', '--wait', '--wait-timeout', '180')
            portal_start(mode)
        elif args.command == 'portal': portal_start(mode)
        elif args.command == 'down':
            portal_stop(mode)
            if mode == 'local': compose('down')
        elif args.command == 'status':
            if mode == 'local': compose('ps')
            print(mode, 'Portal PID:', portal_pid(mode) or 'stopped')
        elif args.command == 'check': check(mode)
        elif args.command == 'build':
            if mode == 'local': compose('build')
            else: print('Debug uses remote services; no backend build needed.')


if __name__ == '__main__':
    try: main()
    except subprocess.CalledProcessError as exc: raise SystemExit(exc.returncode)

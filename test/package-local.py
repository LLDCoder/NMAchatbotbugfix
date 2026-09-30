#!/usr/bin/env python3
"""Build a relocatable local-development ZIP without personal runtime configuration."""
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path('dsh-admin-source-package-20260923184338/source')
PORTAL = Path('navigation-knowledge/sources/umc-admin-portal-target')
EXCLUDED_DIRS = {'.git', 'node_modules', '__pycache__', '.pytest_cache', '.venv', 'venv', 'dist', 'runtime', 'testlog', 'releases', 'output', 'outputs'}
NODE = os.environ.get('NMA_PACKAGE_NODE', 'node')


def excluded(path):
    return (any(part in EXCLUDED_DIRS for part in path.parts) or path.name == '.DS_Store'
            or path.name.startswith('.env') or '.bak' in path.name or '-workbook-current' in path.name
            or path.suffix in {'.pyc', '.log', '.pid', '.zip', '.tar', '.gz', '.pem', '.p12', '.pfx', '.orig', '.rej'}
            or path.name.startswith('~$'))


def checked_source(path):
    relative = path.relative_to(ROOT)
    current = ROOT
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise RuntimeError('Symlink requires explicit packaging review: ' + str(relative))
    if not path.resolve().is_relative_to(ROOT.resolve()):
        raise RuntimeError('Source escapes package workspace: ' + str(relative))
    return path


def verify_hash(path, digest):
    checked_source(path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise RuntimeError('Source differs from delivery snapshot: ' + str(path.relative_to(ROOT)))


def source_path_aliases(planned, records):
    """Permit case-only logical paths only for one identical physical source."""
    canonical, aliases = {}, {}
    for target in sorted(planned):
        prior = canonical.setdefault(target.casefold(), target)
        if prior == target:
            continue
        if (not planned[target].samefile(planned[prior])
                or records[target]['sha256'] != records[prior]['sha256']):
            raise RuntimeError('Conflicting case-insensitive package paths: ' + target)
        aliases[target] = {'target': prior, 'sha256': records[target]['sha256']}
    return aliases


def build(*, plan_only=False):
    snapshot = json.loads((ROOT / 'test/delivery-snapshot.json').read_text())
    version = snapshot['codeVersion']
    regression = snapshot['backendRegression']
    # Refuse a stale version label before creating an archive.
    for relative, digest in snapshot['sourceFiles'].items():
        if not excluded(Path(relative)):
            verify_hash(ROOT / SOURCE / relative, digest)
    for relative, digest in snapshot['knowledge']['files'].items():
        verify_hash(ROOT / 'navigation-knowledge/artifacts' / relative, digest)
    for relative, digest in snapshot.get('portalFiles', {}).items():
        verify_hash(ROOT / PORTAL / relative, digest)
    name = 'AIChatbot-source-' + datetime.now().strftime('%Y%m%d-%H%M%S')
    releases = ROOT / 'outputs/code-share'
    destination = releases / name
    copied = {}
    planned = {}

    def copy_file(source, target):
        checked_source(source)
        planned[str(target)] = source

    def copy_tree(relative, target=None):
        base = checked_source(ROOT / relative)
        for current, dirs, files in os.walk(base):
            dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
            for directory in dirs:
                checked_source(Path(current) / directory)
            for filename in sorted(files):
                path = Path(current) / filename
                child = path.relative_to(base)
                if not excluded(child):
                    copy_file(path, Path(target or relative) / child)

    for component in ['backend', 'frontend', 'platform-gateway', 'knowledge-gateway', 'ocr-cpu', 'ocr-gateway']:
        copy_tree(SOURCE / component)
    for directory in ['src', 'public', 'build', 'scripts', 'patches', 'checkChinese', '.husky', '.agents']:
        copy_tree(PORTAL / directory)
    for filename in ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'index.html', 'vite.config.ts',
                     'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'eslint.config.js',
                     'postcss.config.js', '.gitignore', 'AGENTS.md', 'SECURITY.md']:
        copy_file(ROOT / PORTAL / filename, PORTAL / filename)
    copy_tree(Path('navigation-knowledge/artifacts/KB/pages'))
    for source in (ROOT / 'navigation-knowledge/artifacts/KB').iterdir():
        if source.is_file() and source.suffix in {'.json', '.md'}:
            copy_file(source, source.relative_to(ROOT))
    copy_file(ROOT / 'navigation-knowledge/artifacts/page-catalog.json', Path('navigation-knowledge/artifacts/page-catalog.json'))
    copy_tree(Path('test/nginx'))
    for filename in ['env.py', 'local.py', 'compose.yml', 'compose.local.yml', 'Dockerfile.python',
                     'start-local.command', 'run-generic-reader.mjs', 'export-page-knowledge.mjs',
                     'package-local.py', 'verify-package.py', 'README.share.md', 'run-reader-regressions.py', '.gitignore']:
        copy_file(ROOT / 'test' / filename, Path('test') / filename)
    plan = Path('test/design/generic-reader-v3/代码修改方案-需求覆盖.md')
    copy_file(ROOT / plan, plan)
    copy_file(ROOT / '.dockerignore', Path('.dockerignore'))
    copy_file(ROOT / 'test/README.share.md', Path('README.md'))
    copy_file(ROOT / 'test/README.share.md', Path('test/README.local.md'))
    copy_file(ROOT / 'test/delivery-snapshot.json', Path('DELIVERY_STATE.json'))
    copy_file(ROOT / 'test/delivery-snapshot.json', Path('test/delivery-snapshot.json'))

    # Include only the reference files linked from maintained page knowledge, not a remote backend deployment.
    for knowledge in (ROOT / 'navigation-knowledge/artifacts/KB/pages').glob('*/*/*.json'):
        bundle = json.loads(knowledge.read_text())
        for record in bundle.get('records', []):
            for source in record.get('sources', []):
                ref = source.get('reference', '')
                reference = Path(re.split(r'#|:(?=\d|L\d)', ref)[0])
                if (str(reference).startswith('navigation-knowledge/sources/adminportalservice/')
                        and reference.suffix == '.cs' and '..' not in reference.parts
                        and str(reference) not in planned and (ROOT / reference).is_file()):
                    copy_file(ROOT / reference, reference)

    # Preserve explicitly reviewed source snapshots referenced by page knowledge.
    # This is a file allowlist; runtime directories and conversation evidence stay excluded.
    supplemental = snapshot.get('supplementarySourceEvidence', {})
    for relative, digest in supplemental.items():
        reference = Path(relative)
        if (reference.is_absolute() or '..' in reference.parts
                or reference.parts[:2] != ('test', 'runtime')
                or 'source-evidence' not in reference.parts
                or not (reference.suffix == '.cs' or reference.name == 'provenance.json')):
            raise RuntimeError('Unreviewed supplementary source path: ' + relative)
        source = checked_source(ROOT / reference)
        if not re.fullmatch(r'[0-9a-f]{64}', digest) or hashlib.sha256(source.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Supplementary source changed: ' + relative)
        copy_file(source, reference)

    env_names = ['.env.daypopdevelopment', '.env.daypopproduction', '.env.nma-development', '.env.nma-production', '.env.nma-staging']
    records = {target: {'source': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
               for target, source in planned.items()}
    path_aliases = source_path_aliases(planned, records)
    # The state file carries this map and cannot include its own hash.
    snapshot_targets = {'DELIVERY_STATE.json', 'test/delivery-snapshot.json'}
    packaging_files = {target: record for target, record in records.items() if target not in snapshot_targets}
    client_env_inputs = {str(PORTAL / name): hashlib.sha256(checked_source(ROOT / PORTAL / name).read_bytes()).hexdigest()
                         for name in env_names}
    if plan_only:
        return {'packagingFiles': packaging_files, 'clientEnvInputHashes': client_env_inputs,
                'packagingPathAliases': path_aliases}
    if packaging_files != snapshot.get('packagingFiles'):
        raise RuntimeError('Package input set or content differs from the frozen delivery snapshot')
    if client_env_inputs != snapshot.get('clientEnvInputHashes'):
        raise RuntimeError('Client environment inputs differ from the frozen delivery snapshot')
    if path_aliases != snapshot.get('packagingPathAliases', {}):
        raise RuntimeError('Logical source path aliases differ from the frozen delivery snapshot')
    destination.mkdir(parents=True, exist_ok=False)
    for target, source in planned.items():
        verify_hash(source, records[target]['sha256'])
        output = destination / target
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(source.read_bytes())
        output.chmod(0o755 if os.access(source, os.X_OK) else 0o644)
        copied[target] = records[target]

    for env_name in env_names:
        public_env = []
        for line in (ROOT / PORTAL / env_name).read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if re.search(r'API_KEY|PASSWORD|SECRET|TOKEN', key, re.I):
                value = ''
            public_env.append(key + '=' + value)
        (destination / PORTAL / env_name).write_text(
            '# Public client configuration. Optional API keys are deliberately empty.\n' + '\n'.join(public_env) + '\n')
    (destination / 'test/README.md').write_text('# 本机开发\n\n启动与配置见 [开发包说明](../README.md)。仅使用 `python3 test/local.py <command>`。\n')
    (destination / '.gitignore').write_text('**/node_modules/\n**/__pycache__/\n**/dist/\n**/.env.local\n**/.env.debug\ntest/runtime/\ntest/releases/\n.DS_Store\n')

    # Scan against known private values without printing their contents.
    private_values = set()
    for config in [ROOT / 'test/.env.local', ROOT / 'test/.env.debug', *(ROOT / PORTAL).glob('.env.*')]:
        if not config.exists():
            continue
        for line in config.read_text().splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key, value = line.split('=', 1)
            value = value.strip().strip('\"\'')
            if re.search(r'PASSWORD|SECRET|TOKEN|API_KEY', key, re.I) and len(value) >= 8:
                private_values.add(value.encode())
    high_confidence_key = re.compile(rb'(?<![A-Za-z0-9_-])(?:sk-[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,})(?![A-Za-z0-9_-])|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
    for path in destination.rglob('*'):
        if not path.is_file():
            continue
        data = path.read_bytes()
        if any(secret in data for secret in private_values) or high_confidence_key.search(data):
            raise RuntimeError('Credential scan requires review: ' + str(path.relative_to(destination)))

    validation = {'scope': version + ' local development source handoff; no remote deployment', 'checks': {},
                  'limits': ['No full fresh-machine image build or business acceptance run in this packaging check.',
                             str(regression['failed']) + ' known regression failures remain; business acceptance is incomplete. See DELIVERY_STATE.json.']}
    count = 0
    for path in destination.rglob('*.py'):
        ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path.relative_to(destination)))
        count += 1
    validation['checks']['pythonSyntaxFiles'] = count
    for file in ['test/run-generic-reader.mjs', 'test/export-page-knowledge.mjs']:
        subprocess.run([NODE, '--check', str(destination / file)], check=True, capture_output=True)
    validation['checks']['nodeScriptSyntax'] = 'passed'
    # Build the actual staged, sanitized frontend using the already installed
    # locked dependencies. The temporary link and bundle are never archived.
    installed_modules = ROOT / PORTAL / 'node_modules'
    if (installed_modules / 'vite/bin/vite.js').is_file():
        stage_modules = destination / PORTAL / 'node_modules'
        stage_modules.symlink_to(installed_modules, target_is_directory=True)
        try:
            with tempfile.TemporaryDirectory(prefix='nma-package-frontend-') as temporary:
                result = subprocess.run([NODE, str(installed_modules / 'vite/bin/vite.js'),
                    'build', '--mode', 'nma-development', '--outDir', str(Path(temporary) / 'dist')],
                    cwd=destination / PORTAL, env={**os.environ, 'DISABLE_ESLINT_PLUGIN': 'true'},
                    capture_output=True, text=True)
                if result.returncode:
                    raise RuntimeError('Staged frontend build failed: ' + result.stderr[-3000:])
                validation['checks']['stagedSanitizedFrontendBuild'] = 'passed using existing installed dependencies; not a fresh install'
                with socket.socket() as probe:
                    probe.bind(('127.0.0.1', 0))
                    port = probe.getsockname()[1]
                with open(Path(temporary) / 'vite.log', 'w') as log:
                    process = subprocess.Popen([NODE, str(installed_modules / 'vite/bin/vite.js'),
                        '--mode', 'daypopdevelopment', '--host', '127.0.0.1', '--port', str(port), '--strictPort'],
                        cwd=destination / PORTAL, env={**os.environ,
                            '__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS': 'host.docker.internal',
                            'VITE_NMA_ENVIRONMENT': 'local'}, stdout=log, stderr=log)
                    try:
                        for attempt in range(30):
                            try:
                                request = urllib.request.Request(f'http://127.0.0.1:{port}/',
                                    headers={'Host': f'host.docker.internal:{port}'})
                                with urllib.request.urlopen(request, timeout=2) as response:
                                    assert response.status == 200 and b'<html' in response.read().lower()
                                validation['checks']['dockerHostHeaderOnStagedPortal'] = 'passed on isolated temporary Vite port'
                                break
                            except (OSError, AssertionError):
                                if process.poll() is not None or attempt == 29:
                                    raise RuntimeError('Staged Portal Docker host header check failed')
                                time.sleep(0.2)
                    finally:
                        process.terminate()
                        try:
                            process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            process.kill(); process.wait()
        finally:
            stage_modules.unlink()
    # Initialize a separate temporary copy so generated secrets cannot enter the delivery archive.
    with tempfile.TemporaryDirectory(prefix='nma-local-init-') as temporary:
        temporary_root = Path(temporary)
        shutil.copytree(destination / 'test', temporary_root / 'test')
        subprocess.run([sys.executable, str(temporary_root / 'test/local.py'), 'init'], check=True, capture_output=True)
        local_config = temporary_root / 'test/.env.local'
        assert local_config.exists() and not (temporary_root / 'test/.env.debug').exists()
        before = local_config.read_bytes()
        subprocess.run([sys.executable, str(temporary_root / 'test/local.py'), 'init'], check=True, capture_output=True)
        assert local_config.read_bytes() == before
        assert local_config.stat().st_mode & 0o777 == 0o600
        subprocess.run(['docker', 'compose', '--env-file', str(local_config), '-f', str(destination / 'test/compose.yml'),
                        '-f', str(destination / 'test/compose.local.yml'), 'config', '--quiet'], check=True, capture_output=True)
    validation['checks'].update(localOnlyInitialization='passed', configPreservedOnReinit='passed',
        privateConfigMode='0600', composeConfiguration='passed', knownCredentialScan='passed',
        debugConfigIncluded=False, runtimeDataIncluded=False,
        supplementarySourceEvidenceFiles=len(supplemental), logicalSourcePathAliases=len(path_aliases))
    (destination / 'PACKAGE_VALIDATION.json').write_text(json.dumps(validation, ensure_ascii=False, indent=2) + '\n')

    for relative, origin in copied.items():
        if hashlib.sha256((ROOT / origin['source']).read_bytes()).hexdigest() != origin['sha256']:
            raise RuntimeError('Source changed while packaging: ' + origin['source'])
    for relative, digest in client_env_inputs.items():
        verify_hash(ROOT / relative, digest)
    # Keep every reviewed logical path, even if the local filesystem stores
    # case-only aliases as a single file. Their bytes were verified identical.
    logical = {str(path.relative_to(destination)): path for path in destination.rglob('*') if path.is_file()}
    copied_casefold = {relative.casefold() for relative in copied}
    logical = {relative: path for relative, path in logical.items() if relative.casefold() not in copied_casefold}
    logical.update({relative: destination / relative for relative in copied})
    files = []
    for relative, path in sorted(logical.items()):
        files.append({'path': relative, 'size': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                      **({'source': copied[relative]['source']} if relative in copied else {'generated': True}),
                      **({'aliasOf': path_aliases[relative]['target']} if relative in path_aliases else {})})
    manifest = {'package': name, 'createdAt': datetime.now().astimezone().isoformat(), 'files': files,
                'excluded': ['private runtime env', 'debug startup configuration', 'database volumes', 'raw test evidence',
                             'node_modules', 'build artifacts', 'backup files', 'remote deployment configuration'],
                'generated': ['local handoff README', 'client env with optional API key values emptied', 'validation record'],
                'caseInsensitiveSourceAliases': path_aliases}
    (destination / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    checksums = [f"{item['sha256']}  {item['path']}" for item in files]
    checksums.append(hashlib.sha256((destination / 'MANIFEST.json').read_bytes()).hexdigest() + '  MANIFEST.json')
    (destination / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n')
    subprocess.run([sys.executable, str(destination / 'test/verify-package.py')], check=True, capture_output=True)
    archive = releases / (name + '.zip')
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zip_file:
        for relative in sorted([item['path'] for item in files] + ['MANIFEST.json', 'SHA256SUMS']):
            zip_file.write(destination / relative, Path(name) / relative)
    with zipfile.ZipFile(archive) as zip_file:
        assert zip_file.testzip() is None
    sha = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(sha + '  ' + archive.name + '\n')
    print(json.dumps({'archive': str(archive), 'sizeBytes': archive.stat().st_size, 'sha256': sha,
                      'files': len(files), 'directory': str(destination), 'validation': validation}, ensure_ascii=False))


if __name__ == '__main__':
    build()

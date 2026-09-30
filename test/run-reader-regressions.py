"""Run current mounted app against current host tests, not baked image tests."""
from pathlib import Path
import subprocess
import uuid
import sys
import re

root=Path(__file__).resolve().parents[1]
source=root/'dsh-admin-source-package-20260923184338/source'
container='nma-admin-local-backend-1'
target='/tmp/reader-tests-'+uuid.uuid4().hex

def run(*args):
    return subprocess.run(args,check=True)

check=subprocess.run(['docker','exec',container,'python','-c','import pytest'],capture_output=True)
if check.returncode:
    raise SystemExit('Install the test dependency in the local backend container: docker exec nma-admin-local-backend-1 pip install pytest==9.1.1')
try:
    run('docker','exec',container,'mkdir','-p',target+'/backend/tests',target+'/platform-gateway')
    run('docker','cp',str(source/'backend/tests')+'/.',container+':'+target+'/backend/tests/')
    run('docker','cp',str(source/'platform-gateway/app.py'),container+':'+target+'/platform-gateway/app.py')
    run('docker','cp',str(source/'platform-gateway/config'),container+':'+target+'/platform-gateway/config')
    files=['test_reader_generic_completion.py','test_reader_execution_flow.py','test_reader_routing_v03.py','test_generic_reader_v3.py','test_reader_context_v3.py',
           'test_reader_requirement_coverage.py','test_reader_retrieval_coverage.py','test_projected_collection.py','test_audit_and_reader_regression.py',
           'test_reader_knowledge_envelope.py','test_reader_knowledge_compound.py','test_reader_answer_acceptance.py']
    if sys.argv[1:]:
        files = sys.argv[1:]
        if any(not re.fullmatch(r'test_[a-z0-9_]+\.py', name) for name in files):
            raise SystemExit('Pass test filenames from backend/tests only.')
    run('docker','exec','-e','PYTHONPATH=/app:'+target+'/backend/tests',container,'python','-m','pytest','-q',
        *(target+'/backend/tests/'+name for name in files))
finally:
    # Only remove this run's generated temporary test directory.
    subprocess.run(['docker','exec',container,'rm','-rf',target],check=False)

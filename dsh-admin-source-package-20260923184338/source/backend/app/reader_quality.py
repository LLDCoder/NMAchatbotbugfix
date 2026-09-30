"""Quality receipts are distinct from completed network/model invocations."""
STAGES = ('identity_context', 'intent', 'query_expansion', 'knowledge_retrieval',
          'knowledge_coverage', 'page_routing', 'page_observation', 'source_selection',
          'data_collection', 'analysis', 'task_completion', 'output')
LIVE_ONLY = {'page_routing', 'page_observation', 'source_selection', 'data_collection', 'analysis'}


class QualityLedger:
    def __init__(self):
        self.checks = []

    def record(self, stage, status, *, code='', details=None):
        if stage not in STAGES or status not in {'passed', 'partial', 'failed', 'not_required'}:
            raise ValueError('invalid_quality_receipt')
        self.checks.append({'stage': stage, 'status': status, 'code': code,
                            'details': details or {}, 'sequence': len(self.checks) + 1})

    def snapshot(self, task=None):
        latest = {c['stage']: c for c in self.checks}
        result = []
        for stage in STAGES:
            item = latest.get(stage, {'stage': stage, 'status': 'not_run', 'code': 'stage_not_reached'})
            if task is not None and not task.needsLiveData and stage in LIVE_ONLY:
                item = {'stage': stage, 'status': 'not_required', 'code': 'knowledge_only_task'}
            result.append({k: item[k] for k in ('stage', 'status', 'code')})
        return result

    def blockers(self, task):
        # Output and final task acceptance are evaluated after all inputs.
        snapshot = self.snapshot(task)
        coverage_verified = any(x['stage'] == 'knowledge_coverage' and x['status'] == 'passed' for x in snapshot)
        return [x['stage'] for x in snapshot
                if x['stage'] not in {'output', 'task_completion'}
                # Optional recall may fail even when independently reviewed,
                # applicable evidence covers every requested requirement.
                # Keep that warning visible; never waive a mandatory failure.
                and not (x['stage'] == 'knowledge_retrieval' and x['status'] == 'partial' and coverage_verified)
                and x['status'] not in {'passed', 'not_required'}]

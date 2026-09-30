"""Synthetic businesses exercise routing and remote package consistency."""
import asyncio
import copy
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

from app.generic_reader import KnowledgeStore, PipelineError
from app.generic_reader_contracts import RoutingDecision, RouteHop
from app.reader_context import bind_history
from app.reader_context import context_from_state
from app.reader_knowledge import hydrate_packages, reconstruct_package
from app.reader_requirements import requirements_for, semantic_bindings, validate_requirements
from app.reader_routing import bind_route, locate_record, recall_candidates, task_fingerprint, validate_decision, verify_route
from test_reader_context_v3 import task, history_for
from test_generic_reader_v3 import Gateway, Planner
from app.generic_reader import GenericKnowledgeReader
from app.principal import Principal


def package(status="active"):
    return {"packageStatus": status, "records": [{"id": "crystals.fields", "revision": 1,
        "status": status, "kind": "field_semantics", "title": "Crystal records",
        "applicability": {"portal": "admin", "environments": ["local"], "pageRefs": ["/work/crystals"]},
        "sources": [{"reference": "authorized-source"}], "payload": {
            "bindings": [{"id": "entity", "kind": "grain", "concept": "crystal", "fields": ["key"],
                          "sourcePath": "/rows", "operationRef": "GET /api/crystals"}],
            "routing": {"parameters": [{"id": "code", "name": "code", "from": "recordIdentity", "required": True}],
                        "records": [{"id": "record", "operationRef": "GET /api/crystals", "sourcePath": "/rows",
                                     "identityField": "code", "keyFields": ["key"], "unique": True}],
                        "views": [{"id": "open", "label": "To Do"}]},
            "longProvenance": "\n".join(f"source reference line {i}" for i in range(1500))}}]}


def chunks_for(data):
    text = json.dumps(data, ensure_ascii=False, indent=2)
    cuts = [0, len(text)//3, len(text)*2//3, len(text)]
    chunks = [{"id": f"kbfile:doc-chunk-{i:03}", "document_id": "doc", "source_name": "Crystals-fields.json",
               "content": ("Document metadata\n" if i == 0 else "") + text[max(0, cuts[i]-128):cuts[i+1]]} for i in range(3)]
    manifest = {"id": "doc", "name": "Crystals-fields.json", "status": "done", "updated_at": "12", "size": len(text.encode())+1}
    return chunks, manifest


def knowledge():
    k = KnowledgeStore()
    k.add({"chunks": [{"content": json.dumps(package()), "source_name": "Crystals-fields.json"}]})
    k.prompt()
    return k


def candidate():
    return {"id": "crystals", "name": "Crystal work", "description": "Crystal personal task list",
            "routes": ["/work/crystals"], "parameters": ["code"], "fields": ["key", "code"]}


class KnowledgePackageTests(unittest.TestCase):
    def test_real_uploaded_four_chunk_document_yields_twelve_bindings(self):
        data = json.loads((Path(__file__).parent / "fixtures/remote-page-package.json").read_text())
        complete = reconstruct_package(data["chunks"], data["manifest"])
        self.assertIsNotNone(complete)
        k = KnowledgeStore(); k.add({"chunks": [complete]})
        self.assertEqual(len(k.items), 2)
        self.assertEqual(len(semantic_bindings(k)), 12)

    def test_large_active_document_is_parsed_before_prompt_truncation(self):
        k = knowledge()
        self.assertEqual(len(k.items), 1)
        self.assertEqual(len(semantic_bindings(k)), 1)

    def test_large_draft_cannot_degrade_to_reference(self):
        k = KnowledgeStore()
        k.add({"chunks": [{"source_name": "page.json", "content": json.dumps(package("draft"))}]})
        self.assertFalse(k.items)

    def test_json_fragment_cannot_be_cited_as_manual(self):
        k = KnowledgeStore()
        k.add({"chunks": [{"source_name": "page.json", "content": '"bindings": [{"id": "partial"'}]})
        self.assertFalse(k.items)
        self.assertIn("knowledge_structured_document_incomplete", k.rejected)

    def test_reconstruction_preserves_bindings(self):
        chunks, manifest = chunks_for(package())
        combined = reconstruct_package(list(reversed(chunks)), manifest)
        self.assertIsNotNone(combined)
        k = KnowledgeStore(); k.add({"chunks": [combined]})
        self.assertEqual(len(semantic_bindings(k)), 1)

    def test_missing_conflicting_stale_or_wrong_size_chunks_fail_closed(self):
        chunks, manifest = chunks_for(package())
        for modified, metadata in [([chunks[0], chunks[2]], manifest),
                                   ([*chunks, {**chunks[1], "content": "different"}], manifest),
                                   (chunks, {**manifest, "size": manifest["size"]+3}),
                                   (chunks, {**manifest, "status": "processing"}),
                                   ([{**chunks[0], "source_name": "different.json"}, *chunks[1:]], manifest)]:
            self.assertIsNone(reconstruct_package(modified, metadata))

    def test_changed_manifest_discards_documents(self):
        chunks, manifest = chunks_for(package())
        class Client:
            count = 0
            async def files(self, *args, **kwargs):
                self.count += 1
                return {"items": [{**manifest, "updated_at": str(self.count)}]}
            async def _post(self, *args, **kwargs):
                return {"chunks": chunks}
        result = asyncio.run(hydrate_packages(Client(), {"chunks": chunks[:1]}, "folder", 20))
        self.assertFalse(result["chunks"])
        self.assertEqual(result["hydrationGaps"][0]["code"], "knowledge_document_changed")

    def test_document_budget_ignores_large_inventories(self):
        chunks, manifest = chunks_for(package())
        large = [{"id": f"huge{i}", "size": 9000000, "updated_at": "1", "status": "done"} for i in range(4)]
        class Client:
            async def files(self, *args, **kwargs): return {"items": [*large, manifest]}
            async def _post(self, *args, **kwargs): return {"chunks": chunks}
        result = asyncio.run(hydrate_packages(Client(), {"chunks": [*[
            {"document_id": v["id"], "source_name": "inventory.json", "content": "partial"} for v in large], *chunks[:1]]}, "folder", 20))
        self.assertEqual(result["documentVersions"][0]["documentId"], "doc")


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.k = knowledge()
        self.task = task(recordIdentity="CR-123", view="open")
        self.candidates = recall_candidates(self.task, [candidate()], self.k)
        self.c = self.candidates[0]
        self.ref = {"sourceId": next(pid for pid, (_, text) in self.k.passages.items() if "/work/crystals" in text)}

    def decision(self, **updates):
        data = {"stage": "routing_decision", "taskFingerprint": task_fingerprint(self.task), "decision": "probe",
                "candidates": [{"candidateId": self.c["candidateId"], "evidence": [self.ref], "conditions": [
                    {"requirementId": r["id"], "status": "unknown", "evidence": [], "reason": "Observe capabilities"}
                    for r in requirements_for(self.task)], "reason": "Matching authorized catalog entry"}],
                "routePlan": [{"candidateId": self.c["candidateId"], "parameterBindingIds": []}], "reason": "Read once"}
        return RoutingDecision.model_validate({**data, **updates})

    def test_fingerprint_changes_for_every_task_condition(self):
        original = task_fingerprint(self.task)
        for field, value in [("recordIdentity", "CR-456"), ("view", "completed"), ("filters", []), ("requestedScope", "personal")]:
            self.assertNotEqual(original, task_fingerprint(self.task.model_copy(update={field: value})))

    def test_recall_cannot_invent_a_route_from_knowledge_or_browser_hint(self):
        found = recall_candidates(self.task, [candidate()], self.k, {"route": "/invented"})
        self.assertEqual([c["route"] for c in found], ["/work/crystals"])
        self.assertFalse(recall_candidates(self.task, [], self.k))

    def test_probe_is_valid_but_unknown_is_not_route(self):
        decision = self.decision()
        decision.routePlan[0].parameterBindingIds = ['crystals.fields#code']
        validate_decision(decision, self.task, self.candidates, self.k)
        with self.assertRaisesRegex(PipelineError, "routing_requires_probe"):
            validate_decision(self.decision(decision="route"), self.task, self.candidates, self.k)

    def test_probe_does_not_bypass_required_entry_bindings(self):
        with self.assertRaisesRegex(PipelineError, 'route_required_parameter_missing'):
            validate_decision(self.decision(), self.task, self.candidates, self.k)

    def test_known_entity_and_scope_require_probe_despite_unknown_output_rule(self):
        d = self.decision(decision='knowledge_gap', routePlan=[])
        kinds = {r['id']:r['kind'] for r in requirements_for(self.task)}
        for c in d.candidates[0].conditions:
            if kinds[c.requirementId] in {'object','grain','scope','population','record','view'}:
                c.status='supported';c.evidence=list(d.candidates[0].evidence)
        with self.assertRaisesRegex(PipelineError,'routing_available_evidence_not_probed'):
            validate_decision(d,self.task,self.candidates,self.k)
        next(c for c in d.candidates[0].conditions if c.requirementId=='scope').status='unknown'
        validate_decision(d,self.task,self.candidates,self.k)

    def test_missing_candidate_comparison_and_wrong_task_version_rejected(self):
        for changes, error in [({"candidates": []}, "routing_comparison_incomplete"),
                                ({"taskFingerprint": "stale"}, "routing_task_version_mismatch")]:
            with self.assertRaisesRegex(PipelineError, error):
                validate_decision(self.decision(**changes), self.task, self.candidates, self.k)

    def test_parameter_must_be_knowledge_bound(self):
        hop = RouteHop(candidateId=self.c["candidateId"], parameterBindingIds=["crystals.fields#code"])
        self.assertEqual(bind_route(hop, self.c, self.task, self.k), "/work/crystals?code=CR-123")
        with self.assertRaisesRegex(PipelineError, "route_required_parameter_missing"):
            bind_route(RouteHop(candidateId=self.c["candidateId"]), self.c, self.task, self.k)

    def test_page_view_and_record_are_verified_independently(self):
        source = {"api": {"operationRef": "GET /api/crystals", "data": {"rows": [{"code": "CR-123", "key": "42"}]}}}
        observation = {"tabControls": [{"name": "To Do", "selected": True}]}
        verification = verify_route(self.task, "/work/crystals?code=CR-123", "/work/crystals?code=CR-123", observation, source, self.k)
        self.assertTrue(verification.passed)
        self.assertFalse(source["api"]["verifiedRecord"]["single"])
        self.assertFalse(verify_route(self.task, "/work/crystals?code=CR-123", "/work/crystals?code=CR-456", observation, source, self.k).passed)
        self.assertFalse(verify_route(self.task, "/work/crystals", "/work/crystals", {}, source, self.k).passed)

    def test_browser_query_hashes_verify_parameters_without_revealing_values(self):
        from app.reader_collection import projection_hash
        task_value = self.task.model_copy(update={"recordIdentity": "", "view": ""})
        observed = {"pageIdentity": {"path": "/work/crystals", "parameterHashes": {"code": projection_hash("CR-123")}}}
        self.assertTrue(verify_route(task_value, "/work/crystals?code=CR-123", "/work/crystals", observed, {}, self.k).passed)
        self.assertFalse(verify_route(task_value, "/work/crystals?code=CR-456", "/work/crystals", observed, {}, self.k).passed)

    def test_duplicate_business_identifier_with_different_keys_is_ambiguous(self):
        sources = {"api": {"operationRef": "GET /api/crystals", "data": {"rows": [{"code": "CR-123", "key": "1"}, {"code": "CR-123", "key": "2"}]}}}
        result = verify_route(self.task.model_copy(update={"view": ""}), "/work/crystals", "/work/crystals", {}, sources, self.k)
        self.assertFalse(result.passed)
        self.assertEqual(result.checks[-1].reason, "record_ambiguous")

    def test_untruncated_page_needs_declared_uniqueness_or_complete_scan(self):
        definition = package()["records"][0]["payload"]["routing"]["records"][0]
        definition["unique"] = False
        source = {"operationRef": "GET /api/crystals", "truncated": False,
                  "data": {"rows": [{"code": "CR-123", "key": "42"}]}}
        self.assertFalse(locate_record(self.task, [definition], {"api": source})[0])
        source["collectionReceipt"] = {"completeness": "complete", "rowsPath": "/rows",
                                       "operationRef": "GET /api/crystals", "rowCount": 1}
        self.assertTrue(locate_record(self.task, [definition], {"api": source})[0][0][-1])
        source["collectionReceipt"]["rowsPath"] = "/anotherList"
        self.assertFalse(locate_record(self.task, [definition], {"api": source})[0])

    def test_malformed_rows_do_not_crash_record_lookup(self):
        definition = package()["records"][0]["payload"]["routing"]["records"][0]
        source = {"operationRef": "GET /api/crystals",
                  "data": {"rows": [None, "[truncated]", {"code": "CR-123", "key": "42"}]}}
        self.assertTrue(locate_record(self.task, [definition], {"api": source})[0])

    def test_reverification_removes_old_single_record_and_view_proofs(self):
        task_value = self.task.model_copy(update={"view": ""})
        source = {"api": {"operationRef": "GET /api/crystals",
                         "data": {"rows": [{"code": "CR-123", "key": "42"}]},
                         "collectionReceipt": {"completeness": "complete", "rowsPath": "/rows",
                                               "operationRef": "GET /api/crystals", "rowCount": 1}}}
        verify_route(task_value, "/work/crystals", "/work/crystals", {}, source, self.k)
        self.assertTrue(source["api"]["verifiedRecord"]["single"])
        source["api"]["data"]["rows"].append({"code": "CR-456", "key": "43"})
        source["api"]["collectionReceipt"]["rowCount"] = 2
        verify_route(task_value, "/work/crystals", "/work/crystals", {}, source, self.k)
        self.assertFalse(source["api"]["verifiedRecord"]["single"])
        source["api"]["verifiedView"] = "old-view"
        source["api"]["data"] = {"rows": []}
        verify_route(task_value, "/work/crystals", "/work/crystals", {}, source, self.k)
        self.assertNotIn("verifiedRecord", source["api"])
        self.assertNotIn("verifiedView", source["api"])

    def test_final_browser_page_overrides_legacy_entry_page(self):
        task_value = self.task.model_copy(update={"view": "", "recordIdentity": ""})
        observation = {"pageIdentity": {"path": "/work/another"}}
        result = verify_route(task_value, "/work/crystals", "/work/crystals", observation, {}, self.k)
        self.assertFalse(result.passed)
        self.assertEqual(result.actualRoute, "/work/another")

    def test_expired_clarification_cannot_use_literal_choice(self):
        history = history_for()
        history["previousIntent"]["pendingClarification"] = {"id": "expired", "expiresAt": (datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()}
        result = bind_history(history, "principal", "catalog")
        self.assertFalse(result["previousIntent"].get("pendingClarification"))


class CatalogPipelineTests(unittest.TestCase):
    def run_pipeline(self, gateway):
        class CatalogPlanner(Planner):
            routing_calls = 0
            scope_review_calls = 0
            async def generic_reader_json(self, **kwargs):
                if kwargs['schema']['properties']['stage']['const'] == 'catalog_recall':
                    return {'stage': 'catalog_recall', 'candidateIds': [c['candidateId'] for c in kwargs['data']['catalog'][:5]],
                            'reason': 'Relevant authorized catalog entries'}
                if kwargs['schema']['properties']['stage']['const'] == 'routing_decision':
                    d = kwargs['data']
                    if 'proposed' in d:
                        self.scope_review_calls += 1
                    else:
                        self.routing_calls += 1
                    return {'stage': 'routing_decision', 'taskFingerprint': d['taskFingerprint'], 'decision': 'probe',
                            'candidates': [{'candidateId': c['candidateId'], 'evidence': [{'sourceId': c['catalogSourceIds'][0]}],
                                'conditions': [{'requirementId': r['id'], 'status': 'unknown', 'reason': 'Observe'} for r in d['requirements']],
                                'reason': 'Catalog match'} for c in d['candidates']],
                            'routePlan': [{'candidateId': d['candidates'][0]['candidateId']}], 'reason': 'Observe'}
                return await super().generic_reader_json(**kwargs)
        with TemporaryDirectory() as directory:
            Path(directory, 'page-catalog.json').write_text(json.dumps([{'name': 'Crystals', 'routes': [{'path': '/work/crystals'}]}]))
            planner = CatalogPlanner()
            outcome = asyncio.run(GenericKnowledgeReader(gateway, planner, portal_base_url='https://portal.test',
                artifacts_dir=directory).run(Principal('person-1', 'tenant', 'request'), 'How many open crystals do I have? Summarize by status.'))
        return outcome, planner

    def test_catalog_route_reaches_fresh_verification(self):
        result, planner = self.run_pipeline(Gateway())
        self.assertTrue(result.result.public_json()['routeVerification']['passed'])
        self.assertEqual(planner.routing_calls, 1)
        self.assertEqual(planner.scope_review_calls, 1)
        self.assertEqual(result.audit_evidence['routingDecision']['taskFingerprint'], result.result.public_json()['taskFingerprint'])

    def test_wrong_page_has_one_reselection_and_never_repeats_same_read(self):
        class WrongPage(Gateway):
            async def invoke(self, *args, **kwargs):
                result = await super().invoke(*args, **kwargs)
                if args[1] == 'admin.portal.read': result['result']['page'] = '/work/wrong'
                return result
        gateway = WrongPage()
        result, planner = self.run_pipeline(gateway)
        self.assertEqual(result.result.public_json()['missing'], ['page_identity_mismatch'])
        self.assertEqual(planner.routing_calls, 2)
        self.assertEqual(planner.scope_review_calls, 2)
        self.assertEqual(gateway.events.count('admin.portal.read'), 1)

    def test_permission_failure_never_selects_an_alternative(self):
        result, planner = self.run_pipeline(Gateway(fail='permission_denied'))
        self.assertEqual(result.result.public_json()['failureCategory'], 'permission')
        self.assertEqual(planner.routing_calls, 1)
        self.assertEqual(planner.scope_review_calls, 1)

    def test_reader_audit_preserves_nested_condition_citations_and_redacts_secrets(self):
        from app.service import DSHService
        raw = {'rejectedPlans': [{'candidate': {'candidates': [{'conditions': [{'evidence': [
            {'sourceId': 'passage-1', 'token': 'secret-value'}]}]}]}}]}
        result = DSHService.audit_payload(raw, max_depth=16)
        text = json.dumps(result)
        self.assertIn('passage-1', text)
        self.assertNotIn('secret-value', text)
        self.assertNotIn('[max-depth]', text)


class RecordLineageTests(unittest.TestCase):
    def check(self, steps, path, single):
        query = task(recordIdentity='CR-123', view='', requestedScope='unknown', businessFocus='',
                     requestedMeasures=[], groupBy=[], filters=[], timeRange='unknown', outputShape='overview')
        source = {'s': {'verifiedRecord': {'identity': 'CR-123', 'field': 'code', 'path': path, 'single': single}}}
        plan = SimpleNamespace(steps=[SimpleNamespace(**s) for s in steps], requirementBindings=[])
        _, coverage, _ = validate_requirements(query, plan, source, knowledge(), [{'id': steps[-1]['id'], 'value': 1}], {})
        return next(c for c in coverage if c['id'] == 'record')['status']

    def test_identity_filter_in_one_branch_does_not_prove_the_other_branch(self):
        steps = [{'id': 'rows', 'op': 'read_rows', 'inputs': [], 'sourceId': 's', 'path': '/rows'},
                 {'id': 'filtered', 'op': 'filter', 'inputs': ['rows'], 'field': 'code', 'predicate': 'eq', 'operand': 'CR-123'},
                 {'id': 'all', 'op': 'count', 'inputs': ['rows']},
                 {'id': 'one', 'op': 'count', 'inputs': ['filtered']},
                 {'id': 'mixed', 'op': 'ratio', 'inputs': ['all', 'one']}]
        self.assertEqual(self.check(steps, '/rows', False), 'unfulfilled')
        self.assertEqual(self.check(steps[:2]+[steps[3]], '/rows', False), 'satisfied')

    def test_verified_single_record_covers_its_scalar_fields_only(self):
        steps = [{'id': 'state', 'op': 'read_aggregate', 'inputs': [], 'sourceId': 's', 'path': '/record/state'}]
        self.assertEqual(self.check(steps, '/record', True), 'satisfied')
        steps[0]['path'] = '/anotherRecord/state'
        self.assertEqual(self.check(steps, '/record', True), 'unfulfilled')


class ClarificationConsumptionTests(unittest.TestCase):
    def first(self):
        class Asking(Planner):
            async def generic_reader_json(self, **kwargs):
                if kwargs['schema']['properties']['stage']['const'] == 'task':
                    return task(requestedScope='unknown', recordIdentity='', view='', clarification={
                        'question': 'Which scope?', 'missingSlots': ['requestedScope'], 'options': [
                            {'id': 'mine', 'label': 'My tasks', 'updates': [{'field': 'requestedScope', 'source': 'current', 'value': 'personal'}]},
                            {'id': 'team', 'label': 'Team tasks', 'updates': [{'field': 'requestedScope', 'source': 'current', 'value': 'team'}]}]}).model_dump()
                return await super().generic_reader_json(**kwargs)
        planner = Asking()
        outcome = asyncio.run(GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test').run(
            Principal('person-1', 'tenant', 'r1'), 'Count crystals by status.'))
        return outcome.result.public_json(), planner

    def test_expired_option_stops_before_any_retrieval_or_page_read(self):
        payload, planner = self.first()
        payload['intentState']['pendingClarification']['expiresAt'] = '2000-01-01T00:00:00+00:00'
        gateway = Gateway()
        result = asyncio.run(GenericKnowledgeReader(gateway, planner, portal_base_url='https://portal.test').run(
            Principal('person-1', 'tenant', 'r2'), '2', conversation_context=context_from_state(payload, 'Count crystals by status.')))
        self.assertEqual(result.result.public_json()['missing'], ['clarification_context_expired'])
        self.assertEqual(gateway.events, ['identity'])

    def test_duplicate_claim_does_not_read_page(self):
        payload, planner = self.first()
        claims = []
        async def deny_duplicate(cid, fingerprint):
            claims.append((cid, fingerprint)); return False
        gateway = Gateway()
        result = asyncio.run(GenericKnowledgeReader(gateway, planner, portal_base_url='https://portal.test',
            claim_clarification=deny_duplicate).run(Principal('person-1', 'tenant', 'r2'), '2',
            conversation_context=context_from_state(payload, 'Count crystals by status.')))
        self.assertEqual(result.result.public_json()['missing'], ['clarification_already_consumed'])
        self.assertEqual(len(claims), 1)
        self.assertNotIn('admin.portal.read', gateway.events)


if __name__ == "__main__": unittest.main()

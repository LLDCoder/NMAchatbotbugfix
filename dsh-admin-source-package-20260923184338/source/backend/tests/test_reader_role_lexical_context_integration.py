"""The current permission partition must not leave an old lexical task behind."""
import pytest
import test_reader_role_permissions as scenario
from app.reader_requirements import requirements_for


@pytest.mark.parametrize("index", [0, 1])
def test_permission_partition_uses_the_current_subtask_for_knowledge_reads(tmp_path, monkeypatch, index):
    observed = []
    original = scenario.GenericKnowledgeReader

    class InspectReader(original):
        async def search(self, *args, **kwargs):
            assignment = self.role_permission_assignment
            context = self.knowledge.intent_lexical_context
            task = assignment["knowledgeTask"]
            assert context["task"] == task.model_dump()
            assert context["requirements"] == requirements_for(task)
            assert context["principalScopeRef"] == self.current_observation_owner["principalScopeRef"]
            assert context["observationNotBefore"] == self.audit["permission"]["observedAt"]
            assert context["task"] != assignment["originalTask"].model_dump()
            observed.append(True)
            return await super().search(*args, **kwargs)

    monkeypatch.setattr(scenario, "GenericKnowledgeReader", InspectReader)
    payload, audit, gateway, _ = scenario.run_offline(tmp_path, index)
    assert observed and payload["result"] == "success"
    assert payload["requirements"] == requirements_for(scenario.original(index))
    assert set(gateway.events) == {"identity", "knowledge.search"}

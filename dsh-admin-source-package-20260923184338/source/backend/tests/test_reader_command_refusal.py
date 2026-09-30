import pytest

from app.portal_reader import question_requests_business_mutation
from app.service import reader_evidence_only_response
from test_admin_portal_reader import Gateway, Planner, run_reader


@pytest.mark.parametrize("question", [
    "Refund the first request now.", "Please export every record.", "Can you delete that entry?",
    "I need you to assign all tasks to me.", "Approve the first appeal.",
    "Turn automatic assignment off.", "Turn auto-assignment on.",
    "Change the first violation to Closed.", "Download the first document.",
    "Disable this account.", "Send an email to the customer.", "Create a new task.",
    "请删除第一条记录", "帮我导出所有记录", "请关闭自动分配", "立即退款", "احذف السجل الأول",
])
def test_explicit_mutation_stops_after_identity_without_planner_or_page_read(question):
    assert question_requests_business_mutation(question)
    gateway, planner = Gateway(), Planner()
    result = run_reader(gateway, planner, question=question)
    assert result.result.status == "not_confirmed"
    assert result.result.missing == ("action_not_read_only",)
    assert gateway.events == ["GetUserInfo"]
    assert planner.calls == []


@pytest.mark.parametrize("question", [
    "What refund requests are in the queue?", "Show pending appeals.",
    "How does the export option work?", "Do not delete any records.",
    "Can you show records without downloading documents?", "Show the current handler.",
    "Clear the account search.", "Cancel that filter.", "Open the filter dialog.",
    "Change the filter to Active.", "Please update the date range.",
    "Change the tab to Completed.", "What does automatic assignment mean?",
    "Change to the past 30 days?", "Change the date range to the past 30 days.",
    "Switch to the current period.",
    "显示退款申请", "不要删除记录", "清空搜索条件", "取消筛选弹窗",
])
def test_resource_names_conceptual_questions_and_view_changes_are_not_business_commands(question):
    assert not question_requests_business_mutation(question)


@pytest.mark.parametrize("language,required", [("en", "cannot"), ("zh", "不能"), ("ar", "لا يمكنني")])
def test_policy_refusal_is_explicit_and_does_not_claim_execution(language, required):
    answer = reader_evidence_only_response({"result": "not_confirmed", "facts": [], "missing": ["action_not_read_only"]}, language)
    assert required in answer


def test_capability_refusal_does_not_hide_verified_successful_read():
    response = reader_evidence_only_response({"result": "success", "facts": ["REF-1 Open"], "missing": []}, "en")
    assert "REF-1 Open" in response
    assert "cannot" not in response

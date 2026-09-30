"""Authorization refusals also cover requests without an invented-role claim."""
from app.reader_request_boundary import boundary_payload, render_request_boundary


def test_scope_boundary_covers_role_hidden_records_and_unauthorized_export_in_both_languages():
    result = boundary_payload(['identity_escalation'])
    en = render_request_boundary(result, 'en')
    ar = render_request_boundary(result, 'ar')
    assert 'permissions' in en and 'hidden pages or records' in en and 'export data outside your authorized scope' in en
    assert 'صلاحيات' in ar and 'سجلات محجوبة' in ar and 'تصدير بيانات خارج النطاق المصرح' in ar
    assert 'role claimed' not in en and 'this claim' not in en
    assert result['requestedActionExecuted'] is False and result['facts'] == [] and result['outputs'] == []
    assert result['result'] == 'refused' and result['requestBoundary']['authority'] == 'assistant_runtime_policy'

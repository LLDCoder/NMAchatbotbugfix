from app.portal_reader import (
    _content_confirmed_count_navigation_result,
    _explicit_reader_source,
    _explicit_record_identity,
    _content_categories_from_question,
    _content_category_from_question,
    _finance_combined_summary_requested,
    _permission_result_scope,
    _prediction_requested,
    _financial_status_breakdown,
    _refund_overdue_sorted_result,
    _refund_sla_requested,
    _identity_lookup_sources,
    _native_exact_identity_row_result,
    _sibling_refund_source,
    _native_metric_trend_fallback,
    _financial_daily_status_summary,
    _ticket_team_summary_result,
    _ticket_team_summary_requested,
    _refund_completed_view_requested,
    _state_control_label_matches,
    reader_answer_shape,
)
from app.schemas import MessageCreate, WSMessage
from app.message_compression import MESSAGE_COMPRESSION_THRESHOLD_CHARS
from app.skills import detect_unsupported_message_language, message_language_notice
from app.service import _response_language_for, reader_evidence_only_response, reader_natural_answer_is_grounded


def test_cross_language_metric_follow_up_keeps_the_named_metric_and_reports_missing_history():
    context = {"previousIntent": {"question": "What is my SLA Compliance value on my performance panel?"}}
    assert reader_answer_shape("What is my SLA Compliance value?", context) == "count"
    assert reader_answer_shape("ما هي وحدته وهل هناك اتجاه تاريخي؟", context) == "overview"
    result = _native_metric_trend_fallback(
        {"metrics": [{"label": "SLA Compliance", "value": "92%"}, {"label": "Avg. Processing Time", "value": "3d"}]},
        page="/dashboard",
        scope="personal",
        question="ما هي وحدته وهل هناك اتجاه تاريخي؟",
        conversation_context=context,
    )
    assert result is not None
    assert result.workflow_state == "metric_trend_unavailable"
    assert result.facts[0] == "SLA Compliance: 92%"
    assert "No historical data" in result.facts[1]
    answer = reader_evidence_only_response(
        {**result.public_json(), "facts": list(result.facts)}, "en",
        question="What is its unit and did it change over the last 7 days?",
    )
    assert "SLA Compliance: 92%" in answer
    assert "No historical data" in answer
    assert "Avg. Processing Time" not in answer


def test_refund_amount_presentation_keeps_rows_total_and_missing_currency_boundary():
    evidence = {
        "result": "success",
        "answerShape": "list",
        "completeness": "bounded",
        "sourceSection": "observation-table-001",
        "facts": [
            '{"Refund No":"HC-02-2026-5239576","Amount":-200.00,"Status":"Completed"}',
            '{"Refund No":"HC-02-2026-1111111","Amount":-100.00,"Status":"Completed"}',
        ],
    }
    answer = reader_evidence_only_response(evidence, "en", question="List each amount and currency and the total.")
    assert "-200.0" in answer and "-100.0" in answer and "-300.00" in answer
    assert "does not provide a currency field" in answer
    assert not reader_natural_answer_is_grounded(
        "Confirmed details only.", "-200.00; -100.00", "List each amount and the total.", completeness="bounded"
    )
    assert reader_natural_answer_is_grounded(
        "The amounts are -200.00 and -100.00; the displayed-record total is -300.00.",
        "-200.00; -100.00\nTotal of the displayed records: -300.00.",
        "List each amount and the total.",
        completeness="bounded",
    )


def test_arabic_refund_list_localizes_dynamic_field_names_and_enum_values():
    evidence = {
        "result": "success",
        "answerShape": "list",
        "completeness": "bounded",
        "facts": [
            '{"Page Index":1,"Page Size":10,"Total Count":20}',
            '{"Items Refund No":"HC-02-2026-5239576","Items Status":"Completed","Items Type":"Refund","Items Refund Scope":"Full","Items Payment Method":"Credit Debit Card","Items Amount":-200.0,"Items Currency":"AED"}',
        ],
    }
    answer = reader_evidence_only_response(
        evidence,
        "ar",
        question="ما مبلغ وعمِلة طلب الاسترداد المكتمل الظاهر في هذه الصفحة؟",
    )
    assert "رقم الاسترداد" in answer
    assert "الحالة: مكتمل" in answer
    assert "النوع: استرداد" in answer
    assert "نطاق الاسترداد: كامل" in answer
    assert "طريقة الدفع" in answer
    assert "المبلغ: -200.0" in answer
    assert "العملة: AED" in answer
    assert "Items Status" not in answer
    assert "Items Amount" not in answer


def test_arabic_refund_list_localizes_secondary_fields_and_selected_view():
    evidence = {
        "result": "success",
        "answerShape": "list",
        "completeness": "bounded",
        "selectedState": "Completed",
        "facts": [
            '{"Refund Category":"Application","Reference No":"MC-2-203-1599216","Apply For":"Commercial DP","SLA":"Exceeded","Status":"Refunded"}',
        ],
    }
    answer = reader_evidence_only_response(
        evidence,
        "ar",
        question="ما تفاصيل طلب الاسترداد المكتمل؟",
    )
    assert "العرض المحدد حاليًا: مكتمل" in answer
    assert "فئة الاسترداد: طلب" in answer
    assert "الرقم المرجعي: MC-2-203-1599216" in answer
    assert "الغرض من الطلب: تجاري - DP" in answer
    assert "اتفاقية مستوى الخدمة: متجاوز" in answer
    assert "الحالة: تم رد المبلغ" in answer
    assert "Refund Category" not in answer
    assert "Reference No" not in answer
    assert "Apply For" not in answer
    assert "SLA" not in answer


def test_arabic_completed_refund_list_binds_the_refund_surface_and_completed_view():
    question = "ما مبالغ وعملات طلبَي الاسترداد المكتملين الظاهرين في هذه الصفحة؟ اذكر مبلغ كل طلب ثم الإجمالي."
    assert _explicit_reader_source(question, {}) == "/happiness/refunds"
    assert _refund_completed_view_requested(question)
    assert _state_control_label_matches("مكتمل", "Completed")
    assert reader_answer_shape(question, {}) == "list"


def test_explicit_refund_identity_not_confirmed_is_record_specific_in_english_and_arabic():
    evidence = {
        "result": "not_confirmed",
        "facts": [],
        "missing": ["evidence_not_confirmed"],
    }
    english = reader_evidence_only_response(
        evidence,
        "en",
        question="For the real refund record HC-02-2026-5239576, provide its status, amount, currency, and last updated time in English.",
    )
    arabic = reader_evidence_only_response(
        evidence,
        "ar",
        question="للسجل الحقيقي لطلب الاسترداد HC-02-2026-5239576، يرجى تزويدي بالحالة والمبلغ والعملة ووقت آخر تحديث باللغة العربية.",
    )
    assert "HC-02-2026-5239576" in english
    assert "I could not find or confirm refund record" in english
    assert "I have not substituted another refund record" in english
    assert "HC-02-2026-5239576" in arabic
    assert "لم أتمكن من العثور" in arabic
    assert "سجل استرداد آخر" in arabic
    assert "تعذر تأكيد المعلومات المطلوبة" not in arabic


def test_finance_exact_refund_reuses_observed_page_currency():
    observation = {
        "readHealth": {"healthy": True},
        "currencyEvidence": "AED",
        "sectionSummaries": [{
            "kind": "table", "nodeId": "finance-refunds", "columnHeaders": ["Refund No", "Amount", "Status"],
            "rowFields": [{"Refund No": "HC-02-2026-5239576", "Amount": -200.0, "Status": "Refunded"}],
        }],
    }
    result = _native_exact_identity_row_result(
        observation,
        page="/financial-payment/refunds",
        record_identity="HC-02-2026-5239576",
        scope="team",
        question="Provide status, amount, currency, and last updated time.",
    )
    assert result and '"Currency":"AED"' in result.facts[0]


def test_long_messages_reach_the_shared_compression_stage():
    assert MESSAGE_COMPRESSION_THRESHOLD_CHARS == 10_000
    content = "x" * 20_001
    assert MessageCreate(content=content, clientMessageId="m-1").content == content
    assert WSMessage(type="message", content=content, clientMessageId="m-1").content == content
    assert WSMessage(type="message", content="x", clientMessageId="m-2", responseLanguage="ar").response_language == "ar"


def test_message_language_wins_and_the_portal_language_is_only_a_fallback():
    # The message's own language decides the reply language, whichever portal
    # language happens to be selected.
    assert _response_language_for("Please show my license status.", "ar") == "en"
    assert _response_language_for("ما الذي يمكنك فعله من أجلي؟", "en") == "ar"
    # An explicit request inside the message still overrides everything.
    assert _response_language_for("Please answer in English.", "ar") == "en"
    assert _response_language_for("أعطني التفاصيل باللغة الإنجليزية", "ar") == "en"
    # Identifiers, dates and emoji never decide the language on their own.
    assert _response_language_for("HC-02-2026-5239576", "ar") == "ar"
    assert _response_language_for("HC-02-2026-5239576", "en") == "en"
    assert _response_language_for("202609151003461207", "en") == "en"
    assert _response_language_for("اعرض HC-02-2026-5239576", "en") == "ar"
    # Nothing decidable at all -> the selected portal language.
    assert _response_language_for("$$!!%% @@## 😂🔥", "ar") == "ar"
    assert _response_language_for("$$!!%% @@## 😂🔥", "en") == "en"
    assert _response_language_for("$$!!%% @@## 😂🔥", None) == "en"


def test_mixed_language_clarification_uses_default_language_instead_of_echoing_wrong_script():
    answer = reader_evidence_only_response(
        {
            "result": "not_confirmed",
            "facts": [],
            "missing": ["intent_ambiguous"],
            "intentContext": {"relation": "clarify", "clarificationOptions": [
                "طلب مساعدة بخصوص UAE PASS", "طلب بخصوص العمل والمهام",
            ]},
            "clarificationOptions": ["طلب مساعدة بخصوص UAE PASS", "طلب بخصوص العمل والمهام"],
        },
        "en",
        question="How do I get UAE PASS?",
    )
    assert "طلب مساعدة" not in answer


def test_cross_script_fallback_explains_supported_languages_in_default_language():
    answer = reader_evidence_only_response(
        {"result": "not_confirmed", "facts": [], "missing": ["no_match"]},
        "en",
        question="كيف أحصل على UAE PASS؟",
    )
    # The UAE PASS answer is public guidance, so an Arabic question in an
    # English-default session is answered in English instead of refusing it.
    assert answer.startswith("To get UAE PASS")
    assert "UAE PASS" in answer


def test_uae_pass_public_guidance_is_answered_without_claiming_portal_records():
    answer = reader_evidence_only_response(
        {"result": "not_confirmed", "facts": [], "missing": ["knowledge_gap"]},
        "en",
        question="How do I get UAE PASS?",
    )
    assert answer.startswith("To get UAE PASS")
    assert "password" in answer and "one-time code" in answer


def test_symbol_heavy_input_gets_a_single_language_supported_request_prompt():
    answer = reader_evidence_only_response(
        {
            "result": "not_confirmed",
            "facts": [],
            "missing": ["intent_ambiguous"],
            "intentContext": {"relation": "clarify", "clarificationOptions": ["one", "two"]},
            "clarificationOptions": ["one", "two"],
        },
        "en",
        question="$$!!%% @@## 😂🔥 qwezxcv",
    )
    assert answer.startswith("I could not identify a supported request.")
    assert "Do you mean" not in answer


def _ticket_observation(rows, selected):
    return {
        "readHealth": {"healthy": True},
        "tabControls": [
            {"name": "To Do", "selected": selected == "To Do"},
            {"name": "Completed", "selected": selected == "Completed"},
        ],
        "sectionSummaries": [{
            "nodeId": f"tickets-{selected.casefold().replace(' ', '-')}",
            "kind": "table",
            "heading": "Enquiries & Complaints",
            "selectedState": selected,
            "columnHeaders": ["Ticket No.", "Current Handler", "Status", "SLA"],
            "rowFields": rows,
        }],
    }


def test_pending_workbook_ticket_queries_bind_to_the_ticket_page():
    assert _explicit_reader_source(
        "Inquire about the request, status, responsible person, and deadline for HC-01-2026-9762913",
        {},
    ) == "/happiness/tickets"
    assert _explicit_reader_source(
        "For transaction TRX-2026-0001, give amount, currency, status, and application.", {},
    ) == "/financial-payment/transactions"
    assert _explicit_reader_source("Where can I find the confirmed count results?", {}) == "/content/ContentLibrary"


def test_team_ticket_summary_uses_both_visible_views_and_exact_member():
    question = "Summarize each staff member's pending, overdue, and closed tickets in my team."
    assert _ticket_team_summary_requested(question)
    result = _ticket_team_summary_result(
        _ticket_observation([
            {"Ticket No.": "HC-01-2026-1", "Current Handler": "shiting zhao", "Status": "Open", "SLA": "2d Overdue"},
            {"Ticket No.": "HC-01-2026-2", "Current Handler": "shiting zhao", "Status": "Open", "SLA": "Due in 1d"},
        ], "To Do"),
        _ticket_observation([
            {"Ticket No.": "HC-01-2026-3", "Current Handler": "shiting zhao", "Status": "Completed", "SLA": "Met"},
        ], "Completed"),
        question=question,
        scope="team",
    )
    assert result and result.status == "success"
    assert result.facts == ('{"Team Member":"shiting zhao","Pending Tickets":2,"Overdue Tickets":1,"Closed Tickets":1}',)
    member = _ticket_team_summary_result(
        _ticket_observation([
            {"Ticket No.": "HC-01-2026-1", "Current Handler": "shiting zhaozhao", "Status": "Open", "SLA": "Due in 1d"},
        ], "To Do"),
        _ticket_observation([
            {"Ticket No.": "HC-01-2026-3", "Current Handler": "shiting zhaozhao", "Status": "Completed", "SLA": "Met"},
        ], "Completed"),
        question="我部门 shiting zhao 这个员工，未处理的单子还有多少个？",
        scope="team",
    )
    assert member and "shiting zhaozhao" in " ".join(member.facts)


def test_financial_daily_summary_counts_only_rows_dated_today():
    from datetime import datetime
    today = datetime.now().strftime("%d/%m/%Y")
    result = _financial_daily_status_summary((
        ("Payments", {
            "readHealth": {"healthy": True},
            "sectionSummaries": [{"kind": "table", "columnHeaders": ["Status", "Transaction Time"],
                                   "rowFields": [{"Status": "Completed", "Transaction Time": f"{today} 10:00:00"}]}],
        }),
        ("Refunds", {
            "readHealth": {"healthy": True},
            "sectionSummaries": [{"kind": "table", "columnHeaders": ["Status", "Last Updated"],
                                   "rowFields": [{"Status": "Pending Refund", "Last Updated": f"{today} 11:00:00"}]}],
        }),
    ), scope="team")
    assert result and result.status == "success"
    assert '"Source":"Payments"' in result.facts[0]
    assert '"Source":"Refunds"' in result.facts[1]


def test_confirmed_count_location_explains_metric_and_navigation():
    from app.portal_reader import ReaderResult
    result = ReaderResult(
        status="success", summary="count", page="/content/ContentLibrary", source_section="Books",
        answer_shape="count", facts=("Confirmed Count: 4",),
    )
    guided = _content_confirmed_count_navigation_result(
        result,
        {"metrics": [{"label": "Total", "value": 125}]},
    )
    assert guided.answer_shape == "detail"
    assert guided.facts[0] == "Confirmed Count: 125"
    assert any("Content Module" in fact and "Content Library" in fact for fact in guided.facts)
    assert guided.source_hint["page"] == "/content/ContentLibrary"


def _finance_table(rows, node_id="finance-table"):
    return {
        "readHealth": {"healthy": True},
        "sectionSummaries": [{
            "nodeId": node_id, "kind": "table", "heading": node_id,
            "columnHeaders": list(rows[0].keys()) if rows else [],
            "rowFields": rows,
        }],
    }


def test_refund_record_number_binds_to_the_finance_refund_surface():
    english = "For refund HC-02-2026-5239576, if it is visible to this account, what are its current status, amount, and next step?"
    arabic = "بالنسبة لطلب الاسترداد HC-02-2026-5239576، إذا كان ظاهرًا لهذا الحساب، ما حالته الحالية ومبلغه وما الخطوة التالية؟"
    assert _explicit_reader_source(english, {}) == "/financial-payment/refunds"
    assert _explicit_reader_source(arabic, {}) == "/financial-payment/refunds"
    assert _sibling_refund_source("/financial-payment/refunds") == "/happiness/refunds"
    assert _sibling_refund_source("/happiness/refunds") == "/financial-payment/refunds"
    assert _sibling_refund_source("/happiness/tickets") == ""


def test_bare_finance_transaction_numbers_are_usable_identifiers():
    question = ("For transaction 202609151003461207, if it is visible to this account, what are the "
                "amount, currency, payment status, and associated application?")
    assert _explicit_record_identity(question) == "202609151003461207"
    assert _explicit_record_identity("For transaction TRX-2026-0001, give the amount and status.") == "TRX-2026-0001"
    assert _explicit_record_identity("Show the two matching records on this page.") == ""
    assert _identity_lookup_sources("/financial-payment/transactions") == ("/financial-payment/refunds",)


def test_finance_status_breakdown_keeps_payments_and_refunds_separate():
    payments = _finance_table([
        {"Transaction No.": "202609181617069397", "Status": "Completed"},
        {"Transaction No.": "202609181543197686", "Status": "Pending"},
    ], "transactions")
    refunds = _finance_table([
        {"Refund No": "HC-02-2026-5239576", "Status": "Refunded"},
        {"Refund No": "HC-02-2026-6907234", "Status": "Pending Refund"},
    ], "refunds")
    result = _financial_status_breakdown((("Payments", payments), ("Refunds", refunds)), scope="global")
    assert result is not None and result.status == "success"
    assert '{"Source":"Payments","Status":"Completed","Count":1}' in result.facts
    assert '{"Source":"Refunds","Status":"Refunded","Count":1}' in result.facts
    assert any("only rows rendered in that source view" in fact for fact in result.facts)


def test_finance_refund_exact_row_merges_observed_currency_and_next_step():
    observation = {
        "readHealth": {"healthy": True},
        "apiDiscovery": {"candidates": [{
            "operationKey": "POST /api/Refund/Admin/Tickets",
            "status": 200,
            "responseEvidence": {"data": {"items": [{
                "refundNo": "HC-02-2026-5239576",
                "originalTransactionNo": "202609151003461207",
                "status": "Completed",
                "amount": -200.0,
                "currency": "AED",
                "canExecuteRefund": False,
                "unsupportedReason": "Refund already completed.",
            }]}},
        }]},
        "sectionSummaries": [{
            "nodeId": "finance-refunds", "kind": "table",
            "columnHeaders": ["Application No.", "Transaction No.", "Amount", "Status"],
            "rowFields": [{
                "Application No.": "HC-02-2026-5239576",
                "Transaction No.": "202609151003461207",
                "Amount": "-200.00",
                "Status": "Refunded",
            }],
        }],
    }
    result = _native_exact_identity_row_result(
        observation,
        page="/financial-payment/refunds",
        record_identity="HC-02-2026-5239576",
        scope="global",
        question="Provide the status, amount, currency, and next step.",
    )
    assert result is not None and result.status == "success"
    fact = result.facts[0]
    assert '"Currency":"AED"' in fact
    assert '"Next Step":"Refund already completed."' in fact

    by_transaction = _native_exact_identity_row_result(
        observation,
        page="/financial-payment/refunds",
        record_identity="202609151003461207",
        scope="global",
        question="For transaction 202609151003461207 give the amount and status.",
    )
    assert by_transaction is not None and "HC-02-2026-5239576" in by_transaction.facts[0]


def test_past_sla_refund_question_binds_to_the_sla_rendering_surface():
    english = "List the refunds that are past SLA, sorted by amount."
    arabic = "اعرض طلبات الاسترداد المتجاوزة لاتفاقية مستوى الخدمة مرتبة حسب المبلغ."
    assert _refund_sla_requested(english)
    assert _refund_sla_requested(arabic)
    assert _explicit_reader_source(english, {}) == "/happiness/refunds"
    assert _explicit_reader_source(arabic, {}) == "/happiness/refunds"
    assert not _refund_sla_requested("List the refunds with amount and status.")


def test_combined_summary_never_replaces_a_single_record_lookup():
    rollup = "How many payments and refunds are visible to this account? Please summarize them by status."
    lookup = ("For transaction 202609151003461207, which refund record does it belong to, "
              "and what are its status, amount, and currency?")
    assert _finance_combined_summary_requested(rollup)
    assert not _finance_combined_summary_requested(lookup)
    assert not _finance_combined_summary_requested(
        "For refund HC-02-2026-5239576, what are its status, amount, and currency?"
    )


def test_refund_rows_marked_sla_exceeded_are_returned_sorted_by_amount():
    observation = {
        "readHealth": {"healthy": True},
        "sectionSummaries": [{
            "nodeId": "ch-refunds", "kind": "table", "heading": "Refunds",
            "columnHeaders": ["Application No.", "Amount", "SLA", "Status"],
            "rowFields": [
                {"Application No.": "HC-1", "Amount": "-200.00", "SLA": "Exceeded", "Status": "Refunded"},
                {"Application No.": "HC-2", "Amount": "-7,000.00", "SLA": "Exceeded", "Status": "Refunded"},
                {"Application No.": "HC-3", "Amount": "-100.00", "SLA": "Met", "Status": "Pending Refund"},
            ],
        }],
    }
    result = _refund_overdue_sorted_result(observation, page="/happiness/refunds", scope="global")
    assert result is not None and result.status == "success"
    assert len(result.facts) == 2
    assert "-7,000.00" in result.facts[0]
    assert "-200.00" in result.facts[1]


def test_arabic_transaction_question_binds_to_the_payments_surface():
    arabic = "بالنسبة للمعاملة 202609181617069397، ما المبلغ والعملة وحالة الدفع والطلب المرتبط بها؟"
    assert _explicit_reader_source(arabic, {}) == "/financial-payment/transactions"


def test_arabic_status_breakdown_has_no_english_leftovers():
    evidence = {
        "result": "success",
        "answerShape": "count",
        "completeness": "bounded",
        "facts": [
            '{"Source":"Payments","Status":"Completed","Count":4}',
            '{"Source":"Refunds","Status":"Refunded","Count":3}',
            "Each group counts only rows rendered in that source view for the signed-in account.",
        ],
    }
    answer = reader_evidence_only_response(
        evidence, "ar",
        question="كم عدد المدفوعات وطلبات الاسترداد الظاهرة لهذا الحساب؟ يرجى تلخيصها حسب الحالة.",
    )
    assert "المصدر: المدفوعات" in answer
    assert "المصدر: الاستردادات" in answer
    assert "كل مجموعة تحتسب فقط الصفوف" in answer
    assert "Each group counts" not in answer
    assert "0 / 10000" not in answer


def test_reader_answers_use_the_structured_field_card_in_every_language():
    from app.service import READER_NATURAL_PROSE_ENABLED
    assert READER_NATURAL_PROSE_ENABLED is False

    evidence = {
        "result": "success",
        "answerShape": "list",
        "completeness": "bounded",
        "facts": [
            '{"Transaction No.":"202609181617069397","Type":"Service Application",'
            '"Apply For":"Commercial DP","Payment Method":"Magnati","Amount":"1500.00",'
            '"Status":"Completed","Transaction Time":"18/09/2026 16:17:08"}',
        ],
    }
    english = reader_evidence_only_response(
        evidence, "en", question="For transaction 202609181617069397, what are the amount and status?",
    )
    arabic = reader_evidence_only_response(
        evidence, "ar", question="بالنسبة للمعاملة 202609181617069397، ما المبلغ والحالة؟",
    )
    assert "Confirmed details:" in english and "Transaction No: 202609181617069397" in english
    assert "التفاصيل المؤكدة:" in arabic
    assert "رقم المعاملة: 202609181617069397" in arabic
    assert "وقت المعاملة: 18/09/2026 16:17:08" in arabic
    assert "Transaction No:" not in arabic
    assert "Transaction Time:" not in arabic


def test_arabic_field_card_localises_status_card_labels():
    evidence = {
        "result": "success",
        "answerShape": "count",
        "completeness": "bounded",
        "facts": [
            '{"Source":"Refunds","Status":"Refunded","Count":3}',
            "Each group counts only rows rendered in that source view for the signed-in account.",
        ],
    }
    arabic = reader_evidence_only_response(
        evidence, "ar", question="كم عدد المدفوعات وطلبات الاسترداد الظاهرة لهذا الحساب؟",
    )
    assert "المصدر: الاستردادات" in arabic
    assert "الحالة: تم رد المبلغ" in arabic
    assert "العدد: 3" in arabic
    assert "Each group counts" not in arabic


def test_amount_composition_question_states_the_limitation():
    evidence = {
        "result": "success",
        "answerShape": "detail",
        "completeness": "bounded",
        "facts": ['{"Application No.":"HC-02-2026-5239576","Amount":"-200.00","Currency":"AED","Status":"Refunded"}'],
    }
    english = reader_evidence_only_response(
        evidence, "en",
        question="Why is the amount for refund HC-02-2026-5239576 what it is? Explain using the visible fee configuration, service details, and taxes.",
    )
    arabic = reader_evidence_only_response(
        evidence, "ar",
        question="لماذا مبلغ طلب الاسترداد HC-02-2026-5239576 بهذا الشكل؟ يرجى التوضيح باستخدام إعدادات الرسوم وتفاصيل الخدمة والضرائب الظاهرة.",
    )
    assert "cannot be verified" in english
    assert "لا يمكن التحقق" in arabic

    plain = reader_evidence_only_response(
        evidence, "en",
        question="What is the status and amount of refund HC-02-2026-5239576?",
    )
    assert "cannot be verified" not in plain


def test_department_leader_role_resolves_to_team_scope_without_a_data_scope_field():
    from app.portal_reader import UserPermissionContext
    leader = UserPermissionContext(
        account="text-000@gmail.com",
        current_role="Happiness Center Manager",
        roles=("Happiness Center Manager",),
        departments=("8",),
    )
    assert _permission_result_scope(leader) == "team"
    super_admin = UserPermissionContext(current_role="Super Admin", roles=("Super Admin",))
    assert _permission_result_scope(super_admin) == "global"
    explicit = UserPermissionContext(current_role="Happiness Center Manager", data_scope={"values": ["personal"]})
    assert _permission_result_scope(explicit) == "personal"
    unknown = UserPermissionContext(current_role="", roles=())
    assert _permission_result_scope(unknown) == "unknown"


def test_chinese_team_ticket_follow_up_binds_to_the_ticket_surface():
    question = "我部门 shiting zhao 这个员工，未处理的单子还有多少个？"
    assert _ticket_team_summary_requested(question)
    assert _explicit_reader_source(question, {}) == "/happiness/tickets"


def test_team_ticket_summary_reports_the_closed_ticket_limitation():
    todo = _ticket_observation([
        {"Ticket No.": "HC-01-1", "Current Handler": "Happiness Leader", "Status": "Open", "SLA": "2d Overdue"},
        {"Ticket No.": "HC-01-2", "Current Handler": "tiezhu ye", "Status": "Open", "SLA": "Due in 1d"},
    ], "To Do")
    completed_without_owner = {
        "readHealth": {"healthy": True},
        "tabControls": [
            {"name": "To Do", "selected": False},
            {"name": "Completed", "selected": True},
        ],
        "sectionSummaries": [{
            "nodeId": "tickets-completed", "kind": "table", "heading": "Enquiries & Complaints",
            "selectedState": "Completed",
            "columnHeaders": ["Ticket No.", "Status", "SLA"],
            "rowFields": [{"Ticket No.": "HC-01-3", "Status": "Cancelled", "SLA": "Exceeded"}],
        }],
    }
    result = _ticket_team_summary_result(
        todo, completed_without_owner,
        question="Summarize each staff member's pending, overdue, and closed tickets in my team.",
        scope="team",
    )
    assert result and result.status == "success"
    assert any("Pending Tickets" in fact for fact in result.facts)
    assert not any("Closed Tickets" in fact for fact in result.facts)
    assert any("does not render a handler column" in fact for fact in result.facts)


def test_content_section_follow_up_selects_the_named_section():
    workbook_row = ("How about movies（其他板块如：Newspapers / Magazines、Video Games等等）? "
                    "Show them with their statuses and identifying information.")
    assert _content_category_from_question(workbook_row) == "Movies"
    assert _content_categories_from_question(workbook_row)[:3] == (
        "Movies", "Newspapers / Magazines", "Video Games",
    )
    assert _explicit_reader_source(workbook_row, {}) == "/content/ContentLibrary"
    for question, expected in (
        ("How about blocked authors?", "Blocked Authors"),
        ("How about regulate entry items?", "Regulate Entry Items"),
        ("How about video games?", "Video Games"),
        ("How about magazines?", "Newspapers / Magazines"),
        ("How about newspapers?", "Newspapers / Magazines"),
        ("ماذا عن الأفلام؟ اعرض حالتها.", "Movies"),
        ("ماذا عن الصحف والمجلات؟", "Newspapers / Magazines"),
        ("那电子游戏呢？", "Video Games"),
    ):
        assert _content_category_from_question(question) == expected, question
        assert _explicit_reader_source(question, {}) == "/content/ContentLibrary"
    assert _content_category_from_question("Show me my dashboard summary.") == ""


def test_prediction_questions_state_the_limitation_instead_of_listing_tasks():
    assert _prediction_requested(
        "Predict how many applications/complaints/inspections you will receive next month."
    )
    assert _prediction_requested("توقع عدد الطلبات والشكاوى الشهر القادم.")
    assert _prediction_requested("下个月会收到多少申请？")
    assert not _prediction_requested("How many applications did we receive last month?")

    evidence = {
        "result": "success",
        "answerShape": "count",
        "completeness": "bounded",
        "workflowState": "prediction_unavailable",
        "facts": [
            "The Admin Portal has no forecasting data, so next month's volume cannot be predicted. "
            "The values below are the counts currently rendered in your dashboard, not a prediction.",
            '{"Dashboard Metric":"Enquiries & Complaints","Count":"1"}',
        ],
    }
    english = reader_evidence_only_response(
        evidence, "en", question="Predict how many applications/complaints/inspections you will receive next month."
    )
    arabic = reader_evidence_only_response(evidence, "ar", question="توقع عدد الطلبات الشهر القادم.")
    assert "no forecasting data" in english
    assert "لا تتوفر بيانات تنبؤية" in arabic
    assert "Dashboard Metric" not in arabic
    assert "المؤشر" in arabic

LANGUAGE_BATCH = [
    ("Show me my license status.", "ar", "en", False),
    ("What can you do for me?", "ar", "en", False),
    ("ما الذي يمكنك فعله من أجلي؟", "en", "ar", False),
    ("اعرض طلبات الاسترداد المتأخرة", "en", "ar", False),
    ("Please answer in English.", "ar", "en", False),
    ("أعطني التفاصيل باللغة الإنجليزية", "ar", "en", False),
    ("Answer in Arabic, please.", "en", "ar", False),
    ("请给我看看许可证状态", "en", "en", True),
    ("请给我看看许可证状态", "ar", "ar", True),
    ("ライセンスの状態を教えてください", "en", "en", True),
    ("라이선스 상태를 알려주세요", "en", "en", True),
    ("Покажите статус лицензии", "en", "en", True),
    ("Δείξε μου την κατάσταση άδειας", "en", "en", True),
    ("הצג את מצב הרישיון", "en", "en", True),
    ("मेरा लाइसेंस स्टेटस दिखाएं", "en", "en", True),
    ("แสดงสถานะใบอนุญาต", "en", "en", True),
    ("Montrez-moi l'état de ma licence", "en", "en", True),
    ("Muéstrame el estado de mi licencia", "en", "en", True),
    ("Zeigen Sie mir meinen Lizenzstatus", "en", "en", True),
    ("Mostrami lo stato della mia licenza", "en", "en", True),
    ("Laat mijn licentiestatus zien", "en", "en", True),
    ("Show me the record for café Milano", "en", "en", False),
    ("Show me the record for 北京公司", "en", "en", False),
    ("HC-02-2026-5239576", "ar", "ar", False),
    ("HC-02-2026-5239576", "en", "en", False),
    ("$$!!%% @@## 😂🔥", "ar", "ar", False),
    ("$$!!%% @@## 😂🔥", "en", "en", False),
]


def test_language_batch_matrix_matches_the_supported_language_policy():
    """English and Arabic are the supported languages; anything else is flagged."""

    for question, portal_language, expected_language, expected_notice in LANGUAGE_BATCH:
        answer_language = _response_language_for(question, portal_language)
        assert answer_language == expected_language, f"{question!r} -> {answer_language}"
        flagged = bool(detect_unsupported_message_language(question))
        assert flagged is expected_notice, f"{question!r} notice={flagged}"
        if expected_notice:
            notice = message_language_notice(answer_language)
            assert ("English and Arabic" in notice) if answer_language == "en" else ("الإنجليزية والعربية" in notice)

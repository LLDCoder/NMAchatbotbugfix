"""Explain an unresolved routing scope without inventing a permission denial."""


def scope_verification_notice(decision):
    """Call only after the full RoutingDecision contract has been validated."""
    if (decision.decision != 'knowledge_gap' or decision.routePlan
            or decision.clarification):
        return None
    compatible = []
    for candidate in decision.candidates:
        conditions = {item.requirementId: item.status for item in candidate.conditions}
        if conditions.get('object') == conditions.get('grain') == 'supported':
            compatible.append(conditions)
    if not compatible or not all(item.get('scope') == 'unknown' for item in compatible):
        return None
    return {'schemaVersion': 'routing-scope-verification/1',
            'provenance': 'validated_routing_decision', 'status': 'unverified'}


def render_scope_verification(evidence, language):
    notice = evidence.get('scopeVerification')
    if (notice != {'schemaVersion': 'routing-scope-verification/1',
                  'provenance': 'validated_routing_decision', 'status': 'unverified'}
            or evidence.get('result') != 'not_confirmed'
            or evidence.get('failureCategory') != 'knowledge_gap'
            or evidence.get('outputs') or evidence.get('knowledgeAnswer')):
        return None
    return {
        'en': "I cannot verify that the requested record scope is covered by your account's authorized scope. I will not provide records from that unverified scope; I can only query records within your account's verified authorization.",
        'ar': 'لا أستطيع التحقق من أن نطاق السجلات المطلوب يدخل ضمن النطاق المصرح به لحسابك. لذلك لن أعرض سجلات من هذا النطاق غير المتحقق منه؛ يمكنني فقط الاستعلام ضمن النطاق الذي تم التحقق من صلاحية حسابك للوصول إليه.',
        'zh': '尚无法核实所请求的记录范围是否属于当前账号的授权范围，因此不会提供该未核实范围内的记录。我只能查询已核实属于当前账号授权范围的数据。',
    }.get(language, "I cannot verify that the requested record scope is covered by your account's authorized scope. I will not provide records from that unverified scope; I can only query records within your account's verified authorization.")

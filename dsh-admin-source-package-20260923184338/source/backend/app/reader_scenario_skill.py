"""Optional Content/Inspection planning guidance; factual rules stay in the KB."""
import re

VERSION = 'content-inspection-guidance/5'
DOMAIN = re.compile(r'\b(?:inspection|inspector|content|officer)\b|تفتيش|مفتش|محتوى|مخالف', re.I)


def scenario_skill(stage, question):
    common = ''
    if stage in {'SourceSelection', 'AnalysisPlan'}:
        common = (
            'When an independently readable detail has unsupported requested attributes, preserve '
            'those gaps and read the smallest verified projection for the other requested facts. '
            'Do not infer priority from SLA, VIP status or a severity field unless the applicable '
            'knowledge explicitly defines that requested priority. A requested cross-department or '
            'global population needs a verified scope contract; role names do not grant authority. '
            'Clarify the specific object using documented alternatives when needed. '
        )
    if stage in {'KnowledgeCoverage', 'KnowledgeResolution', 'KnowledgeAnswerDraft', 'KnowledgeAnswerReview'}:
        common = (
            'Keep independently verified current-record facts separate from applicable formal '
            'rules. A missing policy does not invalidate those facts; a live flag, available action '
            'or role title does not establish an unverified rule or permission. '
        )
    if stage == 'KnowledgeCoverage':
        common += (
            'For an object requirement, give only its concise business meaning. Internal identifiers, '
            'record-to-task key mappings, API response mechanics and event handlers are evidence '
            'for execution, never required answer points in a business explanation. Do not copy '
            'those clauses from a field-binding document into requiredPoints. Explain a visible '
            'form confirmation when relevant without describing the code that submits it. '
            'A safe alternative must address the original concern using documented conditions; '
            'an unrelated approval lifecycle does not cover correction or lawful revision. '
        )
    if stage == 'KnowledgeAnswerReview':
        common += (
            'For each requirement, quoteIndexes must refer to evidence actually used by the '
            'answer blocks named in its pointChecks. Verify every cited extract supports that '
            'requirement; never copy the citation list from a neighboring refusal or permission '
            'paragraph onto the substantive procedure. Repair missing evidence or wording without '
            'adding unrelated quote indexes just to complete a review. '
        )
    if stage in {'KnowledgeAnswerDraft', 'KnowledgeAnswerReview'} and DOMAIN.search(question or ''):
        common += (
            'When the original request explicitly asks to bypass review, conceal evidence or '
            'arbitrarily change a finding, state the refusal directly and preserve that refusal '
            'through every revision. A statement that an operation is undocumented or unavailable '
            'is not a direct refusal. Give an evidence-preserving, non-evasive alternative only '
            'within the verified business workflow. Do not imply the shortcut would be acceptable '
            'if a button or undocumented permission existed. '
        )
    if not DOMAIN.search(question or ''):
        return common
    if stage == 'AnalysisPlan':
        common += (
            'For an individual content-compliance assessment, preserve the unverified conclusion '
            'and its missing material or applicable-edition evidence. If retrieved knowledge supplies '
            'a relevant auxiliary checklist, make the limitation actionable: in a cited context '
            'caveat explain which documented checkpoints still need to be checked against the '
            'actual material. Select at most four brief, relevant checkpoint names and label '
            'them as examples; never copy the entire checklist. Target at most 350 characters '
            'per caveat to stay within its 500-character schema limit. Identify them '
            'as auxiliary checks, never findings about this record '
            'or a substitute for the authorized formal review. Use only checkpoints supported by '
            'the supplied passages and include their published reference when present. Do not '
            'invent a checklist, article number or edition when absent. Keep the missing '
            'compliance attribute unfulfilled; a checklist cannot satisfy a live conclusion. '
        )
    if stage == 'AnalysisPlan':
        common += (
            'Before emitting the plan, inspect every selected metric and ordering definition. '
            'Materialize each declared condition as an actual upstream filter step with its exact '
            'field, predicate and typed operand, before counting or sorting. Writing an exclusion '
            'in a reason or answer caveat does not execute it. Chain the guards before testing a '
            'nullable derived clock; preserve genuinely unknown active rows as unconfirmed. '
            'Use the ordering definition valueField in the sort operation. An equivalent display '
            'unit may be projected separately, but do not silently replace the bound physical sort '
            'field. Do not relax a condition or invent one when evidence is missing. '
        )
    if stage in {'TaskSpec', 'QueryExpansion'}:
        return common + (
            'Content/Inspection scenario guidance: preserve the named parent record and the requested '
            'relationship to another entity. A task identifier, a violation identifier and an establishment '
            'identifier are typed references, never interchangeable. Related history remains constrained '
            'to the specified target; do not remove that constraint to obtain a routable population. '
            'A request for today\'s assigned work needs the intended business date and assignment scope; '
            'use the documented date alternatives if ambiguous. A request for the current overdue queue '
            'does not itself request records created today. Preserve independent per-person measures '
            'and the managed-membership condition. A completed workflow and a favorable inspection '
            'finding are distinct outcomes; never rewrite a request to change findings as a request '
            'to mark work completed. احتفظ بهوية السجل وعلاقته بالهدف؛ إكمال المهمة لا يساوي '
            'إثبات الامتثال أو تغيير نتيجة التفتيش.'
        )
    if stage in {'SourceSelection', 'AnalysisPlan'}:
        return common + (
            'Content/Inspection scenario guidance: preparation materials, checklist criteria, reported '
            'findings and finding-owned evidence may come from separate documented operations. Read '
            'the observed response of each operation at its own path; a checklist path never becomes '
            'a property on the task detail response merely because both refer to one task. Keep finding '
            'ownership for attachments; an empty case-wide attachment array does not prove no finding '
            'evidence. Use actual display identifiers and metadata, not private URLs or binary-content '
            'claims. For SLA, use the applicable page clock and documented paused/excluded states before '
            'sorting. Do not replace a nullable review clock with a raw overdue flag or a different '
            'clock. Keep unsupported fields explicit and retain independent verified outputs.'
        )
    if stage in {'KnowledgeCoverage', 'KnowledgeResolution', 'KnowledgeAnswerDraft', 'KnowledgeAnswerReview'}:
        return common + (
            'Content/Inspection scenario guidance: a refusal of bypass, evidence concealment or arbitrary '
            'outcome rewriting should address that requested act explicitly. A legitimate alternative '
            'must preserve evidence and use the relevant documented assessment, review or correction '
            'conditions. Completing a visit or submitting a report is not a guarantee of a passing '
            'finding. Scheduling edits are not outcome corrections. Do not present either as a way to '
            'obtain a favorable result. Explain which relevant steps are documented and which correction, '
            'retention or escalation rule remains unverified. Do not invent an approving owner or '
            'procedure. For content review, distinguish the actual material and applicable standard '
            'from a topic label; explain evidence-based review without generating evasion advice. '
            'An escalation/transfer action and a policy requiring escalation are distinct. Knowledge '
            'that a button exists cannot determine which cases must be escalated. Do not make live '
            'eligibility or a write a prerequisite of conditional explanation, and never claim the '
            'action occurred. لا يعني إكمال الزيارة أو إرسال التقرير أن النتيجة ناجحة. لا تستبدل '
            'مسار التصحيح غير الموثق بتعديل الجدول أو حذف الأدلة، ولا تختلق جهة اعتماد.'
        )
    return common

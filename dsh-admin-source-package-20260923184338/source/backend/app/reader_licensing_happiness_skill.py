"""Licensing and customer-service planning; facts and permissions stay evidence-owned."""
import re

VERSION = 'licensing-happiness-guidance/7'
LICENSING = re.compile(
    r'\b(?:licen[sc]\w*|permits?|foreign media|required (?:documents|materials))\b|'
    r'ترخيص|تراخيص|رخص|تصريح|تصاريح|المستندات المطلوبة|الوثائق المطلوبة|الإعلام الأجنبي', re.I)
HAPPINESS = re.compile(
    r'\b(?:tickets?|complaints?|happiness|customers?|internal notes?|communication history)\b|'
    r'تذكرة|التذكرة|تذاكر|شكوى|شكاوى|متعامل|عميل|العميل|العملاء|ملاحظات داخلية|سجل التواصل', re.I)


def licensing_happiness_skill(stage, question):
    licensing = bool(LICENSING.search(question or ''))
    happiness = bool(HAPPINESS.search(question or ''))
    guidance = ''
    if stage == 'TaskSpec':
        guidance += (
            'When bound history contains a pending clarification whose only missingSlot is '
            'disclosurePurpose, and the user supplies the requested purpose, save that purpose as '
            'disclosurePurpose with a current slotUpdate and resolve that unresolved slot. Continue '
            'the existing task. A purpose such as contacting a customer to resolve the current '
            'ticket is intent context, not a new data field or row filter. Preserve the original '
            'record, object, requested attributes, scope and filters unless the new message '
            'explicitly adds, narrows or clears them. Do not silently replace those attributes '
            'with a generic contact-details request. An explicit narrower request, topic switch '
            'or cancellation still takes precedence. A non-answer does not supply a purpose. '
            'No stated purpose grants permissions or establishes a record relationship. '
        )
    if not licensing and not happiness:
        return guidance
    if licensing and stage in {'TaskSpec', 'QueryExpansion'}:
        guidance += (
            'For rules supporting a particular application decision, retain the bound application '
            'and needsLiveData=true when its service and rule applicability still require a fresh '
            'authorized record check. A general policy question without a selected record may be '
            'answered from knowledge alone. Do not turn an application-specific follow-up into a '
            'generic policy explanation merely because its historical rule version is missing. '
            'The service check is a prerequisite, not permission to read other applications or '
            'a reason to replace the requested decision-rule requirement with a status query. '
            'Preserve the unresolved rule/version requirement. A verified current official service '
            'reference can be offered as supplementary guidance only after matching the service; '
            'it does not prove the historical decision basis. '
        )
    if stage in {'TaskSpec', 'QueryExpansion', 'RoutingDecision', 'SourceSelection', 'AnalysisPlan'}:
        guidance += (
            'Licensing/customer-service guidance: preserve the requested team, owner and internal-note '
            'scope. A personal queue, all services selector or role title cannot prove access to '
            'another department or every leader case. A missing scope relationship remains unknown; '
            'an observed permission denial is a denial. Do not silently substitute an accessible '
            'population for the requested population. '
        )
    if stage == 'RoutingDecision':
        guidance += (
            'A named department or business cohort is already a user-specified condition. If its '
            'source mapping is undocumented, keep a knowledge gap; do not ask the user to repeat '
            'the same cohort, remove it or select an unrelated cohort. Only cite a scope denial '
            'when the current permission/catalog and every relevant route prove the conflict. '
            'Use a valid probe only for an independently readable compatible object and scope, '
            'preserving every unknown condition for final validation. A knowledge gap or clarification '
            'decision has an empty routePlan. Missing definitions never authorize a broader read. '
        )
        if happiness:
            guidance += (
                'Read the complete supplied task, including disclosurePurpose, even when the latest '
                'message is only a purpose reply. A supplied purpose remains known, and explicitly '
                'requested attributes remain known choices. Do not ask the user to repeat the purpose '
                'or narrow those attributes merely because their necessity, authorization or field '
                'bindings are unproven. Preserve each original requirement as unknown where evidence '
                'is absent; a purpose never grants access or proves a customer relationship. Clarify '
                'only an actually unresolved user choice. A documented, independently authorized '
                'ticket lookup may be probed with the full request preserved; otherwise report the '
                'knowledge gap. Neither outcome authorizes an unbound customer or profile read. '
            )
    if licensing and stage == 'AnalysisPlan':
        guidance += (
            'verifiedServiceReferenceMatches is a runtime receipt matching a declared reference '
            'service name to one current authorized record and its exact field binding. Only that '
            'match is proven. Use the identified knowledge record and reference index for current '
            'supplementary guidance; do not require the same string value to appear in field inventory. '
            'Retain all original region, date, version and other conditions as independent requirements. '
            'The receipt never proves the applicable historical rule, legality or decision correctness. '
            'For a decision-rule request, if the current authorized record has independently '
            'matched the service described by a retrieved official reference, make that '
            'supported reference usable even when the historical decision version is missing. '
            'In cited context caveats identify its title and exact published URL, and summarize '
            'one or two documented conditions as current supplementary preparation guidance '
            'only. Do not return only a disclaimer when this verified reference is available. '
            'Without a fresh service match, omit that reference title, URL and conditions; '
            'state the unmatched-service gap instead of offering an unrelated checklist. Without '
            'a retrieved reference, do not invent a title, URL or conditions. Live record values '
            'belong in the verified observation output; a knowledge caveat must not cite page '
            'guidance as proof of those values. '
            'The reference does not prove the historical decision basis or fulfil that missing '
            'requirement. For a missing-materials request, include an available knowledge-backed '
            'conditional notification or request-modification path; current action availability '
            'and authorized human confirmation still require verification. Never assert that '
            'a notification was sent or that an unknown attachment is missing. Keep all unresolved '
            'requirements. Use brief separate caveats, each under the 500-character schema limit. '
        )
    if licensing and stage in {'SourceSelection', 'AnalysisPlan', 'KnowledgeCoverage', 'KnowledgeResolution'}:
        guidance += (
            'For missing application materials, keep the bound application, its stored form schema '
            'and submitted values, conditional requiredness and authorized upload metadata together. '
            'A public current service checklist is useful preparation information, but cannot prove '
            'which uploads are absent from an individual historical application. A service identifier, '
            'current workflow state and publication observation date do not by themselves establish '
            'an applicable historical rule version. Read independent verified facts where supported '
            'and retain the missing requirements. For expiry, use actual dates and the stated time '
            'window; a null expiry remains unknown, never perpetual or outside the window. '
        )
    if happiness and stage in {'SourceSelection', 'AnalysisPlan', 'KnowledgeCoverage', 'KnowledgeResolution'}:
        guidance += (
            'A ticket reference, applicant account and customer profile are distinct typed identities. '
            'Every lookup needs its own verified relation and parameters. Do not substitute a ticket '
            'identifier for a customer identifier or search all customers to bypass a missing link. '
            'For broad customer contacts or history, page visibility alone does not establish that '
            'every field is necessary for the current ticket. Preserve the disclosure purpose and '
            'the minimum authorized fields; if the purpose is absent, explain that gap instead of '
            'inventing a need. A department list supplies options, not a category-to-department '
            'routing rule. A recorded ticket type that conflicts with the question requires the '
            'documented clarification, not a guessed reassignment. '
        )
        if stage == 'AnalysisPlan':
            guidance += (
                'A captured customer, applicant or establishment response is not by itself a verified '
                'relation to the requested ticket. Use only matching runtime knowledge bindings and '
                'fresh identity/context proofs for the requested field and entity. When no matching '
                'binding exists, leave that requirement unbound and record its evidence gap in missing. '
                'Do not build a speculative output from nearby names, phone fields, establishment '
                'addresses or application arrays. Do not expose extra private fields or parent keys '
                'just to make a hidden lookup reachable. Keep independently supported requested '
                'outputs; an empty plan with explicit missing evidence is preferable when none can '
                'be proved. A knowledge caveat cannot establish a live field value or relationship. '
            )
    if stage in {'KnowledgeAnswerDraft', 'KnowledgeAnswerReview'}:
        guidance += (
            'Separate verified facts, unavailable evidence and any documented next step in the final '
            'answer. Keep useful supported facts even when another requested item is unknown. '
            'Explain an actual scope denial without claiming that missing evidence proves denial. '
            'For an instruction to erase unfavorable ratings or communication evidence, explicitly '
            'refuse alteration or concealment and truthfully state that no write occurred. Preserve '
            'the original record; a factual supplementary note or escalation is a formal correction '
            'or appeal procedure only when the cited policy establishes that status. State any '
            'unverified approval or retention rule without inventing it. Account suspension and '
            'account merging are separate actions: explain only supported target checks, impacts '
            'and human confirmation, and never invent target values or claim execution. '
            'Do not put API keys, binding identifiers or debugging details in the business answer. '
            'لا تعتبر غياب الدليل رفضاً مؤكداً للصلاحية، ولا تستبدل مجموعة العمل المطلوبة '
            'بطابور شخصي. ارفض محو أدلة التواصل، واحتفظ بحدود التصحيح غير الموثقة.'
        )
    return guidance

"""Financial reading guidance; current facts and policy remain evidence-owned."""
import re

VERSION = 'finance-evidence-guidance/3'
FINANCE = re.compile(
    r'\b(?:financ\w*|payments?|refunds?|fees?|transactions?|waiv\w*|bank\w*)\b|'
    r'مالي|مالية|دفع|استرداد|استرجاع|رسوم|إعفاء|اعفاء|مصرف|بنكي|بطاق', re.I)


def finance_skill(stage, question):
    if not FINANCE.search(question or ''):
        return ''
    if stage in {'TaskSpec', 'QueryExpansion'}:
        return (
            'Financial scenario guidance: keep the original payment/refund/fee object, named '
            'record, requested action, period and requested population distinct. A question about '
            'why a specific fee has its current amount requests live evidence and the applicable '
            'pricing meaning. Do not turn it into only a generic fee-policy explanation. Pending '
            'reconciliation needs its own cited population and date definition; a transaction or '
            'refund status with similar wording cannot supply that definition by itself. Preserve '
            'both reported sources and their timestamps in a status-discrepancy question. '
            'Keep the referenced transaction and its identifier in the object and identity slots. '
            'When explaining the amount displayed for a named payment transaction, request its '
            'transaction amount together with the fee calculation basis. The transaction amount '
            'belongs to that payment record; a linked stored application fee total is a separate '
            'supporting comparison, not a replacement amount. A request for a separately identified '
            'processing fee, surcharge or VAT must retain that specific component. For a service '
            'quote without a transaction, preserve the requested quote fee amount. Do not invent '
            'a free-text reason column or a composite transaction-fee attribute by repeating the '
            'parent object label. For this explanation keep the requested attributes atomic: '
            'transaction amount; fee calculation basis; and, if the linked quote is requested, '
            'fee amount. Do not additionally request transaction fee amount unless the original '
            'question explicitly identifies a separate transaction-processing fee. Arabic '
            'رسوم المعاملة in an amount-explanation question is not by itself evidence of such '
            'a separate charge; retain the original meaning over an ambiguous canonical '
            'translation. Preserve distinctions that change meaning: '
            'the actual payment amount, a linked stored quote, a processing charge and a historical '
            'pricing snapshot are different facts. Do not collapse them to simplify a binding. '
        )
    if stage in {'SourceSelection', 'AnalysisPlan'}:
        return (
            'Financial scenario guidance: use the verified transaction/refund identity and only '
            'documented links to the associated fee basis. Keep amount, currency, quantity, unit '
            'price, service version and beneficiary applicability grounded in their actual source. '
            'A current service configuration is not automatically the immutable original quote. '
            'Do not add provider settlement allocations or taxes to a customer fee unless the '
            'applicable pricing definition establishes that composition. Preserve unknown components. '
            'A scalar amount already read or summed is not a row collection for another row operator. '
            'Do not project payment credentials, bank accounts or complete card information. '
        )
    if stage in {'KnowledgeCoverage', 'KnowledgeResolution', 'KnowledgeAnswerDraft', 'KnowledgeAnswerReview'}:
        return (
            'Financial scenario guidance: state the read-only action boundary and truthful action '
            'status once. A display name containing Admin, an assigned role, page visibility and a '
            'record execution flag are different evidence and never give the assistant a write tool. '
            'For a refund procedure, retain cited preview checks for the target, amount/currency, '
            'authorized minimum recipient information, impact and explicit human confirmation. '
            'Do not invent live preview values or ask the user to confirm an action the assistant '
            'cannot perform. For refused waiver, export or deletion requests, explain only the '
            'applicable documented alternative and its real prerequisites. Missing waiver authority, '
            'adjustment procedure or retention policy remains unverified; do not invent an approving '
            'role, blanket prohibition or successful change. A fee amount needs its actual components; '
            'a reconciliation count needs a verified population; conflicting status reports do not '
            'establish which is correct or why they differ. Keep the supported answer concise and '
            'retain every material limitation in both languages. لا تختلق سياسة إعفاء أو احتفاظ '
            'ولا تعتبر حالة الدفع وحدها تعريفاً لمجموعة المعاملات المطلوب مطابقتها.'
            ' In a permission-sensitive financial answer, use the actual assigned roles from '
            'verifiedSession when available, with their session citation; do not replace this '
            'check with a generic warning about display names. Keep the answer compact by grouping '
            'related requirements in the same cited block. State the action boundary and unassessed '
            'eligibility once, give the relevant preview/confirmation conditions once, then one '
            'documented next step. Use business page names and record numbers for navigation; '
            'do not narrate matching algorithms, internal request parameters or version-field '
            'mechanics. These editing instructions never remove a material check or missing rule.'
        )
    return ''

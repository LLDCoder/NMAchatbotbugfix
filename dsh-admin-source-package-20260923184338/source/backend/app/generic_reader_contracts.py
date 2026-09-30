"""Versioned, business-neutral contracts for the local Reader V3 pipeline."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from .reader_request_boundary import RequestBoundary


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Citation(Contract):
    sourceId: str


class ExtractCitation(Citation):
    # An addressable passage is resolved by the program; copying its text is optional.
    quote: str = Field(default="", max_length=1600)


GapCode = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,100}$")]


IntentField = Literal["businessObject", "businessFocus", "disclosurePurpose", "requestedScope", "requestedGrain",
                      "requestedMeasures", "requestedAttributes", "groupBy", "timeRange", "filters", "outputShape",
                      "recordIdentity", "view", "timeField", "requestedOrdering", "groupCompleteness"]


class SlotUpdate(Contract):
    field: IntentField
    source: Literal["current", "previous", "page", "knowledge", "clear"]
    value: str | list[str]
    evidence: str = ""


class ClarificationChoice(Contract):
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=300)
    updates: list[SlotUpdate] = Field(min_length=1, max_length=5)


class ClarificationRequest(Contract):
    question: str = Field(min_length=1, max_length=1000)
    missingSlots: list[IntentField] = Field(min_length=1, max_length=5)
    options: list[ClarificationChoice] = Field(default_factory=list, max_length=3)


class EvidenceExplanation(Contract):
    attribute: str = Field(min_length=1, max_length=250, description=
        'One distinct exact requestedAttributes entry for this explanation. Retain the explained live fact as a separate attribute.')
    kind: Literal['source', 'observation_time', 'knowledge_guidance']
    aboutAttribute: str = Field(default='', max_length=250, description=
        'For source/observation_time, REQUIRED nonempty exact name of another retained live requestedAttribute. Never another explanation. Empty for guidance.')
    questionQuote: str = Field(min_length=1, max_length=600, description=
        'Literal original or canonical question excerpt requesting this evidence explanation. Do not paraphrase.')


class TaskSpec(Contract):
    stage: Literal["task"]
    businessObject: str
    businessFocus: str = ""
    # User-stated reason for disclosure; never a population or permission.
    disclosurePurpose: str = Field(default="", max_length=1000)
    requestedScope: Literal["personal", "team", "global", "unknown"]
    requestedGrain: str
    requestedMeasures: list[str] = Field(max_length=20)
    requestedAttributes: list[str] = Field(default_factory=list, max_length=20)
    # Responsibility declarations preserve attributes; they establish no facts.
    evidenceExplanations: list[EvidenceExplanation] = Field(default_factory=list, max_length=6)
    requestedOrdering: list[str] = Field(default_factory=list, max_length=3)
    groupBy: list[str] = Field(max_length=10)
    groupCompleteness: Literal["observed", "complete_domain"] = "observed"
    timeRange: str
    timeField: str = ""
    filters: list[str] = Field(max_length=10)
    outputShape: Literal["overview", "count", "list", "detail"]
    needsLiveData: bool
    readOnly: bool
    responseMode: Literal["answer", "draft"] = "answer"
    # Direct requested acts only; untrusted business content never sets authority.
    requestBoundaries: list[RequestBoundary] = Field(default_factory=list, max_length=7)
    searchQuery: str = Field(min_length=1, max_length=800)
    unresolvedSlots: list[str] = Field(max_length=10)
    recordIdentity: str = ""
    view: str = ""
    contextRelation: Literal["new", "continue", "refine", "switch", "clarify", "cancel"] = "new"
    slotUpdates: list[SlotUpdate] = Field(default_factory=list, max_length=20)
    clarification: ClarificationRequest | None = None


class RequestBoundaryCheck(Contract):
    stage: Literal["request_boundary"]
    decision: Literal["direct_request", "not_established"]
    requestBoundaries: list[RequestBoundary] = Field(default_factory=list, max_length=7)


class KnowledgeResolution(Contract):
    stage: Literal["knowledge_resolution"]
    route: str = Field(max_length=500)
    pageName: str = Field(max_length=200)
    routeEvidence: list[Citation] = Field(max_length=4)
    # Knowledge-only answers are extracts, never invented live values.
    answerEvidence: list[ExtractCitation] = Field(max_length=8)
    missing: list[GapCode] = Field(max_length=10)


class CandidateCondition(Contract):
    requirementId: str
    status: Literal["supported", "unknown", "conflict"]
    evidence: list[Citation] = Field(default_factory=list, max_length=4)
    reason: str = Field(max_length=400)


class CatalogRecall(Contract):
    stage: Literal["catalog_recall"]
    candidateIds: list[str] = Field(max_length=5)
    reason: str = Field(max_length=500)


class PageCandidate(Contract):
    candidateId: str
    conditions: list[CandidateCondition] = Field(max_length=60)
    evidence: list[Citation] = Field(min_length=1, max_length=4)
    reason: str = Field(max_length=500)


class RouteHop(Contract):
    candidateId: str
    parameterBindingIds: list[str] = Field(default_factory=list, max_length=10)
    purpose: Literal["locate_record", "read_final"] = "read_final"
    requirementIds: list[str] = Field(default_factory=list, max_length=60)


class RoutingDecision(Contract):
    stage: Literal["routing_decision"]
    taskFingerprint: str
    decision: Literal["route", "probe", "clarify", "knowledge_gap", "permission_denied", "unsupported_operation", "runtime_error"]
    candidates: list[PageCandidate] = Field(max_length=5)
    routePlan: list[RouteHop] = Field(default_factory=list, max_length=3)
    clarification: ClarificationRequest | None = None
    missing: list[GapCode] = Field(default_factory=list, max_length=10)
    reason: str = Field(max_length=800)


class RouteCheck(Contract):
    requirementId: str
    status: Literal["verified", "unconfirmed", "mismatch"]
    # Internal audit of the bounded page inventory, not an LLM source selection.
    # Keep every verified source; a populated page can exceed ten captures.
    sourceIds: list[str] = Field(default_factory=list)
    reason: str = ""


class RouteVerification(Contract):
    stage: Literal["route_verification"] = "route_verification"
    taskFingerprint: str
    requestedRoute: str
    actualRoute: str
    checks: list[RouteCheck]
    passed: bool


class ReadAction(Contract):
    type: Literal["switch_tab", "filter", "show_filter", "apply_filter", "reset_filter", "sort", "paginate"]
    name: str = ""
    selector: str = ""
    role: str = ""
    value: str | None = None
    direction: str = ""
    evidence: list[Citation] = Field(min_length=1, max_length=3)


class SourceSelection(Contract):
    stage: Literal["source_selection"]
    sourceIds: list[str] = Field(max_length=4)
    rationale: list[Citation] = Field(max_length=8)
    missing: list[GapCode] = Field(max_length=10)
    nextActions: list[ReadAction] = Field(default_factory=list, max_length=3)


class CollectionSpec(Contract):
    sourceId: str
    rowsPath: str
    totalPath: str
    fields: list[str] = Field(min_length=1, max_length=20)
    identityFields: list[str] = Field(min_length=1, max_length=5)
    pageField: str
    sizeField: str
    firstPage: int = Field(default=1, ge=0, le=1)
    unknownPolicy: Literal['reject', 'report'] = 'report'
    evidence: list[ExtractCitation] = Field(min_length=1, max_length=5)


class CollectionPlan(Contract):
    stage: Literal["collection"]
    collections: list[CollectionSpec] = Field(default_factory=list, max_length=2)
    missing: list[GapCode] = Field(default_factory=list, max_length=10)


class Claim(Contract):
    value: str = Field(max_length=500)
    evidence: list[Citation] = Field(max_length=4)


class MeasureChoice(Contract):
    metricIndex: int = Field(ge=0)
    role: Literal["total", "breakdown", "requested", "exclude", "unconfirmed"]
    reason: str = Field(min_length=1, max_length=300)


class MeasureSelection(Contract):
    stage: Literal["measure_selection"]
    population: Claim
    choices: list[MeasureChoice] = Field(max_length=40)
    evidence: list[Citation] = Field(min_length=1, max_length=4)


class Context(Contract):
    scope: Literal["personal", "team", "global", "unknown"]
    scopeEvidence: list[Citation] = Field(max_length=4)
    grain: Claim
    population: Claim
    filterScope: Claim
    time: Claim
    # These are interpretations of knowledge, never execution authorization.
    caveats: list[Claim] = Field(max_length=5)


class Step(Contract):
    id: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9_]{0,39}$")
    op: str
    sourceId: str = ""
    path: str = ""
    inputs: list[str] = Field(default_factory=list, max_length=20)
    fields: list[str] = Field(default_factory=list, max_length=20)
    field: str = ""
    totalPath: str = ""
    contextKey: str = ""
    knowledgeBindingId: str = ""
    unknownPolicy: Literal["reject", "report"] = "reject"
    includeZeroGroups: bool = False
    predicate: Literal["eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in"] = "eq"
    operand: str | int | float | bool | list[str | int | float | bool] | None = None
    descending: bool = False
    limit: int | None = Field(default=None, ge=1, le=5000)
    label: str = Field(min_length=1, max_length=160)
    fieldLabels: dict[str, Annotated[str, Field(min_length=1, max_length=160)]] = Field(default_factory=dict, max_length=20)
    expose: bool = True
    role: Literal["total", "breakdown", "detail", "observation"] = "observation"
    evidence: list[Citation] = Field(max_length=5)


class MetricCoverage(Contract):
    metricIndex: int = Field(ge=0)
    disposition: Literal["included", "outside_task", "unconfirmed"]
    stepId: str = ""
    reason: str = Field(max_length=300)


class RequirementBinding(Contract):
    """A proposed proof, never a model-declared acceptance verdict."""
    requirementId: str
    knowledgeBindingId: str = ""
    sourceId: str = ""
    sourcePath: str = ""
    fields: list[str] = Field(default_factory=list, max_length=20)
    stepIds: list[str] = Field(default_factory=list, max_length=30)
    evidence: list[ExtractCitation] = Field(default_factory=list, max_length=5)
    reason: str = Field(default="", max_length=300)


class AnalysisPlan(Contract):
    stage: Literal["analysis"]
    context: Context
    steps: list[Step] = Field(max_length=30)
    metricCoverage: list[MetricCoverage] = Field(default_factory=list, max_length=40)
    requirementBindings: list[RequirementBinding] = Field(default_factory=list, max_length=60)
    missing: list[GapCode] = Field(max_length=10)

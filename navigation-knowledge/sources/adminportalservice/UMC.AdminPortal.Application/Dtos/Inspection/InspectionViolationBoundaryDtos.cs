using System.Text.Json;
using UMC.AdminPortal.Domain.Models.Inspection;

namespace UMC.AdminPortal.Application.Dtos.Inspection;

public class InspectionViolationListRequestDto
{
    public string? Search { get; set; }
    public string? Scope { get; set; }
    public InspectionViolationStatus? StatusId { get; set; }
    public int? ViolationTypeId { get; set; }
    public string? AssignedContentId { get; set; }
    /// <summary>Filter by the violation creator (InspectionViolations.CreatedBy).</summary>
    public string? ReportBy { get; set; }
    public DateTime? CreatedOnFrom { get; set; }
    public DateTime? CreatedOnTo { get; set; }
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? SortBy { get; set; }
    public string? SortDirection { get; set; }
}

public class InspectionViolationListItemDto
{
    public int Id { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public int? TaskId { get; set; }
    public string? TaskNo { get; set; }
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeCode { get; set; }
    public string? ViolationTypeName { get; set; }
    public string? InspectionReasonName { get; set; }
    public int StatusId { get; set; }
    public string? StatusName { get; set; }
    public string ViolatorName { get; set; } = string.Empty;
    public string? ViolatorIdentifier { get; set; }
    /// <summary>Target type of the violator: "Establishment", "Individual", or "Unregistered".</summary>
    public string? TargetTypeCode { get; set; }
    public string? ReportedByUserId { get; set; }
    public string? ReportedByName { get; set; }
    public string? CreatedByName { get; set; }
    public decimal FineAmount { get; set; }
    public decimal? BeforeAppealAdjustedFineAmount { get; set; }
    public string? AssignedContentId { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public InspectionTaskSlaSummaryDto? Sla { get; set; }
    public List<string> AvailableActions { get; set; } = new();
    public string? ViolationReportUrl { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionViolationListResponseDto
{
    public List<InspectionViolationListItemDto> Items { get; set; } = new();
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

public class InspectionCustomerViolationListRequestDto
{
    public int TaskId { get; set; }
}

public class InspectionUserViolationListRequestDto
{
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public int? TaskId { get; set; }
    public string? Keyword { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public int? ViolationTypeId { get; set; }
    public int? StatusId { get; set; }
    public DateTime? ApprovalTimeFrom { get; set; }
    public DateTime? ApprovalTimeTo { get; set; }
    public DateTime? PaidTimeFrom { get; set; }
    public DateTime? PaidTimeTo { get; set; }
}

public class InspectionCustomerViolationListItemDto
{
    public int ViolationId { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public string ViolatorName { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeName { get; set; }
    public decimal FineAmount { get; set; }
    public decimal? BeforeAppealAdjustedFineAmount { get; set; }
    public int StatusId { get; set; }
    public string? StatusName { get; set; }
    public DateTime CreatedOn { get; set; }
}

public class InspectionUserViolationListItemDto
{
    public int ViolationId { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public string ViolatorName { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeName { get; set; }
    public decimal FineAmount { get; set; }
    public decimal? BeforeAppealAdjustedFineAmount { get; set; }
    public int StatusId { get; set; }
    public string? StatusName { get; set; }
    public int? SourceTaskId { get; set; }
    public string? SourceTaskNo { get; set; }
    public string? ReportedByUserId { get; set; }
    public string? ReportedByName { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime? PaidTime { get; set; }
}

public class InspectionUserViolationListResponseDto
{
    public int Total { get; set; }
    public List<InspectionUserViolationListItemDto> Items { get; set; } = new();
    public List<InspectionViolationStatusStatDto> Statuses { get; set; } = new();
}

public class InspectionViolationStatusStatDto
{
    public int StatusId { get; set; }
    public string? StatusName { get; set; }
    public int Count { get; set; }
}

public class InspectionViolationStatsResponseDto
{
    public int TotalCount { get; set; }
    public List<InspectionViolationStatusStatDto> Statuses { get; set; } = new();
}

public class InspectionViolationPenaltyStandardDto
{
    public int ViolationId { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeCode { get; set; }
    public string? ViolationTypeName { get; set; }
    public List<InspectionViolationLicensingPenaltyStandardItemDto> LicensingStandards { get; set; } = new();
    public List<InspectionViolationContentPenaltyStandardItemDto> ContentStandards { get; set; } = new();
}

public class InspectionViolationPenaltyOrderDetailDto
{
    public int PenaltyOrderId { get; set; }
    public int ViolationId { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public int? SourceTaskId { get; set; }
    public string ViolatorName { get; set; } = string.Empty;
    public string? ViolatorIdentifier { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal? BeforeAppealAdjustedTotalAmount { get; set; }
    public string Currency { get; set; } = string.Empty;
    public int StatusId { get; set; }
    public string OrderStatus { get; set; } = string.Empty;
    public int? PendingTransactionId { get; set; }
    public string? EngineCorrelationId { get; set; }
    public DateTime CalculatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? RawEngineResponseJson { get; set; }
    public List<InspectionViolationChecklistViolationDto> Items { get; set; } = new();
}

public class InspectionViolationPenaltyStandardItemDto
{
    public long? PenaltyStandardId { get; set; }
    public int ViolationItemId { get; set; }
    public int? LegacyViolationItemId { get; set; }
    public string ViolationItemCode { get; set; } = string.Empty;
    public string ViolationItemName { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    public int RectificationWindowDays { get; set; }
    public int ResetWindowMonths { get; set; }
    public string? AdditionalPenaltyAction { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public int? DisplayOrder { get; set; }
}

public class InspectionViolationLicensingPenaltyStandardItemDto : InspectionViolationPenaltyStandardItemDto
{
    public string PenaltyModeCode { get; set; } = string.Empty;
    public decimal? FirstFineAmount { get; set; }
    public decimal? RepeatFineAmount { get; set; }
    public decimal? EscalationFineAmount { get; set; }
    public int? EscalationStartOccurrence { get; set; }
    public decimal? RecurrenceMultiplier { get; set; }
    public int? WarningThresholdCount { get; set; }
    public int? GracePeriodDays { get; set; }
    public int? DailyFineStartDay { get; set; }
    public int? DailyFineEndDay { get; set; }
    public decimal? DailyFineAmount { get; set; }
    public decimal? DailyFineMaxAmount { get; set; }
}

public class InspectionViolationContentPenaltyStandardItemDto : InspectionViolationPenaltyStandardItemDto
{
    public decimal? Degree1FineAmount { get; set; }
    public decimal? Degree2FineAmount { get; set; }
    public decimal? Degree3FineAmount { get; set; }
    public decimal? Degree4FineAmount { get; set; }
}


/// <summary>Module-level note and attachments for a specific display context within a checklist violation.</summary>
public class InspectionViolationChecklistModuleDto
{
    public string? Note { get; set; }
    public List<InspectionViolationAttachmentDto> Attachments { get; set; } = new();
}

public class InspectionViolationChecklistViolationDto
{
    public int Id { get; set; }
    public int TaskChecklistItemId { get; set; }
    public string ChecklistCode { get; set; } = string.Empty;
    public string? ChecklistName { get; set; }
    public string? ViolationDescription { get; set; }
    public DateTime RecordedAt { get; set; }
    public int ViolationItemId { get; set; }
    public string ViolationItemCode { get; set; } = string.Empty;
    public string ViolationItemName { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeCode { get; set; }
    public string? ViolationTypeName { get; set; }
    public InspectionTaskChecklistViolationAppealResult? AppealResult { get; set; }
    public string? AppealResultCode { get; set; }
    public int? Degree { get; set; }
    public int? OldDegree { get; set; }
    public int? NewDegree { get; set; }
    public decimal FineAmount { get; set; }
    public decimal? BeforeAppealAdjustedFineAmount { get; set; }
    public string? Notes { get; set; }
    public string? CommitteeNote { get; set; }
    public bool? Reported { get; set; }
    public bool? CommitteeReview { get; set; }
    public List<InspectionViolationAttachmentDto> Attachments { get; set; } = new();
    /// <summary>ChecklistEvidence attachments for the Reported Violations / evidence display.</summary>
    public List<InspectionViolationAttachmentDto> ReportAttachment { get; set; } = new();
    /// <summary>CommitteeDecision attachments for the Committee Review Decision display.</summary>
    public List<InspectionViolationAttachmentDto> CommitteeAttachment { get; set; } = new();
    /// <summary>Appeal note: CommitteeNote if present, otherwise Notes.</summary>
    public string? AppealNote { get; set; }
    /// <summary>Appeal attachments: CommitteeAttachment if present, otherwise ReportAttachment.</summary>
    public List<InspectionViolationAttachmentDto> AppealAttachment { get; set; } = new();

}

public class InspectionViolationTaskChecklistViolationDto
{
    public int Id { get; set; }
    public int? TaskId { get; set; }
    public int TaskChecklistItemId { get; set; }
    public string ChecklistCode { get; set; } = string.Empty;
    public string? ChecklistName { get; set; }
    public string? ViolationDescription { get; set; }
    public DateTime RecordedAt { get; set; }
    public int ViolationItemId { get; set; }
    public string ViolationItemCode { get; set; } = string.Empty;
    public string ViolationItemName { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeCode { get; set; }
    public string? ViolationTypeName { get; set; }
    public InspectionTaskChecklistViolationAppealResult? AppealResult { get; set; }
    public string? AppealResultCode { get; set; }
    public int? Degree { get; set; }
    public int? OldDegree { get; set; }
    public int? NewDegree { get; set; }
    public decimal FineAmount { get; set; }
    public decimal? BeforeAppealAdjustedFineAmount { get; set; }
    public string? Notes { get; set; }
    public string? CommitteeNote { get; set; }
    public bool? Reported { get; set; }
    public bool? CommitteeReview { get; set; }
}

public class InspectionViolationTaskChecklistAttachmentDto
{
    public int Id { get; set; }
    public int? TaskId { get; set; }
    public string RelatedEntityType { get; set; } = string.Empty;
    public int? RelatedEntityId { get; set; }
    public string? RelatedEntityCode { get; set; }
    public string AttachmentCategory { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class InspectionViolationAttachmentDto
{
    public int Id { get; set; }
    public string RelatedEntityType { get; set; } = string.Empty;
    public int? RelatedEntityId { get; set; }
    public string? RelatedEntityCode { get; set; }
    public string AttachmentCategory { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class InspectionViolationTimelineItemDto
{
    public int Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string? RawEventType { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Result { get; set; } = string.Empty;
    public int? DepartmentId { get; set; }
    public int? FromStatusId { get; set; }
    public int? ToStatusId { get; set; }
    public string? HandlerUserId { get; set; }
    public string? HandlerUserName { get; set; }
    public string? ActualActorTypeCode { get; set; }
    public string? ActualActorUserId { get; set; }
    public string? ActualActorUserName { get; set; }
    public int? OperatorRoleId { get; set; }
    public string? OperatorName { get; set; }
    public int? ActualActorRoleId { get; set; }
    public string? PendingHandlerUserId { get; set; }
    public string? PendingHandlerUserName { get; set; }
    public string? DisplayActorSource { get; set; }
    public bool IsPendingPlaceholder { get; set; }
    public DateTime CreatedOn { get; set; }
    public JsonElement? Metadata { get; set; }
    public string? DisplayTitle { get; set; }
    public string? DisplayActor { get; set; }
    public DateTime? DisplayTime { get; set; }
    public string? DisplayDetails { get; set; }
    public string? DisplayStatusCode { get; set; }
    public string? DisplayStatusName { get; set; }
    public string? InternalStatusCode { get; set; }
    public string? InternalStatusName { get; set; }
    public bool IsCurrentStatusEvent { get; set; }
    public List<InspectionAttachmentDto> Attachments { get; set; } = new();
}

public class InspectionViolationAppealSummaryDto
{
    public int Id { get; set; }
    public string? AppealNo { get; set; }
    public int StatusId { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public int? DecisionTypeId { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime? DecidedOn { get; set; }
}

public class InspectionViolationPaymentSummaryDto
{
    public string? PaymentStatusCode { get; set; }
    public string? PaymentStatusName { get; set; }
    public decimal AmountDue { get; set; }
    public decimal PaidAmount { get; set; }
    public DateTime? PaidOn { get; set; }
    public string? PaymentReferenceNo { get; set; }
    public string? ReceiptFileName { get; set; }
    public string? ReceiptFileUrl { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionViolationRefundSummaryDto
{
    public string? RefundStatusCode { get; set; }
    public string? RefundStatusName { get; set; }
    public DateTime? RefundRequestedOn { get; set; }
    public DateTime? RefundApprovedOn { get; set; }
    public decimal RefundAmount { get; set; }
    public string? RefundReason { get; set; }
    public string? RefundReferenceNo { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionViolationReinspectionTaskDto
{
    public int TaskId { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Inspector { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionViolationAppealHistoryItemDto
{
    public int AppealId { get; set; }
    public string? AppealNo { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public int? DecisionTypeId { get; set; }
    public string? DecisionTypeCode { get; set; }
    public string? DecisionTypeName { get; set; }
    public decimal? OldFineAmount { get; set; }
    public decimal? NewFineAmount { get; set; }
    public int? OldViolationStatusId { get; set; }
    public int? NewViolationStatusId { get; set; }
    public string? CommitteeNotes { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime? DecidedOn { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionViolationRelatedAppealDto
{
    public int Id { get; set; }
    public string? AppealNo { get; set; }
    public string AppealReason { get; set; } = string.Empty;
    public string? AppealReasonRemark { get; set; }
    public int StatusId { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public DateTime? SlaStartedOn { get; set; }
    public DateTime? SlaDueOn { get; set; }
    public string? AttachmentUrl1 { get; set; }
    public string? AttachmentUrl2 { get; set; }
    public string? AttachmentUrl3 { get; set; }
}

public class InspectionViolationDetailDto
{
    public int Id { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public int? SourceTaskId { get; set; }
    public string? SourceTaskNo { get; set; }
    public int ViolationTypeId { get; set; }
    public string? ViolationTypeCode { get; set; }
    public string? ViolationTypeName { get; set; }
    public string ViolatorName { get; set; } = string.Empty;
    public string? ViolatorIdentifier { get; set; }
    public string? ReportedByUserId { get; set; }
    public string? ReportedByName { get; set; }
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public int? ProfileId { get; set; }
    public int? UserProfileId { get; set; }
    public string? UserId { get; set; }
    public int? UserTypeId { get; set; }
    public string? UserTypeCode { get; set; }
    public string? LicenseNumber { get; set; }
    public string? EstablishmentName { get; set; }
    public string? EstablishmentNameAr { get; set; }
    public string? TargetName { get; set; }
    public int StatusId { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public int? InternalStatusId { get; set; }
    public string? InternalStatusCode { get; set; }
    public string? InternalStatusName { get; set; }
    public string? BusinessStatusCode { get; set; }
    public string? BusinessStatusName { get; set; }
    public decimal FineAmount { get; set; }
    public decimal? BeforeAppealAdjustedFineAmount { get; set; }
    public bool AppealApproval { get; set; }
    public InspectionTaskSlaSummaryDto? Sla { get; set; }
    public string? AssignedContentId { get; set; }
    public string? DeclarationRecipientAddress { get; set; }
    public string? DeclarationStatusCode { get; set; }
    public string? DeclarationStatusName { get; set; }
    public DateTime? DeclarationLinkSentOn { get; set; }
    public DateTime? DeclarationLinkExpiresOn { get; set; }
    public DateTime? DeclarationSubmittedOn { get; set; }
    public string? DeclarationPortalUrl { get; set; }
    public string? DeclarationToken { get; set; }
    public string? DeclarationDocumentFileName { get; set; }
    public string? DeclarationDocumentFileUrl { get; set; }
    public string? ContentReviewReportUrl { get; set; }
    public string? ContentReviewSummary { get; set; }
    public string? LatestTransferNote { get; set; }
    public string? ContentReviewNote { get; set; }
    public int? CommitteeDecisionTypeId { get; set; }
    public string? CommitteeDecisionTypeName { get; set; }
    public string? CommitteeDecisionTypeNameAr { get; set; }
    public string? CommitteeDecisionNote { get; set; }
    public string? CommitteeDecidedByUserId { get; set; }
    public string? CommitteeDecidedByName { get; set; }
    public DateTime? CommitteeDecidedOn { get; set; }
    public string? AppealDecisionNote { get; set; }
    public string? AppealDecidedByUserId { get; set; }
    public string? AppealDecidedByName { get; set; }
    public DateTime? AppealDecidedOn { get; set; }
    public int? AppealDecisionTypeId { get; set; }
    public string? AppealDecisionTypeCode { get; set; }
    public string? AppealDecisionTypeName { get; set; }
    public string? AppealDecisionTypeNameAr { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public List<string> AvailableActions { get; set; } = new();
    public List<InspectionViolationReinspectionTaskDto> ReinspectionTasks { get; set; } = new();
    public InspectionViolationRelatedAppealDto? RelatedAppeal { get; set; }
    public bool IsMock { get; set; }
    public int ViolationCount { get; set; }
    public int UnpayCount { get; set; }
    public List<InspectionViolationChecklistViolationDto> ChecklistViolations { get; set; } = new();
    public List<InspectionViolationAttachmentDto> Attachments { get; set; } = new();
}

public class RouteInspectionViolationRequestDto
{
    public string? RouteTargetCode { get; set; }
    public string AssignedContentId { get; set; } = string.Empty;
    public string? LatestTransferNote { get; set; }
}

public class SubmitInspectionContentReportRequestDto
{
    public string? ContentReviewReportNumber { get; set; }
    public string ContentReviewReportUrl { get; set; } = string.Empty;
    public string? ContentReviewSummary { get; set; }
    public string? ContentReviewNote { get; set; }
}


public class DecideInspectionViolationItemDto
{
    public int ViolationItemId { get; set; }
    public string ViolationItemCode { get; set; } = string.Empty;
    public string ViolationItemName { get; set; } = string.Empty;
    public int? DecisionTypeId { get; set; }
    public int? Degree { get; set; }
    public decimal FineAmount { get; set; }
    public string? CommitteeNote { get; set; }
    /// <summary>Supporting attachments uploaded by the committee for this violation item (optional).</summary>
    public List<InspectionRequestAttachmentDto>? Attachments { get; set; }
}

public class DecideInspectionViolationRequestDto
{
    public int? CommitteeDecisionTypeId { get; set; }
    public string? CommitteeDecisionNote { get; set; }
    public List<DecideInspectionViolationItemDto> Items { get; set; } = new();
}


public enum AppealHandlerTypeEnum
{
    /// <summary>Internal committee member responsible for reviewing the appeal.</summary>
    Committee = 1,

    /// <summary>Happiness / customer-satisfaction officer assigned to the appeal.</summary>
    Happiness = 2
}

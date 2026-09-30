using System.Text.Json.Serialization;
using UMC.AdminPortal.Domain.Models.Inspection;

namespace UMC.AdminPortal.Application.Dtos.Inspection;

public class InspectionRequestAttachmentDto
{
    public string? RelatedEntityType { get; set; }
    public int? RelatedEntityId { get; set; }
    public string? RelatedEntityCode { get; set; }
    public string? AttachmentCategory { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? ContentType { get; set; }
}

public class InspectionAttachmentDto
{
    public int Id { get; set; }
    public string RelatedEntityType { get; set; } = string.Empty;
    public int? RelatedEntityId { get; set; }
    public string? RelatedEntityCode { get; set; }
    public string AttachmentCategory { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class InspectionTaskListRequestDto
{
    public string? Search { get; set; }
    public string? Scope { get; set; }
    public int? StatusId { get; set; }
    public int? TargetTypeId { get; set; }
    public int? InspectionReasonId { get; set; }
    public int? InspectionMethodId { get; set; }
    public string? EmiratesId { get; set; }
    public int? AuthorityId { get; set; }
    public int? PriorityId { get; set; }
    public string? AssignedInspectorId { get; set; }
    public DateTime? DueDateFrom { get; set; }
    public DateTime? DueDateTo { get; set; }
    public DateTime? AssignedTimeFrom { get; set; }
    public DateTime? AssignedTimeTo { get; set; }
    public string? CreateBy { get; set; }
    public DateTime? CreateAtFrom { get; set; }
    public DateTime? CreateAtTo { get; set; }
    public int PageIndex { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? SortBy { get; set; }
    public string? SortDirection { get; set; }
}

public class InspectionTaskListItemDto
{
    public int Id { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public int TargetTypeId { get; set; }
    public string? TargetTypeCode { get; set; }
    public string? TargetTypeName { get; set; }
    public string? TargetName { get; set; }
    public int InspectionMethodId { get; set; }
    public string? InspectionMethodCode { get; set; }
    public string? InspectionMethodName { get; set; }
    public int StatusId { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public string? ActivityName { get; set; }
    public string? EstablishmentName { get; set; }
    public string? FullName { get; set; }
    public string? InspectionReasonName { get; set; }
    public string? EmirateName { get; set; }
    public string? AuthorityName { get; set; }
    public string? PriorityName { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? AssignedOn { get; set; }
    public InspectionTaskSlaSummaryDto? Sla { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public string? CreatedByName { get; set; }
    public string? InspectorName { get; set; }
    public string AssignmentState { get; set; } = "Unassigned";
    public string ScopeCode { get; set; } = "Todo";
    public bool CountsTowardInspectionInterval { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? CancelView { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskSlaSummaryDto
{
    public bool IsVisible { get; set; }
    public string StatusCode { get; set; } = string.Empty;
    public string Color { get; set; } = "default";
    public string DisplayText { get; set; } = string.Empty;
    public DateTime? DueOn { get; set; }
    public DateTime? CompletedOn { get; set; }
}

public class InspectionTaskListResponseDto
{
    public List<InspectionTaskListItemDto> Items { get; set; } = new();
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

public class InspectionTaskByTargetRequestDto : InspectionTaskListRequestDto
{
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public int? TaskId { get; set; }
}

public class InspectionTaskByTargetResponseDto : InspectionTaskListResponseDto
{
    public List<InspectionTaskStatusStatDto> Statuses { get; set; } = new();
}

public class InspectionTaskInspectorDto
{
    public int Id { get; set; }
    public string InspectorId { get; set; } = string.Empty;
    public string? InspectorName { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime AssignedOn { get; set; }
}

public class InspectionTaskTimelineItemDto
{
    public int Id { get; set; }
    public string EventCode { get; set; } = string.Empty;
    public string? ResultCode { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? FromStatusId { get; set; }
    public int? ToStatusId { get; set; }
    public string? ActualActorName { get; set; }
    public string? PendingHandlerName { get; set; }
    public string? CurrentOwnerTypeCode { get; set; }
    public string? CurrentOwnerSummary { get; set; }
    public string? DisplayActorSource { get; set; }
    public DateTime CreatedOn { get; set; }
    public string? DisplayActor { get; set; }
    public DateTime? DisplayTime { get; set; }
    public string? DisplayDetails { get; set; }
    public string? DisplayLocation { get; set; }
    public string? DisplayStatusCode { get; set; }
    public bool IsCurrentStatusEvent { get; set; }
    public List<InspectionAttachmentDto> Attachments { get; set; } = new();
}

public class InspectionTaskLastInspectionDto
{
    public string TaskNumber { get; set; } = string.Empty;
    public string? Inspector { get; set; }
    public DateTime? CompletionTime { get; set; }
    public string? ViolationNo { get; set; }
    /// <summary>Check-in time of the last inspection's execution.</summary>
    public DateTime? CheckinAt { get; set; }
    /// <summary>Whether the last inspection found any violations.</summary>
    public bool? HasViolationFound { get; set; }
    /// <summary>CurrentStatus from [Application].[LicensePermitIndex] for the current task's establishment.</summary>
    public string? LicensePermitCurrentStatus { get; set; }
}

public class InspectionTaskReinspectionLookupDto
{
    public string TaskNumber { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public string? Inspector { get; set; }
    public string? Status { get; set; }
}

public class InspectionContactPersonDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Position { get; set; }
    public string Mobile { get; set; } = string.Empty;
    public string? MobileCountryCode { get; set; }
    public string? MobileLocalNumber { get; set; }
    public string? Email { get; set; }
    public string? EmiratesId { get; set; }
    public string? CollectedChannelCode { get; set; }
    public DateTime? SubmittedOn { get; set; }
    public string? EidAttachmentFileName { get; set; }
    public string? EidAttachmentFileUrl { get; set; }
    public bool DeclarationAcknowledged { get; set; }
    public bool? HasSignedDeclaration { get; set; }
    public string? DeclarationDeclinedReason { get; set; }
    public string? SignatureImageFileName { get; set; }
    public string? SignatureImageFileUrl { get; set; }
    public DateTime? SignatureSignedOn { get; set; }
    public string? DeclarationStatusCode { get; set; }
    public string? DeclarationStatusName { get; set; }
    public string? DeclarationDocumentFileName { get; set; }
    public string? DeclarationDocumentFileUrl { get; set; }
    public DateTime? DeclarationSubmittedOn { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskDetailDto
{
    public int Id { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public int TargetTypeId { get; set; }
    public string? TargetTypeCode { get; set; }
    public string? TargetTypeName { get; set; }
    public int SourceTypeId { get; set; }
    public string? SourceTypeCode { get; set; }
    public string? SourceTypeName { get; set; }
    public int InspectionMethodId { get; set; }
    public string? InspectionMethodCode { get; set; }
    public string? InspectionMethodName { get; set; }
    public int StatusId { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public int? ActivityId { get; set; }
    public string? ActivityName { get; set; }
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public int? ProfileId { get; set; }
    public int? UserProfileId { get; set; }
    public string? UserId { get; set; }
    public int? UserTypeId { get; set; }
    public string? UserTypeCode { get; set; }
    public int? EstablishmentTypeId { get; set; }
    public string? EstablishmentTypeName { get; set; }
    public string? EstablishmentName { get; set; }
    public string? TradeLicenseNumber { get; set; }
    public string? EstablishmentNameAr { get; set; }
    public string? LicenseNumber { get; set; }
    public string? TargetName { get; set; }
    public string? FullName { get; set; }
    public string? EmiratesId { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? MobileCountryCode { get; set; }
    public string? MobileLocalNumber { get; set; }
    public int CurrentStepId { get; set; }
    public string? AccessOutcomeCode { get; set; }
    public string? AccessOutcomeName { get; set; }
    public string? AccessFailedReasonCode { get; set; }
    public string? AccessFailedReasonName { get; set; }
    public string? AccessFailedRemark { get; set; }
    public List<InspectionAttachmentDto> AccessFailedAttachments { get; set; } = new();
    public int? InspectionReasonId { get; set; }
    public string? InspectionReasonName { get; set; }
    public int? PriorityId { get; set; }
    public string? PriorityName { get; set; }
    public int? EmirateId { get; set; }
    public string? EmirateName { get; set; }
    public int? AuthorityId { get; set; }
    public string? AuthorityName { get; set; }
    public int? RegionId { get; set; }
    public string? RegionName { get; set; }
    public int? CommunityId { get; set; }
    public string? CommunityName { get; set; }
    public string? AreaStreet { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? AssignedOn { get; set; }
    public string? Remarks { get; set; }
    public string? CancelReason { get; set; }
    public bool CountsTowardInspectionInterval { get; set; }
    public string AssignmentState { get; set; } = "Unassigned";
    public string? ScopeCode { get; set; }
    public string? ReinspectionNo { get; set; }
    public DateTime CreatedOn { get; set; }
    public string? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public List<InspectionTaskInspectorDto> Inspectors { get; set; } = new();
    public List<InspectionAttachmentDto> Attachments { get; set; } = new();
    public List<InspectionContactPersonDto> ContactPersons { get; set; } = new();
    public InspectionTaskRiskProfileDto? RiskProfile { get; set; }
}

public class CreateInspectionTaskRequestDto
{
    /// <summary>External source identifier (e.g. Inspection AI task id) used to de-duplicate automated task creation.</summary>
    public int? OuterId { get; set; }
    public int TargetTypeId { get; set; }
    public int SourceTypeId { get; set; }
    public int InspectionMethodId { get; set; }
    public int? ActivityId { get; set; }
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public int? EstablishmentTypeId { get; set; }
    public string? EstablishmentName { get; set; }
    public string? TradeLicenseNumber { get; set; }
    public string? FullName { get; set; }
    public string? EmiratesId { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? MobileCountryCode { get; set; }
    public string? MobileLocalNumber { get; set; }
    public int? InspectionReasonId { get; set; }
    public int? PriorityId { get; set; }
    public int? EmirateId { get; set; }
    public int? AuthorityId { get; set; }
    public int? RegionId { get; set; }
    public int? CommunityId { get; set; }
    public string? AreaStreet { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public List<AssignInspectionTaskItemDto>? Inspectors { get; set; }
    public DateTime DueDate { get; set; }
    public string? Remarks { get; set; }
    public List<InspectionRequestAttachmentDto>? Attachments { get; set; }
}

public class BatchCreateInspectionTaskByActivityRequestDto
{
    public int TargetTypeId { get; set; }
    public int SourceTypeId { get; set; }
    public int InspectionMethodId { get; set; }
    public List<int> ActivityIds { get; set; } = new();
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public int? EstablishmentTypeId { get; set; }
    public string? EstablishmentName { get; set; }
    public string? TradeLicenseNumber { get; set; }
    public string? FullName { get; set; }
    public string? EmiratesId { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? MobileCountryCode { get; set; }
    public string? MobileLocalNumber { get; set; }
    public int? InspectionReasonId { get; set; }
    public int? PriorityId { get; set; }
    public int? EmirateId { get; set; }
    public int? AuthorityId { get; set; }
    public int? RegionId { get; set; }
    public int? CommunityId { get; set; }
    public string? AreaStreet { get; set; }
    // No Latitude/Longitude here on purpose: one batch fans out to many establishments, each with its own
    // address, so a single request-level coordinate has no meaning. Each task's coordinates are taken from
    // that establishment's own resolved address instead.
    public List<AssignInspectionTaskItemDto>? Inspectors { get; set; }
    public DateTime DueDate { get; set; }
    public string? Remarks { get; set; }
    public List<InspectionRequestAttachmentDto>? Attachments { get; set; }
}

public class BatchCreateInspectionTaskResponseDto
{
    public List<int> ActivityIds { get; set; } = new();
    public int MatchedEstablishmentCount { get; set; }
    public int CreatedCount { get; set; }
    public List<int> MatchedEstablishmentIds { get; set; } = new();
    public List<BatchCreateInspectionTaskItemDto> Items { get; set; } = new();
}

public class BatchCreateInspectionTaskItemDto
{
    public int TaskId { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public int EstablishmentId { get; set; }
    public string? EstablishmentName { get; set; }
    public string? TradeLicenseNumber { get; set; }
    public int? EmirateId { get; set; }
    public int? AuthorityId { get; set; }
}

public class EditInspectionTaskRequestDto : CreateInspectionTaskRequestDto
{
}

public class CancelInspectionTaskRequestDto
{
    public string CancelReason { get; set; } = string.Empty;
}

public class DuplicateInspectionTaskRequestDto
{
    public DateTime? DueDate { get; set; }
    public bool CopyAssignments { get; set; } = true;
}

public class AssignInspectionTaskItemDto
{
    public string InspectorId { get; set; } = string.Empty;
    public string? InspectorName { get; set; }
    public bool IsPrimary { get; set; }
}

public class AssignInspectionTaskRequestDto
{
    public List<AssignInspectionTaskItemDto> Inspectors { get; set; } = new();
}

public class BatchAssignInspectionTaskRequestDto
{
    public List<int> TaskIds { get; set; } = new();
    public List<AssignInspectionTaskItemDto> Inspectors { get; set; } = new();
}

public class InspectionTaskStatusStatDto
{
    public int StatusId { get; set; }
    public string StatusCode { get; set; } = string.Empty;
    public string StatusName { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class InspectionTaskListStatsDto
{
    public int TodoCount { get; set; }
    public int CompletedCount { get; set; }
    public int QueuedCount { get; set; }
    public int PendingVisitCount { get; set; }
    public int InProgressCount { get; set; }
    public int AccessFailedCount { get; set; }
    public int CancelledCount { get; set; }
    public List<InspectionTaskStatusStatDto> Statuses { get; set; } = new();
    public int TeamCount { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskValidationWarningDto
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsMock { get; set; }
}

public class InspectionTaskValidationRecentTaskDto
{
    public int TaskId { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
}

public class InspectionTaskValidationResponseDto
{
    public List<InspectionTaskValidationWarningDto> Warnings { get; set; } = new();
    public List<InspectionTaskValidationWarningDto> BlockingErrors { get; set; } = new();
    public List<InspectionTaskValidationRecentTaskDto> RecentTasks { get; set; } = new();
}

public class InspectionTaskHistoryItemDto
{
    public int? TaskId { get; set; }
    public string? TaskNo { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public DateTime? InspectedOn { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionViolationHistoryItemDto
{
    public int? ViolationId { get; set; }
    public string? ViolationNo { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public decimal? FineAmount { get; set; }
    public DateTime? CreatedOn { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskSimpleHistoryItemDto
{
    public string Title { get; set; } = string.Empty;
    public string? ReferenceNo { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public DateTime? CreatedOn { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskDigitalAccountDto
{
    public string Platform { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? Status { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskRelatedProfileDto
{
    public int ProfileId { get; set; }
    public string? UserId { get; set; }
    public short UserTypeId { get; set; }
    public int PersonId { get; set; }
    public string? EntityName { get; set; }
    public string? MediaFileNumber { get; set; }
    public string? OfficialLetterUrl { get; set; }
}

public class InspectionTaskWebsiteDto
{
    public string Url { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public int? ProfileId { get; set; }
    public int? ApplicationId { get; set; }
    public int? ApplicationDetailId { get; set; }
    public int? MediaLicenseId { get; set; }
    public int? MediaLicenseEconomicActivityId { get; set; }
    public int? ExternalMediaAccountId { get; set; }
    public short? SocialMediaId { get; set; }
    public string? SocialMediaName { get; set; }
    public string? SocialMediaNameAr { get; set; }
}

public class InspectionTaskSocialMediaAccountDto
{
    public string SourceType { get; set; } = string.Empty;
    public int? ProfileId { get; set; }
    public int? ApplicationId { get; set; }
    public int? ApplicationDetailId { get; set; }
    public int? MediaLicenseId { get; set; }
    public int? MediaLicenseEconomicActivityId { get; set; }
    public int? ExternalMediaAccountId { get; set; }
    public short? SocialMediaId { get; set; }
    public string? SocialMediaName { get; set; }
    public string? SocialMediaNameAr { get; set; }
    public string? AccountName { get; set; }
    public string? WebsiteUrl { get; set; }
}

public class InspectionTaskDigitalPresenceDto
{
    public List<InspectionTaskWebsiteDto> Websites { get; set; } = new();
    public List<InspectionTaskSocialMediaAccountDto> SocialMedia { get; set; } = new();
}

public class InspectionTaskTargetOverviewLimitedDto
{
    public int ViolationCount { get; set; }
    public int UnpayCount { get; set; }
    public int? ProfileId { get; set; }
    public int? UserProfileId { get; set; }
    public string? UserId { get; set; }
    public int? UserTypeId { get; set; }
    public string? UserTypeCode { get; set; }
    public int? EstablishmentId { get; set; }
    public int? IndividualId { get; set; }
    public string? EstablishmentName { get; set; }
    public string? EstablishmentNameAr { get; set; }
    public string? LicenseNumber { get; set; }
}

public class InspectionTaskAccessFailedReportDto
{
    public string? AccessOutcomeCode { get; set; }
    public string? AccessOutcomeName { get; set; }
    public string? AccessFailedReasonCode { get; set; }
    public string? AccessFailedReasonName { get; set; }
    public string? AccessFailedRemark { get; set; }
    public string? FailureReason { get; set; }
    public List<InspectionAttachmentDto> Attachments { get; set; } = new();
    public List<InspectionAttachmentDto> AttachEvidence { get; set; } = new();
    public bool IsMock { get; set; }
}

public class InspectionTaskReportDto
{
    public int ReportStatusId { get; set; }
    public string ReportStatusCode { get; set; } = string.Empty;
    public string? ReportNo { get; set; }
    public DateTime? SubmittedOn { get; set; }
    public string? SubmittedByName { get; set; }
    public string? Summary { get; set; }
    public DateTime? CheckinAt { get; set; }
    public decimal? CheckinLat { get; set; }
    public decimal? CheckinLng { get; set; }
    public string? CheckinAddress { get; set; }
    public DateTime? CheckoutAt { get; set; }
    public decimal? CheckoutLat { get; set; }
    public decimal? CheckoutLng { get; set; }
    public string? CheckoutAddress { get; set; }
    public bool? HasViolationFound { get; set; }
    public string? OutcomeCode { get; set; }
    public string? OutcomeName { get; set; }
    public bool? NeedsReinspection { get; set; }
    public DateTime? ReinspectionDueDate { get; set; }
    public string? ReinspectionNote { get; set; }
    public List<InspectionTaskChecklistReviewItemDto> ChecklistItems { get; set; } = new();
    public List<InspectionTaskReportChecklistViolationDto> ChecklistViolations { get; set; } = new();
    /// <summary>Licensing violations (ViolationTypeId == 1) split out from ChecklistViolations.</summary>
    public List<InspectionTaskReportChecklistViolationDto> LicenseViolations { get; set; } = new();
    /// <summary>ViolationNo from InspectionViolations for the Licensing violation created from this task.</summary>
    public string? LicenseViolationNo { get; set; }
    /// <summary>Content violations (ViolationTypeId == 2) split out from ChecklistViolations.</summary>
    public List<InspectionTaskReportChecklistViolationDto> ContentViolations { get; set; } = new();
    /// <summary>ViolationNo from InspectionViolations for the Content violation created from this task.</summary>
    public string? ContentViolationNo { get; set; }
    public List<InspectionTaskSeizedMaterialReviewItemDto> SeizedMaterials { get; set; } = new();
    public InspectionContactPersonDto? ContactPerson { get; set; }
    public List<InspectionAttachmentDto> ChecklistEvidence { get; set; } = new();
    public InspectionTaskAccessFailedReportDto? AccessFailedReport { get; set; }
    public List<InspectionAttachmentDto> ReportAttachments { get; set; } = new();
    public string? PdfFileName { get; set; }
    public string? PdfFileUrl { get; set; }
    public List<InspectionAttachmentDto> DeclarationDocuments { get; set; } = new();
    public bool IsMock { get; set; }
}

public class InspectionTaskReportChecklistViolationDto
{
    public int Id { get; set; }
    public int TaskChecklistItemId { get; set; }
    public string ChecklistCode { get; set; } = string.Empty;
    public string? ChecklistName { get; set; }
    public string? ViolationDescription { get; set; }
    public DateTime RecordedAt { get; set; }
    public int ViolationItemId { get; set; }
    public string ViolationItemCode { get; set; } = string.Empty;
    public int ViolationTypeId { get; set; }
    /// <summary>
    /// ViolationNo from InspectionViolations where SourceTaskId matches the task
    /// and ViolationTypeId matches this checklist violation's type.
    /// </summary>
    public string? ViolationNo { get; set; }
    public decimal FineAmount { get; set; }
    public string? Notes { get; set; }
    public bool? Reported { get; set; }
    public bool? CommitteeReview { get; set; }
    public List<InspectionAttachmentDto> Attachments { get; set; } = new();
}

public class InspectionTaskViolationTicketDto
{
    public int ViolationId { get; set; }
    public string ViolationNo { get; set; } = string.Empty;
    public string? TypeCode { get; set; }
    public string? TypeName { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public decimal FineAmount { get; set; }
    public string? DeclarationStatusCode { get; set; }
    public string? DeclarationStatusName { get; set; }
    public string? DeclarationRecipientAddress { get; set; }
    public DateTime? DeclarationLinkSentOn { get; set; }
    public DateTime? DeclarationLinkExpiresOn { get; set; }
    public DateTime? DeclarationSubmittedOn { get; set; }
    public string? DeclarationPortalUrl { get; set; }
    public string? DeclarationToken { get; set; }
    public string? DeclarationDocumentFileName { get; set; }
    public string? DeclarationDocumentFileUrl { get; set; }
    public bool DeclarationIsMock { get; set; }
}

public class InspectionTaskReinspectionTaskDto
{
    public int TaskId { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public string? StatusCode { get; set; }
    public string? StatusName { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsMock { get; set; }
}

public class InspectionTaskExecutionResultDto
{
    public string OutcomeCode { get; set; } = string.Empty;
    public string OutcomeName { get; set; } = string.Empty;
    public int ViolationCount { get; set; }
    public bool? NeedsReinspection { get; set; }
    public DateTime? ReinspectionDueDate { get; set; }
    public string? ReinspectionNote { get; set; }
    public List<InspectionTaskViolationTicketDto> ViolationTickets { get; set; } = new();
    public List<InspectionTaskReinspectionTaskDto> ReinspectionTasks { get; set; } = new();
    public DateTime? CheckoutOn { get; set; }
    public bool CountsTowardInspectionInterval { get; set; }
    public bool IsMock { get; set; }
}



/// <summary>
/// Unified person info item returned by GET {taskId}/persons.
/// Includes full contact-person detail fields so no second request is needed.
/// Fields align with <see cref="SaveInspectionTaskContactPersonRequestDto"/>.
/// </summary>
public class InspectionTaskPersonInfoDto
{
    /// <summary>
    /// Primary key: Person.Id for SourceType=Person, InspectionTaskContactPerson.Id for SourceType=ContactPerson.
    /// </summary>
    public int PersonId { get; set; }

    /// <summary>Display name (Person.Name or ContactPerson.FullName).</summary>
    public string? Name { get; set; }

    /// <summary>Identifies whether this entry originates from the Person table or the contact-person table.</summary>
    public TaskPersonSourceType SourceType { get; set; }

    // ── Detail fields (aligned with SaveInspectionTaskContactPersonRequestDto) ──

    /// <summary>Position / title of the person. Mapped from Person.Occupation for Person source; ContactPerson.Position otherwise.</summary>
    public string? Position { get; set; }

    /// <summary>Mobile number. Mapped from Person.PersonalMobile for Person source; ContactPerson.Mobile otherwise.</summary>
    public string? Mobile { get; set; }

    /// <summary>Mobile country code (e.g. "+971"). Mapped from the source record's MobileCountryCode.</summary>
    public string? MobileCountryCode { get; set; }

    /// <summary>Mobile local number (without country code). Mapped from the source record's MobileLocalNumber.</summary>
    public string? MobileLocalNumber { get; set; }

    /// <summary>Email address.</summary>
    public string? Email { get; set; }

    /// <summary>Emirates ID number.</summary>
    public string? EmiratesId { get; set; }

    /// <summary>Channel code used to collect the contact details. Always null for Person source.</summary>
    public string? CollectedChannelCode { get; set; }

    /// <summary>EID attachment file name. Derived from Person.EmiratesIdCopyUrl for Person source.</summary>
    public string? EidAttachmentFileName { get; set; }

    /// <summary>EID attachment file URL. Mapped from Person.EmiratesIdCopyUrl for Person source.</summary>
    public string? EidAttachmentFileUrl { get; set; }
}

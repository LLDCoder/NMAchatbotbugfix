using System.Text.Json.Serialization;
using UMC.AdminPortal.Application.Dtos.ServiceInfo;
using UMC.AdminPortal.Application.Dtos.Workflow;
using UMC.AdminPortal.Domain.Service.UserService;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Infrastructure;
using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Application.Dtos.Application
{
    public record MyReviewPageRequest : PageRequest
    {
        public string? Keyword { get; set; }
        public string? ServiceTypeId { get; set; }
        public short? ServiceCategoryId { get; set; }
        /// <summary>Service filter for the review lists, matched against <see cref="MyReviewPageResponse.ServiceCode"/>.
        /// Matching by code rather than by ServiceId covers every version row of the same service —
        /// Lookup.Services keeps one row per service version under a single code. Accepts either a JSON
        /// array or a bare string so a single-select dropdown binds too.</summary>
        [JsonConverter(typeof(UMC.AdminPortal.Application.Utilities.StringOrStringListJsonConverter))]
        public List<string>? ServiceCodes { get; set; }
        public string? ProcessInstanceStatus { get; set; }
        /// <summary>Multi-select review filter. MyTodo matches TaskStatus (workflow node);
        /// MyCompleted matches MyDecision (review action). Accepts either a JSON array or a bare
        /// string so existing single-select callers bind too.</summary>
        [JsonConverter(typeof(UMC.AdminPortal.Application.Utilities.StringOrStringListJsonConverter))]
        public List<string>? ApprovalStatus { get; set; }
        /// <summary>Single-value compatibility filter. MyTodo matches TaskStatus; MyCompleted
        /// matches MyDecision. Kept separate from the list-based ApprovalStatus so existing
        /// callers are unaffected.</summary>
        public string? ApprovalStatusFilter { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }

    public record MyReviewResponse
    {
        public ReviewStatusCount StatusCount { get; set; }
        public string[] ProcessInstanceStatus { get; set; }
        public string[] ApprovalStatus { get; set; }
        public string[] MyDecisionOptions { get; set; } = Array.Empty<string>();
        /// <summary>Options for the service-name filter: the distinct services present in this tab's
        /// rows before any filter is applied, so selecting one does not collapse the dropdown.</summary>
        public MyReviewServiceOption[] ServiceOptions { get; set; } = Array.Empty<MyReviewServiceOption>();
        public PageResponse<MyReviewPageResponse> Page { get; set; }
    }

    public record MyReviewServiceOption
    {
        public string ServiceCode { get; set; } = null!;
        public string ServiceNameEn { get; set; } = null!;
        public string ServiceNameAr { get; set; } = null!;
    }

    public record MyReviewPageResponse
    {
        public int Id { get; set; }
        /// <summary>
        /// True when this application satisfies the FAHR approval rules. The Licensing My Todo
        /// page uses this flag to hide the legacy External Approval entry button because the
        /// ordinary first-node Approve action sends eligible applications to FAHR automatically.
        /// </summary>
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public bool? RequiresFahrApproval { get; set; }
        /// <summary>
        /// Indicates whether the current user can Recall this completed application at response time.
        /// The property is omitted from endpoints that do not calculate Recall eligibility.
        /// </summary>
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public bool? IsEligible { get; set; }
        public string ApplicationNumber { get; set; } = null!;
        public short ServiceId { get; set; }
        public string? ServiceCode { get; set; }
        public string ServiceNameEn { get; set; } = null!;
        public string ServiceNameAr { get; set; } = null!;
        public short ServiceCategoryId { get; set; }
        public string ServiceCategoryNameEn { get; set; } = null!;
        public string ServiceCategoryNameAr { get; set; } = null!;
        public string ServiceTypeId { get; set; } = null!;
        public string ServiceTypeNameEn { get; set; } = null!;
        public string ServiceTypeNameAr { get; set; } = null!;
        public double? SLA { get; set; }
        // Set during mapping from ICurrentUserService.IsArabicLanguage so the computed
        // SLA label can localize without DI access. Not serialized to the response.
        [System.Text.Json.Serialization.JsonIgnore]
        public bool IsArabic { get; set; }
        // Set by Content/MyTodoPage to use the requested "Due in X" label while preserving
        // the legacy SLA label for other MyReviewPage callers.
        [System.Text.Json.Serialization.JsonIgnore]
        public bool UseDueInSlaDescription { get; set; }
        public string SLADescription
        {
            get
            {
                return UseDueInSlaDescription
                    ? SLA.ToSLADueInString(IsArabic)
                    : SLA.ToSLAString(IsArabic);
            }
        }
        public int? AIStatus { get; set; }
        public string AIRiskLevel { get; set; } = "Unknown";
        public string? AIResult { get; set; }

        /// <summary>English phase label for AI content check (link B status machine).</summary>
        public string? AIAnalysisPhaseLabelEn { get; set; }

        /// <summary>When true, review UI should show loading instead of the report body.</summary>
        public bool AIAnalysisInProgress { get; set; }

        /// <summary>When true, AIResult is ready to render as the AI Content Check Report.</summary>
        public bool AIAnalysisShowReport { get; set; }

        public string Assignee { get; set; } = null!;
        public string AssignedTo { get; set; } = null!;
        public string ApplyForAr { get; set; } = null!;
        public string ApplyForEn { get; set; } = null!;
        public string Status { get; set; } = null!;
        // Numeric process-instance status (Lookup.TypeDictionary scope='ApprovalNodeOrder').
        // Added alongside the legacy Status label during the workflow status int migration.
        public int? StatusId { get; set; }
        public DateTime SubmissionTime { get; set; }
        // Most recent timeline timestamp: the latest ApprovalRecord.ApprovalDate for the
        // application (for disposition rows, the later of that and the disposition's own
        // update time). Falls back to the task/disposition timestamp when no record exists.
        public DateTime LastUpdatedTime { get; set; }
        public string UserTypeCode { get; set; } = null!;

        public int ApplicationDetailId { get; set; }
        public string ProcessInstanceId { get; set; } = null!;
        public string OldProcessInstanceId { get; set; } = null!;
        public string TaskId { get; set; } = null!;
        public string TaskStatus { get; set; } = null!;
        // Numeric task status (Lookup.TypeDictionary scope='ApprovalNodeOrder').
        public int? TaskStatusId { get; set; }
        // Completed-tab "My Decision" column. Carries the reviewer's decision action
        // (Approved / Rejected / Send Back),
        // resolved from ApprovalRecord.ApprovalResult and normalized to that whitelist;
        // anything else (node names, Completed, Cancelled, overdue, empty) collapses to "-".
        // Distinct from TaskStatus while rows are built and filtered: TaskStatus is the workflow
        // node, MyDecision is the review action. Before returning the personal completed page,
        // TaskStatus is projected to this value for compatibility with existing Licensing/Content
        // clients. Todo, team and detail responses keep their original TaskStatus semantics.
        public string? MyDecision { get; set; }
        // External Approval only: the outside-authority code (ApprovalRecord.ExternalOrganizationId,
        // e.g. organizationCode) stored when the node was parked at External Approval. Populated only
        // while the viewed node is still in External Approval status (11); otherwise null.
        public string? ExternalOrganizationId { get; set; }
        public DateTime TaskCreatedTime { get; set; }
        public DateTime? TaskDueTime { get; set; }
        public DateTime? TaskApprovalAt { get; set; }
        public int? TaskApprovalDepartment { get; set; }
        public string? TaskApprovalRole { get; set; }
        public string? ButtonJson { get; set; }
        public int? DispositionCaseId { get; set; }
        public DispositionCaseDetailDto? DispositionCase { get; set; }
        public double Duration
        {
            get
            {
                if (!TaskApprovalAt.HasValue)
                    return 0;
                return (TaskApprovalAt.Value - TaskCreatedTime).TotalMinutes;
            }
        }
        public bool IsOverdue
        {
            get
            {
                return (TaskApprovalAt ?? DateTimeHelper.Now) > TaskDueTime;
            }
        }
        public int Sort
        {
            get
            {
                return Extensions.HandleSort(StatusId);
            }
        }
        public string UserId { get; set; } = null!;
        public int? ProfileId { get; set; }
        public bool? ProfileIsVIP { get; set; }
        public int? EstablishmentId { get; set; }
        public bool? IsTest { get; set; }=false;
    }

    public record MyReviewDetailResponse
    {
        public MyReviewPageResponse Detail { get; set; }
        public string? FormData { get; set; }
        /// <summary>
        /// Raw AI provider JSON captured during the CustomerPortal post-submit content audit.
        /// Exposed only on detail endpoints to avoid pushing large payloads into list pages.
        /// </summary>
        public string? AIRawResponseJson { get; set; }
        public List<ContentAiEvidenceDto> AiEvidence { get; set; } = new();
        public List<ApplicationTimeLineResponse> ApplicationTimeline { get; set; } = new List<ApplicationTimeLineResponse>();
        public List<Book> BookList { get; set; } = new List<Book>();
        public DispositionCaseDetailDto? DispositionCase { get; set; }

        /// <summary>
        /// True when this application's review workflow ended in rejection at the approval node
        /// (the latest Workflow.CamundaProcessInstances.StatusId == ApprovalNodeOrder.Rejected).
        /// Lets the review UI render every BookList row as Rejected without the content library
        /// (Books.IsApproved) being touched. Reliable across reject paths and independent of the
        /// reclassified application status (e.g. a rejected 302 routed to disposition).
        /// </summary>
        public bool IsFirstApprovalRejected { get; set; }

        /// <summary>
        /// True when the current logged-in user is the current handler (assignee) of this task,
        /// i.e. the task's Assignee equals the logged-in user's id.
        /// </summary>
        public bool IsCurrentHandler { get; set; }

        /// <summary>
        /// Delivery information saved by the applicant, or <c>null</c> when none exists (including every
        /// service that does not offer physical delivery). Null rather than an empty object so the review
        /// page can hide the Delivery Information card outright. Values match the CustomerPortal
        /// <c>ApplicationDetail.deliveryInfo</c> payload for the same application.
        /// </summary>
        public DeliveryInfoDto? DeliveryInfo { get; set; }

        /// <summary>
        /// Service 8008 only: proof that the visiting individual watched and confirmed the
        /// advertising content guidelines training video. Null for every other service and for
        /// 8008 applications submitted before the gate existed, so the review page can hide the
        /// card outright rather than render an empty one.
        /// </summary>
        public TrainingConfirmationInfoDto? TrainingConfirmation { get; set; }
    }

    public sealed class ContentAiEvidenceDto
    {
        public string? MaterialName { get; set; }
        public string? MaterialPath { get; set; }
        public string? PageNumber { get; set; }
        public string? ParagraphNumber { get; set; }
        public string? Category { get; set; }
        public string? Severity { get; set; }
        public string? EvidenceText { get; set; }
        public string? Reason { get; set; }
        public List<string> MatchedWords { get; set; } = new();
        public List<string> Tags { get; set; } = new();
    }
    /// <summary>
    /// What a reviewer needs to see about the training confirmation. Deliberately excludes the link
    /// token: the confirmation belongs to the visiting individual, and no admin surface may perform
    /// it on their behalf.
    /// </summary>
    public record TrainingConfirmationInfoDto
    {
        /// <summary>Pending / Completed / Cancelled.</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>Visiting individual as captured on the application form.</summary>
        public string? RecipientName { get; set; }

        /// <summary>Mailbox the training video was sent to.</summary>
        public string? RecipientEmail { get; set; }

        /// <summary>When the invitation left the platform; null while it is still queued or failing.</summary>
        public DateTime? EmailSentOn { get; set; }

        /// <summary>First time the training link was opened, when known.</summary>
        public DateTime? LinkOpenedOn { get; set; }

        public DateTime? ConfirmedOn { get; set; }

        /// <summary>Recorded for audit; the individual is anonymous to the platform otherwise.</summary>
        public string? ConfirmationIp { get; set; }

        /// <summary>When the application moved from Submitted (110) to Under Review (102).</summary>
        public DateTime? StatusUpdatedOn { get; set; }
    }

    public record ApplicationTimeLineResponse
    {
        public int? ApprovalRecordId { get; set; }
        public string? Title { get; set; }
        public string UserId { get; set; } = null!;
        public string? UserName { get; set; }
        public string? ApprovalResult { get; set; }
        public DateTime ApprovalTime { get; set; }
        public double? Duration { get; set; }
        public string? ReasonEn { get; set; }
        public string? ReasonAr { get; set; }
        public string? ApprovalComment { get; set; }
        public string? ReasonFile { get; set; }
        public bool IsSelf { get; set; }
        public string? ObligationLetterUrl { get; set; }
        // Spec §8.2: handler role label for the row — "Customer" for submission/disposition
        // submission nodes, the application's department name (e.g. "Content Department")
        // for any admin-driven node.
        public string? UserRole { get; set; }
        // External Approval node only: the outside authority's localized name (resolved from
        // ApprovalRecord.ExternalOrganizationId via TypeDictionary scope 'ExternalApprovalOrganization').
        public string? ExternalOrganization { get; set; }
        // Spec §8.5 / §8.6.1 / §8.7 / §8.8: fixed prompt rendered above the row when present.
        public string? Prompt { get; set; }
        // Spec §8.6: customer-side note on a Disposition Verification submission (kept
        // separate from ApprovalComment so §8.6.3 can show the reviewer's reject reason
        // and the original customer note side-by-side).
        public string? CustomerComment { get; set; }
        // Disposition Submitted node only: the disposal method the applicant selected
        // (DispositionSubmissions.Method), e.g. "DestructionIncineration".
        public string? DisposalMethod { get; set; }
        // Spec §8.4.4 / §8.6: attachment URLs uploaded with this node — supervisor report
        // attachments for admin nodes, supporting documents for customer disposition
        // submissions. For approve/reject-with-supervisor-report nodes the generated
        // report PDF (SupervisorReports.GeneratedReportUrl) is folded into this list so
        // the frontend needs no extra field; it shows up once the PDF generator stub
        // (ISupervisorReportPdfService) is implemented.
        // Frontend renders single vs. multi-attachment differently.
        public List<TimelineAttachmentDto>? Attachments { get; set; }
        // TODO(per-item review): "8 items approved · 2 items rejected" badges on review
        // nodes. The per-book auto-review (printing-permit) results for service 302 are
        // owned by a separate feature and not synced yet — both stay null until that data
        // source lands; frontend hides the badge while null.
        public int? ItemsApproved { get; set; }
        public int? ItemsRejected { get; set; }

        // i18n keys — frontend maps these IDs to configurable multilingual copy; the
        // localized string fields above stay as fallbacks.
        // Node kind: 'Review' for approval-action nodes (Title = designer node name),
        // otherwise the event NodeType ('Submitted'/'PendingPayment'/'Paid'/
        // 'PendingDisposition'/'DispositionSubmitted'/'Completed'/'Rejected').
        public string? NodeType { get; set; }
        // Fixed-sentence prompt key: 'AutoAssigned' / 'PendingDisposition' /
        // 'DispositionSubmitted' / 'Completed' / 'Rejected'. Null = no prompt.
        public string? PromptCode { get; set; }
        // Registry action code behind ApprovalResult (1/101/200/400/201/202...).
        public int? ApprovalResultCode { get; set; }
        // Reject reason code (Lookup.TypeDictionary scope 'RejectionReason'). Raw code only —
        // the frontend resolves it to localized text itself. Set on the Disposition Verification
        // node when the admin rejects the proof.
        public string? RejectReasonCode { get; set; }
    }

    // Timeline attachment: the opaque storage Key plus the human-facing file name resolved
    // from Common.StoredFiles.DownloadFileName (empty when the key has no ledger row or the
    // file-storage service is unreachable — the frontend still has the Key to download the file).
    public record TimelineAttachmentDto
    {
        public string? FileName { get; set; }
        public string Key { get; set; } = null!;
    }

    public record MyTeamReviewPageRequest : PageRequest
    {
        public string? Keyword { get; set; }
        public string? UserId { get; set; }
        public string? ProcessInstanceStatus { get; set; }
        public string? ApprovalStatus { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }

    public record MyTeamReviewResponse
    {
        public ReviewStatusCount StatusCount { get; set; }
        public string[] ProcessInstanceStatus { get; set; }
        public string[] ApprovalStatus { get; set; }
        public PageResponse<MyTeamReviewPageResponse> Page { get; set; }
    }

    public record ReviewStatusCount
    {
        public int TodoCount { get; set; }
        public int PendingReviewCount { get; set; }
        public int PendingModificationCount { get; set; }
        public int ExternalApproveCount { get; set; }
        // Post-approval disposition (service 302) live-stage counts within the todo queue.
        // A live disposition row carries StatusId = ApplicationStatus.PendingDisposition (108)
        // before the applicant uploads proof, and ApplicationStatus.DispositionVerification (109)
        // once a submission exists and awaits admin verification.
        public int PendingDispositionCount { get; set; }
        public int DispositionVerificationCount { get; set; }
        public int CompletedCount { get; set; }
        public int OverdueCount { get; set; }
    }

    public record MyTeamReviewPageResponse : MyReviewPageResponse
    {
        public bool IsUrgent { get; set; }
    }

    public record MyTeamMemberTaskRequest
    {
        public string? Keyword { get; set; }
        public string? MemberId { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }

    public record MyTeamMemberTaskResponse
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public int TotalTaskCount { get; set; }
        public int CompletedTaskCount { get; set; }
        public int MaxWorkTaskCount { get; set; }
        public string Workload
        {
            get
            {
                return $"{(TotalTaskCount * 100) / MaxWorkTaskCount:0.0}%";
            }
        }
        public double AvgDuration { get; set; }
        public string AvgDurationDescription
        {
            get
            {
                var ts = TimeSpan.FromMinutes(AvgDuration);
                if (ts.Days > 0 || ts.Hours > 0)
                    return $"{ts.Days * 24 + ts.Hours}h {ts.Minutes}m";
                return $"{ts.Minutes}min";
            }
        }

        public decimal SLA { get; set; }
        public int OverdueCount { get; set; }
        public bool IsLeave { get; set; }
        public string? LeaveTypeNameAr { get; set; }
        public string? LeaveTypeNameEn { get; set; }
        public string? BriefDescription { get; set; }
        public DateTime? ExpectedReturnDate { get; set; }
        public DateTime? LeaveCreatedOn { get; set; }
    }

    public record MyTeamMembersResponse
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public bool IsSelfMonitor { get; set; }
    }

    public record MyTeamMemberLeaveRequest
    {
        public string UserId { get; set; }
        public string LeaveType { get; set; }
        public string? BriefDescription { get; set; }
        public DateTime ExpectedReturnDate { get; set; }
    }

    public record UserDepartLogsDto(string? UserId, string? UserName, int? DepartmentId, bool? IsMaster, bool? IsLeader, bool? IsLeave, string? LeaveTypeCode, string? BriefDescription, DateTime? ExpectedReturnDate, DateTime? CreatedOn);
    public record GetPageByProfilePageRequest : PageRequest
    {
        public string? UserId { get; set; }
        public int? ProfileId { get; set; }
        public string? Keyword { get; set; }
        public string? ServiceType { get; set; }
        public string? ProcessInstanceStatus { get; set; }
        public string? ProcessInstanceStatusCode { get; set; }
        public string? ApplicationStatusCode { get; set; }
        public DateTime? SubmissionStartTime { get; set; }
        public DateTime? SubmissionEndTime { get; set; }
    }

    public record GetPageByProfileReportResponse
    {
        public int TotalCount { get; set; }
        public int LicenseCount { get; set; }
        public int ContentCount { get; set; }
        public int CompletedCount { get; set; }
        public int RejectedCount { get; set; }

        public int CancelledCount { get; set; }
    }

    public record GetPageByProfileSlaInfo
    {
        public double? RemainingMinutes { get; set; }
        public string DisplayText { get; set; } = "-";
        public bool IsOverdue { get; set; }
        public DateTime? DueOn { get; set; }
    }

    public record GetPageByProfilePageResponse
    {
        public int ApplicationId { get; set; }
        public string ApplicationNumber { get; set; }
        public string ServiceName { get; set; }
        public string ServiceCategoryName { get; set; }
        public string Type { get; set; }
        public string TypeName { get; set; }
        public string Status { get; set; }
        // Numeric process-instance status (Lookup.TypeDictionary scope='ApprovalNodeOrder').
        public int? StatusId { get; set; }
        public DateTime SubmissionTime { get; set; }
        public DateTime? LastUpdatedTime { get; set; }
        public double? SLA { get; set; }
        // Set during mapping from ICurrentUserService.IsArabicLanguage so the computed
        // SLA label can localize without DI access. Not serialized to the response.
        [System.Text.Json.Serialization.JsonIgnore]
        public bool IsArabic { get; set; }
        public string SLADescription
        {
            get
            {
                return SLA.ToSLAString(IsArabic);
            }
        }
        public string ServiceDepartment { get; set; }
        public int ServiceDepartmentId { get; set; }
        public string ApplyFor { get; set; }
        public string UserTypeCode { get; set; }
        public string? TaskId { get; set; }
        public string SourceType { get; set; } = "application";
        public string? SourceId { get; set; }
        public string? TaskNo { get; set; }
        public string TaskCategory { get; set; } = "applications";
        public string TaskCategoryCode { get; set; } = "applications";
        public string TaskCategoryDisplay { get; set; } = string.Empty;
        public string? AssignedToUserId { get; set; }
        public string? AssignedTo { get; set; }
        public string? StatusCode { get; set; }
        public string? ApplicationStatusCode { get; set; }
        public string? StatusDisplay { get; set; }
        public DateTime? LastUpdatedOn { get; set; }
        public bool IsUrgent { get; set; }
        public bool CanReassign { get; set; }
        public string? DetailTarget { get; set; }
        public GetPageByProfileSlaInfo SlaInfo { get; set; } = new();
    }

    public record GetApplicationPageByProfileResponse
    {
        public GetPageByProfileReportResponse Report { get; set; }
        public PageResponse<GetPageByProfilePageResponse> Page { get; set; }
        public string[] ProcessInstanceStatus { get; set; }
    }

    public record ApplicationApplicantDetailDto
    {
        public ApplicationApplicantApplicationDto? Application { get; set; }
        public ApplicationApplicantUserProfileDto? UserProfile { get; set; }
        public ApplicationApplicantUserDto? User { get; set; }
        public ApplicationApplicantUserTypeDto? UserType { get; set; }
        public ApplicationApplicantPersonDto? Person { get; set; }
        public ApplicationApplicantAddressDto? Address { get; set; }
    }

    public record ApplicationApplicantApplicationDto
    {
        public int Id { get; set; }
        public string ApplicationNumber { get; set; } = string.Empty;
        public short ServiceId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int ProfileId { get; set; }
        public int? EstablishmentId { get; set; }
        public short? OfficeId { get; set; }
        public DateTime CreatedOn { get; set; }
        public bool? IsTest { get; set; }
    }

    public record ApplicationApplicantUserProfileDto
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public short UserTypeId { get; set; }
        public int PersonId { get; set; }
        public int AddressId { get; set; }
        public string MediaFileNumber { get; set; } = string.Empty;
        public string? ProfileCode { get; set; }
        public string? Status { get; set; }
        public bool? IsVip { get; set; }
        public bool? IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime? UpdateOn { get; set; }
    }

    public record ApplicationApplicantUserDto
    {
        public string Id { get; set; } = string.Empty;
        public string? UserName { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? PhoneCountryCode { get; set; }
        public string? PhoneLocalNumber { get; set; }
        public bool IsActive { get; set; }
        public string? Status { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime? LastLoginDate { get; set; }
    }

    public record ApplicationApplicantUserTypeDto
    {
        public short Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    public record ApplicationApplicantPersonDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int NationalityId { get; set; }
        public string? EmiratesId { get; set; }
        public string? PassportNumber { get; set; }
        public string? UID { get; set; }
        public string? PersonalEmail { get; set; }
        public string? PersonalMobile { get; set; }
        public string? MobileCountryCode { get; set; }
        public string? MobileLocalNumber { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? PhotoUrl { get; set; }
        public bool IsSmartpass { get; set; }
    }

    public record ApplicationApplicantAddressDto
    {
        public int Id { get; set; }
        public int? CountryId { get; set; }
        public string? CountryName { get; set; }
        public short? EmirateId { get; set; }
        public string? EmirateName { get; set; }
        public short? RegionId { get; set; }
        public string? RegionName { get; set; }
        public int? CommunityId { get; set; }
        public string? CommunityName { get; set; }
        public string? Street { get; set; }
        public string? PhoneNumber { get; set; }
        public string? PhoneCountryCode { get; set; }
        public string? PhoneLocalNumber { get; set; }
        public double? Longitude { get; set; }
        public double? Latitude { get; set; }
        public string? LocationUrl { get; set; }
        public bool IsCountryAddress { get; set; }
    }
    public record ServiceCategoryStatsDto
    {
        public string CategoryName { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percentage { get; set; }
    }

    public record ApplicationTypeStatsDto
    {
        public string TypeName { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percentage { get; set; }
    }

    public record RevenueTrendDto
    {
        public string Date { get; set; } = string.Empty;
        public decimal ServiceApplicationFees { get; set; }
        public decimal Revenue { get; set; }
        public string Unit { get; set; } = string.Empty;
    }

    public record RevenueByItemDto
    {
        public int Id { get; set; }
        public string NameEn { get; set; } = string.Empty;
        public string NameAr { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public record RevenueAnalyticsDto
    {
        public List<RevenueByItemDto> ByActivity { get; set; } = new();
        public List<RevenueByItemDto> ByService { get; set; } = new();
        public List<RevenueByItemDto> ByApplicationType { get; set; } = new();
    }

    public record ServiceDashboardListDto
    {
        public string ServiceName { get; set; } = string.Empty;
        public string? ServiceCategory { get; set; }
        public int Applications { get; set; }
        public double ApplicationsChange { get; set; }
        public decimal TotalRevenue { get; set; }
        public double TotalRevenueChange { get; set; }
        public double ApprovalRate { get; set; }
        public double ApprovalRateChange { get; set; }
        public string AvgProcessingTime { get; set; } = string.Empty;
        public double AvgProcessingTimeChange { get; set; }
        public double AvgSatisfaction { get; set; }
        public double AvgSatisfactionChange { get; set; }
        public int RefundApplications { get; set; }
        public double RefundApplicationsChange { get; set; }
        public decimal TotalRefunds { get; set; }
        public double TotalRefundsChange { get; set; }
        public double RefundRate { get; set; }
        public double RefundRateChange { get; set; }
    }

    public record ContentServiceDashboardListDto : ServiceDashboardListDto
    {
        public int AIApproved { get; set; }
        public int AIRejected { get; set; }

        // Numeric backing value (minutes) for AvgProcessingTime. AvgProcessingTime itself is a
        // display string ("2d 3h"), so lexical sorting on it is meaningless; orderby=AvgProcessingTime
        // sorts on this field instead. 0 means "no completed processing in the window" (rendered "-").
        public double AvgProcessingTimeMinutes { get; set; }

        // Comparison ("*Change") metrics were dropped for api/Content/dashboard/service/list
        // (requirement change: no period-over-period comparison). The fields still exist on the
        // shared base ServiceDashboardListDto for other dashboards (e.g. Licensing), so hide them
        // from this endpoint's JSON instead of removing the base members.
        [JsonIgnore] public new double ApplicationsChange { get; set; }
        [JsonIgnore] public new double TotalRevenueChange { get; set; }
        [JsonIgnore] public new double ApprovalRateChange { get; set; }
        [JsonIgnore] public new double AvgProcessingTimeChange { get; set; }
        [JsonIgnore] public new double AvgSatisfactionChange { get; set; }
        [JsonIgnore] public new double RefundApplicationsChange { get; set; }
        [JsonIgnore] public new double TotalRefundsChange { get; set; }
        [JsonIgnore] public new double RefundRateChange { get; set; }
    }

    // api/Application/dashboard/service/list — comparison ("*Change") metrics dropped
    // (requirement change: no period-over-period comparison). The base ServiceDashboardListDto
    // is still returned as-is by the Licensing (api/ServiceInfo/dashboard/service/list) endpoint,
    // so the change fields are hidden here per-endpoint instead of removed from the base.
    public record ApplicationServiceDashboardListDto : ServiceDashboardListDto
    {
        [JsonIgnore] public new double ApplicationsChange { get; set; }
        [JsonIgnore] public new double TotalRevenueChange { get; set; }
        [JsonIgnore] public new double ApprovalRateChange { get; set; }
        [JsonIgnore] public new double AvgProcessingTimeChange { get; set; }
        [JsonIgnore] public new double AvgSatisfactionChange { get; set; }
        [JsonIgnore] public new double RefundApplicationsChange { get; set; }
        [JsonIgnore] public new double TotalRefundsChange { get; set; }
        [JsonIgnore] public new double RefundRateChange { get; set; }
    }

    public record TeamMemberDashboardListDto
    {
        public string TeamMember { get; set; } = string.Empty;
        public int ApplicationTasks { get; set; }
        public int ApprovedApplications { get; set; }
        public int RejectedApplications { get; set; }
        public double ApprovalRate { get; set; }
        public string AvgProcessingTime { get; set; } = string.Empty;

        // Numeric backing value (minutes) for AvgProcessingTime. AvgProcessingTime itself is a
        // display string ("2d 3h"), so lexical sorting on it is meaningless; orderby=AvgProcessingTime
        // sorts on this field instead. 0 means "no completed tasks in the window" (rendered "-").
        public double AvgProcessingTimeMinutes { get; set; }
        public double SLA { get; set; }
        public int SLACount { get; set; }
        
        public int SLAPreCount { get; set; }
        public int SlaBreaches { get; set; }
        public int SlaBreachesCount { get; set; }
        public int SlaPreBreachesCount { get; set; }
    }

    public record TeamDashboardResponse
    {
        public double AvgSLACompliance { get; set; }
        public string AvgProcessingTime { get; set; } = string.Empty;
        public double AvgApprovalRate { get; set; }
        public PageResponse<TeamMemberDashboardListDto> Page { get; set; } = null!;
    }

    public record ApplicationDashboardStatisticsResponse
    {
        public int TotalPublishServices { get; set; }
        public int TotalApplications { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal TotalRefunds { get; set; }
        public int RefundApplications { get; set; }
        
        public double ApprovalRate { get; set; }
        
        public string AvgProcessingTime { get; set; } = string.Empty;
        public double AvgSatisfaction { get; set; }
        public int SatisfactionCount { get; set; }
        public int TotalSatisfaction { get; set; }
        
       // [JsonIgnore] 
        public ProfileStatusStatsDto StatusStats { get; set; } = new();
        public List<ProfileEmirateStatsDto> EmirateStats { get; set; } = new();
        public List<ProfileTrendStatsDto> TrendStats { get; set; } = new();
        public List<ProfileDeviceStatsDto> DeviceStats { get; set; } = new();
        public List<ServiceCategoryStatsDto> CategoryStats { get; set; } = new();
        public List<ApplicationTypeStatsDto> TypeStats { get; set; } = new();
        public List<RevenueTrendDto> RevenueTrendList { get; set; } = new();
        public List<Dtos.Application.ApplicationStatusDistributionDto> ApplicationStatusDistribution { get; set; } = new();
        public List<EconomicActivityDistributionDto> TopEconomicActivities { get; set; } = new();
        public ServiceCsatAnalysisDto CsatAnalysis { get; set; } = new();
        public RevenueAnalyticsDto RevenueAnalytics { get; set; } = new();
        public ServiceSlaPerformanceDto SlaPerformance { get; set; } = new();
    }

    public record ContentDashboardStatisticsResponse : ApplicationDashboardStatisticsResponse
    {
        // These metrics are deprecated for the Content dashboard and intentionally suppressed
        // from the response to save query resources. Shadowing the shared base properties with
        // [JsonIgnore] is the supported System.Text.Json way to drop inherited members for one
        // derived type without affecting the Application dashboard that still returns them.
        [System.Text.Json.Serialization.JsonIgnore]
        public new int TotalPublishServices { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public new decimal TotalRefunds { get; set; }

        public int PermitsIssued { get; set; }
        public AIRecommendationOverviewDto AIRecommendation { get; set; } = new();
        public List<AITagBreakdownDto> AITags { get; set; } = new();
        public List<MediaMaterialTypeDistributionDto> MediaMaterialTypeDistribution { get; set; } = new();
        public ServiceConfirmationMethodStatsDto ConfirmationMethodStats { get; set; } = new();
    }

    public record MediaMaterialTypeDistributionDto
    {
        public string TypeName { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percentage { get; set; }
    }

    public record EconomicActivityDistributionDto
    {
        public int EconomicActivityId { get; set; }
        public string NameEn { get; set; } = string.Empty;
        public string NameAr { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public record ApplicationStatusDistributionDto
    {
        public string StatusName { get; set; } = string.Empty;
        public int Count { get; set; }
        public double Percentage { get; set; }
        // ApprovalNodeOrder value corresponding to this status bucket (matches TaskStatusId in MyTeamTodoPage items).
        // Null for composite buckets that span multiple ApprovalNodeOrder values (e.g. "Under Review").
        public int? TaskStatusId { get; set; }
    }

    public record AIRecommendationOverviewDto
    {
        public int AIRecommendedApproval { get; set; }
        public int AIRecommendedRejection { get; set; }
        public double AIRecommendationAdoptionRate { get; set; }
    }

    public record AITagBreakdownDto
    {
        public string Tag { get; set; } = string.Empty;
        public double Percentage { get; set; }
    }
    public class PayResponse
    {
        public bool Success { get; set; }
        public string ApplicationNumber { get; set; }
    }
}

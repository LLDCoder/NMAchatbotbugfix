using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UMC.AdminPortal.Application.Dtos.Licensing;
using UMC.AdminPortal.Application.Dtos.UserDto;
using UMC.AdminPortal.Application.Services.CamundaTaskApp;
using UMC.AdminPortal.Application.Services.EnquiryApp;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.SendTemplate;
using UMC.AdminPortal.Application.Services.TeamManagement;
using UMC.AdminPortal.Application.Services.UserApp;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Models.Workflow;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Infrastructure;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.Page;
using UMC.Utils.Framework.RestSharpClient;

namespace UMC.AdminPortal.Application.Services.LicensingTeamManagement;

public interface ILicensingTeamManagementAppService
{
    Task<LicensingTeamManagementSummaryDto> GetSummaryAsync(bool applicationTaskOnly);
    Task<LicensingTeamManagementSummaryDto> GetSummaryV2Async(bool applicationTaskOnly);
    Task<LicensingTeamManagementMetadataDto> GetMetadataAsync(bool applicationTaskOnly);
    Task<List<LicensingTeamManagementStatusOptionDto>> GetStatusesAsync(bool applicationTaskOnly);
    Task<LicensingTeamManagementTaskQueryResponse> QueryTasksAsync(LicensingTeamManagementTaskQueryRequest request);
    Task<LicensingTeamManagementTaskQueryResponse> QueryTasksV2Async(LicensingTeamManagementTaskQueryRequest request);
    Task<byte[]> ExportTasksAsync(LicensingTeamManagementTaskQueryRequest request);
    Task<byte[]> ExportTasksV2Async(LicensingTeamManagementTaskQueryRequest request);
    Task<LicensingTeamManagementReassignResponse> ReassignTasksAsync(LicensingTeamManagementReassignRequest request);
    Task<LicensingTeamManagementReassignResponse> ReassignTasksV2Async(LicensingTeamManagementReassignRequest request);
    Task<LicensingTeamManagementMembersResponse> GetMembersAsync(string? memberId, DateTime? startDate, DateTime? endDate, bool applicationTaskOnly);
    Task<LicensingTeamManagementMembersResponse> GetMembersOptimizedAsync(string? memberId, DateTime? startDate, DateTime? endDate, bool applicationTaskOnly, CancellationToken cancellationToken = default);
    Task<List<LicensingTeamManagementMemberPerformanceDto>> BuildMembersNeedingCoachingAsync(DateTime startDate, DateTime endDate, int take = 5, CancellationToken cancellationToken = default);
    /// <summary>
    /// Lightweight aggregation: loads only members + application-metric tasks (skips todo counts,
    /// leave/duty status) and returns the "All" category metric across the requested members.
    /// Used by the performance dashboard to avoid the overhead of full member-card construction.
    /// </summary>
    Task<LicensingTeamManagementMemberMetricDto> GetAggregatedPerformanceMetricsAsync(
        string? memberId, DateTime? startDate, DateTime? endDate,
        CancellationToken cancellationToken = default);
    Task<List<LicensingTeamManagementUserReassignDto>> GetUserReassignAsync(string? sourceType = null);
    Task<List<LicensingTeamManagementUserReassignDto>> GetUserReassignAsync(LicensingTeamManagementReassignmentMembersRequest request);
    Task<LicensingTeamManagementDutyStatusActionResponse> MarkEmergencyLeaveAsync(string userId, LicensingTeamManagementEmergencyLeaveRequest request);
    Task<LicensingTeamManagementDutyStatusActionResponse> ResumeWorkAsync(string userId);
    Task<LicensingUrgentTaskAlertRunResponse> RunUrgentTaskAlertsAsync();
}

[InjectOnScoped]
public class LicensingTeamManagementAppService(
    AdminPortalDBContext dbContext,
    ICurrentUserService currentUserService,
    ICamundaTaskAppService camundaTaskAppService,
    IEnquiryAppService enquiryAppService,
    ITypeDictionaryService typeDictionaryService,
    RestSharpClient restSharpClient,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ISendTemplateService sendTemplateService,
    IProfileReviewAssignmentService profileReviewAssignmentService,
    ILicensingTeamTaskReadSyncProcessor readSyncProcessor,
    ILogger<LicensingTeamManagementAppService> logger,
    ILicensingOffDutyNotificationService? offDutyNotificationService = null,
    IPermissionService? permissionService = null,
    ITaskReassignmentNotificationService? reassignmentNotificationService = null) : ILicensingTeamManagementAppService
{
    // The configuration key name is retained for deployment compatibility; it now
    // controls all four Req 189 Todo/Completed read views.
    private const string Req189TeamReadViewsFeature = "Features:Req189TeamCompletedViews";
    // OPS-04 (Licensing): explicit read-source override and the sync interlock switch.
    private const string Req189LicensingReadSourceFeature = "Features:Req189LicensingReadSource";
    private const string Req189TeamReadSyncEnabledFeature = "Features:Req189TeamReadSyncEnabled";
    private const string ReadSourceTable = "table";
    private const string ReadSourceViews = "views";
    private const string ReadSourceLegacy = "legacy";
    private const int LicensingDepartmentId = (int)DepartmentEnum.Licensing;
    private const string SuperAdminRoleId = "SUPER_ADMINISTRATOR";
    private const string SuperAdminUserId = "SuperAdminUser";
    private const string AlertTemplateNumber = "AP-009";
    private const string WorkflowStatusDomain = "applicationWorkflow";
    private static readonly HashSet<int> WorkflowNonReassignableStatuses = [(int)ApprovalNodeOrder.ExternalApproval, (int)ApprovalNodeOrder.PendingModification];
    internal static readonly HashSet<short> EnquiryCompletedStatuses = [(short)EnquiryEnum.EnquiryAdminStatus.Resolved, (short)EnquiryEnum.EnquiryAdminStatus.Completed, (short)EnquiryEnum.EnquiryAdminStatus.Cancelled];
    internal static readonly HashSet<short> RefundCompletedStatuses = [(short)TicketRefundsStatusEnum.Rejected, (short)TicketRefundsStatusEnum.Refunded, (short)TicketRefundsStatusEnum.Cancelled];
    private static readonly HashSet<int> AppealCompletedStatuses = [(int)InspectionAppealStatus.Approved, (int)InspectionAppealStatus.Rejected, (int)InspectionAppealStatus.Cancelled, (int)InspectionAppealStatus.Resolved];

    internal static bool ShouldHideApplicationSla(
        string? sourceType,
        string? rawStatusCode,
        bool isPendingModificationProcess)
    {
        if (!string.Equals(sourceType, LicensingTeamManagementConstants.SourceApplication, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return isPendingModificationProcess
               || string.Equals(rawStatusCode, ((int)ApprovalNodeOrder.ExternalApproval).ToString(), StringComparison.OrdinalIgnoreCase);
    }

    private async Task<HashSet<string>> LoadPendingModificationTaskIdsAsync()
        => (await (
                from task in dbContext.CamundaTasks.AsNoTracking()
                join process in dbContext.CamundaProcessInstances.AsNoTracking()
                    on task.ProcessInstanceId equals process.ProcessInstanceId
                where task.ApprovalDepartment == LicensingDepartmentId
                      && process.StatusId == (int)ApprovalNodeOrder.PendingModification
                select task.TaskId)
            .Distinct()
            .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Fail-closed reassign gate for application (Camunda) tasks. The team task list shows the
    /// process-instance status, while the task row can still sit on an earlier approval node, so
    /// a task-first check alone leaves Reassign enabled for a Pending Modification / External
    /// Approval application. Reject the task when either status source is parked.
    /// </summary>
    private static bool CanReassignWorkflowTask(DateTime? approvalAt, int? taskStatusId, int? processStatusId)
    {
        if (approvalAt.HasValue || !(taskStatusId ?? processStatusId).HasValue)
        {
            return false;
        }

        return !(taskStatusId.HasValue && WorkflowNonReassignableStatuses.Contains(taskStatusId.Value))
               && !(processStatusId.HasValue && WorkflowNonReassignableStatuses.Contains(processStatusId.Value));
    }

    // Metadata-only sets: define which statuses appear in the completed/todo filter dropdowns.
    // Kept separate from the task-categorisation sets above so that task loading logic is unaffected.
    private static readonly HashSet<short> EnquiryMetadataCompletedStatuses = [
        (short)EnquiryEnum.EnquiryAdminStatus.Open,
        (short)EnquiryEnum.EnquiryAdminStatus.PendingCustomer,
        (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing,
        (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed,
        (short)EnquiryEnum.EnquiryAdminStatus.Resolved,
        (short)EnquiryEnum.EnquiryAdminStatus.Completed,
        (short)EnquiryEnum.EnquiryAdminStatus.Cancelled
    ];
    private static readonly HashSet<short> EnquiryMetadataTodoExcludedStatuses = [
        (short)EnquiryEnum.EnquiryAdminStatus.Open,
        (short)EnquiryEnum.EnquiryAdminStatus.PendingCustomer,
        (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed,
        (short)EnquiryEnum.EnquiryAdminStatus.Resolved,
        (short)EnquiryEnum.EnquiryAdminStatus.Completed,
        (short)EnquiryEnum.EnquiryAdminStatus.Cancelled
    ];
    private static readonly HashSet<short> RefundMetadataCompletedStatuses = [
        (short)TicketRefundsStatusEnum.DepartmentProcessing,
        (short)TicketRefundsStatusEnum.DepartmentProcessed,
        (short)TicketRefundsStatusEnum.PendingCustomer,
        (short)TicketRefundsStatusEnum.PendingRefund,
        (short)TicketRefundsStatusEnum.Rejected,
        (short)TicketRefundsStatusEnum.Refunded,
        (short)TicketRefundsStatusEnum.Cancelled
    ];
    private static readonly HashSet<short> RefundMetadataTodoExcludedStatuses = [
        (short)TicketRefundsStatusEnum.DepartmentProcessed,
        (short)TicketRefundsStatusEnum.PendingCustomer,
        (short)TicketRefundsStatusEnum.PendingRefund,
        (short)TicketRefundsStatusEnum.Rejected,
        (short)TicketRefundsStatusEnum.Refunded,
        (short)TicketRefundsStatusEnum.Cancelled
    ];
    private static readonly HashSet<int> AppealMetadataCompletedStatuses = [
        (int)InspectionAppealStatus.Pending,
        (int)InspectionAppealStatus.DepartmentProcessing,
        (int)InspectionAppealStatus.DepartmentProcessed,
        (int)InspectionAppealStatus.PendingCustomer,
        (int)InspectionAppealStatus.Approved,
        (int)InspectionAppealStatus.Rejected,
        (int)InspectionAppealStatus.Cancelled,
        (int)InspectionAppealStatus.Resolved
    ];
    private static readonly HashSet<int> AppealMetadataTodoExcludedStatuses = [
        (int)InspectionAppealStatus.Pending,
        (int)InspectionAppealStatus.DepartmentProcessed,
        (int)InspectionAppealStatus.PendingCustomer,
        (int)InspectionAppealStatus.Approved,
        (int)InspectionAppealStatus.Rejected,
        (int)InspectionAppealStatus.Cancelled,
        (int)InspectionAppealStatus.Resolved
    ];


    private static readonly HashSet<short> ProfileVerificationMetadataTodoExcludedStatuses = [
          (short)UserProfileStatusEnum.Approved,
          (short)UserProfileStatusEnum.Rejected,
          (short)UserProfileStatusEnum.Expired,
          (short)UserProfileStatusEnum.PendingCompletion
    ];

    private static readonly HashSet<short> ProfileVerificationMetadataCompletedStatuses = [
        (short)UserProfileStatusEnum.Approved,
        (short)UserProfileStatusEnum.Rejected
    ];


    public async Task<LicensingTeamManagementSummaryDto> GetSummaryAsync(bool applicationTaskOnly)
    {
        var todoTasks = await LoadTasksAsync(LicensingTeamManagementConstants.ViewTodo, applicationTaskOnly);
        var completedTasks = await LoadTasksAsync(LicensingTeamManagementConstants.ViewCompleted, applicationTaskOnly);
        var categories = BuildCategoryCounts(todoTasks, completedTasks, applicationTaskOnly);

        return new LicensingTeamManagementSummaryDto
        {
            TodoCount = todoTasks.Count,
            CompletedCount = completedTasks.Count,
            UrgentCount = todoTasks.Count(x => x.IsUrgent),
            Categories = categories
        };
    }

    public async Task<LicensingTeamManagementSummaryDto> GetSummaryV2Async(bool applicationTaskOnly)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var aggregates = await LicensingTeamManagementSummaryQuery
            .Build(dbContext, applicationTaskOnly, urgentDueBefore)
            .ToListAsync();

        var categories = GetSummaryCategorySequence(applicationTaskOnly)
            .Select(category => new LicensingTeamManagementCategoryCountDto
            {
                Category = category,
                CategoryDisplay = GetCategoryDisplay(category),
                TodoCount = aggregates
                    .Where(row => row.Category == category && !row.IsCompleted)
                    .Sum(row => row.Count),
                CompletedCount = aggregates
                    .Where(row => row.Category == category && row.IsCompleted)
                    .Sum(row => row.Count)
            })
            .ToList();

        return new LicensingTeamManagementSummaryDto
        {
            TodoCount = aggregates.Where(row => !row.IsCompleted).Sum(row => row.Count),
            CompletedCount = aggregates.Where(row => row.IsCompleted).Sum(row => row.Count),
            UrgentCount = aggregates.Sum(row => row.UrgentCount),
            Categories = categories
        };
    }

    public async Task<LicensingTeamManagementMetadataDto> GetMetadataAsync(bool applicationTaskOnly)
    {
        var statusOptions = await BuildStatusOptionGroupsAsync(applicationTaskOnly);

        return new LicensingTeamManagementMetadataDto
        {
            Categories = GetFilterCategorySequence(applicationTaskOnly)
                .Select(x => new LicensingTeamManagementStatusOptionDto
                {
                    Code = GetCategoryDisplay(x),
                    Display = GetCategoryDisplay(x)
                })
                .ToList(),
            Statuses = statusOptions.All,
            TodoStatuses = statusOptions.Todo,
            CompletedStatuses = statusOptions.Completed,
            LeaveReasons = await LoadLeaveReasonOptionsAsync()
        };
    }

    public async Task<List<LicensingTeamManagementStatusOptionDto>> GetStatusesAsync(bool applicationTaskOnly)
        => (await BuildStatusOptionGroupsAsync(applicationTaskOnly)).All;

    private async Task<StatusOptionGroups> BuildStatusOptionGroupsAsync(bool applicationTaskOnly)
    {
        var workflowOptions = await BuildWorkflowStatusOptionsAsync();
        var allOptions = new List<LicensingTeamManagementStatusOptionDto>(workflowOptions);

        // Configured workflow approval nodes are active task statuses and therefore
        // belong only to the To Do filter. Completed filters use terminal statuses
        // supplied by the other task sources below.
        var todoOptions = new List<LicensingTeamManagementStatusOptionDto>(workflowOptions);
        var completedOptions = new List<LicensingTeamManagementStatusOptionDto>();

        // PendingPayment is a terminal workflow status; include it in all and completed filter options.
        var pendingPaymentLabel = await ResolveWorkflowStatusNameAsync((int)ApprovalNodeOrder.PendingPayment);
        if (!string.IsNullOrWhiteSpace(pendingPaymentLabel))
        {
            var pendingPaymentOption = new LicensingTeamManagementStatusOptionDto
            {
                Code = pendingPaymentLabel,
                Display = pendingPaymentLabel
            };
            allOptions.Add(pendingPaymentOption);
            completedOptions.Add(pendingPaymentOption);
        }

        if (!applicationTaskOnly)
        {
            var enquiryOptions = await BuildTypeDictionaryStatusOptionGroupsAsync(
                "InquiryStatusAdmin",
                EnquiryMetadataCompletedStatuses,
                EnquiryMetadataTodoExcludedStatuses);
            var refundOptions = await BuildTypeDictionaryStatusOptionGroupsAsync(
                "Refund Status",
                RefundMetadataCompletedStatuses,
                RefundMetadataTodoExcludedStatuses);
            var appealOptions = BuildAppealStatusOptionGroups();

            var profileOptions = await BuildTypeDictionaryStatusOptionGroupsAsync(
              "UserProfileStatus_Admin",
              ProfileVerificationMetadataCompletedStatuses,
              ProfileVerificationMetadataTodoExcludedStatuses);

            AddStatusOptions(allOptions, todoOptions, completedOptions, enquiryOptions);
            AddStatusOptions(allOptions, todoOptions, completedOptions, refundOptions);
            AddStatusOptions(allOptions, todoOptions, completedOptions, appealOptions);

            AddStatusOptions(allOptions, todoOptions, completedOptions, profileOptions);
        }

        return new StatusOptionGroups(
            DeduplicateStatusOptions(allOptions),
            DeduplicateStatusOptions(todoOptions),
            DeduplicateStatusOptions(completedOptions));
    }

    private static void AddStatusOptions(
        List<LicensingTeamManagementStatusOptionDto> allOptions,
        List<LicensingTeamManagementStatusOptionDto> todoOptions,
        List<LicensingTeamManagementStatusOptionDto> completedOptions,
        StatusOptionGroups sourceOptions)
    {
        allOptions.AddRange(sourceOptions.All);
        todoOptions.AddRange(sourceOptions.Todo);
        completedOptions.AddRange(sourceOptions.Completed);
    }

    private static List<LicensingTeamManagementStatusOptionDto> DeduplicateStatusOptions(
        IEnumerable<LicensingTeamManagementStatusOptionDto> options)
    {
        return options
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToList();
    }

    public async Task<LicensingTeamManagementTaskQueryResponse> QueryTasksAsync(LicensingTeamManagementTaskQueryRequest request)
    {
        var tasks = await LoadTasksAsync(request.View, request.ApplicationTaskOnly);

        // Only keep tasks assigned to Licensing department (DepartmentId = 1) members
        var assigneeUserIds = tasks
            .Select(t => t.AssignedToUserId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct()
            .ToList();
        var licensingUserIds = assigneeUserIds.Count == 0
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : (await dbContext.UserDepartments.AsNoTracking()
                .Where(ud => ud.DepartmentId == LicensingDepartmentId && assigneeUserIds.Contains(ud.UserId))
                .Select(ud => ud.UserId)
                .Distinct()
                .ToListAsync())
              .ToHashSet(StringComparer.OrdinalIgnoreCase);
        tasks = tasks.Where(t => !string.IsNullOrWhiteSpace(t.AssignedToUserId) && licensingUserIds.Contains(t.AssignedToUserId!)).ToList();

        var filtered = ApplyTaskFilters(tasks, request);
        var ordered = ApplyTaskSorting(filtered, request);
        var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
        var pageSize = request.PageSize <= 0 ? 20 : request.PageSize;
        var pageItems = ordered.Skip((pageIndex - 1) * pageSize).Take(pageSize).Select(MapTaskDto).ToList();

        return new LicensingTeamManagementTaskQueryResponse
        {
            Page = new PageResponse<LicensingTeamManagementTaskItemDto>(pageItems, filtered.Count, pageIndex, pageSize)
        };
    }

    /// <summary>
    /// OPS-04 gate (Licensing, mirrors the Content gate). Resolves which read path serves a query:
    ///
    ///   Features:Req189LicensingReadSource   "table" | "views" | "legacy" | (unset)
    ///   Features:Req189TeamReadSyncEnabled   true | false
    ///
    /// Explicit Req189LicensingReadSource always wins — one-line rollback / one-line enable.
    /// When it is UNSET the read source follows the sync switch: sync on => "table",
    /// sync off => "views". The DirtyQueue worker and the nightly rebuild are only hosted when
    /// Req189TeamReadSyncEnabled is true; with sync off nothing maintains
    /// ReadModel.LicensingTeamTaskRead, so the always-live views are the safe default.
    /// The legacy Req189TeamCompletedViews=false switch still forces the pre-views UNION query.
    /// </summary>
    private string ResolveLicensingReadSource()
    {
        var configured = configuration.GetValue<string?>(Req189LicensingReadSourceFeature);
        var syncEnabled = configuration.GetValue(Req189TeamReadSyncEnabledFeature, true);

        if (string.IsNullOrWhiteSpace(configured))
        {
            // Preserve the older views kill-switch: if operators disabled the read views,
            // keep serving the legacy UNION query rather than jumping onto the table.
            if (!configuration.GetValue(Req189TeamReadViewsFeature, true))
                return ReadSourceLegacy;

            return syncEnabled ? ReadSourceTable : ReadSourceViews;
        }

        if (string.Equals(configured, ReadSourceLegacy, StringComparison.OrdinalIgnoreCase))
            return ReadSourceLegacy;

        if (string.Equals(configured, ReadSourceViews, StringComparison.OrdinalIgnoreCase))
            return ReadSourceViews;

        if (string.Equals(configured, ReadSourceTable, StringComparison.OrdinalIgnoreCase))
            return ReadSourceTable;

        // Unrecognized value: fail safe to the always-live views rather than guessing.
        return ReadSourceViews;
    }

    /// <summary>
    /// OPS-04. Single place that applies <see cref="ResolveLicensingReadSource"/>, so the page
    /// query and the export can never drift onto different sources.
    /// </summary>
    private IQueryable<LicensingTaskQueryRow> BuildLicensingTaskQuery(
        LicensingTeamManagementTaskQueryRequest request,
        string? normalizedCategory)
    {
        var readSource = ResolveLicensingReadSource();

        if (string.Equals(readSource, ReadSourceLegacy, StringComparison.OrdinalIgnoreCase))
        {
            return LicensingTeamManagementTaskQuery
                .BuildLegacy(dbContext, request, currentUserService.IsArabicLanguage, normalizedCategory)
                .TagWith("Req189:R189-01:Source=legacy");
        }

        if (string.Equals(readSource, ReadSourceTable, StringComparison.OrdinalIgnoreCase))
        {
            return LicensingTeamManagementTaskQuery
                .BuildFromTable(dbContext, request, currentUserService.IsArabicLanguage, normalizedCategory)
                .TagWith("Req189:R189-01:Source=table");
        }

        return LicensingTeamManagementTaskQuery
            .Build(dbContext, request, currentUserService.IsArabicLanguage, normalizedCategory)
            .TagWith("Req189:R189-01:Source=views");
    }

    public async Task<LicensingTeamManagementTaskQueryResponse> QueryTasksV2Async(LicensingTeamManagementTaskQueryRequest request)
    {
        var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
        var pageSize = request.PageSize <= 0 ? 20 : request.PageSize;
        var normalizedCategory = NormalizeTaskCategory(request.Category);
        var now = DateTimeHelper.Now;

        var query = BuildLicensingTaskQuery(request, normalizedCategory)
            .TagWith("Req189:R189-01:Base");
        var totalCount = await query
            .TagWith("Req189:R189-01:Count")
            .CountAsync();
        var pageRows = await LicensingTeamManagementTaskQuery
            .ApplySorting(query.TagWith("Req189:R189-01:Page"), request)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var profileIds = pageRows
            .Where(row => row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification)
            .Select(row => int.TryParse(row.SourceId, out var profileId) ? (int?)profileId : null)
            .Where(profileId => profileId.HasValue)
            .Select(profileId => profileId!.Value)
            .Distinct()
            .ToArray();
        HashSet<int> activeProfileIds = profileIds.Length == 0
            ? []
            : (await dbContext.ProfileVerificationReviewCycles
                .AsNoTracking()
                .Where(cycle => profileIds.Contains(cycle.ProfileId)
                                && cycle.Status == ProfileVerificationReviewCycleStatuses.Active)
                .Select(cycle => cycle.ProfileId)
                .ToListAsync())
            .ToHashSet();

        var assigneeIds = pageRows
            .Select(row => row.AssignedUserId)
            .Where(userId => !string.IsNullOrWhiteSpace(userId))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray()!;
        var dutyStatusMap = await LoadCurrentDutyStatusMapAsync(assigneeIds);
        var pendingModificationTaskIds = await LoadPendingModificationTaskIdsAsync();

        var pageItems = pageRows.Select(row =>
        {
            dutyStatusMap.TryGetValue(row.AssignedUserId ?? string.Empty, out var dutyStatus);
            var hideSla = ShouldHideApplicationSla(
                row.SourceType,
                row.RawStatusCode,
                pendingModificationTaskIds.Contains(row.SourceId));
            var dueOn = hideSla ? null : row.DueOn;
            var remainingMinutes = dueOn.HasValue
                ? row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification
                    ? (dueOn.Value - now).TotalMinutes
                    : (now - dueOn.Value).TotalMinutes
                : (double?)null;
            var displayRemainingMinutes = row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification
                ? -remainingMinutes
                : remainingMinutes;
            var isOverdue = remainingMinutes.HasValue
                            && (row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification
                                ? remainingMinutes.Value < 0
                                : remainingMinutes.Value > 0);

            return new LicensingTeamManagementTaskItemDto
            {
                SourceType = row.SourceType,
                SourceId = row.SourceId,
                TaskNo = row.TaskNo,
                TaskCategory = GetCategoryDisplay(row.Category),
                TaskCategoryCode = row.Category,
                TaskCategoryDisplay = GetCategoryDisplay(row.Category),
                ApplyFor = row.ApplyFor,
                ApplyForUserTypeId = row.ApplyForUserTypeId,
                ApplyForIconType = null, // stored-proc row; icon type resolved separately for urgent tasks
                AssignedToUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo,
                Status = row.StatusText,
                StatusCode = row.StatusFilterCode,
                StatusId = row.RawStatusCode,
                StatusDisplay = row.StatusText,
                StatusDisplayOnly = row.StatusDisplayOnly,
                LastUpdatedOn = row.LastUpdatedOn,
                IsUrgent = IsOnLeave(dutyStatus)
                    && remainingMinutes.HasValue
                    && remainingMinutes.Value >= -24d * 60d,
                CanReassign = row.CanReassign
                    && (row.SourceType != LicensingTeamManagementConstants.SourceProfileVerification
                        || int.TryParse(row.SourceId, out var profileId) && activeProfileIds.Contains(profileId)),
                DetailTarget = row.DetailTarget == null
                    ? null
                    : row.DetailTarget + (row.DetailTarget.Contains('?') ? "&" : "?") + "sourcePage=teamManagement",
                Sla = new LicensingTeamManagementSlaDto
                {
                    RemainingMinutes = remainingMinutes,
                    DisplayText = displayRemainingMinutes.ToSLADueInString(currentUserService.IsArabicLanguage),
                    IsOverdue = isOverdue,
                    DueOn = dueOn
                }
            };
        }).ToList();

        return new LicensingTeamManagementTaskQueryResponse
        {
            Page = new PageResponse<LicensingTeamManagementTaskItemDto>(
                pageItems,
                totalCount,
                pageIndex,
                pageSize)
        };
    }

    public async Task<byte[]> ExportTasksAsync(LicensingTeamManagementTaskQueryRequest request)
    {
        var tasks = ApplyTaskSorting(ApplyTaskFilters(await LoadTasksAsync(request.View, request.ApplicationTaskOnly), request), request);
        var builder = new StringBuilder();
        builder.AppendLine("SourceType,SourceId,TaskNo,TaskCategory,ApplyFor,Sla,AssignedTo,Status,LastUpdatedOn,IsUrgent,CanReassign,DetailTarget");

        foreach (var task in tasks)
        {
            var cells = new[]
            {
                task.SourceType,
                task.SourceId,
                task.TaskNo ?? string.Empty,
                task.TaskCategory,
                task.ApplyFor ?? string.Empty,
                task.SlaDisplayText,
                task.AssignedToName ?? string.Empty,
                task.StatusText ?? string.Empty,
                task.LastUpdatedOn.ToString("dd/MM/yyyy HH:mm:ss"),
                task.IsUrgent ? "true" : "false",
                task.CanReassign ? "true" : "false",
                task.DetailTarget ?? string.Empty
            };

            builder.AppendLine(string.Join(",", cells.Select(EscapeCsv)));
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var payload = Encoding.UTF8.GetBytes(builder.ToString());
        var result = new byte[preamble.Length + payload.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(payload, 0, result, preamble.Length, payload.Length);
        return result;
    }

    /// <summary>
    /// Optimized CSV export aligned with QueryTasksV2Async (same read model, filters, todo/completed
    /// handling and SLA/urgent computation) but without paging. Streams rows from the DB and writes
    /// the CSV incrementally so the whole result set is never materialized in memory at once.
    /// The legacy ExportTasksAsync is left untouched.
    /// </summary>
    public async Task<byte[]> ExportTasksV2Async(LicensingTeamManagementTaskQueryRequest request)
    {
        var now = DateTimeHelper.Now;
        var isArabic = currentUserService.IsArabicLanguage;
        var normalizedCategory = NormalizeTaskCategory(request.Category);

        // Identical read model + filters + sorting as the list endpoint; only paging is dropped.
        var query = BuildLicensingTaskQuery(request, normalizedCategory);
        var orderedQuery = LicensingTeamManagementTaskQuery.ApplySorting(query, request);

        // Current duty status for the (bounded) licensing team, loaded once, so IsUrgent can be
        // resolved while streaming rows without running the heavy UNION query a second time.
        var memberIds = await LicensingTeamManagementMembersOptimizedQuery
            .BuildMembers(dbContext, LicensingDepartmentId)
            .Select(member => member.UserId)
            .ToArrayAsync();
        var dutyStatusMap = await LoadCurrentDutyStatusMapAsync(memberIds);
        var pendingModificationTaskIds = await LoadPendingModificationTaskIdsAsync();

        using var stream = new MemoryStream();
        using (var writer = new StreamWriter(stream, new UTF8Encoding(true), leaveOpen: true))
        {
            await writer.WriteLineAsync(
                "TaskNo.,Task Category,Apply For,SLA,Assigned To,Status,Last Updated");

            await foreach (var row in orderedQuery.AsAsyncEnumerable())
            {
                dutyStatusMap.TryGetValue(row.AssignedUserId ?? string.Empty, out var dutyStatus);
                var hideSla = ShouldHideApplicationSla(
                    row.SourceType,
                    row.RawStatusCode,
                    pendingModificationTaskIds.Contains(row.SourceId));
                var dueOn = hideSla ? null : row.DueOn;
                var remainingMinutes = dueOn.HasValue
                    ? row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification
                        ? (dueOn.Value - now).TotalMinutes
                        : (now - dueOn.Value).TotalMinutes
                    : (double?)null;
                var displayRemainingMinutes = row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification
                    ? -remainingMinutes
                    : remainingMinutes;
                var isUrgent = IsOnLeave(dutyStatus)
                    && remainingMinutes.HasValue
                    && (row.SourceType == LicensingTeamManagementConstants.SourceProfileVerification
                        ? remainingMinutes.Value <= 24d * 60d
                        : remainingMinutes.Value >= -24d * 60d);

                var cells = new[]
                {
                    row.TaskNo ?? string.Empty,
                    row.Category,
                    row.ApplyFor ?? string.Empty,
                    displayRemainingMinutes.ToSLADueInString(isArabic),
                    row.AssignedTo ?? string.Empty,
                    row.StatusText ?? string.Empty,
                    row.LastUpdatedOn.ToString("dd/MM/yyyy HH:mm:ss")                  
                };

                await writer.WriteLineAsync(string.Join(",", cells.Select(EscapeCsv)));
            }

            await writer.FlushAsync();
        }

        return stream.ToArray();
    }

    public async Task<LicensingTeamManagementReassignResponse> ReassignTasksAsync(LicensingTeamManagementReassignRequest request)
    {
        if (request.Tasks == null || request.Tasks.Count == 0)
        {
            throw new BusinessException("Licensing.TeamManagement.EmptyTasks", "");
        }
        EnsureNoDuplicateReassignTasks(request.Tasks);

        var todoTasks = await LoadTasksAsync(LicensingTeamManagementConstants.ViewTodo, applicationTaskOnly: false);
        var lookup = todoTasks.ToDictionary(x => BuildTaskKey(x.SourceType, x.SourceId), StringComparer.OrdinalIgnoreCase);
        var targets = new List<AggregatedTaskItem>();

        foreach (var task in request.Tasks)
        {
            if (!lookup.TryGetValue(BuildTaskKey(task.SourceType, task.SourceId), out var target))
            {
                target = await ResolveReassignTargetAsync(task);
                if (target == null)
                {
                    throw new BusinessException("Licensing.TeamManagement.TaskNotFound", "");
                }
            }

            if (!target.CanReassign)
            {
                throw new BusinessException("Licensing.TeamManagement.TaskCannotReassign", "");
            }

            targets.Add(target);
        }

        var candidatePool = await BuildAssignmentCandidatePoolAsync(todoTasks);
        if (candidatePool.Count == 0)
        {
            throw new BusinessException("Licensing.TeamManagement.NoAvailableAssignee", "");
        }

        var requestedAssignee = string.IsNullOrWhiteSpace(request.AssignedUserId)
            ? null
            : candidatePool.FirstOrDefault(x => string.Equals(x.UserId, request.AssignedUserId, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(request.AssignedUserId)
            && (requestedAssignee == null || targets.Any(target => !CanAssignTargetToCandidate(target, requestedAssignee))))
        {
            throw new BusinessException("Licensing.TeamManagement.AssigneeNotAvailable", "");
        }

        var assignments = PlanAssignments(targets, candidatePool, requestedAssignee);
        var now = DateTimeHelper.Now;
        var hasApplicationTargets = targets.Any(target => string.Equals(
            target.SourceType,
            LicensingTeamManagementConstants.SourceApplication,
            StringComparison.OrdinalIgnoreCase));
        if (hasApplicationTargets && targets.Any(target => !string.Equals(
                target.SourceType,
                LicensingTeamManagementConstants.SourceApplication,
                StringComparison.OrdinalIgnoreCase)))
        {
            throw new BusinessException("Licensing.TeamManagement.MixedApplicationBatchNotSupported", "");
        }

        async Task<List<LicensingTeamManagementReassignResultDto>> ExecuteAssignmentsAsync()
        {
            var attemptResults = new List<LicensingTeamManagementReassignResultDto>(assignments.Count);
            foreach (var (target, selected) in assignments)
            {
                await ReassignSingleTaskAsync(target, selected, now);
                attemptResults.Add(new LicensingTeamManagementReassignResultDto
                {
                    SourceType = target.SourceType,
                    SourceId = target.SourceId,
                    AssignedUserId = selected.UserId,
                    AssignedUserName = selected.UserName
                });
            }
            return attemptResults;
        }

        var results = hasApplicationTargets
            ? await unitOfWork.ExecuteInTransactionAsync(ExecuteAssignmentsAsync)
            : await ExecuteAssignmentsAsync();
        if (hasApplicationTargets)
        {
            await SendApplicationReassignmentNotificationsAsync(results);
        }

        return new LicensingTeamManagementReassignResponse
        {
            ReassignedCount = results.Count,
            Results = results
        };
    }

    public async Task<LicensingTeamManagementReassignResponse> ReassignTasksV2Async(LicensingTeamManagementReassignRequest request)
    {
        if (request.Tasks == null || request.Tasks.Count == 0)
        {
            throw new BusinessException("Licensing.TeamManagement.EmptyTasks", "");
        }
        EnsureNoDuplicateReassignTasks(request.Tasks);

        await EnsureProfileReassignPermissionAsync(request.Tasks);

        var targetLookup = await LoadRequestedReassignTargetsOptimizedAsync(request.Tasks);
        var targets = new List<AggregatedTaskItem>(request.Tasks.Count);

        foreach (var task in request.Tasks)
        {
            var taskKey = BuildTaskKey(task.SourceType, task.SourceId);
            if (!targetLookup.TryGetValue(taskKey, out var target))
            {
                var fallbackKey = BuildOptimizedReassignTaskLookupKey(task);
                if (fallbackKey == null || !targetLookup.TryGetValue(fallbackKey, out target))
                {
                    throw new BusinessException("Licensing.TeamManagement.TaskNotFound", "");
                }
            }

            if (!target.CanReassign)
            {
                throw new BusinessException("Licensing.TeamManagement.TaskCannotReassign", "");
            }

            targets.Add(target);
        }

        var nonProfileTargets = targets
            .Where(target => !IsProfileVerificationSource(target.SourceType))
            .ToList();
        if (nonProfileTargets.Count > 0 && nonProfileTargets.Count != targets.Count)
        {
            throw new BusinessException("Licensing.TeamManagement.MixedProfileBatchNotSupported", "");
        }
        var hasApplicationTargets = nonProfileTargets.Any(target => string.Equals(
            target.SourceType,
            LicensingTeamManagementConstants.SourceApplication,
            StringComparison.OrdinalIgnoreCase));
        if (hasApplicationTargets && nonProfileTargets.Any(target => !string.Equals(
                target.SourceType,
                LicensingTeamManagementConstants.SourceApplication,
                StringComparison.OrdinalIgnoreCase)))
        {
            throw new BusinessException("Licensing.TeamManagement.MixedApplicationBatchNotSupported", "");
        }
        var candidatePool = nonProfileTargets.Count == 0
            ? []
            : await BuildOptimizedAssignmentCandidatePoolAsync();
        if (nonProfileTargets.Count > 0 && candidatePool.Count == 0)
        {
            throw new BusinessException("Licensing.TeamManagement.NoAvailableAssignee", "");
        }

        var requestedAssignee = string.IsNullOrWhiteSpace(request.AssignedUserId) || nonProfileTargets.Count == 0
            ? null
            : candidatePool.FirstOrDefault(x => string.Equals(x.UserId, request.AssignedUserId, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(request.AssignedUserId)
            && nonProfileTargets.Count > 0
            && (requestedAssignee == null || nonProfileTargets.Any(target => !CanAssignTargetToCandidate(target, requestedAssignee))))
        {
            throw new BusinessException("Licensing.TeamManagement.AssigneeNotAvailable", "");
        }

        if (!string.IsNullOrWhiteSpace(request.AssignedUserId) && targets.Count > nonProfileTargets.Count)
        {
            var profileCandidates = await LoadProfileReassignCandidatesAsync();
            if (!profileCandidates.Any(x => string.Equals(x.UserId, request.AssignedUserId, StringComparison.OrdinalIgnoreCase)))
            {
                throw new BusinessException("Licensing.TeamManagement.AssigneeNotAvailable", "");
            }
        }

        var assignments = PlanAssignments(nonProfileTargets, candidatePool, requestedAssignee);
        var assignmentByTaskKey = assignments.ToDictionary(
            item => BuildTaskKey(item.Target.SourceType, item.Target.SourceId),
            item => item.Candidate,
            StringComparer.OrdinalIgnoreCase);
        var now = DateTimeHelper.Now;

        async Task<List<LicensingTeamManagementReassignResultDto>> ExecuteAssignmentsAsync()
        {
            var attemptResults = new List<LicensingTeamManagementReassignResultDto>(targets.Count);
            foreach (var target in targets)
            {
                if (IsProfileVerificationSource(target.SourceType))
                {
                    var assignment = string.IsNullOrWhiteSpace(request.AssignedUserId)
                        ? await profileReviewAssignmentService.AutoAssignAsync(int.Parse(target.SourceId), null, null)
                        : await profileReviewAssignmentService.ReassignAsync(
                            int.Parse(target.SourceId),
                            new ProfileReviewAssignRequestDto
                            {
                                AssigneeUserId = request.AssignedUserId
                            });

                    attemptResults.Add(new LicensingTeamManagementReassignResultDto
                    {
                        SourceType = LicensingTeamManagementConstants.SourceProfileVerification,
                        SourceId = target.SourceId,
                        AssignedUserId = assignment.AssigneeUserId,
                        AssignedUserName = assignment.AssigneeUserName ?? string.Empty
                    });
                    continue;
                }

                if (!assignmentByTaskKey.TryGetValue(BuildTaskKey(target.SourceType, target.SourceId), out var selected))
                {
                    continue;
                }

                await ReassignSingleTaskAsync(target, selected, now);
                attemptResults.Add(new LicensingTeamManagementReassignResultDto
                {
                    SourceType = target.SourceType,
                    SourceId = target.SourceId,
                    AssignedUserId = selected.UserId,
                    AssignedUserName = selected.UserName
                });
            }
            return attemptResults;
        }

        List<LicensingTeamManagementReassignResultDto> results;
        if (nonProfileTargets.Count > 0)
        {
            results = hasApplicationTargets
                ? await unitOfWork.ExecuteInTransactionAsync(ExecuteAssignmentsAsync)
                : await ExecuteAssignmentsAsync();
            if (hasApplicationTargets)
            {
                await SendApplicationReassignmentNotificationsAsync(results);
            }
        }
        else
        {
            results = await ExecuteAssignmentsAsync();
        }

        await RefreshReadModelForReassignedTasksAsync(
            results.Select(result => (result.SourceType, result.SourceId)).ToList());

        return new LicensingTeamManagementReassignResponse
        {
            ReassignedCount = results.Count,
            Results = results
        };
    }

    /// <summary>
    /// Write-through refresh of ReadModel.LicensingTeamTaskRead, which is what the task list reads
    /// (OPS-04 read source "table"). Its only other refresh path is the DirtyQueue worker's
    /// 2-second poll, so without this the caller's immediate re-query — which is exactly what the
    /// portal does after a successful reassign — still shows the pre-reassign assignee.
    /// Runs after every business write has committed, because the sync opens its own transaction.
    /// Best effort by design: the reassign already succeeded, so a failure here is logged and left
    /// to the DirtyQueue / nightly rebuild rather than turned into a failed request.
    /// Internal (not private) for focused unit tests via InternalsVisibleTo.
    /// </summary>
    internal async Task RefreshReadModelForReassignedTasksAsync(
        List<(string SourceType, string SourceId)> tasks)
    {
        if (!configuration.GetValue(Req189TeamReadSyncEnabledFeature, true))
        {
            return;
        }

        var distinctTasks = tasks
            .GroupBy(task => task.SourceType + "::" + task.SourceId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First());

        foreach (var task in distinctTasks)
        {
            try
            {
                switch (task.SourceType)
                {
                    // The application SourceId is a Camunda TaskId, not an ApplicationId.
                    case LicensingTeamManagementConstants.SourceApplication:
                        await readSyncProcessor.SyncCamundaTaskAsync(task.SourceId);
                        break;
                    case LicensingTeamManagementConstants.SourceProfileVerification:
                        await readSyncProcessor.SyncProfileVerificationAsync(int.Parse(task.SourceId));
                        break;
                    case LicensingTeamManagementConstants.SourceEnquiry:
                        await readSyncProcessor.SyncEnquiryAsync(int.Parse(task.SourceId));
                        break;
                    case LicensingTeamManagementConstants.SourceRefund:
                        await readSyncProcessor.SyncRefundAsync(int.Parse(task.SourceId));
                        break;
                    case LicensingTeamManagementConstants.SourceAppeal:
                        await readSyncProcessor.SyncAppealAsync(int.Parse(task.SourceId));
                        break;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Licensing team read-model write-through failed for {SourceType} {SourceId}; "
                    + "the DirtyQueue worker will retry.",
                    task.SourceType, task.SourceId);
            }
        }
    }

    private async Task<AggregatedTaskItem?> ResolveReassignTargetAsync(LicensingTeamManagementReassignTaskDto task)
    {
        if (!string.Equals(task.SourceType, LicensingTeamManagementConstants.SourceApplication, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var taskId = NormalizeText(task.SourceId);
        if (taskId == null)
        {
            return null;
        }

        var record = await dbContext.CamundaTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TaskId == taskId);
        if (record == null || record.ApprovalDepartment != LicensingDepartmentId)
        {
            return null;
        }

        var process = await dbContext.CamundaProcessInstances
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.ProcessInstanceId == record.ProcessInstanceId);
        var statusId = record.StatusId ?? process?.StatusId;

        return new AggregatedTaskItem
        {
            SourceType = LicensingTeamManagementConstants.SourceApplication,
            SourceId = record.TaskId,
            TaskCategory = LicensingTeamManagementConstants.CategoryApplications,
            StatusDomain = WorkflowStatusDomain,
            AssignedToUserId = record.Assignee,
            ApprovalRole = RoleIdentifierNormalizer.Normalize(record.ApprovalRole),
            StatusCode = statusId?.ToString(),
            LastUpdatedOn = record.ApprovalAt ?? record.CreatedTime,
            TaskCreatedOn = record.CreatedTime,
            CompletedOn = record.ApprovalAt,
            SlaDueOn = record.DueDate,
            SlaRemainingMinutes = record.DueDate.HasValue ? (record.DueDate.Value.Date.AddDays(1) - DateTimeHelper.Now).TotalMinutes : null,
            CanReassign = CanReassignWorkflowTask(record.ApprovalAt, record.StatusId, process?.StatusId)
        };
    }

    public async Task<LicensingTeamManagementMembersResponse> GetMembersAsync(string? memberId, DateTime? startDate, DateTime? endDate, bool applicationTaskOnly)
    {
        var rangeStart = (startDate ?? DateTimeHelper.Now.Date.AddDays(-6)).Date;
        var rangeEnd = (endDate ?? DateTimeHelper.Now.Date).Date.AddDays(1).AddTicks(-1);
        var members = await LoadDepartmentMembersAsync();
        if (!string.IsNullOrWhiteSpace(memberId))
        {
            members = members.Where(x => string.Equals(x.UserId, memberId, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var allTasks = await LoadTasksAsync(LicensingTeamManagementConstants.ViewTodo, applicationTaskOnly);
        allTasks.AddRange(await LoadTasksAsync(LicensingTeamManagementConstants.ViewCompleted, applicationTaskOnly));
        var metricTasks = await LoadMemberMetricTasksAsync(applicationTaskOnly);
        var leaveReasonMap = await LoadLeaveReasonDisplayMapAsync();

        var memberIds = members.Select(x => x.UserId).ToArray();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(memberIds);

        // Count todo tasks per user once, instead of scanning all tasks per member (was O(members * tasks)).
        var todoCountByUser = allTasks
            .Where(x => IsTodoView(x) && !string.IsNullOrEmpty(x.AssignedToUserId))
            .GroupBy(x => x.AssignedToUserId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        var cards = new List<LicensingTeamManagementMemberCardDto>();
        foreach (var member in members)
        {
            var todoCount = todoCountByUser.GetValueOrDefault(member.UserId);
            var metrics = BuildMemberMetrics(metricTasks, member.UserId, rangeStart, rangeEnd, applicationTaskOnly);
            dutyMap.TryGetValue(member.UserId, out var dutyRecord);
            cards.Add(new LicensingTeamManagementMemberCardDto
            {
                UserId = member.UserId,
                UserName = member.UserName,
                AvatarUrl = member.AvatarUrl,
                IsOnLeave = IsOnLeave(dutyRecord),
                LeaveInfo = BuildLeaveInfo(dutyRecord, leaveReasonMap),
                TodoTaskCount = todoCount,
                MetricsByCategory = metrics
            });
        }

        cards = cards
            .OrderBy(x => x.IsOnLeave)
            .ThenByDescending(x => x.TodoTaskCount)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new LicensingTeamManagementMembersResponse
        {
            StartDate = rangeStart,
            EndDate = rangeEnd,
            Members = cards.Select(x => new LicensingTeamManagementMemberOptionDto
            {
                UserId = x.UserId,
                UserName = x.UserName
            }).ToList(),
            Cards = cards
        };
    }

    public async Task<LicensingTeamManagementMembersResponse> GetMembersOptimizedAsync(
        string? memberId,
        DateTime? startDate,
        DateTime? endDate,
        bool applicationTaskOnly,
        CancellationToken cancellationToken = default)
    {
        var rangeStart = (startDate ?? DateTimeHelper.Now.Date.AddDays(-6)).Date;
        var rangeEnd = (endDate ?? DateTimeHelper.Now.Date).Date.AddDays(1).AddTicks(-1);
        // The built-in super-admin account is not a real team member, so it is excluded from both
        // the member cards and the member dropdown.
        var members = (await LoadDepartmentMembersOptimizedAsync(memberId, cancellationToken))
            .Where(x => !string.Equals(x.UserId, SuperAdminUserId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (members.Count == 0)
        {
            return new LicensingTeamManagementMembersResponse
            {
                StartDate = rangeStart,
                EndDate = rangeEnd
            };
        }

        var memberIds = members.Select(x => x.UserId).ToArray();
        var todoCountByUser = await LoadOptimizedTodoCountsAsync(
            memberIds,
            applicationTaskOnly,
            cancellationToken);
        var metricTasks = await LoadOptimizedMemberMetricTasksAsync(
            memberIds,
            rangeStart,
            rangeEnd,
            applicationTaskOnly,
            cancellationToken);
        var leaveReasonMap = await LoadLeaveReasonDisplayMapAsync();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(memberIds);

        // Profile verifications are now per-member (driven by Workflow.ProfileReviewAssignments.AssigneeUserId),
        // so each member card shows its own counts. Only relevant when non-application sources are included.
        var profileVerificationMetricsByUser = applicationTaskOnly
            ? new Dictionary<string, LicensingTeamManagementMemberMetricDto>(StringComparer.OrdinalIgnoreCase)
            : await LoadProfileVerificationMetricsByUserAsync(memberIds, rangeStart, rangeEnd, cancellationToken);

        // Refund "assigned" count (members scope): condition 1 (current handler) + condition 2 (advanced to
        // Processed by the member within the range), used to override refunds.TotalAssignedTasks; the other refund
        // metrics remain from the metrics pipeline. The two scopes are mutually exclusive per (member, refund),
        // so each runs as a single GROUP BY and the per-member counts are summed in memory (avoids the
        // set-operation + aggregate translation risk).
        var refundAssignedByUser = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (!applicationTaskOnly)
        {
            var handlerAssigned = await LicensingTeamManagementMembersOptimizedQuery
                .BuildRefundHandlerAssignedCountsByUser(dbContext, LicensingDepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(refundAssignedByUser, handlerAssigned.Select(x => (x.UserId, x.Count)));

            var advancedAssigned = await LicensingTeamManagementMembersOptimizedQuery
                .BuildRefundAdvancedAssignedCountsByUser(dbContext, LicensingDepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(refundAssignedByUser, advancedAssigned.Select(x => (x.UserId, x.Count)));
        }

        // Enquiry "assigned" count (members scope): condition 1 (current handler, status Processing) + condition 2
        // (advanced to Processed by the member within the range), used to override enquiries.TotalAssignedTasks; the
        // other enquiry metrics remain from the metrics pipeline. Same mutually-exclusive-per-(member,enquiry) shape
        // as the refund override, so the two per-member counts are summed in memory.
        var enquiryAssignedByUser = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (!applicationTaskOnly)
        {
            var enquiryHandlerAssigned = await LicensingTeamManagementMembersOptimizedQuery
                .BuildEnquiryHandlerAssignedCountsByUser(dbContext, LicensingDepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(enquiryAssignedByUser, enquiryHandlerAssigned.Select(x => (x.UserId, x.Count)));

            var enquiryAdvancedAssigned = await LicensingTeamManagementMembersOptimizedQuery
                .BuildEnquiryAdvancedAssignedCountsByUser(dbContext, LicensingDepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(enquiryAssignedByUser, enquiryAdvancedAssigned.Select(x => (x.UserId, x.Count)));
        }

        var cards = members
            .Select(member =>
            {
                dutyMap.TryGetValue(member.UserId, out var dutyRecord);
                var metrics = BuildMemberMetrics(
                    metricTasks,
                    member.UserId,
                    rangeStart,
                    rangeEnd,
                    applicationTaskOnly);
                if (!applicationTaskOnly)
                {
                    metrics[LicensingTeamManagementConstants.CategoryProfileVerifications] =
                        profileVerificationMetricsByUser.TryGetValue(member.UserId, out var profileVerificationMetric)
                            ? profileVerificationMetric
                            : new LicensingTeamManagementMemberMetricDto();
                }

                if (metrics.TryGetValue(LicensingTeamManagementConstants.CategoryRefunds, out var refundMetric))
                {
                    var newRefundAssigned = refundAssignedByUser.GetValueOrDefault(member.UserId);
                    var assignedDelta = newRefundAssigned - refundMetric.TotalAssignedTasks;
                    refundMetric.TotalAssignedTasks = newRefundAssigned;

                    // Sync the delta to the summary (all) to maintain "All ≈ sum of categories".
                    if (assignedDelta != 0
                        && metrics.TryGetValue(LicensingTeamManagementConstants.CategoryAll, out var allMetric))
                    {
                        allMetric.TotalAssignedTasks += assignedDelta;
                    }
                }

                if (metrics.TryGetValue(LicensingTeamManagementConstants.CategoryEnquiries, out var enquiryMetric))
                {
                    var newEnquiryAssigned = enquiryAssignedByUser.GetValueOrDefault(member.UserId);
                    var enquiryAssignedDelta = newEnquiryAssigned - enquiryMetric.TotalAssignedTasks;
                    enquiryMetric.TotalAssignedTasks = newEnquiryAssigned;

                    // Sync the delta to the summary (all) to maintain "All ≈ sum of categories".
                    if (enquiryAssignedDelta != 0
                        && metrics.TryGetValue(LicensingTeamManagementConstants.CategoryAll, out var allMetricEnquiry))
                    {
                        allMetricEnquiry.TotalAssignedTasks += enquiryAssignedDelta;
                    }
                }

                return new LicensingTeamManagementMemberCardDto
                {
                    UserId = member.UserId,
                    UserName = member.UserName,
                    AvatarUrl = member.AvatarUrl,
                    IsOnLeave = IsOnLeave(dutyRecord),
                    LeaveInfo = BuildLeaveInfo(dutyRecord, leaveReasonMap),
                    TodoTaskCount = todoCountByUser.GetValueOrDefault(member.UserId),
                    MetricsByCategory = metrics
                };
            })
            .OrderBy(x => x.IsOnLeave)
            .ThenByDescending(x => x.TodoTaskCount)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new LicensingTeamManagementMembersResponse
        {
            StartDate = rangeStart,
            EndDate = rangeEnd,
            Members = cards.Select(x => new LicensingTeamManagementMemberOptionDto
            {
                UserId = x.UserId,
                UserName = x.UserName
            }).ToList(),
            Cards = cards
        };
    }

    public async Task<LicensingTeamManagementMemberMetricDto> GetAggregatedPerformanceMetricsAsync(
        string? memberId, DateTime? startDate, DateTime? endDate,
        CancellationToken cancellationToken = default)
    {
        var rangeStart = (startDate ?? DateTimeHelper.Now.Date.AddDays(-6)).Date;
        var rangeEnd = (endDate ?? DateTimeHelper.Now.Date).Date.AddDays(1).AddTicks(-1);
        var now = DateTimeHelper.Now;

        // ── Build the CamundaTasks base query with server-side member filtering ──
        var baseQuery = dbContext.CamundaTasks.AsNoTracking()
            .Where(t => t.ApprovalDepartment == LicensingDepartmentId
                        && t.Assignee != null
                        && t.CreatedTime >= rangeStart
                        && t.CreatedTime < rangeEnd);

        if (!string.IsNullOrWhiteSpace(memberId))
        {
            baseQuery = baseQuery.Where(t => t.Assignee == memberId);
        }
        else
        {
            var departmentUserIds = dbContext.UserDepartments.AsNoTracking()
                .Where(ud => ud.DepartmentId == LicensingDepartmentId)
                .Select(ud => ud.UserId)
                .Where(uid => uid != SuperAdminUserId);
            baseQuery = baseQuery.Where(t => departmentUserIds.Contains(t.Assignee!));
        }

        // Approval action code sets
        var rejectedCodes = new[] { 101, 102, 104, 105, 106, 107, 202 };
        var approvedCodes = new[] { 1, 3, 4, 5, 6, 201 };

        // ── Project flat join (task + latest approval) with minimal columns ──
        // SQL Server cannot aggregate over OUTER APPLY subqueries in GROUP BY,
        // so we project the join to a flat row set first, then aggregate in C#.
        // Only 6 scalar columns per row — lightweight even for large date ranges.
        var rows = await (
            from t in baseQuery
            from a in dbContext.ApprovalRecords.AsNoTracking()
                .Where(a => a.TaskId == t.TaskId && a.ApprovalDate != null)
                .OrderByDescending(a => a.ApprovalDate)
                .Take(1)
                .DefaultIfEmpty()
            select new
            {
                t.ApprovalAt,
                t.CreatedTime,
                t.DueDate,
                ActualDurationMinutes = (double?)a!.ActualDurationMinutes,
                WorkflowActionCode = (int?)a!.WorkflowActionCode,
                ApprovalAction = a!.ApprovalAction
            }
        ).ToListAsync(cancellationToken);

        if (rows.Count == 0)
            return new LicensingTeamManagementMemberMetricDto();

        var totalAssigned = rows.Count;
        var completedCount = 0;
        var onTimeCount = 0;
        var overdueCount = 0;
        var approvedCount = 0;
        var rejectedCount = 0;
        var processingMinutesSum = 0.0;

        foreach (var r in rows)
        {
            var isCompleted = r.ApprovalAt != null;
            var processingMinutes = r.ActualDurationMinutes
                ?? (isCompleted ? (r.ApprovalAt!.Value - r.CreatedTime).TotalMinutes : 0);
            var slaTargetMinutes = r.DueDate != null
                ? (r.DueDate.Value - r.CreatedTime).TotalMinutes
                : (double?)null;

            if (isCompleted)
            {
                completedCount++;
                processingMinutesSum += processingMinutes;

                if (slaTargetMinutes == null || processingMinutes <= slaTargetMinutes.Value)
                    onTimeCount++;

                // Approved
                if ((r.WorkflowActionCode != null && approvedCodes.Contains(r.WorkflowActionCode.Value))
                    || (r.WorkflowActionCode == null && r.ApprovalAction != null
                        && (r.ApprovalAction.Trim() == "Approval" || r.ApprovalAction.Trim() == "Approve")))
                {
                    approvedCount++;
                }
            }
            else
            {
                // Overdue: not completed, has SLA target, elapsed > target
                if (slaTargetMinutes != null && (now - r.CreatedTime).TotalMinutes > slaTargetMinutes.Value)
                    overdueCount++;
            }

            // Rejected (no completion requirement — matches original logic)
            if ((r.WorkflowActionCode != null && rejectedCodes.Contains(r.WorkflowActionCode.Value))
                || (r.WorkflowActionCode == null && r.ApprovalAction != null
                    && (r.ApprovalAction.Trim() == "Rejected"
                        || r.ApprovalAction.Trim() == "RejectedWithReview"
                        || r.ApprovalAction.Trim() == "Reject")))
            {
                rejectedCount++;
            }
        }

        var avgMinutes = completedCount == 0
            ? 0
            : Math.Round(processingMinutesSum / completedCount, 2);

        return new LicensingTeamManagementMemberMetricDto
        {
            CompletedTasks = completedCount,
            TotalAssignedTasks = totalAssigned,
            AvgProcessingTime = avgMinutes,
            SlaCompliance = completedCount == 0
                ? 0
                : Math.Round((decimal)onTimeCount * 100m / completedCount, 2),
            OverdueTasks = overdueCount,
            ApprovedApplicationCount = approvedCount,
            RejectedApplicationCount = rejectedCount
        };
    }

    public async Task<List<LicensingTeamManagementMemberPerformanceDto>> BuildMembersNeedingCoachingAsync(
        DateTime startDate, DateTime endDate, int take = 5, CancellationToken cancellationToken = default)
    {
        var rangeStart = startDate.Date;
        var rangeEnd = endDate.Date.AddDays(1).AddTicks(-1);
        var members = await LoadDepartmentMembersOptimizedAsync(null, cancellationToken);
        if (members.Count == 0) return [];

        var memberIds = members.Select(x => x.UserId).ToArray();
        var metricTasks = await LoadOptimizedMemberMetricTasksAsync(
            memberIds, rangeStart, rangeEnd, applicationTaskOnly: true, cancellationToken);

        var result = new List<LicensingTeamManagementMemberPerformanceDto>();
        foreach (var member in members)
        {
            var memberTasks = metricTasks
                .Where(x => string.Equals(x.AssignedToUserId, member.UserId, StringComparison.OrdinalIgnoreCase))
                .ToList();
            var metric = CalculateMetric(memberTasks, rangeStart, rangeEnd);
            result.Add(new LicensingTeamManagementMemberPerformanceDto
            {
                MemberId = member.UserId,
                MemberName = member.UserName,
                OverdueTasks = metric.OverdueTasks,
                SlaComplianceRate = metric.SlaCompliance,
                AvgProcessingTimeMinutes = metric.AvgProcessingTime,
                CompletedTasks = metric.CompletedTasks,
                TotalAssignedTasks = metric.TotalAssignedTasks
            });
        }

        return result
            .OrderByDescending(x => x.OverdueTasks)
            .ThenBy(x => x.SlaComplianceRate)
            .ThenByDescending(x => x.AvgProcessingTimeMinutes)
            .ThenBy(x => x.MemberName, StringComparer.OrdinalIgnoreCase)
            .Take(Math.Max(take, 1))
            .ToList();
    }
    public async Task<List<LicensingTeamManagementUserReassignDto>> GetUserReassignAsync(string? sourceType = null)
        => await GetUserReassignAsync(new LicensingTeamManagementReassignmentMembersRequest
        {
            SourceType = sourceType
        });

    public async Task<List<LicensingTeamManagementUserReassignDto>> GetUserReassignAsync(LicensingTeamManagementReassignmentMembersRequest request)
    {
        var sourceType = request.SourceType;
        var tasks = request.Tasks ?? [];
        if (IsProfileVerificationSource(sourceType))
        {
            return await LoadProfileReassignCandidatesAsync();
        }

        if (tasks.Count > 0)
        {
            if (tasks.Any(task => IsProfileVerificationSource(task.SourceType)))
            {
                return tasks.All(task => IsProfileVerificationSource(task.SourceType))
                    ? await LoadProfileReassignCandidatesAsync()
                    : [];
            }

            var targetLookup = await LoadRequestedReassignTargetsOptimizedAsync(tasks);
            var targets = new List<AggregatedTaskItem>(tasks.Count);
            foreach (var task in tasks)
            {
                var taskKey = BuildTaskKey(task.SourceType, task.SourceId);
                if (!targetLookup.TryGetValue(taskKey, out var target))
                {
                    var fallbackKey = BuildOptimizedReassignTaskLookupKey(task);
                    if (fallbackKey == null || !targetLookup.TryGetValue(fallbackKey, out target))
                    {
                        return [];
                    }
                }

                targets.Add(target);
            }

            var candidates = await BuildOptimizedAssignmentCandidatePoolAsync();
            return candidates
                .Where(candidate => targets.All(target => CanAssignTargetToCandidate(target, candidate)))
                .Select(candidate => new LicensingTeamManagementUserReassignDto
                {
                    UserId = candidate.UserId,
                    UserName = candidate.UserName
                })
                .OrderBy(member => member.UserName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(member => member.UserId, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        var members = await LoadDepartmentMembersAsync();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(members.Select(x => x.UserId).ToArray());
        return members
            //.Where(x => x.IsActive)
            .Where(x => !IsSuperAdminMember(x))
            .Where(x => !dutyMap.TryGetValue(x.UserId, out var dutyStatus) || !IsOnLeave(dutyStatus))
            .Select(member => new LicensingTeamManagementUserReassignDto
            {
                UserId = member.UserId,
                UserName = member.UserName
            })
            .OrderBy(member => member.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(member => member.UserId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>
    /// Profile verification reassignment candidates: every licensing member allowed to review profiles,
    /// leaders included, minus the ones currently on leave. Mirrors what the application source type
    /// offers, so a licensing manager can pull a profile task back to themselves.
    /// </summary>
    private async Task<List<LicensingTeamManagementUserReassignDto>> LoadProfileReassignCandidatesAsync()
    {
        var reviewers = await profileReviewAssignmentService.GetReassignableReviewersAsync(null, null);
        if (reviewers.Count == 0)
        {
            return [];
        }

        var dutyMap = await LoadCurrentDutyStatusMapAsync(reviewers.Select(x => x.UserId).ToArray());
        return reviewers
            .Where(x => !dutyMap.TryGetValue(x.UserId, out var dutyStatus) || !IsOnLeave(dutyStatus))
            .Select(reviewer => new LicensingTeamManagementUserReassignDto
            {
                UserId = reviewer.UserId,
                UserName = reviewer.UserName
            })
            .OrderBy(member => member.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(member => member.UserId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<LicensingTeamManagementDutyStatusActionResponse> MarkEmergencyLeaveAsync(string userId, LicensingTeamManagementEmergencyLeaveRequest request)
    {
        var normalizedLeaveReasonCode = await NormalizeLeaveReasonCodeAsync(request.LeaveReasonCode);
        if (string.IsNullOrWhiteSpace(normalizedLeaveReasonCode))
        {
            throw new BusinessException("Licensing.TeamManagement.LeaveReasonRequired", "");
        }

        if (request.ExpectedReturnDate <= DateTimeHelper.Now)
        {
            throw new BusinessException("Licensing.TeamManagement.ExpectedReturnDateInvalid", "");
        }

        var dutyMap = await LoadCurrentDutyStatusMapAsync([userId]);
        if (dutyMap.TryGetValue(userId, out var current) && IsOnLeave(current))
        {
            throw new BusinessException("Licensing.TeamManagement.AlreadyOnLeave", "");
        }

        var now = DateTimeHelper.Now;
        var dutyRecord = new TeamMemberDutyStatusRecord
        {
            UserId = userId,
            DepartmentId = LicensingDepartmentId,
            StatusType = LicensingTeamManagementConstants.DutyStatusEmergencyLeave,
            LeaveReasonCode = normalizedLeaveReasonCode,
            Notes = NormalizeText(request.Notes),
            ExpectedReturnDate = request.ExpectedReturnDate,
            EffectiveFrom = now,
            TriggeredByUserId = currentUserService.UserId,
            CreatedOn = now
        };
        dbContext.TeamMemberDutyStatusRecords.Add(dutyRecord);

        await unitOfWork.SaveChangesAsync();
        if (offDutyNotificationService != null)
        {
            try
            {
                await offDutyNotificationService.ProcessEmergencyLeaveAsync(userId, dutyRecord.Id, now);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing immediate licensing off-duty notification for user {UserId}.", userId);
            }
        }
        return new LicensingTeamManagementDutyStatusActionResponse { IsOnLeave = true };
    }

    public async Task<LicensingTeamManagementDutyStatusActionResponse> ResumeWorkAsync(string userId)
    {
        var dutyMap = await LoadCurrentDutyStatusMapAsync([userId]);
        if (!dutyMap.TryGetValue(userId, out var current) || !IsOnLeave(current))
        {
            throw new BusinessException("Licensing.TeamManagement.NotOnLeave", "");
        }

        dbContext.TeamMemberDutyStatusRecords.Add(new TeamMemberDutyStatusRecord
        {
            UserId = userId,
            DepartmentId = LicensingDepartmentId,
            StatusType = LicensingTeamManagementConstants.DutyStatusResumeWork,
            EffectiveFrom = DateTimeHelper.Now,
            TriggeredByUserId = currentUserService.UserId,
            CreatedOn = DateTimeHelper.Now
        });

        await unitOfWork.SaveChangesAsync();
        return new LicensingTeamManagementDutyStatusActionResponse { IsOnLeave = false };
    }

    public async Task<LicensingUrgentTaskAlertRunResponse> RunUrgentTaskAlertsAsync()
    {
        var todoTasks = await LoadTasksAsync(LicensingTeamManagementConstants.ViewTodo, applicationTaskOnly: false);
        var matchedTasks = todoTasks.Where(x => x.IsUrgent).ToList();
        var leaders = await LoadDepartmentLeaderTargetsAsync();
        var response = new LicensingUrgentTaskAlertRunResponse
        {
            ScannedCount = todoTasks.Count,
            MatchedCount = matchedTasks.Count
        };

        if (leaders.Count == 0)
        {
            response.SkippedTaskCount = matchedTasks.Count;
            return response;
        }

        var adminPortalUrl = configuration["TemplateServices:AdminPortal"] ?? configuration["TemplateServices:AdminProtal"] ?? string.Empty;

        foreach (var task in matchedTasks)
        {
            foreach (var leader in leaders)
            {
                var sent = await sendTemplateService.GetSendTemplate(
                    AlertTemplateNumber,
                    leader.UserId,
                    leader.ProfileId,
                    [
                        new TemplateVariable { Key = "staff_name", Value = leader.UserName },
                        new TemplateVariable { Key = "task_no", Value = task.TaskNo ?? string.Empty },
                        new TemplateVariable { Key = "task_category", Value = task.TaskCategory },
                        new TemplateVariable { Key = "apply_for", Value = task.ApplyFor ?? string.Empty },
                        new TemplateVariable { Key = "sla_deadline", Value = task.SlaDueOn?.ToString(DateTimeHelper.TemplateDateTimeFormat) ?? string.Empty },
                        new TemplateVariable { Key = "review_link", Value = BuildReviewLink(adminPortalUrl, task) }
                    ]);
                if (!sent)
                {
                    throw new InvalidOperationException($"Template send returned false for task {task.TaskNo}.");
                }
            }

            response.NotifiedTaskCount++;
        }

        response.NotifiedAdminCount = leaders.Count;
        return response;
    }

    private async Task<List<AggregatedTaskItem>> LoadTasksAsync(string view, bool applicationTaskOnly)
    {
        var tasks = new List<AggregatedTaskItem>();
        tasks.AddRange(await LoadApplicationTasksAsync(view));
        if (!applicationTaskOnly)
        {
            tasks.AddRange(await LoadEnquiryTasksAsync(view));
            tasks.AddRange(await LoadRefundTasksAsync(view));
            tasks.AddRange(await LoadAppealTasksAsync(view));
        }

        return tasks;
    }

    private async Task<List<LicensingTaskMetricContext>> LoadMemberMetricTasksAsync(bool applicationTaskOnly)
    {
        var tasks = new List<LicensingTaskMetricContext>();
        tasks.AddRange(await LoadApplicationMetricTasksAsync());
        if (!applicationTaskOnly)
        {
            tasks.AddRange(await LoadEnquiryMetricTasksAsync());
            tasks.AddRange(await LoadRefundMetricTasksAsync());
            tasks.AddRange(await LoadAppealMetricTasksAsync());
        }

        return tasks;
    }

    private async Task<List<AggregatedTaskItem>> LoadApplicationTasksAsync(string view)
    {
        // Push the view filter down to SQL: fetch only this view's rows (todo/completed) instead of loading the whole table and slicing in memory.
        var isCompletedView = view.Equals(LicensingTeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase);
        var recordsQuery = dbContext.CamundaTasks
            .AsNoTracking()
            .Include(x => x.ProcessInstance)
            .Where(x => x.ApprovalDepartment == LicensingDepartmentId && x.ProcessInstance != null);

        recordsQuery = isCompletedView
            ? recordsQuery.Where(x => x.ApprovalAt.HasValue)
            : recordsQuery.Where(x => !x.ApprovalAt.HasValue);

        var records = await recordsQuery.ToListAsync();

        if (records.Count == 0)
        {
            return [];
        }

        var applicationIds = records.Select(x => x.ProcessInstance!.ApplicationId).Distinct().ToArray();
        var applications = await dbContext.Applications
            .AsNoTracking()
            .Where(x => applicationIds.Contains(x.Id))
            .ToListAsync();
        var processIds = records.Select(x => x.ProcessInstanceId).Distinct().ToArray();
        var processes = await dbContext.CamundaProcessInstances
            .AsNoTracking()
            .Where(x => processIds.Contains(x.ProcessInstanceId))
            .ToListAsync();
        var serviceIds = applications.Select(x => x.ServiceId).Distinct().ToArray();
        var services = await dbContext.ServiceConfigs
            .AsNoTracking()
            .Where(x => serviceIds.Contains(x.Id))
            .ToListAsync();
        var assigneeIds = records.Select(x => x.Assignee).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray()!;
        var assignees = assigneeIds.Length == 0
            ? []
            : await dbContext.AdminUsers.AsNoTracking().Where(x => assigneeIds.Contains(x.Id)).ToListAsync();
        var profileIds = applications.Select(x => x.ProfileId).Where(x => x > 0).Distinct().ToArray();
        var applyForMap = await LoadApplyForMapAsync(profileIds);
        var applyForIconTypeMap = await LoadApplyForIconTypeMapAsync(profileIds);
        var dutyStatusMap = await LoadCurrentDutyStatusMapAsync(assigneeIds);

        // Build lookups up front to avoid O(n*m) FirstOrDefault scans inside the loop.
        var applicationMap = applications.ToDictionary(x => x.Id);
        var processLookup = processes.ToLookup(x => x.ProcessInstanceId, StringComparer.OrdinalIgnoreCase);
        var serviceMap = services.ToDictionary(x => x.Id);
        var assigneeLookup = assignees.ToLookup(x => x.Id, StringComparer.OrdinalIgnoreCase);
        // Load the workflow status dictionary once, replacing the per-row await inside the loop (was N+1).
        var workflowStatusNameMap = await BuildWorkflowStatusNameMapAsync();

        var result = new List<AggregatedTaskItem>();
        foreach (var record in records)
        {

            var application = applications.FirstOrDefault(x => x.Id == record.ProcessInstance!.ApplicationId);
            if (application == null)
            {
                continue;
            }

            var process = processLookup[record.ProcessInstanceId].FirstOrDefault();
            var service = serviceMap.TryGetValue(application.ServiceId, out var svc) ? svc : null;
            var assignee = assigneeLookup[record.Assignee ?? string.Empty].FirstOrDefault();
            dutyStatusMap.TryGetValue(record.Assignee ?? string.Empty, out var dutyStatus);
            var category = IsProfileVerification(service) ? LicensingTeamManagementConstants.CategoryProfileVerifications : LicensingTeamManagementConstants.CategoryApplications;
            var slaRemainingMinutes = record.DueDate.HasValue ? (record.DueDate.Value.Date.AddDays(1) - DateTimeHelper.Now).TotalMinutes : (double?)null;
            var statusId = record.StatusId ?? process?.StatusId;

            result.Add(new AggregatedTaskItem
            {
                SourceType = LicensingTeamManagementConstants.SourceApplication,
                SourceId = record.TaskId,
                TaskNo = application.ApplicationNumber,
                TaskCategory = category,
                StatusDomain = WorkflowStatusDomain,
                ApplyFor = applyForMap.TryGetValue(application.ProfileId, out var applyFor) ? applyFor : string.Empty,
                ApplyForIconType = applyForIconTypeMap.TryGetValue(application.ProfileId, out var applyForIconType) ? applyForIconType : null,
                AssignedToUserId = record.Assignee,
                AssignedToName = BuildUserName(assignee?.FirstName, assignee?.LastName, assignee?.UserName),
                ApprovalRole = RoleIdentifierNormalizer.Normalize(record.ApprovalRole),
                StatusCode = statusId?.ToString(),
                StatusText = ResolveWorkflowStatusName(workflowStatusNameMap, statusId),
                LastUpdatedOn = record.ApprovalAt ?? record.CreatedTime,
                TaskCreatedOn = record.CreatedTime,
                CompletedOn = record.ApprovalAt,
                SlaDueOn = record.DueDate,
                SlaRemainingMinutes = slaRemainingMinutes,
                SlaDisplayText = slaRemainingMinutes.ToSLAString(currentUserService.IsArabicLanguage),
                IsUrgent = !record.ApprovalAt.HasValue && IsOnLeave(dutyStatus) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                CanReassign = CanReassignWorkflowTask(record.ApprovalAt, record.StatusId, process?.StatusId),
                DetailTarget = $"applications/{application.Id}?taskId={record.TaskId}"
            });
        }

        return result;
    }

    private async Task<List<LicensingTaskMetricContext>> LoadApplicationMetricTasksAsync()
    {
        var now = DateTimeHelper.Now;
        var records = await dbContext.CamundaTasks
            .AsNoTracking()
            .Include(x => x.ProcessInstance)
            .Where(x => x.ApprovalDepartment == LicensingDepartmentId && x.ProcessInstance != null && !string.IsNullOrWhiteSpace(x.Assignee))
            .ToListAsync();
        if (records.Count == 0)
        {
            return [];
        }

        var applicationIds = records.Select(x => x.ProcessInstance!.ApplicationId).Distinct().ToArray();
        var applications = await dbContext.Applications
            .AsNoTracking()
            .Where(x => applicationIds.Contains(x.Id))
            .ToListAsync();
        var applicationMap = applications.ToDictionary(x => x.Id);
        var metricServiceIds = applications.Select(a => a.ServiceId).Distinct().ToArray();
        var services = await dbContext.ServiceConfigs
            .AsNoTracking()
            .Where(x => metricServiceIds.Contains(x.Id))
            .ToListAsync();
        var serviceMap = services.ToDictionary(x => x.Id);
        var approvalTaskIds = records
            .Select(t => t.TaskId)
            .Where(taskId => !string.IsNullOrWhiteSpace(taskId))
            .Distinct()
            .ToArray();
        var approvalRecordMap = (await dbContext.ApprovalRecords
                .AsNoTracking()
                // Exclude node-entry placeholders (ApprovalDate == null): an in-progress
                // node has no actioned record yet, same as before this model existed.
                .Where(x => approvalTaskIds.Contains(x.TaskId!) && x.ApprovalDate != null)
                .ToListAsync())
            .GroupBy(x => x.TaskId ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(r => r.ApprovalDate).First(), StringComparer.OrdinalIgnoreCase);

        return records
            .Where(record => applicationMap.ContainsKey(record.ProcessInstance!.ApplicationId))
            .Select(record =>
            {
                var application = applicationMap[record.ProcessInstance!.ApplicationId];
                var service = services.FirstOrDefault(x => x.Id == application.ServiceId);
                approvalRecordMap.TryGetValue(record.TaskId, out var approvalRecord);
                var processingMinutes = record.ApprovalAt.HasValue
                    ? approvalRecord?.ActualDurationMinutes ?? Math.Max((record.ApprovalAt.Value - record.CreatedTime).TotalMinutes, 0)
                    : Math.Max((now - record.CreatedTime).TotalMinutes, 0);
                var category = IsProfileVerification(service) ? LicensingTeamManagementConstants.CategoryProfileVerifications : LicensingTeamManagementConstants.CategoryApplications;

                return new LicensingTaskMetricContext
                {
                    GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceApplication, record.TaskId, record.Assignee!),
                    AssignedToUserId = record.Assignee,
                    TaskCategory = category,
                    AssignmentMoments = [record.CreatedTime],
                    ProcessingMinutes = processingMinutes,
                    CountsAsCompleted = record.ApprovalAt.HasValue,
                    IncludeInAverage = record.ApprovalAt.HasValue,
                    IsActiveTodo = !record.ApprovalAt.HasValue,
                    SlaTargetMinutes = BuildSlaTargetMinutes(record.DueDate, record.CreatedTime)
                };
            })
            .ToList();
    }

    private async Task<List<AggregatedTaskItem>> LoadEnquiryTasksAsync(string view)
    {
        var enquiries = await dbContext.Enquiries
            .AsNoTracking()
            .Where(x => x.DepartmentId == LicensingDepartmentId)
            .ToListAsync();

        enquiries = view.Equals(LicensingTeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase)
            ? enquiries.Where(x => EnquiryCompletedStatuses.Contains(x.EnquiryStatusId)).ToList()
            : enquiries.Where(x => !EnquiryCompletedStatuses.Contains(x.EnquiryStatusId)).ToList();

        if (enquiries.Count == 0)
        {
            return [];
        }

        var assigneeIds = enquiries.Select(x => x.HandlerUserId).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray()!;
        var assignees = assigneeIds.Length == 0
            ? []
            : await dbContext.AdminUsers.AsNoTracking().Where(x => assigneeIds.Contains(x.Id)).ToListAsync();
        var statusLookup = (await typeDictionaryService.GetListAsync("InquiryStatusAdmin"))
            .ToDictionary(x => x.Code ?? string.Empty, x => currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr) ? x.NameAr! : x.NameEn ?? x.Code ?? string.Empty, StringComparer.OrdinalIgnoreCase);
        var dutyStatusMap = await LoadCurrentDutyStatusMapAsync(assigneeIds);
        var applyForMap = await LoadApplyForMapAsync(enquiries.Where(x => x.UserProfileId.HasValue).Select(x => x.UserProfileId!.Value).Distinct().ToArray());
        var iconTypeMap = await LoadApplyForIconTypeMapAsync(enquiries.Where(x => x.UserProfileId.HasValue).Select(x => x.UserProfileId!.Value).Distinct().ToArray());
        var assigneeLookup = assignees.ToLookup(x => x.Id, StringComparer.OrdinalIgnoreCase);

        return enquiries.Select(enquiry =>
        {
            dutyStatusMap.TryGetValue(enquiry.HandlerUserId ?? string.Empty, out var dutyStatus);
            var assignee = assigneeLookup[enquiry.HandlerUserId ?? string.Empty].FirstOrDefault();
            var slaRemainingMinutes = enquiry.SLAEndTime.HasValue ? (enquiry.SLAEndTime.Value - DateTimeHelper.Now).TotalMinutes : (double?)null;
            return new AggregatedTaskItem
            {
                SourceType = LicensingTeamManagementConstants.SourceEnquiry,
                SourceId = enquiry.Id.ToString(),
                TaskNo = enquiry.EnquiryNumber,
                TaskCategory = LicensingTeamManagementConstants.CategoryEnquiries,
                StatusDomain = LicensingTeamManagementConstants.SourceEnquiry,
                ApplyFor = enquiry.UserProfileId.HasValue && applyForMap.TryGetValue(enquiry.UserProfileId.Value, out var enqApplyFor) ? enqApplyFor : enquiry.CreatedBy,
                ApplyForIconType = enquiry.UserProfileId.HasValue && iconTypeMap.TryGetValue(enquiry.UserProfileId.Value, out var enqIconType) ? enqIconType : null,
                AssignedToUserId = enquiry.HandlerUserId,
                AssignedToName = BuildUserName(assignee?.FirstName, assignee?.LastName, assignee?.UserName),
                StatusCode = enquiry.EnquiryStatusId.ToString(),
                StatusText = statusLookup.TryGetValue(enquiry.EnquiryStatusId.ToString(), out var statusName) ? statusName : enquiry.EnquiryStatusId.ToString(),
                LastUpdatedOn = enquiry.UpdatedOn ?? enquiry.CreatedOn,
                TaskCreatedOn = enquiry.CreatedOn,
                CompletedOn = EnquiryCompletedStatuses.Contains(enquiry.EnquiryStatusId) ? enquiry.UpdatedOn ?? enquiry.CreatedOn : null,
                SlaDueOn = enquiry.SLAEndTime,
                SlaRemainingMinutes = slaRemainingMinutes,
                SlaDisplayText = slaRemainingMinutes.ToSLAString(currentUserService.IsArabicLanguage),
                IsUrgent = IsOnLeave(dutyStatus) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                CanReassign = !EnquiryCompletedStatuses.Contains(enquiry.EnquiryStatusId),
                DetailTarget = $"happiness/tickets/tickets-details?id={enquiry.Id}"
            };
        }).ToList();
    }

    private async Task<List<LicensingTaskMetricContext>> LoadEnquiryMetricTasksAsync()
    {
        var now = DateTimeHelper.Now;
        var enquiries = await dbContext.Enquiries
            .AsNoTracking()
            .Where(x => x.DepartmentId == LicensingDepartmentId)
            .ToListAsync();
        if (enquiries.Count == 0)
        {
            return [];
        }

        var enquiryIds = enquiries.Select(e => e.Id).Distinct().ToArray();
        var trackingRows = await dbContext.EnquiryStatusTracking.AsNoTracking().Where(x => enquiryIds.Contains(x.EnquiryId)).ToListAsync();
        var enquiryMap = enquiries.ToDictionary(x => x.Id);
        var trackingByEnquiry = trackingRows.ToLookup(x => x.EnquiryId);
        var metrics = new List<LicensingTaskMetricContext>();

        foreach (var enquiry in enquiries.Where(x => !EnquiryCompletedStatuses.Contains(x.EnquiryStatusId) && !string.IsNullOrWhiteSpace(x.HandlerUserId)))
        {
            var assignedOn = ResolveEnquiryAssignedOn(trackingByEnquiry[enquiry.Id], enquiry.HandlerUserId!, null, enquiry.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceEnquiry, enquiry.Id.ToString(), enquiry.HandlerUserId!),
                AssignedToUserId = enquiry.HandlerUserId,
                TaskCategory = LicensingTeamManagementConstants.CategoryEnquiries,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(enquiry.SLAEndTime, enquiry.CreatedOn)
            });
        }

        foreach (var row in trackingRows.Where(x => x.DepartmentId == LicensingDepartmentId && EnquiryCompletedStatuses.Contains((short)x.ToStatusId)))
        {
            var ownerId = row.HandlerUserId ?? row.CreatedBy;
            if (!enquiryMap.TryGetValue(row.EnquiryId, out var enquiry) || string.IsNullOrWhiteSpace(ownerId))
            {
                continue;
            }

            var assignedOn = ResolveEnquiryAssignedOn(trackingByEnquiry[enquiry.Id], ownerId, row.CreatedOn, enquiry.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceEnquiry, enquiry.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = LicensingTeamManagementConstants.CategoryEnquiries,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((row.CreatedOn - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)EnquiryEnum.EnquiryAdminStatus.Cancelled,
                IsActiveTodo = false,
                SlaTargetMinutes = BuildSlaTargetMinutes(enquiry.SLAEndTime, enquiry.CreatedOn)
            });
        }

        return metrics;
    }

    private async Task<List<AggregatedTaskItem>> LoadRefundTasksAsync(string view)
    {
        var refunds = await dbContext.Refunds
            .AsNoTracking()
            .Where(x => x.ReferenceDepartmentId == LicensingDepartmentId)
            .ToListAsync();

        refunds = view.Equals(LicensingTeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase)
            ? refunds.Where(x => RefundCompletedStatuses.Contains(x.StatusId)).ToList()
            : refunds.Where(x => !RefundCompletedStatuses.Contains(x.StatusId)).ToList();

        if (refunds.Count == 0)
        {
            return [];
        }

        var assigneeIds = refunds.Select(x => x.HandlerUserId).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray()!;
        var assignees = assigneeIds.Length == 0
            ? []
            : await dbContext.AdminUsers.AsNoTracking().Where(x => assigneeIds.Contains(x.Id)).ToListAsync();
        var statusLookup = (await typeDictionaryService.GetListAsync("Refund Status"))
            .ToDictionary(x => x.Code ?? string.Empty, x => currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr) ? x.NameAr! : x.NameEn ?? x.Code ?? string.Empty, StringComparer.OrdinalIgnoreCase);
        var dutyStatusMap = await LoadCurrentDutyStatusMapAsync(assigneeIds);
        var applyForMap = await LoadProfileNameMapAsync(refunds.Where(x => x.ProfileId.HasValue).Select(x => x.ProfileId!.Value).Distinct().ToArray());
        var iconTypeMap = await LoadApplyForIconTypeMapAsync(refunds.Where(x => x.ProfileId.HasValue).Select(x => x.ProfileId!.Value).Distinct().ToArray());
        var assigneeLookup = assignees.ToLookup(x => x.Id, StringComparer.OrdinalIgnoreCase);

        return refunds.Select(refund =>
        {
            dutyStatusMap.TryGetValue(refund.HandlerUserId ?? string.Empty, out var dutyStatus);
            var assignee = assigneeLookup[refund.HandlerUserId ?? string.Empty].FirstOrDefault();
            var slaRemainingMinutes = refund.SLAEndTime.HasValue ? (refund.SLAEndTime.Value - DateTimeHelper.Now).TotalMinutes : (double?)null;
            return new AggregatedTaskItem
            {
                SourceType = LicensingTeamManagementConstants.SourceRefund,
                SourceId = refund.Id.ToString(),
                TaskNo = refund.ApplicationNumber ?? refund.ReferenceNumber ?? refund.TransactionNo ?? refund.Id.ToString(),
                TaskCategory = LicensingTeamManagementConstants.CategoryRefunds,
                StatusDomain = LicensingTeamManagementConstants.SourceRefund,
                ApplyFor = refund.ProfileId.HasValue && applyForMap.TryGetValue(refund.ProfileId.Value, out var name) ? name : refund.UserId,
                ApplyForIconType = refund.ProfileId.HasValue && iconTypeMap.TryGetValue(refund.ProfileId.Value, out var refIconType) ? refIconType : null,
                AssignedToUserId = refund.HandlerUserId,
                AssignedToName = BuildUserName(assignee?.FirstName, assignee?.LastName, assignee?.UserName),
                StatusCode = refund.StatusId.ToString(),
                StatusText = statusLookup.TryGetValue(refund.StatusId.ToString(), out var statusName) ? statusName : refund.StatusId.ToString(),
                LastUpdatedOn = refund.UpdateOn,
                TaskCreatedOn = refund.CreatedOn,
                CompletedOn = RefundCompletedStatuses.Contains(refund.StatusId) ? refund.UpdateOn : null,
                SlaDueOn = refund.SLAEndTime,
                SlaRemainingMinutes = slaRemainingMinutes,
                SlaDisplayText = slaRemainingMinutes.ToSLAString(currentUserService.IsArabicLanguage),
                IsUrgent = IsOnLeave(dutyStatus) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                CanReassign = !RefundCompletedStatuses.Contains(refund.StatusId),
                DetailTarget = $"finance/refunds/{refund.ReferenceNumber ?? refund.Id.ToString()}"
            };
        }).ToList();
    }

    private async Task<List<LicensingTaskMetricContext>> LoadRefundMetricTasksAsync()
    {
        var now = DateTimeHelper.Now;
        var refunds = await dbContext.Refunds
            .AsNoTracking()
            .Where(x => x.ReferenceDepartmentId == LicensingDepartmentId)
            .ToListAsync();
        if (refunds.Count == 0)
        {
            return [];
        }

        var refundIds = refunds.Select(r => r.Id).Distinct().ToArray();
        var trackingRows = await dbContext.RefundStatusTrackings.AsNoTracking().Where(x => refundIds.Contains(x.RefundId ?? 0)).ToListAsync();
        var refundMap = refunds.ToDictionary(x => x.Id);
        var trackingByRefund = trackingRows.ToLookup(x => x.RefundId);
        var metrics = new List<LicensingTaskMetricContext>();

        foreach (var refund in refunds.Where(x => !RefundCompletedStatuses.Contains(x.StatusId) && !string.IsNullOrWhiteSpace(x.HandlerUserId)))
        {
            var assignedOn = ResolveRefundAssignedOn(trackingByRefund[refund.Id], refund.HandlerUserId!, null, refund.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceRefund, refund.Id.ToString(), refund.HandlerUserId!),
                AssignedToUserId = refund.HandlerUserId,
                TaskCategory = LicensingTeamManagementConstants.CategoryRefunds,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(refund.SLAEndTime, refund.CreatedOn)
            });
        }

        foreach (var row in trackingRows.Where(x => x.DepartmentId == LicensingDepartmentId && RefundCompletedStatuses.Contains((short)(x.ToStatusId ?? 0))))
        {
            var ownerId = row.CreatedBy;
            if (!row.RefundId.HasValue || !refundMap.TryGetValue(row.RefundId.Value, out var refund) || string.IsNullOrWhiteSpace(ownerId))
            {
                continue;
            }

            var assignedOn = ResolveRefundAssignedOn(trackingByRefund[refund.Id], ownerId, row.CreatedOn, refund.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceRefund, refund.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = LicensingTeamManagementConstants.CategoryRefunds,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((row.CreatedOn - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)TicketRefundsStatusEnum.Cancelled,
                IsActiveTodo = false,
                SlaTargetMinutes = BuildSlaTargetMinutes(refund.SLAEndTime, refund.CreatedOn)
            });
        }

        return metrics;
    }

    private async Task<List<AggregatedTaskItem>> LoadAppealTasksAsync(string view)
    {
        var appeals = await dbContext.InspectionViolationAppeals
            .AsNoTracking()
            .Include(x => x.Violation)
            .Where(x => x.TimelineEvents.Any(t =>
                t.TargetDepartmentCode == null
                || t.TargetDepartmentCode == "1"
                || t.TargetDepartmentCode == "LicensingDepartment"
                || t.TargetDepartmentCode == "LICENSING"
                || t.TargetDepartmentCode == "Licensing"
                || t.TargetDepartmentCode == "ML"
                || t.TargetDepartmentName == "Licensing"
                || t.TargetDepartmentName == "Media Licensing Department"))
            .ToListAsync();

        var timelineEvents = await dbContext.InspectionAppealTimelineEvents
            .AsNoTracking()
            .Where(x => appeals.Select(a => a.Id).Contains(x.AppealId))
            .ToListAsync();

        var latestTargetEvents = timelineEvents
            .Where(x => !string.IsNullOrWhiteSpace(x.TargetHandlerUserId) || !string.IsNullOrWhiteSpace(x.TargetDepartmentName) || !string.IsNullOrWhiteSpace(x.TargetDepartmentCode))
            .GroupBy(x => x.AppealId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedOn).ThenByDescending(x => x.Id).First());

        appeals = appeals.Where(appeal =>
        {
            var isCompleted = AppealCompletedStatuses.Contains(appeal.StatusId);
            return view.Equals(LicensingTeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase) ? isCompleted : !isCompleted;
        }).ToList();

        if (appeals.Count == 0)
        {
            return [];
        }

        var assigneeIds = latestTargetEvents.Values.Select(x => x.TargetHandlerUserId).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray()!;
        var assignees = assigneeIds.Length == 0
            ? []
            : await dbContext.AdminUsers.AsNoTracking().Where(x => assigneeIds.Contains(x.Id)).ToListAsync();
        var dutyStatusMap = await LoadCurrentDutyStatusMapAsync(assigneeIds);
        var assigneeLookup = assignees.ToLookup(x => x.Id, StringComparer.OrdinalIgnoreCase);

        return appeals.Select(appeal =>
        {
            latestTargetEvents.TryGetValue(appeal.Id, out var latestTargetEvent);
            dutyStatusMap.TryGetValue(latestTargetEvent?.TargetHandlerUserId ?? string.Empty, out var dutyStatus);
            var assignee = assigneeLookup[latestTargetEvent?.TargetHandlerUserId ?? string.Empty].FirstOrDefault();
            var slaRemainingMinutes = appeal.SlaDueOn.HasValue ? (appeal.SlaDueOn.Value - DateTimeHelper.Now).TotalMinutes : (double?)null;
            return new AggregatedTaskItem
            {
                SourceType = LicensingTeamManagementConstants.SourceAppeal,
                SourceId = appeal.Id.ToString(),
                TaskNo = appeal.AppealNo,
                TaskCategory = LicensingTeamManagementConstants.CategoryAppeals,
                StatusDomain = LicensingTeamManagementConstants.SourceAppeal,
                ApplyFor = appeal.Violation?.ViolatorName,
                ApplyForIconType = null,
                AssignedToUserId = latestTargetEvent?.TargetHandlerUserId,
                AssignedToName = !string.IsNullOrWhiteSpace(latestTargetEvent?.TargetHandlerUserName)
                    ? latestTargetEvent!.TargetHandlerUserName
                    : BuildUserName(assignee?.FirstName, assignee?.LastName, assignee?.UserName),
                StatusCode = appeal.StatusId.ToString(),
                StatusText = GetAppealStatusDisplay(appeal.StatusId),
                LastUpdatedOn = appeal.LastUpdatedOn,
                TaskCreatedOn = appeal.CreatedOn,
                CompletedOn = AppealCompletedStatuses.Contains(appeal.StatusId) ? appeal.LastUpdatedOn : null,
                SlaDueOn = appeal.SlaDueOn,
                SlaRemainingMinutes = slaRemainingMinutes,
                SlaDisplayText = slaRemainingMinutes.ToSLAString(currentUserService.IsArabicLanguage),
                IsUrgent = IsOnLeave(dutyStatus) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                CanReassign = !AppealCompletedStatuses.Contains(appeal.StatusId),
                DetailTarget = $"appeals/{appeal.Id}"
            };
        }).ToList();
    }

    private async Task<List<LicensingTaskMetricContext>> LoadAppealMetricTasksAsync()
    {
        var department = await GetLicensingDepartmentAsync();
        if (department == null)
        {
            return [];
        }

        var now = DateTimeHelper.Now;
        var appeals = await dbContext.InspectionViolationAppeals
            .AsNoTracking()
            .Include(x => x.Violation)
            .Where(x => x.TimelineEvents.Any(t =>
                t.TargetDepartmentCode == null
                || t.TargetDepartmentCode == "1"
                || t.TargetDepartmentCode == "LicensingDepartment"
                || t.TargetDepartmentCode == "LICENSING"
                || t.TargetDepartmentCode == "Licensing"
                || t.TargetDepartmentCode == "ML"
                || t.TargetDepartmentName == "Licensing"
                || t.TargetDepartmentName == "Media Licensing Department"))
            .ToListAsync();
        if (appeals.Count == 0)
        {
            return [];
        }

        var timelineEvents = await dbContext.InspectionAppealTimelineEvents
            .AsNoTracking()
            .Where(x => appeals.Select(a => a.Id).Contains(x.AppealId))
            .ToListAsync();
        var latestTargetEvents = timelineEvents
            .Where(x => !string.IsNullOrWhiteSpace(x.TargetHandlerUserId) || !string.IsNullOrWhiteSpace(x.TargetDepartmentName) || !string.IsNullOrWhiteSpace(x.TargetDepartmentCode))
            .GroupBy(x => x.AppealId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedOn).ThenByDescending(x => x.Id).First());
        var appealMap = appeals.ToDictionary(x => x.Id);
        var timelineByAppeal = timelineEvents.ToLookup(x => x.AppealId);
        var metrics = new List<LicensingTaskMetricContext>();

        foreach (var appeal in appeals.Where(x => !AppealCompletedStatuses.Contains(x.StatusId)))
        {
            if (!latestTargetEvents.TryGetValue(appeal.Id, out var latestTargetEvent)
                || !DepartmentMatches(department, latestTargetEvent.TargetDepartmentCode, latestTargetEvent.TargetDepartmentName)
                || string.IsNullOrWhiteSpace(latestTargetEvent.TargetHandlerUserId))
            {
                continue;
            }

            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceAppeal, appeal.Id.ToString(), latestTargetEvent.TargetHandlerUserId),
                AssignedToUserId = latestTargetEvent.TargetHandlerUserId,
                TaskCategory = LicensingTeamManagementConstants.CategoryAppeals,
                AssignmentMoments = [latestTargetEvent.CreatedOn],
                ProcessingMinutes = Math.Max((now - latestTargetEvent.CreatedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(appeal.SlaDueOn, appeal.CreatedOn)
            });
        }

        foreach (var row in timelineEvents.Where(x => AppealCompletedStatuses.Contains(x.ToStatusId ?? 0)
                                                      && (DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName)
                                                          || DepartmentMatches(department, x.ActorDepartmentCode, x.ActorDepartmentName))))
        {
            var ownerId = row.ActorUserId ?? row.TargetHandlerUserId;
            if (!appealMap.TryGetValue(row.AppealId, out var appeal) || string.IsNullOrWhiteSpace(ownerId))
            {
                continue;
            }

            var assignedOn = ResolveAppealAssignedOn(timelineByAppeal[appeal.Id], department, ownerId, row.CreatedOn, appeal.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(LicensingTeamManagementConstants.SourceAppeal, appeal.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = LicensingTeamManagementConstants.CategoryAppeals,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((row.CreatedOn - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)InspectionAppealStatus.Cancelled,
                IsActiveTodo = false,
                SlaTargetMinutes = BuildSlaTargetMinutes(appeal.SlaDueOn, appeal.CreatedOn)
            });
        }

        return metrics;
    }

    private async Task ReassignSingleTaskAsync(AggregatedTaskItem task, AssignmentCandidate selected, DateTime now)
    {
        switch (task.SourceType)
        {
            case LicensingTeamManagementConstants.SourceApplication:
                await camundaTaskAppService.AssignmentTaskUserAsync([task.SourceId], selected.UserId, sendNotifications: false);
                break;
            case LicensingTeamManagementConstants.SourceEnquiry:
                await enquiryAppService.SaveAssignUserAsync(int.Parse(task.SourceId), new UMC.AdminPortal.Application.Dtos.EnquiryAssignReqeust(selected.UserId), updateManagerUserId: false);
                break;
            case LicensingTeamManagementConstants.SourceRefund:
                {
                    var refund = await dbContext.Refunds.FirstOrDefaultAsync(x => x.Id.ToString() == task.SourceId);
                    if (refund == null)
                    {
                        throw new BusinessException("Licensing.TeamManagement.TaskNotFound", "");
                    }

                    var previousAssigneeUserId = refund.HandlerUserId;
                    var assigneeChanged = !string.Equals(previousAssigneeUserId, selected.UserId, StringComparison.OrdinalIgnoreCase);
                    refund.HandlerUserId = selected.UserId;
                    refund.ManangerUserId = selected.UserId;
                    refund.UpdateOn = now;
                    if (assigneeChanged)
                    {
                        dbContext.AddRefundReassignmentNotificationEvent(
                            refund, previousAssigneeUserId, selected.UserId, selected.UserName,
                            currentUserService.UserId, now);
                    }
                    var tracking = new RefundStatusTracking
                    {
                        RefundId = refund.Id,
                        FromStatusId = refund.StatusId,
                        ToStatusId = refund.StatusId,
                        DepartmentId = LicensingDepartmentId,
                        Content = $"Task Reassigned to {selected.UserName}.",
                        CreatedBy = selected.UserId,
                        CreatedOn = now
                    };
                    dbContext.RefundStatusTrackings.Add(tracking);
                    await unitOfWork.SaveChangesAsync();
                    if (assigneeChanged && reassignmentNotificationService != null)
                    {
                        await reassignmentNotificationService.SendRefundReassignedAsync(refund.Id, tracking.Id, selected.UserId);
                    }
                    break;
                }
            case LicensingTeamManagementConstants.SourceAppeal:
                {
                    var appeal = await dbContext.InspectionViolationAppeals.FirstOrDefaultAsync(x => x.Id.ToString() == task.SourceId);
                    var department = await GetLicensingDepartmentAsync();
                    if (appeal == null || department == null)
                    {
                        throw new BusinessException("Licensing.TeamManagement.TaskNotFound", "");
                    }

                    var timeline = new InspectionAppealTimelineEvent
                    {
                        AppealId = appeal.Id,
                        EventCode = "TeamManagementReassigned",
                        EventName = "Task Reassigned",
                        Label = "Task Reassigned",
                        FromStatusId = appeal.StatusId,
                        ToStatusId = appeal.StatusId,
                        ActionTypeCode = "ReassignedToDepartment",
                        // A reassignment changes only the responsible user, so the current appeal SLA is preserved.
                        ResponseDeadline = appeal.SlaDueOn,
                        TargetHandlerTypeCode = "DepartmentStaff",
                        TargetHandlerUserId = selected.UserId,
                        TargetHandlerUserName = selected.UserName,
                        TargetDepartmentCode = department.Code,
                        TargetDepartmentName = department.NameEn,
                        ActorTypeCode = "AdminUser",
                        ActorUserId = currentUserService.UserId,
                        ActorUserName = currentUserService.UserName,
                        ActorDepartmentCode = department.Code,
                        ActorDepartmentName = department.NameEn,
                        Content = $"Task Reassigned to {selected.UserName}.",
                        CreatedOn = now,
                        CreatedBy = currentUserService.UserId
                    };
                    dbContext.InspectionAppealTimelineEvents.Add(timeline);
                    appeal.LastUpdatedOn = now;
                    appeal.UpdatedBy = currentUserService.UserId;
                    await unitOfWork.SaveChangesAsync();
                    if (!string.Equals(task.AssignedToUserId, selected.UserId, StringComparison.OrdinalIgnoreCase)
                        && reassignmentNotificationService != null)
                    {
                        await reassignmentNotificationService.SendAppealReassignedAsync(timeline.Id);
                    }
                    break;
                }
            default:
                throw new BusinessException("Licensing.TeamManagement.UnsupportedSourceType", "");
        }
    }

    private async Task SendApplicationReassignmentNotificationsAsync(
        List<LicensingTeamManagementReassignResultDto> results)
    {
        foreach (var group in results
                     .Where(result => string.Equals(
                         result.SourceType,
                         LicensingTeamManagementConstants.SourceApplication,
                         StringComparison.OrdinalIgnoreCase))
                     .GroupBy(result => result.AssignedUserId, StringComparer.OrdinalIgnoreCase))
        {
            var taskIds = group.Select(result => result.SourceId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var tasks = await dbContext.CamundaTasks
                .AsNoTracking()
                .Where(task => taskIds.Contains(task.TaskId))
                .ToListAsync();
            if (tasks.Count > 0)
            {
                await camundaTaskAppService.SendAssignmentNotificationsAsync(tasks, group.Key);
            }
        }
    }

    private async Task<List<AssignmentCandidate>> BuildAssignmentCandidatePoolAsync(List<AggregatedTaskItem> todoTasks)
    {
        var members = await LoadDepartmentMembersAsync();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(members.Select(x => x.UserId).ToArray());
        // Count todo tasks per user once, instead of scanning all tasks per candidate.
        var todoCountByUser = todoTasks
            .Where(t => IsTodoView(t) && !string.IsNullOrEmpty(t.AssignedToUserId))
            .GroupBy(t => t.AssignedToUserId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);
        var candidates = members
            .Where(x => x.IsActive)
            .Where(x => !dutyMap.TryGetValue(x.UserId, out var dutyStatus) || !IsOnLeave(dutyStatus))
            .Select(x => new AssignmentCandidate
            {
                UserId = x.UserId,
                UserName = x.UserName,
                TodoCount = todoCountByUser.GetValueOrDefault(x.UserId),
                RoleIds = x.RoleIds
            })
            .OrderBy(x => x.TodoCount)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.UserId, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return candidates;
    }

    private async Task<Dictionary<string, AggregatedTaskItem>> LoadRequestedReassignTargetsOptimizedAsync(
        List<LicensingTeamManagementReassignTaskDto> tasks)
    {
        var lookup = new Dictionary<string, AggregatedTaskItem>(StringComparer.OrdinalIgnoreCase);

        var applicationTaskIds = tasks
            .Where(task => string.Equals(
                NormalizeText(task.SourceType),
                LicensingTeamManagementConstants.SourceApplication,
                StringComparison.OrdinalIgnoreCase))
            .Select(task => NormalizeText(task.SourceId))
            .Where(taskId => taskId != null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (applicationTaskIds.Length > 0)
        {
            var applicationTargets = await LicensingTeamManagementReassignOptimizedQuery
                .BuildApplicationTargets(dbContext, applicationTaskIds, LicensingDepartmentId)
                .ToListAsync();
            foreach (var target in applicationTargets)
            {
                lookup[BuildTaskKey(LicensingTeamManagementConstants.SourceApplication, target.TaskId)] = new AggregatedTaskItem
                {
                    SourceType = LicensingTeamManagementConstants.SourceApplication,
                    SourceId = target.TaskId,
                    AssignedToUserId = target.Assignee,
                    ApprovalRole = RoleIdentifierNormalizer.Normalize(target.ApprovalRole),
                    CanReassign = CanReassignWorkflowTask(target.ApprovalAt, target.StatusId, target.ProcessStatusId)
                };
            }
        }

        var enquiryIds = ParseSourceIds(tasks, LicensingTeamManagementConstants.SourceEnquiry);
        if (enquiryIds.Length > 0)
        {
            var enquiryTargets = await LicensingTeamManagementReassignOptimizedQuery
                .BuildEnquiryTargets(
                    dbContext,
                    enquiryIds,
                    LicensingDepartmentId,
                    EnquiryCompletedStatuses.ToArray())
                .ToListAsync();
            foreach (var target in enquiryTargets)
            {
                lookup[BuildTaskKey(LicensingTeamManagementConstants.SourceEnquiry, target.SourceId.ToString())] = new AggregatedTaskItem
                {
                    SourceType = LicensingTeamManagementConstants.SourceEnquiry,
                    SourceId = target.SourceId.ToString(),
                    AssignedToUserId = target.AssignedUserId,
                    CanReassign = true
                };
            }
        }

        var refundIds = ParseSourceIds(tasks, LicensingTeamManagementConstants.SourceRefund);
        if (refundIds.Length > 0)
        {
            var refundTargets = await LicensingTeamManagementReassignOptimizedQuery
                .BuildRefundTargets(
                    dbContext,
                    refundIds,
                    LicensingDepartmentId,
                    RefundCompletedStatuses.ToArray())
                .ToListAsync();
            foreach (var target in refundTargets)
            {
                lookup[BuildTaskKey(LicensingTeamManagementConstants.SourceRefund, target.SourceId.ToString())] = new AggregatedTaskItem
                {
                    SourceType = LicensingTeamManagementConstants.SourceRefund,
                    SourceId = target.SourceId.ToString(),
                    AssignedToUserId = target.AssignedUserId,
                    CanReassign = true
                };
            }
        }

        var appealIds = ParseSourceIds(tasks, LicensingTeamManagementConstants.SourceAppeal);
        if (appealIds.Length > 0)
        {
            var appealTargets = await LicensingTeamManagementReassignOptimizedQuery
                .BuildAppealTargets(
                    dbContext,
                    appealIds,
                    AppealCompletedStatuses.ToArray())
                .ToListAsync();
            foreach (var target in appealTargets)
            {
                lookup[BuildTaskKey(LicensingTeamManagementConstants.SourceAppeal, target.SourceId.ToString())] = new AggregatedTaskItem
                {
                    SourceType = LicensingTeamManagementConstants.SourceAppeal,
                    SourceId = target.SourceId.ToString(),
                    AssignedToUserId = target.AssignedUserId,
                    CanReassign = true
                };
            }
        }

        var profileIds = ParseSourceIds(tasks, LicensingTeamManagementConstants.SourceProfileVerification);
        if (profileIds.Length > 0)
        {
            var profileTargets = await LicensingTeamManagementReassignOptimizedQuery
                .BuildProfileVerificationTargets(dbContext, profileIds)
                .ToListAsync();
            foreach (var target in profileTargets)
            {
                lookup[BuildTaskKey(LicensingTeamManagementConstants.SourceProfileVerification, target.SourceId.ToString())] = new AggregatedTaskItem
                {
                    SourceType = LicensingTeamManagementConstants.SourceProfileVerification,
                    SourceId = target.SourceId.ToString(),
                    AssignedToUserId = target.AssignedUserId,
                    CanReassign = true
                };
            }
        }

        return lookup;
    }

    private async Task<List<AssignmentCandidate>> BuildOptimizedAssignmentCandidatePoolAsync()
    {
        var members = await LoadDepartmentMembersAsync();
        var memberIds = members.Select(x => x.UserId).ToArray();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(memberIds);
        var todoCountByUser = await LoadOptimizedReassignTodoCountsAsync(memberIds);

        return members
            .Where(x => x.IsActive)
            .Where(x => !IsSuperAdminMember(x))
            .Where(x => !dutyMap.TryGetValue(x.UserId, out var dutyStatus) || !IsOnLeave(dutyStatus))
            .Select(x => new AssignmentCandidate
            {
                UserId = x.UserId,
                UserName = x.UserName,
                TodoCount = todoCountByUser.GetValueOrDefault(x.UserId),
                RoleIds = x.RoleIds
            })
            .OrderBy(x => x.TodoCount)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.UserId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<Dictionary<string, int>> LoadOptimizedReassignTodoCountsAsync(string[] memberIds)
    {
        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (memberIds.Length == 0)
        {
            return counts;
        }

        var applicationCounts = await LicensingTeamManagementReassignOptimizedQuery
            .BuildApplicationTodoCounts(dbContext, LicensingDepartmentId, memberIds)
            .ToListAsync();
        AddTodoCounts(counts, applicationCounts.Select(x => (x.UserId, x.Count)));

        var enquiryCounts = await LicensingTeamManagementReassignOptimizedQuery
            .BuildEnquiryTodoCounts(
                dbContext,
                LicensingDepartmentId,
                memberIds,
                EnquiryCompletedStatuses.ToArray())
            .ToListAsync();
        AddTodoCounts(counts, enquiryCounts.Select(x => (x.UserId, x.Count)));

        var refundCounts = await LicensingTeamManagementReassignOptimizedQuery
            .BuildRefundTodoCounts(
                dbContext,
                LicensingDepartmentId,
                memberIds,
                RefundCompletedStatuses.ToArray())
            .ToListAsync();
        AddTodoCounts(counts, refundCounts.Select(x => (x.UserId, x.Count)));

        var appealCounts = await LicensingTeamManagementReassignOptimizedQuery
            .BuildAppealTodoCounts(
                dbContext,
                memberIds,
                AppealCompletedStatuses.ToArray())
            .ToListAsync();
        AddTodoCounts(counts, appealCounts.Select(x => (x.UserId, x.Count)));

        var profileCounts = await LicensingTeamManagementReassignOptimizedQuery
            .BuildProfileVerificationTodoCounts(dbContext, memberIds)
            .ToListAsync();
        AddTodoCounts(counts, profileCounts.Select(x => (x.UserId, x.Count)));

        return counts;
    }

    private static int[] ParseSourceIds(
        List<LicensingTeamManagementReassignTaskDto> tasks,
        string sourceType)
    {
        return tasks
            .Where(task => string.Equals(
                NormalizeText(task.SourceType),
                sourceType,
                StringComparison.OrdinalIgnoreCase))
            .Select(task => NormalizeText(task.SourceId))
            .Where(sourceId => int.TryParse(sourceId, out _))
            .Select(sourceId => int.Parse(sourceId!))
            .Distinct()
            .ToArray();
    }

    private static string? BuildOptimizedReassignTaskLookupKey(LicensingTeamManagementReassignTaskDto task)
    {
        if (IsProfileVerificationSource(task.SourceType))
        {
            var normalizedProfileId = NormalizeText(task.SourceId);
            return normalizedProfileId != null && int.TryParse(normalizedProfileId, out _)
                ? BuildTaskKey(LicensingTeamManagementConstants.SourceProfileVerification, normalizedProfileId)
                : null;
        }

        if (!string.Equals(
                task.SourceType,
                LicensingTeamManagementConstants.SourceApplication,
                StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var normalizedSourceId = NormalizeText(task.SourceId);
        return normalizedSourceId == null
            ? null
            : BuildTaskKey(LicensingTeamManagementConstants.SourceApplication, normalizedSourceId);
    }

    private static AssignmentCandidate? SelectCandidate(List<AssignmentCandidate> candidates, string? currentAssigneeUserId = null)
    {
        return candidates
            .OrderBy(x => x.TodoCount)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.UserId, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(x => string.IsNullOrWhiteSpace(currentAssigneeUserId)
                                 || !string.Equals(x.UserId, currentAssigneeUserId, StringComparison.OrdinalIgnoreCase));
    }

    private async Task EnsureProfileReassignPermissionAsync(IEnumerable<LicensingTeamManagementReassignTaskDto> tasks)
    {
        if (permissionService == null || !tasks.Any(task => IsProfileVerificationSource(task.SourceType)))
        {
            return;
        }

        if (!await permissionService.HasPermissionAsync(AccountPermissionCodes.ProfileApproval.Process))
        {
            throw new BusinessException("Licensing.TeamManagement.ProfileVerificationPermissionDenied", "");
        }
    }

    private static bool IsProfileVerificationSource(string? sourceType)
        => string.Equals(
            NormalizeText(sourceType),
            LicensingTeamManagementConstants.SourceProfileVerification,
            StringComparison.OrdinalIgnoreCase);

    private async Task<List<DepartmentMemberContext>> LoadDepartmentMembersOptimizedAsync(
        string? memberId,
        CancellationToken cancellationToken)
    {
        var rows = await LicensingTeamManagementMembersOptimizedQuery
            .BuildMembers(dbContext, LicensingDepartmentId)
            .ToListAsync(cancellationToken);
        return rows
            // Keep the original endpoint's memberId behavior exactly:
            // whitespace-only means no filter, while a non-empty value is not trimmed.
            .Where(x => string.IsNullOrWhiteSpace(memberId)
                        || string.Equals(x.UserId, memberId, StringComparison.OrdinalIgnoreCase))
            .Select(x => new DepartmentMemberContext
            {
                UserId = x.UserId,
                UserName = BuildUserName(x.FirstName, x.LastName, x.UserName),
                AvatarUrl = x.AvatarUrl,
                IsActive = x.IsActive,
                IsLeader = x.IsLeader
            }).ToList();
    }

    private async Task<Dictionary<string, int>> LoadOptimizedTodoCountsAsync(
        string[] memberIds,
        bool applicationTaskOnly,
        CancellationToken cancellationToken)
    {
        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        var applicationCounts = await LicensingTeamManagementMembersOptimizedQuery
            .BuildApplicationTodoCounts(dbContext, LicensingDepartmentId, memberIds)
            .ToListAsync(cancellationToken);
        AddTodoCounts(counts, applicationCounts.Select(x => (x.UserId, x.Count)));

        if (applicationTaskOnly)
        {
            return counts;
        }

        var enquiryCounts = await dbContext.Enquiries
            .AsNoTracking()
            .Where(x => x.DepartmentId == LicensingDepartmentId
                        && x.HandlerUserId != null
                        && memberIds.Contains(x.HandlerUserId)
                        && !EnquiryCompletedStatuses.Contains(x.EnquiryStatusId))
            .GroupBy(x => x.HandlerUserId!)
            .Select(group => new { UserId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        AddTodoCounts(counts, enquiryCounts.Select(x => (x.UserId, x.Count)));

        var refundCounts = await dbContext.Refunds
            .AsNoTracking()
            .Where(x => x.ReferenceDepartmentId == LicensingDepartmentId
                        && x.HandlerUserId != null
                        && memberIds.Contains(x.HandlerUserId)
                        && !RefundCompletedStatuses.Contains(x.StatusId))
            .GroupBy(x => x.HandlerUserId!)
            .Select(group => new { UserId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        AddTodoCounts(counts, refundCounts.Select(x => (x.UserId, x.Count)));

        // Appeal ownership depends on the latest timeline event and department matching.
        // Reuse that established business rule, but retain only the small per-member counts.
        var appealCounts = (await LoadAppealTasksAsync(LicensingTeamManagementConstants.ViewTodo))
            .Where(x => !string.IsNullOrWhiteSpace(x.AssignedToUserId)
                        && memberIds.Contains(x.AssignedToUserId!, StringComparer.OrdinalIgnoreCase))
            .GroupBy(x => x.AssignedToUserId!, StringComparer.OrdinalIgnoreCase)
            .Select(group => (UserId: group.Key, Count: group.Count()));
        AddTodoCounts(counts, appealCounts);

        return counts;
    }

    private static void AddTodoCounts(
        Dictionary<string, int> target,
        IEnumerable<(string UserId, int Count)> source)
    {
        foreach (var (userId, count) in source)
        {
            target[userId] = target.GetValueOrDefault(userId) + count;
        }
    }

    private async Task<List<LicensingTaskMetricContext>> LoadOptimizedMemberMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        bool applicationTaskOnly,
        CancellationToken cancellationToken)
    {
        var tasks = await LoadOptimizedApplicationMetricTasksAsync(
            memberIds,
            rangeStart,
            rangeEnd,
            cancellationToken);

        if (!applicationTaskOnly)
        {
            tasks.AddRange(await LoadOptimizedEnquiryMetricTasksAsync(
                memberIds,
                rangeStart,
                rangeEnd,
                cancellationToken));
            tasks.AddRange(await LoadOptimizedRefundMetricTasksAsync(
                memberIds,
                rangeStart,
                rangeEnd,
                cancellationToken));
            tasks.AddRange(await LoadOptimizedAppealMetricTasksAsync(
                memberIds,
                rangeStart,
                rangeEnd,
                cancellationToken));
        }

        return tasks;
    }

    private async Task<List<LicensingTaskMetricContext>> LoadOptimizedApplicationMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var now = DateTimeHelper.Now;
        var records = await LicensingTeamManagementMembersOptimizedQuery
            .BuildApplicationMetricRows(
                dbContext,
                LicensingDepartmentId,
                memberIds,
                rangeStart,
                rangeEnd)
            .ToListAsync(cancellationToken);

        if (records.Count == 0)
        {
            return [];
        }

        // Optimization: reuse the already-materialized taskIds from `records` instead of
        // re-executing the 4-table JOIN (CamundaTasks+ProcessInstances+Applications+ServiceConfigs)
        // that BuildApplicationApprovalRows embeds as a subquery. For a 6-month date range this
        // eliminates the heaviest SQL statement in the pipeline.
        var taskIds = records
        .Select(r => r.TaskId)
        .Where(id => !string.IsNullOrWhiteSpace(id))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

        var latestApprovalByTask = taskIds.Length == 0
        ? new Dictionary<string, LicensingApprovalMetricRow>(StringComparer.OrdinalIgnoreCase)
        : (await dbContext.ApprovalRecords
            .AsNoTracking()
            .Where(a => a.TaskId != null
                    && a.ApprovalDate != null
                    && taskIds.Contains(a.TaskId))
            .Select(a => new LicensingApprovalMetricRow
            {
                TaskId = a.TaskId!,
                ApprovalDate = a.ApprovalDate,
                ActualDurationMinutes = a.ActualDurationMinutes,
                WorkflowActionCode = a.WorkflowActionCode,
                ApprovalAction = a.ApprovalAction
            })
            .ToListAsync(cancellationToken))
            .GroupBy(x => x.TaskId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
            group => group.Key,
            group => group.OrderByDescending(x => x.ApprovalDate).First(),
            StringComparer.OrdinalIgnoreCase);

        return records.Select(record =>
        {
            latestApprovalByTask.TryGetValue(record.TaskId, out var approvalRecord);
            var (isApprovedDecision, isRejectedDecision) = ResolveDecisionFromApprovalRow(approvalRecord);
            var processingMinutes = record.ApprovalAt.HasValue
                ? approvalRecord?.ActualDurationMinutes
                  ?? Math.Max((record.ApprovalAt.Value - record.CreatedTime).TotalMinutes, 0)
                : Math.Max((now - record.CreatedTime).TotalMinutes, 0);
            var category = ContainsIgnoreCase(record.ServiceNameEn, "profile")
                           || ContainsIgnoreCase(record.ServiceCode, "profile")
                ? LicensingTeamManagementConstants.CategoryProfileVerifications
                : LicensingTeamManagementConstants.CategoryApplications;

            return new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceApplication,
                    record.TaskId,
                    record.Assignee),
                AssignedToUserId = record.Assignee,
                TaskCategory = category,
                AssignmentMoments = [record.CreatedTime],
                ProcessingMinutes = processingMinutes,
                CountsAsCompleted = record.ApprovalAt.HasValue,
                IncludeInAverage = record.ApprovalAt.HasValue,
                IsActiveTodo = !record.ApprovalAt.HasValue,
                SlaTargetMinutes = BuildSlaTargetMinutes(record.DueDate, record.CreatedTime),
                IsApprovedDecision = isApprovedDecision && record.ApprovalAt.HasValue,
                IsRejectedDecision = isRejectedDecision
            };
        }).ToList();
    }

    private async Task<List<LicensingTaskMetricContext>> LoadOptimizedEnquiryMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var candidateIds = LicensingTeamManagementMembersOptimizedQuery
            .BuildEnquiryMetricCandidateIds(
                dbContext,
                LicensingDepartmentId,
                memberIds,
                rangeStart,
                rangeEnd);
        var enquiries = await dbContext.Enquiries
            .AsNoTracking()
            .Where(x => candidateIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        if (enquiries.Count == 0)
        {
            return [];
        }

        var enquiryIds = enquiries.Select(x => x.Id).ToArray();
        var trackingRows = await dbContext.EnquiryStatusTracking
            .AsNoTracking()
            .Where(x => enquiryIds.Contains(x.EnquiryId))
            .ToListAsync(cancellationToken);
        var now = DateTimeHelper.Now;
        var enquiryMap = enquiries.ToDictionary(x => x.Id);
        var trackingByEnquiry = trackingRows.ToLookup(x => x.EnquiryId);
        var metrics = new List<LicensingTaskMetricContext>();

        foreach (var enquiry in enquiries.Where(x =>
                     !EnquiryCompletedStatuses.Contains(x.EnquiryStatusId)
                     && !string.IsNullOrWhiteSpace(x.HandlerUserId)
                     && memberIds.Contains(x.HandlerUserId!, StringComparer.OrdinalIgnoreCase)))
        {
            var assignedOn = ResolveEnquiryAssignedOn(
                trackingByEnquiry[enquiry.Id],
                enquiry.HandlerUserId!,
                null,
                enquiry.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceEnquiry,
                    enquiry.Id.ToString(),
                    enquiry.HandlerUserId!),
                AssignedToUserId = enquiry.HandlerUserId,
                TaskCategory = LicensingTeamManagementConstants.CategoryEnquiries,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(enquiry.SLAEndTime, enquiry.CreatedOn)
            });
        }

        var latestLicensingProcessedByEnquiry = trackingRows
            .Where(x =>
                x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed
                && !string.IsNullOrWhiteSpace(x.CreatedBy)
                && memberIds.Contains(x.CreatedBy!, StringComparer.OrdinalIgnoreCase))
            .GroupBy(x => x.EnquiryId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(x => x.CreatedOn)
                    .ThenByDescending(x => x.Id)
                    .First());

        foreach (var enquiry in enquiries)
        {
            var isLicensingCurrentOwner = enquiry.DepartmentId == LicensingDepartmentId;
            var isCurrentlyProcessingInLicensing =
                isLicensingCurrentOwner
                && enquiry.EnquiryStatusId == (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing;
            latestLicensingProcessedByEnquiry.TryGetValue(enquiry.Id, out var latestLicensingProcessed);

            if (isCurrentlyProcessingInLicensing
                || latestLicensingProcessed == null)
            {
                continue;
            }

            var ownerId = latestLicensingProcessed.CreatedBy;
            if (string.IsNullOrWhiteSpace(ownerId)
                || !memberIds.Contains(ownerId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var completedOn = latestLicensingProcessed.CreatedOn;
            var assignedOn = ResolveEnquiryAssignedOn(
                trackingByEnquiry[enquiry.Id],
                ownerId,
                completedOn,
                enquiry.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceEnquiry,
                    enquiry.Id.ToString(),
                    ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = LicensingTeamManagementConstants.CategoryEnquiries,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((completedOn - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = true,
                IncludeInAverage = true,
                IsActiveTodo = false,
                SlaTargetMinutes = BuildSlaTargetMinutes(enquiry.SLAEndTime, enquiry.CreatedOn)
            });
        }

        return metrics;
    }

    private async Task<List<LicensingTaskMetricContext>> LoadOptimizedRefundMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var candidateIds = LicensingTeamManagementMembersOptimizedQuery
            .BuildRefundMetricCandidateIds(
                dbContext,
                LicensingDepartmentId,
                memberIds,
                rangeStart,
                rangeEnd);
        var refunds = await dbContext.Refunds
            .AsNoTracking()
            .Where(x => candidateIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        if (refunds.Count == 0)
        {
            return [];
        }

        var refundIds = refunds.Select(x => x.Id).ToArray();
        var trackingRows = await dbContext.RefundStatusTrackings
            .AsNoTracking()
            .Where(x => x.RefundId.HasValue && refundIds.Contains(x.RefundId.Value))
            .ToListAsync(cancellationToken);
        var now = DateTimeHelper.Now;
        var refundMap = refunds.ToDictionary(x => x.Id);
        var trackingByRefund = trackingRows.ToLookup(x => x.RefundId);
        var metrics = new List<LicensingTaskMetricContext>();

        foreach (var refund in refunds.Where(x =>
                     !RefundCompletedStatuses.Contains(x.StatusId)
                     && !string.IsNullOrWhiteSpace(x.HandlerUserId)
                     && memberIds.Contains(x.HandlerUserId!, StringComparer.OrdinalIgnoreCase)))
        {
            var assignedOn = ResolveRefundAssignedOn(
                trackingByRefund[refund.Id],
                refund.HandlerUserId!,
                null,
                refund.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceRefund,
                    refund.Id.ToString(),
                    refund.HandlerUserId!),
                AssignedToUserId = refund.HandlerUserId,
                TaskCategory = LicensingTeamManagementConstants.CategoryRefunds,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(refund.SLAEndTime, refund.CreatedOn)
            });
        }

        foreach (var row in trackingRows.Where(x =>
                     x.DepartmentId == LicensingDepartmentId
                     && RefundCompletedStatuses.Contains((short)(x.ToStatusId ?? 0))))
        {
            var ownerId = row.CreatedBy;
            if (!row.RefundId.HasValue
                || !refundMap.TryGetValue(row.RefundId.Value, out var refund)
                || string.IsNullOrWhiteSpace(ownerId)
                || !memberIds.Contains(ownerId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var assignedOn = ResolveRefundAssignedOn(
                trackingByRefund[refund.Id],
                ownerId,
                row.CreatedOn,
                refund.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceRefund,
                    refund.Id.ToString(),
                    ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = LicensingTeamManagementConstants.CategoryRefunds,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((row.CreatedOn - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)TicketRefundsStatusEnum.Cancelled,
                IsActiveTodo = false,
                SlaTargetMinutes = BuildSlaTargetMinutes(refund.SLAEndTime, refund.CreatedOn)
            });
        }

        return metrics;
    }

    private async Task<List<LicensingTaskMetricContext>> LoadOptimizedAppealMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var department = await GetLicensingDepartmentAsync();
        if (department == null)
        {
            return [];
        }

        var candidateIds = LicensingTeamManagementMembersOptimizedQuery
            .BuildAppealMetricCandidateIds(dbContext, memberIds, rangeStart, rangeEnd);
        var appeals = await dbContext.InspectionViolationAppeals
            .AsNoTracking()
            .Where(x => candidateIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        if (appeals.Count == 0)
        {
            return [];
        }

        var appealIds = appeals.Select(x => x.Id).ToArray();
        var timelineEvents = await dbContext.InspectionAppealTimelineEvents
            .AsNoTracking()
            .Where(x => appealIds.Contains(x.AppealId))
            .ToListAsync(cancellationToken);
        var latestTargetEvents = timelineEvents
            .Where(x => !string.IsNullOrWhiteSpace(x.TargetHandlerUserId)
                        || !string.IsNullOrWhiteSpace(x.TargetDepartmentName)
                        || !string.IsNullOrWhiteSpace(x.TargetDepartmentCode))
            .GroupBy(x => x.AppealId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(x => x.CreatedOn).ThenByDescending(x => x.Id).First());
        var now = DateTimeHelper.Now;
        var appealMap = appeals.ToDictionary(x => x.Id);
        var timelineByAppeal = timelineEvents.ToLookup(x => x.AppealId);
        var metrics = new List<LicensingTaskMetricContext>();

        foreach (var appeal in appeals.Where(x => !AppealCompletedStatuses.Contains(x.StatusId)))
        {
            if (!latestTargetEvents.TryGetValue(appeal.Id, out var latestTargetEvent)
                || !DepartmentMatches(
                    department,
                    latestTargetEvent.TargetDepartmentCode,
                    latestTargetEvent.TargetDepartmentName)
                || string.IsNullOrWhiteSpace(latestTargetEvent.TargetHandlerUserId)
                || !memberIds.Contains(
                    latestTargetEvent.TargetHandlerUserId,
                    StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceAppeal,
                    appeal.Id.ToString(),
                    latestTargetEvent.TargetHandlerUserId),
                AssignedToUserId = latestTargetEvent.TargetHandlerUserId,
                TaskCategory = LicensingTeamManagementConstants.CategoryAppeals,
                AssignmentMoments = [latestTargetEvent.CreatedOn],
                ProcessingMinutes = Math.Max((now - latestTargetEvent.CreatedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(appeal.SlaDueOn, appeal.CreatedOn)
            });
        }

        foreach (var row in timelineEvents.Where(x =>
                     AppealCompletedStatuses.Contains(x.ToStatusId ?? 0)
                     && (DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName)
                         || DepartmentMatches(department, x.ActorDepartmentCode, x.ActorDepartmentName))))
        {
            var ownerId = row.ActorUserId ?? row.TargetHandlerUserId;
            if (!appealMap.TryGetValue(row.AppealId, out var appeal)
                || string.IsNullOrWhiteSpace(ownerId)
                || !memberIds.Contains(ownerId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var assignedOn = ResolveAppealAssignedOn(
                timelineByAppeal[appeal.Id],
                department,
                ownerId,
                row.CreatedOn,
                appeal.CreatedOn);
            metrics.Add(new LicensingTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(
                    LicensingTeamManagementConstants.SourceAppeal,
                    appeal.Id.ToString(),
                    ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = LicensingTeamManagementConstants.CategoryAppeals,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((row.CreatedOn - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)InspectionAppealStatus.Cancelled,
                IsActiveTodo = false,
                SlaTargetMinutes = BuildSlaTargetMinutes(appeal.SlaDueOn, appeal.CreatedOn)
            });
        }

        return metrics;
    }

    private async Task<List<DepartmentMemberContext>> LoadDepartmentMembersAsync()
    {
        var rows = await (from ud in dbContext.UserDepartments.AsNoTracking()
                          join user in dbContext.AdminUsers.AsNoTracking() on ud.UserId equals user.Id
                          where ud.DepartmentId == LicensingDepartmentId
                          select new
                          {
                              user.Id,
                              user.FirstName,
                              user.LastName,
                              user.UserName,
                              user.PersonalPhotoUrl,
                              user.IsActive,
                              IsLeader = ud.IsLeader ?? false
                          }).ToListAsync();

        var memberIds = rows.Select(x => x.Id).Distinct().ToArray();
        var userRoleRows = await dbContext.UserRoles
            .AsNoTracking()
            .Where(userRole => memberIds.Contains(userRole.UserId))
            .Select(userRole => new { userRole.UserId, userRole.RoleId })
            .ToListAsync();
        var activeRoleIds = RoleIdentifierNormalizer.NormalizeMany(await dbContext.Roles
            .AsNoTracking()
            .Where(role => role.Status != "-1")
            .Select(role => role.Id)
            .ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rolesByUser = userRoleRows
            .GroupBy(x => x.UserId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => RoleIdentifierNormalizer.NormalizeMany(group.Select(x => x.RoleId))
                    .Where(activeRoleIds.Contains)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);

        return rows.Select(x => new DepartmentMemberContext
        {
            UserId = x.Id,
            UserName = BuildUserName(x.FirstName, x.LastName, x.UserName),
            AvatarUrl = x.PersonalPhotoUrl,
            IsActive = x.IsActive,
            IsLeader = x.IsLeader,
            RoleIds = rolesByUser.GetValueOrDefault(x.Id) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        }).ToList();
    }

    private static bool IsSuperAdminMember(DepartmentMemberContext member)
    {
        return string.Equals(member.UserId, SuperAdminUserId, StringComparison.OrdinalIgnoreCase)
            || member.RoleIds.Any(roleId => string.Equals(roleId?.Trim(), SuperAdminRoleId, StringComparison.OrdinalIgnoreCase));
    }

    private static List<(AggregatedTaskItem Target, AssignmentCandidate Candidate)> PlanAssignments(
        List<AggregatedTaskItem> targets,
        List<AssignmentCandidate> candidates,
        AssignmentCandidate? requestedAssignee)
    {
        var planned = new List<(AggregatedTaskItem, AssignmentCandidate)>(targets.Count);
        foreach (var target in targets)
        {
            var selected = candidates
                .Where(candidate => CanAssignTargetToCandidate(target, candidate))
                .Where(candidate => requestedAssignee != null
                    ? string.Equals(candidate.UserId, requestedAssignee.UserId, StringComparison.OrdinalIgnoreCase)
                    : !string.Equals(candidate.UserId, target.AssignedToUserId, StringComparison.OrdinalIgnoreCase))
                .OrderBy(candidate => candidate.TodoCount)
                .ThenBy(candidate => candidate.UserName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.UserId, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();
            if (selected == null)
            {
                if (requestedAssignee == null
                    && candidates.Any(candidate =>
                        CanAssignTargetToCandidate(target, candidate)
                        && string.Equals(candidate.UserId, target.AssignedToUserId, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                throw new BusinessException("Licensing.TeamManagement.NoAvailableAssignee", "");
            }

            planned.Add((target, selected));
            selected.TodoCount++;
        }

        return planned;
    }

    private static void EnsureNoDuplicateReassignTasks(List<LicensingTeamManagementReassignTaskDto> tasks)
    {
        var uniqueKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (tasks.Any(task => !uniqueKeys.Add(BuildTaskKey(task.SourceType, task.SourceId))))
        {
            throw new BusinessException("Licensing.TeamManagement.DuplicateTasks", "");
        }
    }

    private static bool CanAssignTargetToCandidate(AggregatedTaskItem target, AssignmentCandidate candidate)
    {
        if (!string.Equals(target.SourceType, LicensingTeamManagementConstants.SourceApplication, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var requiredRole = RoleIdentifierNormalizer.Normalize(target.ApprovalRole);
        return requiredRole.Length > 0 && candidate.RoleIds.Contains(requiredRole);
    }

    private async Task<Dictionary<string, TeamMemberDutyStatusRecord>> LoadCurrentDutyStatusMapAsync(string[] userIds)
    {
        if (userIds.Length == 0)
        {
            return new Dictionary<string, TeamMemberDutyStatusRecord>(StringComparer.OrdinalIgnoreCase);
        }

        return (await dbContext.TeamMemberDutyStatusRecords
                .AsNoTracking()
                .Where(x => x.DepartmentId == LicensingDepartmentId && userIds.Contains(x.UserId))
                .OrderByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .ToListAsync())
            .GroupBy(x => x.UserId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Per-member profileVerifications metric sourced from assignments joined to their immutable review cycles.
    ///  - TotalAssignedTasks: Status != Cancelled
    ///  - CompletedTasks: Status == Completed
    ///  - OverdueTasks: Status == Pending whose SLA (A.CreatedOn + 1 day) has elapsed
    ///  - AvgProcessingTime: average (CompletedAt - AssignedAt) minutes over completed assignments
    ///  - SlaCompliance: % of completed whose CompletedAt is within A.CreatedOn + 1 day
    /// Returns a dictionary keyed by AssigneeUserId; members with no assignments in range are absent.
    /// </summary>
    private async Task<Dictionary<string, LicensingTeamManagementMemberMetricDto>> LoadProfileVerificationMetricsByUserAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var rows = await LicensingTeamManagementMembersOptimizedQuery
            .BuildProfileVerificationAssignmentRows(dbContext, memberIds, rangeStart, rangeEnd)
            .ToListAsync(cancellationToken);

        var now = DateTimeHelper.Now;

        return rows
            .GroupBy(row => row.AssigneeUserId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => BuildProfileVerificationMetric(group, now),
                StringComparer.OrdinalIgnoreCase);
    }

    // Profile verification SLA is measured from the customer's persisted submission timestamp.
    private const int ProfileVerificationSlaDays = 1;

    /// <summary>
    /// Folds one member's profileVerifications assignment rows into a metric card in a single pass.
    /// Counting is per assignment row: TotalAssignedTasks = Status != Cancelled,
    /// CompletedTasks = Status == Completed, OverdueTasks = Pending past SLA
    /// (ProfileSlaStartedOn + ProfileVerificationSlaDays). AvgProcessingTime / SlaCompliance are computed
    /// over completed assignments that carry a CompletedAt.
    /// </summary>
    private static LicensingTeamManagementMemberMetricDto BuildProfileVerificationMetric(
        IEnumerable<LicensingProfileVerificationAssignmentRow> rows,
        DateTime now)
    {
        var totalAssigned = 0;
        var completed = 0;
        var overdue = 0;
        var completedWithTimestamp = 0;
        var onTimeCompleted = 0;
        var totalProcessingMinutes = 0d;

        foreach (var row in rows)
        {
            var slaDeadline = row.ProfileSlaStartedOn.AddDays(ProfileVerificationSlaDays);

            if (row.Status != ProfileReviewAssignmentStatuses.Cancelled)
            {
                totalAssigned++;
            }

            if (row.Status == ProfileReviewAssignmentStatuses.Completed)
            {
                completed++;
                if (row.CompletedAt.HasValue)
                {
                    completedWithTimestamp++;
                    totalProcessingMinutes += (row.CompletedAt.Value - row.AssignedAt).TotalMinutes;
                    if (row.CompletedAt.Value <= slaDeadline)
                    {
                        onTimeCompleted++;
                    }
                }
            }
            else if (row.Status == ProfileReviewAssignmentStatuses.Pending && now > slaDeadline)
            {
                overdue++;
            }
        }

        return new LicensingTeamManagementMemberMetricDto
        {
            TotalAssignedTasks = totalAssigned,
            CompletedTasks = completed,
            OverdueTasks = overdue,
            AvgProcessingTime = completedWithTimestamp == 0
                ? 0
                : Math.Round(totalProcessingMinutes / completedWithTimestamp, 2),
            SlaCompliance = completedWithTimestamp == 0
                ? 0
                : Math.Round((decimal)onTimeCompleted * 100m / completedWithTimestamp, 2)
        };
    }

    private Dictionary<string, LicensingTeamManagementMemberMetricDto> BuildMemberMetrics(List<LicensingTaskMetricContext> tasks, string userId, DateTime rangeStart, DateTime rangeEnd, bool applicationTaskOnly)
    {
        var metrics = new Dictionary<string, LicensingTeamManagementMemberMetricDto>(StringComparer.OrdinalIgnoreCase);
        var byMember = tasks.Where(x => string.Equals(x.AssignedToUserId, userId, StringComparison.OrdinalIgnoreCase)).ToList();

        foreach (var category in GetMemberCategorySequence(applicationTaskOnly))
        {
            var categoryTasks = string.Equals(category, LicensingTeamManagementConstants.CategoryAll, StringComparison.OrdinalIgnoreCase)
                ? byMember
                : byMember.Where(x => string.Equals(x.TaskCategory, category, StringComparison.OrdinalIgnoreCase)).ToList();
            metrics[category] = CalculateMetric(categoryTasks, rangeStart, rangeEnd);
        }

        return metrics;
    }

    private static LicensingTeamManagementMemberMetricDto CalculateMetric(List<LicensingTaskMetricContext> tasks, DateTime rangeStart, DateTime rangeEnd)
    {
        var periodTasks = tasks
            .GroupBy(x => x.GroupKey, StringComparer.OrdinalIgnoreCase)
            .Select(x => AggregateMetricContext(x.ToList()))
            .Where(x => x.AssignmentMoments.Any(moment => moment >= rangeStart && moment <= rangeEnd))
            .ToList();
        var completedTasks = periodTasks.Where(x => x.CountsAsCompleted).ToList();
        var completedCount = completedTasks.Count;
        var avgMinutes = completedCount == 0
            ? 0
            : Math.Round(completedTasks.Where(x => x.IncludeInAverage && x.ProcessingMinutes.HasValue).DefaultIfEmpty().Average(x => x?.ProcessingMinutes ?? 0), 2);
        var onTimeCompleted = completedTasks.Count(x => x.CompletedWithinSla);
        var overdueTasks = periodTasks.Count(x => x.IsOverdueActive);

        return new LicensingTeamManagementMemberMetricDto
        {
            CompletedTasks = completedCount,
            TotalAssignedTasks = periodTasks.Count,
            AvgProcessingTime = avgMinutes,
            SlaCompliance = completedCount == 0 ? 0 : Math.Round((decimal)onTimeCompleted * 100m / completedCount, 2),
            OverdueTasks = overdueTasks,
            ApprovedApplicationCount = periodTasks.Count(x => x.IsApprovedDecision),
            RejectedApplicationCount = periodTasks.Count(x => x.IsRejectedDecision)
        };
    }

    private static (bool IsApproved, bool IsRejected) ResolveDecisionFromApprovalRow(
        LicensingApprovalMetricRow? row)
    {
        if (row == null) return (false, false);
        if (row.WorkflowActionCode.HasValue)
        {
            return row.WorkflowActionCode.Value switch
            {
                101 or 102 or 104 or 105 or 106 or 107 or 202 => (false, true),
                1 or 3 or 4 or 5 or 6 or 201 => (true, false),
                _ => (false, false)
            };
        }
        var normalized = row.ApprovalAction?.Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return (false, false);
        if (normalized.Equals("Rejected", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("RejectedWithReview", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("Reject", StringComparison.OrdinalIgnoreCase))
            return (false, true);
        if (normalized.Equals("Approval", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("Approve", StringComparison.OrdinalIgnoreCase))
            return (true, false);
        return (false, false);
    }

    private static LicensingTaskMetricContext AggregateMetricContext(List<LicensingTaskMetricContext> contexts)
    {
        var first = contexts[0];
        var assignmentMoments = contexts
            .SelectMany(x => x.AssignmentMoments)
            .Distinct()
            .OrderBy(x => x)
            .ToList();
        var processingMinutes = contexts.Any(x => x.ProcessingMinutes.HasValue)
            ? contexts.Where(x => x.ProcessingMinutes.HasValue).Sum(x => x.ProcessingMinutes ?? 0)
            : (double?)null;
        var slaTargetMinutes = contexts
            .Where(x => x.SlaTargetMinutes.HasValue)
            .Select(x => x.SlaTargetMinutes)
            .DefaultIfEmpty(null)
            .Max();
        var countsAsCompleted = contexts.Any(x => x.CountsAsCompleted);
        var isActiveTodo = contexts.Any(x => x.IsActiveTodo);

        return new LicensingTaskMetricContext
        {
            GroupKey = first.GroupKey,
            AssignedToUserId = first.AssignedToUserId,
            TaskCategory = first.TaskCategory,
            AssignmentMoments = assignmentMoments,
            ProcessingMinutes = processingMinutes,
            CountsAsCompleted = countsAsCompleted,
            IncludeInAverage = countsAsCompleted && contexts.Any(x => x.IncludeInAverage),
            IsActiveTodo = isActiveTodo,
            SlaTargetMinutes = slaTargetMinutes,
            CompletedWithinSla = countsAsCompleted && (!slaTargetMinutes.HasValue || (processingMinutes ?? 0) <= slaTargetMinutes.Value),
            IsOverdueActive = isActiveTodo && slaTargetMinutes.HasValue && (processingMinutes ?? 0) > slaTargetMinutes.Value
        };
    }

    private List<LicensingTeamManagementCategoryCountDto> BuildCategoryCounts(List<AggregatedTaskItem> todoTasks, List<AggregatedTaskItem> completedTasks, bool applicationTaskOnly)
    {
        var categories = GetSummaryCategorySequence(applicationTaskOnly);

        return categories.Select(category => new LicensingTeamManagementCategoryCountDto
        {
            Category = category,
            CategoryDisplay = GetCategoryDisplay(category),
            TodoCount = todoTasks.Count(x => x.TaskCategory == category),
            CompletedCount = completedTasks.Count(x => x.TaskCategory == category)
        }).ToList();
    }

    private static IReadOnlyList<string> GetSummaryCategorySequence(bool applicationTaskOnly)
    {
        if (applicationTaskOnly)
        {
            return
            [
                LicensingTeamManagementConstants.CategoryApplications,
                LicensingTeamManagementConstants.CategoryProfileVerifications
            ];
        }

        return
        [
            LicensingTeamManagementConstants.CategoryApplications,
            LicensingTeamManagementConstants.CategoryProfileVerifications,
            LicensingTeamManagementConstants.CategoryEnquiries,
            LicensingTeamManagementConstants.CategoryRefunds,
            LicensingTeamManagementConstants.CategoryAppeals
        ];
    }

    private static IReadOnlyList<string> GetMemberCategorySequence(bool applicationTaskOnly)
    {
        if (applicationTaskOnly)
        {
            return
            [
                LicensingTeamManagementConstants.CategoryAll,
                LicensingTeamManagementConstants.CategoryApplications,
                LicensingTeamManagementConstants.CategoryProfileVerifications
            ];
        }

        return
        [
            LicensingTeamManagementConstants.CategoryAll,
            LicensingTeamManagementConstants.CategoryApplications,
            LicensingTeamManagementConstants.CategoryProfileVerifications,
            LicensingTeamManagementConstants.CategoryEnquiries,
            LicensingTeamManagementConstants.CategoryRefunds,
            LicensingTeamManagementConstants.CategoryAppeals
        ];
    }

    private static IReadOnlyList<string> GetFilterCategorySequence(bool applicationTaskOnly)
    {
        if (applicationTaskOnly)
        {
            return
            [
                LicensingTeamManagementConstants.CategoryAll,
                LicensingTeamManagementConstants.CategoryApplications,
                LicensingTeamManagementConstants.CategoryProfileVerifications
            ];
        }

        return
        [
            LicensingTeamManagementConstants.CategoryAll,
            LicensingTeamManagementConstants.CategoryApplications,
            LicensingTeamManagementConstants.CategoryProfileVerifications,
            LicensingTeamManagementConstants.CategoryEnquiries,
            LicensingTeamManagementConstants.CategoryRefunds,
            LicensingTeamManagementConstants.CategoryAppeals
        ];
    }

    private List<AggregatedTaskItem> ApplyTaskFilters(List<AggregatedTaskItem> tasks, LicensingTeamManagementTaskQueryRequest request)
    {
        IEnumerable<AggregatedTaskItem> filtered = tasks;

        if (!string.IsNullOrWhiteSpace(request.Keyword))
        {
            filtered = filtered.Where(x =>
                ContainsIgnoreCase(x.TaskNo, request.Keyword)
                || ContainsIgnoreCase(x.ApplyFor, request.Keyword)
                || ContainsIgnoreCase(x.AssignedToName, request.Keyword)
                || ContainsIgnoreCase(x.StatusText, request.Keyword));
        }

        if (!string.IsNullOrWhiteSpace(request.Category)
            && !string.Equals(request.Category, LicensingTeamManagementConstants.CategoryAll, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(request.Category, GetCategoryDisplay(LicensingTeamManagementConstants.CategoryAll), StringComparison.OrdinalIgnoreCase))
        {
            filtered = filtered.Where(x =>
                string.Equals(x.TaskCategory, request.Category, StringComparison.OrdinalIgnoreCase)
                || string.Equals(GetCategoryDisplay(x.TaskCategory), request.Category, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            filtered = filtered.Where(x =>
                string.Equals(BuildStatusFilterCode(x.StatusDomain, x.StatusCode), request.Status, StringComparison.OrdinalIgnoreCase)
                || string.Equals(x.StatusCode, request.Status, StringComparison.OrdinalIgnoreCase)
                || string.Equals(x.StatusText, request.Status, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(request.MemberId))
        {
            filtered = filtered.Where(x => string.Equals(x.AssignedToUserId, request.MemberId, StringComparison.OrdinalIgnoreCase));
        }

        if (request.LastUpdatedFrom.HasValue)
        {
            filtered = filtered.Where(x => x.LastUpdatedOn >= request.LastUpdatedFrom.Value);
        }

        if (request.LastUpdatedTo.HasValue)
        {
            var rangeEnd = request.LastUpdatedTo.Value.Date.AddDays(1).AddTicks(-1);
            filtered = filtered.Where(x => x.LastUpdatedOn <= rangeEnd);
        }

        if (request.StartDate.HasValue)
        {
            filtered = filtered.Where(x => x.TaskCreatedOn >= request.StartDate.Value);
        }

        if (request.EndDate.HasValue)
        {
            filtered = filtered.Where(x => x.TaskCreatedOn < request.EndDate.Value);
        }

        return filtered.ToList();
    }

    private List<AggregatedTaskItem> ApplyTaskSorting(List<AggregatedTaskItem> tasks, LicensingTeamManagementTaskQueryRequest request)
    {
        var sortBy = NormalizeText(request.SortBy) ?? "lastUpdatedOn";
        var descending = request.SortDirection == SortDirection.Descending;

        return sortBy.ToLowerInvariant() switch
        {
            "sla" => descending
                ? tasks.OrderByDescending(x => x.SlaRemainingMinutes ?? double.MinValue).ThenByDescending(x => x.LastUpdatedOn).ToList()
                : tasks.OrderBy(x => x.SlaRemainingMinutes ?? double.MaxValue).ThenByDescending(x => x.LastUpdatedOn).ToList(),
            "taskno" => descending
                ? tasks.OrderByDescending(x => x.TaskNo).ThenByDescending(x => x.LastUpdatedOn).ToList()
                : tasks.OrderBy(x => x.TaskNo).ThenByDescending(x => x.LastUpdatedOn).ToList(),
            "assignedto" => descending
                ? tasks.OrderByDescending(x => x.AssignedToName).ThenByDescending(x => x.LastUpdatedOn).ToList()
                : tasks.OrderBy(x => x.AssignedToName).ThenByDescending(x => x.LastUpdatedOn).ToList(),
            _ => descending
                ? tasks.OrderByDescending(x => x.LastUpdatedOn).ThenBy(x => x.TaskNo).ToList()
                : tasks.OrderBy(x => x.LastUpdatedOn).ThenBy(x => x.TaskNo).ToList()
        };
    }

    private LicensingTeamManagementTaskItemDto MapTaskDto(AggregatedTaskItem task)
    {
        return new LicensingTeamManagementTaskItemDto
        {
            SourceType = task.SourceType,
            SourceId = task.SourceId,
            TaskNo = task.TaskNo,
            TaskCategory = task.TaskCategory,
            TaskCategoryCode = task.TaskCategory,
            TaskCategoryDisplay = GetCategoryDisplay(task.TaskCategory),
            ApplyFor = task.ApplyFor,
            ApplyForIconType = task.ApplyForIconType,
            AssignedTo = task.AssignedToName,
            AssignedToUserId = task.AssignedToUserId,
            Status = task.StatusText,
            StatusCode = BuildStatusFilterCode(task.StatusDomain, task.StatusCode),
            StatusId = task.StatusCode,
            StatusDisplay = task.StatusText,
            LastUpdatedOn = task.LastUpdatedOn,
            IsUrgent = task.IsUrgent,
            CanReassign = task.CanReassign,
            DetailTarget = task.DetailTarget,
            Sla = new LicensingTeamManagementSlaDto
            {
                RemainingMinutes = task.SlaRemainingMinutes,
                DisplayText = task.SlaDisplayText,
                IsOverdue = task.SlaRemainingMinutes.HasValue && task.SlaRemainingMinutes.Value < 0,
                DueOn = task.SlaDueOn
            }
        };
    }

    private async Task<Dictionary<int, string>> LoadApplyForMapAsync(int[] profileIds)
    {
        var result = new Dictionary<int, string>();
        if (profileIds.Length == 0)
        {
            return result;
        }

        var profiles = await dbContext.UserProfiles.AsNoTracking().Where(x => profileIds.Contains(x.Id)).ToListAsync();
        var individualPersonIds = profiles.Where(x => x.UserTypeId == 1).Select(x => x.PersonId).Distinct().ToArray();
        var persons = individualPersonIds.Length == 0
            ? []
            : await dbContext.Persons.AsNoTracking().Where(x => individualPersonIds.Contains(x.Id)).ToListAsync();
        var establishmentProfiles = profiles.Where(x => x.UserTypeId != 1).Select(x => x.Id).ToArray();
        var userEstablishments = establishmentProfiles.Length == 0
            ? []
            : await dbContext.UserEstablishments.AsNoTracking().Where(x => establishmentProfiles.Contains(x.UserProfileId)).ToListAsync();
        var establishmentIds = userEstablishments.Select(x => x.EstablishmentId).Distinct().ToArray();
        var establishments = establishmentIds.Length == 0
            ? []
            : await dbContext.Establishments.AsNoTracking().Where(x => establishmentIds.Contains(x.Id)).ToListAsync();

        // Build lookups up front to avoid O(n*m) scans inside the loop.
        var personMap = persons.GroupBy(x => x.Id).ToDictionary(g => g.Key, g => g.First());
        var userEstablishmentByProfile = userEstablishments.ToLookup(x => x.UserProfileId);
        var establishmentMap = establishments.GroupBy(x => x.Id).ToDictionary(g => g.Key, g => g.First());

        foreach (var profile in profiles)
        {
            if (profile.UserTypeId == 1)
            {
                var person = personMap.GetValueOrDefault(profile.PersonId);
                result[profile.Id] = currentUserService.IsArabicLanguage
                    ? person?.NameAr ?? person?.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                    : person?.Name ?? person?.NameAr ?? profile.ProfileCode ?? profile.Id.ToString();
            }
            else
            {
                var establishmentId = userEstablishmentByProfile[profile.Id].FirstOrDefault()?.EstablishmentId;
                var establishment = establishmentId.HasValue ? establishmentMap.GetValueOrDefault(establishmentId.Value) : null;
                result[profile.Id] = currentUserService.IsArabicLanguage
                    ? establishment?.NameAr ?? establishment?.NameEn ?? profile.ProfileCode ?? profile.Id.ToString()
                    : establishment?.NameEn ?? establishment?.NameAr ?? profile.ProfileCode ?? profile.Id.ToString();
            }
        }

        return result;
    }

    private async Task<Dictionary<int, string>> LoadApplyForIconTypeMapAsync(int[] profileIds)
    {
        if (profileIds.Length == 0) return new Dictionary<int, string>();
        var profiles = await dbContext.UserProfiles.AsNoTracking()
            .Where(x => profileIds.Contains(x.Id))
            .Select(x => new { x.Id, x.UserTypeId })
            .ToListAsync();
        return profiles.ToDictionary(x => x.Id, x => x.UserTypeId == 1 ? "personal" : "enterprise");
    }

    private async Task<Dictionary<int, string>> LoadProfileNameMapAsync(int[] profileIds)
    {
        return await LoadApplyForMapAsync(profileIds);
    }

    private async Task<string?> ResolveWorkflowStatusNameAsync(int? statusId)
    {
        if (!statusId.HasValue)
        {
            return null;
        }

        var status = await typeDictionaryService.GetByCodeAsync("ApprovalNodeOrder", statusId.Value.ToString());
        if (status == null)
        {
            return statusId.Value.ToString();
        }

        return currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(status.NameAr)
            ? status.NameAr
            : status.NameEn ?? status.Code;
    }

    // Load the ApprovalNodeOrder dictionary once into a code -> display name map for batch resolution (replaces per-row await).
    private async Task<Dictionary<string, string?>> BuildWorkflowStatusNameMapAsync()
    {
        return (await typeDictionaryService.GetListAsync("ApprovalNodeOrder"))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .GroupBy(x => x.Code!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var status = g.First();
                    return (string?)(currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(status.NameAr)
                        ? status.NameAr
                        : status.NameEn ?? status.Code);
                },
                StringComparer.OrdinalIgnoreCase);
    }

    private static string? ResolveWorkflowStatusName(Dictionary<string, string?> statusNameMap, int? statusId)
    {
        if (!statusId.HasValue)
        {
            return null;
        }

        var key = statusId.Value.ToString();
        return statusNameMap.TryGetValue(key, out var name) ? name : key;
    }

    private async Task<List<LicensingTeamManagementStatusOptionDto>> BuildWorkflowStatusOptionsAsync()
    {
        var serviceIds = await dbContext.ServiceConfigs
            .AsNoTracking()
            .Where(x => x.Department == LicensingDepartmentId)
            .Select(x => x.Id)
            .Distinct()
            .ToListAsync();
        if (serviceIds.Count == 0)
        {
            return await BuildFallbackWorkflowStatusOptionsAsync();
        }

        // EF Core cannot translate "first row per group via ordering" inside a GroupBy projection.
        // Materialize the candidate configs first, then pick the latest/published one per service in memory.
        var workflowConfigurations = await dbContext.WorkflowConfigurations
            .AsNoTracking()
            .Where(x => serviceIds.Contains(x.ServiceId))
            .Select(x => new { x.Id, x.ServiceId, x.Status, x.CreatedOn })
            .ToListAsync();
        var workflowConfigurationIds = workflowConfigurations
            .GroupBy(x => x.ServiceId)
            .Select(group => group
                .OrderByDescending(x => x.Status == "5") // "5" = Published; literal "Published" never matched the numeric status code
                .ThenByDescending(x => x.CreatedOn ?? DateTime.MinValue)
                .ThenByDescending(x => x.Id)
                .Select(x => x.Id)
                .First())
            .ToList();
        if (workflowConfigurationIds.Count == 0)
        {
            return await BuildFallbackWorkflowStatusOptionsAsync();
        }

        var configuredNodeOrders = await dbContext.WorkflowNodes
            .AsNoTracking()
            .Where(x => workflowConfigurationIds.Contains(x.WorkflowConfigurationId)
                        && x.NodeType == "userTask"
                        && x.ApprovalDepartment == LicensingDepartmentId
                        && x.NodeOrder >= (int)ApprovalNodeOrder.InitialApproval
                        && x.NodeOrder <= (int)ApprovalNodeOrder.FinalApproval)
            .Select(x => x.NodeOrder)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();

        var statuses = new List<LicensingTeamManagementStatusOptionDto>();
        foreach (var nodeOrder in configuredNodeOrders)
        {
            var label = await ResolveWorkflowStatusNameAsync(nodeOrder);
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            statuses.Add(new LicensingTeamManagementStatusOptionDto
            {
                Code = label,
                Display = label
            });
        }

        foreach (var statusId in new[] { (int)ApprovalNodeOrder.ExternalApproval, (int)ApprovalNodeOrder.PendingModification, (int)ApprovalNodeOrder.FinalApproval })
        {
            var label = await ResolveWorkflowStatusNameAsync(statusId);
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            statuses.Add(new LicensingTeamManagementStatusOptionDto
            {
                Code = label,
                Display = label
            });
        }

        return statuses.Count == 0 ? await BuildFallbackWorkflowStatusOptionsAsync() : statuses;
    }

    private async Task<List<LicensingTeamManagementStatusOptionDto>> BuildFallbackWorkflowStatusOptionsAsync()
    {
        var fallbackStatusIds = new[]
        {
            (int)ApprovalNodeOrder.InitialApproval,
            (int)ApprovalNodeOrder.FinalApproval,
            (int)ApprovalNodeOrder.ExternalApproval,
            (int)ApprovalNodeOrder.PendingModification
        };
        var statuses = new List<LicensingTeamManagementStatusOptionDto>();
        foreach (var statusId in fallbackStatusIds)
        {
            var label = await ResolveWorkflowStatusNameAsync(statusId);
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            statuses.Add(new LicensingTeamManagementStatusOptionDto
            {
                Code = label,
                Display = label
            });
        }

        return statuses;
    }

    private async Task<StatusOptionGroups> BuildTypeDictionaryStatusOptionGroupsAsync(
        string scope,
        IReadOnlySet<short> completedStatusIds,
        IReadOnlySet<short>? todoExcludedStatusIds = null)
    {
        var options = (await typeDictionaryService.GetListAsync(scope))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .Select(x =>
            {
                var isParsed = short.TryParse(x.Code, out var statusId);
                var displayText = currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!;
                return new
                {
                    IsCompleted = isParsed && completedStatusIds.Contains(statusId),
                    IsTodoExcluded = isParsed && (todoExcludedStatusIds?.Contains(statusId) ?? false),
                    Option = new LicensingTeamManagementStatusOptionDto
                    {
                        Code = displayText,
                        Display = displayText
                    }
                };
            })
            .ToList();

        return new StatusOptionGroups(
            options.Select(x => x.Option).ToList(),
            options.Where(x => !x.IsTodoExcluded).Select(x => x.Option).ToList(),
            options.Where(x => x.IsCompleted).Select(x => x.Option).ToList());
    }

    private StatusOptionGroups BuildAppealStatusOptionGroups()
    {
        var options = new[]
            {
                (int)InspectionAppealStatus.Pending,
                (int)InspectionAppealStatus.DepartmentProcessing,
                (int)InspectionAppealStatus.DepartmentProcessed,
                (int)InspectionAppealStatus.PendingCustomer,
                (int)InspectionAppealStatus.Approved,
                (int)InspectionAppealStatus.Rejected,
                (int)InspectionAppealStatus.Cancelled,
                (int)InspectionAppealStatus.Resolved
            }
            .Select(statusId => new
            {
                StatusId = statusId,
                Option = new LicensingTeamManagementStatusOptionDto
                {
                    Code = GetAppealStatusDisplay(statusId),
                    Display = GetAppealStatusDisplay(statusId)
                }
            }).ToList();

        return new StatusOptionGroups(
            options.Select(x => x.Option).ToList(),
            options.Where(x => !AppealMetadataTodoExcludedStatuses.Contains(x.StatusId)).Select(x => x.Option).ToList(),
            options.Where(x => AppealMetadataCompletedStatuses.Contains(x.StatusId)).Select(x => x.Option).ToList());
    }

    private async Task<List<LicensingTeamManagementStatusOptionDto>> LoadLeaveReasonOptionsAsync()
    {
        return (await typeDictionaryService.GetListAsync("LeaveTypes"))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .Select(x => new LicensingTeamManagementStatusOptionDto
            {
                Code = currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!,
                Display = currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!
            }).ToList();
    }

    private async Task<Dictionary<string, string>> LoadLeaveReasonDisplayMapAsync()
    {
        return (await typeDictionaryService.GetListAsync("LeaveTypes"))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .GroupBy(x => x.Code!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                x => x.Key,
                x =>
                {
                    var first = x.First();
                    return currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(first.NameAr)
                        ? first.NameAr!
                        : first.NameEn ?? first.Code!;
                },
                StringComparer.OrdinalIgnoreCase);
    }

    private async Task<string?> NormalizeLeaveReasonCodeAsync(string? input)
    {
        var value = NormalizeText(input);
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var rows = await typeDictionaryService.GetListAsync("LeaveTypes");
        var matched = rows.FirstOrDefault(x =>
            string.Equals(x.Code, value, StringComparison.OrdinalIgnoreCase)
            || string.Equals(x.NameEn, value, StringComparison.OrdinalIgnoreCase)
            || string.Equals(x.NameAr, value, StringComparison.OrdinalIgnoreCase));

        return matched?.Code ?? value;
    }

    private async Task<List<DepartmentLeaderTarget>> LoadDepartmentLeaderTargetsAsync()
    {
        var rows = await (from ud in dbContext.UserDepartments.AsNoTracking()
                          join user in dbContext.AdminUsers.AsNoTracking() on ud.UserId equals user.Id
                          join profile in dbContext.UserProfiles.AsNoTracking() on user.Id equals profile.UserId into profileJoin
                          from profile in profileJoin.DefaultIfEmpty()
                          where ud.DepartmentId == LicensingDepartmentId && ud.IsLeader == true && user.IsActive
                          select new
                          {
                              user.Id,
                              user.FirstName,
                              user.LastName,
                              user.UserName,
                              ProfileId = profile == null ? 0 : profile.Id
                          }).ToListAsync();

        return rows.Select(x => new DepartmentLeaderTarget
        {
            UserId = x.Id,
            UserName = BuildUserName(x.FirstName, x.LastName, x.UserName),
            ProfileId = x.ProfileId
        }).ToList();
    }

    private async Task<Department?> GetLicensingDepartmentAsync()
    {
        return await dbContext.Departments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == LicensingDepartmentId);
    }

    private LicensingTeamManagementLeaveInfoDto? BuildLeaveInfo(TeamMemberDutyStatusRecord? record, Dictionary<string, string> leaveReasonMap)
    {
        if (!IsOnLeave(record))
        {
            return null;
        }

        return new LicensingTeamManagementLeaveInfoDto
        {
            LeaveReasonCode = record!.LeaveReasonCode,
            LeaveReasonDisplay = ResolveOptionDisplay(leaveReasonMap, record.LeaveReasonCode),
            Notes = record.Notes,
            ExpectedReturnDate = record.ExpectedReturnDate,
            EffectiveFrom = record.EffectiveFrom
        };
    }

    private static bool IsOnLeave(TeamMemberDutyStatusRecord? record)
        => record != null && string.Equals(record.StatusType, LicensingTeamManagementConstants.DutyStatusEmergencyLeave, StringComparison.OrdinalIgnoreCase);

    private static bool IsTodoView(AggregatedTaskItem task)
        => task.CompletedOn == null;

    private string GetCategoryDisplay(string categoryCode)
        => categoryCode switch
        {
            LicensingTeamManagementConstants.CategoryAll => currentUserService.IsArabicLanguage ? "الكل" : "All",
            LicensingTeamManagementConstants.CategoryApplications => currentUserService.IsArabicLanguage ? "طلبات الخدمة" : "Applications",
            LicensingTeamManagementConstants.CategoryProfileVerifications => currentUserService.IsArabicLanguage ? "التحقق من الملف الشخصي" : "Profile Verifications",
            LicensingTeamManagementConstants.CategoryEnquiries => currentUserService.IsArabicLanguage ? "الاستفسارات والشكاوى" : "Enquiries & Complaints",
            LicensingTeamManagementConstants.CategoryRefunds => currentUserService.IsArabicLanguage ? "الاستردادات" : "Refunds",
            LicensingTeamManagementConstants.CategoryAppeals => currentUserService.IsArabicLanguage ? "الطعون" : "Appeals",
            _ => categoryCode
        };

    private string GetAppealStatusDisplay(int statusId)
        => statusId switch
        {
            (int)InspectionAppealStatus.Pending => currentUserService.IsArabicLanguage ? "قيد الانتظار" : "Pending",
            (int)InspectionAppealStatus.DepartmentProcessing => currentUserService.IsArabicLanguage ? "قيد المعالجة لدى الإدارة" : "Department Processing",
            (int)InspectionAppealStatus.DepartmentProcessed => currentUserService.IsArabicLanguage ? "تمت المعالجة لدى الإدارة" : "Department Processed",
            (int)InspectionAppealStatus.PendingCustomer => currentUserService.IsArabicLanguage ? "بانتظار المتعامل" : "Pending Customer",
            (int)InspectionAppealStatus.Approved => currentUserService.IsArabicLanguage ? "معتمد" : "Approved",
            (int)InspectionAppealStatus.Rejected => currentUserService.IsArabicLanguage ? "مرفوض" : "Rejected",
            (int)InspectionAppealStatus.Cancelled => currentUserService.IsArabicLanguage ? "ملغي" : "Cancelled",
            (int)InspectionAppealStatus.Resolved => currentUserService.IsArabicLanguage ? "تم الحل" : "Resolved",
            _ => statusId.ToString()
        };

    private static bool IsProfileVerification(ServiceConfig? service)
    {
        var name = service?.NameEn ?? string.Empty;
        var code = service?.Code ?? string.Empty;
        return ContainsIgnoreCase(name, "profile") || ContainsIgnoreCase(code, "profile");
    }

    private static bool DepartmentMatches(Department? department, string? code, string? name)
    {
        return department != null
               && ((!string.IsNullOrWhiteSpace(code) && string.Equals(code.Trim(), department.Code, StringComparison.OrdinalIgnoreCase))
                   || (!string.IsNullOrWhiteSpace(name) && string.Equals(name.Trim(), department.NameEn, StringComparison.OrdinalIgnoreCase)));
    }

    private static string EscapeCsv(string? value)
    {
        var safe = value ?? string.Empty;
        if (safe.Contains(',') || safe.Contains('"') || safe.Contains('\n') || safe.Contains('\r'))
        {
            return $"\"{safe.Replace("\"", "\"\"")}\"";
        }

        return safe;
    }

    private static bool ContainsIgnoreCase(string? value, string? keyword)
        => !string.IsNullOrWhiteSpace(value)
           && !string.IsNullOrWhiteSpace(keyword)
           && value.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) >= 0;

    private static string BuildTaskKey(string sourceType, string sourceId)
        => $"{sourceType}::{sourceId}";

    private static string BuildUserName(string? firstName, string? lastName, string? fallback)
    {
        var fullName = $"{firstName} {lastName}".Trim();
        return string.IsNullOrWhiteSpace(fullName) ? fallback ?? string.Empty : fullName;
    }

    private static string? NormalizeText(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private string? NormalizeTaskCategory(string? category)
    {
        var value = NormalizeText(category);
        if (value == null)
        {
            return null;
        }

        return GetFilterCategorySequence(applicationTaskOnly: false)
            .FirstOrDefault(code =>
                string.Equals(code, value, StringComparison.OrdinalIgnoreCase)
                || string.Equals(GetCategoryDisplay(code), value, StringComparison.OrdinalIgnoreCase))
            ?? value;
    }

    private static string BuildStatusFilterCode(string? statusDomain, string? rawStatusCode)
    {
        var domain = string.IsNullOrWhiteSpace(statusDomain) ? "status" : statusDomain.Trim();
        return string.IsNullOrWhiteSpace(rawStatusCode) ? domain : $"{domain}:{rawStatusCode}";
    }

    private static string? ResolveOptionDisplay(Dictionary<string, string> displayMap, string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        return displayMap.TryGetValue(code, out var display) ? display : code;
    }

    private static string BuildReviewLink(string adminPortalUrl, AggregatedTaskItem task)
    {
        var root = (adminPortalUrl ?? string.Empty).TrimEnd('/');
        if (string.IsNullOrWhiteSpace(root))
        {
            return task.DetailTarget ?? string.Empty;
        }

        return string.IsNullOrWhiteSpace(task.DetailTarget) ? root : $"{root}/{task.DetailTarget.TrimStart('/')}";
    }

    private static string BuildMetricGroupKey(string sourceType, string sourceId, string ownerId)
        => $"{sourceType}::{sourceId}::{ownerId}";

    private static double? BuildSlaTargetMinutes(DateTime? dueOn, DateTime createdOn)
    {
        return dueOn.HasValue ? Math.Max((dueOn.Value - createdOn).TotalMinutes, 0) : (double?)null;
    }

    private static DateTime ResolveEnquiryAssignedOn(IEnumerable<EnquiryStatusTracking> enquiryTrackingRows, string ownerId, DateTime? beforeOn, DateTime fallback)
    {
        var candidates = enquiryTrackingRows
            .Where(x => x.DepartmentId == (short)DepartmentEnum.Licensing
                        && x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing);
        if (beforeOn.HasValue)
        {
            candidates = candidates.Where(x => x.CreatedOn <= beforeOn.Value);
        }

        return candidates.OrderByDescending(x => x.CreatedOn).Select(x => x.CreatedOn).FirstOrDefault(fallback);
    }

    private static DateTime ResolveRefundAssignedOn(IEnumerable<RefundStatusTracking> refundTrackingRows, string ownerId, DateTime? beforeOn, DateTime fallback)
    {
        var candidates = refundTrackingRows
            .Where(x => string.Equals(x.CreatedBy, ownerId, StringComparison.OrdinalIgnoreCase));
        if (beforeOn.HasValue)
        {
            candidates = candidates.Where(x => x.CreatedOn <= beforeOn.Value);
        }

        return candidates.OrderByDescending(x => x.CreatedOn).Select(x => x.CreatedOn).FirstOrDefault(fallback);
    }

    private static DateTime ResolveAppealAssignedOn(IEnumerable<InspectionAppealTimelineEvent> appealTimelineEvents, Department department, string ownerId, DateTime? beforeOn, DateTime fallback)
    {
        var candidates = appealTimelineEvents
            .Where(x => string.Equals(x.TargetHandlerUserId, ownerId, StringComparison.OrdinalIgnoreCase)
                        && DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName));
        if (beforeOn.HasValue)
        {
            candidates = candidates.Where(x => x.CreatedOn <= beforeOn.Value);
        }

        return candidates.OrderByDescending(x => x.CreatedOn).Select(x => x.CreatedOn).FirstOrDefault(fallback);
    }

    private sealed class AggregatedTaskItem
    {
        public string SourceType { get; set; } = string.Empty;
        public string SourceId { get; set; } = string.Empty;
        public string? TaskNo { get; set; }
        public string TaskCategory { get; set; } = string.Empty;
        public string? ApplyFor { get; set; }
        public string? ApplyForIconType { get; set; }
        public string? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }
        public string? ApprovalRole { get; set; }
        public string StatusDomain { get; set; } = string.Empty;
        public string? StatusCode { get; set; }
        public string? StatusText { get; set; }
        public DateTime LastUpdatedOn { get; set; }
        public DateTime TaskCreatedOn { get; set; }
        public DateTime? CompletedOn { get; set; }
        public DateTime? SlaDueOn { get; set; }
        public double? SlaRemainingMinutes { get; set; }
        public string SlaDisplayText { get; set; } = "-";
        public bool IsUrgent { get; set; }
        public bool CanReassign { get; set; }
        public string? DetailTarget { get; set; }
    }

    private sealed class LicensingTaskMetricContext
    {
        public string GroupKey { get; set; } = string.Empty;
        public string? AssignedToUserId { get; set; }
        public string TaskCategory { get; set; } = string.Empty;
        public List<DateTime> AssignmentMoments { get; set; } = [];
        public double? ProcessingMinutes { get; set; }
        public bool CountsAsCompleted { get; set; }
        public bool IncludeInAverage { get; set; }
        public bool IsActiveTodo { get; set; }
        public double? SlaTargetMinutes { get; set; }
        public bool CompletedWithinSla { get; set; }
        public bool IsOverdueActive { get; set; }
        public bool IsApprovedDecision { get; set; }
        public bool IsRejectedDecision { get; set; }
    }

    private sealed class AssignmentCandidate
    {
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public int TodoCount { get; set; }
        public HashSet<string> RoleIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    private sealed record StatusOptionGroups(
        List<LicensingTeamManagementStatusOptionDto> All,
        List<LicensingTeamManagementStatusOptionDto> Todo,
        List<LicensingTeamManagementStatusOptionDto> Completed);

    private sealed class DepartmentMemberContext
    {
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsActive { get; set; }
        public bool IsLeader { get; set; }
        public HashSet<string> RoleIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class DepartmentLeaderTarget
    {
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public int ProfileId { get; set; }
    }
}

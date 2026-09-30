using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UMC.AdminPortal.Application.Dtos;
using UMC.AdminPortal.Application.Dtos.LicenseDashboard;
using UMC.AdminPortal.Application.Dtos.TeamManagement;
using UMC.AdminPortal.Application.Services.CamundaTaskApp;
using UMC.AdminPortal.Application.Services.EnquiryApp;
using UMC.AdminPortal.Application.Services.SendTemplate;
using UMC.AdminPortal.Application.Services.TeamManagement;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.ReadModelSync;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.RestSharpClient;

namespace UMC.AdminPortal.Application.Services.ContentTeamManagement;

public interface IContentTeamManagementAppService
{
    Task<TeamManagementSummaryDto> GetSummaryAsync(bool? applicationTaskOnly = null);
    Task<TeamManagementSummaryDto> GetSummaryV2Async(bool? applicationTaskOnly = null);
    Task<TeamManagementMetadataDto> GetMetadataAsync(bool? applicationTaskOnly = null);
    Task<TeamManagementTaskQueryResponse> QueryTasksAsync(TeamManagementTaskQueryRequest request);
    Task<TeamManagementTaskQueryResponse> QueryTasksV2Async(TeamManagementTaskQueryRequest request);
    Task<byte[]> ExportTasksAsync(TeamManagementTaskQueryRequest request);
    Task<byte[]> ExportTasksV2Async(TeamManagementTaskQueryRequest request);
    Task<TeamManagementReassignResponse> ReassignTasksAsync(TeamManagementReassignRequest request);
    Task<TeamManagementReassignResponse> ReassignTasksV2Async(TeamManagementReassignRequest request);
    Task<TeamManagementMembersResponse> GetMembersAsync(string? memberId, DateTime? startDate, DateTime? endDate, bool? applicationTaskOnly = null);
    Task<TeamManagementMembersResponse> GetMembersOptimizedAsync(string? memberId, DateTime? startDate, DateTime? endDate, bool? applicationTaskOnly = null, CancellationToken cancellationToken = default);
    Task<List<TeamManagementMemberOptionDto>> GetReassignmentMembersAsync();
    Task<List<TeamManagementMemberOptionDto>> GetReassignmentMembersAsync(TeamManagementReassignmentMembersRequest request);
    Task<TeamManagementDutyStatusActionResponse> MarkEmergencyLeaveAsync(string userId, TeamManagementEmergencyLeaveRequest request);
    Task<TeamManagementDutyStatusActionResponse> ResumeWorkAsync(string userId);
    Task<TeamManagementUrgentTaskAlertRunResponse> RunUrgentTaskAlertsAsync();
}

[InjectOnScoped]
public class ContentTeamManagementAppService(
    AdminPortalDBContext dbContext,
    ICurrentUserService currentUserService,
    ITypeDictionaryService typeDictionaryService,
    RestSharpClient restSharpClient,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ICamundaTaskAppService camundaTaskAppService,
    IEnquiryAppService enquiryAppService,
    ISendTemplateService sendTemplateService,
    IContentTeamTaskReadSyncProcessor readSyncProcessor,
    ITaskReassignmentNotificationService reassignmentNotificationService,
    ILogger<ContentTeamManagementAppService> logger)
    : DepartmentTeamManagementAppServiceBase(dbContext, currentUserService, typeDictionaryService, restSharpClient, configuration, unitOfWork, sendTemplateService),
        IContentTeamManagementAppService
{
    /// <summary>
    /// OPS-04 read-source switch for the Content team read path. Values (case-insensitive):
    ///   "table"  -> read ReadModel.ContentTeamTaskRead (the materialized read model, the optimized path);
    ///   "views"  -> read the two computed views (the safe pre-Req189 behaviour);
    ///   "legacy" -> run the live 4-source UNION (BuildLegacy), the ultimate rollback.
    /// Every caller resolves the source the same way — department and role play no part — so all
    /// users read the same rows from the same object.
    /// </summary>
    private const string Req189ContentReadSourceFeature = "Features:Req189ContentReadSource";

    /// <summary>
    /// The incremental sync kill switch (also read by AdminPotalAppModule to decide whether the
    /// DirtyQueue worker and the nightly rebuild are hosted at all). It participates in the read-source
    /// decision as a SAFETY INTERLOCK: nobody maintains ReadModel.ContentTeamTaskRead while this is
    /// false, so an unset read source must not silently serve that stale/empty table.
    /// </summary>
    private const string Req189TeamReadSyncEnabledFeature = "Features:Req189TeamReadSyncEnabled";
    private const string ReadSourceTable = "table";
    private const string ReadSourceViews = "views";
    private const string ReadSourceLegacy = "legacy";
    private const string WorkflowStatusDomain = "applicationWorkflow";
    private const string DispositionStatusDomain = "applicationDisposition";
    private const string SuperAdminUserId = "SuperAdminUser";

    /// <summary>
    /// Handler type that marks the Content owner of a violation. The violation projection
    /// (ContentTeamManagementTaskQuery.BuildViolationRows) resolves the assignee from exactly the
    /// handlers carrying this type, so a reassign has to write the same marker or the list keeps
    /// showing the previous owner. Inspection handlers on the same violation carry a different
    /// type (NULL / "Committee") and must never be touched from here.
    /// </summary>
    private const string ContentTeamHandlerType = "Content Team";
    private static readonly HashSet<int> ApplicationNonReassignableStatuses =
    [
        (int)ApprovalNodeOrder.ExternalApproval,
        (int)ApprovalNodeOrder.PendingModification
    ];

    internal static bool ShouldHideApplicationSla(
        string? sourceType,
        string? statusFilterCode,
        string? statusCode)
    {
        if (!string.Equals(sourceType, TeamManagementConstants.SourceApplication, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var isExternalApproval = string.Equals(
                                     statusFilterCode,
                                     WorkflowStatusDomain + ":" + (int)ApprovalNodeOrder.ExternalApproval,
                                     StringComparison.OrdinalIgnoreCase)
                                 || string.Equals(
                                     statusCode,
                                     ((int)ApprovalNodeOrder.ExternalApproval).ToString(),
                                     StringComparison.OrdinalIgnoreCase);
        var isPendingModification = string.Equals(
            statusCode,
            ((int)ApprovalNodeOrder.PendingModification).ToString(),
            StringComparison.OrdinalIgnoreCase);

        return isExternalApproval || isPendingModification;
    }

    internal static (bool Include, bool CountsAsCompleted, bool IsActiveTodo) ClassifyOptimizedApplicationMetric(
        int? taskStatusId,
        int? processStatusId,
        DateTime? approvalAt)
    {
        var isRequestModificationDecision = taskStatusId == (int)ApprovalNodeOrder.PendingModification;
        var isPendingModificationWorkflowTask = processStatusId == (int)ApprovalNodeOrder.PendingModification
                                                && !isRequestModificationDecision
                                                && !approvalAt.HasValue;

        if (isPendingModificationWorkflowTask)
        {
            return (false, false, false);
        }

        var countsAsCompleted = approvalAt.HasValue && !isRequestModificationDecision;
        return (true, countsAsCompleted, !approvalAt.HasValue);
    }

    /// <summary>
    /// Fail-closed reassign gate for application (Camunda) tasks. The team task list shows the
    /// process-instance status, while the task row can still sit on an earlier approval node, so
    /// a task-first check alone leaves Reassign enabled for a Pending Modification / External
    /// Approval application. Reject the task when either status source is parked.
    /// </summary>
    private static bool CanReassignApplicationTask(DateTime? completedOn, int? taskStatusId, int? processStatusId)
    {
        if (completedOn.HasValue || !(taskStatusId ?? processStatusId).HasValue)
        {
            return false;
        }

        return !(taskStatusId.HasValue && ApplicationNonReassignableStatuses.Contains(taskStatusId.Value))
               && !(processStatusId.HasValue && ApplicationNonReassignableStatuses.Contains(processStatusId.Value));
    }

    private static readonly HashSet<int?> ActiveDispositionStatuses =
    [
        (int)DispositionVerificationStatus.PendingDisposition,
        (int)DispositionVerificationStatus.DispositionVerification
    ];

    private static readonly HashSet<int?> CompletedDispositionStatuses =
    [
        (int)DispositionVerificationStatus.Verified,
        (int)DispositionVerificationStatus.NotVerified
    ];

    protected override int DepartmentId => (int)DepartmentEnum.Content;
    protected override string ModuleName => "Content";
    protected override bool SupportsApplicationTaskOnly => true;
    protected override bool DefaultApplicationTaskOnly => true;

    public async Task<List<TeamManagementMemberOptionDto>> GetReassignmentMembersAsync()
        => await GetReassignmentMembersAsync(new TeamManagementReassignmentMembersRequest());

    public async Task<List<TeamManagementMemberOptionDto>> GetReassignmentMembersAsync(TeamManagementReassignmentMembersRequest request)
    {
        // The built-in super-admin account is not a real team member, so it never shows up as a
        // reassign target. Filtered here at the load point rather than per category, so every
        // branch below -- the plain dropdown and the task-filtered pool alike -- inherits it.
        var members = (await LoadDepartmentMembersAsync())
            .Where(x => !string.Equals(x.UserId, SuperAdminUserId, StringComparison.OrdinalIgnoreCase))
            .ToList();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(members.Select(x => x.UserId).ToArray());
        var availableMembers = members
            .Where(x => x.IsActive && x.Status != "-1")
            .Where(x => !dutyMap.TryGetValue(x.UserId, out var dutyStatus) || !IsOnLeave(dutyStatus))
            .ToList();

        var tasks = request.Tasks ?? [];
        if (tasks.Count > 0)
        {
            var targetLookup = await LoadRequestedReassignTargetsOptimizedAsync(tasks);
            var targets = new List<TeamTaskContext>(tasks.Count);
            foreach (var task in tasks)
            {
                if (!targetLookup.TryGetValue(BuildTaskKey(task.SourceType, task.SourceId), out var target))
                {
                    return [];
                }

                targets.Add(target);
            }

            await EnrichApplicationApprovalRolesAsync(targets);
            availableMembers = await FilterMembersByReassignTargetsAsync(availableMembers, targets);
        }

        return availableMembers
            .Select(member => new TeamManagementMemberOptionDto
            {
                UserId = member.UserId,
                UserName = member.UserName
            })
            .OrderBy(member => member.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(member => member.UserId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    protected override IReadOnlyList<string> GetCategorySequence(bool applicationTaskOnly)
    {
        if (applicationTaskOnly)
        {
            return
            [
                TeamManagementConstants.CategoryAll,
                TeamManagementConstants.CategoryApplications
            ];
        }

        return
        [
            TeamManagementConstants.CategoryAll,
            TeamManagementConstants.CategoryApplications,
            TeamManagementConstants.CategoryEnquiries,
            TeamManagementConstants.CategoryRefunds,
            TeamManagementConstants.CategoryAppeals,
            TeamManagementConstants.CategoryViolations
        ];
    }

    public new async Task<TeamManagementMetadataDto> GetMetadataAsync(bool? applicationTaskOnly = null)
    {
        var metadata = await base.GetMetadataAsync(applicationTaskOnly);
        var resolvedApplicationTaskOnly = applicationTaskOnly ?? DefaultApplicationTaskOnly;
        metadata.TodoStatuses = await BuildContentTaskQueryTodoStatusOptionsAsync(resolvedApplicationTaskOnly);
        metadata.CompletedStatuses = await BuildContentTaskQueryCompletedStatusOptionsAsync(resolvedApplicationTaskOnly);

        return metadata;
    }

    public async Task<TeamManagementSummaryDto> GetSummaryV2Async(bool? applicationTaskOnly = null)
    {
        var resolvedApplicationTaskOnly = applicationTaskOnly ?? DefaultApplicationTaskOnly;
        var department = resolvedApplicationTaskOnly ? null : await LoadDepartmentAsync();
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);

        var countRows = await ContentTeamManagementSummaryQuery.BuildCountRowsAsync(
            DbContext,
            resolvedApplicationTaskOnly,
            department?.Code,
            department?.NameEn);
        var urgentRows = await ContentTeamManagementSummaryQuery.BuildUrgentCountRowsAsync(
            DbContext,
            resolvedApplicationTaskOnly,
            urgentDueBefore,
            department?.Code,
            department?.NameEn);
        var todoCount = countRows.Where(row => !row.IsCompleted).Sum(row => row.Count);
        var completedCount = countRows.Where(row => row.IsCompleted).Sum(row => row.Count);
        var countByCategory = countRows
            .GroupBy(row => row.Category, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => new
                {
                    TodoCount = group.Where(row => !row.IsCompleted).Sum(row => row.Count),
                    CompletedCount = group.Where(row => row.IsCompleted).Sum(row => row.Count)
                },
                StringComparer.OrdinalIgnoreCase);

        return new TeamManagementSummaryDto
        {
            TodoCount = todoCount,
            CompletedCount = completedCount,
            UrgentCount = urgentRows.Sum(row => row.Count),
            Categories = GetCategorySequence(resolvedApplicationTaskOnly)
                .Select(category => new TeamManagementCategoryCountDto
                {
                    Category = category,
                    CategoryDisplay = GetCategoryDisplay(category),
                    TodoCount = string.Equals(category, TeamManagementConstants.CategoryAll, StringComparison.OrdinalIgnoreCase)
                        ? todoCount
                        : countByCategory.GetValueOrDefault(category)?.TodoCount ?? 0,
                    CompletedCount = string.Equals(category, TeamManagementConstants.CategoryAll, StringComparison.OrdinalIgnoreCase)
                        ? completedCount
                        : countByCategory.GetValueOrDefault(category)?.CompletedCount ?? 0
                })
                .ToList()
        };
    }

    protected override async Task<List<TeamTaskContext>> LoadTasksAsync(string view, bool applicationTaskOnly)
    {
        var tasks = new List<TeamTaskContext>();
        tasks.AddRange(await LoadApplicationTasksAsync(view));
        if (!applicationTaskOnly)
        {
            tasks.AddRange(await LoadEnquiryTasksAsync(view));
            tasks.AddRange(await LoadRefundTasksAsync(view));
            tasks.AddRange(await LoadAppealTasksAsync(view));
        }

        return tasks;
    }

    /// <summary>
    /// OPS-04 gate. Resolves which Content team read path serves a query. Two switches, one decision:
    ///
    ///   Features:Req189ContentReadSource     "table" | "views" | "legacy" | (unset)
    ///   Features:Req189TeamReadSyncEnabled   true | false
    ///
    /// Explicit Req189ContentReadSource always wins — that is the one-line rollback / one-line
    /// enable, no redeploy needed. When it is UNSET the read source follows the sync switch:
    /// sync on => "table", sync off => "views". That interlock exists because the DirtyQueue worker
    /// and the nightly rebuild are only hosted when Req189TeamReadSyncEnabled is true; with sync off
    /// nothing maintains ReadModel.ContentTeamTaskRead, and defaulting to it would serve an empty or
    /// frozen table. Views are always computed live, so they are the safe default.
    ///
    /// Setting Req189ContentReadSource="table" while sync is off is still honoured (an operator may
    /// be reading a table kept fresh by manual rebuilds) but is logged as a warning.
    /// </summary>
    private string ResolveReadSource()
    {
        var configured = configuration.GetValue<string?>(Req189ContentReadSourceFeature);
        var syncEnabled = configuration.GetValue(Req189TeamReadSyncEnabledFeature, true);

        if (string.IsNullOrWhiteSpace(configured))
        {
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
    /// OPS-04. Single place that applies <see cref="ResolveReadSource"/>, so the page query, the
    /// export and the status-option query can never drift onto different sources.
    /// </summary>
    private IQueryable<ContentTeamTaskQueryRow> BuildContentTaskQuery(
        TeamManagementTaskQueryRequest request,
        bool applicationTaskOnly,
        string? normalizedCategory,
        string? departmentCode,
        string? departmentName)
    {
        // Appeal ownership is stored in several historical department formats. Read this category
        // from the live projection so a missed view deployment or read-table backfill cannot hide
        // valid Content appeal tasks from the dedicated Appeals tab.
        if (ShouldUseLiveAppealProjection(applicationTaskOnly, normalizedCategory))
        {
            return ContentTeamManagementTaskQuery
                .BuildLegacy(
                    DbContext,
                    request,
                    applicationTaskOnly,
                    CurrentUserService.IsArabicLanguage,
                    normalizedCategory,
                    departmentCode,
                    departmentName)
                .TagWith("Req189:Appeals:Source=live");
        }

        var readSource = ResolveReadSource();

        if (string.Equals(readSource, ReadSourceLegacy, StringComparison.OrdinalIgnoreCase))
        {
            return ContentTeamManagementTaskQuery
                .BuildLegacy(
                    DbContext,
                    request,
                    applicationTaskOnly,
                    CurrentUserService.IsArabicLanguage,
                    normalizedCategory,
                    departmentCode,
                    departmentName)
                .TagWith("Req189:OPS-04:Source=legacy");
        }

        if (string.Equals(readSource, ReadSourceViews, StringComparison.OrdinalIgnoreCase))
        {
            return ContentTeamManagementTaskQuery
                .Build(
                    DbContext,
                    request,
                    applicationTaskOnly,
                    CurrentUserService.IsArabicLanguage,
                    normalizedCategory,
                    departmentCode,
                    departmentName)
                .TagWith("Req189:OPS-04:Source=views");
        }

        // ReadSourceTable. No department or role branching.
        return ContentTeamManagementTaskQuery
            .BuildFromReadTable(
                DbContext,
                request,
                applicationTaskOnly,
                CurrentUserService.IsArabicLanguage,
                normalizedCategory)
            .TagWith("Req189:OPS-04:Source=table");
    }

    /// <summary>
    /// Display-layer fallback for the owner column: when the projected name is missing, show the
    /// raw user id rather than an empty cell. Applied here, AFTER materialization, so it covers all
    /// three read paths (table / views / legacy) at once -- the four SQL view definitions and the
    /// EF projection stay untouched, and no view redeploy or read-table rebuild is needed.
    ///
    /// Deliberately NOT pushed into the projections: AssignedToName is a stored read-model column,
    /// so changing it there would require the C# projection and all four SQL copies to move in
    /// lockstep (Req189_TeamTodo_ReadViews.sql, Req189_TeamCompleted_ReadViews.sql, and the two
    /// embedded copies in Req189_Deploy_All.sql), plus a full rebuild to repair existing rows.
    ///
    /// Returns null when there is no id either -- notably completed disposition rows, which carry
    /// no assignee by design; those legitimately render as an empty owner.
    /// </summary>
    private static string? ResolveAssignedToDisplay(string? assignedToUserId, string? assignedToName)
        => !string.IsNullOrWhiteSpace(assignedToName)
            ? assignedToName
            : string.IsNullOrWhiteSpace(assignedToUserId)
                ? null
                : assignedToUserId;

    internal static bool ShouldUseLiveAppealProjection(
        bool applicationTaskOnly,
        string? normalizedCategory)
        => !applicationTaskOnly
           && string.Equals(
               normalizedCategory,
               TeamManagementConstants.CategoryAppeals,
               StringComparison.OrdinalIgnoreCase);

    public async Task<TeamManagementTaskQueryResponse> QueryTasksV2Async(TeamManagementTaskQueryRequest request)
    {
        var applicationTaskOnly = request.ApplicationTaskOnly ?? DefaultApplicationTaskOnly;
        var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
        var pageSize = request.PageSize <= 0 ? 20 : request.PageSize;
        var normalizedCategory = NormalizeTaskCategory(request.Category);
        var department = applicationTaskOnly ? null : await LoadDepartmentAsync();
        var now = DateTimeHelper.Now;

        var query = BuildContentTaskQuery(
                request,
                applicationTaskOnly,
                normalizedCategory,
                department?.Code,
                department?.NameEn)
            .TagWith("Req189:R189-02:Base");
        var totalCount = await query
            .TagWith("Req189:R189-02:Count")
            .CountAsync();
        var pageRows = await ContentTeamManagementTaskQuery
            .ApplySorting(query.TagWith("Req189:R189-02:Page"), request)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var pageItems = pageRows.Select(row =>
        {
            var hideSla = ShouldHideApplicationSla(row.SourceType, row.StatusFilterCode, row.StatusCode);
            var remainingMinutes = !hideSla && row.SlaDueOn.HasValue
                ? (now - row.SlaDueOn.Value).TotalMinutes
                : (double?)null;

            return new TeamManagementTaskItemDto
            {
                SourceType = row.SourceType,
                SourceId = row.SourceId,
                TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory,
                TaskCategoryCode = row.TaskCategory,
                TaskCategoryDisplay = GetCategoryDisplay(row.TaskCategory),
                ApplyFor = row.ApplyFor,
                ApplyForUserTypeId = row.ApplyForUserTypeId,
                AssignedToUserId = row.AssignedToUserId,
                AssignedTo = ResolveAssignedToDisplay(row.AssignedToUserId, row.AssignedToName),
                Status = row.StatusText,
                StatusCode = row.StatusFilterCode,
                StatusId = row.StatusCode,
                StatusDisplay = row.StatusText,
                StatusDisplayOnly = row.StatusDisplayOnly,
                LastUpdatedOn = row.LastUpdatedOn,
                IsUrgent = row.IsUrgentSort,
                CanReassign = row.CanReassign,
                DetailTarget = row.DetailTarget == null
                    ? null
                    : row.DetailTarget + (row.DetailTarget.Contains('?') ? "&" : "?") + "sourcePage=teamManagement",
                Sla = hideSla ? null : new TeamManagementSlaDto
                {
                    RemainingMinutes = remainingMinutes,
                    DisplayText = remainingMinutes.ToSLADueInString(CurrentUserService.IsArabicLanguage),
                    IsOverdue = remainingMinutes.HasValue && remainingMinutes.Value > 0,
                    DueOn = row.SlaDueOn
                }
            };
        }).ToList();

        return new TeamManagementTaskQueryResponse
        {
            Page = new UMC.Utils.Framework.Page.PageResponse<TeamManagementTaskItemDto>(
                pageItems,
                totalCount,
                pageIndex,
                pageSize)
        };
    }

    public async Task<byte[]> ExportTasksV2Async(TeamManagementTaskQueryRequest request)
    {
        var applicationTaskOnly = request.ApplicationTaskOnly ?? DefaultApplicationTaskOnly;
        var normalizedCategory = NormalizeTaskCategory(request.Category);
        var department = applicationTaskOnly ? null : await LoadDepartmentAsync();
        var now = DateTimeHelper.Now;

        var query = BuildContentTaskQuery(
            request, applicationTaskOnly, normalizedCategory, department?.Code, department?.NameEn);
        var rows = await ContentTeamManagementTaskQuery
            .ApplySorting(query, request)
            .ToListAsync();

        var builder = new StringBuilder();
        builder.AppendLine("Task No.,Task Category,Apply For,Assigned To,Status,SLA,Last Updated");

        foreach (var row in rows)
        {
            var hideSla = ShouldHideApplicationSla(row.SourceType, row.StatusFilterCode, row.StatusCode);
            var remainingMinutes = !hideSla && row.SlaDueOn.HasValue
                ? (now - row.SlaDueOn.Value).TotalMinutes
                : (double?)null;

            builder.AppendLine(string.Join(",",
            [
                EscapeCsv(row.TaskNo),
                EscapeCsv(GetCategoryDisplay(row.TaskCategory)),
                EscapeCsv(row.ApplyFor),
                EscapeCsv(ResolveAssignedToDisplay(row.AssignedToUserId, row.AssignedToName)),
                EscapeCsv(row.StatusText),
                EscapeCsv(hideSla ? "-" : remainingMinutes.ToSLAString(CurrentUserService.IsArabicLanguage)),
                EscapeCsv(row.LastUpdatedOn.ToString("dd/MM/yyyy HH:mm:ss"))
            ]));
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var payload = Encoding.UTF8.GetBytes(builder.ToString());
        var result = new byte[preamble.Length + payload.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(payload, 0, result, preamble.Length, payload.Length);
        return result;
    }

    public async Task<TeamManagementMembersResponse> GetMembersOptimizedAsync(
        string? memberId,
        DateTime? startDate,
        DateTime? endDate,
        bool? applicationTaskOnly = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedApplicationTaskOnly = applicationTaskOnly ?? DefaultApplicationTaskOnly;
        var rangeStart = (startDate ?? DateTimeHelper.Now.Date.AddDays(-6)).Date;
        var rangeEnd = (endDate ?? DateTimeHelper.Now.Date).Date.AddDays(1).AddTicks(-1);
        // The built-in super-admin account is not a real team member, so it is excluded from both
        // the member cards and the member dropdown.
        var members = (await LoadDepartmentMembersOptimizedAsync(memberId, cancellationToken))
            .Where(x => !string.Equals(x.UserId, SuperAdminUserId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (members.Count == 0)
        {
            return new TeamManagementMembersResponse
            {
                StartDate = rangeStart,
                EndDate = rangeEnd
            };
        }

        var memberIds = members.Select(x => x.UserId).ToArray();
        var department = resolvedApplicationTaskOnly ? null : await LoadDepartmentAsync();
        var todoCountByUser = await LoadOptimizedTodoCountsAsync(
            memberIds,
            resolvedApplicationTaskOnly,
            department,
            cancellationToken);
        var metricTasks = await LoadOptimizedMemberMetricTasksAsync(
            memberIds,
            rangeStart,
            rangeEnd,
            resolvedApplicationTaskOnly,
            department,
            cancellationToken);
        var leaveReasonMap = await LoadLeaveReasonDisplayMapAsync();
        var dutyMap = await LoadCurrentDutyStatusMapAsync(memberIds);

        // Refund completed count for the completed-list scope (only covers refunds.CompletedTasks, not fed into the metrics pipeline,
        // so it does not affect totalAssignedTasks / avgProcessingTime / slaCompliance / overdueTasks).
        var refundCompletedByUser = resolvedApplicationTaskOnly
            ? new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            : (await ContentTeamManagementMembersOptimizedQuery
                    .BuildRefundCompletedCountsByUser(DbContext, DepartmentId, memberIds, rangeStart, rangeEnd)
                    .ToListAsync(cancellationToken))
                .ToDictionary(x => x.UserId, x => x.Count, StringComparer.OrdinalIgnoreCase);

        // Refund "assigned" count (members scope): condition 1 (current handler) + condition 2 (advanced to
        // Processed by the member within the range), used to override refunds.TotalAssignedTasks; the other refund
        // metrics remain from the metrics pipeline. The two scopes are mutually exclusive per (member, refund),
        // so each runs as a single GROUP BY and the per-member counts are summed in memory (avoids the
        // set-operation + aggregate translation risk).
        var refundAssignedByUser = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (!resolvedApplicationTaskOnly)
        {
            var handlerAssigned = await ContentTeamManagementMembersOptimizedQuery
                .BuildRefundHandlerAssignedCountsByUser(DbContext, DepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(refundAssignedByUser, handlerAssigned.Select(x => (x.UserId, x.Count)));

            var advancedAssigned = await ContentTeamManagementMembersOptimizedQuery
                .BuildRefundAdvancedAssignedCountsByUser(DbContext, DepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(refundAssignedByUser, advancedAssigned.Select(x => (x.UserId, x.Count)));
        }

        // Enquiry "assigned" count (members scope): condition 1 (current handler, status Processing) + condition 2
        // (advanced to Processed by the member within the range), used to override enquiries.TotalAssignedTasks; the
        // other enquiry metrics remain from the metrics pipeline. Same mutually-exclusive-per-(member,enquiry) shape
        // as the refund override, so the two per-member counts are summed in memory.
        var enquiryAssignedByUser = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (!resolvedApplicationTaskOnly)
        {
            var enquiryHandlerAssigned = await ContentTeamManagementMembersOptimizedQuery
                .BuildEnquiryHandlerAssignedCountsByUser(DbContext, DepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(enquiryAssignedByUser, enquiryHandlerAssigned.Select(x => (x.UserId, x.Count)));

            var enquiryAdvancedAssigned = await ContentTeamManagementMembersOptimizedQuery
                .BuildEnquiryAdvancedAssignedCountsByUser(DbContext, DepartmentId, memberIds, rangeStart, rangeEnd)
                .ToListAsync(cancellationToken);
            AddTodoCounts(enquiryAssignedByUser, enquiryAdvancedAssigned.Select(x => (x.UserId, x.Count)));
        }

        var cards = members.Select(member =>
        {
            dutyMap.TryGetValue(member.UserId, out var dutyRecord);
            var metricsByCategory = BuildOptimizedMemberMetrics(
                metricTasks,
                member.UserId,
                rangeStart,
                rangeEnd,
                resolvedApplicationTaskOnly);
            if (metricsByCategory.TryGetValue(TeamManagementConstants.CategoryRefunds, out var refundMetric))
            {
                var newRefundCompleted = refundCompletedByUser.GetValueOrDefault(member.UserId);
                var completedDelta = newRefundCompleted - refundMetric.CompletedTasks;
                refundMetric.CompletedTasks = newRefundCompleted;

                var newRefundAssigned = refundAssignedByUser.GetValueOrDefault(member.UserId);
                var assignedDelta = newRefundAssigned - refundMetric.TotalAssignedTasks;
                refundMetric.TotalAssignedTasks = newRefundAssigned;

                // Sync the deltas to the summary (all) to maintain “All ≈ sum of categories”; other all metrics remain unchanged.
                if (metricsByCategory.TryGetValue(TeamManagementConstants.CategoryAll, out var allMetric))
                {
                    allMetric.CompletedTasks += completedDelta;
                    allMetric.TotalAssignedTasks += assignedDelta;
                }
            }

            if (metricsByCategory.TryGetValue(TeamManagementConstants.CategoryEnquiries, out var enquiryMetric))
            {
                var newEnquiryAssigned = enquiryAssignedByUser.GetValueOrDefault(member.UserId);
                var enquiryAssignedDelta = newEnquiryAssigned - enquiryMetric.TotalAssignedTasks;
                enquiryMetric.TotalAssignedTasks = newEnquiryAssigned;

                // Sync the delta to the summary (all) to maintain “All ≈ sum of categories”; other all metrics remain unchanged.
                if (enquiryAssignedDelta != 0
                    && metricsByCategory.TryGetValue(TeamManagementConstants.CategoryAll, out var allMetricEnquiry))
                {
                    allMetricEnquiry.TotalAssignedTasks += enquiryAssignedDelta;
                }
            }

            return new TeamManagementMemberCardDto
            {
                UserId = member.UserId,
                UserName = member.UserName,
                AvatarUrl = member.AvatarUrl,
                IsOnLeave = IsOnLeave(dutyRecord),
                LeaveInfo = BuildLeaveInfo(dutyRecord, leaveReasonMap),
                TodoTaskCount = todoCountByUser.GetValueOrDefault(member.UserId),
                MetricsByCategory = metricsByCategory
            };
        }).ToList();

        var onDuty = cards
            .Where(x => !x.IsOnLeave)
            .OrderBy(x => x.TodoTaskCount)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase);
        var onLeave = cards
            .Where(x => x.IsOnLeave)
            .OrderBy(x => x.LeaveInfo?.ExpectedReturnDate ?? DateTime.MaxValue)
            .ThenBy(x => x.UserName, StringComparer.OrdinalIgnoreCase);

        return new TeamManagementMembersResponse
        {
            StartDate = rangeStart,
            EndDate = rangeEnd,
            Members = cards
                .OrderBy(x => x.UserName, StringComparer.OrdinalIgnoreCase)
                .Select(x => new TeamManagementMemberOptionDto
                {
                    UserId = x.UserId,
                    UserName = x.UserName
                }).ToList(),
            Cards = onDuty.Concat(onLeave).ToList()
        };
    }

    public async Task<TeamManagementReassignResponse> ReassignTasksV2Async(TeamManagementReassignRequest request)
    {
        if (request.Tasks == null || request.Tasks.Count == 0)
        {
            throw new BusinessException($"{ModuleName}.TeamManagement.EmptyTasks", "");
        }

        if (string.IsNullOrWhiteSpace(request.AssignedUserId))
        {
            throw new BusinessException($"{ModuleName}.TeamManagement.AssignedUserRequired", "");
        }

        var targetLookup = await LoadRequestedReassignTargetsOptimizedAsync(request.Tasks);
        var targetTasks = new List<TeamTaskContext>(request.Tasks.Count);

        foreach (var requestTask in request.Tasks)
        {
            if (!targetLookup.TryGetValue(BuildTaskKey(requestTask.SourceType, requestTask.SourceId), out var targetTask))
            {
                throw new BusinessException($"{ModuleName}.TeamManagement.TaskNotFound", "");
            }

            if (!targetTask.CanReassign)
            {
                throw new BusinessException($"{ModuleName}.TeamManagement.TaskCannotReassign", "");
            }

            targetTasks.Add(targetTask);
        }

        await EnrichApplicationApprovalRolesAsync(targetTasks);
        var assignee = await ResolveAssignableMemberOptimizedAsync(request.AssignedUserId);
        if (!await CanAssignTargetsToMemberAsync(targetTasks, assignee.UserId))
        {
            throw new BusinessException($"{ModuleName}.TeamManagement.AssigneeNotAvailable", "");
        }

        var now = DateTimeHelper.Now;
        var response = new TeamManagementReassignResponse();

        foreach (var targetTask in targetTasks)
        {
            await ReassignSingleTaskAsync(targetTask, assignee, now);
            response.Results.Add(new TeamManagementReassignResultDto
            {
                SourceType = targetTask.SourceType,
                SourceId = targetTask.SourceId,
                AssignedUserId = assignee.UserId,
                AssignedUserName = assignee.UserName
            });
        }

        await RefreshReadModelForReassignedTasksAsync(
            targetTasks.Select(task => (task.SourceType, task.SourceId)).ToList());

        response.ReassignedCount = response.Results.Count;
        return response;
    }

    /// <summary>
    /// Write-through refresh of ReadModel.ContentTeamTaskRead, which is what the task list reads.
    /// Its only other refresh path is the DirtyQueue worker's 10-second poll, so without this the
    /// caller's immediate re-query still shows the pre-reassign assignee. Runs after every business
    /// write has committed, because the sync opens its own transaction.
    /// Best effort by design: the reassign already succeeded, so a failure here is logged and left
    /// to the DirtyQueue / nightly rebuild rather than turned into a failed request.
    /// Internal (not private) for focused unit tests via InternalsVisibleTo.
    /// </summary>
    internal async Task RefreshReadModelForReassignedTasksAsync(
        List<(string SourceType, string SourceId)> tasks)
    {
        if (!Configuration.GetValue(Req189TeamReadSyncEnabledFeature, true))
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
                    case TeamManagementConstants.SourceApplication:
                        await readSyncProcessor.SyncCamundaTaskAsync(task.SourceId);
                        break;
                    case TeamManagementConstants.SourceEnquiry:
                        await readSyncProcessor.SyncEnquiryAsync(int.Parse(task.SourceId));
                        break;
                    case TeamManagementConstants.SourceRefund:
                        await readSyncProcessor.SyncRefundAsync(int.Parse(task.SourceId));
                        break;
                    case TeamManagementConstants.SourceAppeal:
                        await readSyncProcessor.SyncAppealAsync(int.Parse(task.SourceId));
                        break;
                    case TeamManagementConstants.SourceViolation:
                        await readSyncProcessor.SyncViolationAsync(int.Parse(task.SourceId));
                        break;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Content team read-model write-through failed for {SourceType} {SourceId}; "
                    + "the DirtyQueue worker will retry.",
                    task.SourceType, task.SourceId);
            }
        }
    }

    private async Task<Dictionary<string, TeamTaskContext>> LoadRequestedReassignTargetsOptimizedAsync(
        List<TeamManagementReassignTaskDto> tasks)
    {
        var requestKeys = tasks
            .Select(task => BuildTaskKey(task.SourceType, task.SourceId))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var department = await LoadDepartmentAsync();
        var query = ContentTeamManagementTaskQuery
            .Build(
                DbContext,
                new TeamManagementTaskQueryRequest
                {
                    View = TeamManagementConstants.ViewTodo,
                    ApplicationTaskOnly = false
                },
                applicationTaskOnly: false,
                isArabicLanguage: CurrentUserService.IsArabicLanguage,
                normalizedCategory: null,
                departmentCode: department?.Code,
                departmentName: department?.NameEn)
            .Where(row => requestKeys.Contains(row.SourceType + "::" + row.SourceId));

        var rows = await query.ToListAsync();
        return rows
            .GroupBy(row => BuildTaskKey(row.SourceType, row.SourceId), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => MapReassignTarget(group.First()),
                StringComparer.OrdinalIgnoreCase);
    }

    private async Task<DepartmentMemberContext> ResolveAssignableMemberOptimizedAsync(string userId)
    {
        var members = await LoadDepartmentMembersAsync();
        var candidate = members.FirstOrDefault(x => string.Equals(x.UserId, userId, StringComparison.OrdinalIgnoreCase));
        if (candidate == null)
        {
            throw new BusinessException($"{ModuleName}.TeamManagement.AssignedUserNotFound", "");
        }

        var dutyMap = await LoadCurrentDutyStatusMapAsync([candidate.UserId]);
        if (dutyMap.TryGetValue(candidate.UserId, out var dutyRecord) && IsOnLeave(dutyRecord))
        {
            throw new BusinessException($"{ModuleName}.TeamManagement.AssignedUserUnavailable", "");
        }

        var department = await LoadDepartmentAsync();
        var todoCountByUser = await LoadOptimizedTodoCountsAsync(
            [candidate.UserId],
            applicationTaskOnly: false,
            department,
            CancellationToken.None);
        candidate.TodoCount = todoCountByUser.GetValueOrDefault(candidate.UserId);
        return candidate;
    }

    private static TeamTaskContext MapReassignTarget(ContentTeamTaskQueryRow row)
    {
        return new TeamTaskContext
        {
            SourceType = row.SourceType,
            SourceId = row.SourceId,
            AssignedToUserId = row.AssignedToUserId,
            ApprovalRole = row.ApprovalRole,
            CanReassign = row.CanReassign
        };
    }

    private async Task EnrichApplicationApprovalRolesAsync(List<TeamTaskContext> targets)
    {
        var applicationTaskIds = targets
            .Where(target => string.Equals(target.SourceType, TeamManagementConstants.SourceApplication, StringComparison.OrdinalIgnoreCase))
            .Where(target => string.IsNullOrWhiteSpace(target.ApprovalRole))
            .Select(target => target.SourceId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (applicationTaskIds.Length == 0)
        {
            return;
        }

        var roleByTaskId = (await DbContext.CamundaTasks
                .AsNoTracking()
                .Where(task => applicationTaskIds.Contains(task.TaskId))
                .Select(task => new { task.TaskId, task.ApprovalRole })
                .ToListAsync())
            .ToDictionary(task => task.TaskId, task => task.ApprovalRole, StringComparer.OrdinalIgnoreCase);

        foreach (var target in targets)
        {
            if (string.IsNullOrWhiteSpace(target.ApprovalRole)
                && roleByTaskId.TryGetValue(target.SourceId, out var approvalRole))
            {
                target.ApprovalRole = approvalRole;
            }
        }
    }

    private async Task<List<DepartmentMemberContext>> FilterMembersByReassignTargetsAsync(
        List<DepartmentMemberContext> members,
        List<TeamTaskContext> targets)
    {
        var applicationTargets = targets
            .Where(target => string.Equals(target.SourceType, TeamManagementConstants.SourceApplication, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (applicationTargets.Any(target => string.IsNullOrWhiteSpace(RoleIdentifierNormalizer.Normalize(target.ApprovalRole))))
        {
            return [];
        }

        var requiredRoles = applicationTargets
            .Select(target => RoleIdentifierNormalizer.Normalize(target.ApprovalRole))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (requiredRoles.Count == 0)
        {
            return members;
        }

        var memberIds = members.Select(member => member.UserId).ToArray();
        var roleIdsByUser = (await DbContext.UserRoles
                .AsNoTracking()
                .Where(userRole => memberIds.Contains(userRole.UserId))
                .ToListAsync())
            .GroupBy(userRole => userRole.UserId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => RoleIdentifierNormalizer.NormalizeMany(group.Select(userRole => userRole.RoleId)).ToHashSet(StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);

        var activeRoleIds = RoleIdentifierNormalizer.NormalizeMany(await DbContext.Roles
                .AsNoTracking()
                .Where(role => role.Status != "-1")
                .Select(role => role.Id)
                .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return members
            .Where(member => roleIdsByUser.TryGetValue(member.UserId, out var roleIds)
                             && requiredRoles.All(requiredRole => roleIds.Contains(requiredRole) && activeRoleIds.Contains(requiredRole)))
            .ToList();
    }

    private async Task<bool> CanAssignTargetsToMemberAsync(List<TeamTaskContext> targets, string userId)
    {
        var member = (await LoadDepartmentMembersAsync())
            .FirstOrDefault(candidate => string.Equals(candidate.UserId, userId, StringComparison.OrdinalIgnoreCase));
        if (member == null || !member.IsActive || member.Status == "-1")
        {
            return false;
        }

        var dutyMap = await LoadCurrentDutyStatusMapAsync([userId]);
        if (dutyMap.TryGetValue(userId, out var dutyStatus) && IsOnLeave(dutyStatus))
        {
            return false;
        }

        return (await FilterMembersByReassignTargetsAsync([member], targets)).Count == 1;
    }

    protected override async Task<List<TeamTaskMetricContext>> LoadMemberMetricTasksAsync(bool applicationTaskOnly)
    {
        var metrics = new List<TeamTaskMetricContext>();
        metrics.AddRange(await LoadApplicationMetricTasksAsync());
        if (!applicationTaskOnly)
        {
            metrics.AddRange(await LoadEnquiryMetricTasksAsync());
            metrics.AddRange(await LoadRefundMetricTasksAsync());
            metrics.AddRange(await LoadAppealMetricTasksAsync());
        }

        return metrics;
    }

    protected override async Task<List<TeamManagementOptionDto>> LoadStatusOptionsAsync(bool applicationTaskOnly)
    {
        var options = new List<TeamManagementOptionDto>();
        options.AddRange(await BuildWorkflowStatusOptionsAsync());
        options.AddRange(await BuildDispositionStatusOptionsAsync());

        if (!applicationTaskOnly)
        {
            options.AddRange(await BuildTypeDictionaryStatusOptionsAsync("InquiryStatusAdmin", TeamManagementConstants.SourceEnquiry));
            options.AddRange(await BuildTypeDictionaryStatusOptionsAsync("Refund Status", TeamManagementConstants.SourceRefund));
            options.AddRange(BuildAppealStatusOptions());
        }

        return options
            .Where(x => x.Display != "4")// Lookup.TypeDictionary  scope=DispositionVerificationStatus no has 4 , should add  4 Disposition Verification / Pending Disposition 
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToList();
    }

    protected override async Task<HashSet<string>> LoadCompletedStatusCodesAsync(bool applicationTaskOnly)
    {
        var completedCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await AddTypeDictionaryStatusDisplaysAsync(
            completedCodes,
            "DispositionVerificationStatus",
            [
                (int)DispositionVerificationStatus.Verified,
                (int)DispositionVerificationStatus.NotVerified
            ]);

        if (!applicationTaskOnly)
        {
            await AddTypeDictionaryStatusDisplaysAsync(
                completedCodes,
                "InquiryStatusAdmin",
                [
                    (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed,
                    (int)EnquiryEnum.EnquiryAdminStatus.Cancelled
                ]);
            await AddTypeDictionaryStatusDisplaysAsync(
                completedCodes,
                "Refund Status",
                [
                    (int)TicketRefundsStatusEnum.DepartmentProcessed,
                    (int)TicketRefundsStatusEnum.Cancelled
                ]);
            completedCodes.Add(GetAppealStatusDisplay((int)InspectionAppealStatus.DepartmentProcessed));
            completedCodes.Add(GetAppealStatusDisplay((int)InspectionAppealStatus.Cancelled));
        }

        return completedCodes;
    }

    private async Task AddTypeDictionaryStatusDisplaysAsync(
        HashSet<string> target,
        string scope,
        IReadOnlyCollection<int> statusIds)
    {
        var statusCodes = statusIds.Select(x => x.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var displays = (await TypeDictionaryService.GetListAsync(scope))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code) && statusCodes.Contains(x.Code))
            .Select(x => CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                ? x.NameAr!
                : x.NameEn ?? x.Code!);

        target.UnionWith(displays);
    }

    protected override async Task ReassignSingleTaskAsync(TeamTaskContext task, DepartmentMemberContext assignee, DateTime now)
    {
        switch (task.SourceType)
        {
            case TeamManagementConstants.SourceApplication:
                await camundaTaskAppService.AssignmentTaskUserAsync([task.SourceId], assignee.UserId);
                break;
            case TeamManagementConstants.SourceEnquiry:
                await enquiryAppService.SaveAssignUserAsync(int.Parse(task.SourceId), new EnquiryAssignReqeust(assignee.UserId), updateManagerUserId: false);
                break;
            case TeamManagementConstants.SourceRefund:
                {
                    var refund = await DbContext.Refunds.FirstOrDefaultAsync(x => x.Id.ToString() == task.SourceId);
                    if (refund == null)
                    {
                        throw new BusinessException($"{ModuleName}.TeamManagement.TaskNotFound", "");
                    }

                    var previousAssigneeUserId = refund.HandlerUserId;
                    var assigneeChanged = !string.Equals(previousAssigneeUserId, assignee.UserId, StringComparison.OrdinalIgnoreCase);
                    refund.HandlerUserId = assignee.UserId;
                    refund.ManangerUserId = assignee.UserId;
                    refund.UpdateOn = now;
                    if (assigneeChanged)
                    {
                        DbContext.AddRefundReassignmentNotificationEvent(
                            refund, previousAssigneeUserId, assignee.UserId, assignee.UserName,
                            CurrentUserService.UserId, now);
                    }
                    var tracking = new RefundStatusTracking
                    {
                        RefundId = refund.Id,
                        FromStatusId = refund.StatusId,
                        ToStatusId = refund.StatusId,
                        DepartmentId = DepartmentId,
                        Content = $"Task Reassigned to {assignee.UserName}.",
                        CreatedBy = CurrentUserService.UserId,
                        CreatedOn = now
                    };
                    DbContext.RefundStatusTrackings.Add(tracking);
                    await UnitOfWork.SaveChangesAsync();
                    if (assigneeChanged)
                    {
                        await reassignmentNotificationService.SendRefundReassignedAsync(refund.Id, tracking.Id, assignee.UserId);
                    }
                    break;
                }
            case TeamManagementConstants.SourceAppeal:
                {
                    var appeal = await DbContext.InspectionViolationAppeals.FirstOrDefaultAsync(x => x.Id.ToString() == task.SourceId);
                    var department = await LoadDepartmentAsync();
                    if (appeal == null || department == null)
                    {
                        throw new BusinessException($"{ModuleName}.TeamManagement.TaskNotFound", "");
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
                        TargetHandlerUserId = assignee.UserId,
                        TargetHandlerUserName = assignee.UserName,
                        TargetDepartmentCode = department.Id.ToString(),
                        TargetDepartmentName = department.NameEn,
                        ActorTypeCode = "AdminUser",
                        ActorUserId = CurrentUserService.UserId,
                        ActorUserName = CurrentUserService.UserName,
                        ActorDepartmentCode = department.Code,
                        ActorDepartmentName = department.NameEn,
                        Content = $"Task Reassigned to {assignee.UserName}.",
                        CreatedOn = now,
                        CreatedBy = CurrentUserService.UserId
                    };
                    DbContext.InspectionAppealTimelineEvents.Add(timeline);
                    appeal.LastUpdatedOn = now;
                    appeal.UpdatedBy = CurrentUserService.UserId;
                    await UnitOfWork.SaveChangesAsync();
                    if (!string.Equals(task.AssignedToUserId, assignee.UserId, StringComparison.OrdinalIgnoreCase))
                    {
                        await reassignmentNotificationService.SendAppealReassignedAsync(timeline.Id);
                    }
                    break;
                }
            case TeamManagementConstants.SourceViolation:
                {
                    var violation = await DbContext.InspectionViolations
                        .Include(x => x.Handlers)
                        .FirstOrDefaultAsync(x => x.Id.ToString() == task.SourceId);
                    if (violation == null)
                    {
                        throw new BusinessException($"{ModuleName}.TeamManagement.TaskNotFound", "");
                    }

                    // The projection picks the Content owner by (IsActive, AssignedAt, Id) descending,
                    // so the previous owner must be deactivated explicitly: leaving it active lets it
                    // win the ordering again whenever the new handler row sorts lower.
                    foreach (var handler in violation.Handlers.Where(IsContentTeamHandler))
                    {
                        handler.IsActive = string.Equals(handler.UserId, assignee.UserId, StringComparison.OrdinalIgnoreCase);
                    }

                    var targetHandler = violation.Handlers.FirstOrDefault(handler =>
                        IsContentTeamHandler(handler)
                        && string.Equals(handler.UserId, assignee.UserId, StringComparison.OrdinalIgnoreCase));
                    if (targetHandler == null)
                    {
                        DbContext.InspectionViolationHandlers.Add(new InspectionViolationHandler
                        {
                            ViolationId = violation.Id,
                            UserId = assignee.UserId,
                            HandlerType = ContentTeamHandlerType,
                            AssignedAt = now,
                            IsActive = true
                        });
                    }
                    else
                    {
                        // Reassigning back to an earlier owner reuses its row; AssignedAt is refreshed
                        // so the ordering reflects this reassignment rather than the original one.
                        targetHandler.AssignedAt = now;
                    }

                    // PersistedHandlerType is deliberately left unset: the handler row is written
                    // above, and AdminPortalDBContext.EnsureViolationHandlersForNewTimelineEvents
                    // would otherwise stamp the type onto whichever tracked handler of this user it
                    // picks first — relabelling an untyped Inspection handler when the same account
                    // holds both roles on this violation.
                    DbContext.InspectionViolationTimelineEvents.Add(new InspectionViolationTimelineEvent
                    {
                        ViolationId = violation.Id,
                        EventType = "TaskReassigned",
                        EventCode = "TeamManagementReassigned",
                        EventName = "Task Reassigned",
                        Label = "Task Reassigned",
                        FromStatusId = violation.StatusId,
                        ToStatusId = violation.StatusId,
                        TargetHandlerTypeCode = "DepartmentStaff",
                        TargetHandlerUserId = assignee.UserId,
                        TargetHandlerUserName = assignee.UserName,
                        ActorTypeCode = "AdminUser",
                        ActorUserId = CurrentUserService.UserId,
                        ActorUserName = CurrentUserService.UserName,
                        Content = $"Task Reassigned to {assignee.UserName}.",
                        CreatedOn = now
                    });
                    violation.LastUpdatedOn = now;
                    violation.UpdatedBy = CurrentUserService.UserId;
                    await UnitOfWork.SaveChangesAsync();
                    break;
                }
            default:
                throw new BusinessException($"{ModuleName}.TeamManagement.TaskNotFound", "");
        }
    }

    private static bool IsContentTeamHandler(InspectionViolationHandler handler)
        => !string.IsNullOrWhiteSpace(handler.UserId)
           && string.Equals(handler.HandlerType?.Trim(), ContentTeamHandlerType, StringComparison.OrdinalIgnoreCase);

    private async Task<List<TeamTaskContext>> LoadApplicationTasksAsync(string view)
    {
        var now = DateTimeHelper.Now;
        var isCompletedView = string.Equals(view, TeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase);
        var dispositionCases = await DbContext.DispositionCases
            .AsNoTracking()
            .Where(x => (isCompletedView ? CompletedDispositionStatuses : ActiveDispositionStatuses).Contains(x.FinalDispositionStatusId))
            .ToListAsync();
        var activeDispositionApplicationIds = (await DbContext.DispositionCases
            .AsNoTracking()
            .Where(x => ActiveDispositionStatuses.Contains(x.FinalDispositionStatusId))
            .Select(x => x.ApplicationId)
            .Distinct()
            .ToListAsync())
            .ToHashSet();

        var camundaTasks = await DbContext.CamundaTasks
            .AsNoTracking()
            .Include(x => x.ProcessInstance)
            .Where(x => x.ApprovalDepartment == DepartmentId && x.ProcessInstance != null)
            .ToListAsync();
        camundaTasks = isCompletedView
            ? camundaTasks.Where(x => x.ApprovalAt.HasValue).ToList()
            : camundaTasks.Where(x => !x.ApprovalAt.HasValue).Where(x => !activeDispositionApplicationIds.Contains(x.ProcessInstance!.ApplicationId)).ToList();

        var applicationIds = camundaTasks.Select(x => x.ProcessInstance!.ApplicationId)
            .Concat(dispositionCases.Select(x => x.ApplicationId))
            .Distinct()
            .ToArray();
        if (applicationIds.Length == 0)
        {
            return [];
        }

        var applications = await DbContext.Applications
            .AsNoTracking()
            .Where(x => applicationIds.Contains(x.Id))
            .ToListAsync();
        var services = await DbContext.ServiceConfigs
            .AsNoTracking()
            .Where(x => applications.Select(a => a.ServiceId).Distinct().Contains(x.Id))
            .ToListAsync();
        var processIds = camundaTasks.Select(x => x.ProcessInstanceId).Distinct().ToArray();
        var processes = processIds.Length == 0
            ? []
            : await DbContext.CamundaProcessInstances.AsNoTracking().Where(x => processIds.Contains(x.ProcessInstanceId)).ToListAsync();
        var assigneeMap = await LoadAdminUserMapAsync(camundaTasks.Select(x => x.Assignee));
        var dutyMap = await LoadCurrentDutyStatusMapAsync(assigneeMap.Keys.ToArray());
        var applyForMap = await LoadApplyForMapAsync(applications.Where(x => x.ProfileId > 0).Select(x => x.ProfileId).Distinct().ToArray());
        var approvalTaskIds = camundaTasks
            .Select(t => t.TaskId)
            .Where(taskId => !string.IsNullOrWhiteSpace(taskId))
            .Distinct()
            .ToArray();
        var approvalRecordMap = (await DbContext.ApprovalRecords
                .AsNoTracking()
                // Exclude node-entry placeholders (ApprovalDate == null): an in-progress
                // node has no actioned record yet, same as before this model existed.
                .Where(x => approvalTaskIds.Contains(x.TaskId!) && x.ApprovalDate != null)
                .ToListAsync())
            .GroupBy(x => x.TaskId ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(r => r.ApprovalDate).First(), StringComparer.OrdinalIgnoreCase);

        var result = new List<TeamTaskContext>();
        foreach (var camundaTask in camundaTasks)
        {
            var application = applications.FirstOrDefault(x => x.Id == camundaTask.ProcessInstance!.ApplicationId);
            if (application == null)
            {
                continue;
            }

            assigneeMap.TryGetValue(camundaTask.Assignee ?? string.Empty, out var assignee);
            dutyMap.TryGetValue(camundaTask.Assignee ?? string.Empty, out var dutyRecord);
            approvalRecordMap.TryGetValue(camundaTask.TaskId, out var approvalRecord);
            var process = processes.FirstOrDefault(x => string.Equals(x.ProcessInstanceId, camundaTask.ProcessInstanceId, StringComparison.OrdinalIgnoreCase));
            var statusId = camundaTask.StatusId ?? process?.StatusId;
            var dueDate = camundaTask.DueDate;
            var slaRemainingMinutes = dueDate.HasValue ? (dueDate.Value - now).TotalMinutes : (double?)null;
            var completedOn =  approvalRecord?.ApprovalDate;
            var processingMinutes = completedOn.HasValue
                ? approvalRecord?.ActualDurationMinutes ?? (double?)Math.Max((completedOn.Value - camundaTask.CreatedTime).TotalMinutes, 0)
                : null;

            result.Add(new TeamTaskContext
            {
                SourceType = TeamManagementConstants.SourceApplication,
                SourceId = camundaTask.TaskId,
                TaskNo = application.ApplicationNumber,
                TaskCategory = TeamManagementConstants.CategoryApplications,
                StatusDomain = WorkflowStatusDomain,
                ApplyFor = applyForMap.TryGetValue(application.ProfileId, out var applyFor) ? applyFor : application.UserId,
                AssignedToUserId = camundaTask.Assignee,
                AssignedToName = assignee == null ? null : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                StatusCode = statusId?.ToString(),
                StatusText = await ResolveTypeDictionaryNameAsync("ApprovalNodeOrder", statusId?.ToString()),
                LastUpdatedOn = completedOn ?? camundaTask.CreatedTime,
                CreatedOn = camundaTask.CreatedTime,
                AssignedOn = camundaTask.CreatedTime,
                CompletedOn = completedOn,
                SlaDueOn = dueDate,
                SlaRemainingMinutes = slaRemainingMinutes,
                SlaDisplayText = slaRemainingMinutes.ToSLAString(CurrentUserService.IsArabicLanguage),
                IsUrgent = completedOn == null && IsOnLeave(dutyRecord) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                CanReassign = CanReassignApplicationTask(completedOn, camundaTask.StatusId, process?.StatusId),
                DetailTarget = $"applications/{application.Id}?taskId={camundaTask.TaskId}",
                CountsAsCompleted = completedOn.HasValue,
                IncludeInAverage = completedOn.HasValue,
                ProcessingMinutes = processingMinutes,
                CompletedWithinSla = completedOn.HasValue && (!dueDate.HasValue || completedOn.Value <= dueDate.Value),
                IsOverdueActive = completedOn == null && dueDate.HasValue && dueDate.Value < now
            });
        }

        foreach (var dispositionCase in dispositionCases)
        {
            var application = applications.FirstOrDefault(x => x.Id == dispositionCase.ApplicationId);
            if (application == null)
            {
                continue;
            }

            var isCompleted = CompletedDispositionStatuses.Contains(dispositionCase.FinalDispositionStatusId);
            var liveStatus = dispositionCase.LastSubmissionId.HasValue
                ? await TypeDictionaryService.GetLocalizedNameAsync("ApplicationStatuses", ((int)ApplicationStatus.DispositionVerification).ToString(), CurrentUserService.IsArabicLanguage ? "ar" : "en")
                : await TypeDictionaryService.GetLocalizedNameAsync("ApplicationStatuses", ((int)ApplicationStatus.PendingDisposition).ToString(), CurrentUserService.IsArabicLanguage ? "ar" : "en");
            var statusText = isCompleted
                ? PostCertificateDispositionPolicy.LocalizeDispositionCaseFinalStatus(dispositionCase.FinalStatusId, dispositionCase.FinalDispositionStatusId, CurrentUserService.IsArabicLanguage ? "ar" : "en")
                : liveStatus;
            var completedOn = dispositionCase.VerifiedAt ?? dispositionCase.ExpiredAt;
            var slaRemainingMinutes = (double?)(dispositionCase.DueDate - now).TotalMinutes;

            result.Add(new TeamTaskContext
            {
                SourceType = TeamManagementConstants.SourceApplication,
                SourceId = $"disposition-{dispositionCase.Id}",
                TaskNo = application.ApplicationNumber,
                TaskCategory = TeamManagementConstants.CategoryApplications,
                StatusDomain = DispositionStatusDomain,
                ApplyFor = applyForMap.TryGetValue(application.ProfileId, out var applyFor) ? applyFor : application.UserId,
                AssignedToUserId = null,
                AssignedToName = null,
                StatusCode = dispositionCase.FinalDispositionStatusId?.ToString(),
                StatusText = string.IsNullOrWhiteSpace(statusText) ? liveStatus : statusText,
                LastUpdatedOn = dispositionCase.UpdatedOn ?? dispositionCase.CreatedOn,
                CreatedOn = dispositionCase.CreatedOn,
                AssignedOn = dispositionCase.UpdatedOn ?? dispositionCase.CreatedOn,
                CompletedOn = completedOn,
                SlaDueOn = dispositionCase.DueDate,
                SlaRemainingMinutes = slaRemainingMinutes,
                SlaDisplayText = slaRemainingMinutes.ToSLAString(CurrentUserService.IsArabicLanguage),
                IsUrgent = false,
                CanReassign = false,
                DetailTarget = $"applications/{application.Id}?taskId=disposition-{dispositionCase.Id}",
                CountsAsCompleted = isCompleted,
                IncludeInAverage = false,
                ProcessingMinutes = completedOn.HasValue ? Math.Max((completedOn.Value - dispositionCase.CreatedOn).TotalMinutes, 0) : null,
                CompletedWithinSla = completedOn.HasValue && completedOn.Value <= dispositionCase.DueDate,
                IsOverdueActive = !isCompleted && dispositionCase.DueDate < now
            });
        }

        return result;
    }

    private async Task<List<TeamTaskMetricContext>> LoadApplicationMetricTasksAsync()
    {
        var now = DateTimeHelper.Now;
        var camundaTasks = await DbContext.CamundaTasks
            .AsNoTracking()
            .Where(x => x.ApprovalDepartment == DepartmentId && x.ProcessInstance != null && !string.IsNullOrWhiteSpace(x.Assignee))
            .ToListAsync();
        var approvalTaskIds = camundaTasks
            .Select(t => t.TaskId)
            .Where(taskId => !string.IsNullOrWhiteSpace(taskId))
            .Distinct()
            .ToArray();
        var approvalRecordMap = (await DbContext.ApprovalRecords
                .AsNoTracking()
                // Exclude node-entry placeholders (ApprovalDate == null): an in-progress
                // node has no actioned record yet, same as before this model existed.
                .Where(x => approvalTaskIds.Contains(x.TaskId!) && x.ApprovalDate != null)
                .ToListAsync())
            .GroupBy(x => x.TaskId ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(r => r.ApprovalDate).First(), StringComparer.OrdinalIgnoreCase);

        var metrics = camundaTasks.Select(task =>
        {
            approvalRecordMap.TryGetValue(task.TaskId, out var approvalRecord);
            var completedOn = task.ApprovalAt ?? approvalRecord?.ApprovalDate;
            var processingMinutes = completedOn.HasValue
                ? approvalRecord?.ActualDurationMinutes ?? Math.Max((completedOn.Value - task.CreatedTime).TotalMinutes, 0)
                : Math.Max((now - task.CreatedTime).TotalMinutes, 0);

            return new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceApplication, task.TaskId, task.Assignee!),
                AssignedToUserId = task.Assignee,
                TaskCategory = TeamManagementConstants.CategoryApplications,
                AssignmentMoments = [task.CreatedTime],
                ProcessingMinutes = processingMinutes,
                CountsAsCompleted = completedOn.HasValue,
                IncludeInAverage = completedOn.HasValue,
                IsActiveTodo = !completedOn.HasValue,
                SlaTargetMinutes = BuildSlaTargetMinutes(task.DueDate, task.CreatedTime)
            };
        }).ToList();

        var dispositionSubmissions = await DbContext.DispositionSubmissions
            .AsNoTracking()
            .Where(x => x.ReviewedOn.HasValue && !string.IsNullOrWhiteSpace(x.ReviewedBy))
            .ToListAsync();
        if (dispositionSubmissions.Count == 0)
        {
            return metrics;
        }

        var dispositionCaseMap = (await DbContext.DispositionCases
                .AsNoTracking()
                .Where(x => dispositionSubmissions.Select(s => s.DispositionCaseId).Contains(x.Id))
                .ToListAsync())
            .ToDictionary(x => x.Id);

        metrics.AddRange(dispositionSubmissions
            .Where(x => dispositionCaseMap.ContainsKey(x.DispositionCaseId))
            .Select(x =>
            {
                var dispositionCase = dispositionCaseMap[x.DispositionCaseId];
                return new TeamTaskMetricContext
                {
                    GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceApplication, $"disposition-{x.DispositionCaseId}", x.ReviewedBy!),
                    AssignedToUserId = x.ReviewedBy,
                    TaskCategory = TeamManagementConstants.CategoryApplications,
                    AssignmentMoments = [x.SubmittedOn],
                    ProcessingMinutes = Math.Max((x.ReviewedOn!.Value - x.SubmittedOn).TotalMinutes, 0),
                    CountsAsCompleted = true,
                    IncludeInAverage = true,
                    IsActiveTodo = false,
                    SlaTargetMinutes = BuildSlaTargetMinutes(dispositionCase.DueDate, dispositionCase.CreatedOn)
                };
            }));

        return metrics;
    }

    private async Task<List<TeamTaskContext>> LoadEnquiryTasksAsync(string view)
    {
        var department = await LoadDepartmentAsync();
        var now = DateTimeHelper.Now;
        var isCompletedView = string.Equals(view, TeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase);
        var enquiries = await DbContext.Enquiries.AsNoTracking().Where(x => x.DepartmentId == DepartmentId).ToListAsync();
        if (enquiries.Count == 0)
        {
            return [];
        }

        var statusLookup = (await TypeDictionaryService.GetListAsync("InquiryStatusAdmin"))
            .ToDictionary(x => x.Code ?? string.Empty, x => CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr) ? x.NameAr! : x.NameEn ?? x.Code ?? string.Empty, StringComparer.OrdinalIgnoreCase);
        var assigneeMap = await LoadAdminUserMapAsync(enquiries.Select(x => x.HandlerUserId));
        var dutyMap = await LoadCurrentDutyStatusMapAsync(assigneeMap.Keys.ToArray());
        var applyForMap = await LoadApplyForMapAsync(enquiries.Where(x => x.UserProfileId.HasValue).Select(x => x.UserProfileId!.Value).Distinct().ToArray());
        var trackingRows = await DbContext.EnquiryStatusTracking.AsNoTracking().Where(x => enquiries.Select(e => e.Id).Contains(x.EnquiryId)).ToListAsync();

        if (!isCompletedView)
        {
            return enquiries
                .Where(x => x.EnquiryStatusId == (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing)
                .Select(enquiry =>
                {
                    assigneeMap.TryGetValue(enquiry.HandlerUserId ?? string.Empty, out var assignee);
                    dutyMap.TryGetValue(enquiry.HandlerUserId ?? string.Empty, out var dutyRecord);
                    var assignedOn = trackingRows
                        .Where(x => x.EnquiryId == enquiry.Id && string.Equals(x.HandlerUserId, enquiry.HandlerUserId, StringComparison.OrdinalIgnoreCase))
                        .OrderByDescending(x => x.CreatedOn)
                        .Select(x => (DateTime?)x.CreatedOn)
                        .FirstOrDefault() ?? enquiry.CreatedOn;
                    var slaRemainingMinutes = enquiry.SLAEndTime.HasValue ? (enquiry.SLAEndTime.Value - now).TotalMinutes : (double?)null;

                    return new TeamTaskContext
                    {
                        SourceType = TeamManagementConstants.SourceEnquiry,
                        SourceId = enquiry.Id.ToString(),
                        TaskNo = enquiry.EnquiryNumber,
                        TaskCategory = TeamManagementConstants.CategoryEnquiries,
                        StatusDomain = TeamManagementConstants.SourceEnquiry,
                        ApplyFor = enquiry.UserProfileId.HasValue && applyForMap.TryGetValue(enquiry.UserProfileId.Value, out var applyFor) ? applyFor : enquiry.CreatedBy,
                        AssignedToUserId = enquiry.HandlerUserId,
                        AssignedToName = assignee == null ? null : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                        StatusCode = enquiry.EnquiryStatusId.ToString(),
                        StatusText = statusLookup.TryGetValue(enquiry.EnquiryStatusId.ToString(), out var statusText) ? statusText : enquiry.EnquiryStatusId.ToString(),
                        LastUpdatedOn = enquiry.UpdatedOn ?? enquiry.CreatedOn,
                        CreatedOn = enquiry.CreatedOn,
                        AssignedOn = assignedOn,
                        CompletedOn = null,
                        SlaDueOn = enquiry.SLAEndTime,
                        SlaRemainingMinutes = slaRemainingMinutes,
                        SlaDisplayText = slaRemainingMinutes.ToSLAString(CurrentUserService.IsArabicLanguage),
                        IsUrgent = IsOnLeave(dutyRecord) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                        CanReassign = true,
                        DetailTarget = $"happiness/tickets/tickets-details?id={enquiry.Id}",
                        CountsAsCompleted = false,
                        IncludeInAverage = false,
                        ProcessingMinutes = null,
                        CompletedWithinSla = false,
                        IsOverdueActive = enquiry.SLAEndTime.HasValue && enquiry.SLAEndTime.Value < now
                    };
                }).ToList();
        }

        var completedRows = trackingRows
            .Where(x => x.DepartmentId == DepartmentId
                        && (x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed
                            || x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.Cancelled))
            .GroupBy(x => new { x.EnquiryId, Handler = x.HandlerUserId ?? x.CreatedBy ?? string.Empty })
            .Select(x => x.OrderByDescending(t => t.CreatedOn).ThenByDescending(t => t.Id).First())
            .ToList();
        var completedOwnerMap = await LoadAdminUserMapAsync(completedRows.Select(x => x.HandlerUserId ?? x.CreatedBy));

        return completedRows.Select(row =>
        {
            var enquiry = enquiries.FirstOrDefault(x => x.Id == row.EnquiryId);
            if (enquiry == null)
            {
                return null;
            }

            var ownerId = row.HandlerUserId ?? row.CreatedBy;
            completedOwnerMap.TryGetValue(ownerId ?? string.Empty, out var assignee);
            return new TeamTaskContext
            {
                SourceType = TeamManagementConstants.SourceEnquiry,
                SourceId = $"{enquiry.Id}:completed:{ownerId}",
                TaskNo = enquiry.EnquiryNumber,
                TaskCategory = TeamManagementConstants.CategoryEnquiries,
                StatusDomain = TeamManagementConstants.SourceEnquiry,
                ApplyFor = enquiry.UserProfileId.HasValue && applyForMap.TryGetValue(enquiry.UserProfileId.Value, out var applyFor) ? applyFor : enquiry.CreatedBy,
                AssignedToUserId = ownerId,
                AssignedToName = assignee == null ? ownerId : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                StatusCode = enquiry.EnquiryStatusId.ToString(),
                StatusText = statusLookup.TryGetValue(enquiry.EnquiryStatusId.ToString(), out var statusText) ? statusText : enquiry.EnquiryStatusId.ToString(),
                LastUpdatedOn = enquiry.UpdatedOn ?? row.CreatedOn,
                CreatedOn = enquiry.CreatedOn,
                AssignedOn = row.CreatedOn,
                CompletedOn = row.CreatedOn,
                SlaDueOn = enquiry.SLAEndTime,
                SlaRemainingMinutes = enquiry.SLAEndTime.HasValue ? (enquiry.SLAEndTime.Value - now).TotalMinutes : (double?)null,
                SlaDisplayText = enquiry.SLAEndTime.HasValue ? ((double?)(enquiry.SLAEndTime.Value - now).TotalMinutes).ToSLAString(CurrentUserService.IsArabicLanguage) : "-",
                IsUrgent = false,
                CanReassign = false,
                DetailTarget = $"happiness/tickets/tickets-details?id={enquiry.Id}",
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)EnquiryEnum.EnquiryAdminStatus.Cancelled,
                ProcessingMinutes = Math.Max((row.CreatedOn - enquiry.CreatedOn).TotalMinutes, 0),
                CompletedWithinSla = !enquiry.SLAEndTime.HasValue || row.CreatedOn <= enquiry.SLAEndTime.Value,
                IsOverdueActive = false
            };
        }).Where(x => x != null).Cast<TeamTaskContext>().ToList();
    }

    private async Task<List<TeamTaskMetricContext>> LoadEnquiryMetricTasksAsync()
    {
        var now = DateTimeHelper.Now;
        var enquiries = await DbContext.Enquiries.AsNoTracking().Where(x => x.DepartmentId == DepartmentId).ToListAsync();
        if (enquiries.Count == 0)
        {
            return [];
        }

        var trackingRows = await DbContext.EnquiryStatusTracking.AsNoTracking().Where(x => enquiries.Select(e => e.Id).Contains(x.EnquiryId)).ToListAsync();
        var metrics = new List<TeamTaskMetricContext>();

        foreach (var enquiry in enquiries.Where(x => x.EnquiryStatusId == (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing && !string.IsNullOrWhiteSpace(x.HandlerUserId)))
        {
            var assignedOn = ResolveEnquiryAssignedOn(trackingRows, enquiry.Id, enquiry.HandlerUserId!, null, enquiry.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceEnquiry, enquiry.Id.ToString(), enquiry.HandlerUserId!),
                AssignedToUserId = enquiry.HandlerUserId,
                TaskCategory = TeamManagementConstants.CategoryEnquiries,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(enquiry.SLAEndTime, enquiry.CreatedOn)
            });
        }

        foreach (var row in trackingRows.Where(x => x.DepartmentId == DepartmentId
                                                    && (x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed
                                                        || x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.Cancelled)))
        {
            var enquiry = enquiries.FirstOrDefault(x => x.Id == row.EnquiryId);
            var ownerId = row.HandlerUserId ?? row.CreatedBy;
            if (enquiry == null || string.IsNullOrWhiteSpace(ownerId))
            {
                continue;
            }

            var assignedOn = ResolveEnquiryAssignedOn(trackingRows, enquiry.Id, ownerId, row.CreatedOn, enquiry.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceEnquiry, enquiry.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = TeamManagementConstants.CategoryEnquiries,
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

    private async Task<List<TeamTaskContext>> LoadRefundTasksAsync(string view)
    {
        var now = DateTimeHelper.Now;
        var isCompletedView = string.Equals(view, TeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase);
        var refunds = await DbContext.Refunds.AsNoTracking().Where(x => x.ReferenceDepartmentId == DepartmentId).ToListAsync();
        if (refunds.Count == 0)
        {
            return [];
        }

        var statusLookup = (await TypeDictionaryService.GetListAsync("Refund Status"))
            .ToDictionary(x => x.Code ?? string.Empty, x => CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr) ? x.NameAr! : x.NameEn ?? x.Code ?? string.Empty, StringComparer.OrdinalIgnoreCase);
        var assigneeMap = await LoadAdminUserMapAsync(refunds.Select(x => x.HandlerUserId));
        var dutyMap = await LoadCurrentDutyStatusMapAsync(assigneeMap.Keys.ToArray());
        var applyForMap = await LoadApplyForMapAsync(refunds.Where(x => x.ProfileId.HasValue).Select(x => x.ProfileId!.Value).Distinct().ToArray());
        var trackingRows = await DbContext.RefundStatusTrackings.AsNoTracking().Where(x => refunds.Select(r => r.Id).Contains(x.RefundId ?? 0)).ToListAsync();

        if (!isCompletedView)
        {
            return refunds
                .Where(x => x.StatusId == (short)TicketRefundsStatusEnum.DepartmentProcessing)
                .Select(refund =>
                {
                    assigneeMap.TryGetValue(refund.HandlerUserId ?? string.Empty, out var assignee);
                    dutyMap.TryGetValue(refund.HandlerUserId ?? string.Empty, out var dutyRecord);
                    var assignedOn = trackingRows
                        .Where(x => x.RefundId == refund.Id && string.Equals(x.CreatedBy, refund.HandlerUserId, StringComparison.OrdinalIgnoreCase))
                        .OrderByDescending(x => x.CreatedOn)
                        .Select(x => (DateTime?)x.CreatedOn)
                        .FirstOrDefault() ?? refund.CreatedOn;
                    var slaRemainingMinutes = refund.SLAEndTime.HasValue ? (refund.SLAEndTime.Value - now).TotalMinutes : (double?)null;

                    return new TeamTaskContext
                    {
                        SourceType = TeamManagementConstants.SourceRefund,
                        SourceId = refund.Id.ToString(),
                        TaskNo = refund.ReferenceNumber ?? refund.ApplicationNumber ?? refund.TransactionNo ?? refund.Id.ToString(),
                        TaskCategory = TeamManagementConstants.CategoryRefunds,
                        StatusDomain = TeamManagementConstants.SourceRefund,
                        ApplyFor = refund.ProfileId.HasValue && applyForMap.TryGetValue(refund.ProfileId.Value, out var applyFor) ? applyFor : refund.UserId,
                        AssignedToUserId = refund.HandlerUserId,
                        AssignedToName = assignee == null ? null : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                        StatusCode = refund.StatusId.ToString(),
                        StatusText = statusLookup.TryGetValue(refund.StatusId.ToString(), out var statusText) ? statusText : refund.StatusId.ToString(),
                        LastUpdatedOn = refund.UpdateOn,
                        CreatedOn = refund.CreatedOn,
                        AssignedOn = assignedOn,
                        CompletedOn = null,
                        SlaDueOn = refund.SLAEndTime,
                        SlaRemainingMinutes = slaRemainingMinutes,
                        SlaDisplayText = slaRemainingMinutes.ToSLAString(CurrentUserService.IsArabicLanguage),
                        IsUrgent = IsOnLeave(dutyRecord) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                        CanReassign = true,
                        DetailTarget = $"finance/refunds/{refund.ReferenceNumber ?? refund.Id.ToString()}",
                        CountsAsCompleted = false,
                        IncludeInAverage = false,
                        ProcessingMinutes = null,
                        CompletedWithinSla = false,
                        IsOverdueActive = refund.SLAEndTime.HasValue && refund.SLAEndTime.Value < now
                    };
                }).ToList();
        }

        var completedRows = trackingRows
            .Where(x => x.DepartmentId == DepartmentId
                        && (x.ToStatusId == (int)TicketRefundsStatusEnum.DepartmentProcessed
                            || x.ToStatusId == (int)TicketRefundsStatusEnum.Cancelled))
            .GroupBy(x => new { RefundId = x.RefundId ?? 0, Owner = x.CreatedBy ?? string.Empty })
            .Select(x => x.OrderByDescending(t => t.CreatedOn).ThenByDescending(t => t.Id).First())
            .ToList();
        var completedOwnerMap = await LoadAdminUserMapAsync(completedRows.Select(x => x.CreatedBy));

        return completedRows.Select(row =>
        {
            var refund = refunds.FirstOrDefault(x => x.Id == row.RefundId);
            if (refund == null)
            {
                return null;
            }

            completedOwnerMap.TryGetValue(row.CreatedBy ?? string.Empty, out var assignee);
            return new TeamTaskContext
            {
                SourceType = TeamManagementConstants.SourceRefund,
                SourceId = $"{refund.Id}:completed:{row.CreatedBy}",
                TaskNo = refund.ReferenceNumber ?? refund.ApplicationNumber ?? refund.TransactionNo ?? refund.Id.ToString(),
                TaskCategory = TeamManagementConstants.CategoryRefunds,
                StatusDomain = TeamManagementConstants.SourceRefund,
                ApplyFor = refund.ProfileId.HasValue && applyForMap.TryGetValue(refund.ProfileId.Value, out var applyFor) ? applyFor : refund.UserId,
                AssignedToUserId = row.CreatedBy,
                AssignedToName = assignee == null ? row.CreatedBy : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                StatusCode = refund.StatusId.ToString(),
                StatusText = statusLookup.TryGetValue(refund.StatusId.ToString(), out var statusText) ? statusText : refund.StatusId.ToString(),
                LastUpdatedOn = refund.UpdateOn,
                CreatedOn = refund.CreatedOn,
                AssignedOn = row.CreatedOn,
                CompletedOn = row.CreatedOn,
                SlaDueOn = refund.SLAEndTime,
                SlaRemainingMinutes = refund.SLAEndTime.HasValue ? (refund.SLAEndTime.Value - now).TotalMinutes : (double?)null,
                SlaDisplayText = refund.SLAEndTime.HasValue ? ((double?)(refund.SLAEndTime.Value - now).TotalMinutes).ToSLAString(CurrentUserService.IsArabicLanguage) : "-",
                IsUrgent = false,
                CanReassign = false,
                DetailTarget = $"finance/refunds/{refund.ReferenceNumber ?? refund.Id.ToString()}",
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)TicketRefundsStatusEnum.Cancelled,
                ProcessingMinutes = Math.Max((row.CreatedOn - refund.CreatedOn).TotalMinutes, 0),
                CompletedWithinSla = !refund.SLAEndTime.HasValue || row.CreatedOn <= refund.SLAEndTime.Value,
                IsOverdueActive = false
            };
        }).Where(x => x != null).Cast<TeamTaskContext>().ToList();
    }

    private async Task<List<TeamTaskMetricContext>> LoadRefundMetricTasksAsync()
    {
        var now = DateTimeHelper.Now;
        var refunds = await DbContext.Refunds.AsNoTracking().Where(x => x.ReferenceDepartmentId == DepartmentId).ToListAsync();
        if (refunds.Count == 0)
        {
            return [];
        }

        var trackingRows = await DbContext.RefundStatusTrackings.AsNoTracking().Where(x => refunds.Select(r => r.Id).Contains(x.RefundId ?? 0)).ToListAsync();
        var metrics = new List<TeamTaskMetricContext>();

        foreach (var refund in refunds.Where(x => x.StatusId == (short)TicketRefundsStatusEnum.DepartmentProcessing && !string.IsNullOrWhiteSpace(x.HandlerUserId)))
        {
            var assignedOn = ResolveRefundAssignedOn(trackingRows, refund.Id, refund.HandlerUserId!, null, refund.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceRefund, refund.Id.ToString(), refund.HandlerUserId!),
                AssignedToUserId = refund.HandlerUserId,
                TaskCategory = TeamManagementConstants.CategoryRefunds,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(refund.SLAEndTime, refund.CreatedOn)
            });
        }

        foreach (var row in trackingRows.Where(x => x.DepartmentId == DepartmentId
                                                    && (x.ToStatusId == (int)TicketRefundsStatusEnum.DepartmentProcessed
                                                        || x.ToStatusId == (int)TicketRefundsStatusEnum.Cancelled)))
        {
            var refund = refunds.FirstOrDefault(x => x.Id == row.RefundId);
            var ownerId = row.CreatedBy;
            if (refund == null || string.IsNullOrWhiteSpace(ownerId))
            {
                continue;
            }

            var assignedOn = ResolveRefundAssignedOn(trackingRows, refund.Id, ownerId, row.CreatedOn, refund.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceRefund, refund.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = TeamManagementConstants.CategoryRefunds,
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

    private async Task<List<TeamTaskContext>> LoadAppealTasksAsync(string view)
    {
        var department = await LoadDepartmentAsync();
        if (department == null)
        {
            return [];
        }

        var now = DateTimeHelper.Now;
        var isCompletedView = string.Equals(view, TeamManagementConstants.ViewCompleted, StringComparison.OrdinalIgnoreCase);
        var appeals = await DbContext.InspectionViolationAppeals
            .AsNoTracking()
            .Include(x => x.Violation)
            .ToListAsync();
        if (appeals.Count == 0)
        {
            return [];
        }

        var appealIds = appeals.Select(x => x.Id).ToArray();
        var timelineEvents = await DbContext.InspectionAppealTimelineEvents.AsNoTracking().Where(x => appealIds.Contains(x.AppealId)).ToListAsync();
        var latestTargetMap = timelineEvents
            .Where(x => !string.IsNullOrWhiteSpace(x.TargetDepartmentCode) || !string.IsNullOrWhiteSpace(x.TargetDepartmentName) || !string.IsNullOrWhiteSpace(x.TargetHandlerUserId))
            .GroupBy(x => x.AppealId)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(t => t.CreatedOn).ThenByDescending(t => t.Id).First());
        var assigneeMap = await LoadAdminUserMapAsync(latestTargetMap.Values.Select(x => x.TargetHandlerUserId));
        var dutyMap = await LoadCurrentDutyStatusMapAsync(assigneeMap.Keys.ToArray());

        if (!isCompletedView)
        {
            return appeals
                .Where(x => x.StatusId == (int)InspectionAppealStatus.DepartmentProcessing)
                .Where(x => latestTargetMap.TryGetValue(x.Id, out var latestTargetEvent) && DepartmentMatches(department, latestTargetEvent.TargetDepartmentCode, latestTargetEvent.TargetDepartmentName))
                .Select(appeal =>
                {
                    var latestTargetEvent = latestTargetMap[appeal.Id];
                    assigneeMap.TryGetValue(latestTargetEvent.TargetHandlerUserId ?? string.Empty, out var assignee);
                    dutyMap.TryGetValue(latestTargetEvent.TargetHandlerUserId ?? string.Empty, out var dutyRecord);
                    var slaRemainingMinutes = appeal.SlaDueOn.HasValue ? (appeal.SlaDueOn.Value - now).TotalMinutes : (double?)null;

                    return new TeamTaskContext
                    {
                        SourceType = TeamManagementConstants.SourceAppeal,
                        SourceId = appeal.Id.ToString(),
                        TaskNo = appeal.AppealNo,
                        TaskCategory = TeamManagementConstants.CategoryAppeals,
                        StatusDomain = TeamManagementConstants.SourceAppeal,
                        ApplyFor = appeal.Violation?.ViolatorName,
                        AssignedToUserId = latestTargetEvent.TargetHandlerUserId,
                        AssignedToName = !string.IsNullOrWhiteSpace(latestTargetEvent.TargetHandlerUserName)
                            ? latestTargetEvent.TargetHandlerUserName
                            : assignee == null ? null : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                        StatusCode = appeal.StatusId.ToString(),
                        StatusText = GetAppealStatusDisplay(appeal.StatusId),
                        LastUpdatedOn = appeal.LastUpdatedOn,
                        CreatedOn = appeal.CreatedOn,
                        AssignedOn = latestTargetEvent.CreatedOn,
                        CompletedOn = null,
                        SlaDueOn = appeal.SlaDueOn,
                        SlaRemainingMinutes = slaRemainingMinutes,
                        SlaDisplayText = slaRemainingMinutes.ToSLAString(CurrentUserService.IsArabicLanguage),
                        IsUrgent = IsOnLeave(dutyRecord) && slaRemainingMinutes.HasValue && slaRemainingMinutes.Value <= 24d * 60d,
                        CanReassign = true,
                        DetailTarget = $"appeals/{appeal.Id}",
                        CountsAsCompleted = false,
                        IncludeInAverage = false,
                        ProcessingMinutes = null,
                        CompletedWithinSla = false,
                        IsOverdueActive = appeal.SlaDueOn.HasValue && appeal.SlaDueOn.Value < now
                    };
                }).ToList();
        }

        var completedRows = timelineEvents
            .Where(x => (x.ToStatusId == (int)InspectionAppealStatus.DepartmentProcessed || x.ToStatusId == (int)InspectionAppealStatus.Cancelled)
                        && (DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName)
                            || DepartmentMatches(department, x.ActorDepartmentCode, x.ActorDepartmentName)))
            .GroupBy(x => new { x.AppealId, Owner = x.ActorUserId ?? x.TargetHandlerUserId ?? string.Empty })
            .Select(x => x.OrderByDescending(t => t.CreatedOn).ThenByDescending(t => t.Id).First())
            .ToList();
        var completedOwnerMap = await LoadAdminUserMapAsync(completedRows.Select(x => x.ActorUserId ?? x.TargetHandlerUserId));

        return completedRows.Select(row =>
        {
            var appeal = appeals.FirstOrDefault(x => x.Id == row.AppealId);
            if (appeal == null)
            {
                return null;
            }

            var ownerId = row.ActorUserId ?? row.TargetHandlerUserId;
            completedOwnerMap.TryGetValue(ownerId ?? string.Empty, out var assignee);
            return new TeamTaskContext
            {
                SourceType = TeamManagementConstants.SourceAppeal,
                SourceId = $"{appeal.Id}:completed:{ownerId}",
                TaskNo = appeal.AppealNo,
                TaskCategory = TeamManagementConstants.CategoryAppeals,
                StatusDomain = TeamManagementConstants.SourceAppeal,
                ApplyFor = appeal.Violation?.ViolatorName,
                AssignedToUserId = ownerId,
                AssignedToName = !string.IsNullOrWhiteSpace(row.ActorUserName)
                    ? row.ActorUserName
                    : !string.IsNullOrWhiteSpace(row.TargetHandlerUserName)
                        ? row.TargetHandlerUserName
                        : assignee == null ? ownerId : BuildUserName(assignee.FirstName, assignee.LastName, assignee.UserName),
                StatusCode = appeal.StatusId.ToString(),
                StatusText = GetAppealStatusDisplay(appeal.StatusId),
                LastUpdatedOn = appeal.LastUpdatedOn,
                CreatedOn = appeal.CreatedOn,
                AssignedOn = row.CreatedOn,
                CompletedOn = row.CreatedOn,
                SlaDueOn = appeal.SlaDueOn,
                SlaRemainingMinutes = appeal.SlaDueOn.HasValue ? (appeal.SlaDueOn.Value - now).TotalMinutes : (double?)null,
                SlaDisplayText = appeal.SlaDueOn.HasValue ? ((double?)(appeal.SlaDueOn.Value - now).TotalMinutes).ToSLAString(CurrentUserService.IsArabicLanguage) : "-",
                IsUrgent = false,
                CanReassign = false,
                DetailTarget = $"appeals/{appeal.Id}",
                CountsAsCompleted = true,
                IncludeInAverage = row.ToStatusId != (int)InspectionAppealStatus.Cancelled,
                ProcessingMinutes = Math.Max((row.CreatedOn - appeal.CreatedOn).TotalMinutes, 0),
                CompletedWithinSla = !appeal.SlaDueOn.HasValue || row.CreatedOn <= appeal.SlaDueOn.Value,
                IsOverdueActive = false
            };
        }).Where(x => x != null).Cast<TeamTaskContext>().ToList();
    }

    private async Task<List<TeamTaskMetricContext>> LoadAppealMetricTasksAsync()
    {
        var department = await LoadDepartmentAsync();
        if (department == null)
        {
            return [];
        }

        var now = DateTimeHelper.Now;
        var appeals = await DbContext.InspectionViolationAppeals
            .AsNoTracking()
            .ToListAsync();
        if (appeals.Count == 0)
        {
            return [];
        }

        var timelineEvents = await DbContext.InspectionAppealTimelineEvents.AsNoTracking().Where(x => appeals.Select(a => a.Id).Contains(x.AppealId)).ToListAsync();
        var latestTargetMap = timelineEvents
            .Where(x => !string.IsNullOrWhiteSpace(x.TargetDepartmentCode) || !string.IsNullOrWhiteSpace(x.TargetDepartmentName) || !string.IsNullOrWhiteSpace(x.TargetHandlerUserId))
            .GroupBy(x => x.AppealId)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(t => t.CreatedOn).ThenByDescending(t => t.Id).First());
        var metrics = new List<TeamTaskMetricContext>();

        foreach (var appeal in appeals.Where(x => x.StatusId == (int)InspectionAppealStatus.DepartmentProcessing))
        {
            if (!latestTargetMap.TryGetValue(appeal.Id, out var latestTargetEvent)
                || !DepartmentMatches(department, latestTargetEvent.TargetDepartmentCode, latestTargetEvent.TargetDepartmentName)
                || string.IsNullOrWhiteSpace(latestTargetEvent.TargetHandlerUserId))
            {
                continue;
            }

            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceAppeal, appeal.Id.ToString(), latestTargetEvent.TargetHandlerUserId),
                AssignedToUserId = latestTargetEvent.TargetHandlerUserId,
                TaskCategory = TeamManagementConstants.CategoryAppeals,
                AssignmentMoments = [latestTargetEvent.CreatedOn],
                ProcessingMinutes = Math.Max((now - latestTargetEvent.CreatedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(appeal.SlaDueOn, appeal.CreatedOn)
            });
        }

        foreach (var row in timelineEvents.Where(x => (x.ToStatusId == (int)InspectionAppealStatus.DepartmentProcessed || x.ToStatusId == (int)InspectionAppealStatus.Cancelled)
                                                      && (DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName)
                                                          || DepartmentMatches(department, x.ActorDepartmentCode, x.ActorDepartmentName))))
        {
            var appeal = appeals.FirstOrDefault(x => x.Id == row.AppealId);
            var ownerId = row.ActorUserId ?? row.TargetHandlerUserId;
            if (appeal == null || string.IsNullOrWhiteSpace(ownerId))
            {
                continue;
            }

            var assignedOn = ResolveAppealAssignedOn(timelineEvents, department, appeal.Id, ownerId, row.CreatedOn, appeal.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceAppeal, appeal.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = TeamManagementConstants.CategoryAppeals,
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

    private async Task<List<DepartmentMemberContext>> LoadDepartmentMembersOptimizedAsync(
        string? memberId,
        CancellationToken cancellationToken)
    {
        var rows = await ContentTeamManagementMembersOptimizedQuery
            .BuildMembers(DbContext, DepartmentId)
            .ToListAsync(cancellationToken);

        return rows
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
        Department? department,
        CancellationToken cancellationToken)
    {
        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        var workflowCounts = await ContentTeamManagementMembersOptimizedQuery
            .BuildWorkflowTodoCounts(DbContext, DepartmentId, memberIds)
            .ToListAsync(cancellationToken);
        AddTodoCounts(counts, workflowCounts.Select(x => (x.UserId, x.Count)));

        if (applicationTaskOnly)
        {
            return counts;
        }

        var enquiryCounts = await ContentTeamManagementMembersOptimizedQuery
            .BuildEnquiryTodoCounts(DbContext, DepartmentId, memberIds)
            .ToListAsync(cancellationToken);
        AddTodoCounts(counts, enquiryCounts.Select(x => (x.UserId, x.Count)));

        var refundCounts = await ContentTeamManagementMembersOptimizedQuery
            .BuildRefundTodoCounts(DbContext, DepartmentId, memberIds)
            .ToListAsync(cancellationToken);
        AddTodoCounts(counts, refundCounts.Select(x => (x.UserId, x.Count)));

        if (department != null)
        {
            var appealCounts = await ContentTeamManagementMembersOptimizedQuery
                .BuildAppealTodoCounts(DbContext, memberIds, department.Code, department.NameEn)
                .ToListAsync(cancellationToken);
            AddTodoCounts(counts, appealCounts.Select(x => (x.UserId, x.Count)));
        }

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

    private async Task<List<TeamTaskMetricContext>> LoadOptimizedMemberMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        bool applicationTaskOnly,
        Department? department,
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
                department,
                cancellationToken));
        }

        return tasks;
    }

    private async Task<List<TeamTaskMetricContext>> LoadOptimizedApplicationMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var now = DateTimeHelper.Now;
        var tasks = new List<TeamTaskMetricContext>();

        var workflowRows = await ContentTeamManagementMembersOptimizedQuery
            .BuildWorkflowMetricRows(
                DbContext,
                DepartmentId,
                memberIds,
                rangeStart,
                rangeEnd)
            .ToListAsync(cancellationToken);

        if (workflowRows.Count > 0)
        {
            var approvalRows = await ContentTeamManagementMembersOptimizedQuery
                .BuildWorkflowApprovalRows(
                    DbContext,
                    DepartmentId,
                    memberIds,
                    rangeStart,
                    rangeEnd)
                .ToListAsync(cancellationToken);
            var latestApprovalByTask = approvalRows
                .GroupBy(x => x.TaskId, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    group => group.Key,
                    group => group.OrderByDescending(x => x.ApprovalDate).First(),
                    StringComparer.OrdinalIgnoreCase);

            tasks.AddRange(workflowRows
                .Select(row => new
                {
                    Row = row,
                    Classification = ClassifyOptimizedApplicationMetric(
                        row.TaskStatusId,
                        row.ProcessStatusId,
                        row.ApprovalAt)
                })
                .Where(item => item.Classification.Include)
                .Select(item =>
                {
                    var row = item.Row;
                    latestApprovalByTask.TryGetValue(row.TaskId, out var approvalRow);
                    var processingMinutes = row.ApprovalAt.HasValue
                        ? approvalRow?.ActualDurationMinutes
                          ?? Math.Max((row.ApprovalAt.Value - row.CreatedTime).TotalMinutes, 0)
                        : Math.Max((now - row.CreatedTime).TotalMinutes, 0);

                    return new TeamTaskMetricContext
                    {
                        GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceApplication, row.TaskId, row.Assignee),
                        AssignedToUserId = row.Assignee,
                        TaskCategory = TeamManagementConstants.CategoryApplications,
                        AssignmentMoments = [row.CreatedTime],
                        ProcessingMinutes = processingMinutes,
                        CountsAsCompleted = item.Classification.CountsAsCompleted,
                        IncludeInAverage = item.Classification.CountsAsCompleted,
                        IsActiveTodo = item.Classification.IsActiveTodo,
                        SlaTargetMinutes = BuildSlaTargetMinutes(row.DueDate, row.CreatedTime)
                    };
                }));
        }

        var dispositionRows = await ContentTeamManagementMembersOptimizedQuery
            .BuildDispositionMetricRows(
                DbContext,
                memberIds,
                rangeStart,
                rangeEnd)
            .ToListAsync(cancellationToken);

        tasks.AddRange(dispositionRows.Select(row => new TeamTaskMetricContext
        {
            GroupKey = BuildMetricGroupKey(
                TeamManagementConstants.SourceApplication,
                $"disposition-{row.DispositionCaseId}",
                row.ReviewedBy),
            AssignedToUserId = row.ReviewedBy,
            TaskCategory = TeamManagementConstants.CategoryApplications,
            AssignmentMoments = [row.SubmittedOn],
            ProcessingMinutes = Math.Max((row.ReviewedOn!.Value - row.SubmittedOn).TotalMinutes, 0),
            CountsAsCompleted = true,
            IncludeInAverage = true,
            IsActiveTodo = false,
            SlaTargetMinutes = BuildSlaTargetMinutes(row.DueDate, row.CaseCreatedOn)
        }));

        return tasks;
    }

    private async Task<List<TeamTaskMetricContext>> LoadOptimizedEnquiryMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var enquiryIds = await ContentTeamManagementMembersOptimizedQuery
            .BuildEnquiryMetricCandidateIds(
                DbContext,
                DepartmentId,
                memberIds,
                rangeStart,
                rangeEnd)
            .ToListAsync(cancellationToken);
        if (enquiryIds.Count == 0)
        {
            return [];
        }

        var now = DateTimeHelper.Now;
        var enquiries = await DbContext.Enquiries
            .AsNoTracking()
            .Where(x => enquiryIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var trackingRows = await DbContext.EnquiryStatusTracking
            .AsNoTracking()
            .Where(x => enquiryIds.Contains(x.EnquiryId))
            .ToListAsync(cancellationToken);
        var metrics = new List<TeamTaskMetricContext>();

        foreach (var enquiry in enquiries.Where(x =>
                     x.EnquiryStatusId == (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing
                     && !string.IsNullOrWhiteSpace(x.HandlerUserId)
                     && memberIds.Contains(x.HandlerUserId!, StringComparer.OrdinalIgnoreCase)))
        {
            // Todo assignment moment uses the enquiry's own UpdatedOn (fallback CreatedOn),
            // avoiding an EnquiryStatusTracking lookup for the active-todo branch.
            var assignedOn = enquiry.UpdatedOn ?? enquiry.CreatedOn;
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceEnquiry, enquiry.Id.ToString(), enquiry.HandlerUserId!),
                AssignedToUserId = enquiry.HandlerUserId,
                TaskCategory = TeamManagementConstants.CategoryEnquiries,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(enquiry.SLAEndTime, enquiry.CreatedOn)
            });
        }

        var latestContentProcessedByEnquiry = trackingRows
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
            var isContentCurrentOwner = enquiry.DepartmentId == DepartmentId;
            var isCurrentlyProcessingInContent =
                isContentCurrentOwner
                && enquiry.EnquiryStatusId == (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing;
            latestContentProcessedByEnquiry.TryGetValue(enquiry.Id, out var latestContentProcessed);

            if (isCurrentlyProcessingInContent
                || latestContentProcessed == null)
            {
                continue;
            }

            var ownerId = latestContentProcessed.CreatedBy;
            if (string.IsNullOrWhiteSpace(ownerId)
                || !memberIds.Contains(ownerId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var completedOn = latestContentProcessed?.CreatedOn
                ?? enquiry.UpdatedOn
                ?? enquiry.CreatedOn;
            var assignedOn = ResolveEnquiryAssignedOn(trackingRows, enquiry.Id, ownerId, completedOn, enquiry.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceEnquiry, enquiry.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = TeamManagementConstants.CategoryEnquiries,
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

    private async Task<List<TeamTaskMetricContext>> LoadOptimizedRefundMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        CancellationToken cancellationToken)
    {
        var refundIds = await ContentTeamManagementMembersOptimizedQuery
            .BuildRefundMetricCandidateIds(
                DbContext,
                DepartmentId,
                memberIds,
                rangeStart,
                rangeEnd)
            .ToListAsync(cancellationToken);
        if (refundIds.Count == 0)
        {
            return [];
        }

        var now = DateTimeHelper.Now;
        var refunds = await DbContext.Refunds
            .AsNoTracking()
            .Where(x => refundIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var trackingRows = await DbContext.RefundStatusTrackings
            .AsNoTracking()
            .Where(x => x.RefundId.HasValue && refundIds.Contains(x.RefundId.Value))
            .ToListAsync(cancellationToken);
        var metrics = new List<TeamTaskMetricContext>();

        foreach (var refund in refunds.Where(x =>
                     x.StatusId == (short)TicketRefundsStatusEnum.DepartmentProcessing
                     && !string.IsNullOrWhiteSpace(x.HandlerUserId)
                     && memberIds.Contains(x.HandlerUserId!, StringComparer.OrdinalIgnoreCase)))
        {
            var assignedOn = ResolveRefundAssignedOn(trackingRows, refund.Id, refund.HandlerUserId!, null, refund.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceRefund, refund.Id.ToString(), refund.HandlerUserId!),
                AssignedToUserId = refund.HandlerUserId,
                TaskCategory = TeamManagementConstants.CategoryRefunds,
                AssignmentMoments = [assignedOn],
                ProcessingMinutes = Math.Max((now - assignedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(refund.SLAEndTime, refund.CreatedOn)
            });
        }

        foreach (var row in trackingRows.Where(x =>
                     x.DepartmentId == DepartmentId
                     && ((x.ToStatusId == (int)TicketRefundsStatusEnum.DepartmentProcessed)
                         || (x.ToStatusId == (int)TicketRefundsStatusEnum.Cancelled))))
        {
            var refund = refunds.FirstOrDefault(x => x.Id == row.RefundId);
            var ownerId = row.CreatedBy;
            if (refund == null
                || string.IsNullOrWhiteSpace(ownerId)
                || !memberIds.Contains(ownerId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var assignedOn = ResolveRefundAssignedOn(trackingRows, refund.Id, ownerId, row.CreatedOn, refund.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceRefund, refund.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = TeamManagementConstants.CategoryRefunds,
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

    private async Task<List<TeamTaskMetricContext>> LoadOptimizedAppealMetricTasksAsync(
        string[] memberIds,
        DateTime rangeStart,
        DateTime rangeEnd,
        Department? department,
        CancellationToken cancellationToken)
    {
        if (department == null)
        {
            return [];
        }

        var appealIds = await ContentTeamManagementMembersOptimizedQuery
            .BuildAppealMetricCandidateIds(
                DbContext,
                memberIds,
                rangeStart,
                rangeEnd,
                department.Code,
                department.NameEn)
            .ToListAsync(cancellationToken);
        if (appealIds.Count == 0)
        {
            return [];
        }

        var now = DateTimeHelper.Now;
        var appeals = await DbContext.InspectionViolationAppeals
            .AsNoTracking()
            .Where(x => appealIds.Contains(x.Id))
            .ToListAsync(cancellationToken);
        var timelineEvents = await DbContext.InspectionAppealTimelineEvents
            .AsNoTracking()
            .Where(x => appealIds.Contains(x.AppealId))
            .ToListAsync(cancellationToken);
        var latestTargetMap = timelineEvents
            .Where(x => !string.IsNullOrWhiteSpace(x.TargetDepartmentCode)
                        || !string.IsNullOrWhiteSpace(x.TargetDepartmentName)
                        || !string.IsNullOrWhiteSpace(x.TargetHandlerUserId))
            .GroupBy(x => x.AppealId)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(t => t.CreatedOn).ThenByDescending(t => t.Id).First());
        var metrics = new List<TeamTaskMetricContext>();

        foreach (var appeal in appeals.Where(x => x.StatusId == (int)InspectionAppealStatus.DepartmentProcessing))
        {
            if (!latestTargetMap.TryGetValue(appeal.Id, out var latestTargetEvent)
                || !DepartmentMatches(department, latestTargetEvent.TargetDepartmentCode, latestTargetEvent.TargetDepartmentName)
                || string.IsNullOrWhiteSpace(latestTargetEvent.TargetHandlerUserId)
                || !memberIds.Contains(latestTargetEvent.TargetHandlerUserId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceAppeal, appeal.Id.ToString(), latestTargetEvent.TargetHandlerUserId),
                AssignedToUserId = latestTargetEvent.TargetHandlerUserId,
                TaskCategory = TeamManagementConstants.CategoryAppeals,
                AssignmentMoments = [latestTargetEvent.CreatedOn],
                ProcessingMinutes = Math.Max((now - latestTargetEvent.CreatedOn).TotalMinutes, 0),
                CountsAsCompleted = false,
                IncludeInAverage = false,
                IsActiveTodo = true,
                SlaTargetMinutes = BuildSlaTargetMinutes(appeal.SlaDueOn, appeal.CreatedOn)
            });
        }

        foreach (var row in timelineEvents.Where(x =>
                     ((x.ToStatusId == (int)InspectionAppealStatus.DepartmentProcessed)
                      || (x.ToStatusId == (int)InspectionAppealStatus.Cancelled))
                     && (DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName)
                         || DepartmentMatches(department, x.ActorDepartmentCode, x.ActorDepartmentName))))
        {
            var appeal = appeals.FirstOrDefault(x => x.Id == row.AppealId);
            var ownerId = row.ActorUserId ?? row.TargetHandlerUserId;
            if (appeal == null
                || string.IsNullOrWhiteSpace(ownerId)
                || !memberIds.Contains(ownerId, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            var assignedOn = ResolveAppealAssignedOn(timelineEvents, department, appeal.Id, ownerId, row.CreatedOn, appeal.CreatedOn);
            metrics.Add(new TeamTaskMetricContext
            {
                GroupKey = BuildMetricGroupKey(TeamManagementConstants.SourceAppeal, appeal.Id.ToString(), ownerId),
                AssignedToUserId = ownerId,
                TaskCategory = TeamManagementConstants.CategoryAppeals,
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

    private Dictionary<string, TeamManagementMemberMetricDto> BuildOptimizedMemberMetrics(
        List<TeamTaskMetricContext> tasks,
        string userId,
        DateTime rangeStart,
        DateTime rangeEnd,
        bool applicationTaskOnly)
    {
        var metrics = new Dictionary<string, TeamManagementMemberMetricDto>(StringComparer.OrdinalIgnoreCase);
        var memberTasks = tasks.Where(x => string.Equals(x.AssignedToUserId, userId, StringComparison.OrdinalIgnoreCase)).ToList();

        foreach (var category in GetCategorySequence(applicationTaskOnly))
        {
            var categoryTasks = string.Equals(category, TeamManagementConstants.CategoryAll, StringComparison.OrdinalIgnoreCase)
                ? memberTasks
                : memberTasks.Where(x => string.Equals(x.TaskCategory, category, StringComparison.OrdinalIgnoreCase)).ToList();
            metrics[category] = CalculateOptimizedMetric(categoryTasks, rangeStart, rangeEnd);
        }

        return metrics;
    }

    private static TeamManagementMemberMetricDto CalculateOptimizedMetric(
        List<TeamTaskMetricContext> tasks,
        DateTime rangeStart,
        DateTime rangeEnd)
    {
        var assignedTasks = tasks
            .GroupBy(x => x.GroupKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => AggregateOptimizedMetricContext(group.ToList()))
            .Where(x => x.AssignmentMoments.Any(moment => moment >= rangeStart && moment <= rangeEnd))
            .ToList();
        var completedTasks = assignedTasks.Where(x => x.CountsAsCompleted).ToList();
        var avgTasks = completedTasks.Where(x => x.IncludeInAverage && x.ProcessingMinutes.HasValue).ToList();

        return new TeamManagementMemberMetricDto
        {
            CompletedTasks = completedTasks.Count,
            TotalAssignedTasks = assignedTasks.Count,
            AvgProcessingTime = avgTasks.Count == 0 ? 0 : Math.Round(avgTasks.Average(x => x.ProcessingMinutes!.Value), 2),
            SlaCompliance = completedTasks.Count == 0 ? 0 : Math.Round((decimal)completedTasks.Count(x => x.CompletedWithinSla) * 100m / completedTasks.Count, 2),
            OverdueTasks = assignedTasks.Count(x => x.IsOverdueActive)
        };
    }

    private static TeamTaskMetricContext AggregateOptimizedMetricContext(List<TeamTaskMetricContext> contexts)
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

        return new TeamTaskMetricContext
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

    private static string BuildMetricGroupKey(string sourceType, string sourceId, string ownerId)
        => $"{sourceType}::{sourceId}::{ownerId}";

    private string? NormalizeTaskCategory(string? category)
    {
        var value = NormalizeText(category);
        if (value == null)
        {
            return null;
        }

        return GetCategorySequence(applicationTaskOnly: false)
            .FirstOrDefault(code =>
                string.Equals(code, value, StringComparison.OrdinalIgnoreCase)
                || string.Equals(GetCategoryDisplay(code), value, StringComparison.OrdinalIgnoreCase))
            ?? value;
    }

    private async Task<List<TeamManagementOptionDto>> BuildWorkflowStatusOptionsAsync()
    {
        var serviceIds = await DbContext.ServiceConfigs
            .AsNoTracking()
            .Where(x => x.Department == DepartmentId)
            .Select(x => x.Id)
            .Distinct()
            .ToListAsync();
        if (serviceIds.Count == 0)
        {
            return await BuildFallbackWorkflowStatusOptionsAsync();
        }

        var workflowConfigurationIds = await DbContext.WorkflowConfigurations
            .AsNoTracking()
            .Where(x => serviceIds.Contains(x.ServiceId))
            .GroupBy(x => x.ServiceId)
            .Select(group => group
                .OrderByDescending(x => x.Status == "5") // "5" = Published; literal "Published" never matched the numeric status code
                .ThenByDescending(x => x.CreatedOn ?? DateTime.MinValue)
                .ThenByDescending(x => x.Id)
                .Select(x => x.Id)
                .First())
            .ToListAsync();
        if (workflowConfigurationIds.Count == 0)
        {
            return await BuildFallbackWorkflowStatusOptionsAsync();
        }

        var configuredNodeOrders = await DbContext.WorkflowNodes
            .AsNoTracking()
            .Where(x => workflowConfigurationIds.Contains(x.WorkflowConfigurationId)
                        && x.NodeType == "userTask"
                        && x.ApprovalDepartment == DepartmentId
                        && x.NodeOrder >= (int)ApprovalNodeOrder.InitialApproval
                        && x.NodeOrder <= (int)ApprovalNodeOrder.FinalApproval)
            .Select(x => x.NodeOrder)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();

        var result = new List<TeamManagementOptionDto>();
        foreach (var nodeOrder in configuredNodeOrders)
        {
            var display = await ResolveTypeDictionaryNameAsync("ApprovalNodeOrder", nodeOrder.ToString());
            if (string.IsNullOrWhiteSpace(display))
            {
                continue;
            }

            result.Add(new TeamManagementOptionDto
            {
                Code = display,
                Display = display
            });
        }

        foreach (var statusId in new[] { (int)ApprovalNodeOrder.ExternalApproval, (int)ApprovalNodeOrder.PendingModification })
        {
            var display = await ResolveTypeDictionaryNameAsync("ApprovalNodeOrder", statusId.ToString());
            if (string.IsNullOrWhiteSpace(display))
            {
                continue;
            }

            result.Add(new TeamManagementOptionDto
            {
                Code = display,
                Display = display
            });
        }

        return result.Count == 0 ? await BuildFallbackWorkflowStatusOptionsAsync() : result;
    }

    private async Task<List<TeamManagementOptionDto>> BuildContentTaskQueryTodoStatusOptionsAsync(bool applicationTaskOnly)
    {
        var options = await BuildContentApplicationTodoStatusOptionsAsync();
        options.AddRange(await BuildContentTaskQueryStatusOptionsAsync(TeamManagementConstants.ViewTodo, applicationTaskOnly));
        if (!applicationTaskOnly)
        {
            options.AddRange(await BuildContentOtherTaskTodoStatusOptionsAsync());
            options.Add(BuildStatusDisplayOption(
                CurrentUserService.IsArabicLanguage ? "بانتظار مراجعة المحتوى" : "Pending Content Review"));
        }

        return DeduplicateStatusDisplayOptions(options);
    }

    private async Task<List<TeamManagementOptionDto>> BuildContentTaskQueryCompletedStatusOptionsAsync(bool applicationTaskOnly)
    {
        var options = await BuildContentTaskQueryStatusOptionsAsync(TeamManagementConstants.ViewCompleted, applicationTaskOnly);
        if (!applicationTaskOnly)
        {
            options.AddRange(await BuildContentOtherTaskCompletedStatusOptionsAsync());
            options.Add(BuildStatusDisplayOption(
                CurrentUserService.IsArabicLanguage ? "اكتملت مراجعة المحتوى" : "Content Review Completed"));
        }

        return DeduplicateStatusDisplayOptions(options);
    }

    private async Task<List<TeamManagementOptionDto>> BuildContentTaskQueryStatusOptionsAsync(string view, bool applicationTaskOnly)
    {
        var department = applicationTaskOnly ? null : await LoadDepartmentAsync();
        var query = BuildContentTaskQuery(
            new TeamManagementTaskQueryRequest
            {
                View = view,
                ApplicationTaskOnly = applicationTaskOnly
            },
            applicationTaskOnly,
            null,
            department?.Code,
            department?.NameEn);

        var statusDisplays = await query
            .Select(row => row.StatusText)
            .Where(status => status != null && status.Trim() != string.Empty)
            .Distinct()
            .ToListAsync();

        return DeduplicateStatusDisplayOptions(statusDisplays.Select(BuildStatusDisplayOption));
    }

    private static TeamManagementOptionDto BuildStatusDisplayOption(string display)
        => new()
        {
            Code = display,
            Display = display
        };

    private async Task<List<TeamManagementOptionDto>> BuildContentApplicationTodoStatusOptionsAsync()
    {
        var options = new List<TeamManagementOptionDto>();
        foreach (var statusId in new[]
                 {
                     (int)ApprovalNodeOrder.InitialApproval,
                     (int)ApprovalNodeOrder.FinalApproval,
                     (int)ApprovalNodeOrder.ExternalApproval,
                     (int)ApprovalNodeOrder.PendingModification
                 })
        {
            var display = await ResolveTypeDictionaryNameAsync("ApprovalNodeOrder", statusId.ToString());
            if (!string.IsNullOrWhiteSpace(display))
            {
                options.Add(BuildStatusDisplayOption(display));
            }
        }

        foreach (var statusId in new[]
                 {
                     (int)ApplicationStatus.PendingDisposition,
                     (int)ApplicationStatus.DispositionVerification
                 })
        {
            var display = await ResolveTypeDictionaryNameAsync("ApplicationStatuses", statusId.ToString());
            if (!string.IsNullOrWhiteSpace(display))
            {
                options.Add(BuildStatusDisplayOption(display));
            }
        }

        return options;
    }

    private async Task<List<TeamManagementOptionDto>> BuildContentOtherTaskTodoStatusOptionsAsync()
    {
        var options = new List<TeamManagementOptionDto>();
        options.AddRange(await BuildTypeDictionaryStatusOptionsAsync(
            "InquiryStatusAdmin",
            [
                //(int)EnquiryEnum.EnquiryAdminStatus.Open,
                //(int)EnquiryEnum.EnquiryAdminStatus.PendingCustomer,
                (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing,
                //(int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed
            ]));
        options.AddRange(await BuildTypeDictionaryStatusOptionsAsync(
            "Refund Status",
            [
                (int)TicketRefundsStatusEnum.DepartmentProcessing,
                //(int)TicketRefundsStatusEnum.DepartmentProcessed,
                //(int)TicketRefundsStatusEnum.PendingCustomer,
                //(int)TicketRefundsStatusEnum.PendingRefund
            ]));
        options.AddRange(new[]
        {
           // (int)InspectionAppealStatus.Pending,
            (int)InspectionAppealStatus.DepartmentProcessing,
            //(int)InspectionAppealStatus.DepartmentProcessed,
            //(int)InspectionAppealStatus.PendingCustomer
        }.Select(statusId => new TeamManagementOptionDto
        {
            Code = GetAppealStatusDisplay(statusId),
            Display = GetAppealStatusDisplay(statusId)
        }));

        return options;
    }

    private async Task<List<TeamManagementOptionDto>> BuildContentOtherTaskCompletedStatusOptionsAsync()
    {
        var options = new List<TeamManagementOptionDto>();
        options.AddRange(await BuildTypeDictionaryStatusOptionsAsync(
            "InquiryStatusAdmin",
            [
                (int)EnquiryEnum.EnquiryAdminStatus.Open,
                (int)EnquiryEnum.EnquiryAdminStatus.PendingCustomer,
                (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing,
                (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed,
                (int)EnquiryEnum.EnquiryAdminStatus.Resolved,
                (int)EnquiryEnum.EnquiryAdminStatus.Completed,
                (int)EnquiryEnum.EnquiryAdminStatus.Cancelled
            ]));
        options.AddRange(await BuildTypeDictionaryStatusOptionsAsync(
            "Refund Status",
            [
                (int)TicketRefundsStatusEnum.DepartmentProcessing,
                (int)TicketRefundsStatusEnum.DepartmentProcessed,
                (int)TicketRefundsStatusEnum.Rejected,
                (int)TicketRefundsStatusEnum.Refunded,
                (int)TicketRefundsStatusEnum.Cancelled
            ]));
        options.AddRange(new[]
        {
            (int)InspectionAppealStatus.Pending,
            (int)InspectionAppealStatus.DepartmentProcessing,
            (int)InspectionAppealStatus.DepartmentProcessed,
            (int)InspectionAppealStatus.PendingCustomer,
            (int)InspectionAppealStatus.Approved,
            (int)InspectionAppealStatus.Rejected,
            (int)InspectionAppealStatus.Cancelled,
            (int)InspectionAppealStatus.Resolved
        }.Select(statusId => new TeamManagementOptionDto
        {
            Code = GetAppealStatusDisplay(statusId),
            Display = GetAppealStatusDisplay(statusId)
        }));

        return options;
    }

    private static List<TeamManagementOptionDto> DeduplicateStatusDisplayOptions(IEnumerable<TeamManagementOptionDto> options)
    {
        return options
            .Where(option => !string.IsNullOrWhiteSpace(option.Display))
            .GroupBy(option => option.Display, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();
    }

    private async Task<List<TeamManagementOptionDto>> BuildFallbackWorkflowStatusOptionsAsync()
    {
        var result = new List<TeamManagementOptionDto>();
        foreach (var statusId in new[]
                 {
                     (int)ApprovalNodeOrder.InitialApproval,
                     (int)ApprovalNodeOrder.FinalApproval,
                     (int)ApprovalNodeOrder.ExternalApproval,
                     (int)ApprovalNodeOrder.PendingModification
                 })
        {
            var display = await ResolveTypeDictionaryNameAsync("ApprovalNodeOrder", statusId.ToString());
            if (string.IsNullOrWhiteSpace(display))
            {
                continue;
            }

            result.Add(new TeamManagementOptionDto
            {
                Code = BuildStatusFilterCode(WorkflowStatusDomain, statusId.ToString()),
                Display = display
            });
        }

        return result;
    }

    private async Task<List<TeamManagementOptionDto>> BuildDispositionStatusOptionsAsync()
    {
        var result = new List<TeamManagementOptionDto>();
        foreach (var code in new[]
                 {
                     ((int)DispositionVerificationStatus.PendingDisposition).ToString(),
                     ((int)DispositionVerificationStatus.DispositionVerification).ToString(),
                     ((int)DispositionVerificationStatus.Verified).ToString(),
                     ((int)DispositionVerificationStatus.NotVerified).ToString()
                 })
        {
            var display = await ResolveTypeDictionaryNameAsync("DispositionVerificationStatus", code);
            if (string.IsNullOrWhiteSpace(display))
            {
                continue;
            }

            result.Add(new TeamManagementOptionDto
            {
                Code = display,
                Display = display
            });
        }

        return result;
    }

    private async Task<List<TeamManagementOptionDto>> BuildTypeDictionaryStatusOptionsAsync(string scope, string statusDomain)
    {
        return (await TypeDictionaryService.GetListAsync(scope))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .Select(x => new TeamManagementOptionDto
            {
                Code = CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!,
                Display = CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!
            })
            .ToList();
    }

    private async Task<List<TeamManagementOptionDto>> BuildTypeDictionaryStatusOptionsAsync(
        string scope,
        IReadOnlyCollection<int> statusIds)
    {
        var statusCodes = statusIds.Select(x => x.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return (await TypeDictionaryService.GetListAsync(scope))
            .Where(x => !string.IsNullOrWhiteSpace(x.Code) && statusCodes.Contains(x.Code))
            .Select(x => new TeamManagementOptionDto
            {
                Code = CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!,
                Display = CurrentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr)
                    ? x.NameAr!
                    : x.NameEn ?? x.Code!
            })
            .ToList();
    }

    private List<TeamManagementOptionDto> BuildAppealStatusOptions()
    {
        return new[]
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
            .Select(x => new TeamManagementOptionDto
            {
                Code = GetAppealStatusDisplay(x),
                Display = GetAppealStatusDisplay(x)
            })
            .ToList();
    }

    private string GetAppealStatusDisplay(int statusId)
        => statusId switch
        {
            (int)InspectionAppealStatus.Pending => CurrentUserService.IsArabicLanguage ? "قيد الانتظار" : "Pending",
            (int)InspectionAppealStatus.DepartmentProcessing => CurrentUserService.IsArabicLanguage ? "قيد المعالجة لدى الإدارة" : "Department Processing",
            (int)InspectionAppealStatus.DepartmentProcessed => CurrentUserService.IsArabicLanguage ? "تمت المعالجة لدى الإدارة" : "Department Processed",
            (int)InspectionAppealStatus.PendingCustomer => CurrentUserService.IsArabicLanguage ? "بانتظار المتعامل" : "Pending Customer",
            (int)InspectionAppealStatus.Approved => CurrentUserService.IsArabicLanguage ? "معتمد" : "Approved",
            (int)InspectionAppealStatus.Rejected => CurrentUserService.IsArabicLanguage ? "مرفوض" : "Rejected",
            (int)InspectionAppealStatus.Cancelled => CurrentUserService.IsArabicLanguage ? "ملغي" : "Cancelled",
            (int)InspectionAppealStatus.Resolved => CurrentUserService.IsArabicLanguage ? "تم الحل" : "Resolved",
            _ => statusId.ToString()
        };

    private static double? BuildSlaTargetMinutes(DateTime? dueOn, DateTime createdOn)
    {
        return dueOn.HasValue ? Math.Max((dueOn.Value - createdOn).TotalMinutes, 0) : (double?)null;
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

    private static DateTime ResolveEnquiryAssignedOn(List<EnquiryStatusTracking> trackingRows, int enquiryId, string ownerId, DateTime? beforeOn, DateTime fallback)
    {
        var candidates = trackingRows
            .Where(x => x.EnquiryId == enquiryId
                        && x.DepartmentId == (short)DepartmentEnum.Content
                        && x.ToStatusId == (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing);
        if (beforeOn.HasValue)
        {
            candidates = candidates.Where(x => x.CreatedOn <= beforeOn.Value);
        }

        return candidates
            .OrderByDescending(x => x.CreatedOn)
            .Select(x => x.CreatedOn)
            .FirstOrDefault(fallback);
    }

    private static DateTime ResolveRefundAssignedOn(List<RefundStatusTracking> trackingRows, int refundId, string ownerId, DateTime? beforeOn, DateTime fallback)
    {
        var candidates = trackingRows
            .Where(x => x.RefundId == refundId && string.Equals(x.CreatedBy, ownerId, StringComparison.OrdinalIgnoreCase));
        if (beforeOn.HasValue)
        {
            candidates = candidates.Where(x => x.CreatedOn <= beforeOn.Value);
        }

        return candidates
            .OrderByDescending(x => x.CreatedOn)
            .Select(x => x.CreatedOn)
            .FirstOrDefault(fallback);
    }

    private static DateTime ResolveAppealAssignedOn(List<InspectionAppealTimelineEvent> timelineEvents, Department department, int appealId, string ownerId, DateTime? beforeOn, DateTime fallback)
    {
        var candidates = timelineEvents
            .Where(x => x.AppealId == appealId
                        && string.Equals(x.TargetHandlerUserId, ownerId, StringComparison.OrdinalIgnoreCase)
                        && DepartmentMatches(department, x.TargetDepartmentCode, x.TargetDepartmentName));
        if (beforeOn.HasValue)
        {
            candidates = candidates.Where(x => x.CreatedOn <= beforeOn.Value);
        }

        return candidates
            .OrderByDescending(x => x.CreatedOn)
            .Select(x => x.CreatedOn)
            .FirstOrDefault(fallback);
    }
}

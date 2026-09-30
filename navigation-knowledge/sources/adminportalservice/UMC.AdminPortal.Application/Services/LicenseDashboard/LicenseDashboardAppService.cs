using UMC.AdminPortal.Application.Dtos.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Globalization;
using UMC.AdminPortal.Application.Dtos;
using UMC.AdminPortal.Application.Dtos.LicenseDashboard;
using UMC.AdminPortal.Application.Dtos.Licensing;
using UMC.AdminPortal.Application.Services.LicensingTeamManagement;
using UMC.AdminPortal.Application.Services;
using UMC.AdminPortal.Application.Utilities;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Domain.Models.Workflow;

using UMC.AdminPortal.Domain.Service.Account;
using UMC.AdminPortal.Domain.Service.License;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.Utils.Framework.Page;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.Page;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Helps;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Share;
using AppDashboardScope = UMC.AdminPortal.Application.Dtos.LicenseDashboard.DashboardScope;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Shares.Enums;
using DomainMemberPerformanceDto = UMC.AdminPortal.Domain.Share.MemberPerformanceDto;
using AppMemberOnLeaveDto = UMC.AdminPortal.Application.Dtos.LicenseDashboard.MemberOnLeaveDto;
using AppServiceDistributionDto = UMC.AdminPortal.Application.Dtos.LicenseDashboard.ServiceDistributionDto;
using AppServiceRankingDto = UMC.AdminPortal.Application.Dtos.LicenseDashboard.ServiceRankingDto;
using DomainAttentionTaskDto = UMC.AdminPortal.Domain.Share.AttentionTaskDto;
using AppAttentionTaskDto = UMC.AdminPortal.Application.Dtos.LicenseDashboard.AttentionTaskDto;
using RepositoryDashboardScope = UMC.AdminPortal.Domain.Share.DashboardScope;

namespace UMC.AdminPortal.Application.Services.LicenseDashboard;

/// <summary>
/// Application service implementation for License Dashboard
/// </summary>
[InjectOnScoped]
public class LicenseDashboardAppService : ILicenseDashboardAppService
{
private readonly ILicenseDashboardRepository _repository;
private readonly ILicenseManagementService _licenseManagementService;
private readonly IBaseRepository<User> _userRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUserService _userService;
    private readonly FreeRedisHelper? _redis;
    private readonly ITypeDictionaryService _typeDictionaryService;
    private readonly SlaCalculator _slaCalculator;
    private readonly LicensingTeamManagementAppService _licensingTeamMgmt;
    private readonly IApplicationAppService _applicationAppService;
    private readonly IBaseRepository<UserDepartmentModel> _userDepartmentRepository;
    private readonly IBaseRepository<UserProfile> _userProfileRepository;
    private readonly IBaseRepository<LeaveLogModel> _leaveLogRepository;
    private readonly AdminPortalDBContext _dbContext;
    private readonly DashboardCacheSettings _cacheSettings;

    private const string ServiceApplicationStatusScope = "ApprovalNodeOrder";
    private const string UserProfileStatusScope = "UserProfileStatus_Admin";

    public LicenseDashboardAppService(
ILicenseDashboardRepository repository,
ILicenseManagementService licenseManagementService,
IBaseRepository<User> userRepository,
        ICurrentUserService currentUser,
        IUserService userService,
        ITypeDictionaryService typeDictionaryService,
        LicensingTeamManagementAppService licensingTeamMgmt,
        IApplicationAppService applicationAppService,
        IBaseRepository<UserDepartmentModel> userDepartmentRepository,
        IBaseRepository<UserProfile> userProfileRepository,
        IBaseRepository<LeaveLogModel> leaveLogRepository,
        AdminPortalDBContext dbContext,
        FreeRedisHelper? redis = null,
        IOptions<DashboardCacheSettings>? cacheSettings = null)
    {
_repository = repository ?? throw new ArgumentNullException(nameof(repository));
_licenseManagementService = licenseManagementService ?? throw new ArgumentNullException(nameof(licenseManagementService));
_userRepository = userRepository ?? throw new ArgumentNullException(nameof(userRepository));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _userService = userService ?? throw new ArgumentNullException(nameof(userService));
        _redis = redis;
        _typeDictionaryService = typeDictionaryService ?? throw new ArgumentNullException(nameof(typeDictionaryService));
        _licensingTeamMgmt = licensingTeamMgmt ?? throw new ArgumentNullException(nameof(licensingTeamMgmt));
        _applicationAppService = applicationAppService ?? throw new ArgumentNullException(nameof(applicationAppService));
        _userDepartmentRepository = userDepartmentRepository ?? throw new ArgumentNullException(nameof(userDepartmentRepository));
        _userProfileRepository = userProfileRepository ?? throw new ArgumentNullException(nameof(userProfileRepository));
        _leaveLogRepository = leaveLogRepository ?? throw new ArgumentNullException(nameof(leaveLogRepository));
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _slaCalculator = new SlaCalculator();
        _cacheSettings = cacheSettings?.Value ?? new DashboardCacheSettings();
    }


    // Canonical English label for an ApprovalNodeOrder code (StatusDisplayOnly in the read view is
    // always the English NameEn regardless of UI language), used to classify To Do rows by their
    // PROCESS status rather than RawStatusCode's task-node skew.
    private async Task<string?> ResolveApprovalNodeLabelAsync(ApprovalNodeOrder node)
    {
        var dict = await _typeDictionaryService.GetByCodeAsync(
            ServiceApplicationStatusScope, ((int)node).ToString());
        return dict?.NameEn ?? dict?.Code;
    }

    // Normalize a status label for tolerant comparison: strip spaces, lowercase, invariant.
    private static string NormalizeStatusKey(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Replace(" ", string.Empty).ToLowerInvariant();
    private string BuildOverviewCacheKey(
        string userId,
        TaskCategory category,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate)
        => string.Join(":",
            DashboardCacheKeys.Overview(userId, category, scope, startDate, endDate),
            "lang",
            NormalizeStatusKey(_currentUser.GetLanguageOrDefault()));

    /// <summary>
    /// Get dashboard overview (My Tasks + Task Hub merged)
    /// </summary>
    public async Task<DashboardOverviewResponse> GetDashboardOverviewAsync(
        DashboardOverviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = RequireCurrentUserId();

        // Try get from cache
        // Role-based scope: Manager => whole department data; Staff => only own data.
        var (roleScope, roleDepartmentId) = await ResolveRoleScopeAsync().ConfigureAwait(false);

        // Honor an explicit Department request scope: the client sends scope=1 to force the
        // department view (the ring/cards must then match /api/licensing/team-management/tasks/query,
        // e.g. Pending Review = 122). Role only ELEVATES — a manager still gets department data even
        // when the request asks for Personal — so take the wider of the two scopes.
        var scope = request.Scope == AppDashboardScope.Department || roleScope == AppDashboardScope.Department
            ? AppDashboardScope.Department
            : AppDashboardScope.Personal;
        var departmentId = scope == AppDashboardScope.Department
            ? (roleDepartmentId ?? DashboardRoleDepartmentId)
            : (int?)null;

        var cacheKey = BuildOverviewCacheKey(
            userId,
            request.TaskCategory,
            scope,
            request.StartDate,
            request.EndDate);
        if (_redis != null)
        {
            try
            {
                var cached = await _redis.GetAsync<DashboardOverviewResponse>(cacheKey);
                if (cached != null) return cached;
            }
            catch (Exception ex) { /* Redis unavailable, continue without cache */ }
        }

        var response = new DashboardOverviewResponse();
        var needPersonalServiceRows = request.TaskCategory == TaskCategory.ServiceApplication
                                      || scope == AppDashboardScope.Personal;
        var personalServiceSnapshot = await LoadPersonalServiceApplicationSnapshotAsync(
            request.StartDate,
            request.EndDate,
            includeTodoRows: needPersonalServiceRows,
            includeCompleted: scope == AppDashboardScope.Personal,
            cancellationToken);

        // === Part 1: My Tasks - Tab Counts (role-based: Manager => department, Staff => personal) ===
        response.TaskTabCounts = await GetTaskTabCountsAsync(userId, scope, request.StartDate, request.EndDate, departmentId, personalServiceSnapshot, cancellationToken);

        // === Part 2: My Tasks - Priority Cards for selected category (role-based scope) ===
        response.PriorityCards = await GetPriorityCardsAsync(
            userId,
            scope,
            request.TaskCategory,
            request.PriorityCardCount,
            request.StartDate,
            request.EndDate,
            departmentId,
            personalServiceSnapshot,
            cancellationToken);

        // === Part 3: Task Hub - Summary Cards for all 5 types ===
        // Leader → department-wide (matches MyTeamTodoPage.statusCount);
        // Non-leader → personal (matches MyTodoPage.statusCount).
        response.ServiceApplicationCard = await BuildServiceApplicationCardAsync(userId, scope, request.StartDate, request.EndDate, departmentId, personalServiceSnapshot, cancellationToken);
        response.ProfileVerificationCard = await BuildProfileVerificationCardAsync(userId, scope, request.StartDate, request.EndDate, departmentId, cancellationToken);
        response.EnquiryCard = await BuildEnquiryCardAsync(userId, scope, request.StartDate, request.EndDate, departmentId, cancellationToken);
        response.RefundCard = await BuildRefundCardAsync(userId, scope, request.StartDate, request.EndDate, departmentId, cancellationToken);
        response.AppealCard = await BuildAppealCardAsync(userId, scope, request.StartDate, request.EndDate, departmentId, cancellationToken);

        if (_redis != null)
        {
            try { await _redis.SetAsync(cacheKey, response, TimeSpan.FromSeconds(_cacheSettings.StandardSeconds)); }
            catch (Exception ex) { /* Redis unavailable, skip cache write */ }
        }

        return response;
    }

    /// <summary>
    /// Get task counts for all 5 categories
    /// </summary>
    private async Task<Dictionary<string, int>> GetTaskTabCountsAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        PersonalServiceApplicationSnapshot? personalServiceSnapshot,
        CancellationToken cancellationToken)
    {
        var counts = new Dictionary<string, int>();

        // ServiceApplication tab count is from the personal click perspective and must match
        // api/Application/MyTodoPage, even for leader users. The old GetApplicationTodoStatusCountAsync
        // path took ONLY a departmentId and ignored the overview date range entirely — so the tab
        // count never honored StartDate/EndDate. Instead derive it from the SAME date-filtered
        // pipeline GetMyReviewPageAsync uses (StartTime/EndTime filter LastUpdatedTime), and read the
        // total (Page.Total) of the status=1 (todo) result so the count reflects the requested window.
        var serviceAppTodoCount = personalServiceSnapshot?.TodoTotal ?? 0;
        counts[TaskCategory.ServiceApplication.ToString()] = serviceAppTodoCount;
        counts[TaskCategory.ProfileVerification.ToString()] = await GetPendingProfileVerificationCountAsync(userId, startDate, endDate, cancellationToken);
        // Enquiries: always personal scope (HandlerUserId == currentUser).
        counts[TaskCategory.Enquiries.ToString()] = (await GetEnquiryCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken)).Count;
        // Enquiries / Refunds / Appeals tab counts: always personal scope so that leaders see
        // only their own assigned tasks, matching the priority-card scope below.
        counts[TaskCategory.Refunds.ToString()] = (await GetRefundCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken)).Count;
        counts[TaskCategory.Appeals.ToString()] = (await GetAppealCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken)).Count;

        return counts;
    }

    /// <summary>
    /// Get priority task cards for selected category, sorted by SLA urgency
    /// </summary>
    private async Task<List<PriorityTaskCardDto>> GetPriorityCardsAsync(
        string userId,
        AppDashboardScope scope,
        TaskCategory category,
        int maxCards,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        PersonalServiceApplicationSnapshot? personalServiceSnapshot,
        CancellationToken cancellationToken)
    {
        var cards = new List<PriorityTaskCardDto>();

        switch (category)
        {
            case TaskCategory.ServiceApplication:
                // ServiceApplication priority cards are from the personal click perspective
                // and must match api/Application/MyTodoPage, even for leader users.
                // Keep serviceApplicationCard role-based separately; it intentionally
                // uses the department perspective for leaders.
                cards = await GetServiceApplicationCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, personalServiceSnapshot, cancellationToken);
                break;

            case TaskCategory.ProfileVerification:
                // Profile verification is permission-agnostic for both leaders and staff.
                // It must align with api/UserManagement/UserProfile/Approves?StatusId=2
                // for the same date range.
                cards = await GetProfileVerificationCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken);
                break;

            case TaskCategory.Enquiries:
                // Always personal scope: matches Enquiry/Management/List (HandlerUserId == currentUser).
                cards = await GetEnquiryCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken);
                break;

case TaskCategory.Refunds:
// Always personal scope: leaders see only their own refunds (HandlerUserId == me),
// matching the tab-count scope above.
cards = await GetRefundCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken);
break;

case TaskCategory.Appeals:
// Always personal scope: leaders see only their own appeals,
// matching the tab-count scope above.
cards = await GetAppealCardsAsync(userId, AppDashboardScope.Personal, startDate, endDate, departmentId, cancellationToken);
break;
        }

        // Priority order (docs/rules/sla-label-display-rule.md — "sortable"): most urgent first.
        //   1) Overdue first, most-overdue first
        //   2) then Remaining, least time left first
        //   3) then "-" (paused / not-applicable: PendingModification / ExternalApproval) last
        //
        // ServiceApplication (taskCategory=0) is BUILT via BuildSlaFromMyTodoRow, whose
        // RemainingMinutes uses MyTodoPage's OPPOSITE sign (positive = Overdue). GetService
        // ApplicationCardsAsync already applies this exact priority order for that convention, so we
        // must NOT re-sort it here. The other four categories come from SlaCalculator, where
        // RemainingMinutes is negative when overdue and positive when time remains — so a single
        // "nulls last, then ascending RemainingMinutes" ordering yields the same priority order
        // (most-overdue negatives first, then smallest positives, then nulls).
        if (category != TaskCategory.ServiceApplication)
        {
            cards = cards
                .OrderBy(c => c.Sla?.RemainingMinutes.HasValue == true ? 0 : 1)
                .ThenBy(c => c.Sla?.RemainingMinutes ?? 0)
                .ToList();
        }

        // priorityCards returns ALL matching cards regardless of the requested PriorityCardCount —
        // the frontend needs every card in one shot, so no paging/limit is applied here.
        return cards;
    }

    /// <summary>
    /// Builds an SLA payload IDENTICAL to api/Application/MyTodoPage.
    /// <paramref name="slaMinutes"/> follows MyTodoPage's sign convention:
    /// positive = Overdue, negative = Remaining, null => "-" (paused / no deadline).
    /// DisplayText uses the same ToSLAString formatter as MyTodoPage.slaDescription.
    /// </summary>
    private static SlaDto BuildMyTodoAlignedSla(double? slaMinutes, DateTime createdOn)
    {
        if (!slaMinutes.HasValue)
        {
            return new SlaDto
            {
                DisplayText = "-",
                StatusCode = SlaStatusCode.Paused,
                RemainingMinutes = null,
                Deadline = null,
                CreatedOn = createdOn
            };
        }

        return new SlaDto
        {
            // Unify to the global SLA label format (docs/rules/sla-label-display-rule.md):
            // "Due in {v}" / "{v} Overdue". MyTodoPage's slaMinutes is positive when Overdue,
            // so negate it to match SlaCalculator.FormatSlaDisplay (negative = Overdue).
            DisplayText = SlaCalculator.FormatSlaDisplay(-slaMinutes.Value),
            StatusCode = slaMinutes.Value > 0 ? SlaStatusCode.Overdue : SlaStatusCode.Remaining,
            RemainingMinutes = (int)Math.Round(slaMinutes.Value),
            Deadline = null,
            CreatedOn = createdOn
        };
    }

    // === Service Application Helper Methods ===

    // Collapse the multi-level review nodes (Initial/Secondary/Tertiary/Senior/Executive/Final
    // Approval, ApprovalNodeOrder 2..7) into the single "Pending Review" label so a priorityCard's
    // status matches the type set counted by serviceApplicationCard.slaDistribution.pendingReview
    // (reviewIds in GetServiceApplicationCardCountsAsync). Non-review states keep their raw label.
    private static string ResolvePriorityCardStatus(int? statusId, string rawStatus)
    {
        if (statusId is >= (int)ApprovalNodeOrder.InitialApproval and <= (int)ApprovalNodeOrder.FinalApproval)
            return "Pending Review";
        return rawStatus;
    }

    private sealed class PersonalServiceApplicationSnapshot
    {
        public int TodoTotal { get; init; }
        public List<MyReviewPageResponse> TodoRows { get; init; } = new();
        public int CompletedTotal { get; init; }
    }

    private async Task<PersonalServiceApplicationSnapshot> LoadPersonalServiceApplicationSnapshotAsync(
        DateTime startDate,
        DateTime endDate,
        bool includeTodoRows,
        bool includeCompleted,
        CancellationToken cancellationToken)
    {
        var start = startDate == default ? (DateTime?)null : startDate;
        var end = endDate == default ? (DateTime?)null : endDate;
        var deptId = DashboardRoleDepartmentId.ToString();
        const int allPageSize = 10000;
        var todoRequest = new MyReviewPageRequest
        {
            PageIndex = 1,
            PageSize = includeTodoRows ? allPageSize : 1,
            SortBy = "sla",
            SortDirection = SortDirection.Ascending,
            ServiceTypeId = "1",
            StartTime = start,
            EndTime = end
        };
        var todo = await _applicationAppService.GetMyReviewPageAsync(todoRequest, status: 1, deptId);
        var completedTotal = 0;
        if (includeCompleted)
        {
            var completedRequest = new MyReviewPageRequest
            {
                PageIndex = 1,
                PageSize = 1,
                ServiceTypeId = "1",
                StartTime = start,
                EndTime = end
            };
            var completed = await _applicationAppService.GetMyReviewPageAsync(completedRequest, status: 2, deptId);
            completedTotal = completed.Page?.Total ?? 0;
        }
        return new PersonalServiceApplicationSnapshot
        {
            TodoTotal = todo.Page?.Total ?? 0,
            TodoRows = includeTodoRows ? todo.Page?.Items?.ToList() ?? new List<MyReviewPageResponse>() : new List<MyReviewPageResponse>(),
            CompletedTotal = completedTotal
        };
    }

    private async Task<List<PriorityTaskCardDto>> GetServiceApplicationCardsAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        PersonalServiceApplicationSnapshot? personalServiceSnapshot,
        CancellationToken cancellationToken)
    {
        // priorityCards (taskCategory=0) MUST match api/Application/MyTodoPage. We consume the SAME
        // pipeline MyTodoPage uses: IApplicationAppService.GetMyReviewPageAsync with status=1 (todo)
        // and the request the user specified — sortBy=sla, sortDirection=1, serviceTypeId=1.
        //
        // Param behaviour verified against GetMyReviewPageAsync source:
        //  - serviceTypeId="1": intentionally NOT a filter — line `req.ServiceTypeId != "1"` treats
        //    "1" as the "all types" sentinel, so it matches MyTodoPage's default (no type filter).
        //  - sortBy="sla" + sortDirection=1(Ascending): applies OrderBy(a.Sort).ThenBy(a.SLA).
        //  - StartTime/EndTime: filter on LastUpdatedTime (>= StartDate.Date, < EndDate+1day). These
        //    were previously NOT passed, so the overview date range had no effect — now wired through.
// priorityCards must return EVERY matching to-do row, not a single page. MyTodoPage paginates
// (PageSize=10), so a plain first-page fetch would cap the cards at 10. Probe the total first
// (PageSize=1 is enough to read Page.Total), then re-fetch the whole set in one page so the
// dashboard shows all cards without any page-size limit.
        var snapshot = personalServiceSnapshot ?? await LoadPersonalServiceApplicationSnapshotAsync(
            startDate,
            endDate,
            includeTodoRows: true,
            includeCompleted: false,
            cancellationToken);
        var rows = snapshot.TodoRows;
        if (snapshot.TodoTotal <= 0 || rows.Count == 0)
        {
            return new List<PriorityTaskCardDto>();
        }

        // applyForIconType follows the same UserTypeId==1 => "personal", else => "enterprise" rule
        // used by the other categories: resolve each row's profile (row.ProfileId) via the shared
        // profile map, which classifies UserProfile.UserTypeId. Rows without a resolvable profile
        // default to "enterprise" (the "resto" branch of the rule).
        var svcProfileIds = rows
            .Where(r => r.ProfileId.HasValue && r.ProfileId.Value > 0)
            .Select(r => r.ProfileId!.Value)
            .Distinct()
            .ToArray();
        var (_, svcIconMap) = await ResolveProfileMapsAsync(svcProfileIds);

        var cards = new List<PriorityTaskCardDto>();
        foreach (var row in rows)
        {
            cards.Add(new PriorityTaskCardDto
            {
                TaskType = TaskCategory.ServiceApplication,
                TaskId = row.Id,
                ApplicationId = row.Id,
                ApplicationNumber = row.ApplicationNumber,
                WorkflowTaskId = row.TaskId,
                ApplicationDetailId = row.ApplicationDetailId,
                ReferenceNumber = row.ApplicationNumber,
                Title = row.ServiceNameEn,
                ApplyFor = _currentUser.IsArabicLanguage
                    ? row.ApplyForAr ?? row.ApplyForEn
                    : row.ApplyForEn ?? row.ApplyForAr,
                ApplyForAr = row.ApplyForAr ?? row.ApplyForEn,
                ApplyForIconType = row.ProfileId.HasValue
                    ? svcIconMap.GetValueOrDefault(row.ProfileId.Value, "enterprise")
                    : "enterprise",
                // Collapse every multi-level review node (Initial/Secondary/Tertiary/Senior/
                // Executive/Final Approval, codes 2..7) into the single "Pending Review" label so the
                // card status matches serviceApplicationCard.slaDistribution.pendingReview, which
                // classifies the SAME node set. Non-review states (PM/EA/etc.) keep their raw label.
                Status = ResolvePriorityCardStatus(row.StatusId, row.Status),
                // SLA is taken verbatim from the MyTodoPage row so the card shows the SAME value:
                //  - row.SLA is the numeric minutes (null => "-", set to null for PendingModification(13)
                //    and ExternalApproval(11) inside the pipeline), positive = Overdue, negative = Remaining.
                //  - row.SLADescription is MyTodoPage's already-formatted label (e.g. "19d Overdue" / "-").
                Sla = BuildSlaFromMyTodoRow(row.SLA, row.SLADescription, row.TaskCreatedTime),
                AssignedUserId = row.Assignee,
                CreatedOn = row.TaskCreatedTime,
                Metadata = new Dictionary<string, object>
                {
                    ["ServiceCode"] = row.ServiceCode ?? "",
                    ["ServiceNameAr"] = row.ServiceNameAr ?? "",
                    ["StatusId"] = row.StatusId ?? 0
                }
            });

            if (!string.IsNullOrWhiteSpace(row.TaskId))
            {
                cards[^1].AvailableActions = new List<TaskActionDto>
                {
                    new TaskActionDto
                    {
                        ActionCode = "open",
                        ActionLabel = "Open",
                        ActionUrl = $"applications/{row.Id}?taskId={row.TaskId}",
                        OpenMode = "same-tab"
                    }
                };
            }
        }

        // Reorder to the REQUESTED priority-cards order (differs from MyTodoPage's raw
        // sortBy=sla&sortDirection=1 result, whose ascending signed SLA would list Remaining
        // BEFORE Overdue):
        //   1) Overdue first, most-overdue first  (row.SLA > 0, larger = more overdue)
        //   2) then Remaining, least time left first (row.SLA < 0, closer to 0 = more urgent)
        //   3) then "-" (no SLA: PendingModification / ExternalApproval) last
        // Bucket: 0 = Overdue, 1 = Remaining, 2 = "-".
        return cards
            .OrderBy(c => c.Sla?.RemainingMinutes.HasValue == true
                ? (c.Sla.RemainingMinutes.Value > 0 ? 0 : 1)
                : 2)
            .ThenByDescending(c => c.Sla?.RemainingMinutes ?? 0)
            .ToList();
    }

    /// <summary>
    /// Wraps a MyTodoPage row's SLA into the dashboard SlaDto WITHOUT recomputing anything, so the
    /// card SLA is byte-for-byte the value MyTodoPage returns. <paramref name="slaMinutes"/> is
    /// MyTodoPage's SLA number (null => "-"; positive = Overdue; negative = Remaining) and
    /// <paramref name="slaDescription"/> is its pre-formatted label.
    /// </summary>
    private static SlaDto BuildSlaFromMyTodoRow(double? slaMinutes, string? slaDescription, DateTime createdOn)
    {
        if (!slaMinutes.HasValue)
        {
            return new SlaDto
            {
                DisplayText = slaDescription ?? "-",
                StatusCode = SlaStatusCode.Paused,
                RemainingMinutes = null,
                Deadline = null,
                CreatedOn = createdOn
            };
        }

        return new SlaDto
        {
            // Unify to the global SLA label format ("Due in {v}" / "{v} Overdue") instead of
            // MyTodoPage's slaDescription. slaMinutes is positive when Overdue, so negate it
            // to match SlaCalculator.FormatSlaDisplay (negative = Overdue).
            DisplayText = SlaCalculator.FormatSlaDisplay(-slaMinutes.Value),
            StatusCode = slaMinutes.Value > 0 ? SlaStatusCode.Overdue : SlaStatusCode.Remaining,
            RemainingMinutes = (int)Math.Round(slaMinutes.Value),
            Deadline = null,
            CreatedOn = createdOn
        };
    }

    // Date-range-aware status counts for the Service Application summary card. Every count is derived
    // from the SAME review pipeline the cards/tab use, date-filtered on LastUpdatedTime (>= StartDate.Date,
    // < EndDate + 1 day is applied inside GetMy[Team]ReviewPageAsync via StartTime/EndTime). We pull a
    // single large page (status filters give the todo vs completed splits) instead of the old
    // Get*TodoStatusCountAsync, whose StatusCount was computed BEFORE the date filter and so ignored the
    // selected period. Leader scope mirrors MyTeamTodoPage (EA excluded from todo => ExternalApproval = 0);
    // non-leader mirrors MyTodoPage.
    private async Task<ServiceApplicationCardCounts> GetServiceApplicationCardCountsAsync(
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        PersonalServiceApplicationSnapshot? personalServiceSnapshot,
        CancellationToken cancellationToken)
    {
        var start = startDate == default ? (DateTime?)null : startDate;
        var end = endDate == default ? (DateTime?)null : endDate;
	        var deptId = DashboardRoleDepartmentId.ToString();

        List<int?> todoStatusIds;
        int completedCount;
        List<double?> todoSlas;

        if (scope == AppDashboardScope.Department)
        {
            // §6.1.2: department To Do MUST match /api/licensing/team-management/tasks/query exactly.
            // Leader (Department) scope MUST reproduce EXACTLY what
            // /api/licensing/team-management/tasks/query returns for these two request bodies:
            //   To Do     : { view:"todo",      applicationTaskOnly:true, category:"applications",
            //                 lastUpdatedFrom, lastUpdatedTo }
            //   Completed : { view:"completed",  applicationTaskOnly:true, category:"applications",
            //                 lastUpdatedFrom, lastUpdatedTo }
            //
            // Two things the endpoint does that the card must copy verbatim:
            //  1) DATE FIELD: lastUpdatedFrom/To filter on LastUpdatedOn (see
            //     LicensingTeamManagementTaskQuery.ApplyFilters: LastUpdatedOn >= from and
            //     LastUpdatedOn < to.Date.AddDays(1)), NOT CreatedOn. Filtering the queue on
            //     CreatedOn silently miscounts rows whose last update falls in the window but whose
            //     creation does not, which is why the leader counts came out slightly off.
            //  2) STATUS FIELD: the endpoint surfaces each row's status as StatusId = RawStatusCode
            //     and the To Do queue is grouped BY that RawStatusCode. So classify the split off
            //     RawStatusCode directly — do NOT re-derive PM/EA from the process-instance status,
            //     which would diverge from the number the endpoint actually shows.
            var todoRequest = new LicensingTeamManagementTaskQueryRequest
            {
                View = LicensingTeamManagementConstants.ViewTodo,
                Category = LicensingTeamManagementConstants.CategoryApplications,
                ApplicationTaskOnly = true,
                LastUpdatedFrom = start,
                LastUpdatedTo = end
            };
            var todoQuery = LicensingTeamManagementTaskQuery.Build(
                _dbContext,
                todoRequest,
                _currentUser.IsArabicLanguage,
                LicensingTeamManagementConstants.CategoryApplications);

            var now = DateTimeHelper.Now;

            // Classify by numeric StatusId (= RawStatusCode), exactly as the endpoint groups its
            // To Do status tabs:
            //   Pending Review        = Initial(2), Secondary(3), Tertiary(4), Senior(5), Executive(6), Final(7)
            //   External Approval     = 11
            //   Pending Modification  = 13
            var reviewIds = new[]
            {
                (int)ApprovalNodeOrder.InitialApproval,
                (int)ApprovalNodeOrder.SecondaryApproval,
                (int)ApprovalNodeOrder.TertiaryApproval,
                (int)ApprovalNodeOrder.SeniorApproval,
                (int)ApprovalNodeOrder.ExecutiveApproval,
                (int)ApprovalNodeOrder.FinalApproval
            };
            var pmId = (int)ApprovalNodeOrder.PendingModification;
            var eaId = (int)ApprovalNodeOrder.ExternalApproval;

            var todoRows = await todoQuery
                .Select(r => new { r.RawStatusCode, r.IsExternalApprovalSort, r.DueOn })
                .ToListAsync();

            var classified = todoRows
                .Select(r => new
                {
                    StatusId = int.TryParse(r.RawStatusCode, out var sid) ? (int?)sid : null,
                    r.IsExternalApprovalSort,
                    r.DueOn
                })
                .ToList();

            // External Approval first (RawStatusCode==11 OR the projection's EA flag), then PM
            // (RawStatusCode==13), then Pending Review (2..7 excluding EA) — a row belongs to exactly
            // one bucket, matching the endpoint's status grouping.
            var deptExternalApprovalCount = classified.Count(r =>
                r.StatusId == eaId || r.IsExternalApprovalSort);
            var deptPendingModificationCount = classified.Count(r =>
                r.StatusId == pmId && !r.IsExternalApprovalSort);
            var deptPendingReviewCount = classified.Count(r =>
                r.StatusId.HasValue
                && reviewIds.Contains(r.StatusId.Value)
                && !r.IsExternalApprovalSort);
            var deptOverdueCount = classified.Count(r => r.DueOn.HasValue && r.DueOn.Value < now);

            // Completed count = the SAME team query with view=completed and the same LastUpdatedOn
            // window, so the card's completed total matches the endpoint's completed Page.Total.
            var completedRequest = new LicensingTeamManagementTaskQueryRequest
            {
                View = LicensingTeamManagementConstants.ViewCompleted,
                Category = LicensingTeamManagementConstants.CategoryApplications,
                ApplicationTaskOnly = true,
                LastUpdatedFrom = start,
                LastUpdatedTo = end
            };
            var deptCompletedCount = await LicensingTeamManagementTaskQuery.Build(
                    _dbContext,
                    completedRequest,
                    _currentUser.IsArabicLanguage,
                    LicensingTeamManagementConstants.CategoryApplications)
                .CountAsync();

            return new ServiceApplicationCardCounts
            {
                // To Do total = Pending Review + Pending Modification + External Approval (spec note:
                // Pending Payment is NOT part of To Do), so build it from the three segments.
                TotalTodoCount = deptPendingReviewCount + deptPendingModificationCount + deptExternalApprovalCount,
                PendingReviewCount = deptPendingReviewCount,
                PendingModificationCount = deptPendingModificationCount,
                ExternalApprovalCount = deptExternalApprovalCount,
                CompletedCount = deptCompletedCount,
OverdueCount = deptOverdueCount
};
}
else
        {
            var snapshot = personalServiceSnapshot ?? await LoadPersonalServiceApplicationSnapshotAsync(
                    startDate,
                    endDate,
                    includeTodoRows: true,
                    includeCompleted: true,
                    cancellationToken);
                var todoRows = snapshot.TodoRows;
                todoStatusIds = todoRows.Select(r => r.StatusId).ToList();
                todoSlas = todoRows.Select(r => r.SLA).ToList();
                completedCount = snapshot.CompletedTotal;
        }

        var pendingModificationCount = todoStatusIds.Count(s => s == (int)ApprovalNodeOrder.PendingModification);
        var externalApprovalCount = todoStatusIds.Count(s => s == (int)ApprovalNodeOrder.ExternalApproval);

        return new ServiceApplicationCardCounts
        {
            TotalTodoCount = todoStatusIds.Count,
            PendingModificationCount = pendingModificationCount,
            ExternalApprovalCount = externalApprovalCount,
            CompletedCount = completedCount,
            // Overdue = not-completed (already the todo set) with SLA remaining negative.
            // MyTodoPage sign convention: SLA > 0 means overdue (elapsed past the deadline).
            OverdueCount = todoSlas.Count(sla => sla.HasValue && sla.Value > 0)
        };
    }

    private sealed class ServiceApplicationCardCounts
    {
        public int TotalTodoCount { get; set; }
        public int PendingReviewCount { get; set; }
        public int PendingModificationCount { get; set; }
        public int ExternalApprovalCount { get; set; }
        public int CompletedCount { get; set; }
        public int OverdueCount { get; set; }
    }

    private async Task<ServiceApplicationCardDto> BuildServiceApplicationCardAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        PersonalServiceApplicationSnapshot? personalServiceSnapshot,
        CancellationToken cancellationToken)
    {
        var repoScope = ToRepositoryScope(scope);

        // The Service Application summary card MUST honor the overview's selected date range for its
        // status breakdown / totals / overdue count. The old Get*TodoStatusCountAsync paths took only a
        // departmentId and computed their StatusCount over the UNFILTERED todo/completed set (see
        // GetMyReviewPageAsync: result.StatusCount is built BEFORE the StartTime/EndTime Where clauses),
        // so the card never reflected the window. Instead recompute every count from the SAME review
        // pipeline the cards use, date-filtered on LastUpdatedTime, so card + tab count + list all agree.
        //
        // DoneToday is intentionally NOT date-ranged: spec defines it as "completed TODAY", independent
        // of the selected period.
        var counts = await GetServiceApplicationCardCountsAsync(scope, startDate, endDate, personalServiceSnapshot, cancellationToken);

        var totalTodoCount = counts.TotalTodoCount;
        var pendingModificationCount = counts.PendingModificationCount;
        var externalApprovalCount = counts.ExternalApprovalCount;
        var completedCount = counts.CompletedCount;
        var overdueTasks = counts.OverdueCount;

        // Department scope classifies Pending Review DIRECTLY off the review node statuses
        // (Initial..Final), so use that value. Personal scope leaves PendingReviewCount at 0 and
        // falls back to the subtraction (Total − PM − EA), which is correct there because the
        // personal todo set only contains review/PM/EA rows.
        var pendingReviewCount = counts.PendingReviewCount > 0
            ? counts.PendingReviewCount
            : totalTodoCount - pendingModificationCount - externalApprovalCount;
        var doneToday = await _repository.GetServiceApplicationDoneTodayCountAsync(userId, repoScope, departmentId, cancellationToken);

        var card = new ServiceApplicationCardDto
        {
            TotalCount = totalTodoCount,
            SlaDistribution = new Dictionary<string, int>
            {
                ["pendingReview"] = pendingReviewCount,
                ["pendingModification"] = pendingModificationCount,
                ["externalApproval"] = externalApprovalCount
            },
            TotalTasks = totalTodoCount + completedCount,
            DoneToday = doneToday,
            OverdueTasks = overdueTasks
        };

        // Get top services (Department scope only)
        if (scope == AppDashboardScope.Department && departmentId.HasValue)
        {
            card.TopServices = (await _repository.GetTopServicesByCountAsync(departmentId.Value, 5, cancellationToken))
                .Select(service => new AppServiceRankingDto
                {
                    ServiceId = service.ServiceId,
                    ServiceCode = service.ServiceCode,
                    ServiceNameEn = service.ServiceNameEn,
                    ServiceNameAr = service.ServiceNameAr,
                    TaskCount = service.TaskCount
                })
                .ToList();
            card.DepartmentStats = await GetDepartmentStatsAsync(departmentId.Value, startDate, endDate, cancellationToken);
        }

        return card;
    }
    
    private static int GetStatusCount(Dictionary<string, int> statusCounts, string statusName)
    {
        return statusCounts.TryGetValue(statusName, out var count) ? count : 0;
    }
	
    // === Profile Verification Helper Methods ===
    private static string PendingProfileVerificationStatus
        => ((short)Domain.Shares.Enums.TypeDics.UserProfileStatusEnum.UnderReview).ToString();
    private static DateTime NormalizeProfileVerificationEndDate(DateTime endDate)
        => endDate.TimeOfDay == TimeSpan.Zero ? endDate.Date.AddDays(1) : endDate;
    
    private async Task<int> GetPendingProfileVerificationCountAsync(
        string userId,
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken)
    {
        // Mirror api/UserManagement/UserProfile/Approves?StatusId=2 exactly (MineOnly defaults to true):
        //   - filter the date range on UpdateOn (Approves filters StartDate/EndDate on UpdateOn, NOT CreatedOn)
        //   - IsActive == true
        //   - exclude profiles whose UserId already exists as an AdminUser
        //   - Status == "2" (UnderReview / StatusId=2)
        //   - only profiles assigned to the current reviewer via ProfileReviewAssignment
        //     (AssigneeUserId == me, Status in {Pending, Completed}) — the MineOnly=true filter
        var exclusiveEndDate = NormalizeProfileVerificationEndDate(endDate);
        var startDay = startDate.Date;
        return await _dbContext.UserProfiles
            .AsNoTracking()
            .Where(p => p.IsActive == true)
            .Where(p => !_dbContext.AdminUsers.Any(a => a.Id == p.UserId))
            .Where(p => p.UpdateOn.HasValue && p.UpdateOn.Value >= startDay && p.UpdateOn.Value < exclusiveEndDate)
            .Where(p => p.Status == PendingProfileVerificationStatus)
            .Where(p => _dbContext.Set<ProfileReviewAssignment>().Any(a =>
                a.ProfileId == p.Id &&
                a.AssigneeUserId == userId &&
                (a.Status == ProfileReviewAssignmentStatuses.Pending ||
                 a.Status == ProfileReviewAssignmentStatuses.Completed)))
            .CountAsync(cancellationToken);
    }

    private async Task<List<PriorityTaskCardDto>> GetProfileVerificationCardsAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        // Align the pending-profile queue backing priorityCards with
        // api/UserManagement/UserProfile/Approves?StatusId=2 (MineOnly defaults to true):
        //   - filter the date range on UpdateOn (same field Approves uses), NOT CreatedOn
        //   - only IsActive profiles
        //   - exclude profiles whose UserId already exists as an AdminUser
        //   - Status == "2" (UnderReview / StatusId=2)
        //   - only profiles assigned to the current reviewer via ProfileReviewAssignment
        //     (AssigneeUserId == me, Status in {Pending, Completed}) — the MineOnly=true filter
        var exclusiveEndDate = NormalizeProfileVerificationEndDate(endDate);
        var startDay = startDate.Date;
        var tasks = await _dbContext.UserProfiles
            .AsNoTracking()
            .Where(p => p.IsActive == true)
            .Where(p => !_dbContext.AdminUsers.Any(a => a.Id == p.UserId))
            .Where(p => p.UpdateOn.HasValue && p.UpdateOn.Value >= startDay && p.UpdateOn.Value < exclusiveEndDate)
            .Where(p => p.Status == PendingProfileVerificationStatus)
            .Where(p => _dbContext.Set<ProfileReviewAssignment>().Any(a =>
                a.ProfileId == p.Id &&
                a.AssigneeUserId == userId &&
                (a.Status == ProfileReviewAssignmentStatuses.Pending ||
                 a.Status == ProfileReviewAssignmentStatuses.Completed)))
            .OrderByDescending(p => p.UpdateOn)
            .ToListAsync(cancellationToken);

        var language = _currentUser.GetLanguageOrDefault();
        var creatorNameMap = await ResolveCreatorNameMapAsync(tasks.Select(t => t.UserId).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray());
        // ApplyFor must match Approves: Person name for individuals, Establishment name for enterprises.
        // Return both English/Arabic values; when one side is absent, use the other as the fallback.
        var profileIds = tasks.Select(t => t.Id).Distinct().ToArray();
        var (applyForMap, applyForArMap, _) = await ResolveProfileApplyForMapsAsync(profileIds, cancellationToken);

        var cards = new List<PriorityTaskCardDto>();
        foreach (var t in tasks)
        {
            var resolvedStatus = await ResolveStatusNameAsync(UserProfileStatusScope, t.Status, language)
                ?? t.Status ?? PendingProfileVerificationStatus;

            cards.Add(new PriorityTaskCardDto
            {
                TaskType = TaskCategory.ProfileVerification,
                TaskId = t.Id,
                ReferenceNumber = t.ProfileCode ?? $"PROFILE-{t.Id}",
                Title = t.EntityName ?? creatorNameMap.GetValueOrDefault(t.UserId) ?? "Profile Verification",
                ApplyFor = _currentUser.IsArabicLanguage
                    ? applyForArMap.GetValueOrDefault(t.Id) ?? applyForMap.GetValueOrDefault(t.Id) ?? creatorNameMap.GetValueOrDefault(t.UserId)
                    : applyForMap.GetValueOrDefault(t.Id) ?? applyForArMap.GetValueOrDefault(t.Id) ?? creatorNameMap.GetValueOrDefault(t.UserId),
                ApplyForAr = applyForArMap.GetValueOrDefault(t.Id) ?? applyForMap.GetValueOrDefault(t.Id) ?? creatorNameMap.GetValueOrDefault(t.UserId),
                ApplyForIconType = t.UserTypeId == 1 ? "personal" : "enterprise",
                WaitingOnIconType = t.UserTypeId == 1 ? "personal" : "enterprise",
                Status = resolvedStatus,
                Sla = new SlaDto
                {
                    DisplayText = "-",
                    StatusCode = SlaStatusCode.NotApplicable,
                    RemainingMinutes = null,
                    Deadline = null,
                    CreatedOn = t.CreatedOn
                },
                AssignedUserId = null, // All License dept members can handle
                CreatedOn = t.CreatedOn,
                Metadata = new Dictionary<string, object>
                {
                    ["UserId"] = t.UserId,
                    ["UserTypeId"] = t.UserTypeId
                },
                AvailableActions = new List<TaskActionDto>
                {
                    new TaskActionDto
                    {
                        ActionCode = "open",
                        ActionLabel = "Open",
                        ActionUrl = $"licensing/Profile/ProfileDetails?id={t.Id}&applicationNo={t.ProfileCode}",
                        OpenMode = "same-tab"
                    }
                }
            });
        }

        return cards;
    }

    /// <summary>
    /// Resolve a status display name from a TypeDictionary scope by raw status code.
    /// Returns null when the code is empty or no dictionary entry is found.
    /// </summary>
    private async Task<string?> ResolveStatusNameAsync(string scope, string? code, string? language)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var name = await _typeDictionaryService.GetLocalizedNameAsync(scope, code, language);
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    private async Task<ProfileVerificationCardDto> BuildProfileVerificationCardAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        // Query UserProfiles whose Status is UnderReview(2).
        // Aligned with /api/UserManagement/UserProfile/Approves?StatusId=2 totals.
        var exclusiveEndDate = NormalizeProfileVerificationEndDate(endDate);
        var pendingProfiles = await (await _userProfileRepository.GetQueryableAsync())
            .AsNoTracking()
            .Where(p => p.CreatedOn >= startDate && p.CreatedOn < exclusiveEndDate)
            .Where(p => p.Status == PendingProfileVerificationStatus)
            .ToListAsync(cancellationToken);
        var pendingReviewCount = pendingProfiles.Count;
        var approvedCount = 0;
        var rejectedCount = 0;
        var expiredCount = 0;
        var totalCount = pendingReviewCount;
	
        // DoneToday: profiles updated today (approved or rejected today)
        var today = DateTimeHelper.Now.Date;
        var tomorrow = today.AddDays(1);
        var doneToday = pendingProfiles.Count(p => p.UpdateOn != null && p.UpdateOn >= today && p.UpdateOn < tomorrow);

        // Distribution uses the four status counts directly (aligned with Approves API).
        var distribution = new Dictionary<string, int>
        {
            ["PendingReview"] = pendingReviewCount,
            ["Approved"] = approvedCount,
            ["Rejected"] = rejectedCount,
            ["Expired"] = expiredCount
        };

        var card = new ProfileVerificationCardDto
        {
            TotalCount = totalCount,
            Distribution = distribution,
            TotalTasks = totalCount,
            DoneToday = doneToday,
            OverdueTasks = 0,
            SlaDistribution = new SlaDistributionDto(),
            StatusBreakdown = new Dictionary<string, int>
            {
                ["pendingReview"] = pendingReviewCount,
                ["approved"] = approvedCount,
                ["rejected"] = rejectedCount,
                ["expired"] = expiredCount
            }
        };

        return card;
    }

    // === Enquiry Helper Methods ===

    private async Task<List<PriorityTaskCardDto>> GetEnquiryCardsAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        var tasks = await _repository.GetEnquiryTasksAsync(userId, ToRepositoryScope(scope), startDate, endDate, departmentId, cancellationToken);

        var enqProfileIds = tasks.Where(t => t.UserProfileId.HasValue && t.UserProfileId.Value > 0).Select(t => t.UserProfileId!.Value).Distinct().ToArray();
        var (enqApplyForMap, enqApplyForArMap, enqIconMap) = await ResolveProfileApplyForMapsAsync(enqProfileIds, cancellationToken);



        return tasks.Select(t =>
        {
            var sla = _slaCalculator.CalculateSla(new TaskSlaContext
            {
                TaskType = TaskCategory.Enquiries,
                CreatedOn = t.CreatedOn,
                Status = t.StatusName ?? "Unknown",
                ManualDeadline = t.SLAEndTime
            });

            return new PriorityTaskCardDto
            {
                TaskType = TaskCategory.Enquiries,
                TaskId = t.Id,
                ReferenceNumber = t.EnquiryNumber,
                Title = $"Enquiry {t.EnquiryNumber}",
                ApplyFor = t.UserProfileId.HasValue
                    ? (_currentUser.IsArabicLanguage
                        ? enqApplyForArMap.GetValueOrDefault(t.UserProfileId.Value) ?? enqApplyForMap.GetValueOrDefault(t.UserProfileId.Value)
                        : enqApplyForMap.GetValueOrDefault(t.UserProfileId.Value))
                    : null,
                ApplyForAr = t.UserProfileId.HasValue
                    ? enqApplyForArMap.GetValueOrDefault(t.UserProfileId.Value) ?? enqApplyForMap.GetValueOrDefault(t.UserProfileId.Value)
                    : null,
                ApplyForIconType = t.UserProfileId.HasValue ? enqIconMap.GetValueOrDefault(t.UserProfileId.Value) : null,
                WaitingOnIconType = t.UserProfileId.HasValue ? enqIconMap.GetValueOrDefault(t.UserProfileId.Value) : null,
                Status = t.StatusName ?? "Unknown",
                Sla = sla,
                AssignedUserId = t.HandlerUserId,
                CreatedOn = t.CreatedOn,
                AvailableActions = new List<TaskActionDto>
                {
                    new TaskActionDto
                    {
                        ActionCode = "open",
                        ActionLabel = "Open",
                        ActionUrl = $"happiness/tickets/tickets-details?id={t.Id}",
                        OpenMode = "same-tab"
                    }
                }
            };
        }).ToList();
    }

    private async Task<EnquiryCardDto> BuildEnquiryCardAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        var tasks = await _repository.GetEnquiryTasksAsync(userId, ToRepositoryScope(scope), startDate, endDate, departmentId, cancellationToken);

        var card = new EnquiryCardDto
        {
            TotalCount = tasks.Count,
            SlaDistribution = new SlaDistributionDto(),
            StatusBreakdown = new Dictionary<string, int>()
        };

        foreach (var task in tasks)
        {
            // SLA distribution
            var sla = _slaCalculator.CalculateSla(new TaskSlaContext
            {
                TaskType = TaskCategory.Enquiries,
                CreatedOn = task.CreatedOn,
                ManualDeadline = task.SLAEndTime
            });

            var slaStatus = _slaCalculator.ClassifySlaStatus(sla);
            switch (slaStatus)
            {
                case "OnTime": card.SlaDistribution.OnTime++; break;
                case "UpcomingDue": card.SlaDistribution.UpcomingDue++; break;
                case "Overdue": card.SlaDistribution.Overdue++; break;
            }

            // Status breakdown
            var statusName = task.StatusName ?? "Unknown";
            if (!card.StatusBreakdown.ContainsKey(statusName))
                card.StatusBreakdown[statusName] = 0;
            card.StatusBreakdown[statusName]++;
        }

        if (scope == AppDashboardScope.Department && departmentId.HasValue)
        {
            card.DepartmentStats = await GetDepartmentStatsAsync(departmentId.Value, startDate, endDate, cancellationToken);
        }

        return card;
    }

    // === Refund Helper Methods ===

    private async Task<List<PriorityTaskCardDto>> GetRefundCardsAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        var tasks = await _repository.GetRefundTasksAsync(
            userId,
            ToRepositoryScope(scope),
            LicenseDashboardConstants.RefundCategories.License,
            startDate,
            endDate,
            departmentId,
            cancellationToken);

        var refProfileIds = tasks.Where(t => t.ProfileId.HasValue && t.ProfileId.Value > 0).Select(t => t.ProfileId!.Value).Distinct().ToArray();
        var (refApplyForMap, refApplyForArMap, refIconMap) = await ResolveProfileApplyForMapsAsync(refProfileIds, cancellationToken);

        // Refund priority cards must show the Refund TYPE (localized [Payment].[Refunds].[CategoryId]
        // via TypeDictionary scope 'Refund Category': 1=Fine, 2=Application) as the title, NOT the
        // refund/application number. Frontend truncates + ellipsizes overflow.
        var refundCategoryMap = await ResolveRefundCategoryMapAsync();


        return tasks.Select(t =>
        {
            var sla = _slaCalculator.CalculateSla(new TaskSlaContext
            {
                TaskType = TaskCategory.Refunds,
                CreatedOn = t.CreatedOn,
                Status = t.StatusName ?? "Unknown",
                ManualDeadline = t.SLAEndTime
            });

            return new PriorityTaskCardDto
            {
                TaskType = TaskCategory.Refunds,
                TaskId = t.Id,
                ReferenceNumber = t.ApplicationNumber ?? t.ReferenceNumber ?? $"REF-{t.Id}",
                Title = refundCategoryMap.TryGetValue(t.CategoryId.ToString(), out var refundCategoryTitle) ? refundCategoryTitle : "Refund",
                ApplyFor = t.ProfileId.HasValue
                    ? (_currentUser.IsArabicLanguage
                        ? refApplyForArMap.GetValueOrDefault(t.ProfileId.Value) ?? refApplyForMap.GetValueOrDefault(t.ProfileId.Value)
                        : refApplyForMap.GetValueOrDefault(t.ProfileId.Value))
                    : null,
                ApplyForAr = t.ProfileId.HasValue
                    ? refApplyForArMap.GetValueOrDefault(t.ProfileId.Value) ?? refApplyForMap.GetValueOrDefault(t.ProfileId.Value)
                    : null,
                ApplyForIconType = t.ProfileId.HasValue ? refIconMap.GetValueOrDefault(t.ProfileId.Value) : null,
                WaitingOnIconType = t.ProfileId.HasValue ? refIconMap.GetValueOrDefault(t.ProfileId.Value) : null,
                Status = t.StatusName ?? "Unknown",
                Sla = sla,
                AssignedUserId = t.HandlerUserId,
                CreatedOn = t.CreatedOn,
                Metadata = new Dictionary<string, object>
                {
                    ["Amount"] = t.Amount
                },
                AvailableActions = new List<TaskActionDto>
                {
                    new TaskActionDto
                    {
                        ActionCode = "open",
                        ActionLabel = "Open",
                        ActionUrl = $"/refunds/{t.Id}",
                        OpenMode = "same-tab"
                    }
                }
            };
        }).ToList();
    }

    // Localized display map for [Payment].[Refunds].[CategoryId] (TypeDictionary scope
    // 'Refund Category': 1=Fine, 2=Application). Code -> localized name (Arabic when the UI is Arabic).
    private async Task<Dictionary<string, string>> ResolveRefundCategoryMapAsync()
    {
        return (await _typeDictionaryService.GetListAsync("Refund Category"))
            .ToDictionary(
                x => x.Code ?? string.Empty,
                x => _currentUser.IsArabicLanguage && !string.IsNullOrWhiteSpace(x.NameAr) ? x.NameAr : x.NameEn ?? string.Empty,
                StringComparer.OrdinalIgnoreCase);
    }

    private async Task<RefundCardDto> BuildRefundCardAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        var tasks = await _repository.GetRefundTasksAsync(
            userId,
            ToRepositoryScope(scope),
            LicenseDashboardConstants.RefundCategories.License,
            startDate,
            endDate,
            departmentId,
            cancellationToken);

        var card = new RefundCardDto
        {
            TotalCount = tasks.Count,
            SlaDistribution = new SlaDistributionDto(),
            StatusBreakdown = new Dictionary<string, int>(),
            TotalAmountPending = 0
        };

        foreach (var task in tasks)
        {
            // SLA distribution
            var sla = _slaCalculator.CalculateSla(new TaskSlaContext
            {
                TaskType = TaskCategory.Refunds,
                CreatedOn = task.CreatedOn,
                ManualDeadline = task.SLAEndTime
            });

            var slaStatus = _slaCalculator.ClassifySlaStatus(sla);
            switch (slaStatus)
            {
                case "OnTime": card.SlaDistribution.OnTime++; break;
                case "UpcomingDue": card.SlaDistribution.UpcomingDue++; break;
                case "Overdue": card.SlaDistribution.Overdue++; break;
            }

            // Status breakdown
            var statusName = task.StatusName ?? "Unknown";
            if (!card.StatusBreakdown.ContainsKey(statusName))
                card.StatusBreakdown[statusName] = 0;
            card.StatusBreakdown[statusName]++;

            // Total pending amount: GetRefundTasksAsync only returns not-completed refunds
            // (mirroring api/Refund/Admin/Tickets?IsCompleted=false), so every returned task is
            // still pending settlement and contributes to the pending amount.
            card.TotalAmountPending += task.Amount;
        }

        if (scope == AppDashboardScope.Department && departmentId.HasValue)
        {
            card.DepartmentStats = await GetDepartmentStatsAsync(departmentId.Value, startDate, endDate, cancellationToken);
        }

        return card;
    }

    // === Appeal Helper Methods ===

    private async Task<List<AppealTaskDto>> GetAppealTodoTasksAsync(
        string userId, AppDashboardScope scope, DateTime startDate, DateTime endDate, int? departmentId, CancellationToken cancellationToken)
    {
        var (visibleUserIds, leaderDeptIds) = await ResolveAppealVisibleScopeAsync(userId, scope, departmentId, cancellationToken);
        return await _repository.GetAppealTasksAsync(userId, ToRepositoryScope(scope), startDate, endDate, visibleUserIds, leaderDeptIds, cancellationToken);
    }

    private async Task<int> GetAppealTodoCountAsync(
        string userId, AppDashboardScope scope, DateTime startDate, DateTime endDate, int? departmentId, CancellationToken cancellationToken)
    {
        var (visibleUserIds, leaderDeptIds) = await ResolveAppealVisibleScopeAsync(userId, scope, departmentId, cancellationToken);
        return await _repository.GetAppealCountAsync(userId, ToRepositoryScope(scope), startDate, endDate, visibleUserIds, leaderDeptIds, cancellationToken);
    }

    private async Task<(List<string> visibleUserIds, List<int> leaderDeptIds)> ResolveAppealVisibleScopeAsync(
        string userId, AppDashboardScope scope, int? departmentId, CancellationToken cancellationToken)
    {
        if (scope == AppDashboardScope.Personal)
        {
            return (new List<string> { userId }, new List<int>());
        }

// Department scope: check if user is leader of the DASHBOARD department.
// Previously queried ALL departments where user is leader, so a multi-dept
// leader would see cross-department appeals in the Licensing dashboard.
var leaderQuery = (await _userDepartmentRepository.GetQueryableAsync())
.Where(ud => ud.UserId == userId && ud.IsLeader == true);

if (departmentId.HasValue)
leaderQuery = leaderQuery.Where(ud => ud.DepartmentId == departmentId.Value);

var leaderDeptIds = await leaderQuery
.Select(ud => ud.DepartmentId)
.Distinct()
.ToListAsync(cancellationToken);

if (leaderDeptIds.Count == 0)
{
// Not a leader of the dashboard department — only see own data
return (new List<string> { userId }, new List<int>());
}

// Leader: get all member userIds from the scoped leader departments only
var memberUserIds = await (await _userDepartmentRepository.GetQueryableAsync())
.Where(ud => leaderDeptIds.Contains(ud.DepartmentId))
            .Select(ud => ud.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return (memberUserIds, leaderDeptIds);
    }

    private async Task<List<PriorityTaskCardDto>> GetAppealCardsAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        var tasks = await GetAppealTodoTasksAsync(userId, scope, startDate, endDate, departmentId, cancellationToken);

        var appealProfileIds = tasks.Where(t => t.ProfileId.HasValue && t.ProfileId.Value > 0).Select(t => t.ProfileId!.Value).Distinct().ToArray();
        var (appealApplyForMap, appealApplyForArMap, appealIconMap) = await ResolveProfileApplyForMapsAsync(appealProfileIds, cancellationToken);

        return tasks.Select(t =>
        {
            var sla = _slaCalculator.CalculateSla(new TaskSlaContext
            {
                TaskType = TaskCategory.Appeals,
                CreatedOn = t.CreatedOn,
                Status = t.StatusName ?? "Unknown",
                ManualDeadline = t.ResponseDeadline ?? t.SlaDueOn
            });

            return new PriorityTaskCardDto
            {
                TaskType = TaskCategory.Appeals,
                TaskId = t.AppealId,
                ReferenceNumber = t.AppealNumber,
                // Appeal priority cards must show the Appeal REASON
                // ([Inspection].[InspectionViolationAppeals].[AppealReason]), NOT the appeal number.
                // Frontend truncates + ellipsizes overflow.
                Title = string.IsNullOrWhiteSpace(t.AppealReason) ? $"Appeal {t.AppealNumber}" : t.AppealReason!,
                ApplyFor = t.ProfileId.HasValue
                    ? (_currentUser.IsArabicLanguage
                        ? appealApplyForArMap.GetValueOrDefault(t.ProfileId.Value) ?? appealApplyForMap.GetValueOrDefault(t.ProfileId.Value)
                        : appealApplyForMap.GetValueOrDefault(t.ProfileId.Value))
                    : null,
                ApplyForAr = t.ProfileId.HasValue
                    ? appealApplyForArMap.GetValueOrDefault(t.ProfileId.Value) ?? appealApplyForMap.GetValueOrDefault(t.ProfileId.Value)
                    : null,
                ApplyForIconType = t.ProfileId.HasValue ? appealIconMap.GetValueOrDefault(t.ProfileId.Value) : null,
                WaitingOnIconType = t.ProfileId.HasValue ? appealIconMap.GetValueOrDefault(t.ProfileId.Value) : null,
                Status = t.StatusName ?? "Unknown",
                Sla = sla,
                AssignedUserId = t.UserId,
                CreatedOn = t.CreatedOn,
                AvailableActions = new List<TaskActionDto>
                {
                    new TaskActionDto
                    {
                        ActionCode = "open",
                        ActionLabel = "Open",
                        ActionUrl = $"appeals/{t.AppealId}",
                        OpenMode = "same-tab"
                    }
                }
            };
        }).ToList();
    }

    private async Task<AppealCardDto> BuildAppealCardAsync(
        string userId,
        AppDashboardScope scope,
        DateTime startDate,
        DateTime endDate,
        int? departmentId,
        CancellationToken cancellationToken)
    {
        var tasks = await GetAppealTodoTasksAsync(userId, scope, startDate, endDate, departmentId, cancellationToken);

        var card = new AppealCardDto
        {
            TotalCount = tasks.Count,
            SlaDistribution = new SlaDistributionDto(),
            StatusBreakdown = new Dictionary<string, int>()
        };

        foreach (var task in tasks)
        {
            // SLA distribution
            var sla = _slaCalculator.CalculateSla(new TaskSlaContext
            {
                TaskType = TaskCategory.Appeals,
                CreatedOn = task.CreatedOn,
                ManualDeadline = task.ResponseDeadline ?? task.SlaDueOn
            });

            var slaStatus = _slaCalculator.ClassifySlaStatus(sla);
            switch (slaStatus)
            {
                case "OnTime": card.SlaDistribution.OnTime++; break;
                case "UpcomingDue": card.SlaDistribution.UpcomingDue++; break;
                case "Overdue": card.SlaDistribution.Overdue++; break;
            }

            // Status breakdown
            var statusName = task.StatusName ?? "Unknown";
            if (!card.StatusBreakdown.ContainsKey(statusName))
                card.StatusBreakdown[statusName] = 0;
            card.StatusBreakdown[statusName]++;
        }

        if (scope == AppDashboardScope.Department && departmentId.HasValue)
        {
            card.DepartmentStats = await GetDepartmentStatsAsync(departmentId.Value, startDate, endDate, cancellationToken);
        }

        return card;
    }

    // === Common Helper Methods ===

    private async Task<DepartmentStatsDto> GetDepartmentStatsAsync(
        int departmentId,
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken)
    {
        var totalMembers = await _repository.GetDepartmentMembersCountAsync(departmentId, cancellationToken);
        var onLeaveMembers = await _repository.GetMembersOnLeaveAsync(departmentId, startDate, endDate, cancellationToken);

        return new DepartmentStatsDto
        {
            TotalMembers = totalMembers,
            MembersOnLeave = onLeaveMembers.Count,
            AverageHandlingTimeMinutes = null // TODO: Calculate from completed tasks
        };
    }

    // === Other API Methods (Stubs for now) ===

    public async Task<LicenseDistributionResponse> GetLicenseDistributionAsync(
        LicenseDistributionRequest request,
        CancellationToken cancellationToken = default)
    {
// Auth guard only — this endpoint always returns the department-wide license view,
// regardless of whether the current user is a staff member or a leader.
var userId = RequireCurrentUserId();
await RequireDepartmentIdAsync(userId, cancellationToken);

// Each status card must equal /api/LicenseManagement/list?status=X Total EXACTLY, so we run the
// SAME query list runs — per status, with the same issuance-date window and the license
// department id. Buckets are allowed to overlap / double-count (per requirement); we do NOT
// force a single partition. Redis cache is intentionally bypassed so every call reflects the
// current query logic. Status codes: Active=201, Expired=202, ExpiringSoon=205, Canceled=203,
// Suspended=204.
var deptId = LicenseDashboardConstants.Departments.LicenseDepartmentId;

async Task<int> CountByStatusAsync(string statusCode)
{
	var (total, _) = await _licenseManagementService.GetLicenseListAsync(
		new UMC.Utils.Framework.Page.PageRequest { PageIndex = 1, PageSize = 1 },
		null,               // keyword
		statusCode,         // status
		null,               // licenseType
		request.StartDate,  // issuanceDateStart
		request.EndDate,    // issuanceDateEnd
		null,               // expirationDateStart
		null,               // expirationDateEnd
		null,               // sortBy
		true,               // isDescending
		null,               // userId
		null,               // profileId
		deptId);            // Department
	return total;
}

var active = await CountByStatusAsync("201");
var expired = await CountByStatusAsync("202");
var expiringSoon = await CountByStatusAsync("205");
var canceled = await CountByStatusAsync("203");
var suspended = await CountByStatusAsync("204");

return new LicenseDistributionResponse
{
	TotalCount = active + expired + expiringSoon + canceled + suspended,
	StatusDistribution = new Dictionary<string, int>
	{
		["Active"] = active,
		["Expired"] = expired,
		["ExpiringSoon"] = expiringSoon,
		["Canceled"] = canceled,
		["Suspended"] = suspended
	},
	StartDate = request.StartDate,
	EndDate = request.EndDate
};
}

public async Task<PerformanceMetricsResponse> GetPerformanceMetricsAsync(
        PerformanceMetricsRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = RequireCurrentUserId();
        var (startDate, endDate) = NormalizeDateRange(request.StartDate, request.EndDate);
        var (scope, departmentId) = await ResolveRoleScopeAsync().ConfigureAwait(false);

        var cacheKey = DashboardCacheKeys.PerformanceMetrics(userId, scope, startDate, endDate);
        if (_redis != null)
        {
            try
            {
                var cached = await _redis.GetAsync<PerformanceMetricsResponse>(cacheKey);
                if (cached != null) return cached;
            }
            catch (Exception ex) { /* Redis unavailable, continue without cache */ }
        }

// Lightweight path: only loads members + application-metric tasks, skipping todo counts,
// leave info, and duty status that the full GetMembersOptimizedAsync loads but the
// performance summary does not need.
var memberIdFilter = scope == AppDashboardScope.Personal ? userId : null;
var aggregatedMetric = await _licensingTeamMgmt.GetAggregatedPerformanceMetricsAsync(
memberIdFilter, startDate, endDate, cancellationToken)
.ConfigureAwait(false);

var summaryDto = BuildPerformanceSummaryFromAggregatedMetric(aggregatedMetric);

	// Decision counts (approved/rejected) are now computed inside the optimized metric pipeline
	// (via approval-record WorkflowActionCode / ApprovalAction), eliminating the 5 extra DB queries
	// that GetApplicationDecisionCountsAsync previously ran (department lookup + member directory
	// + CamundaTasks JOIN + ApprovalRecords).
	var approvedCount = aggregatedMetric.ApprovedApplicationCount;
	var rejectedCount = aggregatedMetric.RejectedApplicationCount;
        var decisionDenominator = approvedCount + rejectedCount;
        summaryDto.ApprovedApplicationCount = approvedCount;
        summaryDto.RejectedApplicationCount = rejectedCount;
        summaryDto.ApprovalRateOfApplication = decisionDenominator == 0
            ? 0m
            : Math.Round(approvedCount * 100m / decisionDenominator, 4, MidpointRounding.AwayFromZero);

// AverageHandlingTimeMinutes / AverageProcessingTime are already set by
// BuildPerformanceSummaryFromAggregatedMetric (application-only metrics from
// the optimized path). The previous GetDepartmentAverageMetricsAsync call was
// removed because it ran 7 heavy DB queries (CamundaTasks 5-table JOIN +
// Enquiries + Refunds + Appeals over the full date window) and its all-task-type
// average was actually inconsistent with coaching which uses applicationTaskOnly.

var response = new PerformanceMetricsResponse
        {
            Summary = summaryDto,
            StartDate = startDate,
            EndDate = endDate
        };

        if (_redis != null)
        {
            try { await _redis.SetAsync(cacheKey, response, TimeSpan.FromSeconds(_cacheSettings.StandardSeconds)); }
            catch (Exception ex) { /* Redis unavailable, skip cache write */ }
        }

        return response;
    }

    public async Task<PerformanceTrendResponse> GetPerformanceTrendAsync(
        PerformanceTrendRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = RequireCurrentUserId();
        var (startDate, endDate) = NormalizeDateRange(request.StartDate, request.EndDate);
        var (scope, departmentId) = await ResolveRoleScopeAsync().ConfigureAwait(false);

        var cacheKey = DashboardCacheKeys.PerformanceTrend(userId, scope, startDate, endDate);
        if (_redis != null)
        {
            try
            {
                var cached = await _redis.GetAsync<PerformanceTrendResponse>(cacheKey);
                if (cached != null) return cached;
            }
            catch (Exception ex) { /* Redis unavailable, continue without cache */ }
        }

        // Use TrendChartHelper for natural-period bucketing (Daily ≤14d, Weekly ≤90d,
        // Monthly ≤365d, Quarterly ≤1095d, etc.) — consistent with all other dashboards.
        var trendResult = TrendChartHelper.GetTrendGroups(startDate, endDate);
        var unit = trendResult.Unit;
        var groups = trendResult.Groups;

        // Fetch per-day granularity from repository so we can re-bucket in the app service.
        var trendRows = await _repository.GetPerformanceTrendAsync(
            userId,
            ToRepositoryScope(scope),
            startDate,
            endDate,
            "Daily",
            departmentId,
            cancellationToken);

        var taskCategories = Enum.GetValues<TaskCategory>().ToList();

        var dataPoints = new List<UMC.AdminPortal.Application.Dtos.LicenseDashboard.TrendDataPointDto>();
        foreach (var bucket in groups)
        {
            var bucketRows = trendRows
                .Where(r => r.Date >= bucket.Start && r.Date <= bucket.End)
                .ToList();

            var taskCounts = new Dictionary<string, int>();
            foreach (var category in taskCategories)
            {
                var categoryName = category.ToString();
                taskCounts[categoryName] = bucketRows
                    .Where(r => string.Equals(r.TaskType, categoryName, StringComparison.OrdinalIgnoreCase))
                    .Sum(r => r.TasksCompleted);
            }

            dataPoints.Add(new UMC.AdminPortal.Application.Dtos.LicenseDashboard.TrendDataPointDto
            {
                BucketDate = bucket.Start,
                Label = TrendChartHelper.GetFormatDate(bucket.Start, bucket.End, unit),
                TaskCounts = taskCounts,
                TotalCount = taskCounts.Values.Sum()
            });
        }

        var series = new List<TrendSeriesDto>();
        foreach (var category in taskCategories)
        {
            var categoryName = category.ToString();
            var values = dataPoints.Select(p => p.TaskCounts.TryGetValue(categoryName, out var v) ? v : 0).ToList();
            series.Add(new TrendSeriesDto
            {
                Name = categoryName,
                TaskType = category,
                Values = values,
                Total = values.Sum()
            });
        }

        var response = new PerformanceTrendResponse
        {
            BucketType = unit,
            DataPoints = dataPoints,
            Series = series,
            StartDate = startDate,
            EndDate = endDate
        };

        if (_redis != null)
        {
            try { await _redis.SetAsync(cacheKey, response, TimeSpan.FromSeconds(_cacheSettings.StandardSeconds)); }
            catch (Exception ex) { /* Redis unavailable, skip cache write */ }
        }

        return response;
    }

    public async Task<MembersNeedingCoachingResponse> GetMembersNeedingCoachingAsync(
        MembersNeedingCoachingRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = RequireCurrentUserId();

        var departmentId = await RequireDepartmentIdAsync(userId, cancellationToken);
        await EnsureManagerAccessAsync(userId, departmentId, cancellationToken);

        var (startDate, endDate) = NormalizeDateRange(request.StartDate, request.EndDate);

        var cacheKey = DashboardCacheKeys.MembersNeedingCoaching(
            departmentId,
            startDate,
            endDate,
            request.SlaComplianceThreshold,
            request.AvgHandlingTimeMultiplier);
        if (_redis != null)
        {
            try
            {
                var cached = await _redis.GetAsync<MembersNeedingCoachingResponse>(cacheKey);
                if (cached != null) return cached;
            }
            catch (Exception ex) { /* Redis unavailable, continue without cache */ }
        }

        // Aligned with ContentDashboardMetricsService.BuildMembersNeedingCoaching:
        // directly load metric tasks → compute performance per member → sort by
        // numeric values → take top 5. No intermediate card / formatted-string step.
        var ranked = await _licensingTeamMgmt.BuildMembersNeedingCoachingAsync(
            startDate, endDate, take: 5, cancellationToken);

        var sorted = ranked.Select(m => new MemberCoachingListItemDto
        {
            Member = m.MemberName,
            Overdue = m.OverdueTasks,
            SlaCompliance = $"{m.SlaComplianceRate:0.#}%",
            AvgProcessingTime = FormatProcessingTime(m.AvgProcessingTimeMinutes)
        }).ToList();

        var response = new MembersNeedingCoachingResponse
        {
            Members = sorted
        };

        if (_redis != null)
        {
            try { await _redis.SetAsync(cacheKey, response, TimeSpan.FromSeconds(_cacheSettings.HighFrequencySeconds)); }
            catch (Exception ex) { /* Redis unavailable, skip cache write */ }
        }

        return response;
    }

    
    public async Task<MembersOnLeaveResponse> GetMembersOnLeaveAsync(
        MembersOnLeaveRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = RequireCurrentUserId();
        var departmentId = await _repository.GetUserDepartmentIdAsync(userId, cancellationToken);

        if (!departmentId.HasValue)
        {
            return new MembersOnLeaveResponse
            {
                Members = new List<AppMemberOnLeaveDto>(),
                TotalCount = 0,
                AsOfDate = DateTime.UtcNow.AddHours(4)
            };
        }

        var cacheKey = DashboardCacheKeys.MembersOnLeave(departmentId.Value);
        if (_redis != null)
        {
            try
            {
                var cached = await _redis.GetAsync<MembersOnLeaveResponse>(cacheKey);
                if (cached != null) return cached;
            }
            catch (Exception ex) { /* Redis unavailable, continue without cache */ }
        }

var repoMembers = await _repository.GetMembersOnLeaveAsync(departmentId.Value, request.StartDate, request.EndDate, cancellationToken);

// Compute todo task counts for on-leave members, reusing the same query logic
// as api/licensing/team-management/members (LicensingTeamManagementAppService).
var onLeaveUserIds = repoMembers.Select(m => m.UserId).ToArray();
var todoCountByUser = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
if (onLeaveUserIds.Length > 0)
{
var applicationCounts = await LicensingTeamManagementMembersOptimizedQuery
	.BuildApplicationTodoCounts(_dbContext, departmentId.Value, onLeaveUserIds)
	.ToListAsync(cancellationToken);
foreach (var c in applicationCounts)
	todoCountByUser[c.UserId] = todoCountByUser.GetValueOrDefault(c.UserId) + c.Count;

var enquiryCounts = await _dbContext.Enquiries
	.AsNoTracking()
	.Where(x => x.DepartmentId == departmentId.Value
		&& x.HandlerUserId != null
		&& onLeaveUserIds.Contains(x.HandlerUserId)
		&& !LicensingTeamManagementAppService.EnquiryCompletedStatuses.Contains(x.EnquiryStatusId))
	.GroupBy(x => x.HandlerUserId!)
	.Select(g => new { UserId = g.Key, Count = g.Count() })
	.ToListAsync(cancellationToken);
foreach (var c in enquiryCounts)
	todoCountByUser[c.UserId] = todoCountByUser.GetValueOrDefault(c.UserId) + c.Count;

var refundCounts = await _dbContext.Refunds
	.AsNoTracking()
	.Where(x => x.ReferenceDepartmentId == departmentId.Value
		&& x.HandlerUserId != null
		&& onLeaveUserIds.Contains(x.HandlerUserId)
		&& !LicensingTeamManagementAppService.RefundCompletedStatuses.Contains(x.StatusId))
	.GroupBy(x => x.HandlerUserId!)
	.Select(g => new { UserId = g.Key, Count = g.Count() })
	.ToListAsync(cancellationToken);
foreach (var c in refundCounts)
	todoCountByUser[c.UserId] = todoCountByUser.GetValueOrDefault(c.UserId) + c.Count;
}

var members = repoMembers
.Select(member => new AppMemberOnLeaveDto
{
	UserId = member.UserId,
	UserName = member.UserName,
	Email = member.Email,
	LeaveTypeCode = member.LeaveTypeCode,
	LeaveTypeNameEn = member.LeaveTypeNameEn,
	LeaveTypeNameAr = member.LeaveTypeNameAr,
	BriefDescription = member.BriefDescription,
	ExpectedReturnDate = member.ExpectedReturnDate,
	LeaveStartDate = member.LeaveStartDate,
	DaysUntilReturn = member.DaysUntilReturn,
	TodoTaskCount = todoCountByUser.GetValueOrDefault(member.UserId)
})
.ToList();

        var response = new MembersOnLeaveResponse
        {
            Members = members,
            TotalCount = members.Count,
            AsOfDate = DateTime.UtcNow.AddHours(4)
        };

        if (_redis != null)
        {
            try { await _redis.SetAsync(cacheKey, response, TimeSpan.FromSeconds(_cacheSettings.StandardSeconds)); }
            catch (Exception ex) { /* Redis unavailable, skip cache write */ }
        }

        return response;
    }

    public async Task<NeedsAttentionResponse> GetTasksNeedingAttentionAsync(
        NeedsAttentionRequest request,
        CancellationToken cancellationToken = default)
    {
    {
        var userId = RequireCurrentUserId();
        var isArabic = _currentUser.IsArabicLanguage;

        // Urgent tab: overdue OR (SLA < 1 day AND assignee on leave)
        if (string.Equals(request.Tab, "Urgent", StringComparison.OrdinalIgnoreCase))
        {
            var urgentPageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
            var urgentPageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

            var filtered = await GetFilteredUrgentTasksAsync(request.StartDate, request.EndDate).ConfigureAwait(false);
            var total = filtered.Count;
            var paged = filtered.Skip((urgentPageIndex - 1) * urgentPageSize).Take(urgentPageSize).ToList();

            return new NeedsAttentionResponse
            {
                UrgentTasks = paged,
                UrgentCount = total,
                TotalCount  = total,
                AsOfDate    = DateTime.UtcNow.AddHours(4)
            };
        }

        // Normalize pagination
        var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        // tab=Blocked
        // Department scope — all blocked tasks across the department,
        // plus tab counts { urgent, blocked }.
        if (string.Equals(request.Tab, "Blocked", StringComparison.OrdinalIgnoreCase))
        {
            var (_, deptId) = await ResolveRoleScopeAsync().ConfigureAwait(false);
            var forcedDeptId = deptId ?? DashboardRoleDepartmentId;

            var blockedResult = await _repository.GetTasksNeedingAttentionAsync(
                userId,
                "All",
                pageIndex,
                pageSize,
                request.StartDate,
                request.EndDate,
                RepositoryDashboardScope.Department,
                forcedDeptId,
                cancellationToken);

            // Urgent count — use the same filtered-urgent logic
            var filteredUrgent = await GetFilteredUrgentTasksAsync(request.StartDate, request.EndDate).ConfigureAwait(false);
            var urgentCount = filteredUrgent.Count;

	var blockedTasks = blockedResult.Tasks.Select(t => new AppAttentionTaskDto
	{
	TaskNo = t.TaskNo,
		ServiceName = isArabic ? (t.ServiceNameAr ?? t.ServiceName) : t.ServiceName,
		ServiceNameAr = t.ServiceNameAr,
		WaitingOn = isArabic ? (t.WaitingOnAr ?? t.WaitingOn) : t.WaitingOn,
		WaitingOnAr = t.WaitingOnAr,
		WaitingOnIconType = t.WaitingOnIconType,
		Status = isArabic ? (t.StatusAr ?? t.Status) : t.Status,
		StatusAr = t.StatusAr,
		TimeAlert = FormatTimeAlert(t.WaitingMinutes, isArabic),
	WaitingMinutes = t.WaitingMinutes,
	AssignedTo = t.Assignee,
	ApplicationId = t.ApplicationId,
TaskId = t.TaskId,
ApplyFor = t.ApplyFor,
ApplyForAr = t.ApplyForAr,
ApplyForIconType = t.ApplyForIconType
}).ToList();

            return new NeedsAttentionResponse
            {
                Tasks = blockedTasks,
                TotalCount = blockedResult.TotalCount,
                TabCounts = new Dictionary<string, int>
                {
                    ["urgent"] = urgentCount,
                    ["blocked"] = blockedResult.TabCounts.All
                },
                AsOfDate = DateTime.UtcNow.AddHours(4)
            };
        }

        // tab=All / ExternalApproval / PendingModification
        // Role-based scope: Manager => whole department tasks; Staff => own tasks.
        var (scope, departmentId) = await ResolveRoleScopeAsync().ConfigureAwait(false);

        var tab = request.Tab?.ToLower() switch
        {
            "externalapproval" => "ExternalApproval",
            "pendingmodification" => "PendingModification",
            _ => "All"
        };

        var result = await _repository.GetTasksNeedingAttentionAsync(
            userId,
            tab,
            pageIndex,
            pageSize,
            request.StartDate,
            request.EndDate,
            ToRepositoryScope(scope),
            departmentId,
            cancellationToken);

	var tasks = result.Tasks.Select(t => new AppAttentionTaskDto
	{
	TaskNo = t.TaskNo,
	ServiceName = isArabic ? (t.ServiceNameAr ?? t.ServiceName) : t.ServiceName,
		ServiceNameAr = t.ServiceNameAr,
		AssignedTo = t.Assignee,
		WaitingOn = isArabic ? (t.WaitingOnAr ?? t.WaitingOn) : t.WaitingOn,
		WaitingOnAr = t.WaitingOnAr,
		WaitingOnIconType = t.WaitingOnIconType,
		Status = isArabic ? (t.StatusAr ?? t.Status) : t.Status,
		StatusAr = t.StatusAr,
		TimeAlert = FormatTimeAlert(t.WaitingMinutes, isArabic),
	WaitingMinutes = t.WaitingMinutes,
	ApplicationId = t.ApplicationId,
	TaskId = t.TaskId,
ApplyFor = t.ApplyFor,
ApplyForAr = t.ApplyForAr,
ApplyForIconType = t.ApplyForIconType
}).ToList();

        return new NeedsAttentionResponse
        {
            Tasks = tasks,
            TotalCount = result.TotalCount,
            TabCounts = new Dictionary<string, int>
            {
                ["all"] = result.TabCounts.All,
                ["externalApproval"] = result.TabCounts.ExternalApproval,
                ["pendingModification"] = result.TabCounts.PendingModification
            },
            AsOfDate = DateTime.UtcNow.AddHours(4)
        };
    }
}

    /// <summary>
    /// Format waiting time as "Waiting Xd" or "Waiting Xh" or "Waiting Xmin"
    /// Round down: 24h or more = days, 1h or more = hours, less than 1h = minutes
    /// </summary>
    /// <summary>
    /// Fetch all todo tasks across the five categories via team-management, then keep only those
    /// the team-management query itself flagged as urgent (LicensingTeamManagementTaskItemDto.IsUrgent).
    /// This mirrors exactly the "isUrgent": true rows returned by
    /// api/licensing/team-management/tasks/query, i.e. SLA remaining within 24h AND the assigned
    /// reviewer is currently on leave (application tasks also require the task to be still open).
    /// Results are sorted by SLA ascending (most urgent first).
    /// </summary>
    private async Task<List<LicensingTeamManagementTaskItemDto>> GetFilteredUrgentTasksAsync(
        DateTime startDate, DateTime endDate)
    {
        var allRequest = new LicensingTeamManagementTaskQueryRequest
        {
            View = LicensingTeamManagementConstants.ViewTodo,
            ApplicationTaskOnly = false,
            Category = "all",
            PageIndex = 1,
            PageSize = 10000,
            SortBy = "sla",
            SortDirection = SortDirection.Ascending,
            StartDate = startDate,
            EndDate = endDate
        };
        var allResult = await _licensingTeamMgmt.QueryTasksV2Async(allRequest).ConfigureAwait(false);
        var allTasks = allResult.Page?.Items?.ToList() ?? new();

        if (allTasks.Count == 0)
            return allTasks;

// Reuse the team-management query's own IsUrgent flag — same logic as the
// "isUrgent": true rows in api/licensing/team-management/tasks/query — then keep only
// tasks whose CURRENT status is an active approval / department-processing node.
// Rows parked on the customer or on payment (Pending Payment, Pending Modification /
// Send Back, Pending Customer, terminal states, …) are dropped.
return allTasks.Where(t => t.IsUrgent && IsCurrentProcessingStatus(t)).ToList();
}

/// <summary>
/// Scheme A whitelist for the Urgent tab: a task counts as "currently being processed"
/// only when its status is an active approval node or a department-processing state.
/// Matches on the source-specific RawStatusCode (StatusId) captured by the
/// team-management read model, so display-text/localization never affects the filter.
/// </summary>
private static bool IsCurrentProcessingStatus(LicensingTeamManagementTaskItemDto task)
{
if (!int.TryParse(task.StatusId, out var statusId))
{
	// Non-numeric status ids are not part of any known processing state.
	return false;
}

switch (task.SourceType)
{
	case LicensingTeamManagementConstants.SourceApplication:
		// Positional approval nodes (Initial → Final) plus External Approval.
		return statusId is >= (int)ApprovalNodeOrder.InitialApproval
						and <= (int)ApprovalNodeOrder.FinalApproval
			|| statusId == (int)ApprovalNodeOrder.ExternalApproval;

	case LicensingTeamManagementConstants.SourceProfileVerification:
		// Only under-review profiles ever reach the todo list; keep them.
		return statusId == (int)UserProfileStatusEnum.UnderReview;

	case LicensingTeamManagementConstants.SourceEnquiry:
		return statusId == (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing;

	case LicensingTeamManagementConstants.SourceRefund:
		return statusId == (int)TicketRefundsStatusEnum.DepartmentProcessing;

	case LicensingTeamManagementConstants.SourceAppeal:
		return statusId == (int)InspectionAppealStatus.DepartmentProcessing;

	default:
		return false;
}
}

    private static string FormatTimeAlert(double minutes, bool isArabic = false)
    {
        if (minutes >= 1440) // 24 hours * 60 minutes
        {
            var days = (int)(minutes / 1440);
            return isArabic ? $"بانتظار {days} يوم" : $"Waiting {days}d";
        }
        
        if (minutes >= 60)
        {
            var hours = (int)(minutes / 60);
            return isArabic ? $"بانتظار {hours} ساعة" : $"Waiting {hours}h";
        }
        
        var wholeMinutes = (int)minutes;
        return isArabic ? $"بانتظار {wholeMinutes} دقيقة" : $"Waiting {wholeMinutes}min";
    }


    private async Task<(Dictionary<int, string> nameMap, Dictionary<int, string> iconMap)> ResolveProfileMapsAsync(int[] profileIds)
    {
        if (profileIds.Length == 0)
            return (new Dictionary<int, string>(), new Dictionary<int, string>());

        var profiles = await (await _userProfileRepository.GetQueryableAsync())
            .Where(x => profileIds.Contains(x.Id))
            .Select(x => new { x.Id, x.UserTypeId, x.PersonId, x.ProfileCode })
            .ToListAsync();

        var iconMap = profiles.ToDictionary(x => x.Id, x => x.UserTypeId == 1 ? "personal" : "enterprise");
        var nameMap = profiles.ToDictionary(x => x.Id, x => x.ProfileCode ?? x.Id.ToString());
        return (nameMap, iconMap);
    }
    private async Task<(Dictionary<int, string> applyForMap, Dictionary<int, string> applyForArMap, Dictionary<int, string> iconMap)> ResolveProfileApplyForMapsAsync(
        int[] profileIds,
        CancellationToken cancellationToken)
    {
        if (profileIds.Length == 0)
        {
            return (new Dictionary<int, string>(), new Dictionary<int, string>(), new Dictionary<int, string>());
        }
        var profiles = await (await _userProfileRepository.GetQueryableAsync())
            .AsNoTracking()
            .Where(x => profileIds.Contains(x.Id))
            .Select(x => new { x.Id, x.UserTypeId, x.PersonId })
            .ToListAsync(cancellationToken);
        var iconMap = profiles.ToDictionary(x => x.Id, x => x.UserTypeId == 1 ? "personal" : "enterprise");
        var applyForMap = new Dictionary<int, string>();
        var applyForArMap = new Dictionary<int, string>();
        var personIds = profiles
            .Where(x => x.UserTypeId == 1)
            .Select(x => x.PersonId)
            .Distinct()
            .ToArray();
        var persons = personIds.Length == 0
            ? new Dictionary<int, Person>()
            : await _dbContext.Persons
                .AsNoTracking()
                .Where(x => personIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
        foreach (var profile in profiles.Where(x => x.UserTypeId == 1))
        {
            if (!persons.TryGetValue(profile.PersonId, out var person))
                continue;
            if (!string.IsNullOrWhiteSpace(person.Name))
                applyForMap[profile.Id] = person.Name;
            if (!string.IsNullOrWhiteSpace(person.NameAr))
                applyForArMap[profile.Id] = person.NameAr;
        }
        var enterpriseProfileIds = profiles
            .Where(x => x.UserTypeId != 1)
            .Select(x => x.Id)
            .Distinct()
            .ToArray();
        if (enterpriseProfileIds.Length > 0)
        {
            var enterpriseNames = await (
                    from link in _dbContext.UserEstablishments.AsNoTracking()
                    join establishment in _dbContext.Establishments.AsNoTracking()
                        on link.EstablishmentId equals establishment.Id
                    where enterpriseProfileIds.Contains(link.UserProfileId)
                    select new
                    {
                        link.UserProfileId,
                        establishment.NameEn,
                        establishment.NameAr
                    })
                .ToListAsync(cancellationToken);
            foreach (var item in enterpriseNames)
            {
                if (!applyForMap.ContainsKey(item.UserProfileId) && !string.IsNullOrWhiteSpace(item.NameEn))
                    applyForMap[item.UserProfileId] = item.NameEn;
                if (!applyForArMap.ContainsKey(item.UserProfileId) && !string.IsNullOrWhiteSpace(item.NameAr))
                    applyForArMap[item.UserProfileId] = item.NameAr;
            }
        }
        return (applyForMap, applyForArMap, iconMap);
    }
    private string RequireCurrentUserId()
        => _currentUser.UserId ?? throw new BusinessException("License.Dashboard.Forbidden", "");

    private async Task<int> RequireDepartmentIdAsync(string userId, CancellationToken cancellationToken)
    {
        if (_currentUser.DepartmentId.HasValue && _currentUser.DepartmentId.Value > 0)
        {
            return _currentUser.DepartmentId.Value;
        }

        return await _repository.GetUserDepartmentIdAsync(userId, cancellationToken)
               ?? throw new BusinessException("License.Dashboard.Forbidden", "");
    }

    private async Task EnsureManagerAccessAsync(string userId, int departmentId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var isLeader = await _userService.IsLeaderAsync(userId, departmentId.ToString());
        if (!isLeader)
        {
            throw new BusinessException("License.Dashboard.Forbidden", "");
        }
    }

    private static (DateTime StartDate, DateTime EndDate) NormalizeDateRange(DateTime startDate, DateTime endDate)
    {
        var normalizedStart = startDate == default ? DateTime.UtcNow.Date.AddDays(-(LicenseDashboardConstants.DateRanges.DefaultPerformanceDays - 1)) : startDate;
        var normalizedEnd = endDate == default ? DateTime.UtcNow.Date : endDate;

        if (normalizedEnd < normalizedStart)
        {
            (normalizedStart, normalizedEnd) = (normalizedEnd, normalizedStart);
        }

        return (normalizedStart.Date, normalizedEnd.Date.AddDays(1).AddTicks(-1));
    }

    private static string DetermineTrendBucketType(DateTime startDate, DateTime endDate)
    {
        var totalDays = Math.Max(1, (endDate.Date - startDate.Date).Days + 1);

        if (totalDays <= 31)
        {
            return "Daily";
        }

        if (totalDays <= 120)
        {
            return "Weekly";
        }

        return "Monthly";
    }

    private async Task<Dictionary<string, string>> ResolveCreatorNameMapAsync(string[] userIds)
    {
        if (userIds == null || userIds.Length == 0)
        {
            return new Dictionary<string, string>();
        }

        var users = await (await _userRepository.GetQueryableAsync())
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.UserName })
            .ToListAsync();

        return users.ToDictionary(
            u => u.Id,
            u => string.IsNullOrWhiteSpace(($"{u.FirstName} {u.LastName}").Trim()) ? (u.UserName ?? string.Empty) : ($"{u.FirstName} {u.LastName}").Trim());
    }

    /// <summary>
    /// Resolve the "Apply For" display name per profile the same way
    /// api/UserManagement/UserProfile/Approves does: individual profiles (UserTypeId==1)
    /// show the Person name (Ar/En by language), enterprise profiles show the linked
    /// Establishment name (NameEn). Keyed by UserProfile.Id.
    /// </summary>
    private async Task<Dictionary<int, string>> ResolveProfileApplyForMapAsync(
        IReadOnlyCollection<UserProfile> profiles,
        string? language,
        CancellationToken cancellationToken)
    {
        var map = new Dictionary<int, string>();
        if (profiles == null || profiles.Count == 0)
        {
            return map;
        }

        var isArabic = !string.IsNullOrWhiteSpace(language)
            && language.StartsWith("ar", StringComparison.OrdinalIgnoreCase);

        // Individual profiles -> Person name (by PersonId).
        var personIds = profiles
            .Where(p => p.UserTypeId == 1)
            .Select(p => p.PersonId)
            .Distinct()
            .ToArray();
        var persons = personIds.Length == 0
            ? new List<Person>()
            : await _dbContext.Persons
                .AsNoTracking()
                .Where(p => personIds.Contains(p.Id))
                .ToListAsync(cancellationToken);
        var personMap = persons.ToDictionary(p => p.Id, p => p);

        // Enterprise profiles -> Establishment name (by profile Id via UserEstablishment).
        var enterpriseProfileIds = profiles
            .Where(p => p.UserTypeId != 1)
            .Select(p => p.Id)
            .Distinct()
            .ToArray();
        var establishmentNameByProfileId = new Dictionary<int, string>();
        if (enterpriseProfileIds.Length > 0)
        {
            var links = await _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(ue => enterpriseProfileIds.Contains(ue.UserProfileId))
                .Select(ue => new { ue.UserProfileId, ue.EstablishmentId })
                .ToListAsync(cancellationToken);
            var establishmentIds = links.Select(l => l.EstablishmentId).Distinct().ToArray();
            var establishmentNames = await _dbContext.Establishments
                .AsNoTracking()
                .Where(e => establishmentIds.Contains(e.Id))
                .Select(e => new { e.Id, e.NameEn })
                .ToListAsync(cancellationToken);
            var estNameById = establishmentNames.ToDictionary(e => e.Id, e => e.NameEn);
            foreach (var link in links)
            {
                if (!establishmentNameByProfileId.ContainsKey(link.UserProfileId)
                    && estNameById.TryGetValue(link.EstablishmentId, out var estName)
                    && !string.IsNullOrWhiteSpace(estName))
                {
                    establishmentNameByProfileId[link.UserProfileId] = estName!;
                }
            }
        }

        foreach (var profile in profiles)
        {
            string? name = null;
            if (profile.UserTypeId == 1)
            {
                if (personMap.TryGetValue(profile.PersonId, out var person))
                {
                    name = isArabic && !string.IsNullOrWhiteSpace(person.NameAr) ? person.NameAr : person.Name;
                }
            }
            else if (establishmentNameByProfileId.TryGetValue(profile.Id, out var estName))
            {
                name = estName;
            }

            if (!string.IsNullOrWhiteSpace(name))
            {
                map[profile.Id] = name!;
            }
        }

        return map;
    }

    private static string BuildTrendLabel(string bucketType, DateTime bucketDate, int index)
        => bucketType switch
        {
            "Daily" => bucketDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            "Monthly" => bucketDate.ToString("MMM yyyy", CultureInfo.InvariantCulture),
            _ => $"Week {index + 1}"
        };

    private static MemberCoachingListItemDto MapMemberPerformance(DomainMemberPerformanceDto member)
    {
        return new MemberCoachingListItemDto
        {
            Member = member.UserName,
            Overdue = member.LateCount,
            SlaCompliance = $"{member.SlaComplianceRate * 100:0.#}%",
            AvgProcessingTime = FormatProcessingTime(member.AvgHandlingTimeMinutes)
        };
    }

    /// <summary>
    /// Format processing time according to requirements:
    /// - 24h or more: days (d) with 1 decimal, e.g., "3.2d"
    /// - 1h or more and less than 24h: hours (h) with 1 decimal, e.g., "4.5h"
    /// - Less than 1h: minutes (min) as integer, e.g., "45min"
    /// </summary>
    /// <summary>
    /// Builds a PerformanceSummaryDto from member cards. When filterUserId is provided,
    /// only that user's card is used (personal scope). Otherwise all cards are aggregated
    /// (department scope), matching the api/licensing/team-management/members data source.
    /// </summary>
    private UMC.AdminPortal.Application.Dtos.LicenseDashboard.PerformanceSummaryDto BuildPerformanceSummaryFromMemberCards(
        IReadOnlyList<LicensingTeamManagementMemberCardDto> cards,
        string? filterUserId)
    {
        var relevant = string.IsNullOrEmpty(filterUserId)
            ? cards.ToList()
            : cards.Where(c => string.Equals(c.UserId, filterUserId, StringComparison.OrdinalIgnoreCase)).ToList();

        var metrics = relevant
            .Select(c => c.MetricsByCategory.TryGetValue(LicensingTeamManagementConstants.CategoryAll, out var m) ? m : null)
            .Where(m => m != null)
            .Cast<LicensingTeamManagementMemberMetricDto>()
            .ToList();

        if (metrics.Count == 0)
            return new UMC.AdminPortal.Application.Dtos.LicenseDashboard.PerformanceSummaryDto();

        var totalCompleted = metrics.Sum(m => m.CompletedTasks);
        var totalTasks = metrics.Sum(m => m.TotalAssignedTasks);
        var totalOverdue = metrics.Sum(m => m.OverdueTasks);

        // Re-derive on-time count from per-member SlaCompliance (SlaCompliance is 0–100 percentage).
        // SlaCompliance = round(onTime*100/completed, 2), so onTime ≈ SlaCompliance * completed / 100.
        var approxOnTime = metrics.Sum(m => m.SlaCompliance / 100m * m.CompletedTasks);
        var slaRate = totalCompleted == 0 ? 0m : Math.Round(approxOnTime / totalCompleted * 100m, 2);

        // Weighted average processing time across all completed tasks.
        var totalProcessing = metrics.Sum(m => m.AvgProcessingTime * m.CompletedTasks);
        var avgMinutes = totalCompleted == 0 ? 0.0 : totalProcessing / totalCompleted;

        var approvalRate = totalTasks == 0 ? 0m : Math.Round((decimal)totalCompleted * 100m / totalTasks, 4);

        return new UMC.AdminPortal.Application.Dtos.LicenseDashboard.PerformanceSummaryDto
        {
            SlaComplianceRate = slaRate,
            AverageHandlingTimeMinutes = avgMinutes,
            AverageProcessingTime = FormatProcessingTime(avgMinutes),
            ApprovalRateOfApplication = approvalRate,
            OverdueTasks = totalOverdue
        };
    }

    private static Dtos.LicenseDashboard.PerformanceSummaryDto BuildPerformanceSummaryFromAggregatedMetric(
        LicensingTeamManagementMemberMetricDto metric)
    {
        return new Dtos.LicenseDashboard.PerformanceSummaryDto
        {
            SlaComplianceRate = metric.SlaCompliance,
            AverageHandlingTimeMinutes = metric.AvgProcessingTime,
            AverageProcessingTime = FormatProcessingTime(metric.AvgProcessingTime),
            ApprovalRateOfApplication = 0m, // Always overridden by decision counts below
            OverdueTasks = metric.OverdueTasks
        };
    }

    private static string FormatProcessingTime(double minutes)
    {
        if (minutes <= 0)
        {
            return "0min";
        }

        if (minutes >= 1440) // >= 24 hours
        {
            var days = minutes / 1440;
            return $"{days:0.0}d";
        }

        if (minutes >= 60) // >= 1 hour and < 24 hours
        {
            var hours = minutes / 60;
            return $"{hours:0.0}h";
        }

        // < 1 hour
        return $"{Math.Round(minutes):0}min";
    }



    private static TaskCategory ParseTaskCategory(string taskType)
        => taskType switch
        {
            nameof(TaskCategory.ServiceApplication) => TaskCategory.ServiceApplication,
            nameof(TaskCategory.ProfileVerification) => TaskCategory.ProfileVerification,
            nameof(TaskCategory.Enquiries) => TaskCategory.Enquiries,
            nameof(TaskCategory.Refunds) => TaskCategory.Refunds,
            nameof(TaskCategory.Appeals) => TaskCategory.Appeals,
            _ => TaskCategory.ServiceApplication
        };

    // The organisational department used to decide the dashboard role (Leader vs Staff).
    private const int DashboardRoleDepartmentId = 1;
    private const string DashboardRoleManager = "Manager";
    private const string DashboardRoleStaff = "Staff";

    /// <summary>
    /// Resolve whether the current user is a department leader (Manager) or a normal Staff member
    /// for the License dashboard department (departmentId = 2).
    /// </summary>
    private async Task<string> ResolveDashboardRoleAsync(int departmentId)
    {
        var userId = _currentUser.UserId;
        if (string.IsNullOrWhiteSpace(userId) || departmentId <= 0)
        {
            return DashboardRoleStaff;
        }

        var isLeader = await _userService.IsLeaderAsync(userId, departmentId.ToString()).ConfigureAwait(false);
        return isLeader ? DashboardRoleManager : DashboardRoleStaff;
    }

    /// <summary>
    /// Resolve the effective dashboard scope from the current user role.
    /// Manager => Department scope (all department data); Staff => Personal scope (own data only).
    /// </summary>
    private async Task<(AppDashboardScope Scope, int? DepartmentId)> ResolveRoleScopeAsync()
    {
        var role = await ResolveDashboardRoleAsync(DashboardRoleDepartmentId).ConfigureAwait(false);
        return role == DashboardRoleManager
            ? (AppDashboardScope.Department, (int?)DashboardRoleDepartmentId)
            : (AppDashboardScope.Personal, (int?)null);
    }

    private static RepositoryDashboardScope ToRepositoryScope(AppDashboardScope scope)
        => scope == AppDashboardScope.Department
            ? RepositoryDashboardScope.Department
            : RepositoryDashboardScope.Personal;
}

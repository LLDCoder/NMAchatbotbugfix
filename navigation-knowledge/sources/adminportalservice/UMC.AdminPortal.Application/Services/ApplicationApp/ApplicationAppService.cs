using CommunityToolkit.HighPerformance;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Org.BouncyCastle.Ocsp;
using RestSharp;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using UMC.AdminPortal.Application.Dtos;
using UMC.AdminPortal.Application.Dtos.Application;
using UMC.AdminPortal.Application.Dtos.ServiceInfo;
using UMC.AdminPortal.Application.Services.ContentDashboard;
using UMC.AdminPortal.Application.Services.ContentTeamManagement;
using UMC.AdminPortal.Application.Helpers;
using UMC.AdminPortal.Application.Dtos.CustomerPortalInternalApi;
using UMC.AdminPortal.Application.Dtos.License;
using UMC.AdminPortal.Application.Dtos.TeamManagement;
using UMC.AdminPortal.Application.Dtos.UserDto;
using UMC.AdminPortal.Application.Dtos.Workflow;
using UMC.AdminPortal.Application.Services.CustomerPortalInternalApi;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.SendTemplate;
using UMC.AdminPortal.Application.Services.CamundaTaskApp;
using UMC.AdminPortal.Application.Services.ApprovalRecall;
using UMC.AdminPortal.Application.Services.Frha.Trigger;
using UMC.AdminPortal.Application.Services.WorkflowActions;
using UMC.AdminPortal.Application.Services.ApplicationMaterials;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Application;
using UMC.AdminPortal.Domain.Models.Lookup;
using UMC.AdminPortal.Domain.Models.Workflow;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Serivces.ServiceInfo;
using UMC.AdminPortal.Domain.Service.Account;
using UMC.AdminPortal.Domain.Service.Application;
using UMC.AdminPortal.Domain.Service.License;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Service.UserService;
using UMC.AdminPortal.Domain.Service.Workflow;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.Models;
using Microsoft.Extensions.Localization;
using UMC.Utils.Framework;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Helps;
using UMC.Utils.Framework.Logging.Client;
using UMC.Utils.Framework.Module.Attributes;
using UMC.Utils.Framework.Page;
using UMC.Utils.Framework.RestSharpClient;
using static System.Net.Mime.MediaTypeNames;
using UserProfileDeviceStatsDto = UMC.AdminPortal.Domain.Service.UserService.ProfileDeviceStatsDto;
using UserProfileEmirateStatsDto = UMC.AdminPortal.Domain.Service.UserService.ProfileEmirateStatsDto;
using UserProfileStatusStatsDto = UMC.AdminPortal.Domain.Service.UserService.ProfileStatusStatsDto;
using UserProfileTrendStatsDto = UMC.AdminPortal.Domain.Service.UserService.ProfileTrendStatsDto;

namespace UMC.AdminPortal.Application.Services
{
    public interface IApplicationAppService
    {
        Task<MyReviewResponse> GetMyReviewPageAsync(MyReviewPageRequest req, int status, string departmentId, bool includeRecallEligibility = false);

        /// <summary>
        /// Approves a licensing application that the system, not a reviewer, decided on - today only the
        /// MoE trade-license sync, which files a modification or cancellation on the customer's behalf when
        /// the change needs no human judgement (requirement §8.1).
        ///
        /// Uses ServiceLookupMapping.ProcessId to match the manual payment flow: approve-first lands on
        /// Pending Payment, while pay-first completes immediately. Returns the fabricated process-instance
        /// id, or an empty string when the application had already moved past Under Review.
        /// </summary>
        Task<string> AutoApproveLicensingApplicationAsync(
            int applicationId,
            short serviceId,
            CancellationToken cancellationToken = default);
        Task<MyReviewDetailResponse> GetMyReviewDetailAsync(string taskId, string departmentId);
        Task<UpdateApplicationMaterialStatusResponse> UpdateApplicationMaterialStatusAsync(
            UpdateApplicationMaterialStatusRequest request,
            string materialId,
            CancellationToken cancellationToken = default);
        /// <summary>
        /// Returns the same status count breakdown as MyTodoPage.statusCount, using identical
        /// data source (Camunda assignee list + BuildReviewListAsync filtering).
        /// Use this when another service needs to align with MyTodoPage counts.
        /// </summary>
        Task<ReviewStatusCount> GetApplicationTodoStatusCountAsync(string departmentId);
        /// <summary>
        /// Returns the same status count breakdown as MyTeamTodoPage.statusCount, using identical
        /// data source (GetTaskListByDepartmentId + leader department filtering).
        /// Use this for leaders to align with MyTeamTodoPage counts.
        /// </summary>
        Task<ReviewStatusCount> GetApplicationTeamTodoStatusCountAsync(string departmentId);
        /// <summary>
        /// Date-windowed variant of MyTodoPage/MyComplatedPage counts. Reads the SAME source as
        /// api/Content/MyTodoPage + api/Content/MyComplatedPage (GetMyReviewListAsync — the current
        /// user's Camunda-assigned queue) and applies the SAME LastUpdatedTime window as the paged
        /// endpoints (>= start.Date, < end.AddDays(1).Date). TodoCount = MyTodoPage.Page.Total and
        /// CompletedCount = MyComplatedPage.Page.Total within the period, so a dashboard card built
        /// from these equals the sum of the two endpoints. Use for the staff taskHub card.
        /// </summary>
        Task<ReviewStatusCount> GetApplicationTodoStatusCountForPeriodAsync(string departmentId, DateTime? startTime, DateTime? endTime);
        /// <summary>
        /// Returns the SAME windowed personal-todo review rows that back
        /// <see cref="GetApplicationTodoStatusCountForPeriodAsync"/>.TodoCount (GetMyReviewListAsync →
        /// SelectPersonalTodo → the MyTodoPage LastUpdatedTime window). Callers that need the todo LIST
        /// (not just the count) — e.g. the Content dashboard serviceApplication tab — use this so the
        /// list length is guaranteed to equal the taskHub card's TodoCount for the same period.
        /// </summary>
        Task<List<MyReviewPageResponse>> GetApplicationTodoListForPeriodAsync(string departmentId, DateTime? startTime, DateTime? endTime);
        /// <summary>
        /// Single-pull variant that returns BOTH the windowed personal-todo review rows AND the windowed
        /// completed count from ONE GetMyReviewListAsync call. The Content dashboard serviceApplication
        /// card needs the todo LIST (for the list length / TodoCount parity) and the completed COUNT (for
        /// TotalTasks = todo + completed) together; pulling the Camunda queue once for both avoids the
        /// double pull of calling GetApplicationTodoListForPeriodAsync + GetApplicationTodoStatusCountForPeriodAsync.
        /// </summary>
        Task<(List<MyReviewPageResponse> TodoList, int CompletedCount)> GetApplicationTodoAndCompletedForPeriodAsync(string departmentId, DateTime? startTime, DateTime? endTime);
        // Task<bool> ApproveAsync(TaskActionDto req, string departmentId, WorkflowTransition? descriptor = null);
        Task<WorkflowActionExecuteResponse> ApproveV2Async(TaskActionDto req, string departmentId, CancellationToken cancellationToken = default);
        // Spec §4.4.3 / §5: drives the post-verification "next-node finishing path" after a
        // disposition Approve (action 201). Pure side-effect orchestration on the application
        // side — the disposition case fields themselves are still owned by the caller.
        // Disabled — disposition verification now settles inline in DispositionCaseAppService.CompleteVerifiedAsync.
        // Task<DispositionSettlementResult> SettleAfterDispositionVerificationAsync(int applicationId, string processInstanceId, int sourceWorkflowActionCode, CancellationToken cancellationToken = default);
        Task<MyTeamReviewResponse> GetMyTeamReviewPageAsync(MyTeamReviewPageRequest req, int status, string departmentId);
        Task<List<MyTeamMemberTaskResponse>> GetMyTeamMemberTaskAsync(MyTeamMemberTaskRequest req, string departmentId);
        Task<List<MyTeamMembersResponse>> GetMyTeamMembersAsync(bool isLeave);
        Task<bool> MyTeamMemberLeaveAsync(MyTeamMemberLeaveRequest req);
        Task<bool> MyTeamMemberReturnAsync(string userId);
        Task<byte[]> ExportMyTeamReviewAsync(MyTeamReviewPageRequest req, int status, string departmentId);
        Task<byte[]> ExportMyReviewAsync(MyReviewPageRequest req, int status, string departmentId);
        Task<bool> IsLeaderAsync(string departmentId);
        Task<int> GetUrgenCountAsync(string departmentId);
        Task<GetApplicationPageByProfileResponse> GetApplicationPageByProfileAsync(GetPageByProfilePageRequest req);
        Task<ApplicationApplicantDetailDto> GetApplicationApplicantDetailByApplicationIdAsync(int applicationId);


        Task<ApplicationDashboardStatisticsResponse> GetApplicationDashboardStatisticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null);
        Task<ContentDashboardStatisticsResponse> GetContentDashboardStatisticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null);
        Task<PageResponse<ApplicationServiceDashboardListDto>> GetServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc");
        Task<PageResponse<ContentServiceDashboardListDto>> GetContentServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc");
        Task<byte[]> ExportServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, string? orderby = null, string? sort = "desc");
        Task<byte[]> ExportContentServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, string? orderby = null, string? sort = "desc");
        Task<TeamDashboardResponse> GetTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc");
        Task<TeamDashboardResponse> GetContentTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc");
        Task<byte[]> ExportTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? orderby = null, string? sort = "desc");
        Task<byte[]> ExportContentTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? orderby = null, string? sort = "desc");


        Task<List<UserDepartLogsDto>> TeamMemberUserLeavesAsync(int departmentId);
    }

    [InjectOnScoped]
    public class ApplicationAppService(
        IApplicationService _applicationService,
        IUserService _userService,
        ICamundaWorkflowDomainService _camundaWorkflowDomainService,
        ICurrentUserService _currentUserService,
        ITypeDictionaryService _typeDictionaryService,
        ICamundaTaskAppService _camundaTaskApp,
        AdminPortalDBContext _db,
        RestClient _restClient,
        RestSharpClient restSharpClient,
        IUnitOfWork _unitOfWork,
        IContentDepartmentCertificateIssuanceService _contentDepartmentCertificateIssuanceService,
        IConfiguration _configuration,
        IServiceInfoDomainService serviceInfoDomainService,
        IHttpContextAccessor _httpContextAccessor,
        ILogger<ApplicationAppService> _logger,
        IQueryableContext _queryableContext,
        IWorkflowActionResolver _workflowActionResolver,
        ICustomerPortalInternalApiClient _customerPortalInternalApiClient,
        IWorkflowTransitionRegistry _workflowTransitionRegistry,
        Microsoft.Extensions.DependencyInjection.IServiceScopeFactory _scopeFactory,
        Pdf.ISupervisorReportPdfService _supervisorReportPdfService,
        IStringLocalizer<Language> _localizer,
        ISendTemplateService sendTemplateService,
        ContentLibraryApp.IContentLibraryAppService _contentLibraryApp,
        IDispositionCaseAppService _dispositionCaseAppService,
        Internal.AdCustoms.IAdCustomsReportService _adCustomsReportService,
        ILicenseManagementService _licenseManagementService,
        IContentTeamManagementAppService _contentTeamManagementAppService,
        IApprovalRecallApplicationService _approvalRecallApplicationService,
        UMC.AdminPortal.Application.Services.Frha.Trigger.IFahrTriggerService _fahrTriggerService,
        UMC.AdminPortal.Application.Services.Frha.Trigger.IFahrTriggerQueue _fahrTriggerQueue,
        IApplicationMaterialStatusService _applicationMaterialStatusService,
        FileStorage.FileStorageHttpClient _fileStorageClient,
        IAuditLogger? _auditLogger = null,
        IPermissionService? _permissionService = null,
        IDispositionNotificationService? _dispositionNotificationService = null,
        IApprovalRecordAttachmentService? _approvalRecordAttachmentService = null
    ) : IApplicationAppService
    {
        private readonly bool isArabic = _currentUserService.IsArabicLanguage;
        // Carries the "next" taskId that a workflow action produced during THIS request, so the
        // terminal-response builder can surface it as WorkflowActionExecuteResponse.NextTaskId.
        // The admin review detail page (which is keyed on the OLD, now-terminated taskId) reads
        // this to jump onto the freshly-created task. Two producers set it:
        //   - Request Modification: the brand-new task's Guid taskId (created synchronously).
        //   - 302 Disposition:      the synthetic "disposition-{caseId}" id.
        // Instance-scoped (service is [InjectOnScoped], one instance per request), so it is safe.
        private string? _pendingNextTaskId;
        private static readonly HashSet<int> WorkflowNonReassignableStatuses =
        [
            (int)ApprovalNodeOrder.ExternalApproval,
            (int)ApprovalNodeOrder.PendingModification
        ];
        public async Task<MyReviewResponse> GetMyReviewPageAsync(MyReviewPageRequest req, int status, string departmentId, bool includeRecallEligibility = false)
        {
            var result = new MyReviewResponse();
            if (status == 2)
                req = MyReviewFilter.NormalizeCompletedMyDecisionFilters(req);
            var list = await GetMyReviewListAsync(departmentId);

            // Exclude verified/expired dispositions: they carry TaskStatus "completed" and a DispositionCaseId,
            // so without this guard they would otherwise leak into todo via the DispositionCaseId.HasValue branch.
            // De-duplicate with a HashSet (keep first occurrence, preserve order). Was O(n^2)
            // via List.Any() per row — the dominant cost once a user's queue reaches thousands
            // of tasks. Same fix already applied to the team list (GetMyTeamReviewPageAsync).
            var todoList = ReviewTaskProjection.SelectPersonalTodo(list, IsCompletedReviewItem);
            var completedList = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem);
            var newCompletedList = completedList;

            result.StatusCount = new ReviewStatusCount()
            {
                TodoCount = todoList.Count(),
                PendingReviewCount = todoList.Count(a => a.StatusId != (int)ApprovalNodeOrder.PendingModification && a.StatusId != (int)ApprovalNodeOrder.ExternalApproval),
                PendingModificationCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.PendingModification),
                ExternalApproveCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.ExternalApproval),
                // Live disposition rows (service 302) sit in the todo queue with StatusId =
                // ApplicationStatus.PendingDisposition (108) before the applicant uploads proof,
                // and ApplicationStatus.DispositionVerification (109) once a submission awaits
                // admin verification (see BuildDispositionReviewResponseAsync). These were never
                // assigned here, so both counts always returned 0.
                PendingDispositionCount = todoList.Count(a => a.StatusId == (int)ApplicationStatus.PendingDisposition),
                DispositionVerificationCount = todoList.Count(a => a.StatusId == (int)ApplicationStatus.DispositionVerification),
                CompletedCount = newCompletedList.Count(),
            };

            switch (status)
            {
                case 1:
                    list = todoList;
                    break;
                case 2:
                    list = newCompletedList;
                    break;
                default:
                    list = ReviewTaskProjection.SelectPersonalAll(list, IsCompletedReviewItem);
                    break;
            }

            // Options for the service-name filter, taken from this tab's rows BEFORE any filter is
            // applied so picking one service does not collapse the dropdown to that single entry.
            // Built here, ahead of the Arabic display mapping below, which overwrites ServiceNameEn.
            result.ServiceOptions = BuildServiceFilterOptions(list);

            var hasMyDecisionFilter = status == 2
                && (req.ApprovalStatus is { Count: > 0 }
                    || !req.ApprovalStatusFilter.IsNullOrEmpty());

            if (status == 2)
            {
                list = MyReviewFilter.Apply(
                        list.AsQueryable(),
                        req,
                        includeReviewStatus: false)
                    .ToList();
                result.MyDecisionOptions = [.. MyDecisionOptionValues];
                if (hasMyDecisionFilter)
                    await PopulateCompletedMyDecisionsAsync(list);
            }

            result.ProcessInstanceStatus = list.Select(a => a.Status).Distinct().OrderBy(a => a).ToArray();
            result.ApprovalStatus = status == 2
                ? [.. MyDecisionOptionValues]
                : list.Select(a => a.TaskStatus).Distinct().OrderBy(a => a).ToArray();

            // Shared with ExportMyReviewAsync so the CSV always matches the visible page.
            var query = hasMyDecisionFilter
                ? MyReviewFilter.ApplyReviewStatus(list.AsQueryable(), req, filterByMyDecision: true)
                : status == 2
                    ? list.AsQueryable()
                    : MyReviewFilter.Apply(list.AsQueryable(), req);

            list = ApplyMyReviewSort(query, req, status, departmentId).ToList();
            var pageData = list
                .Skip((req.PageIndex - 1) * req.PageSize)
                .Take(req.PageSize)
                .ToList();

            if (status == 2 && !hasMyDecisionFilter)
                await PopulateCompletedMyDecisionsAsync(pageData);

            if (status == 2)
                ApplyCompletedMyDecisionCompatibility(pageData);

            // Recall eligibility is a completed-page enrichment only. It runs after the existing
            // filter, sort and pagination pipeline, so it cannot change membership, order, totals
            // or the query cost of the user's complete review history. Todo responses leave the
            // nullable DTO property unset and therefore do not expose the field.
            if (includeRecallEligibility
                && status == 2
                && departmentId == ((int)DepartmentEnum.Licensing).ToString()
                && pageData.Count > 0)
            {
                var eligibilityMap = await _approvalRecallApplicationService.GetEligibilityMapAsync(
                    pageData.Select(item => item.Id).Distinct().ToArray());
                ApplyRecallEligibility(pageData, eligibilityMap);
            }


            // Licensing My Todo needs an application-level FAHR marker before the reviewer clicks
            // Approve. Evaluate only the current page through the batch path to avoid N+1 queries
            // for the many non-FAHR services in the queue.
            if (status == 1
                && departmentId == ((int)DepartmentEnum.Licensing).ToString()
                && pageData.Count > 0)
            {
                var fahrEligibilityMap = await _fahrTriggerService
                    .EvaluateExternalApprovalEligibilityMapAsync(
                        pageData.Select(item => item.Id).Distinct().ToArray());
                foreach (var item in pageData)
                {
                    item.RequiresFahrApproval = fahrEligibilityMap.GetValueOrDefault(item.Id);
                }
            }

            // External Approval: surface the outside-authority code for rows still parked at
            // External Approval (11). Resolved once per page from the pending external-approval
            // records (ExternalOrganizationId set, no result yet) of those instances.
            var externalInstanceIds = pageData
                .Where(a => a.TaskStatusId == (int)ApprovalNodeOrder.ExternalApproval
                            || a.StatusId == (int)ApprovalNodeOrder.ExternalApproval)
                .Select(a => a.ProcessInstanceId)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList();
            if (externalInstanceIds.Count > 0)
            {
                var externalOrgByInstance = (await _db.ApprovalRecords
                        .AsNoTracking()
                        .Where(r => externalInstanceIds.Contains(r.ProcessInstanceId)
                                    && r.ExternalOrganizationId != null
                                    && r.ApprovalResult == null)
                        .Select(r => new { r.ProcessInstanceId, r.ExternalOrganizationId, r.Id })
                        .ToListAsync())
                    .GroupBy(r => r.ProcessInstanceId)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First().ExternalOrganizationId);
                foreach (var item in pageData)
                {
                    if ((item.TaskStatusId == (int)ApprovalNodeOrder.ExternalApproval
                         || item.StatusId == (int)ApprovalNodeOrder.ExternalApproval)
                        && externalOrgByInstance.TryGetValue(item.ProcessInstanceId, out var orgCode))
                    {
                        item.ExternalOrganizationId = orgCode;
                    }
                }
            }

            pageData.ForEach(a =>
            {
                if (a.StatusId == (int)ApprovalNodeOrder.Cancelled)
                    a.TaskStatus = "-";
                NormalizePausedSla(a);
                if (IsCompletedReviewItem(a))
                    a.ButtonJson = null;
                // SLA label per docs/rules/sla-label-display-rule.md: both the todo list (status == 1)
                // and the completed list (status == 2) use the "Due in {value}" / "{value} Overdue"
                // label, not the legacy "{value} Remaining".
                a.UseDueInSlaDescription = true;
                a.ApplyForEn = isArabic ? a.ApplyForAr : a.ApplyForEn;
                a.ServiceCategoryNameEn = isArabic ? a.ServiceCategoryNameAr : a.ServiceCategoryNameEn;
                a.ServiceNameEn = isArabic ? a.ServiceNameAr : a.ServiceNameEn;
                a.ServiceTypeNameEn = isArabic ? a.ServiceTypeNameAr : a.ServiceTypeNameEn;
            });

            await SuppressCompletedExternalApprovalButtonsAsync(pageData);

            result.Page = new PageResponse<MyReviewPageResponse>(pageData, list.Count, req.PageIndex, req.PageSize);

            return result;
        }

        /// <summary>
        /// Distinct services present in a review row set, for the list's service-name filter.
        /// Grouped by ServiceCode because Lookup.Services holds one row per service version under a
        /// single code, so version rows must collapse into one option — the same reason
        /// <see cref="MyReviewFilter"/> matches the filter value against ServiceCode.
        /// </summary>
        private static MyReviewServiceOption[] BuildServiceFilterOptions(IEnumerable<MyReviewPageResponse> rows)
        {
            return rows
                .Where(a => !string.IsNullOrWhiteSpace(a.ServiceCode))
                .GroupBy(a => a.ServiceCode!)
                .Select(g => new MyReviewServiceOption
                {
                    ServiceCode = g.Key,
                    ServiceNameEn = g.Select(a => a.ServiceNameEn).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? string.Empty,
                    ServiceNameAr = g.Select(a => a.ServiceNameAr).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? string.Empty,
                })
                .OrderBy(option => option.ServiceNameEn)
                .ToArray();
        }

        public async Task<MyReviewDetailResponse> GetMyReviewDetailAsync(string taskId, string departmentId)
        {
            var response = new MyReviewDetailResponse();

            var list = await GetReviewListByTaskIdAsync(taskId, departmentId);
            response.Detail = list.FirstOrDefault(a => a.TaskId == taskId);
            if (response.Detail == null)
                return response;

            // Delivery info rides on the task's own permission model: reaching this point means the task
            // resolved within the caller's department scope, so no extra check is applied. Null when the
            // applicant saved none — the review page then omits the Delivery Information card.
            response.DeliveryInfo = await DeliveryInfoProjection.LoadAsync(_db, response.Detail.Id);

            // Service 8008 shows the reviewer that the visiting individual completed the training
            // video confirmation - the precondition that released this request into review at all.
            // Null for every other service, which hides the card.
            response.TrainingConfirmation = await TrainingConfirmationProjection.LoadAsync(_db, response.Detail.Id);

            // Current handler is the task assignee; flag whether the logged-in user is that handler.
            response.IsCurrentHandler = !string.IsNullOrEmpty(response.Detail.Assignee)
                && response.Detail.Assignee == _currentUserService.UserId;

            if (response.Detail.StatusId == (int)ApprovalNodeOrder.Cancelled)
                response.Detail.TaskStatus = "-";
            NormalizePausedSla(response.Detail);

            // SLA label per docs/rules/sla-label-display-rule.md: a live todo detail uses the
            // "Due in {value}" / "{value} Overdue" label, matching the MyReviewPage todo list,
            // rather than the legacy "{value} Remaining".
            if (IsTodoReviewItem(response.Detail))
                response.Detail.UseDueInSlaDescription = true;

            await SuppressCompletedExternalApprovalButtonsAsync(new[] { response.Detail });

            // Whole-application rejection signal for the review UI: when the workflow ended in
            // rejection (latest process instance StatusId == Rejected) the client marks every
            // BookList row as Rejected. Anchored on the process instance — written on every reject
            // path and independent of the content library — not on Books.IsApproved.
            var latestInstanceStatusId = await _db.CamundaProcessInstances
                .AsNoTracking()
                .Where(p => p.ApplicationId == response.Detail.Id)
                .OrderByDescending(p => p.Id)
                .Select(p => p.StatusId)
                .FirstOrDefaultAsync();
            response.IsFirstApprovalRejected = latestInstanceStatusId == (int)ApprovalNodeOrder.Rejected;

            response.FormData = await _applicationMaterialStatusService.GetReviewFormDataAsync(
                response.Detail.Id,
                response.Detail.ApplicationDetailId);
            response.FormData = await ResolveTypeOfPublicationInFormDataAsync(response.FormData);
            // Detail pages sometimes need the untouched provider payload so the frontend can
            // apply service-specific parsing without overloading every review list row.
            var aiRawResponseJson = await _db.ApplicationsExts
            .Where(a => a.ApplicationId == response.Detail.Id)
            .Select(a => a.AIRawResponseJson)
            .FirstOrDefaultAsync();
            // The content-AI provider stores BOTH languages in the same blob: English under each
            // Material's RawResponse.data and Arabic under RawResponse.ar_data (there is no
            // per-language column). The frontend parses RawResponse.data, so Arabic viewers get the
            // Arabic payload projected into that same shape; English viewers get the untouched blob.
            response.AIRawResponseJson = isArabic
            ? ProjectAiRawResponseForArabic(aiRawResponseJson)
            : aiRawResponseJson;
            response.AiEvidence = ContentAiEvidenceParser.Parse(response.AIRawResponseJson);

            var reasonDic = await _typeDictionaryService.GetListAsync(new[] { "ModificationReason", "RejectionReason" });

            // Timeline is application-scoped, including approval rounds from both the original
            // process instance and a Req 147 Recall process instance. Read it explicitly from the
            // current database snapshot: filtering by the viewed ProcessInstanceId would hide the
            // original approvals, while filtering by the old instance would hide the Recall row.
            var approvalRecords = await _db.ApprovalRecords
                .AsNoTracking()
                .Where(a => a.ApplicationId == response.Detail.Id)
                .OrderBy(a => a.Id)
                .ToListAsync();

            var rejectAttachmentsByRecordId = await LoadApprovalRecordAttachmentMapAsync(
                approvalRecords.Select(record => record.Id),
                default);

            // External Approval: when the viewed node is still parked at External Approval (11),
            // surface the outside-authority code stored when it was parked. It lives on the
            // external-approval record (ExternalOrganizationId set, no result yet) of this instance.
            if (response.Detail.TaskStatusId == (int)ApprovalNodeOrder.ExternalApproval
                || response.Detail.StatusId == (int)ApprovalNodeOrder.ExternalApproval)
            {
                response.Detail.ExternalOrganizationId = approvalRecords
                    .Where(a => a.ProcessInstanceId == response.Detail.ProcessInstanceId
                                && !string.IsNullOrEmpty(a.ExternalOrganizationId)
                                && a.ApprovalResult == null)
                    .OrderByDescending(a => a.Id)
                    .Select(a => a.ExternalOrganizationId)
                    .FirstOrDefault();
            }

            // Resolve ApplicationDetailId from ApplicationId, then lookup SupervisorReport
            var applicationDetailId = await _db.ApplicationDetails
                .Where(ad => ad.ApplicationId == response.Detail.Id)
                .Select(ad => ad.Id)
                .FirstOrDefaultAsync();

            var supervisorReportsForDetail = applicationDetailId > 0
                ? await _db.SupervisorReports
                    .AsNoTracking()
                    .Where(a => a.ApplicationDetailId == applicationDetailId
                                && !string.IsNullOrEmpty(a.GeneratedReportUrl))
                    .OrderBy(a => a.Id)
                    .ToListAsync()
                : new List<SupervisorReport>();
            // For the inline Select below: pick the report (if any) whose ApprovalRecordId
            // matches the current action row. Fallback to the first report when none have
            // ApprovalRecordId set (pre-migration data).
            var supervisorReportByApprovalId = supervisorReportsForDetail
                .Where(r => r.ApprovalRecordId.HasValue)
                .ToDictionary(r => r.ApprovalRecordId!.Value);
            var supervisorReportFallback = supervisorReportsForDetail.FirstOrDefault(r => !r.ApprovalRecordId.HasValue);

            // Keep the application department as a compatibility fallback for historical
            // approval rows whose workflow task or runtime department is unavailable.
            var departmentName = await GetApplicationDepartmentNameAsync(response.Detail.Id, default);

            // Pre-fetch ApprovalNodeOrder label dictionary (TypeDictionary cached) once
            // so each timeline row resolves InstanceStatusId -> label without an extra
            // service round-trip per record.
            var approvalNodeLabels = (await _typeDictionaryService.GetListAsync("ApprovalNodeOrder"))
                .Where(x => int.TryParse(x.Code, out _))
                .ToDictionary(x => int.Parse(x.Code), x => isArabic ? x.NameAr : x.NameEn);

            // Timeline requirement: a node's Title is the BPMN node where the action
            // happened ("Initial Approval", ...), not the action's RESULTING status —
            // InstanceStatusId carries the result (e.g. Pending Payment) and stays as
            // fallback only for records whose task no longer resolves to a node.
            var nodeNamesByDefinitionKey = await GetWorkflowNodeNamesAsync(response.Detail.ServiceId);
            var recordTaskIds = approvalRecords
                .Where(a => !string.IsNullOrWhiteSpace(a.TaskId))
                .Select(a => a.TaskId!)
                .Distinct()
                .ToArray();
            var camundaTaskInfos = (await (
                    from task in _db.CamundaTasks.AsNoTracking()
                    join department in _db.Departments.AsNoTracking()
                        on task.ApprovalDepartment equals (int?)department.Id into taskDepartments
                    from department in taskDepartments.DefaultIfEmpty()
                    where recordTaskIds.Contains(task.TaskId)
                    select new
                    {
                        task.TaskId,
                        task.TaskDefinitionKey,
                        task.Assignee,
                        DepartmentName = department == null
                            ? null
                            : (isArabic ? department.NameAr : department.NameEn)
                    })
                .ToListAsync())
                .GroupBy(t => t.TaskId)
                .ToDictionary(g => g.Key, g => g.First());
            var taskDepartmentNames = camundaTaskInfos
                .Where(pair => !string.IsNullOrWhiteSpace(pair.Value.DepartmentName))
                .ToDictionary(pair => pair.Key, pair => pair.Value.DepartmentName!, StringComparer.OrdinalIgnoreCase);

            string? ResolveNodeTitle(string? taskId)
            {
                if (string.IsNullOrWhiteSpace(taskId)) return null;
                if (!camundaTaskInfos.TryGetValue(taskId, out var info)) return null;
                return nodeNamesByDefinitionKey.TryGetValue(info.TaskDefinitionKey, out var name) ? name : null;
            }

            // Write-side timeline: event rows (NodeType != null) are persisted at action
            // time and rendered by MapTimelineEventRowsAsync; NodeType == null rows keep
            // the legacy approval-action mapping below. Legacy applications without event
            // rows fall back to read-time synthesis per node kind further down.
            // Pending placeholders (created on node entry, ApprovalDate == null) are the
            // currently-open nodes — rendered as the in-progress row (Option B). Actioned rows
            // carry an ApprovalDate; event rows carry a NodeType.
            // Event-sourced timeline: every persisted row is a real action (no placeholders).
            //  - Review / SendBack rows render through the rich action-row mapping below.
            //  - All other NodeType rows (Submitted/Paid/Completed/AIReview/AutoApproved/...)
            //    render via MapTimelineEventRowsAsync.
            //  - External Approval placeholder rows (identified by ExternalOrganizationId) are
            //    displayed ONLY after the outside authority's result has been back-filled
            //    (ApprovalResult set). While the node is still parked awaiting the external
            //    result, the placeholder is hidden — the timeline shows just the originating
            //    node's action row (Review Result "External Approval"). The pending placeholder
            //    stays in the DB because the external-result return flow and the review dialogs
            //    depend on it (GetPendingExternalApprovalRecordAsync / Detail.ExternalOrganizationId).
            //  - Rows with an unrecognized/NULL NodeType and no external org (e.g. the secondary
            //    cancel row) are intentionally ignored.
            var (actionRecords, eventRecords) = SplitTimelineRecords(approvalRecords);
            eventRecords = FilterTimelineEventsForDepartment(eventRecords, departmentId);

            eventRecords = CollapseDuplicateSingletonTimelineEvents(eventRecords);

            // Completed External Approval rows read "External Approval" as their title (not the
            // BPMN node name) and surface the outside authority.
            var externalApprovalTitle = approvalNodeLabels.TryGetValue((int)ApprovalNodeOrder.ExternalApproval, out var extLabel)
                ? extLabel
                : (isArabic ? "موافقة خارجية" : "External Approval");
            // organizationCode -> localized organization name (TypeDictionary, redis-cached).
            var externalOrgLabels = (await _typeDictionaryService.GetListAsync("ExternalApprovalOrganization"))
                .Where(x => !string.IsNullOrEmpty(x.Code))
                .GroupBy(x => x.Code)
                .ToDictionary(g => g.Key, g => isArabic ? g.First().NameAr : g.First().NameEn);

            // External-approval reject/approve reuses the normal review path (reject == end the
            // flow), so the outside authority's decision lands as a plain Review row parked at the
            // External Approval node (InstanceStatusId == ExternalApproval) with NO ExternalOrganizationId
            // and no back-filled placeholder. ResolveNodeTitle would mislabel it with the BPMN
            // "Approval Node" name, so it is retitled to "External Approval" below. The org id is
            // recovered from the still-pending external placeholder (ExternalOrganizationId set,
            // ApprovalResult not yet back-filled) that the forward action created for this application.
            var pendingExternalOrgId = approvalRecords
                .Where(a => !string.IsNullOrEmpty(a.ExternalOrganizationId) && a.ApprovalResult == null)
                .Select(a => a.ExternalOrganizationId)
                .FirstOrDefault();

            // 302 material-list badge: fill ItemsApproved / ItemsRejected on the first-approval node
            // (the earliest Review action row carrying a Camunda TaskId). Computed once here because
            // the counts need an async content-library lookup that can't run inside the projection.
            int? firstApprovalItemsApproved = null;
            int? firstApprovalItemsRejected = null;
            int? firstApprovalBadgeRecordId = null;
            if (response.Detail?.ServiceCode == "302")
            {
                var firstApprovalRecord = actionRecords
                    .Where(a => a.NodeType == TimelineNodeTypes.Review && !string.IsNullOrEmpty(a.TaskId))
                    .OrderBy(a => a.ApprovalDate)
                    .ThenBy(a => a.Id)
                    .FirstOrDefault();
                if (firstApprovalRecord != null)
                {
                    var (approved, rejected) = await ComputeMaterialListDecisionCountsAsync(
                        applicationDetailId, firstApprovalRecord);
                    firstApprovalItemsApproved = approved;
                    firstApprovalItemsRejected = rejected;
                    firstApprovalBadgeRecordId = firstApprovalRecord.Id;
                }
            }

            var applicationTimeLine = actionRecords
                .Select(a =>
                {
                    // Attach the supervisor report only to the specific action node it was
                    // created at (ApprovalRecordId == a.Id). When ApprovalRecordId is null on
                    // an old record without the column set we still fall back to attaching, so
                    // existing behaviour is preserved for pre-migration data.
                    var supervisorReport = supervisorReportByApprovalId.TryGetValue(a.Id, out var exactMatch)
                        ? exactMatch
                        : supervisorReportFallback;
                    var isExternalRow = !string.IsNullOrEmpty(a.ExternalOrganizationId);
                    // A terminal decision (approve/reject) actioned while the task was parked at the
                    // External Approval node. It has no ExternalOrganizationId (normal review path),
                    // so it is detected by InstanceStatusId; the forward-to-external action itself
                    // (action code 300) is excluded — that row keeps the reviewer's own node title.
                    var isExternalNode = IsExternalApprovalNode(
                        a.ExternalOrganizationId, a.InstanceStatusId, a.WorkflowActionCode);
                    var isExternalOutcomeRow = isExternalNode && !isExternalRow;
                    var supervisorAttachments = AppendAttachment(
                        ParseAttachmentList(supervisorReport?.AttachmentUrlsJson),
                        supervisorReport?.GeneratedReportUrl);
                    var rejectAttachments = BuildRejectReasonAttachments(
                        rejectAttachmentsByRecordId,
                        a.Id,
                        a.RejectReasonFile);

                    return new ApplicationTimeLineResponse()
                    {
                        // Populate ApprovalRecordId so downstream code (e.g. supervisor-report
                        // injection into event nodes) can reliably identify this row.
                        ApprovalRecordId = a.Id,
                        Title = isExternalNode
                            ? externalApprovalTitle
                            : ResolveNodeTitle(a.TaskId)
                                ?? (a.InstanceStatusId.HasValue && approvalNodeLabels.TryGetValue(a.InstanceStatusId.Value, out var nodeLabel)
                                    ? nodeLabel
                                    : null),
                        UserId = a.ApproverId,
                        UserRole = ResolveTimelineDepartmentName(a.TaskId, taskDepartmentNames, departmentName),
                        // Completed External Approval node: show the outside authority that
                        // produced the result. The org id is on the row itself for a back-filled
                        // placeholder, otherwise recovered from the pending external placeholder.
                        ExternalOrganization = isExternalRow && externalOrgLabels.TryGetValue(a.ExternalOrganizationId!, out var orgName)
                            ? orgName
                            : (isExternalOutcomeRow && pendingExternalOrgId != null && externalOrgLabels.TryGetValue(pendingExternalOrgId, out var outcomeOrgName)
                                ? outcomeOrgName
                                : null),
                        ApprovalResult = a.ApprovalResult,
                        ApprovalTime = a.ApprovalDate ?? DateTimeHelper.Now,
                        Duration = isExternalRow ? null : a.ActualDurationMinutes,
                        ReasonAr = a.ApprovalResult switch
                        {
                            "Request Modification" => ResolveReasonNames(reasonDic, "ModificationReason", a.RejectReasonCode, reason => reason.NameAr),
                            "Rejected" => ResolveReasonNames(reasonDic, "RejectionReason", a.RejectReasonCode, reason => reason.NameAr),
                            _ => null
                        },
                        ReasonEn = a.ApprovalResult switch
                        {
                            "Request Modification" => ResolveReasonNames(reasonDic, "ModificationReason", a.RejectReasonCode, reason => reason.NameEn),
                            "Rejected" => ResolveReasonNames(reasonDic, "RejectionReason", a.RejectReasonCode, reason => reason.NameEn),
                            _ => null
                        },
                        ReasonFile = a.RejectReasonFile,
                        ApprovalComment = a.ApprovalComment,
                        NodeType = "Review",
                        ApprovalResultCode = a.WorkflowActionCode,
                        ObligationLetterUrl = supervisorReport?.ObligationLetterUrl,
                        // The generated report PDF rides inside Attachments (no dedicated
                        // field, frontend unchanged); absent until the PDF stub is wired.
                        Attachments = MergeTimelineAttachments(supervisorAttachments, rejectAttachments),
                        // 302 material-list badge: only the first-approval node carries the
                        // approved/rejected book counts (computed once, below). Other rows stay null.
                        ItemsApproved = a.Id == firstApprovalBadgeRecordId ? firstApprovalItemsApproved : null,
                        ItemsRejected = a.Id == firstApprovalBadgeRecordId ? firstApprovalItemsRejected : null,
                    };
                })
                .ToList();
            var eventTimelineNodes = await MapTimelineEventRowsAsync(
                eventRecords,
                departmentName,
                response.Detail.ServiceCode,
                rejectAttachmentsByRecordId);

            // Merge event nodes into the timeline before injecting the supervisor report so that
            // the injection pass can search across both action nodes and event nodes in one step.
            applicationTimeLine.AddRange(eventTimelineNodes);

            // Inject the supervisor-report URL into the correct timeline node.
            //
            // Priority order:
            //   1. Exact ApprovalRecordId match (the action/event node that was created for the
            //      same ApprovalRecord row, already populated inline for action nodes above).
            //   2. First displayed node whose ApprovalRecordId > the linked record's Id — i.e.
            //      the linked record exists in ApprovalRecords but has a NodeType that is NOT
            //      displayed (e.g. legacy null-NodeType row); the next visible node follows it.
            //   3. First displayed node that has any ApprovalRecordId (absolute fallback).
            //
            // Skip entirely if the action-node inline code already attached the report (the
            // exact-match action node already carries Attachments from the Select closure above).
            // For each supervisor report that was NOT already attached inline (i.e. no action node
            // carried its ApprovalRecordId), inject it into the best matching timeline node using
            // the same priority order as before.
            var inlineAttachedReportIds = new HashSet<int>(
                supervisorReportsForDetail
                    .Where(r => r.ApprovalRecordId.HasValue
                                && applicationTimeLine.Any(n =>
                                n.ApprovalRecordId == r.ApprovalRecordId.Value
                                && n.Attachments?.Any(a => a.Key == (r.GeneratedReportUrl ?? string.Empty)) == true))
                    .Select(r => r.Id));

            foreach (var report in supervisorReportsForDetail.Where(r => !inlineAttachedReportIds.Contains(r.Id)))
            {
                if (report.GeneratedReportUrl == null) continue;

                ApplicationTimeLineResponse? target = null;

                if (report.ApprovalRecordId.HasValue)
                {
                    var rid = report.ApprovalRecordId.Value;
                    target = applicationTimeLine.FirstOrDefault(n => n.ApprovalRecordId == rid);
                    target ??= applicationTimeLine
                        .Where(n => n.ApprovalRecordId > rid)
                        .OrderBy(n => n.ApprovalRecordId)
                        .FirstOrDefault();
                }

                target ??= applicationTimeLine
                    .Where(n => n.ApprovalRecordId.HasValue)
                    .OrderBy(n => n.ApprovalRecordId)
                    .FirstOrDefault();

                if (target != null)
                {
                var attachments = target.Attachments ?? new List<TimelineAttachmentDto>();
                if (!attachments.Any(a => a.Key == report.GeneratedReportUrl))
                attachments.Add(new TimelineAttachmentDto { Key = report.GeneratedReportUrl });
                target.Attachments = attachments;
                target.ReasonFile = report.GeneratedReportUrl;
                }
            }

            // Legacy fallbacks — only synthesize node kinds that have no persisted event rows.
            if (!eventRecords.Any(e => e.NodeType is TimelineNodeTypes.PendingDisposition
                    or TimelineNodeTypes.DispositionSubmitted))
            {
                await AppendDispositionTimelineAsync(response.Detail.Id, applicationTimeLine, departmentName);
            }
            if (!eventRecords.Any(e => e.NodeType == TimelineNodeTypes.Submitted))
            {
                applicationTimeLine.Add(new ApplicationTimeLineResponse()
                {
                    Title = isArabic ? "طلب تم تقديمها" : "Application Submitted",
                    UserId = response.Detail.UserId,
                    UserRole = "Customer",
                    ApprovalTime = response.Detail.SubmissionTime,
                    NodeType = TimelineNodeTypes.Submitted,
                });
            }

            // Fetched before timeline finalization: the latest disposition case both gates
            // the terminal node below and feeds response.DispositionCase at the end.
            var detailDispositionCase = await _db.DispositionCases
                .AsNoTracking()
                .Where(a => a.ApplicationDetailId == response.Detail.ApplicationDetailId)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

            // Terminal nodes (Completed / Rejected / Cancelled) are persisted event rows now —
            // customer payment, content auto-approval, disposition settle, manual approval
            // terminal (WriteTerminalTimelineEventIfTerminalAsync), expiry job, customer cancel.
            // No read-time terminal synthesis.

            var userIds = applicationTimeLine
                .Select(a => a.UserId)
                .Where(a => !string.IsNullOrWhiteSpace(a))
                .Distinct()
                .ToArray();
            var userList = await _userService.GetAsync(userIds);
            foreach (var item in applicationTimeLine)
            {
                var user = userList.FirstOrDefault(a => a.Id == item.UserId);
                if (user == null) continue;
                item.UserName = $"{user.FirstName} {user.LastName}".Trim();
                item.IsSelf = item.UserId == _currentUserService.UserId;
            }
            // Newest first. Event rows carry distinct timestamps (e.g. Paid/Completed differ by
            // 1ms); exact ties keep insertion order, which already reflects write order.
            // Attach GeneratedReportUrl from SupervisorReport to ALL timeline nodes
            // (the report belongs to the application, not a specific approval step).
            // Newest first.
            response.ApplicationTimeline = applicationTimeLine
            .OrderByDescending(a => a.ApprovalTime)
            .ToList();

            // Resolve each attachment's display fileName (Common.StoredFiles.DownloadFileName)
            // from its opaque storage Key in one pass across the finalized timeline.
            await ResolveAttachmentFileNamesAsync(response.ApplicationTimeline);

            var printingPermit = await _db.PrintingPermits.FirstOrDefaultAsync(a => a.ApplicationDetailId == response.Detail.ApplicationDetailId);
            if (printingPermit != null)
            {
                var book = await _db.Books.FirstOrDefaultAsync(a => a.Id == printingPermit.BookId);
                response.BookList.Add(book);
            }

            if (detailDispositionCase != null)
            {
                var latestSubmission = await _db.DispositionSubmissions
                    .AsNoTracking()
                    .Where(a => a.DispositionCaseId == detailDispositionCase.Id)
                    .OrderByDescending(a => a.Id)
                    .FirstOrDefaultAsync();
                response.DispositionCase = await BuildDispositionCaseDtoAsync(detailDispositionCase, latestSubmission);
            }

            return response;
        }

        public Task<UpdateApplicationMaterialStatusResponse> UpdateApplicationMaterialStatusAsync(
            UpdateApplicationMaterialStatusRequest request,
            string materialId,
            CancellationToken cancellationToken = default) =>
            _applicationMaterialStatusService.UpdateAsync(request, materialId, cancellationToken);

        internal static void NormalizePausedSla(MyReviewPageResponse item)
        {
            if (item.StatusId == (int)ApprovalNodeOrder.PendingModification)
                item.SLA = null;
        }

        public async Task<ReviewStatusCount> GetApplicationTodoStatusCountAsync(string departmentId)
        {
            var list = await GetMyReviewListAsync(departmentId);
            var todoList = ReviewTaskProjection.SelectPersonalTodo(list, IsCompletedReviewItem);
            var completedCount = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem).Count;
            return new ReviewStatusCount
            {
                TodoCount = todoList.Count,
                PendingReviewCount = todoList.Count(a =>
                    a.StatusId != (int)ApprovalNodeOrder.PendingModification
                    && a.StatusId != (int)ApprovalNodeOrder.ExternalApproval),
                PendingModificationCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.PendingModification),
                ExternalApproveCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.ExternalApproval),
                CompletedCount = completedCount,
                OverdueCount = todoList.Count(a => a.SLA > 0),
            };
        }

        public async Task<ReviewStatusCount> GetApplicationTodoStatusCountForPeriodAsync(string departmentId, DateTime? startTime, DateTime? endTime)
        {
            // Same source as api/Content/MyTodoPage + MyComplatedPage: the current user's Camunda
            // queue projected through the same todo/completed selectors.
            var list = await GetMyReviewListAsync(departmentId);
            var todoList = ReviewTaskProjection.SelectPersonalTodo(list, IsCompletedReviewItem);
            var completedList = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem);

            // Same LastUpdatedTime window the paged endpoints apply (GetMyReviewPageAsync :193-196):
            // StartTime inclusive by date, EndTime end-exclusive (+1 day). Applied to BOTH todo and
            // completed so counts equal the two endpoints' Page.Total within the selected period.
            static IEnumerable<MyReviewPageResponse> ApplyWindow(IEnumerable<MyReviewPageResponse> rows, DateTime? start, DateTime? end)
            {
                if (start.HasValue)
                    rows = rows.Where(a => a.LastUpdatedTime >= start.Value.Date);
                if (end.HasValue)
                    rows = rows.Where(a => a.LastUpdatedTime < end.Value.AddDays(1).Date);
                return rows;
            }

            var windowedTodo = ApplyWindow(todoList, startTime, endTime).ToList();
            var completedCount = ApplyWindow(completedList, startTime, endTime).Count();

            return new ReviewStatusCount
            {
                TodoCount = windowedTodo.Count,
                PendingReviewCount = windowedTodo.Count(a =>
                    a.StatusId != (int)ApprovalNodeOrder.PendingModification
                    && a.StatusId != (int)ApprovalNodeOrder.ExternalApproval),
                PendingModificationCount = windowedTodo.Count(a => a.StatusId == (int)ApprovalNodeOrder.PendingModification),
                ExternalApproveCount = windowedTodo.Count(a => a.StatusId == (int)ApprovalNodeOrder.ExternalApproval),
                CompletedCount = completedCount,
                OverdueCount = windowedTodo.Count(a => a.SLA > 0),
            };
        }

        public async Task<(List<MyReviewPageResponse> TodoList, int CompletedCount)> GetApplicationTodoAndCompletedForPeriodAsync(string departmentId, DateTime? startTime, DateTime? endTime)
        {
            // One Camunda-queue pull feeds both outputs, mirroring GetApplicationTodoStatusCountForPeriodAsync
            // (todo + completed windowing) and GetApplicationTodoListForPeriodAsync (todo list windowing).
            var list = await GetMyReviewListAsync(departmentId);
            var todoList = ReviewTaskProjection.SelectPersonalTodo(list, IsCompletedReviewItem);
            var completedList = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem);

            IEnumerable<MyReviewPageResponse> windowedTodo = todoList;
            IEnumerable<MyReviewPageResponse> windowedCompleted = completedList;
            if (startTime.HasValue)
            {
                windowedTodo = windowedTodo.Where(a => a.LastUpdatedTime >= startTime.Value.Date);
                windowedCompleted = windowedCompleted.Where(a => a.LastUpdatedTime >= startTime.Value.Date);
            }
            if (endTime.HasValue)
            {
                windowedTodo = windowedTodo.Where(a => a.LastUpdatedTime < endTime.Value.AddDays(1).Date);
                windowedCompleted = windowedCompleted.Where(a => a.LastUpdatedTime < endTime.Value.AddDays(1).Date);
            }

            var result = windowedTodo.ToList();
            foreach (var row in result)
                row.IsArabic = isArabic;
            return (result, windowedCompleted.Count());
        }

        public async Task<List<MyReviewPageResponse>> GetApplicationTodoListForPeriodAsync(string departmentId, DateTime? startTime, DateTime? endTime)
        {
        // MUST mirror GetApplicationTodoStatusCountForPeriodAsync exactly so the returned list's
        // Count equals that method's TodoCount for the same window (single source of truth =
        // MyTodoPage). Same source (GetMyReviewListAsync), same personal-todo projection
        // (SelectPersonalTodo — deduped by (ApplicationId, DispositionCaseId)), same LastUpdatedTime
        // window (>= start.Date, < end.AddDays(1).Date).
        var list = await GetMyReviewListAsync(departmentId);
        var todoList = ReviewTaskProjection.SelectPersonalTodo(list, IsCompletedReviewItem);

        IEnumerable<MyReviewPageResponse> windowed = todoList;
        if (startTime.HasValue)
            windowed = windowed.Where(a => a.LastUpdatedTime >= startTime.Value.Date);
        if (endTime.HasValue)
            windowed = windowed.Where(a => a.LastUpdatedTime < endTime.Value.AddDays(1).Date);

        var result = windowed.ToList();
        foreach (var row in result)
            row.IsArabic = isArabic;
        return result;
        }

        public async Task<ReviewStatusCount> GetApplicationTeamTodoStatusCountAsync(string departmentId)
        {
            // Mirrors GetMyTeamReviewPageAsync.StatusCount exactly:
            // - GetMyTeamReviewListAsync uses GetTaskListByDepartmentId (leader's departments)
            // - todoList EXCLUDES ExternalApproval items (IsExternalApprovalItem filter)
            // - so ExternalApproveCount is always 0 in the team view
            // - TodoCount = pendingReview + pendingModification (no EA)
            var list = await GetMyTeamReviewListAsync(departmentId);
            var todoList = ReviewTaskProjection.SelectTeamTodo(
                list,
                IsCompletedReviewItem,
                IsExternalApprovalItem);
            var completedCount = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem).Count;
            return new ReviewStatusCount
            {
                TodoCount = todoList.Count,
                PendingReviewCount = todoList.Count(a =>
                    a.StatusId != (int)ApprovalNodeOrder.PendingModification
                    && a.StatusId != (int)ApprovalNodeOrder.ExternalApproval),
                PendingModificationCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.PendingModification),
                ExternalApproveCount = 0,
                CompletedCount = completedCount,
            };
        }

        // Export column order for personal review CSVs. MyTodo's fifth column is TaskStatus (the
        // workflow node); MyCompleted's fifth column is MyDecision (the review action). Each
        // language variant and the row builder below are kept in step through these arrays.
        internal static readonly string[] ExportMyReviewHeadersEn =
        {
            "Application No.", "Service Name", "Service Category", "Type", "Status", "SLA", "Apply For", "Submission Time"
        };

        internal static readonly string[] ExportMyReviewHeadersAr =
        {
            "رقم الطلب", "اسم الخدمة", "فئة الخدمة", "النوع", "الحالة", "SLA", "مقدم الطلب", "وقت التقديم"
        };

        internal static readonly string[] ExportMyCompletedReviewHeadersEn =
        {
            "Application No.", "Service Name", "Service Category", "Type", "My Decision", "SLA", "Apply For", "Submission Time"
        };

        internal static readonly string[] ExportMyCompletedReviewHeadersAr =
        {
            "رقم الطلب", "اسم الخدمة", "فئة الخدمة", "النوع", "قراري", "SLA", "مقدم الطلب", "وقت التقديم"
        };

        public async Task<byte[]> ExportMyReviewAsync(MyReviewPageRequest req, int status, string departmentId)
        {
            // The status dropdown reaches this endpoint under a different parameter name than it
            // reaches the list, and those names bind to two different columns. Re-read it as the
            // list's filter first so the CSV cannot contain rows the list excluded.
            req = MyReviewFilter.NormalizeExportStatusFilter(
                req,
                approvalStatusIsMyDecision: status == 2);
            if (status == 2)
                req = MyReviewFilter.NormalizeCompletedMyDecisionFilters(req);

            var list = await GetMyReviewListAsync(departmentId);

            switch (status)
            {
                case 1:
                    list = ReviewTaskProjection.SelectPersonalTodo(list, IsCompletedReviewItem);
                    break;
                case 2:
                    list = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem);
                    break;
                default:
                    list = ReviewTaskProjection.SelectPersonalAll(list, IsCompletedReviewItem);
                    break;
            }

            if (status == 2)
            {
                list = MyReviewFilter.Apply(
                        list.AsQueryable(),
                        req,
                        includeReviewStatus: false)
                    .ToList();
                await PopulateCompletedMyDecisionsAsync(list);
            }

            // Shared with GetMyReviewPageAsync so the CSV always matches the visible page:
            // same filters, then the same ordering.
            list = ApplyMyReviewSort(
                    status == 2
                        ? MyReviewFilter.ApplyReviewStatus(list.AsQueryable(), req, filterByMyDecision: true)
                        : MyReviewFilter.Apply(list.AsQueryable(), req),
                    req,
                    status,
                    departmentId)
                .ToList();

            // Approval-node labels for the Status column. Resolved AFTER MyReviewFilter.Apply above,
            // which matches approvalStatus against the English TaskStatus the frontend's dropdown
            // posts back — translating any earlier would make every Arabic filter miss. Rows whose
            // TaskStatusId is null (live disposition rows) already carry a localized ApplicationStatuses
            // label from BuildDispositionReviewResponseAsync, so they are left alone.
            var approvalNodeNamesAr = isArabic
                ? (await _typeDictionaryService.GetListAsync("ApprovalNodeOrder"))
                    .Where(x => int.TryParse(x.Code, out _) && !string.IsNullOrWhiteSpace(x.NameAr))
                    .GroupBy(x => int.Parse(x.Code))
                    .ToDictionary(g => g.Key, g => g.First().NameAr)
                : null;

            // Mirror the per-row display normalization the paged list applies before rendering
            // (GetMyReviewPageAsync). Without it the CSV showed the raw model: the SLA column used
            // the legacy "{value} Remaining" label instead of "Due in {value}", Pending Modification
            // rows carried an SLA the list blanks out, and Arabic sessions still got English text.
            foreach (var item in list)
            {
                // NameAr is not seeded for every ApprovalNodeOrder code, so an unmapped status
                // keeps its English label rather than blanking the column.
                if (approvalNodeNamesAr != null
                    && item.TaskStatusId.HasValue
                    && approvalNodeNamesAr.TryGetValue(item.TaskStatusId.Value, out var taskStatusAr))
                    item.TaskStatus = taskStatusAr;
                if (item.StatusId == (int)ApprovalNodeOrder.Cancelled)
                    item.TaskStatus = "-";
                if (item.StatusId == (int)ApprovalNodeOrder.PendingModification)
                    item.SLA = null;
                item.UseDueInSlaDescription = true;
                item.ApplyForEn = isArabic ? item.ApplyForAr : item.ApplyForEn;
                item.ServiceCategoryNameEn = isArabic ? item.ServiceCategoryNameAr : item.ServiceCategoryNameEn;
                item.ServiceNameEn = isArabic ? item.ServiceNameAr : item.ServiceNameEn;
                item.ServiceTypeNameEn = isArabic ? item.ServiceTypeNameAr : item.ServiceTypeNameEn;
            }

            var headers = status == 2
                ? (isArabic ? ExportMyCompletedReviewHeadersAr : ExportMyCompletedReviewHeadersEn)
                : (isArabic ? ExportMyReviewHeadersAr : ExportMyReviewHeadersEn);

            var data = new List<List<string>>();
            foreach (var item in list)
            {
                data.Add(new List<string>()
                {
                    item.ApplicationNumber,
                    item.ServiceNameEn,
                    item.ServiceCategoryNameEn,
                    item.ServiceTypeNameEn,
                    //item.Status,
                    status == 2 ? item.MyDecision ?? "-" : item.TaskStatus,
                    item.SLADescription,
                    item.ApplyForEn,
                    item.SubmissionTime.ToString("dd/MM/yyyy HH:mm:ss")
                    //item.LastUpdatedTime.ToString("dd/MM/yyyy HH:mm:ss")
                });
            }

            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers.Select(EscapeCsv)));
                    foreach (var item in data)
                    {
                        sw.WriteLine(string.Join(",", item.Select(EscapeCsv)));
                    }
                }
                return ms.ToArray();
            }
        }

        // Quotes a CSV field when it holds a comma, quote or newline, so a service name like
        // "Permit for X, Y and Z" cannot shift every following column one cell to the left.
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal static string EscapeCsv(string? value)
        {
            if (string.IsNullOrEmpty(value))
                return string.Empty;

            return value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r')
                ? $"\"{value.Replace("\"", "\"\"")}\""
                : value;
        }

        #region Approve

        // Collects work that must run AFTER the admin transaction commits. Cross-service
        // HTTP calls (e.g. CustomerPortal CompleteLicensingFreePayment writeback) must not
        // run inside the admin tx because a rollback after a successful writeback would
        // desync the two services: customer = Completed but admin task still open.
        private sealed class DeferredPostCommitActions
        {
            public string? FreeLicensingWritebackApplicationNumber { get; set; }
            public int? FreeLicensingWritebackApplicationId { get; set; }

            // Content approval persists ApplicationDetails.ApplicationStatusId=105 inside the Admin
            // transaction. The queued processor begins with CustomerPortal content materialization,
            // which opens a separate database connection and must not run until that 105 is committed.
            public int? ContentApprovalIssuanceApplicationId { get; set; }
            public short? ContentApprovalPreviousApplicationStatusId { get; set; }
            public string? ContentApprovalIssuanceHookName { get; set; }

            // Content-department reject -> CustomerPortal book-rejection writeback, scheduled here
            // instead of being called inline. Admin and CustomerPortal share the same physical DB
            // (umc_data_test); invoking the writeback while the admin approval tx still holds the
            // Application row lock deadlocked it against the writeback's own read of that row,
            // stalling ~30s until both the SQL command timeout and the HTTP client timeout fired.
            // Draining it only AFTER CommitAsync releases the lock first, breaking the deadlock.
            public string? ContentRejectionWritebackApplicationNumber { get; set; }
            public int? ContentRejectionWritebackApplicationId { get; set; }

            // AD Customs integration point A: after content approval completes(105), report "permit approval completed" to SIG.
            // Here we only collect the ApplicationId; the actual reporting runs post-commit fire-and-forget in RunDeferredPostCommitActionsAsync
            // — the reporting service internally handles port/status gating (silently skips non-Abu-Dhabi / no RegulateEntry) and only warns on failure.
            public int? AdCustomsReportApplicationId { get; set; }

            // FAHR outbound work is queued only after the approval transaction commits. The
            // queue item is deliberately process-local; a restart requires manual replay.
            public Frha.Trigger.FahrTriggerWorkItem? FahrTriggerWorkItem { get; set; }

            public DeferredDispositionCreatedNotification DispositionCreatedNotification { get; } = new();
        }

        // Drains any deferred cross-service work scheduled during the just-committed
        // approval. Logs and rethrows on failure so the caller knows admin state is
        // committed but customer side is now out of sync (writeback is idempotent —
        // a manual retry or healing job can reconcile).
        private async Task RunDeferredPostCommitActionsAsync(DeferredPostCommitActions deferred)
        {
            // Free-licensing writeback: rethrow on failure so the caller knows admin state is
            // committed but the customer side is now out of sync (writeback is idempotent — a
            // manual retry or healing job can reconcile).
            if (!string.IsNullOrWhiteSpace(deferred.FreeLicensingWritebackApplicationNumber))
            {
                try
                {
                    await _customerPortalInternalApiClient.CompleteLicensingFreePaymentAsync(
                        new CustomerPortalLicensingFreePaymentApprovalRequest
                        {
                            ApplicationNumber = deferred.FreeLicensingWritebackApplicationNumber
                        });
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Free-licensing writeback to CustomerPortal failed AFTER admin commit. ApplicationId {ApplicationId}, ApplicationNumber {ApplicationNumber}. Admin state is committed; customer side needs a manual retry/heal.",
                        deferred.FreeLicensingWritebackApplicationId,
                        deferred.FreeLicensingWritebackApplicationNumber);
                    throw;
                }
            }

            // Queue content materialization/certificate work only after CommitAsync. Enqueuing it
            // inside the transaction races the background processor against the commit: CustomerPortal
            // can otherwise read the previous status (snapshot isolation) or wait on the Admin lock.
            if (deferred.ContentApprovalIssuanceApplicationId.HasValue)
            {
                try
                {
                    await _contentDepartmentCertificateIssuanceService.GenerateInternalCertificateAsync(
                        deferred.ContentApprovalIssuanceApplicationId.Value,
                        deferred.ContentApprovalPreviousApplicationStatusId,
                        deferred.ContentApprovalIssuanceHookName ?? "ContentApproveAsync-post-commit");
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Content approval materialization/certificate work could not be queued AFTER admin commit. ApplicationId {ApplicationId}. Admin status is committed; CustomerPortal writeback needs a manual retry/heal.",
                        deferred.ContentApprovalIssuanceApplicationId);
                    throw;
                }
            }

            // Content book-rejection writeback: runs here (post-commit) so the admin reject tx has
            // already released the Application row lock, avoiding the shared-DB cross-service
            // deadlock described on DeferredPostCommitActions. Best-effort — the CustomerPortal
            // endpoint no-ops for non-204 services, so a miss is swallowed (matches the prior
            // inline behavior) and can be reconciled later; it must not fail the committed reject.
            if (!string.IsNullOrWhiteSpace(deferred.ContentRejectionWritebackApplicationNumber))
            {
                try
                {
                    await _customerPortalInternalApiClient.ApplyContentRejectionWriteBackAsync(
                        new CustomerPortalContentApprovalWriteBackRequest
                        {
                            ApplicationNumber = deferred.ContentRejectionWritebackApplicationNumber,
                            // Unambiguous id so CustomerPortal resolves the exact application, not a shared-number sibling.
                            ApplicationId = deferred.ContentRejectionWritebackApplicationId
                        });
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Content book rejection writeback to CustomerPortal failed AFTER admin commit. ApplicationId {ApplicationId}, ApplicationNumber {ApplicationNumber}. Reject is committed; customer content-library flag needs a manual retry/heal.",
                        deferred.ContentRejectionWritebackApplicationId,
                        deferred.ContentRejectionWritebackApplicationNumber);
                }
            }

            if (deferred.FahrTriggerWorkItem != null)
            {
                try
                {
                    await _fahrTriggerQueue.EnqueueAsync(
                        deferred.FahrTriggerWorkItem,
                        CancellationToken.None);
                    _logger.LogInformation(
                        "[FAHR][TRIGGER-QUEUE] Enqueued ApplicationId={ApplicationId} InstanceId={InstanceId} after approval commit.",
                        deferred.FahrTriggerWorkItem.ApplicationId,
                        deferred.FahrTriggerWorkItem.InstanceId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "[FAHR][TRIGGER-QUEUE] Enqueue failed after approval commit ApplicationId={ApplicationId} InstanceId={InstanceId}; replay through the FAHR manual trigger endpoint.",
                        deferred.FahrTriggerWorkItem.ApplicationId,
                        deferred.FahrTriggerWorkItem.InstanceId);
                }
            }

            if (_dispositionNotificationService != null)
            {
                await deferred.DispositionCreatedNotification.RunAsync(_dispositionNotificationService, _logger);
            }
        }

        // public Task<bool> ApproveAsync(TaskActionDto req, string departmentId,
        //     WorkflowTransition? descriptor = null)
        // {
        //     // V1 entry point (no transaction wrapping). The post-commit collector is
        //     // unused here — FinalizeLicensingApprovedAsync falls back to inline writeback
        //     // to preserve legacy behavior for direct ApproveAsync callers.
        //     return ApproveAsync(req, departmentId, descriptor, deferred: null);
        // }

        private async Task<bool> ApproveAsync(TaskActionDto req,
            WorkflowTransition? descriptor, DeferredPostCommitActions? deferred)
        {
            // ApproveV2 has already authorized the current assignee, task department and
            // request context. Do not reapply the service owner's static department as a task scope.
            var application = await _applicationService.GetByIdAsync(req.ApplicationId, null);
            if (application == null)
                throw new BusinessException("Application data not found");


            bool result;
            if (descriptor != null)
            {
                result = descriptor.PaymentFlow switch
                {
                    PaymentFlowKind.ApproveFirst => await LicensingApproveAsync(req, descriptor, application, deferred),
                    PaymentFlowKind.PayFirst => await ContentApproveAsync(req, descriptor, application, deferred),
                    _ => false
                };
            }
            else
            {
                // Legacy path: fall back to department-Id routing when no descriptor is available.
                result = application.Service.Department switch
                {
                    (int)DepartmentEnum.Licensing => await LicensingApproveAsync(req, descriptor, application, deferred),
                    (int)DepartmentEnum.Content => await ContentApproveAsync(req, descriptor, application, deferred),
                    _ => false
                };
            }
            // Only terminal decisions notify the customer. Intermediate nodes (e.g.
            // RejectRouteNext) hand the application to the next reviewer — no terminal
            // notification yet.
            if (result && descriptor?.IsIntermediate != true)
            {
                if (descriptor?.Type == WorkflowActionType.Reject)
                {
                    await SendApplicationRejectedAsync(req.ApplicationId, req.RejectReasonCode);
                }
                else if (descriptor?.Type == WorkflowActionType.RequestModification)
                {
                    await SendApplicationModificationAsync(req.ApplicationId, req.RejectReasonCode);
                }
            }
            return result;
        }

        // Spec §8.5–§8.6 fixed prompt strings, localized by the current viewer's language
        // (isArabic). Kept as a single source of truth; the Arabic copy should be reviewed by
        // the localization team. English values are unchanged from the frontend contract.
        private string PendingDispositionPrompt => isArabic
            ? "تم إخطار مقدم الطلب باختيار طريقة التصرف ورفع المستندات الداعمة المطلوبة للمواد الإعلامية المرفوضة."
            : "The applicant has been notified to select a disposition method and upload the required supporting documentation for the rejected media materials.";
        private string DispositionSubmittedPrompt => isArabic
            ? "قام مقدم الطلب بتقديم مستندات التصرف المطلوبة."
            : "The applicant has submitted the required disposition documentation.";
        private string CompletedPrompt => isArabic
            ? "تم استكمال عملية الطلب."
            : "The application process has been completed.";
        private string RejectedPrompt => isArabic
            ? "تم رفض الطلب."
            : "The application has been rejected.";
        private string PendingPaymentPrompt => isArabic
            ? "في انتظار سداد رسوم هذا الطلب."
            : "Pending payment for this application.";
        private string CancelledPrompt => isArabic
            ? "قام المتعامل بإلغاء الطلب."
            : "The customer has cancelled the application.";
        private string PaidPrompt => isArabic
            ? "قام المتعامل بسداد رسوم هذا الطلب."
            : "The customer has completed the payment for this application.";

        // Renders persisted timeline event rows (ApprovalRecords.NodeType != null) into
        // display nodes. Disposition rows are enriched from DispositionSubmissions via
        // SourceSubmissionId (customer note + attachments); a reviewed row supersedes the
        // submitted row of the same submission so each proof shows as ONE node whose
        // content switches after review (requirement §Disposition Verification).
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task<List<ApplicationTimeLineResponse>> MapTimelineEventRowsAsync(
            List<ApprovalRecord> eventRecords,
            string? departmentName,
            string? serviceCode = null,
            IReadOnlyDictionary<int, IReadOnlyList<TimelineAttachmentDto>>? rejectAttachmentsByRecordId = null)
        {
            var rows = new List<ApplicationTimeLineResponse>();
            if (eventRecords.Count == 0)
            {
                return rows;
            }

            var lang = isArabic ? "ar" : "en";
            // Pending Disposition is a status, not a timeline node (PRD 302): the next visible
            // node after approval is Disposition Submitted, so no PendingDisposition label here.
            var dispositionVerificationLabel = await _typeDictionaryService.GetLocalizedNameAsync(
                "ApplicationStatuses", ((int)ApplicationStatus.DispositionVerification).ToString(), lang);

            var submissionIds = eventRecords
                .Where(e => e.SourceSubmissionId.HasValue)
                .Select(e => e.SourceSubmissionId!.Value)
                .Distinct()
                .ToArray();
            var submissionsById = submissionIds.Length == 0
                ? new Dictionary<int, DispositionSubmission>()
                : await _db.DispositionSubmissions
                    .AsNoTracking()
                    .Where(s => submissionIds.Contains(s.Id))
                    .ToDictionaryAsync(s => s.Id);

            // The durable Recall request is the source of truth for the operator's reason.
            // Normally the completion transaction also copies it to ApprovalComment. Fall back
            // to the source row only when that copy is empty, so existing Timeline behaviour is
            // unchanged while completed Recall records with a missing comment remain readable.
            var recallIdsNeedingSourceData = eventRecords
                .Where(e => e.NodeType == TimelineNodeTypes.Recall
                            && e.SourceRecallId.HasValue
                            && (string.IsNullOrWhiteSpace(e.ApprovalComment)
                                || IsLegacyOverwrittenRecallRecord(e)))
                .Select(e => e.SourceRecallId!.Value)
                .Distinct()
                .ToArray();
            var recallsById = recallIdsNeedingSourceData.Length == 0
                ? new Dictionary<long, global::UMC.AdminPortal.Domain.Models.Workflow.ApprovalRecall>()
                : await _db.ApprovalRecalls
                    .AsNoTracking()
                    .Where(r => recallIdsNeedingSourceData.Contains(r.Id))
                    .ToDictionaryAsync(r => r.Id);

            // The detail entry point normally resolves the application's department once and
            // passes it in. Keep Recall rows self-sufficient when that lookup is empty (for
            // example, an older/read-model path) so the required handler-department tag is not
            // silently omitted from the Timeline card.
            var recallDepartmentNamesByApplicationId = new Dictionary<int, string>();
            if (string.IsNullOrWhiteSpace(departmentName))
            {
                var recallApplicationIds = eventRecords
                    .Where(e => e.NodeType == TimelineNodeTypes.Recall)
                    .Select(e => e.ApplicationId)
                    .Distinct()
                    .ToArray();
                if (recallApplicationIds.Length > 0)
                {
                    var recallDepartmentRows = await (
                            from app in _db.Applications.AsNoTracking()
                            join svc in _db.ServiceConfigs.AsNoTracking() on app.ServiceId equals svc.Id
                            join dept in _db.Departments.AsNoTracking() on svc.Department equals dept.Id
                            where recallApplicationIds.Contains(app.Id)
                            select new
                            {
                                ApplicationId = app.Id,
                                DepartmentName = isArabic ? dept.NameAr : dept.NameEn
                            })
                        .ToListAsync();

                    recallDepartmentNamesByApplicationId = recallDepartmentRows
                        .Where(x => !string.IsNullOrWhiteSpace(x.DepartmentName))
                        .GroupBy(x => x.ApplicationId)
                        .ToDictionary(x => x.Key, x => x.First().DepartmentName!);
                }
            }

            foreach (var e in eventRecords)
            {
                var rowsBefore = rows.Count;
                switch (e.NodeType)
                {
                    case TimelineNodeTypes.Submitted:
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = isArabic ? "طلب تم تقديمها" : "Application Submitted",
                            UserId = e.ApproverId ?? string.Empty,
                            UserRole = "Customer",
                            ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now
                        });
                        break;
                    case TimelineNodeTypes.PendingPayment:
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = await _typeDictionaryService.GetLocalizedNameAsync(
                                "ApplicationStatuses", ((int)ApplicationStatus.PendingPayment).ToString(), lang),
                            UserId = e.ApproverId ?? string.Empty,
                            UserRole = "Customer",
                            ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now,
                            Prompt = PendingPaymentPrompt
                        });
                        break;
                    case TimelineNodeTypes.Paid:
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = isArabic ? "مدفوع" : "Paid",
                            UserId = e.ApproverId ?? string.Empty,
                            UserRole = "Customer",
                            ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now,
                            Prompt = PaidPrompt
                        });
                        break;
                    case TimelineNodeTypes.AIReview:
                        // Content AI content review (handler = Automated System). ApprovalResult
                        // carries the recommendation, e.g. "Recommendation to Approve Application.".
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = isArabic ? "مراجعة الذكاء الاصطناعي" : "AI Review",
                            UserId = string.Empty,
                            UserName = string.Equals(e.ApproverName, SelfMonitorSystemRole.DisplayName, StringComparison.OrdinalIgnoreCase)
                                ? SelfMonitorSystemRole.DisplayName
                                : (isArabic ? "نظام آلي" : "Automated System"),
                            UserRole = "Automated System",
                            ApprovalResult = e.ApprovalResult,
                            ApprovalComment = e.ApprovalComment,
                            ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now
                        });
                        break;
                    case TimelineNodeTypes.AutoApproved:
                        // Service 204 Self-Monitor approvals use the virtual member identifier
                        // returned by the team-member filter. Green/system approvals remain auto.
                        var isSelfMonitorRoleApproval = string.Equals(
                                serviceCode,
                                "204",
                                StringComparison.OrdinalIgnoreCase)
                            && string.Equals(
                                e.ApproverId,
                                SelfMonitorSystemRole.MemberFilterId,
                                StringComparison.OrdinalIgnoreCase);
                        rows.Add(new ApplicationTimeLineResponse
                        {
                        Title = isArabic ? "موافقة تلقائية" : "Auto Approved",
                        // Always carry the persisted approver identity ("auto" for green/system
                        // approvals, "self-monitor" for the Self-Monitor role) so the timeline
                        // UserId reflects the stored ApproverId instead of being blanked out.
                        UserId = e.ApproverId ?? string.Empty,
                        UserName = isSelfMonitorRoleApproval
                        ? SelfMonitorSystemRole.DisplayName
                        : "Auto",
                        UserRole = isSelfMonitorRoleApproval ? SelfMonitorSystemRole.DisplayName : "Auto",
                        ApprovalResult = e.ApprovalResult,
                        ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now,
                        Prompt = string.Equals(e.ApprovalResult, "Rejected", StringComparison.OrdinalIgnoreCase)
                        ? null
                        : (isArabic ? "تمت الموافقة على الطلب تلقائياً." : "The application was automatically approved.")
                        });
                        break;
                    case TimelineNodeTypes.Cancelled:
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = await _typeDictionaryService.GetLocalizedNameAsync(
                                "ApplicationStatuses", ((int)ApplicationStatus.Cancelled).ToString(), lang),
                            UserId = e.ApproverId ?? string.Empty,
                            UserRole = "Customer",
                            ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now,
                            Prompt = CancelledPrompt
                        });
                        break;
                    case TimelineNodeTypes.PendingDisposition:
                        // PRD 302: Pending Disposition is a status only, not a timeline node.
                        // The next visible node is Disposition Submitted (customer upload).
                        break;
                    case TimelineNodeTypes.Recall:
                        // Req 147: the Recall reason is visible only in the Admin timeline.
                        // It is deliberately not copied to CustomerPortal or notification data.
                        // Early Req 147 builds reused the restored TaskId and then overwrote this
                        // row with the later approval action. When that legacy shape is detected,
                        // rebuild the immutable Recall card from ApprovalRecalls; SplitTimelineRecords
                        // simultaneously exposes the overwritten action as a normal review step.
                        var isLegacyOverwrittenRecall = IsLegacyOverwrittenRecallRecord(e);
                        recallsById.TryGetValue(e.SourceRecallId ?? 0, out var durableRecall);
                        var recallComment = e.ApprovalComment;
                        if ((isLegacyOverwrittenRecall || string.IsNullOrWhiteSpace(recallComment))
                            && !string.IsNullOrWhiteSpace(durableRecall?.Reason))
                        {
                            recallComment = durableRecall.Reason;
                        }
                        var recallDepartmentName = departmentName;
                        if (string.IsNullOrWhiteSpace(recallDepartmentName))
                        {
                            recallDepartmentNamesByApplicationId.TryGetValue(
                                e.ApplicationId,
                                out recallDepartmentName);
                        }
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = isArabic ? "تم الاستدعاء" : "Recalled",
                            UserId = isLegacyOverwrittenRecall
                                ? durableRecall?.OperatorId ?? e.ApproverId ?? string.Empty
                                : e.ApproverId ?? string.Empty,
                            UserName = isLegacyOverwrittenRecall
                                ? durableRecall?.OperatorName ?? e.ApproverName
                                : e.ApproverName,
                            UserRole = recallDepartmentName,
                            ApprovalResult = isArabic ? "تم الاستدعاء" : "Recalled",
                            ApprovalComment = recallComment,
                            ApprovalTime = isLegacyOverwrittenRecall
                                ? durableRecall?.CompletedOn?.UtcDateTime ?? e.ApprovalDate ?? DateTimeHelper.Now
                                : e.ApprovalDate ?? DateTimeHelper.Now
                        });
                        break;
                    case TimelineNodeTypes.DispositionSubmitted:
                        // PRD 302: the customer upload and the admin verification are TWO distinct
                        // nodes. One DispositionSubmitted event row (+ its DispositionSubmission)
                        // yields the Disposition Submitted node always, and a Disposition
                        // Verification node once the proof has been reviewed.
                        submissionsById.TryGetValue(e.SourceSubmissionId ?? 0, out var proofSubmission);

                        // (1) Disposition Submitted — handler is the APPLICANT who uploaded the
                        // proof (submission.SubmittedBy), not the record's ApproverId (which can be
                        // the internal caller). Carries disposal method, customer note, attachments.
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = isArabic ? "تقديم إثبات التصرف" : "Disposition Submitted",
                            UserId = proofSubmission?.SubmittedBy ?? e.ApproverId ?? string.Empty,
                            UserRole = "Customer",
                            ApprovalTime = proofSubmission?.SubmittedOn ?? e.ApprovalDate ?? DateTimeHelper.Now,
                            Prompt = DispositionSubmittedPrompt,
                            CustomerComment = proofSubmission?.Notes,
                            DisposalMethod = proofSubmission?.Method,
                            Attachments = ParseAttachmentList(proofSubmission?.SupportingDocumentsJson),
                            NodeType = TimelineNodeTypes.DispositionSubmitted,
                            PromptCode = TimelineNodeTypes.DispositionSubmitted
                        });

                        // (2) Disposition Verification — only after the admin reviews the proof
                        // (WorkflowActionCode set on the record at review time).
                        if (e.WorkflowActionCode.HasValue)
                        {
                            var reviewTransition = _workflowTransitionRegistry.GetByActionCode(e.WorkflowActionCode.Value);
                            // Reject-proof reason: return the RAW code only (frontend resolves the
                            // localized text). Present only when the admin rejects (registry action 202).
                            var isProofRejected = e.WorkflowActionCode == 202;
                            rows.Add(new ApplicationTimeLineResponse
                            {
                                Title = dispositionVerificationLabel,
                                UserId = e.ApproverId ?? string.Empty,
                                UserRole = departmentName,
                                ApprovalResult = reviewTransition == null
                                    ? e.ApprovalResult
                                    : (isArabic ? reviewTransition.LabelAr : reviewTransition.LabelEn),
                                ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now,
                                ApprovalComment = e.ApprovalComment,
                                CustomerComment = proofSubmission?.Notes,
                                RejectReasonCode = isProofRejected ? e.RejectReasonCode : null,
                                ReasonFile = isProofRejected ? e.RejectReasonFile : null,
                                Attachments = isProofRejected
                                    ? BuildRejectReasonAttachments(rejectAttachmentsByRecordId, e.Id, e.RejectReasonFile)
                                    : null,
                                NodeType = TimelineNodeTypes.DispositionVerification,
                                ApprovalResultCode = e.WorkflowActionCode
                            });
                        }
                        break;
                    case TimelineNodeTypes.Completed:
                    case TimelineNodeTypes.Rejected:
                        var isCompletedNode = e.NodeType == TimelineNodeTypes.Completed;
                        rows.Add(new ApplicationTimeLineResponse
                        {
                            Title = await _typeDictionaryService.GetLocalizedNameAsync(
                                "ApplicationStatuses",
                                ((int)(isCompletedNode ? ApplicationStatus.Completed : ApplicationStatus.Rejected)).ToString(),
                                lang),
                            UserId = string.Empty,
                            ApprovalTime = e.ApprovalDate ?? DateTimeHelper.Now,
                            Prompt = isCompletedNode ? CompletedPrompt : RejectedPrompt
                        });
                        break;
                }

                // i18n keys for whatever the case above produced: NodeType keys the node
                // copy, PromptCode keys the fixed sentence (same value space as NodeType),
                // ApprovalResultCode carries the registry action code (201/202 reviews).
                for (var i = rowsBefore; i < rows.Count; i++)
                {
                    rows[i].ApprovalRecordId ??= e.Id;
                    rows[i].NodeType ??= e.NodeType;
                    if (rows[i].Prompt != null)
                    {
                        rows[i].PromptCode ??= e.NodeType;
                    }
                    rows[i].ApprovalResultCode ??= e.WorkflowActionCode;
                }
            }

            return rows;
        }

        // Prefer the runtime task department while retaining the service department for legacy data.
        internal static string? ResolveTimelineDepartmentName(
            string? taskId,
            IReadOnlyDictionary<string, string> taskDepartmentNames,
            string? fallbackDepartmentName)
        {
            if (!string.IsNullOrWhiteSpace(taskId)
                && taskDepartmentNames.TryGetValue(taskId, out var taskDepartmentName)
                && !string.IsNullOrWhiteSpace(taskDepartmentName))
            {
                return taskDepartmentName;
            }

            return fallbackDepartmentName;
        }

        // Keep the read-side classification in one testable place. Req 147 Recall is an event
        // row (not a normal approval action), so it must flow to MapTimelineEventRowsAsync even
        // though its TaskId belongs to the newly restored final-node process instance.
        internal static (List<ApprovalRecord> ActionRecords, List<ApprovalRecord> EventRecords)
            SplitTimelineRecords(IEnumerable<ApprovalRecord> approvalRecords)
        {
            var records = approvalRecords.ToList();
            var actionRecords = records.Where(a => a.ApprovalDate != null &&
                (a.ExternalOrganizationId != null
                    ? a.ApprovalResult != null
                    : a.NodeType == TimelineNodeTypes.Review
                      || a.NodeType == TimelineNodeTypes.SendBack
                      || IsLegacyOverwrittenRecallRecord(a))).ToList();
            var eventRecords = records.Where(a =>
                a.NodeType != null
                && a.NodeType != TimelineNodeTypes.Review
                && a.NodeType != TimelineNodeTypes.SendBack
                && a.ExternalOrganizationId == null).ToList();

            return (actionRecords, eventRecords);
        }

        // Compatibility for records produced before the Recall TaskId collision was fixed.
        // A genuine Recall event has Recall/Recall action data. If the same row now carries a
        // later approval decision, UpsertApprovalRecordByTaskIdAsync overwrote its action fields.
        // Keep treating it as the durable Recall event and also render those action fields as the
        // restored final node's review step. New writes create two physical rows and never match.
        internal static bool IsLegacyOverwrittenRecallRecord(ApprovalRecord record)
        {
            return record.SourceRecallId.HasValue
                   && string.Equals(record.NodeType, TimelineNodeTypes.Recall, StringComparison.Ordinal)
                   && (!string.Equals(record.ApprovalAction, TimelineNodeTypes.Recall, StringComparison.Ordinal)
                       || !string.Equals(record.ApprovalResult, TimelineNodeTypes.Recall, StringComparison.Ordinal));
        }

        internal static List<ApprovalRecord> FilterTimelineEventsForDepartment(
            IEnumerable<ApprovalRecord> eventRecords,
            string departmentId)
        {
            // Pending Modification and Pending Disposition are workflow/application statuses,
            // not separate timeline lifecycle events. Their real user actions are already shown
            // by the Request Modification review row and Disposition Submitted event. Preserve
            // any persisted status rows for audit, but do not expose them in the timeline.
            var records = eventRecords
                .Where(a => a.NodeType != TimelineNodeTypes.PendingModification
                            && a.NodeType != TimelineNodeTypes.PendingDisposition)
                .ToList();
            if (departmentId != ((int)DepartmentEnum.Licensing).ToString())
            {
                return records;
            }

            // For Licensing, Pending Payment is only an application status and does not prove that
            // money was received. Preserve historical records for audit, while exposing only the
            // Paid/Completed events written by CustomerPortal after successful payment.
            return records
                .Where(a => a.NodeType != TimelineNodeTypes.PendingPayment)
                .ToList();
        }

        internal static List<ApprovalRecord> CollapseDuplicateSingletonTimelineEvents(
            IEnumerable<ApprovalRecord> eventRecords)
        {
            // Paid and Completed are single lifecycle facts for one application. Callback retries
            // can race past the write-side existence check, so keep the earliest persisted row.
            // Auto approval persists one audit row per workflow task, but represents one decision
            // in the timeline. Keep the final task row per process instance while retaining all
            // task-level records in the database for workflow audit.
            // Submitted is deliberately NOT a singleton: every customer re-submission after a
            // Request Modification is a real timeline event and must remain visible.
            var records = eventRecords.ToList();
            var finalAutoApprovalIds = records
                .Where(a => a.NodeType == TimelineNodeTypes.AutoApproved
                            && !string.IsNullOrWhiteSpace(a.ProcessInstanceId))
                .GroupBy(a => a.ProcessInstanceId!, StringComparer.OrdinalIgnoreCase)
                .Select(g => g
                    .OrderByDescending(a => a.ApprovalDate ?? a.CreatedOn)
                    .ThenByDescending(a => a.Id)
                    .First().Id)
                .ToHashSet();

            var singletonEventNodeTypes = new HashSet<string>
            {
                TimelineNodeTypes.Paid,
                TimelineNodeTypes.Completed,
            };

            return records
                .Where(a => a.NodeType != TimelineNodeTypes.AutoApproved
                            || string.IsNullOrWhiteSpace(a.ProcessInstanceId)
                            || finalAutoApprovalIds.Contains(a.Id))
                .GroupBy(a => singletonEventNodeTypes.Contains(a.NodeType!)
                    ? a.NodeType!
                    : $"__keep_{a.Id}")
                .Select(g => g
                    .OrderBy(a => a.ApprovalDate ?? a.CreatedOn)
                    .ThenBy(a => a.Id)
                    .First())
                .ToList();
        }

        // TaskDefinitionKey -> localized node display name for the service's LATEST workflow
        // configuration (same latest-config strategy as WorkflowActionResolver.GetTaskActionsAsync).
        private async Task<Dictionary<string, string>> GetWorkflowNodeNamesAsync(short serviceId)
        {
            var workflowConfigId = await _db.WorkflowConfigurations
                .AsNoTracking()
                .Where(x => x.ServiceId == serviceId)
                .OrderByDescending(x => x.Id)
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync();
            if (!workflowConfigId.HasValue)
            {
                return new Dictionary<string, string>();
            }

            var nodes = await _db.WorkflowNodes
                .AsNoTracking()
                .Where(x => x.WorkflowConfigurationId == workflowConfigId.Value)
                .Select(x => new { x.NodeId, x.NodeNameEn, x.NodeNameAr })
                .ToListAsync();
            return nodes
                .GroupBy(x => x.NodeId)
                .ToDictionary(
                    g => g.Key,
                    g => isArabic && !string.IsNullOrWhiteSpace(g.First().NodeNameAr)
                        ? g.First().NodeNameAr!
                        : g.First().NodeNameEn);
        }

        // Write-side timeline: Licensing exposes payment lifecycle events only after successful
        // payment, while other departments retain their existing Pending Payment event behavior.
        private async Task WriteTerminalTimelineEventIfTerminalAsync(
            TaskActionDto req,
            string departmentId,
            CancellationToken cancellationToken)
        {
            var statusId = await _db.ApplicationDetails
                .AsNoTracking()
                .Where(d => d.ApplicationId == req.ApplicationId)
                .Select(d => (short?)d.ApplicationStatusId)
                .FirstOrDefaultAsync(cancellationToken);
            var nodeType = ResolveTerminalTimelineNodeType(statusId, departmentId);
            if (nodeType == null)
            {
                return;
            }

            // Pending Payment remains supported for non-Licensing departments. Completed /
            // Rejected are staff-driven terminal nodes, so the acting reviewer is their handler.
            string? handlerUserId;
            if (nodeType == TimelineNodeTypes.PendingPayment)
            {
                handlerUserId = await _db.Applications
                    .AsNoTracking()
                    .Where(a => a.Id == req.ApplicationId)
                    .Select(a => a.UserId)
                    .FirstOrDefaultAsync(cancellationToken);
            }
            else
            {
                handlerUserId = _currentUserService.UserId;
            }

            if (string.IsNullOrEmpty(handlerUserId))
            {
                // ApproverId is NOT NULL — never let a missing handler id fail the whole approval
                // transaction. Skipping the synthetic timeline node degrades gracefully.
                _logger.LogWarning(
                    "Skipping terminal timeline event for ApplicationId {ApplicationId} ({NodeType}): no handler user id resolved.",
                    req.ApplicationId,
                    nodeType);
                return;
            }

            _db.ApprovalRecords.Add(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                NodeType = nodeType,
                ApprovalAction = nodeType,
                ApproverId = handlerUserId,
                ApprovalDate = DateTimeHelper.Now
            });
            await _db.SaveChangesAsync(cancellationToken);
        }

        internal static string? ResolveTerminalTimelineNodeType(short? statusId, string departmentId) => statusId switch
        {
            (short)ApplicationStatus.Completed => TimelineNodeTypes.Completed,
            (short)ApplicationStatus.Rejected => TimelineNodeTypes.Rejected,
            (short)ApplicationStatus.PendingPayment
                when departmentId != ((int)DepartmentEnum.Licensing).ToString()
                    => TimelineNodeTypes.PendingPayment,
            _ => null
        };

        // Timeline requirement (§Completed / §Rejected): synthesize the terminal node.
        // The ApplicationDetails row flips to 105/106 the moment the final review action
        // fires, but while a disposition case is still open the timeline must keep showing
        // Pending Disposition / Disposition Verification — the terminal node only appears
        // once the case settles (Verified / NotVerified) or when no case exists at all.
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task AppendTerminalTimelineNodeAsync(
            MyReviewPageResponse detail,
            DispositionCase? dispositionCase,
            List<ApprovalRecord> approvalRecords,
            List<ApplicationTimeLineResponse> applicationTimeLine)
        {
            var applicationStatusId = await _db.ApplicationDetails
                .AsNoTracking()
                .Where(d => d.Id == detail.ApplicationDetailId)
                .Select(d => (short?)d.ApplicationStatusId)
                .FirstOrDefaultAsync();
            var isCompleted = applicationStatusId == (short)ApplicationStatus.Completed;
            var isRejected = applicationStatusId == (short)ApplicationStatus.Rejected;
            var isCancelled = applicationStatusId == (short)ApplicationStatus.Cancelled;
            if (!isCompleted && !isRejected && !isCancelled)
            {
                return;
            }

            if (dispositionCase != null &&
                (dispositionCase.FinalDispositionStatusId == (int)DispositionVerificationStatus.PendingDisposition ||
                 dispositionCase.FinalDispositionStatusId == (int)DispositionVerificationStatus.DispositionVerification))
            {
                return;
            }

            // Settled disposition: the case's settle moment is the status-change time.
            // Otherwise fall back to the BPMN end time, then the last approval action.
            DateTime? terminalTime = null;
            if (dispositionCase != null)
            {
                terminalTime = dispositionCase.VerifiedAt ?? dispositionCase.ExpiredAt ?? dispositionCase.UpdatedOn;
            }
            terminalTime ??= await _db.CamundaProcessInstances
                .AsNoTracking()
                .Where(p => p.ProcessInstanceId == detail.ProcessInstanceId)
                .Select(p => p.EndTime)
                .FirstOrDefaultAsync();
            terminalTime ??= approvalRecords.Count > 0
                ? approvalRecords.Max(a => a.ApprovalDate)
                : detail.SubmissionTime;

            var terminalStatus = isCompleted
                ? ApplicationStatus.Completed
                : isRejected ? ApplicationStatus.Rejected : ApplicationStatus.Cancelled;
            var title = await _typeDictionaryService.GetLocalizedNameAsync(
                "ApplicationStatuses",
                ((int)terminalStatus).ToString(),
                isArabic ? "ar" : "en");

            // TODO(inspection-on-expiry): when the 14-day expiry starts auto-creating an
            // Inspection task, expired (NotVerified via ExpiredAt) cases must switch to the
            // "... an inspection task has been automatically created." prompt and carry the
            // clickable Task No. — deferred this iteration (the expiration job only marks
            // NotVerified; no task is created).
            var terminalPrompt = isCompleted ? CompletedPrompt : isRejected ? RejectedPrompt : CancelledPrompt;
            var terminalNodeType = isCompleted
                ? TimelineNodeTypes.Completed
                : isRejected ? TimelineNodeTypes.Rejected : TimelineNodeTypes.Cancelled;
            applicationTimeLine.Add(new ApplicationTimeLineResponse
            {
                Title = title,
                UserId = string.Empty,
                ApprovalTime = terminalTime.Value,
                Prompt = terminalPrompt,
                NodeType = terminalNodeType,
                PromptCode = terminalNodeType
            });
        }

        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task AppendDispositionTimelineAsync(int applicationId, List<ApplicationTimeLineResponse> applicationTimeLine, string? departmentName)
        {
            var dispositionCases = await _db.DispositionCases
                .Where(a => a.ApplicationId == applicationId)
                .OrderBy(a => a.CreatedOn)
                .ToListAsync();

            if (dispositionCases.Count == 0)
            {
                return;
            }

            var caseIds = dispositionCases.Select(a => a.Id).ToArray();
            var submissions = await _db.DispositionSubmissions
                .Where(a => caseIds.Contains(a.DispositionCaseId))
                .OrderBy(a => a.SubmittedOn)
                .ToListAsync();

            // PRD 302: Pending Disposition is a status, not a timeline node — only the
            // Disposition Verification (per-submission) nodes are synthesized here.
            var dispositionVerificationLabel = await _typeDictionaryService.GetLocalizedNameAsync(
                "ApplicationStatuses", ((int)ApplicationStatus.DispositionVerification).ToString(), (isArabic ? "ar" : "en"));

            foreach (var dispositionCase in dispositionCases)
            {
                var caseSubmissions = submissions
                    .Where(a => a.DispositionCaseId == dispositionCase.Id)
                    .OrderBy(a => a.SubmittedOn)
                    .ToList();
                foreach (var submission in caseSubmissions)
                {
                    var attachments = ParseAttachmentList(submission.SupportingDocumentsJson);
                    var isReviewed = submission.ReviewedOn.HasValue && submission.ReviewWorkflowActionCode.HasValue;
                    // Review action 201 = Approve, 202 = Reject (registry).
                    var reviewTransition = isReviewed
                        ? _workflowTransitionRegistry.GetByActionCode(submission.ReviewWorkflowActionCode!.Value)
                        : null;
                    var isApproved = reviewTransition?.Type == WorkflowActionType.Approve;

                    // (1) Disposition Submitted — the applicant's upload (always).
                    applicationTimeLine.Add(new ApplicationTimeLineResponse
                    {
                        Title = isArabic ? "تقديم إثبات التصرف" : "Disposition Submitted",
                        UserId = submission.SubmittedBy ?? string.Empty,
                        UserRole = "Customer",
                        ApprovalTime = submission.SubmittedOn,
                        Prompt = DispositionSubmittedPrompt,
                        CustomerComment = submission.Notes,
                        DisposalMethod = submission.Method,
                        Attachments = attachments,
                        NodeType = TimelineNodeTypes.DispositionSubmitted,
                        PromptCode = TimelineNodeTypes.DispositionSubmitted
                    });

                    // (2) Disposition Verification — only once the admin has reviewed the proof.
                    if (isReviewed)
                    {
                        applicationTimeLine.Add(new ApplicationTimeLineResponse
                        {
                            Title = dispositionVerificationLabel,
                            UserId = submission.ReviewedBy ?? dispositionCase.CreatedBy ?? string.Empty,
                            UserRole = departmentName,
                            ApprovalResult = reviewTransition == null
                                ? null
                                : (isArabic ? reviewTransition.LabelAr : reviewTransition.LabelEn),
                            ApprovalTime = submission.ReviewedOn!.Value,
                            NodeType = TimelineNodeTypes.DispositionVerification,
                            ApprovalResultCode = submission.ReviewWorkflowActionCode,
                            // Reviewer's reject reason (when present) sits in ApprovalComment;
                            // customer's original note stays in CustomerComment for side-by-side.
                            ApprovalComment = !isApproved ? submission.ReviewerComment : null,
                            CustomerComment = submission.Notes
                        });
                    }
                }
            }
        }

        private static List<TimelineAttachmentDto>? ParseAttachmentList(string? json)
        {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }
        try
        {
            // The persisted JSON is a plain array of opaque storage keys (e.g.
            // ["48d0efe7....pdf"]). Wrap each into a {fileName, key} attachment; the
            // human-facing fileName (Common.StoredFiles.DownloadFileName) is resolved
            // later in one pass once the full timeline is assembled.
            var list = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
            if (list == null || list.Count == 0)
            {
            return null;
            }
            var result = list
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Select(key => new TimelineAttachmentDto { Key = key })
            .ToList();
            return result.Count > 0 ? result : null;
        }
        catch (System.Text.Json.JsonException)
        {
            // Malformed legacy rows — treat as no attachments rather than failing the
            // whole timeline build. The data is decorative; the spec doesn't require it.
            return null;
        }
        }

        private static List<TimelineAttachmentDto>? AppendAttachment(List<TimelineAttachmentDto>? attachments, string? key)
        {
        if (string.IsNullOrWhiteSpace(key))
        {
            return attachments;
        }
        var result = attachments == null
            ? new List<TimelineAttachmentDto>()
            : new List<TimelineAttachmentDto>(attachments);
        result.Add(new TimelineAttachmentDto { Key = key });
        return result;
        }

        private async Task<Dictionary<int, IReadOnlyList<TimelineAttachmentDto>>> LoadApprovalRecordAttachmentMapAsync(
            IEnumerable<int> approvalRecordIds,
            CancellationToken cancellationToken)
        {
            var ids = approvalRecordIds
                .Where(id => id > 0)
                .Distinct()
                .ToArray();
            if (ids.Length == 0)
            {
                return new Dictionary<int, IReadOnlyList<TimelineAttachmentDto>>();
            }

            // The additive table keeps the complete ordered reject-file list while the legacy
            // ApprovalRecords.RejectReasonFile column remains the single-file fallback. This read
            // is scoped to the already-loaded timeline rows to avoid touching unrelated workflow
            // data or changing existing query ownership.
            var rows = await _db.ApprovalRecordAttachments
                .AsNoTracking()
                .Where(attachment => ids.Contains(attachment.ApprovalRecordId))
                .OrderBy(attachment => attachment.ApprovalRecordId)
                .ThenBy(attachment => attachment.SortOrder)
                .ToListAsync(cancellationToken);

            return rows
                .GroupBy(attachment => attachment.ApprovalRecordId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyList<TimelineAttachmentDto>)group
                        .Where(attachment => !string.IsNullOrWhiteSpace(attachment.FileKey))
                        .Select(attachment => new TimelineAttachmentDto { Key = attachment.FileKey })
                        .ToList());
        }

        internal static List<TimelineAttachmentDto>? BuildRejectReasonAttachments(
            IReadOnlyDictionary<int, IReadOnlyList<TimelineAttachmentDto>>? attachmentsByRecordId,
            int approvalRecordId,
            string? legacyRejectReasonFile)
        {
            if (attachmentsByRecordId != null
                && attachmentsByRecordId.TryGetValue(approvalRecordId, out var persistedAttachments)
                && persistedAttachments.Count > 0)
            {
                return persistedAttachments
                    .Where(attachment => !string.IsNullOrWhiteSpace(attachment.Key))
                    .Select(attachment => new TimelineAttachmentDto
                    {
                        FileName = attachment.FileName,
                        Key = attachment.Key
                    })
                    .ToList();
            }

            if (string.IsNullOrWhiteSpace(legacyRejectReasonFile))
            {
                return null;
            }

            // Legacy timeline rows have only ApprovalRecords.RejectReasonFile. Expose it through
            // the new Attachments shape so old applications keep rendering without asking the
            // frontend to special-case ReasonFile.
            return new List<TimelineAttachmentDto>
            {
                new() { Key = legacyRejectReasonFile.Trim() }
            };
        }

        internal static List<TimelineAttachmentDto>? MergeTimelineAttachments(
            List<TimelineAttachmentDto>? first,
            List<TimelineAttachmentDto>? second)
        {
            var result = new List<TimelineAttachmentDto>();
            AddTimelineAttachments(result, first);
            AddTimelineAttachments(result, second);
            return result.Count > 0 ? result : null;
        }

        private static void AddTimelineAttachments(
            List<TimelineAttachmentDto> target,
            IEnumerable<TimelineAttachmentDto>? source)
        {
            if (source == null)
            {
                return;
            }

            foreach (var attachment in source)
            {
                if (string.IsNullOrWhiteSpace(attachment.Key)
                    || target.Any(existing => string.Equals(existing.Key, attachment.Key, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                target.Add(new TimelineAttachmentDto
                {
                    FileName = attachment.FileName,
                    Key = attachment.Key
                });
            }
        }

        // Fills each attachment's human-facing FileName from Common.StoredFiles.DownloadFileName,
        // resolved by the opaque storage Key through FileStorageService. Each distinct key is
        // looked up once. FileName stays null when the key has no ledger row or the service is
        // unreachable — the frontend still has the Key to download the file, so a lookup failure
        // must never break the whole detail response.
        private async Task ResolveAttachmentFileNamesAsync(IEnumerable<ApplicationTimeLineResponse> timeline)
        {
        var attachments = timeline
            .Where(n => n.Attachments != null)
            .SelectMany(n => n.Attachments!)
            .Where(a => a != null && !string.IsNullOrWhiteSpace(a.Key))
            .ToList();
        if (attachments.Count == 0)
        {
            return;
        }

        var fileNamesByKey = new Dictionary<string, string?>();
        foreach (var key in attachments.Select(a => a.Key).Distinct())
        {
            try
            {
            var metadata = await _fileStorageClient.GetByKeyAsync(key);
            fileNamesByKey[key] = metadata?.DownloadFileName;
            }
            catch (Exception ex)
            {
            _logger.LogWarning(ex, "Failed to resolve DownloadFileName for attachment key {Key}.", key);
            fileNamesByKey[key] = null;
            }
        }

        foreach (var attachment in attachments)
        {
            if (fileNamesByKey.TryGetValue(attachment.Key, out var fileName))
            {
            attachment.FileName = fileName;
            }
        }
        }

        public async Task<WorkflowActionExecuteResponse> ApproveV2Async(TaskActionDto req, string departmentId, CancellationToken cancellationToken = default)
        {
            // 302 disposition review. After the first approval the Camunda process has already
            // ended, so the disposition row carries a synthetic "disposition-{caseId}" taskId with
            // no Camunda task — ResolveAsync would throw "Task not found". Keep the frontend entry
            // on ApproveV2 but branch here to the disposition review service (same behavior as
            // POST /api/disposition-cases/{caseId}/review): Approve settles the case (row moves to
            // Completed), Reject re-opens Pending Disposition for the applicant to resubmit. Runs
            // outside the workflow transaction because ReviewAsync owns its own persistence.
            if (TryParseDispositionCaseId(req.TaskId, out var dispositionCaseId))
            {
                return await ExecuteDispositionReviewAsync(req, dispositionCaseId, cancellationToken);
            }

            // EnableRetryOnFailure requires every user transaction to run through the DbContext's
            // execution strategy. Keep the existing approval transaction intact and scope the
            // deferred actions to the successful attempt so a retried/rolled-back attempt cannot
            // leak post-commit notifications or certificate work.
            WorkflowActionExecuteResponse? response = null;
            WorkflowTransition? committedDescriptor = null;
            DeferredPostCommitActions? committedDeferred = null;
            var executionStrategy = _db.Database.CreateExecutionStrategy();

            await executionStrategy.ExecuteAsync(async () =>
            {
                // Captured during this tx attempt; drained only after this attempt commits.
                var deferred = new DeferredPostCommitActions();

                await _unitOfWork.BeginTransactionAsync();
                try
                {
                    if (!int.TryParse(departmentId, out var expectedApprovalDepartment))
                    {
                        throw new BusinessException("Workflow.TaskContextMismatch", "");
                    }

                    await WorkflowTaskAuthorization.EnsureCurrentAssigneeCanActAsync(
                        _db,
                        req,
                        _currentUserService.UserId,
                        cancellationToken,
                        expectedApprovalDepartment);

                    // Runtime task authorization is the access boundary for cross-department
                    // workflows. The service owner is static metadata and may differ from the
                    // department that owns the current task.
                    var application = await _applicationService.GetByIdAsync(req.ApplicationId, null);
                    if (application == null)
                        throw new BusinessException("Application data not found");
                    if (application.ServiceId != req.ServiceId)
                        throw new BusinessException("Workflow.TaskContextMismatch", "");

                    var descriptor = await _workflowActionResolver.ResolveAsync(req, cancellationToken);
                    await EnsureWorkflowActionPermissionAsync(req.TaskId, descriptor, cancellationToken);
                    req.WorkflowAction = descriptor.ActionCode;
                    req.WorkflowActionLabel = (isArabic ? descriptor.LabelAr : descriptor.LabelEn);
                    req.ApprovalAction = descriptor.LegacyApprovalAction;

                    // The row-level requirement applies only to decisions that approve or reject the
                    // application. Request Modification, Send Back, and other intermediate actions
                    // must remain available even when the reviewer has not completed MG assignments.
                    if (descriptor.Type is WorkflowActionType.Approve
                        or WorkflowActionType.ApproveWithSupervisorReport
                        or WorkflowActionType.Reject
                        or WorkflowActionType.RejectWithSupervisorReport
                        or WorkflowActionType.RejectRouteNext)
                    {
                        await _applicationMaterialStatusService.EnsureAllStatusesAssignedAsync(
                            req.ApplicationId,
                            req.ApplicationDetailId,
                            cancellationToken);
                    }

                    // Dispatch by the five action types every node button must map to.
                    // Variant-specific side effects (disposition / supervisor report / content report)
                    // live inside each handler so the dispatch table stays flat.
                    var attemptResponse = await ExecuteTransitionAsync(
                        req,
                        descriptor,
                        departmentId,
                        deferred,
                        cancellationToken);

                    await _unitOfWork.CommitAsync();
                    response = attemptResponse;
                    committedDescriptor = descriptor;
                    committedDeferred = deferred;
                }
                catch
                {
                    await _unitOfWork.RollbackAsync();
                    throw;
                }
            });

            await RunDeferredPostCommitActionsAsync(committedDeferred!);
            LogWorkflowApprovalDecision(req, committedDescriptor!, response!, "WorkflowReview");
            return response!;
        }

        private async Task EnsureWorkflowActionPermissionAsync(
            string taskId,
            WorkflowTransition transition,
            CancellationToken cancellationToken)
        {
            if (transition.Type is not (WorkflowActionType.RequestModification or WorkflowActionType.ExternalApproval or WorkflowActionType.SendBack))
            {
                return;
            }

            if (_permissionService == null)
            {
                throw new BusinessException("Workflow.TaskModulePermissionDenied", "");
            }

            var task = await _db.CamundaTasks
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.TaskId == taskId, cancellationToken);
            if (task == null)
            {
                throw new BusinessException("Workflow.TaskNotFound", "");
            }

            var (licensingPermissionCode, contentPermissionCode) = transition.Type switch
            {
                WorkflowActionType.RequestModification =>
                    (AccountPermissionCodes.Workflow.MyTodo.RequestModification, AccountPermissionCodes.Content.MyReview.RequestModification),
                WorkflowActionType.ExternalApproval =>
                    (AccountPermissionCodes.Workflow.MyTodo.ExternalApproval, AccountPermissionCodes.Content.MyReview.ExternalApproval),
                WorkflowActionType.SendBack =>
                    (AccountPermissionCodes.Workflow.MyTodo.SendBack, AccountPermissionCodes.Content.MyReview.SendBack),
                _ => throw new BusinessException("Workflow.TaskModulePermissionDenied", "")
            };

            await WorkflowTaskAuthorization.EnsureTaskModulePermissionAsync(
                _permissionService,
                task,
                licensingPermissionCode,
                contentPermissionCode,
                cancellationToken);
        }

        private void LogWorkflowApprovalDecision(
            TaskActionDto req,
            WorkflowTransition transition,
            WorkflowActionExecuteResponse response,
            string decisionSource,
            int? dispositionCaseId = null)
        {
            if (!response.Success)
            {
                return;
            }

            _auditLogger?.LogChange(
                "WorkflowApprovalDecision",
                null,
                new
                {
                    decisionSource,
                    applicationId = req.ApplicationId,
                    applicationDetailId = req.ApplicationDetailId,
                    serviceId = req.ServiceId,
                    instanceId = req.InstanceId,
                    taskId = req.TaskId,
                    dispositionCaseId,
                    workflowAction = transition.ActionCode,
                    workflowActionType = transition.Type.ToString(),
                    workflowActionLabel = req.WorkflowActionLabel ?? response.WorkflowActionLabel ?? transition.LabelEn,
                    approvalAction = req.ApprovalAction ?? transition.LegacyApprovalAction,
                    approvalResult = response.ApprovalResult,
                    adminStatus = response.AdminStatus,
                    customerStatus = response.CustomerStatus,
                    customerSubStatus = response.CustomerSubStatus,
                    applicationStatus = response.ApplicationStatus,
                    requiresCustomerAction = response.RequiresCustomerAction,
                    customerAction = response.CustomerAction,
                    rejectReasonCode = req.RejectReasonCode,
                    hideFromCustomer = req.HideFromCustomer,
                    hasApprovalComment = !string.IsNullOrWhiteSpace(req.ApprovalComment),
                    hasActionPayload = req.GetActionPayloadElement().HasValue
                });
        }

        // A disposition review row carries a synthetic "disposition-{caseId}" taskId (no Camunda task).
        private static bool TryParseDispositionCaseId(string? taskId, out int caseId)
        {
            caseId = 0;
            const string prefix = "disposition-";
            if (string.IsNullOrEmpty(taskId) ||
                !taskId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return int.TryParse(taskId.AsSpan(prefix.Length), out caseId);
        }

        // Routes an ApproveV2 disposition row to the disposition review service. The node's
        // approve/reject button is classified via the registry (no Camunda task needed) and mapped
        // to the disposition review action codes (Approve -> 201, Reject -> 202).
        private async Task<WorkflowActionExecuteResponse> ExecuteDispositionReviewAsync(
            TaskActionDto req,
            int dispositionCaseId,
            CancellationToken cancellationToken)
        {
            var dispositionCase = await _db.DispositionCases
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == dispositionCaseId, cancellationToken);
            if (dispositionCase == null
                || dispositionCase.ApplicationId != req.ApplicationId
                || dispositionCase.ApplicationDetailId != req.ApplicationDetailId
                || !string.Equals(dispositionCase.ProcessInstanceId, req.InstanceId, StringComparison.OrdinalIgnoreCase))
            {
                throw new BusinessException("Workflow.TaskContextMismatch", "");
            }

            var currentUserId = _currentUserService.UserId;
            var canReviewDisposition = !string.IsNullOrWhiteSpace(currentUserId)
                && await _db.AdminUsers.AsNoTracking().AnyAsync(
                    user => user.Id == currentUserId && user.IsActive && user.Status != "-1",
                    cancellationToken)
                && await _db.UserDepartments.AsNoTracking().AnyAsync(
                    department => department.UserId == currentUserId
                                  && (department.DepartmentId == (int)DepartmentEnum.Licensing
                                      || department.DepartmentId == (int)DepartmentEnum.Content),
                    cancellationToken);
            if (!canReviewDisposition)
            {
                throw new BusinessException("Workflow.TaskAssigneeNotEligible", "");
            }

            await _applicationMaterialStatusService.EnsureAllStatusesAssignedAsync(
                req.ApplicationId,
                req.ApplicationDetailId,
                cancellationToken);

            if (!req.WorkflowAction.HasValue)
            {
                throw new BusinessException("WorkflowAction is required");
            }

            var transition = _workflowTransitionRegistry.GetByActionCode(req.WorkflowAction.Value);
            var reviewAction = transition.Type switch
            {
                WorkflowActionType.Approve => 201,
                WorkflowActionType.Reject => 202,
                _ => throw new BusinessException(
                    string.Format(_localizer["Unsupported workflow transition: {0}"], req.WorkflowAction.Value))
            };

            var reviewResponse = await _dispositionCaseAppService.ReviewAsync(
                dispositionCaseId,
                new DispositionReviewRequest
                {
                    WorkflowAction = reviewAction,
                    ReviewerComment = req.ApprovalComment
                },
                cancellationToken);

            var response = new WorkflowActionExecuteResponse
            {
                Success = reviewResponse.Success,
                WorkflowAction = reviewResponse.WorkflowAction,
                WorkflowActionLabel = isArabic ? transition.LabelAr : transition.LabelEn,
                ApprovalResult = reviewResponse.ApprovalResult,
                AdminStatus = reviewResponse.AdminStatus,
                CustomerStatus = reviewResponse.CustomerStatus,
                CustomerSubStatus = reviewResponse.CustomerSubStatus,
                ApplicationStatus = reviewResponse.ApplicationStatus,
                RequiresCustomerAction = reviewResponse.RequiresCustomerAction,
                CustomerAction = reviewResponse.CustomerAction
            };

            LogWorkflowApprovalDecision(req, transition, response, "DispositionReview", dispositionCaseId);
            return response;
        }

        private Task<WorkflowActionExecuteResponse> ExecuteTransitionAsync(
            TaskActionDto req,
            WorkflowTransition descriptor,
            string departmentId,
            DeferredPostCommitActions deferred,
            CancellationToken cancellationToken)
        {
            return descriptor.Type switch
            {
                WorkflowActionType.Approve or
                WorkflowActionType.Reject or
                WorkflowActionType.RequestModification =>
                    ExecuteReviewTransitionAsync(req, descriptor, departmentId, deferred, cancellationToken),
                WorkflowActionType.ExternalApproval =>
                    HandleExternalApprovalActionAsync(req, descriptor, departmentId, deferred, cancellationToken),
                WorkflowActionType.SendBack =>
                    HandleSendBackActionAsync(req, descriptor, departmentId, deferred, cancellationToken),
                _ => throw new BusinessException(string.Format(_localizer["Unsupported workflow transition: {0}"], descriptor.ActionCode))
            };
        }

        private async Task<WorkflowActionExecuteResponse> ExecuteReviewTransitionAsync(
            TaskActionDto req,
            WorkflowTransition descriptor,
            string departmentId,
            DeferredPostCommitActions deferred,
            CancellationToken cancellationToken)
        {
            var automaticFahrResponse = await TryHandleAutomaticFahrFirstApprovalAsync(
                req,
                descriptor,
                deferred,
                cancellationToken);
            if (automaticFahrResponse != null)
            {
                return automaticFahrResponse;
            }
            // Enforce the supervisor-report required fields server-side BEFORE advancing the
            // workflow, so a direct API call cannot bypass the frontend validation and produce a
            // certificate missing regulatory elements (e.g. SupervisorReports.AgeClassificationId = NULL).
            await ValidateSupervisorReportPayloadAsync(req, descriptor, cancellationToken);

            var approved = await ApproveAsync(req, descriptor, deferred);

            if (approved && descriptor.RequiresSupervisorReport)
            {
                await SaveSupervisorReportAsync(req, descriptor, cancellationToken);
            }

            if (approved && await IsDispositionTargetAsync(req.ApplicationId, req.ServiceId, cancellationToken))
            {
                // PRD (302 single-node): a Reject always routes to Pending Disposition; an Approve
                // routes there only when the application carries red-label books (ISBN status
                // Rejected(0) in Core.Books). An Approve with no red-label book settles normally.
                var needsDisposition = descriptor.Type == WorkflowActionType.Reject
                    || await HasRejectedLibraryBooksAsync(req, cancellationToken);
                if (needsDisposition)
                {
                    return await BuildPendingDispositionResponseAsync(req, descriptor, deferred, cancellationToken);
                }
            }

            if (approved)
            {
                // Non-disposition flows that land terminal right here (PayFirst approve ->
                // 105, reject -> 106) get their timeline event row now. ApproveFirst stays
                // at 103 Pending Payment — the customer portal writes the 'Completed' row
                // when the payment succeeds; disposition flows write theirs at case settle.
                await WriteTerminalTimelineEventIfTerminalAsync(req, departmentId, cancellationToken);
            }

            return await BuildTerminalActionResponseAsync(req, descriptor, approved, cancellationToken);
        }

        private async Task<WorkflowActionExecuteResponse?> TryHandleAutomaticFahrFirstApprovalAsync(
            TaskActionDto req,
            WorkflowTransition descriptor,
            DeferredPostCommitActions deferred,
            CancellationToken cancellationToken)
        {
            if (descriptor.Type != WorkflowActionType.Approve)
            {
                return null;
            }

            var currentTask = await _camundaWorkflowDomainService.GetCamundaTaskByIdAsync(req.TaskId, cancellationToken);
            if (currentTask == null || string.IsNullOrWhiteSpace(currentTask.TaskDefinitionKey))
            {
                return null;
            }

            var processInstance = await _camundaWorkflowDomainService.GetProcessInstanceByIdAsync(req.InstanceId, cancellationToken);
            if (processInstance?.StatusId is not int originalApprovalStatusId
                || originalApprovalStatusId < (int)ApprovalNodeOrder.InitialApproval
                || originalApprovalStatusId > (int)ApprovalNodeOrder.FinalApproval)
            {
                return null;
            }

            var workflowConfig = await _db.WorkflowConfigurations
                .AsNoTracking()
                .Include(config => config.WorkflowNodes)
                .Where(config =>
                    config.ServiceId == req.ServiceId
                    && config.Version == processInstance.Version)
                .OrderByDescending(config => config.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (workflowConfig == null
                || !IsFirstWorkflowUserTask(workflowConfig.WorkflowNodes, currentTask.TaskDefinitionKey))
            {
                return null;
            }

            var eligibility = await _fahrTriggerService.EvaluateExternalApprovalEligibilityAsync(req.ApplicationId, cancellationToken);
            if (!eligibility.Eligible)
            {
                return null;
            }

            return await HandleAutomaticFahrFirstApprovalAsync(
                req,
                descriptor,
                currentTask,
                processInstance,
                originalApprovalStatusId,
                deferred,
                cancellationToken);
        }

        private async Task<WorkflowActionExecuteResponse> HandleAutomaticFahrFirstApprovalAsync(
            TaskActionDto req,
            WorkflowTransition descriptor,
            CamundaTask currentTask,
            CamundaProcessInstance processInstance,
            int originalApprovalStatusId,
            DeferredPostCommitActions deferred,
            CancellationToken cancellationToken)
        {
            var existingPendingRecord = await _camundaWorkflowDomainService.GetPendingExternalApprovalRecordAsync(req.InstanceId);
            if (existingPendingRecord != null)
            {
                throw new BusinessException("Workflow.ExternalApprovalAlreadyPending", "");
            }

            var now = DateTimeHelper.Now;
            var approverId = (!string.IsNullOrEmpty(_currentUserService.UserId)
                ? _currentUserService.UserId
                : currentTask.Assignee) ?? string.Empty;
            var approverName = _currentUserService.UserName ?? string.Empty;
            var approvedLabel = (await _typeDictionaryService.GetByCodeAsync(
                "ApprovalNodeOrder",
                ((int)ApprovalNodeOrder.Approved).ToString()))?.NameEn ?? "Approved";

            var firstApprovalRecord = await _camundaWorkflowDomainService.UpsertApprovalRecordByTaskIdAsync(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                TaskId = req.TaskId,
                ApprovalAction = descriptor.LegacyApprovalAction,
                ApprovalComment = req.ApprovalComment,
                ApprovalResult = approvedLabel,
                InstanceStatusId = originalApprovalStatusId,
                ApproverId = approverId,
                ApproverName = approverName,
                ApprovalDate = now,
                DueDate = currentTask.DueDate,
                ActualDurationMinutes = (now - currentTask.CreatedTime).TotalMinutes,
                WorkflowActionCode = descriptor.ActionCode,
                NodeType = TimelineNodeTypes.Review,
                CreatedOn = now
            });
            await SaveApprovalRecordAttachmentsAsync(
                firstApprovalRecord.Id,
                req.GetRejectReasonFiles(),
                cancellationToken);

            currentTask.StatusId = (int)ApprovalNodeOrder.ExternalApproval;
            await _camundaWorkflowDomainService.UpdateCamundaTask(currentTask);

            processInstance.StatusId = (int)ApprovalNodeOrder.ExternalApproval;
            await _camundaWorkflowDomainService.SaveProcessAsync(processInstance, cancellationToken);

            await _camundaWorkflowDomainService.AddApprovalRecordAsync(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                TaskId = Guid.NewGuid().ToString(),
                ApprovalAction = "AutomaticFahrPending",
                InstanceStatusId = (int)ApprovalNodeOrder.ExternalApproval,
                NodeType = originalApprovalStatusId.ToString(CultureInfo.InvariantCulture),
                ExternalOrganizationId = "FAHR",
                ApproverId = approverId,
                ApproverName = approverName,
                ApprovalDate = now.AddSeconds(5),
                CreatedOn = now.AddSeconds(5)
            });

            deferred.FahrTriggerWorkItem = new Frha.Trigger.FahrTriggerWorkItem(
                req.ApplicationId,
                req.InstanceId,
                req.ApprovalComment,
                string.IsNullOrWhiteSpace(_currentUserService.UserId)
                    ? null
                    : _currentUserService.UserId.Trim());

            _logger.LogInformation(
                "[FAHR][AUTO-FIRST-APPROVAL] PARKED ApplicationId={ApplicationId} InstanceId={InstanceId} TaskId={TaskId} OriginalStatusId={OriginalStatusId}; outbound push scheduled after commit.",
                req.ApplicationId,
                req.InstanceId,
                req.TaskId,
                originalApprovalStatusId);

            return new WorkflowActionExecuteResponse
            {
                Success = true,
                WorkflowAction = descriptor.ActionCode,
                WorkflowActionLabel = isArabic ? descriptor.LabelAr : descriptor.LabelEn,
                ApprovalResult = approvedLabel,
                AdminStatus = "External Approval",
                CustomerStatus = "Under Review",
                ProcessInstanceStatus = "External Approval",
                ApplicationStatus = "Under Review"
            };
        }

        // Whether a timeline action row should render as an "External Approval" node.
        // Two shapes qualify:
        //   1. A back-filled external placeholder — it carries the ExternalOrganizationId.
        //   2. A terminal approve/reject the reviewer recorded while the task was parked at the
        //      External Approval node (InstanceStatusId == ExternalApproval). This reuses the
        //      normal review path (reject == end the flow), so it has NO ExternalOrganizationId and
        //      ResolveNodeTitle would otherwise mislabel it with the BPMN node name. The
        //      forward-to-external action itself (action code 300) is excluded — that row keeps the
        //      reviewer's own node title and only reports "External Approval" as its result.
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal static bool IsExternalApprovalNode(
            string? externalOrganizationId, int? instanceStatusId, int? workflowActionCode)
        {
            if (!string.IsNullOrEmpty(externalOrganizationId)) return true;

            const int externalApprovalActionCode = 300; // WorkflowActionResolver.ActionCodeExternalApproval
            return instanceStatusId == (int)ApprovalNodeOrder.ExternalApproval
                && workflowActionCode != externalApprovalActionCode;
        }

        // 302 material-list decision counts for the first-approval timeline badge
        // (ItemsApproved / ItemsRejected). The imported book list is the ISBNs in
        // ApplicationDetailsExt.FormDataValues:
        //   - Reject action  -> every book is rejected (approved 0).
        //   - Approve action -> rejected = red-label books (content library IsApproved == 0);
        //     approved = everything else — green (1), gray/Pending Review (2) and ISBNs absent
        //     from the library all count as approved for the material-entry decision.
        // A 0-valued side is returned as null so the frontend hides that half of the badge
        // (all-approved shows only "N approved"; a reject shows only "N rejected").
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task<(int? Approved, int? Rejected)> ComputeMaterialListDecisionCountsAsync(
            int applicationDetailId, ApprovalRecord firstApprovalRecord)
        {
            var formDataValues = await _db.ApplicationDetailsExts
                .AsNoTracking()
                .Where(x => x.ApplicationDetailId == applicationDetailId)
                .OrderByDescending(x => x.Id)
                .Select(x => x.FormDataValues)
                .FirstOrDefaultAsync();

            var isbns = ExtractIsbnsFromFormData(formDataValues);
            var total = isbns.Count;
            if (total == 0)
            {
                return (null, null);
            }

            var descriptor = firstApprovalRecord.WorkflowActionCode.HasValue
                ? _workflowTransitionRegistry.GetByActionCode(firstApprovalRecord.WorkflowActionCode.Value)
                : null;
            var isReject = descriptor?.Type == WorkflowActionType.Reject
                || firstApprovalRecord.ApprovalResult == "Rejected";
            var isApprove = descriptor?.Type == WorkflowActionType.Approve
                || firstApprovalRecord.ApprovalResult == "Approved";

            // Badge only applies to a straight approve/reject decision (not modification/send-back).
            if (!isReject && !isApprove)
            {
                return (null, null);
            }

            int rejected;
            if (isReject)
            {
                rejected = total;
            }
            else
            {
                var statuses = await _contentLibraryApp.GetBookApprovedStatusByIsbnsAsync(isbns);
                rejected = statuses.Count(d =>
                    d.TryGetValue("BookApprovedStatus", out var status) && Convert.ToInt32(status) == 0);
            }

            var approved = total - rejected;
            return (approved > 0 ? approved : null, rejected > 0 ? rejected : null);
        }

        // True when the application's imported book list contains at least one book whose
        // Core.Books status is Rejected(0) — the "red label" that forces an Approve into the
        // disposition flow. Reads ISBNs from ApplicationDetailsExt.FormDataValues and asks the
        // content library for their approval statuses.
        private async Task<bool> HasRejectedLibraryBooksAsync(TaskActionDto req, CancellationToken cancellationToken)
        {
            var formDataValues = await _db.ApplicationDetailsExts
                .AsNoTracking()
                .Where(x => x.ApplicationDetailId == req.ApplicationDetailId)
                .OrderByDescending(x => x.Id)
                .Select(x => x.FormDataValues)
                .FirstOrDefaultAsync(cancellationToken);

            var isbns = ExtractIsbnsFromFormData(formDataValues);
            if (isbns.Count == 0)
                return false;

            var bookStatuses = await _contentLibraryApp.GetBookApprovedStatusByIsbnsAsync(isbns);
            return bookStatuses.Any(d =>
                d.TryGetValue("BookApprovedStatus", out var status) &&
                Convert.ToInt32(status) == 0);
        }

        // FormDataValues holds a JSON array of step objects; each step's "formData" is an
        // ESCAPED JSON string that nests formValues.bookListUpload.bookList[].isbn. Rather than
        // bind the exact path, walk the tree tolerantly: descend into nested JSON strings and
        // pull "isbn" from any array named "bookList". Malformed data yields an empty list.
        private static List<string> ExtractIsbnsFromFormData(string? formDataValues)
        {
            var isbns = new List<string>();
            if (string.IsNullOrWhiteSpace(formDataValues))
                return isbns;

            try
            {
                using var doc = JsonDocument.Parse(formDataValues);
                CollectIsbns(doc.RootElement, isbns);
            }
            catch (System.Text.Json.JsonException)
            {
                // Treat unparseable form data as "no book list" -> normal review path.
            }

            return isbns
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .Distinct()
                .ToList();
        }

        private static void CollectIsbns(JsonElement element, List<string> isbns)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (var prop in element.EnumerateObject())
                    {
                        if (string.Equals(prop.Name, "bookList", StringComparison.OrdinalIgnoreCase) &&
                            prop.Value.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var book in prop.Value.EnumerateArray())
                            {
                                if (book.ValueKind == JsonValueKind.Object &&
                                    book.TryGetProperty("isbn", out var isbnEl) &&
                                    isbnEl.ValueKind == JsonValueKind.String)
                                {
                                    isbns.Add(isbnEl.GetString() ?? string.Empty);
                                }
                            }
                        }
                        else
                        {
                            CollectIsbns(prop.Value, isbns);
                        }
                    }
                    break;

                case JsonValueKind.Array:
                    foreach (var item in element.EnumerateArray())
                        CollectIsbns(item, isbns);
                    break;

                case JsonValueKind.String:
                    // "formData" and similar are escaped JSON blobs — re-parse and descend.
                    var raw = element.GetString();
                    if (!string.IsNullOrWhiteSpace(raw))
                    {
                        var trimmed = raw.TrimStart();
                        if (trimmed.StartsWith("{") || trimmed.StartsWith("["))
                        {
                            try
                            {
                                using var nested = JsonDocument.Parse(raw);
                                CollectIsbns(nested.RootElement, isbns);
                            }
                            catch (System.Text.Json.JsonException)
                            {
                                // Not actually JSON — ignore.
                            }
                        }
                    }
                    break;
            }
        }

        /// <summary>
        /// Compresses a swallowed FAHR trigger exception into a one-line operator hint for
        /// <c>FahrExternalApprovalRequest.TriggerReason</c> (NVARCHAR(500)). Only the exception
        /// type and the first line of the message are kept: stack traces belong in the log, and
        /// the column is short enough that an unbounded message would fail the very INSERT whose
        /// job is to record a failure.
        /// </summary>
        private static string BuildFahrFailureReason(Exception ex)
        {
            const int maxLength = 500;

            var firstLine = (ex.Message ?? string.Empty)
                .Replace('\r', ' ')
                .Replace('\n', ' ')
                .Trim();

            var reason = $"{ex.GetType().Name}: {firstLine}";
            return reason.Length <= maxLength ? reason : reason.Substring(0, maxLength);
        }

        /// <summary>
        /// Writes the <c>TriggerFailed</c> breadcrumb row for an External Approval click whose
        /// FAHR trigger threw. Two deliberate design points:
        /// <list type="number">
        /// <item><b>Fresh DI scope.</b> The trigger service's <c>AdminPortalDBContext</c> may have
        /// a poisoned change tracker (that is often exactly why it threw — e.g. the Actor column
        /// truncation), so reusing it would throw again inside the catch and lose the breadcrumb.
        /// A new scope gets a clean context.</item>
        /// <item><b>Never throws.</b> Any failure here is logged and dropped. This runs inside the
        /// catch that exists specifically so FAHR cannot block the reviewer's park; letting the
        /// diagnostic write break that guarantee would invert the whole point.</item>
        /// </list>
        /// </summary>
        private async Task TryRecordFahrTriggerFailureAsync(
            int applicationId, string failureReason, CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions
                    .GetRequiredService<AdminPortalDBContext>(scope.ServiceProvider);

                // ServiceId is non-nullable on the entity; ServiceCode is only a label. Read both
                // best-effort so the breadcrumb still lands if the application row is unreadable.
                var app = await db.Applications
                    .AsNoTracking()
                    .Where(a => a.Id == applicationId)
                    .Select(a => new { a.ServiceId, a.ServiceCode })
                    .FirstOrDefaultAsync(cancellationToken);

                var now = DateTime.UtcNow;
                var correlationId = Guid.NewGuid();

                db.FahrExternalApprovalRequests.Add(new Domain.Models.Fahr.FahrExternalApprovalRequest
                {
                    CorrelationId = correlationId,
                    ApplicationId = applicationId,
                    ServiceId = app?.ServiceId ?? 0,
                    ServiceCode = app?.ServiceCode,
                    TriggerRuleCode = null,
                    TriggerReason = failureReason,
                    Status = Domain.Models.Fahr.FahrExternalApprovalRequest.StatusTriggerFailed,
                    TriggeredBy = string.IsNullOrWhiteSpace(_currentUserService.UserId)
                        ? null
                        : _currentUserService.UserId!.Trim(),
                    TriggeredAt = now
                });

                // Timeline entry so the failure also shows up in the AC-24 log, not just as a
                // session status. Actor is NVARCHAR(30) — use the short label, never a user id.
                db.FahrInteractionLogs.Add(new Domain.Models.Fahr.FahrInteractionLog
                {
                    CorrelationId = correlationId,
                    Direction = "Internal",
                    Action = "TriggerFailed",
                    Actor = "System",
                    Detail = $"applicationId={applicationId}; {failureReason}",
                    CreatedAt = now
                });

                await db.SaveChangesAsync(cancellationToken);

                _logger.LogWarning(
                    "[FAHR][CAMUNDA-HOOK] TRIGGER-FAILED-RECORDED ApplicationId={ApplicationId} CorrelationId={CorrelationId}: TriggerFailed session persisted so GET /FahrStatus can distinguish this from NotRequired.",
                    applicationId, correlationId);
            }
            catch (Exception breadcrumbEx)
            {
                // Deliberately terminal: the park must proceed regardless.
                _logger.LogError(breadcrumbEx,
                    "[FAHR][CAMUNDA-HOOK] TRIGGER-FAILED-RECORD-FAILED ApplicationId={ApplicationId}: could not persist the TriggerFailed breadcrumb; the failure is log-only for this click.",
                    applicationId);
            }
        }

        private async Task<WorkflowActionExecuteResponse> HandleExternalApprovalActionAsync(
            TaskActionDto req, WorkflowTransition descriptor, string departmentId,
            DeferredPostCommitActions deferred, CancellationToken cancellationToken)
        {
            // Queue the FAHR trigger before the local External Approval bookkeeping, but defer
            // the outbound work until the surrounding approval transaction has committed.
            //
            // Plan deviation (documented): FAHR implement plan_v1.md §C-1 originally pointed the
            // trigger hook at CamundaTaskAppService.ExternalApprovalActionAsync. That method
            // is actually the *reconciliation* path invoked after the external authority has
            // returned a decision (it flips the parked task off status 11 and completes the
            // Camunda node). The actual parking transition — the moment the task becomes
            // External Approval and is the correct place to fire the outbound FAHR trigger —
            // lives here in HandleExternalApprovalActionAsync (called from ApproveV2Async via
            // the WorkflowTransition dispatcher). The hook therefore lives here; see the
            // reverse pointer in CamundaTaskAppService.ExternalApprovalActionAsync.
            //
            // The FAHR service evaluates its own trigger rules in the background. Failures and
            // partial pushes are recorded there and can be replayed through the manual endpoint;
            // they must not extend or roll back this approval response.
            deferred.FahrTriggerWorkItem = new Frha.Trigger.FahrTriggerWorkItem(
                req.ApplicationId,
                req.InstanceId,
                req.ApprovalComment,
                string.IsNullOrWhiteSpace(_currentUserService.UserId)
                    ? null
                    : _currentUserService.UserId.Trim());

            _logger.LogInformation(
                "[FAHR][CAMUNDA-HOOK] Queued ApplicationId={ApplicationId} InstanceId={InstanceId}; outbound push will start after the approval transaction commits.",
                req.ApplicationId,
                req.InstanceId);

            // External Approval: the current node is parked while an outside authority decides.
            //   1. Flip the local CamundaTask to status 11 (External Approval). 11 is not a
            //      completed status, so the task stays "live" and remains in the assignee's My
            //      Review todo. Team todo hides 11 on purpose (see GetMyTeamReviewPageAsync).
            //   2. Flip the owning CamundaProcessInstance to status 11 as well so the process
            //      state mirrors the parked node.
            //   3. The CURRENT node's record is now COMPLETED (choosing External Approval is its
            //      final action) — stamp its completion fields (ApprovalResult "External Approval",
            //      ApprovalDate, DueDate, ActualDurationMinutes, InstanceStatusId, ...). Figure 2.
            //   4. Create a NEW record for the External Approval node itself — figure 1: carries
            //      the outside authority + the awaiting-result prompt, detached from the real
            //      TaskId. Its NodeType stores the node's status from BEFORE it was parked at
            //      External Approval, so the originating node order can be restored later.
            var currentTask = await _camundaWorkflowDomainService.GetCamundaTaskByIdAsync(req.TaskId, cancellationToken)
                ?? throw new BusinessException("Camunda task not found", "");

            var processInstance = await _camundaWorkflowDomainService.GetProcessInstanceByIdAsync(req.InstanceId, cancellationToken);

            // Captured before the status flips to External Approval (11). A live to-do CamundaTask
            // always carries InitialApproval as its StatusId (next-task creation hardcodes it), so it
            // can't be the source of truth for the node order reached — that lives on the process
            // instance. Capture the instance's status so the External Approval return restores the
            // correct node (e.g. Final Approval), not InitialApproval. Fall back to the task only
            // when the instance is missing.
            var previousNodeStatusId = processInstance?.StatusId ?? currentTask.StatusId;

            currentTask.StatusId = (int)ApprovalNodeOrder.ExternalApproval;
            await _camundaWorkflowDomainService.UpdateCamundaTask(currentTask);

            if (processInstance != null)
            {
                processInstance.StatusId = (int)ApprovalNodeOrder.ExternalApproval;
                await _camundaWorkflowDomainService.SaveProcessAsync(processInstance, cancellationToken);
            }

            var actionLabel = isArabic ? descriptor.LabelAr : descriptor.LabelEn;
            var externalApprovalDate = DateTimeHelper.Now;
            var approverId = (!string.IsNullOrEmpty(_currentUserService.UserId) ? _currentUserService.UserId : currentTask.Assignee) ?? string.Empty;
            var approverName = _currentUserService.UserName ?? string.Empty;
            // The queued FAHR call has not run yet, so its eventual trigger outcome cannot be
            // used while persisting this approval transaction.
            var externalOrganizationId = ParsePayload(req.GetActionPayloadElement()).OrganizationCode;

            // (3) Current node record -> completed: Review Result "External Approval" plus the
            // completion stamps (date / due / duration / status). Keyed by TaskId (figure 2).
            var record = await _camundaWorkflowDomainService.UpsertApprovalRecordByTaskIdAsync(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                TaskId = req.TaskId,
                ApprovalAction = descriptor.LegacyApprovalAction,
                ApprovalComment = req.ApprovalComment,
                ApprovalResult = actionLabel,
                InstanceStatusId = (int)ApprovalNodeOrder.ExternalApproval,
                ApproverId = approverId,
                ApproverName = approverName,
                ApprovalDate = externalApprovalDate,
                DueDate = currentTask.DueDate,
                ActualDurationMinutes = (externalApprovalDate - currentTask.CreatedTime).TotalMinutes,
                WorkflowActionCode = descriptor.ActionCode,
                RejectReasonCode = req.RejectReasonCode,
                RejectReasonFile = req.GetPrimaryRejectReasonFile(),
                // The current node's action (choosing External Approval) is a Review node;
                // ApprovalResult carries "External Approval".
                NodeType = TimelineNodeTypes.Review,
                CreatedOn = externalApprovalDate
            });
            await SaveApprovalRecordAttachmentsAsync(record.Id, req.GetRejectReasonFiles(), cancellationToken);

            // (4) New External Approval node record (figure 1) — distinct, detached TaskId, carries
            // the organization and awaits the external result (+5s so it sorts above the current
            // node action on the timeline). NodeType = the node's pre-park status order.
            await _camundaWorkflowDomainService.AddApprovalRecordAsync(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                TaskId = Guid.NewGuid().ToString(),
                ApprovalAction = "Pending",
                InstanceStatusId = (int)ApprovalNodeOrder.ExternalApproval,
                NodeType = previousNodeStatusId?.ToString(),
                ExternalOrganizationId = externalOrganizationId,
                ApproverId = approverId,
                ApproverName = approverName,
                ApprovalDate = externalApprovalDate.AddSeconds(5),
                CreatedOn = externalApprovalDate.AddSeconds(5)
            });

            return new WorkflowActionExecuteResponse
            {
                Success = true,
                WorkflowAction = descriptor.ActionCode,
                WorkflowActionLabel = actionLabel,
                ApprovalResult = actionLabel,
                AdminStatus = actionLabel,
                CustomerStatus = "Under Review",
                ProcessInstanceStatus = actionLabel,
                ApplicationStatus = "Under Review"
            };
        }

        private async Task<WorkflowActionExecuteResponse> HandleSendBackActionAsync(
            TaskActionDto req, WorkflowTransition descriptor, string departmentId,
            DeferredPostCommitActions deferred, CancellationToken cancellationToken)
        {
            // SendBack: hand the task back to the previous approval node so the prior
            // approver re-evaluates. Steps:
            //   1. Locate the current node + the closest userTask upstream (NodeOrder-).
            //   2. Resolve the prior approver from ApprovalRecord history at that node.
            //   3. Close the current local CamundaTask (StatusId=SendBack, ApprovalAt=now).
            //   4. Write an ApprovalRecord row for this SendBack action.
            //   5. Open a new local CamundaTask at the previous node, assigned to the
            //      prior approver, with the node's SLA.
            //   6. Reopen the process instance (StatusId=previous node order, EndTime=null).
            // TODO: bpmn-service coordination — the Camunda engine should be told to
            // jump activity back to previousNode.NodeId via process-instance modification.
            // Until that endpoint lands, the local CamundaTask table drives the UI.
            var currentTask = await _camundaWorkflowDomainService.GetCamundaTaskByIdAsync(req.TaskId, cancellationToken)
                ?? throw new BusinessException("Camunda task not found", "");

            var currentNode = await _db.WorkflowNodes
                .AsNoTracking()
                .Where(n => n.NodeId == currentTask.TaskDefinitionKey)
                .OrderByDescending(n => n.Id)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new BusinessException("Workflow node not found for current task", "");

            var previousNode = await _db.WorkflowNodes
                .AsNoTracking()
                .Where(n => n.WorkflowConfigurationId == currentNode.WorkflowConfigurationId &&
                            n.NodeType == "userTask" &&
                            n.NodeOrder < currentNode.NodeOrder)
                .OrderByDescending(n => n.NodeOrder)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new BusinessException("No previous approval node available to send back to", "");

            var previousApprover = await (
                from r in _db.ApprovalRecords.AsNoTracking()
                join t in _db.CamundaTasks.AsNoTracking() on r.TaskId equals t.TaskId
                where r.ApplicationId == req.ApplicationId &&
                      r.ProcessInstanceId == req.InstanceId &&
                      t.TaskDefinitionKey == previousNode.NodeId
                orderby r.Id descending
                select r.ApproverId
            ).FirstOrDefaultAsync(cancellationToken);

            currentTask.StatusId = (int)ApprovalNodeOrder.SendBack;
            currentTask.ApprovalAt = DateTimeHelper.Now;
            await _camundaWorkflowDomainService.UpdateCamundaTask(currentTask);

            var actionLabel = isArabic ? descriptor.LabelAr : descriptor.LabelEn;
            var record = await _camundaWorkflowDomainService.UpsertApprovalRecordByTaskIdAsync(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                TaskId = req.TaskId,
                ApprovalAction = descriptor.LegacyApprovalAction,
                ApprovalComment = req.ApprovalComment,
                ApprovalResult = actionLabel,
                InstanceStatusId = (int)ApprovalNodeOrder.SendBack,
                ApproverId = (!string.IsNullOrEmpty(_currentUserService.UserId) ? _currentUserService.UserId : currentTask.Assignee) ?? string.Empty,
                ApproverName = _currentUserService.UserName ?? string.Empty,
                ApprovalDate = DateTimeHelper.Now,
                WorkflowActionCode = descriptor.ActionCode,
                RejectReasonCode = req.RejectReasonCode,
                RejectReasonFile = req.GetPrimaryRejectReasonFile(),
                NodeType = TimelineNodeTypes.SendBack,
                CreatedOn = DateTimeHelper.Now
            });
            await SaveApprovalRecordAttachmentsAsync(record.Id, req.GetRejectReasonFiles(), cancellationToken);

            var sla = previousNode.SlaType?.ToLowerInvariant() switch
            {
                "hours" => TimeSpan.FromHours(previousNode.SlaTime),
                "minutes" => TimeSpan.FromMinutes(previousNode.SlaTime),
                _ => TimeSpan.FromDays(previousNode.SlaTime)
            };
            await _camundaWorkflowDomainService.AddCamundaTask(new CamundaTask
            {
                TaskId = Guid.NewGuid().ToString(),
                ProcessInstanceId = req.InstanceId,
                TaskDefinitionKey = previousNode.NodeId,
                Assignee = previousApprover,
                StatusId = (int)ApprovalNodeOrder.InitialApproval,
                CreatedTime = DateTimeHelper.Now,
                DueDate = DateTimeHelper.Now.Add(sla),
                ApprovalDepartment = previousNode.ApprovalDepartment,
                ApprovalRole = previousNode.ApprovalRole
            }, cancellationToken);

            // Event-sourced timeline: no node-entry placeholder for the re-opened node.

            var processInstance = await _camundaWorkflowDomainService.GetProcessInstanceByIdAsync(req.InstanceId, cancellationToken);
            if (processInstance != null)
            {
                processInstance.StatusId = previousNode.NodeOrder;
                processInstance.EndTime = null;
                await _camundaWorkflowDomainService.SaveProcessAsync(processInstance, cancellationToken);
            }

            var previousNodeLabel = isArabic && !string.IsNullOrWhiteSpace(previousNode.NodeNameAr)
                ? previousNode.NodeNameAr
                : previousNode.NodeNameEn;

            return new WorkflowActionExecuteResponse
            {
                Success = true,
                WorkflowAction = descriptor.ActionCode,
                WorkflowActionLabel = actionLabel,
                ApprovalResult = actionLabel,
                AdminStatus = previousNodeLabel,
                CustomerStatus = "Under Review",
                ProcessInstanceStatus = previousNodeLabel,
                ApplicationStatus = "Under Review"
            };
        }

        private async Task<WorkflowActionExecuteResponse> BuildPendingDispositionResponseAsync(
            TaskActionDto req, WorkflowTransition descriptor, DeferredPostCommitActions deferred, CancellationToken cancellationToken)
        {
            // Disposition is supplementary to the main approve/reject decision — the
            // certificate (or rejection notification) and payment have already fired in
            // ApproveAsync; the Camunda task service has already written process state.
            // All this builder does is record the supplementary disposition obligation
            // and surface it back to the admin response.
            var disposition = await CreateDispositionCaseAsync(req, descriptor, deferred, cancellationToken);

            // Delegate to the normal terminal-response builder for the main labels
            // (Completed / Rejected etc.), then overlay the disposition follow-up.
            var response = await BuildTerminalActionResponseAsync(req, descriptor, approved: true, cancellationToken);
            response.RequiresCustomerAction = true;
            response.CustomerAction = "SubmitDispositionProof";
            response.DueDate = disposition.DueDate;
            response.NextTaskId = $"disposition-{disposition.CaseId}";
            return response;
        }

        private async Task<WorkflowActionExecuteResponse> BuildTerminalActionResponseAsync(
            TaskActionDto req, WorkflowTransition descriptor, bool approved, CancellationToken cancellationToken)
        {
            var processInstance = await _camundaWorkflowDomainService.GetProcessInstanceByIdAsync(req.InstanceId, cancellationToken);
            // Disposition verification id lives on DispositionCase (process instance no
            // longer mirrors it). Look up the latest case for this process to recompose
            // the legacy compound label e.g. "Completed (Disposition Verified)".
            var dispositionStatusId = await GetLatestDispositionStatusAsync(req.InstanceId, cancellationToken);
            var resultStatus = await PostCertificateDispositionPolicy.LocalizeDispositionFinalStatusAsync(
                processInstance?.StatusId,
                dispositionStatusId,
                (isArabic ? "ar" : "en"),
                _typeDictionaryService);

            return new WorkflowActionExecuteResponse
            {
                Success = approved,
                WorkflowAction = descriptor.ActionCode,
                WorkflowActionLabel = (isArabic ? descriptor.LabelAr : descriptor.LabelEn),
                ApprovalResult = GetApprovalResult(descriptor.Type, processInstance?.StatusId),
                AdminStatus = resultStatus,
                CustomerStatus = MapCustomerStatus(processInstance?.StatusId),
                ProcessInstanceStatus = resultStatus,
                ApplicationStatus = MapCustomerStatus(processInstance?.StatusId),
                RequiresCustomerAction = false,
                // Populated when this request produced a new current task (Request Modification's
                // new Guid task, or a 302 "disposition-{caseId}" row). Null otherwise. The client
                // uses it to re-point the review detail page off the old, now-terminated taskId.
                NextTaskId = _pendingNextTaskId
            };
        }

        // Server-side guard for the supervisor-report actions. Mirrors the frontend, which opens the
        // media-material report modal for exactly these transitions: content approvals (3/4/5/6) and
        // content rejections (104/105/106/107) — i.e. every transition with RequiresSupervisorReport.
        // Enforced here so a direct ApproveV2 call cannot bypass the frontend validation.
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task ValidateSupervisorReportPayloadAsync(TaskActionDto req, WorkflowTransition descriptor, CancellationToken cancellationToken)
        {
            // Other actions (plain approve/reject, modification, external approval, disposition) carry
            // no supervisor report and open no modal — skip them.
            if (!descriptor.RequiresSupervisorReport)
            {
                return;
            }

            // Newspaper/magazine & other media (approve 6 / reject 107) are excluded from the
            // supervisor-report required-field enforcement per product rule — the report may still be
            // saved, but neither age classification nor detailed report is mandatory for them.
            if (descriptor.ActionCode is 6 or 107)
            {
                return;
            }

            var payload = ParsePayload(req.GetActionPayloadElement());

            // Services 21, 1005 and 2201 all run on actions 4 / 105, so the field rules can only be
            // selected by the application's own ServiceCode (see MediaMaterialReportRules).
            var serviceCode = await GetApplicationServiceCodeAsync(req.ApplicationId, cancellationToken);
            var hasAgeClassification = payload.AgeClassificationId is > 0;

            // Age classification is stamped on the issued certificate, so it is required only for a
            // certificate-issuing approval AND only when the service actually offers age-classification
            // options. The frontend renders the field per the service's media material type
            // (ServiceLookupMappings.MaterialTypeId -> AgeClassifications), so many services on these
            // action codes (e.g. Magazine Distribution Permit) have no age classification at all.
            // Rejections issue no certificate and never require it. Two exceptions: services 21 / 1005
            // carry no age classification at all, and service 2201 always requires one because the
            // classification is the whole report.
            if (!MediaMaterialReportRules.ExcludesAgeClassification(serviceCode) && !hasAgeClassification)
            {
                if (MediaMaterialReportRules.RequiresAgeClassificationAlways(serviceCode)
                    || (descriptor.Type == WorkflowActionType.Approve
                        && await ServiceHasAgeClassificationOptionsAsync(req.ServiceId, cancellationToken)))
                {
                    throw new BusinessException(_localizer["Age classification is required."]);
                }
            }

            // Service 2201 captures neither a detailed report nor notes, so the detailed report must
            // not be demanded there.
            if (MediaMaterialReportRules.ClassificationOnly(serviceCode))
            {
                return;
            }

            // The detailed report is the body of the supervisor report for both approve and reject.
            // Mirrors the storage fallback (payload.DetailedReport ?? ApprovalComment).
            var detailedReport = payload.DetailedReport ?? req.ApprovalComment;
            if (string.IsNullOrWhiteSpace(detailedReport))
            {
                throw new BusinessException(_localizer["Detailed report is required."]);
            }
        }

        // The only trusted source for the media material report field rules: the ServiceCode stored on
        // the application record. The request carries no service code, and the display fields it does
        // carry are caller-supplied.
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task<string?> GetApplicationServiceCodeAsync(int applicationId, CancellationToken cancellationToken)
        {
            return await _db.Applications
                .AsNoTracking()
                .Where(x => x.Id == applicationId)
                .Select(x => x.ServiceCode)
                .FirstOrDefaultAsync(cancellationToken);
        }

        // True when the service exposes age-classification options: its ServiceLookupMappings material
        // type has at least one AgeClassifications row. Mirrors the frontend gate that only renders the
        // age-classification field for those services (serviceId -> Services.Code ->
        // ServiceLookupMappings.MaterialTypeId -> AgeClassifications.MediaMaterialTypeId).
        // Internal (not private) for focused unit tests via InternalsVisibleTo.
        internal async Task<bool> ServiceHasAgeClassificationOptionsAsync(short serviceId, CancellationToken cancellationToken)
        {
            var materialTypeId = await (
                from s in _db.Set<ServiceConfig>().AsNoTracking()
                where s.Id == serviceId
                join m in _db.Set<ServiceLookupMapping>().AsNoTracking() on s.Code equals m.ServiceCode
                select m.MaterialTypeId).FirstOrDefaultAsync(cancellationToken);

            if (materialTypeId is not > 0)
            {
                return false;
            }

            var mediaMaterialTypeId = (short)materialTypeId.Value;
            return await _db.AgeClassifications.AsNoTracking()
                .AnyAsync(a => a.MediaMaterialTypeId == mediaMaterialTypeId, cancellationToken);
        }

        private async Task SaveSupervisorReportAsync(TaskActionDto req, WorkflowTransition descriptor, CancellationToken cancellationToken)
        {
            var payload = ParsePayload(req.GetActionPayloadElement());

            // Cleanse the payload against the application's own ServiceCode before anything is stored:
            // the removed fields must never be persisted, no matter what the caller posted.
            var serviceCode = await GetApplicationServiceCodeAsync(req.ApplicationId, cancellationToken);
            var excludesAgeClassification = MediaMaterialReportRules.ExcludesAgeClassification(serviceCode);
            var classificationOnly = MediaMaterialReportRules.ClassificationOnly(serviceCode);

            // The obligation letter was dropped from every media material report. It used to arrive as
            // RejectReasonFile (the reject-with-review dialog) or nested in the payload; both are ignored
            // here, and the file is also kept out of the report attachments. The reject attachment rows
            // written by the plain reject dialog are untouched - only this report drops the letter.
            var obligationLetterUrls = new[] { req.GetPrimaryRejectReasonFile(), payload.ObligationLetterUrl }
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!.Trim())
                .ToList();
            var attachments = payload.Attachments?
                .Where(x => !IsObligationLetterAttachment(x, obligationLetterUrls))
                .ToList();

            // The Camunda task action just wrote an ApprovalRecord row for this task —
            // link the supervisor report to it so downstream queries can join via
            // ApprovalRecordId (matches the DispositionCase.SourceApprovalRecordId pattern).
            var approvalRecordId = await _db.ApprovalRecords
                .AsNoTracking()
                .Where(x => x.ApplicationId == req.ApplicationId &&
                            x.TaskId == req.TaskId &&
                            x.WorkflowActionCode == descriptor.ActionCode)
                .OrderByDescending(x => x.Id)
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            var report = new SupervisorReport
            {
                ApplicationDetailId = req.ApplicationDetailId,
                ApprovalRecordId = approvalRecordId,
                WorkflowActionCode = descriptor.ActionCode,
                // Service 2201 stores no detailed report; the column is not nullable, so it holds "".
                DetailedReport = classificationOnly
                    ? string.Empty
                    : payload.DetailedReport ?? req.ApprovalComment ?? string.Empty,
                AgeClassificationId = excludesAgeClassification ? null : payload.AgeClassificationId,
                ObligationLetterUrl = null,
                AttachmentUrlsJson = attachments == null ? null : System.Text.Json.JsonSerializer.Serialize(attachments),
                CreatedBy = _currentUserService.UserId,
                CreatedOn = DateTimeHelper.Now
            };

            _db.SupervisorReports.Add(report);
            await _db.SaveChangesAsync(cancellationToken);

            if (payload.ClassificationIds != null)
            {
                foreach (var classificationId in payload.ClassificationIds)
                {
                    _db.SupervisorReportClassifications.Add(new SupervisorReportClassification
                    {
                        SupervisorReportId = report.Id,
                        SubCategoryId = classificationId
                    });
                }
            }

            // Service 2201 has no note list: nothing is written even when a caller posts notes.
            if (payload.Notes != null && !classificationOnly)
            {
                foreach (var note in payload.Notes)
                {
                    _db.SupervisorReportNotes.Add(new SupervisorReportNote
                    {
                        SupervisorReportId = report.Id,
                        Note = note.Note ?? string.Empty,
                        LocationType = string.IsNullOrWhiteSpace(note.SceneTime) ? "PageNumber" : "SceneTime",
                        LocationValue = note.PageNumber ?? note.SceneTime,
                        Action = note.Action
                    });
                }
            }

            await _db.SaveChangesAsync(cancellationToken);

            // Run PDF generation outside the request scope so ApproveV2 can return immediately.
            // Resolve the scoped PDF service from a fresh scope because the current request scope
            // (and its DbContext) is disposed after the response is returned.
            var supervisorReportId = report.Id;
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var pdfService = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions
                        .GetRequiredService<Pdf.ISupervisorReportPdfService>(scope.ServiceProvider);
                    await pdfService.GenerateAndStorePdfAsync(supervisorReportId, CancellationToken.None)
                        .ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Background supervisor report PDF generation failed. supervisorReportId={SupervisorReportId}",
                        supervisorReportId);
                }
            }, CancellationToken.None);
        }

        // An attachment is the obligation letter when it is the very key the caller sent as the letter,
        // or when it is another form of the same file (an object key vs. its URL) - matched on the file
        // name so a legacy client cannot leave the letter behind in AttachmentUrlsJson. Any other
        // attachment is kept.
        private static bool IsObligationLetterAttachment(string? attachment, IReadOnlyList<string> obligationLetterUrls)
        {
            var value = attachment?.Trim();
            if (string.IsNullOrEmpty(value) || obligationLetterUrls.Count == 0)
            {
                return false;
            }

            return obligationLetterUrls.Any(letter =>
                string.Equals(value, letter, StringComparison.OrdinalIgnoreCase)
                || string.Equals(FileNameOf(value), FileNameOf(letter), StringComparison.OrdinalIgnoreCase));
        }

        private static string FileNameOf(string value)
        {
            var withoutQuery = value.Split('?')[0].TrimEnd('/');
            var lastSeparator = withoutQuery.LastIndexOfAny(['/', '\\']);
            return lastSeparator < 0 ? withoutQuery : withoutQuery[(lastSeparator + 1)..];
        }

        private async Task SaveApprovalRecordAttachmentsAsync(int approvalRecordId, IReadOnlyList<string> fileKeys, CancellationToken cancellationToken)
        {
            if (_approvalRecordAttachmentService == null)
            {
                return;
            }

            await _approvalRecordAttachmentService.ReplaceAsync(approvalRecordId, fileKeys, cancellationToken);
        }

        // Request Modification spawns a brand-new process instance + task (new Guid taskId) that is
        // parked at Pending Modification; the OLD task the admin acted on is now terminated. Resolve
        // that new task's id from the new instance so it can be surfaced as NextTaskId — the review
        // detail page (keyed on the dead old taskId) must jump onto it, otherwise it never reflects
        // the customer's later resubmission. Best-effort: a lookup failure must not fail the action.
        private async Task SetModificationNextTaskIdAsync(string newInstanceId)
        {
            if (string.IsNullOrWhiteSpace(newInstanceId))
                return;
            var tasks = await _camundaWorkflowDomainService.GetCamundaTaskByInstanceIdAsync(newInstanceId);
            _pendingNextTaskId = tasks
                .OrderByDescending(t => t.Id)
                .Select(t => t.TaskId)
                .FirstOrDefault(id => !string.IsNullOrWhiteSpace(id));
        }

        private async Task<(int CaseId, DateTime DueDate)> CreateDispositionCaseAsync(
            TaskActionDto req,
            WorkflowTransition descriptor,
            DeferredPostCommitActions deferred,
            CancellationToken cancellationToken)
        {
            // Spec §4.4.4: 14-day customer window. Shared with the restart-on-reject path
            // (DispositionCaseAppService.RejectSubmissionAsync) via the same constant.
            var dueDate = DateTimeHelper.Now.AddDays(Services.WorkflowActions.DispositionCaseAppService.DispositionWindowDays);
            var sourceApprovalRecordId = await _db.ApprovalRecords
                .AsNoTracking()
                .Where(x => x.ApplicationId == req.ApplicationId &&
                            x.TaskId == req.TaskId &&
                            x.WorkflowActionCode == descriptor.ActionCode)
                .OrderByDescending(x => x.Id)
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            var dispositionCase = new DispositionCase
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                SourceWorkflowActionCode = descriptor.ActionCode,
                SourceApprovalRecordId = sourceApprovalRecordId,
                FinalDispositionStatusId = (int)DispositionVerificationStatus.PendingDisposition,
                DueDate = dueDate,
                CreatedBy = _currentUserService.UserId,
                CreatedOn = DateTimeHelper.Now
            };
            _db.DispositionCases.Add(dispositionCase);
            // Timeline event row: Pending Disposition node, handler = the applicant who
            // must pick a disposition method (not the approving admin).
            var dispositionApplicantUserId = await _db.Applications
                .AsNoTracking()
                .Where(a => a.Id == req.ApplicationId)
                .Select(a => a.UserId)
                .FirstOrDefaultAsync(cancellationToken);
            _db.ApprovalRecords.Add(new ApprovalRecord
            {
                ApplicationId = req.ApplicationId,
                ApplicationDetailId = req.ApplicationDetailId,
                ProcessInstanceId = req.InstanceId,
                NodeType = TimelineNodeTypes.PendingDisposition,
                ApprovalAction = TimelineNodeTypes.PendingDisposition,
                ApproverId = dispositionApplicantUserId,
                ApprovalDate = DateTimeHelper.Now
            });

            // Disposition is the application's primary state now (not a supplementary
            // obligation): move the detail to Pending Disposition (108) so the customer sees
            // it as pending and can submit proof. The base approve/reject had set a terminal
            // status (105/106); the case lifecycle (submit -> 109, review/expiry -> terminal)
            // drives it from here.
            var applicationDetail = await _db.ApplicationDetails
                .FirstOrDefaultAsync(x => x.Id == req.ApplicationDetailId, cancellationToken);
            if (applicationDetail != null)
            {
                applicationDetail.ApplicationStatusId = (short)ApplicationStatus.PendingDisposition;
            }

            await _db.SaveChangesAsync(cancellationToken);
            deferred.DispositionCreatedNotification.Register(dispositionCase.Id);
            return (dispositionCase.Id, dueDate);
        }

        private static WorkflowReportPayload ParsePayload(JsonElement? payload)
        {
            if (!payload.HasValue ||
                payload.Value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            {
                return new WorkflowReportPayload();
            }

            var rawJson = payload.Value.ValueKind == JsonValueKind.String
                ? payload.Value.GetString()
                : payload.Value.GetRawText();

            if (string.IsNullOrWhiteSpace(rawJson))
            {
                return new WorkflowReportPayload();
            }

            return System.Text.Json.JsonSerializer.Deserialize<WorkflowReportPayload>(
                rawJson,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    // Frontend may send numeric ids (e.g. ageClassification) as JSON strings.
                    NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
                }) ?? new WorkflowReportPayload();
        }

        private static string? GetApprovalResult(WorkflowActionType type, int? processStatusId)
        {
            return type switch
            {
                WorkflowActionType.Reject => "Rejected",
                WorkflowActionType.RequestModification => "Pending Modification",
                _ => processStatusId == (int)ApprovalNodeOrder.PendingPayment ? "Pending Payment" : "Approved"
            };
        }

        private static string? MapCustomerStatus(int? processStatusId)
        {
            return processStatusId switch
            {
                (int)ApprovalNodeOrder.PendingPayment => "Pending Payment",
                (int)ApprovalNodeOrder.Rejected => "Rejected",
                (int)ApprovalNodeOrder.Cancelled => "Cancelled",
                (int)ApprovalNodeOrder.PendingModification => "Pending Modification",
                (int)ApprovalNodeOrder.Completed => "Completed",
                null => null,
                _ => "Under Review"
            };
        }

        private class WorkflowReportPayload
        {
            // External approval: identifies the outside authority (actionPayload.organizationCode).
            public string? OrganizationCode { get; set; }
            public string? DetailedReport { get; set; }
            // Frontend sends this under the key "ageClassification" (no Id suffix);
            // map it explicitly so System.Text.Json binds it instead of leaving null.
            [System.Text.Json.Serialization.JsonPropertyName("ageClassification")]
            public short? AgeClassificationId { get; set; }
            public string? ObligationLetterUrl { get; set; }
            public List<string>? Attachments { get; set; }
            public List<int>? ClassificationIds { get; set; }
            public List<int>? CategoryIds { get; set; }
            public List<WorkflowActionNotePayload>? Notes { get; set; }
        }

        private class WorkflowActionNotePayload
        {
            public string? Note { get; set; }
            public string? PageNumber { get; set; }
            public string? SceneTime { get; set; }
            public string? Action { get; set; }
        }
        /// <summary>Support mailbox rendered into the {{support_email}} template variable.</summary>
        private const string SupportEmail = "info@nma.gov.ae";

        /// <summary>
        /// Workflow stores the reason as a TypeDictionary code ("1".."5"), so the raw value must be
        /// resolved to its display name before it reaches a template; otherwise the customer sees
        /// the bare id. Both names are returned because a notification renders its English and
        /// Arabic bodies into the same email from one variable set — the Arabic body reads the
        /// "_ar" variable. Falls back to the code when the dictionary has no matching entry.
        /// </summary>
        private async Task<(string NameEn, string NameAr)> ResolveReasonNamesAsync(string scope, string? reasonCode)
        {
            if (string.IsNullOrWhiteSpace(reasonCode)) return (string.Empty, string.Empty);

            var reasons = await _typeDictionaryService.GetListAsync(scope);
            var nameEn = ResolveReasonNames(reasons, scope, reasonCode, reason => reason.NameEn) ?? reasonCode;
            var nameAr = ResolveReasonNames(reasons, scope, reasonCode, reason => reason.NameAr);
            return (nameEn, string.IsNullOrWhiteSpace(nameAr) ? nameEn : nameAr);
        }

        private static string? ResolveReasonNames(
            IEnumerable<TypeDictionary> reasons,
            string scope,
            string? reasonCodes,
            Func<TypeDictionary, string?> nameSelector)
        {
            if (string.IsNullOrWhiteSpace(reasonCodes))
            {
                return null;
            }

            var names = reasonCodes
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(code => code.Trim())
                .Where(code => code.Length > 0)
                .Select(code => reasons.FirstOrDefault(reason => reason.Scope == scope && reason.Code == code))
                .Select(reason => reason == null ? null : nameSelector(reason))
                .Where(name => !string.IsNullOrWhiteSpace(name));

            var result = string.Join(", ", names!);
            return string.IsNullOrWhiteSpace(result) ? null : result;
        }

        private async Task SendApplicationRejectedAsync(int applicationId, string RejectReasonCode)
        {
            try
            {

                var baseCustomerUrl = _configuration.GetSection("TemplateServices:CustomerProtal").Value;

                // Group tasks by ApplicationId and get unique applications
                try
                {
                    // Get application details
                    var application = await _applicationService.GetByIdAsync(applicationId, "1");
                    if (application == null) return;

                    var applicationDetail = await _applicationService.GetApplicationDetailAsync(application.Id);
                    var service = application.Service ?? await serviceInfoDomainService.GetServiceByIdAsync(application.ServiceId);
                    var user = await _userService.GetAsync(application.UserId);
                    var reason = await ResolveReasonNamesAsync("RejectionReason", RejectReasonCode);

                    // Recipient resolution uses the current scoped DbContext, so await the SignalR enqueue.
                    _ = await sendTemplateService.GetSendTemplateForEstablishmentProfile(
                        "CP-015",
                        application.UserId,
                        application.ProfileId,
                        new List<TemplateVariable>
                        {
                            new() { Key = "customer_name", Value = user.UserName },
                            new() { Key = "application_number", Value = application.ApplicationNumber ?? "" },
                            new() { Key = "service_name", Value = service?.NameEn ?? "" },
                            new() { Key = "rejection_reason", Value = reason.NameEn },
                            new() { Key = "rejection_reason_ar", Value = reason.NameAr },
                            new() { Key = "track_link", Value = baseCustomerUrl + "/my-requests/detail?id=" + application.Id },
                            new() { Key = "new_application_link", Value = baseCustomerUrl + "/my-requests" },
                            new() { Key = "support_email", Value = SupportEmail }
                        },
                        user.Email);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error sending ApplicationRejected for application {applicationId}");
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendApplicationRejectedAsync");
            }
        }
        private async Task SendApplicationPaymentAsync(int applicationId)
        {
            try
            {

                var baseCustomerUrl = _configuration.GetSection("TemplateServices:CustomerProtal").Value;

                // Group tasks by ApplicationId and get unique applications
                try
                {
                    // Get application details
                    var application = await _applicationService.GetByIdAsync(applicationId, "1");
                    if (application == null) return;

                    var applicationDetail = await _applicationService.GetApplicationDetailAsync(application.Id);
                    var service = application.Service ?? await serviceInfoDomainService.GetServiceByIdAsync(application.ServiceId);
                    var user = await _userService.GetAsync(application.UserId);
                    var paymentAmount = await ResolveLatestFrozenPaymentAmountAsync(
                        _db.ServiceApplicationPayments,
                        application.Id);

                    // CustomerPortal freezes the authoritative fee quote in
                    // Payment.ServiceApplicationPayments when the application is submitted.
                    // Reusing that snapshot keeps the notification consistent with Pay Now and
                    // supports conditional/variable fees; recalculating from Lookup.ServiceFees
                    // here could produce a different amount. A paid approval must have a positive
                    // frozen amount, so do not send a misleading AED 0 notification when the
                    // payment snapshot is unexpectedly missing.
                    if (!paymentAmount.HasValue || paymentAmount.Value <= 0m)
                    {
                        _logger.LogError(
                            "CP-013 notification skipped because no positive frozen payment amount was found for ApplicationId {ApplicationId}, ApplicationNumber {ApplicationNumber}.",
                            application.Id,
                            application.ApplicationNumber);
                        return;
                    }

                    // Recipient resolution uses the current scoped DbContext, so await the SignalR enqueue.
                    _ = await sendTemplateService.GetSendTemplateForEstablishmentProfile(
                        "CP-013",
                        application.UserId,
                        application.ProfileId,
                        new List<TemplateVariable>
                        {
                            new() { Key = "customer_name", Value = user.UserName },
                            new() { Key = "application_number", Value = application.ApplicationNumber ?? "" },
                            new() { Key = "service_name", Value = service?.NameEn ?? "" },
                            new() { Key = "payment_amount", Value = paymentAmount.Value.ToString("0.##", CultureInfo.InvariantCulture) },
                            new() { Key = "payment_deadline", Value = DateTimeHelper.Now.AddDays(5).ToString("dd/MM/yyyy") },
                            new() { Key = "payment_link", Value = baseCustomerUrl + "/my-requests/detail?id=" + application.Id + (application.ProfileId > 0 ? "&profileId=" + application.ProfileId : "") },
                        },
                        user.Email);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error sending CP-013 payment notification for application {ApplicationId}", applicationId);
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendApplicationPaymentAsync for application {ApplicationId}", applicationId);
            }
        }

        /// <summary>
        /// Resolves the newest authoritative payment amount frozen for an application at submit time.
        /// </summary>
        /// <remarks>
        /// Multiple snapshots can exist after a draft is repriced or resubmitted. CreatedOn plus Id
        /// selects the newest deterministic row and the nullable projection distinguishes a missing
        /// snapshot from a legitimate zero-value free application.
        /// </remarks>
        internal static Task<decimal?> ResolveLatestFrozenPaymentAmountAsync(
            IQueryable<ServiceApplicationPayment> paymentOrders,
            int applicationId)
        {
            return paymentOrders
                .AsNoTracking()
                .Where(payment => payment.ApplicationId == applicationId)
                .OrderByDescending(payment => payment.CreatedOn)
                .ThenByDescending(payment => payment.Id)
                .Select(payment => (decimal?)payment.Amount)
                .FirstOrDefaultAsync();
        }

        private async Task SendApplicationModificationAsync(int applicationId, string RejectReasonCode)
        {
            try
            {

                var baseCustomerUrl = _configuration.GetSection("TemplateServices:CustomerProtal").Value;

                // Group tasks by ApplicationId and get unique applications
                try
                {
                    // Get application details
                    var application = await _applicationService.GetByIdAsync(applicationId, "1");
                    if (application == null) return;

                    var applicationDetail = await _applicationService.GetApplicationDetailAsync(application.Id);
                    var service = application.Service ?? await serviceInfoDomainService.GetServiceByIdAsync(application.ServiceId);
                    var user = await _userService.GetAsync(application.UserId);
                    var reason = await ResolveReasonNamesAsync("ModificationReason", RejectReasonCode);

                    // Recipient resolution uses the current scoped DbContext, so await the SignalR enqueue.
                    _ = await sendTemplateService.GetSendTemplateForEstablishmentProfile(
                        "CP-012",
                        application.UserId,
                        application.ProfileId,
                        new List<TemplateVariable>
                        {
                            new() { Key = "customer_name", Value = user.UserName },
                            new() { Key = "application_number", Value = application.ApplicationNumber ?? "" },
                            new() { Key = "service_name", Value = service?.NameEn ?? "" },
                            new() { Key = "modification_reason", Value = reason.NameEn },
                            new() { Key = "modification_reason_ar", Value = reason.NameAr },
                            new() { Key = "modify_link", Value = baseCustomerUrl + "/my-requests/detail?id=" + application.Id + (application.ProfileId > 0 ? "&profileId=" + application.ProfileId : "") },
                            new() { Key = "resubmit_deadline", Value = DateTimeHelper.Now.AddDays(5).ToString(DateTimeHelper.TemplateDateTimeFormat) }
                        },
                        user.Email);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error sending modification for application {applicationId}");
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendApplicationModificationAsync");
            }
        }
        private async Task<bool> LicensingApproveAsync(TaskActionDto req, WorkflowTransition? descriptor, ApplicationModel application, DeferredPostCommitActions? deferred = null)
        {
            var result = false;
            var approvalAction = (descriptor?.LegacyApprovalAction ?? string.Empty).ToLower();
            if (new[] { "approval", "rejected", "rejectedwithreview" }.Contains(approvalAction))
            {
                var status = await _camundaTaskApp.TaskActionAppAsync(req);
                if (status.IsNullOrEmpty())
                    throw new BusinessException("Workflow.TaskCompleteFailed", "");
                switch (status.ToLower())
                {
                    case "pending payment":
                        result = await FinalizeLicensingApprovedAsync(req.ApplicationId, deferred);
                        break;
                    case "rejected":
                        result = await _applicationService.LicensingApproveAsync(req.ApplicationId, 106);
                        // Licensing reject is terminal. Licensing has no other writeback channel to
                        // CustomerPortal, so signal the reject here (reusing the reject-writeback
                        // endpoint) so a lifecycle child (renew/modify/cancel/partner) releases its
                        // parent projection's HasInProgressApplication lock. Deferred to post-commit
                        // to avoid the shared-DB Application row-lock deadlock (see
                        // DeferredPostCommitActions); legacy callers with no collector fall back to
                        // the inline call. CPS no-ops the materialization for licensing services and
                        // only clears the projection flag.
                        if (result && !string.IsNullOrWhiteSpace(application?.ApplicationNumber))
                        {
                            if (deferred != null)
                            {
                                deferred.ContentRejectionWritebackApplicationNumber = application.ApplicationNumber;
                                deferred.ContentRejectionWritebackApplicationId = application.Id;
                            }
                            else
                            {
                                await TryRecordContentBookRejectionAsync(application);
                            }
                        }
                        break;
                    default:
                        result = !status.IsNullOrEmpty();
                        break;
                }
            }
            else if (approvalAction == "modification")
            {
                var workFlowId = await _camundaTaskApp.TaskRejectionInitiatorAsyncApp(req);
                if (workFlowId.IsNullOrEmpty())
                    throw new BusinessException("Approve Error");
                result = await _applicationService.LicensingApproveAsync(req.ApplicationId, 104, workFlowId);
                // workFlowId is the NEW process instance created by Request Modification; resolve
                // its new task's id and surface it as NextTaskId so the client leaves the old task.
                await SetModificationNextTaskIdAsync(workFlowId);
            }

            return result;
        }

        private async Task<bool> ContentApproveAsync(TaskActionDto req, WorkflowTransition? descriptor, ApplicationModel application, DeferredPostCommitActions? deferred = null)
        {
            var result = false;
            var approvalAction = (descriptor?.LegacyApprovalAction ?? string.Empty).ToLower();
            if (new[] { "approval", "rejected", "rejectedwithreview" }.Contains(approvalAction))
            {
                var status = await _camundaTaskApp.TaskActionAppAsync(req);
                if (status.IsNullOrEmpty())
                {
                    if (approvalAction == "approval")
                    {
                        var recovered = await TryRecoverStaleContentCompletionAsync(req, application, deferred);
                        if (recovered)
                        {
                            return true;
                        }
                    }

                    throw new BusinessException("Workflow.TaskCompleteFailed", "");
                }
                switch (status.ToLower())
                {
                    case "pending payment":
                        result = await FinalizeContentApprovedAsync(application, req.InstanceId, deferred);
                        break;
                    case "rejected":
                        result = await _applicationService.ContentApproveAsync(req.ApplicationId, 106, _currentUserService.UserId, _currentUserService.Email);
                        // Record the book as Rejected (Book.IsApproved=0) in CustomerPortal's content
                        // library so a gray (review-required) ISBN becomes red. Best-effort; the
                        // CustomerPortal endpoint no-ops for non-204 services.
                        //
                        // Defer this cross-service writeback to AFTER the admin reject tx commits.
                        // Calling it inline here — while this tx still holds the Application row lock
                        // on the shared DB (umc_data_test) — deadlocked against the writeback's own
                        // read of that row, stalling the reject ~30s until both timeouts fired. When
                        // a post-commit collector is available it is scheduled there; legacy callers
                        // with no collector fall back to the original inline call.
                        if (result && !string.IsNullOrWhiteSpace(application?.ApplicationNumber))
                        {
                            if (deferred != null)
                            {
                                deferred.ContentRejectionWritebackApplicationNumber = application.ApplicationNumber;
                                deferred.ContentRejectionWritebackApplicationId = application.Id;
                            }
                            else
                            {
                                await TryRecordContentBookRejectionAsync(application);
                            }
                        }
                        break;
                    default:
                        result = !status.IsNullOrEmpty();
                        break;
                }
            }
            else if (approvalAction == "modification")
            {
                var workFlowId = await _camundaTaskApp.TaskRejectionInitiatorAsyncApp(req);
                if (workFlowId.IsNullOrEmpty())
                    throw new BusinessException("Approve Error");
                result = await _applicationService.LicensingApproveAsync(req.ApplicationId, 104, workFlowId);
                // workFlowId is the NEW process instance created by Request Modification; resolve
                // its new task's id and surface it as NextTaskId so the client leaves the old task.
                await SetModificationNextTaskIdAsync(workFlowId);
            }

            return result;
        }

        // Best-effort: tell CustomerPortal to record this content application's book as Rejected
        // (Book.IsApproved=0). CustomerPortal owns the content-library write and no-ops for non-204.
        private async Task TryRecordContentBookRejectionAsync(ApplicationModel application)
        {
            try
            {
                if (application == null || string.IsNullOrWhiteSpace(application.ApplicationNumber))
                {
                    return;
                }

                await _customerPortalInternalApiClient.ApplyContentRejectionWriteBackAsync(
                    new CustomerPortalContentApprovalWriteBackRequest
                    {
                        ApplicationNumber = application.ApplicationNumber,
                        // Unambiguous id so CustomerPortal resolves the exact application, not a shared-number sibling.
                        ApplicationId = application.Id
                    });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Content book rejection writeback failed for ApplicationId {ApplicationId}, ApplicationNumber {ApplicationNumber}.",
                    application?.Id,
                    application?.ApplicationNumber);
            }
        }

        private async Task<bool> TryRecoverStaleContentCompletionAsync(
            TaskActionDto req,
            ApplicationModel application,
            DeferredPostCommitActions? deferred)
        {
            var localProcessInstance = await _camundaWorkflowDomainService.GetProcessInstanceByIdAsync(req.InstanceId);
            if (localProcessInstance?.StatusId != (int)ApprovalNodeOrder.FinalApproval)
            {
                return false;
            }

            var activeExternalTasks = await _camundaTaskApp.AppGetCamundaTaskByInstanceId(req.InstanceId);
            if (activeExternalTasks.Count > 0)
            {
                _logger.LogWarning(
                    "Content approval retry did not recover ApplicationId {ApplicationId}. Local process is at Final Approval, but Camunda still has {ActiveTaskCount} active task(s) for InstanceId {InstanceId}.",
                    req.ApplicationId,
                    activeExternalTasks.Count,
                    req.InstanceId);
                return false;
            }

            var localTask = await _camundaWorkflowDomainService.GetCamundaTaskByIdAsync(req.TaskId);
            if (localTask != null && !IsCompletedTaskStatus(localTask.StatusId))
            {
                localTask.StatusId = (int)ApprovalNodeOrder.Approved;
                localTask.ApprovalAt ??= DateTimeHelper.Now;
                await _camundaWorkflowDomainService.UpdateCamundaTask(localTask);
            }

            _logger.LogWarning(
                "Recovering stale content approval completion for ApplicationId {ApplicationId}, InstanceId {InstanceId}. Previous synchronous certificate issuance likely completed Camunda remotely but rolled back Admin before final status persistence.",
                req.ApplicationId,
                req.InstanceId);

            return await FinalizeContentApprovedAsync(application, req.InstanceId, deferred);
        }

        // Shared "Approve finishing" hook for the Licensing Department. Used by both the
        // direct approve path (LicensingApproveAsync) and the disposition Approve verification
        // path (SettleAfterDispositionVerificationAsync).
        //
        // Normal (paid) path: app moves to 103 (Pending Payment) and we send the customer a
        // payment-due notification. Both writes are admin-local, safe inside the admin tx.
        //
        // Free path (fee=0): CustomerPortal Submit creates a Payment row with Amount=0 and
        // Status=Completed but intentionally keeps the application at 102 (UnderReview) so
        // admin approval can gate license issuance. Once approval succeeds here, we ask
        // CustomerPortal to drive its standard Licensing success path (status=105 +
        // certificate generation) via the dedicated internal endpoint — there is nothing to
        // pay, so no payment notification is sent.
        //
        // CRITICAL — Cross-service write ordering:
        // The CustomerPortal writeback is an HTTP call that crosses the admin transaction
        // boundary. Running it inline would let a successful customer-side write survive an
        // admin rollback, leaving customer=Completed while the admin Camunda task is still
        // open (see ML-2-8007-0588538). When a `deferred` collector is provided (V2 +
        // disposition paths) the caller defers the writeback until after CommitAsync. If
        // `deferred` is null (legacy V1 ApproveAsync without an outer tx), we fall back to
        // inline writeback to preserve previous behavior.
        /// <summary>
        /// The system-approval counterpart of the reviewer's Approve action for a licensing application.
        ///
        /// Two things are worth spelling out, because both look like omissions:
        ///
        /// <b>The customer-portal ApplicationExt.ProcessInstanceId is written here.</b> The payment
        /// write-back reads that column to find the process instance it must close out, and throws
        /// "Application Data not found" when it is empty. An interactive submission fills it when the
        /// workflow starts; an auto-approved one never starts a workflow, so without this write the
        /// customer would pay and the application would fail to complete.
        ///
        /// The payment order is resolved from <c>ServiceLookupMappings.ProcessId</c>, matching the
        /// manual approval path: 1 means approve first and stop at Pending Payment; 2 means payment
        /// already happened and approval completes the application immediately.
        /// </summary>
        public async Task<string> AutoApproveLicensingApplicationAsync(
            int applicationId,
            short serviceId,
            CancellationToken cancellationToken = default)
        {
            var application = await _db.Applications
                .AsNoTracking()
                .Where(x => x.Id == applicationId && !x.IsDelete)
                .Select(x => new { x.Id, x.ServiceId, x.ServiceCode })
                .FirstOrDefaultAsync(cancellationToken);

            if (application == null)
            {
                throw new BusinessException("Application not found.", "");
            }

            if (application.ServiceId != serviceId)
            {
                throw new BusinessException("The requested service does not match the application service.", "");
            }

            var applicationDetail = await _applicationService.GetApplicationDetailAsync(applicationId);
            if (applicationDetail == null)
            {
                throw new BusinessException("Application detail not found.", "");
            }

            // Idempotent: the caller retries on a transient failure, and a replay must not write a second
            // process instance or re-send the payment notification. 102 (Under Review) is the only state an
            // auto-approval may act on - anything further along has already been decided.
            if (applicationDetail.ApplicationStatusId != 102)
            {
                _logger.LogInformation(
                    "AutoApproveLicensingApplicationAsync skipped; application {ApplicationId} is at status {StatusId}, not Under Review.",
                    applicationId, applicationDetail.ApplicationStatusId);
                return string.Empty;
            }

            var processId = await _db.ServiceLookupMappings
                .AsNoTracking()
                .Where(x => x.ServiceCode == application.ServiceCode)
                .Select(x => x.ProcessId)
                .FirstOrDefaultAsync(cancellationToken);
            if (processId is not 1 and not 2)
            {
                _logger.LogError(
                    "AutoApproveLicensingApplicationAsync cannot resolve payment flow. ApplicationId {ApplicationId}, ServiceId {ServiceId}, ServiceCode {ServiceCode}, ProcessId {ProcessId}.",
                    applicationId, serviceId, application.ServiceCode, processId);
                throw new BusinessException(
                    $"Payment flow is not configured for service {application.ServiceCode}.", "");
            }

            var processInstanceId = await _camundaTaskApp.CreateLicensingAutoApprovalTraceAsync(
                applicationId,
                applicationDetail.Id,
                serviceId,
                ResolveLicensingAutoApprovalProcessStatus(processId.Value),
                cancellationToken);

            await AttachProcessInstanceAsync(applicationId, processInstanceId, cancellationToken);

            bool approved;
            if (processId == 1)
            {
                // Approve-first: 103 + PendingPaymentAt + CP-013, or the existing free-fee writeback.
                approved = await FinalizeLicensingApprovedAsync(applicationId);
            }
            else
            {
                // Pay-first: payment is already complete, so use the same 105 + issuance finisher as
                // the manual PaymentFlowKind.PayFirst approval route.
                var applicationModel = await _applicationService.GetByIdAsync(
                    applicationId,
                    ((int)DepartmentEnum.Licensing).ToString());
                if (applicationModel == null)
                {
                    throw new BusinessException("Application data not found", "");
                }

                approved = await FinalizeContentApprovedAsync(applicationModel, processInstanceId);
            }

            if (!approved)
            {
                throw new BusinessException("Licensing auto-approval could not advance the application.", "");
            }

            _logger.LogInformation(
                "Auto-approved licensing application {ApplicationId} (service {ServiceId}, service code {ServiceCode}, process {ProcessId}); instance {ProcessInstanceId}, process status {ProcessStatusId}.",
                applicationId, serviceId, application.ServiceCode, processId, processInstanceId,
                ResolveLicensingAutoApprovalProcessStatus(processId.Value));

            return processInstanceId;
        }

        internal static int ResolveLicensingAutoApprovalProcessStatus(short processId) => processId switch
        {
            1 => (int)ApprovalNodeOrder.PendingPayment,
            2 => (int)ApprovalNodeOrder.Completed,
            _ => throw new ArgumentOutOfRangeException(nameof(processId), processId, "Unsupported payment flow process id.")
        };

        /// <summary>
        /// Points the application's extension row at the fabricated process instance, creating the row when
        /// an auto-created application never had one.
        /// </summary>
        private async Task AttachProcessInstanceAsync(
            int applicationId,
            string processInstanceId,
            CancellationToken cancellationToken)
        {
            var extension = await _db.ApplicationsExts
                .FirstOrDefaultAsync(x => x.ApplicationId == applicationId, cancellationToken);

            if (extension == null)
            {
                extension = new ApplicationExtModel
                {
                    ApplicationId = applicationId,
                    CreatedOn = DateTimeHelper.Now
                };
                _db.ApplicationsExts.Add(extension);
            }

            extension.ProcessInstanceId = processInstanceId;
            await _db.SaveChangesAsync(cancellationToken);
        }

        private async Task<bool> FinalizeLicensingApprovedAsync(int applicationId, DeferredPostCommitActions? deferred = null)
        {
            // ServiceApplicationPayment.Status uses CustomerPortal's ServiceApplicationPaymentStatus
            // values: 1=Pending, 2=InProgress, 3=Completed, 4=Failed, 5=Cancelled. AdminPortal does
            // not own the enum, so the literal 3 is intentional here and stays in sync with the
            // CustomerPortal Domain.Share.Enums.ServiceApplicationPaymentStatus.Completed contract.
            const short ServiceApplicationPaymentStatus_Completed = 3;
            var freePaymentExists = await _db.ServiceApplicationPayments
                .AsNoTracking()
                .AnyAsync(p =>
                    p.ApplicationId == applicationId
                    && p.Amount == 0m
                    && p.Status == ServiceApplicationPaymentStatus_Completed);

            if (freePaymentExists)
            {
                var application = await _applicationService.GetByIdAsync(applicationId, "1");
                var applicationNumber = application?.ApplicationNumber;
                if (string.IsNullOrWhiteSpace(applicationNumber))
                {
                    throw new BusinessException(
                        $"FinalizeLicensingApprovedAsync: missing ApplicationNumber for ApplicationId {applicationId}.");
                }

                if (deferred != null)
                {
                    deferred.FreeLicensingWritebackApplicationNumber = applicationNumber;
                    deferred.FreeLicensingWritebackApplicationId = applicationId;
                }
                else
                {
                    await _customerPortalInternalApiClient.CompleteLicensingFreePaymentAsync(
                        new CustomerPortalLicensingFreePaymentApprovalRequest
                        {
                            ApplicationNumber = applicationNumber
                        });
                }

                return true;
            }

            var result = await _applicationService.LicensingApproveAsync(applicationId, 103);
            if (result)
            {
                // ApproveV2 owns the outer transaction, so status 103 and PendingPaymentAt commit
                // together. Re-approval after Recall preserves the original window and success flag.
                await ApplicationOperationStateWriter.RecordPendingPaymentAsync(
                    _db,
                    applicationId,
                    DateTimeOffset.UtcNow);
            }
            await SendApplicationPaymentAsync(applicationId);
            return result;
        }

        // Shared "Approve finishing" hook for the Content Department. Sets the Camunda
        // process instance to Completed, persists app status 105, and queues the certificate
        // issuance helper. The legacy "pending payment" name on the originating branch is a
        // misnomer — see ContentApproveAsync's note for the full history. Used by both the
        // direct approve path and the disposition Approve verification path.
        private async Task<bool> FinalizeContentApprovedAsync(
            ApplicationModel application,
            string processInstanceId,
            DeferredPostCommitActions? deferred = null)
        {
            // Capture the CURRENT persisted ApplicationDetail status BEFORE moving it to 105, so the
            // certificate-issuance duplicate guard (skip when the app was already 105) fires reliably
            // on repeated approval events. The in-memory application.ApplicationDetail navigation can
            // be unloaded (null) or stale here; a null previous status silently disables that guard
            // and lets a second approval re-trigger GenerateCertificate, which then fails because the
            // application is no longer in the issuable 105 state (CustomerPortal returns false).
            var currentDetail = await _applicationService.GetApplicationDetailAsync(application.Id);
            var previousApplicationStatusId = currentDetail?.ApplicationStatusId
                ?? application.ApplicationDetail?.ApplicationStatusId;

            // Persist the authoritative ApplicationDetail.ApplicationStatusId (105) FIRST.
            // The customer portal reads this field; if we updated processInstance.Status
            // ("Completed") before this and the inner write failed (legacy early-return
            // paths in ContentApproveAsync), the admin would show "Completed" while the
            // customer still saw "Under Review".
            var result = await _applicationService.ContentApproveAsync(application.Id, 105, _currentUserService.UserId, _currentUserService.Email);
            if (!result) return false;

            var processInstance = await _camundaWorkflowDomainService.GetProcessInstanceByIdAsync(processInstanceId);
            if (processInstance != null)
            {
                processInstance.StatusId = (int)ApprovalNodeOrder.Completed;
                await _camundaWorkflowDomainService.UpdataCaumundaProcessInstanceAsync(processInstance);
            }

            if (deferred != null)
            {
                // ApproveV2 owns an outer transaction. Capture the issuance request here and queue it
                // from RunDeferredPostCommitActionsAsync, after ApplicationStatusId=105 is observable
                // to CustomerPortal's independent connection.
                deferred.ContentApprovalIssuanceApplicationId = application.Id;
                deferred.ContentApprovalPreviousApplicationStatusId = previousApplicationStatusId;
                deferred.ContentApprovalIssuanceHookName = "ContentApproveAsync-post-commit";
                }
            else
            {
                // Legacy callers without an outer transaction have no commit boundary to defer across.
                await _contentDepartmentCertificateIssuanceService.GenerateInternalCertificateAsync(
                    application.Id,
                    previousApplicationStatusId,
                    "ContentApproveAsync-manual");
                    }
            return true;
        }

        // Disabled — disposition verification now settles inline in
        // DispositionCaseAppService.CompleteVerifiedAsync (drives FinalStatusId
        // directly from SourceWorkflowActionCode 1/101). Kept commented for now
        // in case the BPMN-mid-flow customer-portal sync logic needs to be revived.
        /*
        public async Task<DispositionSettlementResult> SettleAfterDispositionVerificationAsync(
            int applicationId,
            string processInstanceId,
            int sourceWorkflowActionCode,
            CancellationToken cancellationToken = default)
        {
            // Derive Reject vs Approve from the originating workflow transition.
            // The synthetic cert-issuance code never reaches here (its DispositionCase is
            // settled inline via the CompleteVerifiedAsync branch in DispositionCaseAppService).
            var sourceTransition = _workflowTransitionRegistry.GetByActionCode(sourceWorkflowActionCode);
            if (sourceTransition.Type == WorkflowActionType.Reject)
            {
                return await FinalizeRejectAfterDispositionAsync(applicationId, processInstanceId, cancellationToken);
            }

            // Approve path: disposition was a precondition on top of an approval. Now that
            // the customer has cleared materials, the application resumes its natural
            // workflow path.
            return await ResumeAfterApproveDispositionAsync(applicationId, processInstanceId, cancellationToken);
        }

        private async Task<DispositionSettlementResult> FinalizeRejectAfterDispositionAsync(int applicationId, string processInstanceId, CancellationToken cancellationToken)
        {
            const string finalProcessStatus = "Rejected (Disposition Verified)";
            // process.StatusId was frozen at Rejected when the reject decision opened the
            // disposition phase; the verification outcome (Verified) lives on DispositionCase.
            const int finalProcessStatusId = (int)ApprovalNodeOrder.Rejected;
            const int finalProcessDispositionStatusId = (int)DispositionVerificationStatus.Verified;

            // Disposition only applies to service 302 (Content). Mark the application Rejected
            // through the Content-specific path (touches content-library status / history).
            await _applicationService.ContentApproveAsync(applicationId, 106, _currentUserService.UserId, _currentUserService.Email);

            // Spec §4.4.3: the customer is notified of the rejection only here, after
            // the disposition subflow settles. ApproveAsync's terminal-reject branch is
            // gated off the disposition path, so this is the sole point at which the
            // rejection notification fires for the disposition path. Reuse the reason
            // captured on the originating ApprovalRecord (linked via
            // DispositionCase.SourceApprovalRecordId) so the customer sees the same
            // wording the admin gave when first rejecting with disposition.
            var rejectReasonCode = await _db.DispositionCases
                .Where(c => c.ApplicationId == applicationId
                            && c.ProcessInstanceId == processInstanceId
                            && c.SourceApprovalRecordId != null)
                .OrderByDescending(c => c.Id)
                .Join(_db.ApprovalRecords,
                    c => c.SourceApprovalRecordId,
                    r => r.Id,
                    (c, r) => r.RejectReasonCode)
                .FirstOrDefaultAsync(cancellationToken);
            await SendApplicationRejectedAsync(applicationId, rejectReasonCode ?? string.Empty);

            // AdminStatusId/CustomerStatusId carry the terminal ApplicationStatus
            // (consumed by DispositionCase.FinalStatusId), not the Camunda ApprovalNodeOrder.
            return new DispositionSettlementResult
            {
                Success = true,
                AdminStatus = finalProcessStatus,
                CustomerStatus = finalProcessStatus,
                ProcessInstanceStatus = finalProcessStatus,
                ApplicationStatus = "Rejected",
                ProcessEnded = true,
                StatusId = (int)ApplicationStatus.Rejected,
                DispositionStatusId = finalProcessDispositionStatusId
            };
        }

        private async Task<DispositionSettlementResult> ResumeAfterApproveDispositionAsync(int applicationId, string processInstanceId, CancellationToken cancellationToken)
        {
            // Disposition is service-302/Content only; the BPMN ended at PendingDisposition
            // entry with process.StatusId = Completed + EndTime set, so there is no pending
            // downstream node to resume. Fall straight through to the Content-specific
            // success hook (105 + certificate issuance).
            var application = await LoadApplicationForFinalizeAsync(applicationId, cancellationToken);
            if (application == null)
            {
                throw new BusinessException("Application data not found");
            }

            await FinalizeContentApprovedAsync(application, processInstanceId);

            const string contentFinalStatus = "Completed (Disposition Verified)";
            const int contentFinalDispositionStatusId = (int)DispositionVerificationStatus.Verified;
            // StatusId carries the terminal ApplicationStatus (consumed by
            // DispositionCase.FinalStatusId), not the Camunda ApprovalNodeOrder.
            return new DispositionSettlementResult
            {
                Success = true,
                AdminStatus = contentFinalStatus,
                CustomerStatus = contentFinalStatus,
                ProcessInstanceStatus = contentFinalStatus,
                ApplicationStatus = "Completed",
                ProcessEnded = true,
                StatusId = (int)ApplicationStatus.Completed,
                DispositionStatusId = contentFinalDispositionStatusId
            };
        }
        */

        private async Task<ApplicationModel?> LoadApplicationForFinalizeAsync(int applicationId, CancellationToken cancellationToken)
        {
            // GetByIdAsync(id, departmentId) is department-scoped; for the disposition path we
            // don't have a known departmentId from the request, so resolve it ourselves first.
            var departmentId = await _db.Applications
                .Where(a => a.Id == applicationId)
                .Join(_db.ServiceConfigs, a => a.ServiceId, s => s.Id, (a, s) => s.Department)
                .FirstOrDefaultAsync(cancellationToken);

            return await _applicationService.GetByIdAsync(applicationId, departmentId.ToString());
        }

        private async Task<string> GetApplicationDepartmentNameAsync(int applicationId, CancellationToken cancellationToken)
        {
            var name = await (from app in _db.Applications
                              join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                              join dept in _db.Departments on svc.Department equals dept.Id
                              where app.Id == applicationId
                              select dept.NameEn).FirstOrDefaultAsync(cancellationToken);
            return name ?? string.Empty;
        }

        /// <summary>
        /// Replace TypeOfPublication values in the raw FormData JSON string with the
        /// corresponding <c>[Lookup].[PrintedType].NameEn</c> when the value matches a known Code.
        /// Uses targeted regex substitution so every other byte of the original JSON is preserved.
        /// Handles both normal JSON (<c>"TypeOfPublication":"BK"</c>) and values that appear
        /// inside escaped-JSON strings (<c>\"TypeOfPublication\":\"BK\"</c>).
        /// </summary>
        private async Task<string?> ResolveTypeOfPublicationInFormDataAsync(string? formData)
        {
            if (string.IsNullOrWhiteSpace(formData))
                return formData;

            try
            {
                var rows = await _db.PrintedTypes
                    .AsNoTracking()
                    .Where(p => p.Code != null)
                    .Select(p => new { p.Code, p.NameEn })
                    .ToListAsync();

                if (rows.Count == 0)
                    return formData;

                var codeMap = rows
                    .Where(r => !string.IsNullOrEmpty(r.Code))
                    .ToDictionary(r => r.Code!, r => r.NameEn, StringComparer.OrdinalIgnoreCase);

                MatchEvaluator evaluator = m =>
                {
                    var code = m.Groups["val"].Value;
                    return codeMap.TryGetValue(code, out var nameEn)
                        ? m.Groups["pre"].Value + nameEn + m.Groups["suf"].Value
                        : m.Value;
                };

                // Pass 1 — normal JSON:  "TypeOfPublication":"BK"
                formData = Regex.Replace(
                    formData,
                    "(?<pre>\"(?:TypeOfPublication|TypeofPublication|typeOfPublication)\"\\s*:\\s*\")(?<val>[^\"\\\\]*)(?<suf>\")",
                    evaluator,
                    RegexOptions.IgnoreCase);

                // Pass 2 — escaped JSON inside a string value:  \"TypeOfPublication\":\"BK\"
                formData = Regex.Replace(
                    formData,
                    "(?<pre>\\\\\"(?:TypeOfPublication|TypeofPublication|typeOfPublication)\\\\\"\\s*:\\s*\\\\\")(?<val>[^\\\\\"]*)(?<suf>\\\\\")",
                    evaluator,
                    RegexOptions.IgnoreCase);

                return formData;
            }
            catch
            {
                // Any unexpected error — return the original unchanged
                return formData;
            }
        }

        // The content-AI provider persists both languages in the same AIRawResponseJson blob:
        // every Material's RawResponse carries an English body under "data" and an Arabic body under
        // "ar_data". The frontend only ever reads RawResponse.data, so for Arabic viewers we copy
        // each ar_data over its sibling data (dropping ar_data afterwards to avoid a double payload).
        // Any parse/shape surprise falls back to the untouched blob so English is never broken.
        private static string? ProjectAiRawResponseForArabic(string? rawJson)
        {
        if (string.IsNullOrWhiteSpace(rawJson))
            return rawJson;

        try
        {
            var root = Newtonsoft.Json.Linq.JToken.Parse(rawJson);
            var materials = root["Materials"] as Newtonsoft.Json.Linq.JArray;
            if (materials == null || materials.Count == 0)
            return rawJson;

            var projectedAny = false;
            foreach (var material in materials)
            {
            if (material["RawResponse"] is not Newtonsoft.Json.Linq.JObject rawResponse)
                continue;

            var arData = rawResponse["ar_data"];
            if (arData == null || arData.Type == Newtonsoft.Json.Linq.JTokenType.Null)
                continue;

            rawResponse["data"] = arData.DeepClone();
            rawResponse.Remove("ar_data");
            projectedAny = true;
            }

            return projectedAny ? root.ToString(Newtonsoft.Json.Formatting.None) : rawJson;
        }
        catch
        {
            // Malformed or unexpected shape — never break the English payload.
            return rawJson;
        }
        }

        private async Task<int> GetApplicationDepartmentIdAsync(int applicationId, CancellationToken cancellationToken)
        {
        return (int)await (from app in _db.Applications
                               join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                               where app.Id == applicationId
                               select svc.Department).FirstOrDefaultAsync(cancellationToken);
        }

        // Service 302 + economic activity 2052 (book content) is the sole disposition
        // trigger: any approve or reject decision on such an application opens the
        // disposition phase automatically (no separate ApproveWithDisposition button).
        private async Task<bool> IsDispositionTargetAsync(int applicationId, int serviceId, CancellationToken cancellationToken)
        {
            if (serviceId <= 0 || applicationId <= 0) return false;
            var serviceCode = await _db.ServiceConfigs
                .AsNoTracking()
                .Where(x => x.Id == serviceId)
                .Select(x => x.Code)
                .FirstOrDefaultAsync(cancellationToken);
            if (!PostCertificateDispositionPolicy.IsTargetService(serviceCode)) return false;

            var applicationDetailId = await _db.ApplicationDetails
                .AsNoTracking()
                .Where(x => x.ApplicationId == applicationId)
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (!applicationDetailId.HasValue) return false;

            var formData = await _db.ApplicationDetailsExts
                .AsNoTracking()
                .Where(x => x.ApplicationDetailId == applicationDetailId.Value)
                .Select(x => x.FormData)
                .FirstOrDefaultAsync(cancellationToken);
            return PostCertificateDispositionPolicy.HasEconomicActivity2052(formData);
        }

        // DispositionCase is the source of truth for the disposition verification id —
        // CamundaProcessInstance carries only the main approval status. Returns null
        // when no case exists for this process. FinalDispositionStatusId alone
        // disambiguates PendingDisposition / DispositionVerification / Verified / NotVerified.
        private async Task<int?> GetLatestDispositionStatusAsync(string? processInstanceId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(processInstanceId)) return null;
            return await _db.DispositionCases
                .AsNoTracking()
                .Where(x => x.ProcessInstanceId == processInstanceId)
                .OrderByDescending(x => x.Id)
                .Select(x => x.FinalDispositionStatusId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        // Batched form of GetLatestDispositionStatusAsync: latest DispositionCase status per
        // process instance, so a list of rows resolves disposition status in one query instead
        // of one per row.
        private async Task<Dictionary<string, int?>> GetLatestDispositionStatusMapAsync(IEnumerable<string?> processInstanceIds)
        {
            var ids = processInstanceIds
                .Where(a => !string.IsNullOrWhiteSpace(a))
                .Distinct()
                .ToArray();
            if (ids.Length == 0)
                return new Dictionary<string, int?>();
            return (await _db.DispositionCases
                .AsNoTracking()
                .Where(x => ids.Contains(x.ProcessInstanceId))
                .Select(x => new { x.ProcessInstanceId, x.Id, x.FinalDispositionStatusId })
                .ToListAsync())
                .GroupBy(x => x.ProcessInstanceId!)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First().FinalDispositionStatusId);
        }

        // Latest timeline timestamp per application: the most recent ApprovalRecord.ApprovalDate,
        // mirroring how the detail timeline orders rows by ApprovalTime descending.
        private async Task<Dictionary<int, DateTime?>> GetLastTimelineTimeMapAsync(IEnumerable<int> applicationIds)
        {
            var ids = applicationIds.Distinct().ToArray();
            if (ids.Length == 0)
                return new Dictionary<int, DateTime?>();
            return (await _db.ApprovalRecords
                .AsNoTracking()
                .Where(a => ids.Contains(a.ApplicationId))
                .GroupBy(a => a.ApplicationId)
                .Select(g => new { ApplicationId = g.Key, LastTime = g.Max(a => a.ApprovalDate) })
                .ToListAsync())
                .ToDictionary(a => a.ApplicationId, a => a.LastTime);
        }

        private static bool IsContentDepartment(int departmentId)
        {
            return departmentId == (int)DepartmentEnum.Content;
        }

        private async Task<string?> ResolveSelfMonitorAssigneeIdAsync(CancellationToken cancellationToken = default)
        {
            var contentDepartmentId = (int)DepartmentEnum.Content;
            var roles = await _queryableContext.GetQueryable<Role>()
                .AsNoTracking()
                .Where(role => role.Status != "-1")
                .ToListAsync(cancellationToken);
            var roleIds = roles
                .Where(SelfMonitorSystemRole.IsSelfMonitorRole)
                .Select(role => role.Id)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (roleIds.Count == 0)
            {
                return null;
            }

            var roleUserIds = await _queryableContext.GetQueryable<UserRole>()
                .AsNoTracking()
                .Where(userRole => roleIds.Contains(userRole.RoleId))
                .Select(userRole => userRole.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);
            if (roleUserIds.Count == 0)
            {
                return null;
            }

            var contentUserIds = await _queryableContext.GetQueryable<UserDepartmentModel>()
                .AsNoTracking()
                .Where(department => department.DepartmentId == contentDepartmentId
                                     && roleUserIds.Contains(department.UserId))
                .Select(department => department.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            return await _queryableContext.GetQueryable<AdminUser>()
                .AsNoTracking()
                .Where(user => contentUserIds.Contains(user.Id)
                               && user.IsActive
                               && (user.Status == null || user.Status == AdminUser.ActiveStatusCode))
                .OrderBy(user => user.CreatedOn)
                .Select(user => user.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        #endregion

        public async Task<MyTeamReviewResponse> GetMyTeamReviewPageAsync(MyTeamReviewPageRequest req, int status, string departmentId)
        {
            var result = new MyTeamReviewResponse();

            var list = await GetMyTeamReviewListAsync(departmentId);

            // De-duplicate by Id with a HashSet, keeping first occurrence and order
            // (was O(n^2): a List.Any scan per item).
            var todoList = ReviewTaskProjection.SelectTeamTodo(
                list,
                IsCompletedReviewItem,
                IsExternalApprovalItem);

            var newCompletedList = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem);
            var completedList = newCompletedList;

            result.StatusCount = new ReviewStatusCount()
            {
                TodoCount = todoList.Count(),
                PendingReviewCount = todoList.Count(a => a.StatusId != (int)ApprovalNodeOrder.PendingModification && a.StatusId != (int)ApprovalNodeOrder.ExternalApproval),
                PendingModificationCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.PendingModification),
                ExternalApproveCount = todoList.Count(a => a.StatusId == (int)ApprovalNodeOrder.ExternalApproval),
                CompletedCount = newCompletedList.Count(),
            };

            switch (status)
            {
                case 1:
                    list = todoList;
                    break;
                case 2:
                    list = newCompletedList;
                    break;
                default:
                    list = ReviewTaskProjection.SelectTeamAll(
                        list,
                        IsCompletedReviewItem,
                        IsExternalApprovalItem);
                    break;
            }

            result.ProcessInstanceStatus = list.Select(a => a.Status).Distinct().OrderBy(a => a).ToArray();
            result.ApprovalStatus = list.Select(a => a.TaskStatus).Distinct().OrderBy(a => a).ToArray();

            // Shared with ExportMyTeamReviewAsync so the CSV always matches the visible page.
            var query = MyTeamReviewFilter.Apply(list.AsQueryable(), req);

            list = ApplyMyTeamReviewSort(query, req).ToList();
            var pageData = list
                .Skip((req.PageIndex - 1) * req.PageSize)
                .Take(req.PageSize)
                .ToList();

            pageData.ForEach(a =>
            {
                if (a.StatusId == (int)ApprovalNodeOrder.Cancelled)
                    a.TaskStatus = "-";
            });

            await SuppressCompletedExternalApprovalButtonsAsync(pageData);

            result.Page = new PageResponse<MyTeamReviewPageResponse>(pageData, list.Count, req.PageIndex, req.PageSize);

            return result;
        }

        public async Task<List<MyTeamMemberTaskResponse>> GetMyTeamMemberTaskAsync(MyTeamMemberTaskRequest req, string departmentId)
        {
            var result = new List<MyTeamMemberTaskResponse>();

            var teamMemberList = await GetMyTeamMembersAsync(false);
            var query = teamMemberList.AsQueryable();
            if (!req.Keyword.IsNullOrEmpty())
            {
                req.Keyword = req.Keyword.ToLower();
                query = query.Where(a => a.UserName.ToLower().Contains(req.Keyword));
            }
            if (!req.MemberId.IsNullOrEmpty())
                query = query.Where(a => a.UserId == req.MemberId || (a.IsSelfMonitor && req.MemberId == SelfMonitorSystemRole.MemberFilterId));
            teamMemberList = query.ToList();
            if (teamMemberList.Count == 0)
                return result;

            var list = await GetMyTeamReviewListAsync(departmentId);
            list = ReviewTaskProjection.SelectTeamAll(
                list,
                IsCompletedReviewItem,
                IsExternalApprovalItem);

            var assigneeUserIds = teamMemberList.Where(a => !a.IsSelfMonitor).Select(a => a.UserId).ToArray();
            var leaveLogList = await _userService.GetLeaveLogListAsync(assigneeUserIds);

            foreach (var teamMember in teamMemberList)
            {
                var taskAssignee = teamMember.IsSelfMonitor
                    ? SelfMonitorSystemRole.MemberFilterId
                    : teamMember.UserId;
                var item = new MyTeamMemberTaskResponse()
                {
                    UserId = teamMember.UserId,
                    UserName = teamMember.UserName,
                    MaxWorkTaskCount = _configuration.GetValue("MaxWorkTaskCount", 15)
                };

                var leaveLog = teamMember.IsSelfMonitor ? null : leaveLogList.FirstOrDefault(a => a.UserId == teamMember.UserId);
                if (leaveLog != null)
                {
                    item.IsLeave = leaveLog.IsLeave;
                    item.LeaveTypeNameAr = leaveLog.LeaveTypeNameAr;
                    item.LeaveTypeNameEn = leaveLog.LeaveTypeNameEn;
                    item.BriefDescription = leaveLog.BriefDescription;
                    item.ExpectedReturnDate = leaveLog.ExpectedReturnDate;
                    item.LeaveCreatedOn = leaveLog.CreatedOn;
                }

                var totalTaskList = list.Where(a => a.Assignee == taskAssignee).ToList();
                if (totalTaskList.Count == 0)
                {
                    result.Add(item);
                    continue;
                }
                var completedTaskList = totalTaskList.Where(a => a.TaskApprovalAt.HasValue).ToList();
                if (req.StartTime.HasValue)
                {
                    totalTaskList = totalTaskList.Where(a => a.TaskCreatedTime >= req.StartTime.Value).ToList();
                    completedTaskList = completedTaskList.Where(a => a.TaskApprovalAt >= req.StartTime.Value).ToList();
                }
                if (req.EndTime.HasValue)
                {
                    totalTaskList = totalTaskList.Where(a => a.TaskCreatedTime < req.EndTime.Value.AddDays(1).Date).ToList();
                    completedTaskList = completedTaskList.Where(a => a.TaskApprovalAt < req.EndTime.Value.AddDays(1).Date).ToList();
                }

                item.TotalTaskCount = totalTaskList.Count;
                item.CompletedTaskCount = completedTaskList.Count;
                item.AvgDuration = completedTaskList.Count > 0 ? Math.Ceiling(completedTaskList.Average(a => a.Duration)) : 0;
                item.SLA = completedTaskList.Count > 0 ? (decimal)totalTaskList.Count(a => a.IsOverdue == false) / completedTaskList.Count : 0;
                item.OverdueCount = totalTaskList.Count(a => a.IsOverdue);
                result.Add(item);
            }

            return result.OrderByDescending(a => a.IsLeave)
                        .ThenBy(a => a.UserName)
                        .ToList();
        }

        public async Task<List<MyTeamMembersResponse>> GetMyTeamMembersAsync(bool isLeave)
        {
            var user = await _userService.GetAsync(_currentUserService.UserId);
            if (user == null)
                return new List<MyTeamMembersResponse>();

            var departmentIds = user.UserDepartments.Where(a => a.IsLeader ?? false).Select(a => a.DepartmentId + "").ToArray();
            if (departmentIds.Length == 0)
                return new List<MyTeamMembersResponse>();

            var isContentLeader = departmentIds.Select(a => a.ToInt()).Contains((int)DepartmentEnum.Content);
            var myTeamMembers = await _userService.GetListByDepartmentIdsAsync(departmentIds);
            if (myTeamMembers.Count == 0 && !isContentLeader)
                return new List<MyTeamMembersResponse>();

            var result = myTeamMembers.Select(a => new MyTeamMembersResponse()
            {
                UserId = a.Id,
                UserName = $"{a.FirstName} {a.LastName}"
            }).Distinct().ToList();

            if (isContentLeader)
            {
                var selfMonitorAssigneeId = await ResolveSelfMonitorAssigneeIdAsync();
                result = result
                    .Where(a => !string.Equals(a.UserId, selfMonitorAssigneeId, StringComparison.OrdinalIgnoreCase))
                    .Where(a => !string.Equals(a.UserName.Trim(), SelfMonitorSystemRole.DisplayName, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                result.Add(new MyTeamMembersResponse
                {
                    UserId = SelfMonitorSystemRole.MemberFilterId,
                    UserName = SelfMonitorSystemRole.DisplayName,
                    IsSelfMonitor = true
                });
            }

            // When isLeave is true, exclude personnel who have left their positions
            if (isLeave)
            {
                var userIds = result.Select(a => a.UserId).ToArray();
                var leaveLogList = await _userService.GetLeaveLogListAsync(userIds);
                var leaveUserIds = leaveLogList.Where(a => a.IsLeave == true).Select(a => a.UserId).ToHashSet();
                result = result.Where(a => !leaveUserIds.Contains(a.UserId)).ToList();
            }

            return result;
        }

        public async Task<bool> MyTeamMemberLeaveAsync(MyTeamMemberLeaveRequest req)
        {
            var user = await _userService.GetAsync(_currentUserService.UserId);
            if (user == null)
                throw new BusinessException("User not found");

            var departmentIds = user.UserDepartments.Where(a => a.IsLeader ?? false).Select(a => a.DepartmentId + "").ToArray();
            if (departmentIds.Length == 0)
                throw new BusinessException("User not found");

            var myTeamMembers = await _userService.GetListByDepartmentIdsAsync(departmentIds);
            if (myTeamMembers.Count == 0)
                throw new BusinessException("User not found");
            var member = myTeamMembers.FirstOrDefault(a => a.Id == req.UserId);
            if (member == null)
                throw new BusinessException("User not found");

            var leaveLog = new LeaveLogModel()
            {
                UserId = member.Id,
                IsLeave = true,
                LeaveTypeCode = req.LeaveType,
                BriefDescription = req.BriefDescription,
                ExpectedReturnDate = req.ExpectedReturnDate,
                CreatedOn = DateTimeHelper.Now
            };

            try
            {
                await _userService.MyTeamMemberLeaveAsync(leaveLog);
                await _unitOfWork.SaveChangesAsync();
            }
            catch (Exception ex)
            {

            }

            return true;
        }

        public async Task<bool> MyTeamMemberReturnAsync(string userId)
        {
            var user = await _userService.GetAsync(_currentUserService.UserId);
            if (user == null)
                throw new BusinessException("User not found");

            var departmentIds = user.UserDepartments.Where(a => a.IsLeader ?? false).Select(a => a.DepartmentId + "").ToArray();
            if (departmentIds.Length == 0)
                throw new BusinessException("User not found");

            var myTeamMembers = await _userService.GetListByDepartmentIdsAsync(departmentIds);
            if (myTeamMembers.Count == 0)
                throw new BusinessException("User not found");
            var member = myTeamMembers.FirstOrDefault(a => a.Id == userId);
            if (member == null)
                throw new BusinessException("User not found");

            var result = await _userService.MyTeamMemberReturnAsync(userId);
            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        public async Task<byte[]> ExportMyTeamReviewAsync(MyTeamReviewPageRequest req, int status, string departmentId)
        {
            var list = await GetMyTeamReviewListAsync(departmentId);

            switch (status)
            {
                case 1:
                    list = ReviewTaskProjection.SelectTeamTodo(
                        list,
                        IsCompletedReviewItem,
                        IsExternalApprovalItem);
                    break;
                case 2:
                    list = ReviewTaskProjection.SelectCompleted(list, IsCompletedReviewItem);
                    break;
                default:
                    list = ReviewTaskProjection.SelectTeamAll(
                        list,
                        IsCompletedReviewItem,
                        IsExternalApprovalItem);
                    break;
            }

            // Shared with GetMyTeamReviewPageAsync so the CSV always matches the visible page:
            // same filters, then the same ordering.
            list = ApplyMyTeamReviewSort(MyTeamReviewFilter.Apply(list.AsQueryable(), req), req).ToList();

            // Mirror the paged list's per-row normalization (GetMyTeamReviewPageAsync).
            foreach (var item in list)
            {
                if (item.StatusId == (int)ApprovalNodeOrder.Cancelled)
                    item.TaskStatus = "-";
            }

            // "Approval Status" (TaskStatus) is the column the approvalStatus filter narrows; the
            // CSV previously carried only the process-instance Status, so a filtered export looked
            // unfiltered. See ExportMyReviewAsync for the same fix on the personal queue.
            var headers = new[] { "Application No.", "Service Name", "Service Category", "TypeName", "SLA", "Apply For", "Assigned To", "Status", "Approval Status", "Last Updated Time" };

            var data = new List<List<string>>();
            foreach (var item in list)
            {
                data.Add(new List<string>()
                {
                    item.ApplicationNumber,
                    item.ServiceNameEn,
                    item.ServiceCategoryNameEn,
                    item.ServiceTypeNameEn,
                    item.SLADescription,
                    item.ApplyForEn,
                    item.AssignedTo,
                    item.Status,
                    item.TaskStatus,
                    item.LastUpdatedTime.ToString("dd/MM/yyyy HH:mm:ss")
                });
            }

            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers.Select(EscapeCsv)));
                    foreach (var item in data)
                    {
                        sw.WriteLine(string.Join(",", item.Select(EscapeCsv)));
                    }
                }
                return ms.ToArray();
            }
        }

        public async Task<bool> IsLeaderAsync(string departmentId)
        {
            return await _userService.IsLeaderAsync(_currentUserService.UserId, departmentId);
        }

        public async Task<int> GetUrgenCountAsync(string departmentId)
        {
            var isLeader = await IsLeaderAsync(departmentId);
            if (isLeader == false)
                return 0;

            var result = new MyTeamReviewResponse();

            var list = await GetMyTeamReviewListAsync(departmentId);
            var urgentCount = ReviewTaskProjection.SelectTeamTodo(
                    list,
                    IsCompletedReviewItem,
                    IsExternalApprovalItem)
                .Count(a => a.IsUrgent == true);

            return urgentCount;
        }

        public async Task<ApplicationDashboardStatisticsResponse> GetApplicationDashboardStatisticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;

            // Shared logic for generating trend dates and grouping
            var trendResult = TrendChartHelper.GetTrendGroups(start, end);
            string unit = trendResult.Unit;
            var groups = trendResult.Groups;

            // 1. Total Publish Services
            var totalPublishServices = await _db.ServiceConfigs
                .CountAsync(s => s.Status == "5" && s.IsCurrentVersion == true && s.Department == (int)DepartmentEnum.Licensing && (s.ParentId ?? 0) == 0 && s.PublishAt >= start && s.PublishAt <= end);

            // 2. Total Applications in the period (filtered by Department 1)
            var totalApplications = await (from app in _db.Applications
                                           join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                           where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && svc.Department == (int)DepartmentEnum.Licensing
                                           select app.Id).CountAsync();

            // 3. Revenue and Refunds from Transactions table
            var transactionsQuery = from t in _db.Transactions
                                    // Join by the unambiguous (backfilled) ApplicationId so shared ApplicationNumbers don't fan-out revenue.
                                    join app in _db.Applications on t.ApplicationId equals (int?)app.Id
                                    join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                    where t.StatusId == 3 && t.CreatedOn >= start && t.CreatedOn <= end && svc.Department == (int)DepartmentEnum.Licensing
                                    select new { t.TransactionTypeId, t.Amount, t.CreatedOn };

            var transactions = await transactionsQuery.ToListAsync();

            var serviceFees = transactions.Where(t => t.TransactionTypeId == 2).Sum(t => t.Amount);
            var fines = transactions.Where(t => t.TransactionTypeId == 3).Sum(t => t.Amount);
            var refunds = transactions.Where(t => t.TransactionTypeId == 4).Sum(t => t.Amount);

            var totalRevenue = serviceFees + fines - refunds;
            var totalRefunds = refunds;
            var refundApplications = transactions.Count(t => t.TransactionTypeId == 4);

            var response = new ApplicationDashboardStatisticsResponse
            {
                TotalPublishServices = totalPublishServices,
                TotalApplications = totalApplications,
                TotalRevenue = totalRevenue,
                TotalRefunds = totalRefunds,
                RefundApplications = refundApplications,
                // Satisfaction data is not yet collected; expose as missing (0) instead of mocking.
                AvgSatisfaction = 0
            };

            // AvgProcessingTime — application-level "end-to-end approval duration" definition
            // (docs/analytics/team-management-members-avg-processing-time.md §7):
            // duration = CamundaProcessInstances.EndTime − Application.CreatedOn,
            // filtered to StatusId == Completed(12) && EndTime.HasValue (+ EndTime >= CreatedOn
            // as a dirty-data guard). One value per completed application.
            var completedLicensingApps = await (from app in _db.Applications
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join proc in _db.CamundaProcessInstances on app.Id equals proc.ApplicationId
                where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end
                      && svc.Department == (int)DepartmentEnum.Licensing
                      && proc.StatusId == (int)ApprovalNodeOrder.Completed
                      && proc.EndTime != null
                      && proc.EndTime >= app.CreatedOn
                group new { app.CreatedOn, proc.EndTime } by app.Id into g
                select new
                {
                    AppCreatedOn = g.Min(x => x.CreatedOn),
                    CompletedOn = g.Max(x => x.EndTime!.Value)
                })
                .ToListAsync().ConfigureAwait(false);

            if (completedLicensingApps.Count > 0)
            {
                var avgProcessingMinutes = completedLicensingApps.Average(x => (x.CompletedOn - x.AppCreatedOn).TotalMinutes);
                response.AvgProcessingTime = ContentDashboardSharedSupportService.FormatDuration(avgProcessingMinutes, false);
            }

            // Revenue Trend List
            foreach (var group in groups)
            {
                var dateStr = TrendChartHelper.GetFormatDate(group.Start, group.End, unit);
                var groupTransactions = transactions.Where(t => t.CreatedOn.Date >= group.Start && t.CreatedOn.Date <= group.End).ToList();
                var dServiceFees = groupTransactions.Where(t => t.TransactionTypeId == 2).Sum(t => t.Amount);

                response.RevenueTrendList.Add(new RevenueTrendDto
                {
                    Date = dateStr,
                    ServiceApplicationFees = dServiceFees,
                    Revenue = dServiceFees,
                    Unit = unit
                });
            }

            // Calculate Approval Rate.
            // Match both the plain main-status (Completed=12, Rejected=8) and the
            // disposition-suffixed variants. The compound legacy labels (e.g.
            // "Completed (Disposition Verified)") still carry the same main StatusId —
            // disposition outcome lives on DispositionCase, not on the process instance.
            var approvedCountQuery = from app in _db.Applications
                                     join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                     join proc in _db.CamundaProcessInstances on app.Id equals proc.ApplicationId
                                     where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && proc.StatusId == (int)ApprovalNodeOrder.Completed && svc.Department == (int)DepartmentEnum.Licensing
                                     select app.Id;

            var rejectedCountQuery = from app in _db.Applications
                                     join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                     join proc in _db.CamundaProcessInstances on app.Id equals proc.ApplicationId
                                     where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && proc.StatusId == (int)ApprovalNodeOrder.Rejected && svc.Department == (int)DepartmentEnum.Licensing
                                     select app.Id;

            var approvedCount = await approvedCountQuery.CountAsync();
            var rejectedCount = await rejectedCountQuery.CountAsync();
            response.ApprovalRate = (approvedCount + rejectedCount) > 0 ? Math.Round((double)approvedCount / (approvedCount + rejectedCount) * 100, 2) : 0;

            // 4. Detailed Statistics (Trend, Emirate, Device, Status)
            var query = from app in _db.Applications
                        join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                        join appDetail in _db.ApplicationDetails on app.Id equals appDetail.ApplicationId into appDetailGroup
                        from appDetail in appDetailGroup.DefaultIfEmpty()
                        join up in _db.UserProfiles on app.ProfileId equals up.Id into upGroup
                        from up in upGroup.DefaultIfEmpty()
                        join ut in _db.UserTypes on up.UserTypeId equals ut.Id into utGroup
                        from ut in utGroup.DefaultIfEmpty()
                            // Emirate info via Address
                        join addr in _db.Address on up.AddressId equals addr.Id into addrGroup
                        from addr in addrGroup.DefaultIfEmpty()
                        join emirate in _db.Set<Emirate>() on (addr != null ? addr.EmirateId : (short)0) equals emirate.Id into emirateGroup
                        from emirate in emirateGroup.DefaultIfEmpty()
                        join country in _db.Countries on (addr != null ? addr.CountryId : 0) equals country.Id into countryGroup
                        from country in countryGroup.DefaultIfEmpty()
                        where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && svc.Department == (int)DepartmentEnum.Licensing
                        select new
                        {
                            app.Id,
                            app.CreatedOn,
                            UserTypeCode = ut != null ? ut.Code : null,
                            PlatformId = appDetail != null ? appDetail.PlatformId : (short?)null,
                            EmirateId = emirate != null ? (short?)emirate.Id : null,
                            CountryId = addr != null ? addr.CountryId : null,
                            CountryNameEn = country != null ? country.NameEn : null
                        };

            var appData = await query.ToListAsync();

            var statusStats = new UserProfileStatusStatsDto
            {
                Individual = appData.Count(p => p.UserTypeCode == "1"),
                Commercial = appData.Count(p => p.UserTypeCode == "2"),
                TalentAgency = appData.Count(p => p.UserTypeCode == "12"),
                FreeZone = appData.Count(p => p.UserTypeCode == "05"),
                Embassy = appData.Count(p => p.UserTypeCode == "13"),
                Consulate = appData.Count(p => p.UserTypeCode == "14"),
                CulturalClubs = appData.Count(p => p.UserTypeCode == "15"),
                Government = appData.Count(p => p.UserTypeCode == "3")
            };
            statusStats.Total = statusStats.Individual + statusStats.Commercial + statusStats.TalentAgency +
                               statusStats.FreeZone + statusStats.Embassy + statusStats.Consulate +
                               statusStats.CulturalClubs + statusStats.Government;
            response.StatusStats = statusStats;

            // 4.2 Emirate Stats
            var allEmirates = await _db.Set<Emirate>().ToListAsync();
            var emirateGroups = appData.GroupBy(p => p.EmirateId)
                .Select(g => new
                {
                    EmirateId = g.Key,
                    Count = g.Count()
                })
                .ToList();

            response.EmirateStats = allEmirates.Select(e => new UserProfileEmirateStatsDto
            {
                Emirate = e.NameEn,
                Count = emirateGroups.FirstOrDefault(x => x.EmirateId == e.Id)?.Count ?? 0,
                Percentage = response.StatusStats.Total > 0 ? Math.Round((double)(emirateGroups.FirstOrDefault(x => x.EmirateId == e.Id)?.Count ?? 0) / response.StatusStats.Total * 100, 2) : 0
            }).ToList();

            // Add Foreign (where EmirateId is null)
            var foreignCount = emirateGroups.FirstOrDefault(x => x.EmirateId == null)?.Count ?? 0;
            response.EmirateStats.Add(new UserProfileEmirateStatsDto
            {
                Emirate = "Foreign",
                Count = foreignCount,
                Percentage = response.StatusStats.Total > 0 ? Math.Round((double)foreignCount / response.StatusStats.Total * 100, 2) : 0
            });

            // 4.3 Trend Stats
            foreach (var group in groups)
            {
                var dateStr = TrendChartHelper.GetFormatDate(group.Start, group.End, unit);
                response.TrendStats.Add(new UserProfileTrendStatsDto
                {
                    Date = dateStr,
                    ApprovedCount = appData.Count(p => p.CreatedOn.Date >= group.Start && p.CreatedOn.Date <= group.End),
                    Unit = unit
                });
            }

            // 4.4 Device Stats
            var platforms = await _db.TypeDictionaries.Where(t => t.Scope == "Platform").ToListAsync();
            response.DeviceStats = new List<UserProfileDeviceStatsDto>
            {
                new UserProfileDeviceStatsDto { DeviceType = "Web", Count = appData.Count(d => platforms.Any(plt => plt.Code == d.PlatformId?.ToString() && plt.NameEn.Contains("Web", StringComparison.OrdinalIgnoreCase))) },
                new UserProfileDeviceStatsDto { DeviceType = "Mobile", Count = appData.Count(d => platforms.Any(plt => plt.Code == d.PlatformId?.ToString() && plt.NameEn.Contains("Mobile", StringComparison.OrdinalIgnoreCase))) },
                new UserProfileDeviceStatsDto { DeviceType = "Tablet", Count = appData.Count(d => platforms.Any(plt => plt.Code == d.PlatformId?.ToString() && plt.NameEn.Contains("Tablet", StringComparison.OrdinalIgnoreCase))) }
            };

            if (response.DeviceStats.All(s => s.Count == 0))
            {
                response.DeviceStats = new List<UserProfileDeviceStatsDto>
                {
                    new UserProfileDeviceStatsDto { DeviceType = "Web", Count = appData.Count(d => d.PlatformId == 1) },
                    new UserProfileDeviceStatsDto { DeviceType = "Mobile", Count = appData.Count(d => d.PlatformId == 2) },
                    new UserProfileDeviceStatsDto { DeviceType = "Tablet", Count = appData.Count(d => d.PlatformId == 3) }
                };
            }

            // 4.4 Category Stats
            var categories = await _db.ServiceCategories.Where(c => !c.IsDeleted).ToListAsync();
            var categoryDataQuery = from app in _db.Applications
                                    join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                    where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && svc.Department == (int)DepartmentEnum.Licensing
                                    select new { svc.ServiceCategoryId };

            var categoryData = await categoryDataQuery.ToListAsync();

            response.CategoryStats = categories.Select(c =>
            {
                var count = categoryData.Count(d => d.ServiceCategoryId == c.Id);
                return new ServiceCategoryStatsDto
                {
                    CategoryName = c.NameEn,
                    Count = count,
                    Percentage = categoryData.Count > 0 ? Math.Round((double)count / categoryData.Count * 100, 2) : 0
                };
            }).OrderByDescending(c => c.Count).ToList();

            // 4.5 Application Type Stats
            var appTypeDataQuery = from app in _db.Applications
                                   join appDetail in _db.ApplicationDetails on app.Id equals appDetail.ApplicationId
                                   join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                   where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && svc.Department == (int)DepartmentEnum.Licensing
                                   select new { appDetail.ApplicationTypeId };

            var appTypeData = await appTypeDataQuery.ToListAsync();

            // Check for lookup table in Scope ApplicationTypes or ApplicationType
            var appTypesDict = await _db.TypeDictionaries
                .Where(t => t.Scope == "ServiceConfigServiceType")
                .ToListAsync();

            if (appTypesDict.Any())
            {
                response.TypeStats = appTypesDict.Select(t =>
                {
                    var count = appTypeData.Count(d => d.ApplicationTypeId.ToString() == t.Code || d.ApplicationTypeId.ToString() == t.Id.ToString());
                    return new ApplicationTypeStatsDto
                    {
                        TypeName = t.NameEn,
                        Count = count,
                        Percentage = appTypeData.Count > 0 ? Math.Round((double)count / appTypeData.Count * 100, 2) : 0
                    };
                }).OrderByDescending(t => t.Count).ToList();
            }
            else
            {
                // If not in TypeDictionary, use hardcoded common types (ensure all 1-4 are included even if count is 0)
                var standardTypes = new Dictionary<int, string>
                {
                    { 2, "New" },
                    { 3, "Renew" },
                    { 4, "Modify" },
                    { 5, "Cancel" },
                    { 6, "Transfer" },
                    { 7, "Partner Management" }
                };

                var typeCounts = appTypeData.GroupBy(d => d.ApplicationTypeId)
                    .ToDictionary(g => (int)g.Key, g => g.Count());

                var otherTypes = typeCounts.Keys.Where(k => !standardTypes.ContainsKey(k)).ToList();

                response.TypeStats = standardTypes.Select(kvp => new ApplicationTypeStatsDto
                {
                    TypeName = kvp.Value,
                    Count = typeCounts.GetValueOrDefault(kvp.Key, 0),
                    Percentage = appTypeData.Count > 0 ? Math.Round((double)typeCounts.GetValueOrDefault(kvp.Key, 0) / appTypeData.Count * 100, 2) : 0
                }).Concat(otherTypes.Select(k => new ApplicationTypeStatsDto
                {
                    TypeName = $"Type {k}",
                    Count = typeCounts[k],
                    Percentage = appTypeData.Count > 0 ? Math.Round((double)typeCounts[k] / appTypeData.Count * 100, 2) : 0
                })).OrderByDescending(t => t.Count).ToList();
            }

            // 4.6 Revenue Trend List (Removed mock, now using real data from transactions calculated above)

            // ── Avg Satisfaction (Department=1, rating 4/5 = satisfied) ──
            var satisfactionRatings = await (
                from rating in _db.Set<UserServiceRating>()
                // ReferenceNo now stores the unambiguous ApplicationId (as string); match it to Application.Id.
                join app in _db.Applications on rating.ReferenceNo equals app.Id.ToString()
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                where svc.Department == (int)DepartmentEnum.Licensing
                      && rating.CreatedOn >= start && rating.CreatedOn <= end
                select new { rating.Rating, rating.CreatedOn }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            var totalSatisfaction = satisfactionRatings.Count;
            var satisfactionCount = satisfactionRatings.Count(r => r.Rating >= 4);
            response.AvgSatisfaction = totalSatisfaction > 0 ? Math.Round((double)satisfactionCount / totalSatisfaction * 100, 2) : 0;
            response.SatisfactionCount = satisfactionCount;
            response.TotalSatisfaction = totalSatisfaction;

            // ── Avg Processing Time (Application CreatedOn → Completed ApprovalDate) ──
            // Matches Content algorithm: group by app.Id, take latest ApprovalDate per app,
            // include both InstanceStatusId=Completed and NodeType="Completed" records.
            var completedApps = await (
                from app in _db.Applications
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join ar in _db.ApprovalRecords on app.Id equals ar.ApplicationId
                where !app.IsDelete
                      && svc.Department == (int)DepartmentEnum.Licensing
                      && app.CreatedOn >= start && app.CreatedOn <= end
                      && (ar.InstanceStatusId == (int)ApprovalNodeOrder.Completed
                          || ar.NodeType == "Completed")
                      && ar.ApprovalDate != null
                group new { app.CreatedOn, ar.ApprovalDate } by app.Id into g
                select new
                {
                    AppCreatedOn = g.Min(x => x.CreatedOn),
                    CompletedOn = g.Max(x => x.ApprovalDate!.Value)
                }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            var avgProcMinutes = completedApps.Count > 0
                ? completedApps.Average(x => (x.CompletedOn - x.AppCreatedOn).TotalMinutes)
                : 0;
            response.AvgProcessingTime = ContentDashboardSharedSupportService.FormatDuration(avgProcMinutes, false);

            // ── Application Status Distribution (by CamundaProcessInstances.StatusId, Department=1) ──
            // Only count the 7 recognized statuses; ignore all other StatusId values.
            var recognizedStatusIds = new HashSet<int>
            {
                (int)ApprovalNodeOrder.InitialApproval,      // 2
                (int)ApprovalNodeOrder.FinalApproval,         // 7
                (int)ApprovalNodeOrder.Rejected,              // 8
                (int)ApprovalNodeOrder.Cancelled,             // 10
                (int)ApprovalNodeOrder.ExternalApproval,      // 11
                (int)ApprovalNodeOrder.Completed,             // 12
                (int)ApprovalNodeOrder.PendingModification,   // 13
            };

            var statusApps = await (
                from app in _db.Applications
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join proc in _db.CamundaProcessInstances on app.Id equals proc.ApplicationId
                where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end
                      && svc.Department == (int)DepartmentEnum.Licensing
                      && proc.StatusId != null && recognizedStatusIds.Contains(proc.StatusId.Value)
                select proc.StatusId.Value
            ).ToListAsync().ConfigureAwait(false);

            var statusMapping = new List<(Func<int, bool> match, string name, int taskStatusId)>
            {
                (x => x == (int)ApprovalNodeOrder.InitialApproval,    "Pending Initial Approval",  (int)ApprovalNodeOrder.InitialApproval),
                (x => x == (int)ApprovalNodeOrder.ExternalApproval,   "Pending External Approval", (int)ApprovalNodeOrder.ExternalApproval),
                (x => x == (int)ApprovalNodeOrder.FinalApproval,      "Pending Final Approval",    (int)ApprovalNodeOrder.FinalApproval),
                (x => x == (int)ApprovalNodeOrder.PendingModification,"Pending Modification",      (int)ApprovalNodeOrder.PendingModification),
                (x => x == (int)ApprovalNodeOrder.Completed,          "Completed",                 (int)ApprovalNodeOrder.Completed),
                (x => x == (int)ApprovalNodeOrder.Rejected,           "Rejected",                  (int)ApprovalNodeOrder.Rejected),
                (x => x == (int)ApprovalNodeOrder.Cancelled,          "Cancelled",                 (int)ApprovalNodeOrder.Cancelled),
            };

            var totalStatusApps = statusApps.Count;
            response.ApplicationStatusDistribution = statusMapping.Select(s => {
                var count = statusApps.Count(x => s.match(x));
                return new Dtos.Application.ApplicationStatusDistributionDto
                {
                    StatusName = s.name,
                    Count = count,
                    Percentage = totalStatusApps > 0 ? Math.Round((double)count / totalStatusApps * 100, 2) : 0,
                    TaskStatusId = s.taskStatusId
                };
            }).ToList();

            // ── Top 15 Economic Activities (by MedialLicenseId → MediaLicenseEconomicActivity → EconomicActivity) ──
            var economicActivityData = await (
                from app in _db.Applications
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join mlea in _db.MediaLicenseEconomicActivities on app.MedialLicenseId equals mlea.MedialLicenseId
                join ea in _db.Set<EconomicActivity>() on mlea.EconomicActivityId equals ea.Id
                where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end
                      && svc.Department == (int)DepartmentEnum.Licensing
                select new { ea.Id, ea.NameEn, ea.NameAr }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            response.TopEconomicActivities = economicActivityData
                .GroupBy(x => new { x.Id, x.NameEn, x.NameAr })
                .Select(g => new EconomicActivityDistributionDto
                {
                    EconomicActivityId = g.Key.Id,
                    NameEn = g.Key.NameEn ?? string.Empty,
                    NameAr = g.Key.NameAr ?? string.Empty,
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Count)
                .Take(15)
                .ToList();

            // ── SLA Performance Overview + Trend ──
            // Task-level definition (docs/analytics/team-management-members-avg-processing-time.md §1-2):
            // Source = Workflow.CamundaTasks (Licensing department, time window by CreatedTime);
            // single-task completion time = ApprovalAt (EndTime); processing duration prefers ApprovalRecords.ActualDurationMinutes,
            // falls back to (ApprovalAt − CreatedTime); SLA compliance judged by task DueDate. Only completed tasks (ApprovalAt non-null) are counted.
            var slaTaskRows = await (
                from t in _db.CamundaTasks
                join proc in _db.CamundaProcessInstances on t.ProcessInstanceId equals proc.ProcessInstanceId
                join app in _db.Applications on proc.ApplicationId equals app.Id
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                where !app.IsDelete && svc.Department == (int)DepartmentEnum.Licensing
                      && t.CreatedTime >= start && t.CreatedTime <= end
                      && t.ApprovalAt != null
                select new { t.TaskId, t.CreatedTime, t.ApprovalAt, t.DueDate }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            // Preferred processing-duration source: ApprovalRecords.ActualDurationMinutes (latest ApprovalDate per TaskId).
            var slaTaskIds = slaTaskRows.Select(t => t.TaskId).Distinct().ToList();
            var slaDurationMap = slaTaskIds.Any()
                ? (await _db.ApprovalRecords
                        .Where(r => r.TaskId != null && slaTaskIds.Contains(r.TaskId) && r.ApprovalDate != null)
                        .Select(r => new { r.TaskId, r.ApprovalDate, r.ActualDurationMinutes })
                        .ToListAsync())
                    .GroupBy(r => r.TaskId!)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.ApprovalDate).First().ActualDurationMinutes)
                : new Dictionary<string, double?>();

            var slaCompletedApps = slaTaskRows.Select(t => new
            {
                CompletedAt = t.ApprovalAt!.Value,
                ProcessingMinutes = ResolveTaskProcessingMinutes(
                    t.CreatedTime,
                    t.ApprovalAt,
                    slaDurationMap.TryGetValue(t.TaskId, out var dur) ? dur : null),
                SlaCompliant = t.DueDate.HasValue && t.ApprovalAt!.Value <= t.DueDate.Value,
                HasDueDate = t.DueDate.HasValue
            }).ToList();

            var slaTotalCompleted = slaCompletedApps.Count;
            var slaWithinCount = slaCompletedApps.Count(x => x.SlaCompliant);
            var slaBreachCount = slaCompletedApps.Count(x => x.HasDueDate && !x.SlaCompliant);
            var slaAvgProcMinutes = slaTotalCompleted > 0
                ? slaCompletedApps.Average(x => x.ProcessingMinutes)
                : 0;

            var trendGroups = TrendChartHelper.GetTrendGroups(start, end);
            response.SlaPerformance = new ServiceSlaPerformanceDto
            {
                SlaComplianceRate = slaTotalCompleted > 0 ? Math.Round((double)slaWithinCount / slaTotalCompleted * 100, 2) : 0,
                SlaBreachRate = slaTotalCompleted > 0 ? Math.Round((double)slaBreachCount / slaTotalCompleted * 100, 2) : 0,
                AvgProcessingTimeDays = Math.Round(slaAvgProcMinutes / 1440, 2),
                TotalCompleted = slaTotalCompleted,
                SlaCompliant = slaWithinCount,
                SlaBreached = slaBreachCount,
                Trend = trendGroups.Groups.Select(bucket =>
                {
                    var bucketApps = slaCompletedApps.Where(x => x.CompletedAt >= bucket.Start && x.CompletedAt < bucket.End).ToList();
                    var bucketTotal = bucketApps.Count;
                    var bucketWithin = bucketApps.Count(x => x.SlaCompliant);
                    var bucketAvgProc = bucketTotal > 0
                        ? bucketApps.Average(x => x.ProcessingMinutes)
                        : 0;
                    return new ServiceSlaPerformanceTrendPointDto
                    {
                        Period = bucket.Start.ToString("MM-yyyy"),
                        SlaComplianceRate = bucketTotal > 0 ? Math.Round((double)bucketWithin / bucketTotal * 100, 2) : 0,
                        AvgProcessingTimeDays = Math.Round(bucketAvgProc / 1440, 2)
                    };
                }).ToList()
            };

            // ── Revenue Analytics: By Activity / By Service / By Application Type ──
            // Paid transactions for Department=1 in time range
            var paidTransactions = await (
                from t in _db.Transactions
                // Join by the unambiguous (backfilled) ApplicationId so shared ApplicationNumbers don't fan-out revenue.
                join app in _db.Applications on t.ApplicationId equals (int?)app.Id
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                where svc.Department == (int)DepartmentEnum.Licensing
                      && t.CreatedOn >= start && t.CreatedOn <= end
                      && t.StatusId == 3
                select new { app.Id, app.MedialLicenseId, app.ServiceId, t.Amount }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            // By Activity — top 10 by amount
            var byActivityData = await (
                from pt in _db.Transactions
                // Join by the unambiguous (backfilled) ApplicationId so shared ApplicationNumbers don't fan-out revenue.
                join app in _db.Applications on pt.ApplicationId equals (int?)app.Id
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join mlea in _db.MediaLicenseEconomicActivities on app.MedialLicenseId equals mlea.MedialLicenseId
                join ea in _db.Set<EconomicActivity>() on mlea.EconomicActivityId equals ea.Id
                where svc.Department == (int)DepartmentEnum.Licensing
                      && pt.CreatedOn >= start && pt.CreatedOn <= end
                      && pt.StatusId == 3
                select new { ea.Id, ea.NameEn, ea.NameAr, pt.Amount }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            var byActivity = byActivityData
                .GroupBy(x => new { x.Id, x.NameEn, x.NameAr })
                .Select(g => new RevenueByItemDto
                {
                    Id = g.Key.Id,
                    NameEn = g.Key.NameEn ?? string.Empty,
                    NameAr = g.Key.NameAr ?? string.Empty,
                    Amount = g.Sum(x => x.Amount)
                })
                .OrderByDescending(x => x.Amount)
                .Take(10)
                .ToList();

            // By Service — top 10 by amount
            var byService = paidTransactions
                .GroupBy(x => x.ServiceId)
                .Select(g => g.Key)
                .ToList();

            var serviceNames = await _db.ServiceConfigs
                .Where(s => byService.Contains(s.Id))
                .Select(s => new { s.Id, s.NameEn, s.NameAr })
                .AsNoTracking()
                .ToListAsync().ConfigureAwait(false);

            var byServiceResult = paidTransactions
                .GroupBy(x => x.ServiceId)
                .Select(g =>
                {
                    var svc = serviceNames.FirstOrDefault(s => s.Id == g.Key);
                    return new RevenueByItemDto
                    {
                        Id = g.Key,
                        NameEn = svc?.NameEn ?? string.Empty,
                        NameAr = svc?.NameAr ?? string.Empty,
                        Amount = g.Sum(x => x.Amount)
                    };
                })
                .OrderByDescending(x => x.Amount)
                .Take(10)
                .ToList();

            // By Application Type — from ApplicationDetails.ApplicationTypeId, lookup TypeDictionary(Scope=ServiceConfigServiceType)
            var appTypeRevenueData = await (
                from t in _db.Transactions
                // Join by the unambiguous (backfilled) ApplicationId so shared ApplicationNumbers don't fan-out revenue.
                join app in _db.Applications on t.ApplicationId equals (int?)app.Id
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join appDetail in _db.ApplicationDetails on app.Id equals appDetail.ApplicationId
                where svc.Department == (int)DepartmentEnum.Licensing
                      && t.CreatedOn >= start && t.CreatedOn <= end
                      && t.StatusId == 3
                select new { appDetail.ApplicationTypeId, t.Amount }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            var appTypeCodeStrs = appTypeRevenueData.Select(x => x.ApplicationTypeId.ToString()).Distinct().ToList();
            var appTypeNames = await _db.Set<TypeDictionary>()
                .Where(td => td.Scope == "ServiceConfigServiceType" && appTypeCodeStrs.Contains(td.Code))
                .Select(td => new { td.Code, td.NameEn, td.NameAr })
                .AsNoTracking()
                .ToListAsync().ConfigureAwait(false);

            var byAppType = appTypeRevenueData
                .GroupBy(x => x.ApplicationTypeId)
                .Select(g =>
                {
                    var td = appTypeNames.FirstOrDefault(t => t.Code == g.Key.ToString());
                    return new RevenueByItemDto
                    {
                        Id = (int)g.Key,
                        NameEn = td?.NameEn ?? string.Empty,
                        NameAr = td?.NameAr ?? string.Empty,
                        Amount = g.Sum(x => x.Amount)
                    };
                })
                .OrderByDescending(x => x.Amount)
                .ToList();

            response.RevenueAnalytics = new RevenueAnalyticsDto
            {
                ByActivity = byActivity,
                ByService = byServiceResult,
                ByApplicationType = byAppType
            };

            // ── CSAT Analysis: three-state distribution + trend (Department=1) ──
            var csatRatings = await (
                from rating in _db.Set<UserServiceRating>()
                // ReferenceNo now stores the unambiguous ApplicationId (as string); match it to Application.Id.
                join app in _db.Applications on rating.ReferenceNo equals app.Id.ToString()
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                where svc.Department == (int)DepartmentEnum.Licensing
                      && rating.CreatedOn >= start && rating.CreatedOn <= end
                select new { rating.Rating, rating.CreatedOn }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            var csatTotal = csatRatings.Count;
            var satisfiedCount2 = csatRatings.Count(r => r.Rating >= 4);
            var neutralCount = csatRatings.Count(r => r.Rating == 3);
            var dissatisfiedCount = csatRatings.Count(r => r.Rating <= 2);

            response.CsatAnalysis = new ServiceCsatAnalysisDto
            {
                OverallSatisfactionRate = csatTotal > 0 ? Math.Round((double)satisfiedCount2 / csatTotal * 100, 2) : 0,
                AvgRating = csatTotal > 0 ? Math.Round(csatRatings.Average(r => (double)r.Rating), 2) : 0,
                TotalRatings = csatTotal,
                Distribution = new List<ServiceCsatDistributionItemDto>
                {
                    new() { Category = "Satisfied", Count = satisfiedCount2, Percentage = csatTotal > 0 ? Math.Round((double)satisfiedCount2 / csatTotal * 100, 2) : 0 },
                    new() { Category = "Neutral", Count = neutralCount, Percentage = csatTotal > 0 ? Math.Round((double)neutralCount / csatTotal * 100, 2) : 0 },
                    new() { Category = "Dissatisfied", Count = dissatisfiedCount, Percentage = csatTotal > 0 ? Math.Round((double)dissatisfiedCount / csatTotal * 100, 2) : 0 },
                },
                Trend = groups.Select(bucket =>
                    {
                        var br = csatRatings.Where(r => r.CreatedOn.HasValue && r.CreatedOn.Value.Date >= bucket.Start && r.CreatedOn.Value.Date <= bucket.End).ToList();
                        var bt = br.Count;
                        return new ServiceCsatTrendPointDto
                        {
                            Period = TrendChartHelper.GetFormatDate(bucket.Start, bucket.End, unit),
                            SatisfactionRate = bt > 0 ? Math.Round((double)br.Count(r => r.Rating >= 4) / bt * 100, 2) : 0,
                            NeutralRate = bt > 0 ? Math.Round((double)br.Count(r => r.Rating == 3) / bt * 100, 2) : 0,
                            DissatisfactionRate = bt > 0 ? Math.Round((double)br.Count(r => r.Rating <= 2) / bt * 100, 2) : 0,
                        };
                    }).ToList()
            };

            return response;
        }

        public async Task<ContentDashboardStatisticsResponse> GetContentDashboardStatisticsAsync(int days, DateTime? startDate = null, DateTime? endDate = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;

            // 1. Total Publish Services (Department 2)
            var trendResult = TrendChartHelper.GetTrendGroups(start, end);
            string unit = trendResult.Unit;
            var groups = trendResult.Groups;

            // 2. Total Applications: same total as content team-management applications todo + completed.
            var totalApplications = await GetContentTeamManagementApplicationsTotalAsync(start, end);

            // 3. Revenue and Refunds from Transactions table (Department 2)
            var transactionsQuery = from t in _db.Transactions
                                    // Join by the unambiguous (backfilled) ApplicationId so shared ApplicationNumbers don't fan-out revenue.
                                    join app in _db.Applications on t.ApplicationId equals (int?)app.Id
                                    join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                    where t.StatusId == 3 && t.CreatedOn >= start && t.CreatedOn <= end && svc.Department == (int)DepartmentEnum.Content
                                    select new { t.TransactionTypeId, t.Amount, t.CreatedOn };

            var transactions = await transactionsQuery.ToListAsync();

            var serviceFees = transactions.Where(t => t.TransactionTypeId == 2).Sum(t => t.Amount);
            var fines = transactions.Where(t => t.TransactionTypeId == 3).Sum(t => t.Amount);
            var refunds = transactions.Where(t => t.TransactionTypeId == 4).Sum(t => t.Amount);

            var totalRevenue = serviceFees + fines - refunds;
            var refundApplications = transactions.Count(t => t.TransactionTypeId == 4);

            var permitsIssued = (await _licenseManagementService.GetLicenseStatisticsAsync(
                null,
                null,
                (int)DepartmentEnum.Content)).Total;
            
            var response = new ContentDashboardStatisticsResponse
            {
                PermitsIssued = permitsIssued,
                TotalApplications = totalApplications,
                TotalRevenue = totalRevenue,
                RefundApplications = refundApplications,
                // Satisfaction data is not yet collected; expose as missing (0) instead of mocking.
                AvgSatisfaction = 0
            };

            // Revenue Trend List (Reference to Application logic)
            foreach (var group in groups)
            {
                var dateStr = TrendChartHelper.GetFormatDate(group.Start, group.End, unit);
                var groupTransactions = transactions.Where(t => t.CreatedOn.Date >= group.Start && t.CreatedOn.Date <= group.End).ToList();
                var dServiceFees = groupTransactions.Where(t => t.TransactionTypeId == 2).Sum(t => t.Amount);

                response.RevenueTrendList.Add(new RevenueTrendDto
                {
                    Date = dateStr,
                    ServiceApplicationFees = dServiceFees,
                    Revenue = dServiceFees,
                    Unit = unit
                });
            }

            // Calculate Approval Rate (Department 2) at application final-result level.
            // Denominator covers terminal application outcomes, not every workflow node action.
            var approvedTerminalStatusIds = new[]
            {
                (int)ApprovalNodeOrder.Completed,
                (int)ApprovalNodeOrder.Approved
            };
            var terminalStatusIds = new[]
            {
                (int)ApprovalNodeOrder.Completed,
                (int)ApprovalNodeOrder.Rejected,
                (int)ApprovalNodeOrder.Cancelled,
                (int)ApprovalNodeOrder.Approved
            };
            
            var terminalApps = await (from app in _db.Applications
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                join proc in _db.CamundaProcessInstances on app.Id equals proc.ApplicationId
                where !app.IsDelete
                      && svc.Department == (int)DepartmentEnum.Content
                      && proc.StatusId.HasValue
                      && terminalStatusIds.Contains(proc.StatusId.Value)
                      && proc.EndTime != null
                      && proc.EndTime >= app.CreatedOn
                      && proc.EndTime >= start
                      && proc.EndTime <= end
                group new { app.CreatedOn, proc.EndTime, proc.StatusId } by app.Id into g
                select new
                {
                    AppCreatedOn = g.Min(x => x.CreatedOn),
                    EndedOn = g.Max(x => x.EndTime!.Value),
                    StatusId = g.OrderByDescending(x => x.EndTime).Select(x => x.StatusId.GetValueOrDefault()).First()
                })
                .ToListAsync().ConfigureAwait(false);
            
            var approvedCount = terminalApps.Count(x => approvedTerminalStatusIds.Contains(x.StatusId));
            response.ApprovalRate = terminalApps.Count > 0 ? Math.Round((double)approvedCount / terminalApps.Count * 100, 1) : 0;
            
            // AvgProcessingTime uses all terminal application outcomes in the selected period.
            var avgProcessingMinutes = terminalApps.Count > 0
                ? terminalApps.Average(x => (x.EndedOn - x.AppCreatedOn).TotalMinutes)
                : 0;
            
            response.AvgProcessingTime = ContentDashboardSharedSupportService.FormatDuration(avgProcessingMinutes, false);

            // AvgSatisfaction: satisfaction rate = count(Rating >= 4) / total * 100%.
            // Derived below from the CSAT query (csatRatings), which uses the SAME cohort
            // (Content department, CreatedOn in period) — avoids a duplicate ratings round-trip.

            // AI Recommendation (Dummy values)
            var random = new Random();
            response.AIRecommendation = new AIRecommendationOverviewDto
            {
                AIRecommendedApproval = random.Next(1, 100),
                AIRecommendedRejection = random.Next(1, 50),
                AIRecommendationAdoptionRate = Math.Round(random.NextDouble() * 100, 1)
            };

            // AI Tags Breakdown (Dummy values)
            var aiTags = new[]
            {
                "Artificial Sensitivity", "Religious Content", "LGBT+ Content, Royal Family",
                "Adult Content", "Violence/Hate Speech", "Child Protection",
                "Prohibited Words", "Malicious Content"
            };
            response.AITags = aiTags.Select(tag => new AITagBreakdownDto
            {
                Tag = tag,
                Percentage = Math.Round(random.NextDouble() * 20, 2)
            }).ToList();

            // Detailed Statistics
            // NOTE: only the columns actually consumed by the distributions below are projected.
            // The former UserTypes/Countries LEFT JOINs (and their UserTypeCode/UserTypeNameEn/
            // CountryId/CountryNameEn/EmirateNameEn columns) were dead weight — UserTypeId comes
            // straight from UserProfiles and EmirateStats resolves names from the Emirate lookup —
            // so both joins were dropped to cut query cost. ServiceCode is carried here so the media
            // material distribution below can reuse this cohort instead of re-querying it.
            var query = from app in _db.Applications
                        join s in _db.ServiceConfigs on app.ServiceId equals s.Id
                        join sc in _db.ServiceCategories on s.ServiceCategoryId equals sc.Id into scGroup
                        from sc in scGroup.DefaultIfEmpty()
                        join appDetail in _db.ApplicationDetails on app.Id equals appDetail.ApplicationId into appDetailGroup
                        from appDetail in appDetailGroup.DefaultIfEmpty()
                        join up in _db.UserProfiles on app.ProfileId equals up.Id into upGroup
                        from up in upGroup.DefaultIfEmpty()
                        join addr in _db.Address on up.AddressId equals addr.Id into addrGroup
                        from addr in addrGroup.DefaultIfEmpty()
                        join emirate in _db.Set<Emirate>() on (addr != null ? addr.EmirateId : (short)0) equals emirate.Id into emirateGroup
                        from emirate in emirateGroup.DefaultIfEmpty()
                        where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && s.Department == (int)DepartmentEnum.Content
                        select new
                        {
                            app.Id,
                            app.CreatedOn,
                            app.ServiceCode,
                            ServiceCategoryNameEn = sc != null ? sc.NameEn : "Unknown",
                            UserTypeId = up != null ? (short?)up.UserTypeId : null,
                            PlatformId = appDetail != null ? appDetail.PlatformId : (short?)null,
                            EmirateId = emirate != null ? (short?)emirate.Id : null
                        };

            var appData = await query.ToListAsync();
            // One row per application: the LEFT JOINs above (notably ApplicationDetails/Address) can
            // fan a single application into multiple rows. Collapse to DISTINCT applications so every
            // distribution below shares the SAME denominator as TotalApplications.
            appData = appData.GroupBy(x => x.Id).Select(g => g.First()).ToList();
            var totalApplicationsForDistribution = appData.Count;

            // Status/User Type Stats
            // Classify by UserTypeId (resolved via Applications.ProfileId -> UserProfiles.UserTypeId,
            // which maps to Lookup.UserTypes). Matching by the English name was fragile: a broken
            // profile/name join fell back to "Unknown" and dropped valid establishment applicants
            // (e.g. usertype=2 Commercial), so those rows never showed up.
            var targetUserTypes = new (string Name, short Id)[]
            {
                ("Commercial", (short)UserTypeCode.Commercial),
                ("Individual", (short)UserTypeCode.Individual),
                ("Government", (short)UserTypeCode.Government),
                ("Free Zone", (short)UserTypeCode.FreeZone),
                ("Talent Agency", (short)UserTypeIdEnum.TalentAgency),
                ("Embassy", (short)UserTypeIdEnum.Embassy),
                ("Consulate", (short)UserTypeIdEnum.Consulate),
                ("Cultural Clubs", (short)UserTypeIdEnum.CulturalClubs),
            };

            int CountByUserTypeId(short id) => appData.Count(p => p.UserTypeId == id);

            var commercialCount = CountByUserTypeId((short)UserTypeCode.Commercial);
            var individualCount = CountByUserTypeId((short)UserTypeCode.Individual);
            var governmentCount = CountByUserTypeId((short)UserTypeCode.Government);
            var freeZoneCount = CountByUserTypeId((short)UserTypeCode.FreeZone);
            var talentAgencyCount = CountByUserTypeId((short)UserTypeIdEnum.TalentAgency);
            var embassyCount = CountByUserTypeId((short)UserTypeIdEnum.Embassy);
            var consulateCount = CountByUserTypeId((short)UserTypeIdEnum.Consulate);
            var culturalClubsCount = CountByUserTypeId((short)UserTypeIdEnum.CulturalClubs);
            var totalCalculated = commercialCount + individualCount + governmentCount + freeZoneCount + talentAgencyCount + embassyCount + consulateCount + culturalClubsCount;

            response.StatusStats = new UserProfileStatusStatsDto
            {
                Commercial = commercialCount,
                Individual = individualCount,
                Government = governmentCount,
                FreeZone = freeZoneCount,
                TalentAgency = talentAgencyCount,
                Embassy = embassyCount,
                Consulate = consulateCount,
                CulturalClubs = culturalClubsCount,
                // Total = full application count so statusStats total equals TotalApplications; the
                // named fields only cover the 8 known UserTypes (unknowns are the remainder).
                Total = totalApplicationsForDistribution
            };

            // TypeStats (User Type distribution). Denominator = full application count so the list
            // sums to TotalApplications; applications outside the 8 known UserTypes go to "Unknown".
            response.TypeStats = targetUserTypes.Select(type =>
            {
                var count = CountByUserTypeId(type.Id);
                return new ApplicationTypeStatsDto
                {
                    TypeName = type.Name,
                    Count = count,
                    Percentage = totalApplicationsForDistribution > 0 ? Math.Round((double)count / totalApplicationsForDistribution * 100, 2) : 0
                };
            }).ToList();
            var unknownTypeCount = totalApplicationsForDistribution - totalCalculated;
            if (unknownTypeCount > 0)
            {
                response.TypeStats.Add(new ApplicationTypeStatsDto
                {
                    TypeName = "Unknown",
                    Count = unknownTypeCount,
                    Percentage = totalApplicationsForDistribution > 0 ? Math.Round((double)unknownTypeCount / totalApplicationsForDistribution * 100, 2) : 0
                });
            }

            // Service Category Stats
            // NOTE: Emirate/Category percentages must use the full application count as the
            // denominator (every row in appData belongs to some emirate bucket and some/no
            // category), NOT totalCalculated. totalCalculated only sums the 8 known UserTypes,
            // so rows with a null/other UserType are excluded from it — using it here made a
            // single emirate's share exceed 100%.
            var categories = new[] { "Film & Content Production", "Publication & Distribution", "Media Licensing", "Digital & Social Media", "Video Games", "Foreign Media & Correspondents" };
            response.CategoryStats = categories.Select(cat => new ServiceCategoryStatsDto
            {
                CategoryName = cat,
                Count = appData.Count(p => p.ServiceCategoryNameEn != null && p.ServiceCategoryNameEn.Contains(cat, StringComparison.OrdinalIgnoreCase)),
                Percentage = totalApplicationsForDistribution > 0 ? Math.Round((double)appData.Count(p => p.ServiceCategoryNameEn != null && p.ServiceCategoryNameEn.Contains(cat, StringComparison.OrdinalIgnoreCase)) / totalApplicationsForDistribution * 100, 2) : 0
            }).ToList();
            // Unknown bucket: applications whose service category matches none of the fixed labels,
            // so CategoryStats sums to TotalApplications.
            var categorizedCount = response.CategoryStats.Sum(c => c.Count);
            var uncategorizedCount = totalApplicationsForDistribution - categorizedCount;
            if (uncategorizedCount > 0)
            {
                response.CategoryStats.Add(new ServiceCategoryStatsDto
                {
                    CategoryName = "Unknown",
                    Count = uncategorizedCount,
                    Percentage = totalApplicationsForDistribution > 0 ? Math.Round((double)uncategorizedCount / totalApplicationsForDistribution * 100, 2) : 0
                });
            }

            // Emirate Stats
            var allEmirates = await _db.Set<Emirate>().ToListAsync();
            var emirateGroups = appData.GroupBy(p => p.EmirateId)
                .Select(g => new
                {
                    EmirateId = g.Key,
                    Count = g.Count()
                })
                .ToList();

            foreach (var e in allEmirates)
            {
                var count = emirateGroups.FirstOrDefault(x => x.EmirateId == e.Id)?.Count ?? 0;
                response.EmirateStats.Add(new UserProfileEmirateStatsDto
                {
                    Emirate = e.NameEn,
                    Count = count,
                    Percentage = totalApplicationsForDistribution > 0 ? Math.Round((double)count / totalApplicationsForDistribution * 100, 2) : 0
                });
            }
            // Foreign
            var foreignCount = emirateGroups.FirstOrDefault(x => x.EmirateId == null)?.Count ?? 0;
            response.EmirateStats.Add(new UserProfileEmirateStatsDto
            {
                Emirate = "Foreign",
                Count = foreignCount,
                Percentage = totalApplicationsForDistribution > 0 ? Math.Round((double)foreignCount / totalApplicationsForDistribution * 100, 2) : 0
            });

            // Device Stats — Web/Mobile/Tablet + Unknown so the buckets sum to TotalApplications.
            var webDeviceCount = appData.Count(p => p.PlatformId == 1);
            var mobileDeviceCount = appData.Count(p => p.PlatformId == 2);
            var tabletDeviceCount = appData.Count(p => p.PlatformId == 3);
            response.DeviceStats = new List<UserProfileDeviceStatsDto>
            {
                new UserProfileDeviceStatsDto { DeviceType = "Web", Count = webDeviceCount },
                new UserProfileDeviceStatsDto { DeviceType = "Mobile", Count = mobileDeviceCount },
                new UserProfileDeviceStatsDto { DeviceType = "Tablet", Count = tabletDeviceCount }
            };
            var unknownDeviceCount = totalApplicationsForDistribution - (webDeviceCount + mobileDeviceCount + tabletDeviceCount);
            if (unknownDeviceCount > 0)
            {
                response.DeviceStats.Add(new UserProfileDeviceStatsDto { DeviceType = "Unknown", Count = unknownDeviceCount });
            }

            // Trend Stats — count Content dept APPLICATIONS per bucket by application creation date
            // (Applications.CreatedOn), NOT paid transactions. Every application lands in exactly one
            // bucket, so the trend total equals TotalApplications.
            foreach (var group in groups)
            {
                var dateStr = TrendChartHelper.GetFormatDate(group.Start, group.End, unit);
                response.TrendStats.Add(new UserProfileTrendStatsDto
                {
                    Date = dateStr,
                    ApprovedCount = appData.Count(a => a.CreatedOn.Date >= group.Start && a.CreatedOn.Date <= group.End),
                    Unit = unit
                });
            }

            // Revenue Trend (Synchronized with Trend Stats)
            response.RevenueTrendList = groups.Select(group =>
            {
                var dateStr = TrendChartHelper.GetFormatDate(group.Start, group.End, unit);
                var groupTransactions = transactions.Where(t => t.CreatedOn.Date >= group.Start && t.CreatedOn.Date <= group.End).ToList();
                var dServiceFees = groupTransactions.Where(t => t.TransactionTypeId == 2).Sum(t => t.Amount);

                return new RevenueTrendDto
                {
                    Date = dateStr,
                    ServiceApplicationFees = dServiceFees,
                    Revenue = dServiceFees,
                    Unit = unit
                };
            }).ToList();

            // Application Status Distribution by ApprovalNodeOrder
            var statusMapping = new (int nodeOrder, string statusName)[]
            {
                ((int)ApprovalNodeOrder.InitialApproval, "Pending Initial Approval"),
                ((int)ApprovalNodeOrder.FinalApproval, "Pending Final Approval"),
                ((int)ApprovalNodeOrder.ExternalApproval, "Pending External Approval"),
                ((int)ApprovalNodeOrder.PendingPayment, "Pending Material Submission"),
                ((int)ApprovalNodeOrder.Rejected, "Rejected"),
                ((int)ApprovalNodeOrder.Completed, "Completed"),
                ((int)ApprovalNodeOrder.Cancelled, "Cancelled"),
            };

            // ONE status per application over the SAME cohort as TotalApplications. An application can
            // have multiple (or zero) process instances, so take the latest instance's StatusId per
            // application; applications with no status or a status outside the mapped buckets fall into
            // "Unknown". The buckets therefore always sum to TotalApplications.
            var statusCohortAppIds = appData.Select(a => a.Id).ToList();
            var statusRows = await (from proc in _db.CamundaProcessInstances
                where statusCohortAppIds.Contains(proc.ApplicationId) && proc.StatusId.HasValue
                select new { proc.ApplicationId, proc.StatusId, proc.StartTime })
                .ToListAsync().ConfigureAwait(false);
            var statusByApp = statusRows
                .GroupBy(x => x.ApplicationId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.StartTime).First().StatusId!.Value);

            var totalStatusApps = totalApplicationsForDistribution;
            var statusDistribution = statusMapping.Select(s =>
            {
                var count = appData.Count(a => statusByApp.TryGetValue(a.Id, out var sid) && sid == s.nodeOrder);
                return new Dtos.Application.ApplicationStatusDistributionDto
                {
                    StatusName = s.statusName,
                    Count = count,
                    Percentage = totalStatusApps > 0 ? Math.Round((double)count / totalStatusApps * 100, 2) : 0,
                    TaskStatusId = s.nodeOrder
                };
            }).ToList();
            var classifiedStatusCount = statusDistribution.Sum(x => x.Count);
            var unknownStatusCount = totalStatusApps - classifiedStatusCount;
            if (unknownStatusCount > 0)
            {
                statusDistribution.Add(new Dtos.Application.ApplicationStatusDistributionDto
                {
                    StatusName = "Unknown",
                    Count = unknownStatusCount,
                    Percentage = totalStatusApps > 0 ? Math.Round((double)unknownStatusCount / totalStatusApps * 100, 2) : 0,
                    TaskStatusId = null
                });
            }
            response.ApplicationStatusDistribution = statusDistribution;

            // ── Media Material Type Distribution (by ServiceCode) ──
            // Single source of truth: appsettings ServerLibraryMapping
            var mediaMaterialMapping = _configuration.GetSection("ServerLibraryMapping")
                .GetChildren()
                .ToDictionary(c => c.Key, c => c.Get<string[]>() ?? Array.Empty<string>());
            var allMediaCodes = mediaMaterialMapping.Values.SelectMany(v => v).ToHashSet();
            // Base on ALL cohort applications (same filter as TotalApplications), classify by ServiceCode
            // via the mapping, and route any application whose ServiceCode is null/empty or absent from
            // the mapping into "Unknown". The buckets therefore sum to TotalApplications.
            // Reuse the already-materialized cohort (appData) instead of re-querying Applications;
            // ServiceCode is projected there, and appData is DISTINCT per application.
            var contentAppCodes = appData.Select(a => a.ServiceCode).ToList();
            var mediaTotalCount = contentAppCodes.Count;
            response.MediaMaterialTypeDistribution = mediaMaterialMapping.Select(kvp =>
            {
                var count = contentAppCodes.Count(sc => !string.IsNullOrEmpty(sc) && kvp.Value.Contains(sc));
                return new MediaMaterialTypeDistributionDto
                {
                    TypeName = kvp.Key,
                    Count = count,
                    Percentage = mediaTotalCount > 0 ? Math.Round((double)count / mediaTotalCount * 100, 2) : 0
                };
            }).ToList();
            var classifiedMediaCount = contentAppCodes.Count(sc => !string.IsNullOrEmpty(sc) && allMediaCodes.Contains(sc));
            var unknownMediaCount = mediaTotalCount - classifiedMediaCount;
            if (unknownMediaCount > 0)
            {
                response.MediaMaterialTypeDistribution.Add(new MediaMaterialTypeDistributionDto
                {
                    TypeName = "Unknown",
                    Count = unknownMediaCount,
                    Percentage = mediaTotalCount > 0 ? Math.Round((double)unknownMediaCount / mediaTotalCount * 100, 2) : 0
                });
            }

            // ── CSAT Analysis: three-state distribution + trend ──
            var csatRatings = await (
                from rating in _db.Set<UserServiceRating>()
                // ReferenceNo now stores the unambiguous ApplicationId (as string); match it to Application.Id.
                join app in _db.Applications on rating.ReferenceNo equals app.Id.ToString()
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                where svc.Department == (int)DepartmentEnum.Content
                      && rating.CreatedOn >= start && rating.CreatedOn <= end
                select new { rating.Rating, rating.CreatedOn }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            var csatTotal = csatRatings.Count;
            var satisfiedCount = csatRatings.Count(r => r.Rating >= 4);
            var neutralCount = csatRatings.Count(r => r.Rating == 3);
            var dissatisfiedCount = csatRatings.Count(r => r.Rating <= 2);

            // AvgSatisfaction shares the CSAT cohort: satisfied (Rating >= 4) over total.
            response.AvgSatisfaction = csatTotal == 0 ? 0 : Math.Round((double)satisfiedCount / csatTotal * 100, 1);

            response.CsatAnalysis = new ServiceCsatAnalysisDto
            {
                OverallSatisfactionRate = csatTotal > 0 ? Math.Round((double)satisfiedCount / csatTotal * 100, 2) : 0,
                AvgRating = csatTotal > 0 ? Math.Round(csatRatings.Average(r => (double)r.Rating), 2) : 0,
                TotalRatings = csatTotal,
                Distribution = new List<ServiceCsatDistributionItemDto>
                {
                    new() { Category = "Satisfied", Count = satisfiedCount, Percentage = csatTotal > 0 ? Math.Round((double)satisfiedCount / csatTotal * 100, 2) : 0 },
                    new() { Category = "Neutral", Count = neutralCount, Percentage = csatTotal > 0 ? Math.Round((double)neutralCount / csatTotal * 100, 2) : 0 },
                    new() { Category = "Dissatisfied", Count = dissatisfiedCount, Percentage = csatTotal > 0 ? Math.Round((double)dissatisfiedCount / csatTotal * 100, 2) : 0 },
                },
                Trend = groups.Select(bucket =>
                    {
                        var br = csatRatings.Where(r => r.CreatedOn.HasValue && r.CreatedOn.Value.Date >= bucket.Start && r.CreatedOn.Value.Date <= bucket.End).ToList();
                        var bt = br.Count;
                        return new ServiceCsatTrendPointDto
                        {
                            Period = TrendChartHelper.GetFormatDate(bucket.Start, bucket.End, unit),
                            SatisfactionRate = bt > 0 ? Math.Round((double)br.Count(r => r.Rating >= 4) / bt * 100, 2) : 0,
                            NeutralRate = bt > 0 ? Math.Round((double)br.Count(r => r.Rating == 3) / bt * 100, 2) : 0,
                            DissatisfactionRate = bt > 0 ? Math.Round((double)br.Count(r => r.Rating <= 2) / bt * 100, 2) : 0,
                        };
                    }).ToList()
            };

            // ── Confirmation Method Stats (real data) ──
            // Cohort: Content-department applications whose workflow reached Completed within the
            // SAME time window used by ApprovalRate/AvgProcessingTime above (CamundaProcessInstance.EndTime
            // in [start, end]). Each completed application is classified by how its approval was confirmed:
            //   • AutoApproved   — green-label system auto-approval (ApprovalRecord.NodeType == "AutoApproved",
            //                       ApproverId == SelfMonitorSystemRole.FallbackAssigneeId "auto")
            //   • SelfMonitored  — Service 204 self-monitoring program (NodeType == "AutoApproved",
            //                       ApproverId == SelfMonitorSystemRole.MemberFilterId "self-monitor")
            //   • ManuallyConfirmed — residual: completed but confirmed by content-dept staff (no auto record).
            var cmCompletedAppIds = await (from app in _db.Applications
            join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
            join proc in _db.CamundaProcessInstances on app.Id equals proc.ApplicationId
            where !app.IsDelete
                && svc.Department == (int)DepartmentEnum.Content
                && proc.StatusId == (int)ApprovalNodeOrder.Completed
                && proc.EndTime != null
                && proc.EndTime >= start
                && proc.EndTime <= end
            select app.Id)
            .Distinct()
            .ToListAsync().ConfigureAwait(false);

            var cmTotal = cmCompletedAppIds.Count;

            // Pull the per-task "AutoApproved" approval rows for the cohort; the ApproverId string tells the
            // two automated paths apart. One application only needs one such record to be classified.
            var cmAutoRows = cmTotal > 0
            ? await _db.ApprovalRecords
            .Where(r => cmCompletedAppIds.Contains(r.ApplicationId)
                && r.NodeType == TimelineNodeTypes.AutoApproved)
            .Select(r => new { r.ApplicationId, r.ApproverId })
            .ToListAsync().ConfigureAwait(false)
            : new();

            var cmSelfIds = cmAutoRows
            .Where(r => SelfMonitorSystemRole.IsSelfMonitorRoleValue(r.ApproverId))
            .Select(r => r.ApplicationId)
            .Distinct()
            .ToHashSet();
            var cmAutoIds = cmAutoRows
            .Where(r => !cmSelfIds.Contains(r.ApplicationId)
                && string.Equals(r.ApproverId, SelfMonitorSystemRole.FallbackAssigneeId, StringComparison.OrdinalIgnoreCase))
            .Select(r => r.ApplicationId)
            .Distinct()
            .ToHashSet();

            var cmSelf = cmSelfIds.Count;
            var cmAuto = cmAutoIds.Count;
            var cmManual = cmTotal - cmSelf - cmAuto;
            response.ConfirmationMethodStats = new ServiceConfirmationMethodStatsDto
            {
            Total = cmTotal,
            SelfMonitored = cmSelf,
            SelfMonitoredPercentage = cmTotal > 0 ? Math.Round((double)cmSelf / cmTotal * 100, 2) : 0,
            AutoApproved = cmAuto,
            AutoApprovedPercentage = cmTotal > 0 ? Math.Round((double)cmAuto / cmTotal * 100, 2) : 0,
            ManuallyConfirmed = cmManual,
            ManuallyConfirmedPercentage = cmTotal > 0 ? Math.Round((double)cmManual / cmTotal * 100, 2) : 0
            };

            // ── SLA Performance & Team Performance Trend (from CamundaTasks) ──
            // Task-level definition (docs/analytics/team-management-members-avg-processing-time.md §1-2):
            // Source = Workflow.CamundaTasks (Content department, time window by CreatedTime, ApprovalAt non-null);
            // single-task completion time = ApprovalAt (EndTime); processing duration prefers ApprovalRecords.ActualDurationMinutes,
            // falls back to (ApprovalAt − CreatedTime); SLA compliance judged by task DueDate.
            var slaTaskRows = await (
                from t in _db.CamundaTasks
                join cpi in _db.CamundaProcessInstances on t.ProcessInstanceId equals cpi.ProcessInstanceId
                join app in _db.Applications on cpi.ApplicationId equals app.Id
                join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                where !app.IsDelete && svc.Department == (int)DepartmentEnum.Content
                      && t.CreatedTime >= start && t.CreatedTime <= end
                      && t.ApprovalAt != null
                select new { t.TaskId, t.CreatedTime, t.ApprovalAt, t.DueDate }
            ).AsNoTracking().ToListAsync().ConfigureAwait(false);

            // Preferred processing-duration source: ApprovalRecords.ActualDurationMinutes (latest ApprovalDate per TaskId).
            var slaTaskIds = slaTaskRows.Select(t => t.TaskId).Distinct().ToList();
            var slaDurationMap = slaTaskIds.Any()
                ? (await _db.ApprovalRecords
                        .Where(r => r.TaskId != null && slaTaskIds.Contains(r.TaskId) && r.ApprovalDate != null)
                        .Select(r => new { r.TaskId, r.ApprovalDate, r.ActualDurationMinutes })
                        .ToListAsync())
                    .GroupBy(r => r.TaskId!)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.ApprovalDate).First().ActualDurationMinutes)
                : new Dictionary<string, double?>();

            var completedNodes = slaTaskRows.Select(t => (
                CompletedAt: t.ApprovalAt!.Value,
                ProcessingMinutes: ResolveTaskProcessingMinutes(
                    t.CreatedTime,
                    t.ApprovalAt,
                    slaDurationMap.TryGetValue(t.TaskId, out var dur) ? dur : null),
                SlaCompliant: t.DueDate.HasValue && t.ApprovalAt!.Value <= t.DueDate.Value
            )).Where(x => x.CompletedAt >= start && x.CompletedAt <= end).ToList();

            var slaTotalCompleted = completedNodes.Count;
            var slaCompliant = completedNodes.Count(x => x.SlaCompliant);
            var slaBreached = slaTotalCompleted - slaCompliant;
            var avgProcMinutes = completedNodes.Any()
                ? completedNodes.Average(x => x.ProcessingMinutes) : 0;

            var slaTrendGroups = TrendChartHelper.GetTrendGroups(start, end);
            response.SlaPerformance = new ServiceSlaPerformanceDto
            {
                SlaComplianceRate = slaTotalCompleted > 0 ? Math.Round((double)slaCompliant / slaTotalCompleted * 100, 2) : 100,
                SlaBreachRate = slaTotalCompleted > 0 ? Math.Round((double)slaBreached / slaTotalCompleted * 100, 2) : 0,
                AvgProcessingTimeDays = Math.Round(avgProcMinutes / 1440, 2),
                TotalCompleted = slaTotalCompleted,
                SlaCompliant = slaCompliant,
                SlaBreached = slaBreached,
                Trend = slaTrendGroups.Groups.Select(bucket =>
                {
                    var bucketNodes = completedNodes.Where(x => x.CompletedAt.Date >= bucket.Start && x.CompletedAt.Date <= bucket.End).ToList();
                    var bt = bucketNodes.Count;
                    var bc = bucketNodes.Count(x => x.SlaCompliant);
                    var bavg = bucketNodes.Any() ? bucketNodes.Average(x => x.ProcessingMinutes) / 1440 : 0;
                    return new ServiceSlaPerformanceTrendPointDto
                    {
                        Period = TrendChartHelper.GetFormatDate(bucket.Start, bucket.End, slaTrendGroups.Unit),
                        SlaComplianceRate = bt > 0 ? Math.Round((double)bc / bt * 100, 2) : 100,
                        AvgProcessingTimeDays = Math.Round(bavg, 2)
                    };
                }).ToList()
            };

            return response;
        }
        
        // Unified "applications in period" count for the Content dashboards.
        // Canonical time anchor: [Application].[Applications].[CreatedOn] — the SAME table and column
        // used by GetPeriodMetricsBatchAsync (service/list) and GetDepartmentTasksAsync (team/list).
        // This keeps the statistics TotalApplications total consistent with the other two Content
        // dashboards, instead of the previous team-management read-model LastUpdatedOn window (a
        // different table/column whose count could never line up).
        private async Task<int> GetContentTeamManagementApplicationsTotalAsync(DateTime start, DateTime end)
        {
            return await (from app in _db.Applications
                          join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                          where !app.IsDelete
                                && app.CreatedOn >= start && app.CreatedOn <= end
                                && svc.Department == (int)DepartmentEnum.Content
                          select app.Id)
                          .CountAsync();
        }
        
        public async Task<PageResponse<ContentServiceDashboardListDto>> GetContentServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc")
        {
            var data = await GetContentServiceDashboardListInternalAsync(days, startDate, endDate, keyword, option);

            data = ApplySort(data, orderby, sort, new Dictionary<string, Func<ContentServiceDashboardListDto, IComparable>>
            {
                ["applications"] = x => x.Applications,
                ["totalrevenue"] = x => x.TotalRevenue,
                ["approvalrate"] = x => x.ApprovalRate,
                ["avgprocessingtime"] = x => x.AvgProcessingTimeMinutes,
                ["avgsatisfaction"] = x => x.AvgSatisfaction,
                ["refundapplications"] = x => x.RefundApplications,
                ["totalrefunds"] = x => x.TotalRefunds,
                ["refundrate"] = x => x.RefundRate,
            });

            var total = data.Count;
            var items = data.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToList();

            return new PageResponse<ContentServiceDashboardListDto>(items, total, pageIndex, pageSize);
        }

        public async Task<byte[]> ExportContentServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, string? orderby = null, string? sort = "desc")
        {
            var data = await GetContentServiceDashboardListInternalAsync(days, startDate, endDate, keyword, option);

            data = ApplySort(data, orderby, sort, new Dictionary<string, Func<ContentServiceDashboardListDto, IComparable>>
            {
                ["applications"] = x => x.Applications,
                ["totalrevenue"] = x => x.TotalRevenue,
                ["approvalrate"] = x => x.ApprovalRate,
                ["avgprocessingtime"] = x => x.AvgProcessingTimeMinutes,
                ["avgsatisfaction"] = x => x.AvgSatisfaction,
                ["refundapplications"] = x => x.RefundApplications,
                ["totalrefunds"] = x => x.TotalRefunds,
                ["refundrate"] = x => x.RefundRate,
            });

            var headers = new List<string>
            {
                option == "AllCategories" ? "Service Category" : "Service Name",
                "Applications",
                "Total Revenue",
                "Approval Rate (%)",
                "Avg Processing Time (d)",
                "Avg Satisfaction (%)",
                "AI Approved",
                "AI Rejected",
                "Refund Applications",
                "Total Refunds",
                "Refund Rate (%)"
            };

            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
                    foreach (var item in data)
                    {
                        var row = new List<string>
                        {
                            option == "AllCategories" ? item.ServiceCategory ?? "" : item.ServiceName,
                            item.Applications.ToString(),
                            item.TotalRevenue.ToString("F2"),
                            $"{item.ApprovalRate:F1}%",
                            item.AvgProcessingTime,
                            $"{item.AvgSatisfaction:F1}%",
                            item.AIApproved.ToString(),
                            item.AIRejected.ToString(),
                            item.RefundApplications.ToString(),
                            item.TotalRefunds.ToString("F2"),
                            $"{item.RefundRate:F1}%"
                        };
                        sw.WriteLine(string.Join(",", row.Select(cell => $"\"{cell.Replace("\"", "\"\"")}\"")));
                    }
                }
                return ms.ToArray();
            }
        }

        private async Task<List<ContentServiceDashboardListDto>> GetContentServiceDashboardListInternalAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var duration = end - start;
            var prevStart = start.Add(-duration);
            var prevEnd = start;

            // 1. Get Base Services/Categories for Department 2
            var servicesQuery = _db.ServiceConfigs
                .Where(s => s.Department == (int)DepartmentEnum.Content && s.IsCurrentVersion && s.Status == "5");

            if (option == "AllCategories")
            {
                var categories = await (from s in servicesQuery
                                        join c in _db.ServiceCategories on s.ServiceCategoryId equals c.Id
                                        select new { c.Id, c.NameEn })
                                        .Distinct()
                                        .ToListAsync();

                if (!string.IsNullOrEmpty(keyword))
                {
                    categories = categories.Where(c => c.NameEn.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                // Batch-aggregate metrics for all categories in one set of queries (eliminates the per-category N+1).
                var currentBatch = await GetPeriodMetricsBatchAsync(2, true, start, end);
                var prevBatch = await GetPeriodMetricsBatchAsync(2, true, prevStart, prevEnd);

                var list = new List<ContentServiceDashboardListDto>();
                foreach (var cat in categories)
                {
                    var dto = BuildContentServiceDashboardDto(
                        currentBatch.GetValueOrDefault(cat.Id, EmptyPeriodMetrics),
                        prevBatch.GetValueOrDefault(cat.Id, EmptyPeriodMetrics));
                    dto.ServiceCategory = cat.NameEn;
                    dto.ServiceName = "";
                    list.Add(dto);
                }
                return list;
            }
            else
            {
                var services = await servicesQuery.Select(s => new { s.Id, s.NameEn, s.ServiceCategoryId }).ToListAsync();
                if (!string.IsNullOrEmpty(keyword))
                {
                    services = services.Where(s => s.NameEn != null && s.NameEn.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                // Batch-aggregate metrics for all services in one set of queries (eliminates the per-service N+1).
                var currentBatch = await GetPeriodMetricsBatchAsync(2, false, start, end);
                var prevBatch = await GetPeriodMetricsBatchAsync(2, false, prevStart, prevEnd);

                var list = new List<ContentServiceDashboardListDto>();
                foreach (var svc in services)
                {
                    var dto = BuildContentServiceDashboardDto(
                        currentBatch.GetValueOrDefault(svc.Id, EmptyPeriodMetrics),
                        prevBatch.GetValueOrDefault(svc.Id, EmptyPeriodMetrics));
                    dto.ServiceName = svc.NameEn ?? "Unknown";
                    dto.ServiceCategory = null;
                    list.Add(dto);
                }
                return list;
            }
        }

        private ContentServiceDashboardListDto BuildContentServiceDashboardDto(
            (int Applications, decimal TotalRevenue, double ApprovalRate, double AvgProcessingTime, int RefundApplications, decimal TotalRefunds, double RefundRate, double AvgSatisfaction) currentData,
            (int Applications, decimal TotalRevenue, double ApprovalRate, double AvgProcessingTime, int RefundApplications, decimal TotalRefunds, double RefundRate, double AvgSatisfaction) prevData)
        {
            return new ContentServiceDashboardListDto
            {
                Applications = currentData.Applications,
                TotalRevenue = currentData.TotalRevenue,
                ApprovalRate = currentData.ApprovalRate,
                // AvgProcessingTime is derived only from Completed process instances; a real duration is
                // always > 0, so a value of 0 means "no completed processing in this window" (either no
                // applications, or none reached Completed). Surface that as "-" instead of "0m".
                AvgProcessingTime = currentData.AvgProcessingTime > 0
                    ? ContentDashboardSharedSupportService.FormatDuration(currentData.AvgProcessingTime, false)
                    : "-",
                // Numeric minutes backing value, used for orderby=AvgProcessingTime (the display
                // string above cannot be sorted lexically in a meaningful way).
                AvgProcessingTimeMinutes = currentData.AvgProcessingTime,
                RefundApplications = currentData.RefundApplications,
                TotalRefunds = currentData.TotalRefunds,
                RefundRate = currentData.RefundRate,
                // AvgSatisfaction: satisfaction rate (Rating >= 4) sourced from [Enquiry].[UserServiceRating].
                AvgSatisfaction = currentData.AvgSatisfaction,
                // AI metrics are not yet collected; expose as missing (0) instead of mocking.
                AIApproved = 0,
                AIRejected = 0
            };
        }


        // Batched version of GetPeriodMetricsAsync: aggregates every category (or service) for a
        // department in a fixed number of queries instead of one set of queries per row (N+1 fix).
        private async Task<Dictionary<short, (int Applications, decimal TotalRevenue, double ApprovalRate, double AvgProcessingTime, int RefundApplications, decimal TotalRefunds, double RefundRate, double AvgSatisfaction)>>
            GetPeriodMetricsBatchAsync(int department, bool groupByCategory, DateTime start, DateTime end)
        {
            var apps = await (from app in _db.Applications
                              join s in _db.ServiceConfigs on app.ServiceId equals s.Id
                              where !app.IsDelete && app.CreatedOn >= start && app.CreatedOn <= end && s.Department == department
                              select new { app.Id, app.ApplicationNumber, s.ServiceCategoryId, app.ServiceId, app.CreatedOn }).ToListAsync();

            var result = new Dictionary<short, (int, decimal, double, double, int, decimal, double, double)>();
            if (apps.Count == 0) return result;

            var appNumbers = apps.Select(a => a.ApplicationNumber).Distinct().ToList();
            var appIds = apps.Select(a => a.Id).ToList();
            // Application creation time is the processing-window start point (application/creation time).
            var appCreatedOnById = apps.ToDictionary(a => a.Id, a => a.CreatedOn);

            var transactions = await _db.Transactions
                .Where(t => t.StatusId == 3 && t.CreatedOn >= start && t.CreatedOn <= end && appNumbers.Contains(t.ReferenceNumber))
                .Select(t => new { t.ReferenceNumber, t.TransactionTypeId, t.Amount })
                .ToListAsync();
            var txByRef = transactions.GroupBy(t => t.ReferenceNumber)
                .ToDictionary(g => g.Key, g => g.ToList());

            // RefundApplications / TotalRefunds are sourced from [Payment].[Refunds] (one row per refund
            // application), matched to the cohort applications by the application number.
            // IMPORTANT: the application's number is stored in [Payment].[Refunds].[ReferenceNumber]
            // (which equals [Application].[Applications].[ApplicationNumber]), NOT in
            // [Payment].[Refunds].[ApplicationNumber] — that column holds the refund's own number
            // (e.g. "HC-02-2026-4950737"), which never matches an application and yields 0.
            // NOTE: no CreatedOn window filter here — a refund is almost always created AFTER the
            // application it belongs to, so filtering refunds by the application window would drop
            // every refund and yield 0. Cohort scoping already comes from appNumbers.
            var refunds = await _db.Refunds
                .Where(r => r.ReferenceNumber != null && appNumbers.Contains(r.ReferenceNumber))
                .Select(r => new { ApplicationNumber = r.ReferenceNumber, r.Amount })
                .ToListAsync();
            var refundByAppNumber = refunds.GroupBy(r => r.ApplicationNumber!)
                .ToDictionary(g => g.Key, g => g.ToList());

            var processInstances = await _db.CamundaProcessInstances
                .Where(p => appIds.Contains(p.ApplicationId))
                .Select(p => new { p.ApplicationId, p.StatusId, p.StartTime, p.EndTime })
                .ToListAsync();
            var piByApp = processInstances.GroupBy(p => p.ApplicationId)
                .ToDictionary(g => g.Key, g => g.ToList());

            // AvgProcessingTime = application end-to-end duration (application creation → final
            // completion), NOT a single node/process-instance duration. Aligned with the Licensing
            // endpoint algorithm: per application, take the latest Completed ApprovalDate from
            // [Workflow].[ApprovalRecords] and subtract the application creation time. An app only
            // contributes once it has actually reached Completed.
            var completedApprovalDateByApp = (await _db.ApprovalRecords
                    .Where(ar => appIds.Contains(ar.ApplicationId)
                        && (ar.InstanceStatusId == (int)ApprovalNodeOrder.Completed || ar.NodeType == "Completed")
                        && ar.ApprovalDate != null)
                    .Select(ar => new { ar.ApplicationId, ar.ApprovalDate })
                    .ToListAsync())
                .GroupBy(ar => ar.ApplicationId)
                .ToDictionary(g => g.Key, g => g.Max(x => x.ApprovalDate!.Value));

            // AvgSatisfaction: satisfaction rate = count(Rating >= 4) / total * 100, sourced from
            // [Enquiry].[UserServiceRating]. ReferenceNo stores the ApplicationId (as string).
            // NOTE: no CreatedOn window filter — a rating is submitted AFTER the application is created,
            // often outside the application window; scope by application association only.
            var appIdStrings = appIds.Select(id => id.ToString()).ToList();
            var ratings = await _db.UserServiceRatings
                .Where(r => r.ReferenceNo != null && appIdStrings.Contains(r.ReferenceNo))
                .Select(r => new { r.ReferenceNo, r.Rating })
                .ToListAsync();
            var ratingsByAppId = ratings
                .GroupBy(r => r.ReferenceNo!)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Rating).ToList());

            var groups = groupByCategory
                ? apps.GroupBy(a => a.ServiceCategoryId)
                : apps.GroupBy(a => a.ServiceId);

            foreach (var g in groups)
            {
                var groupApps = g.ToList();
                decimal revenue = 0, refundAmount = 0;
                int refundApps = 0;
                foreach (var a in groupApps)
                {
                    if (txByRef.TryGetValue(a.ApplicationNumber, out var txs))
                    {
                        revenue += txs.Where(t => t.TransactionTypeId == 2 || t.TransactionTypeId == 3).Sum(t => t.Amount);
                    }

                    // RefundApplications = count of [Payment].[Refunds] rows for this application;
                    // TotalRefunds = sum of their Amount.
                    if (refundByAppNumber.TryGetValue(a.ApplicationNumber, out var refs))
                    {
                        refundApps += refs.Count;
                        refundAmount += refs.Sum(r => r.Amount);
                    }
                }

                var groupPis = groupApps
                    .SelectMany(a => piByApp.TryGetValue(a.Id, out var pis) ? pis : new())
                    .ToList();

                var completed = groupPis.Count(p => p.StatusId == (int)ApprovalNodeOrder.Completed);
                var rejected = groupPis.Count(p => p.StatusId == (int)ApprovalNodeOrder.Rejected);
                var approvalRate = (completed + rejected) > 0 ? (double)completed / (completed + rejected) * 100 : 0;

                var processingTimes = groupApps
                    .Where(a => completedApprovalDateByApp.ContainsKey(a.Id))
                    // Application end-to-end duration in minutes: final Completed ApprovalDate − application creation time.
                    .Select(a => (completedApprovalDateByApp[a.Id] - appCreatedOnById[a.Id]).TotalMinutes)
                    .Where(m => m > 0)
                    .ToList();
                var avgProcessingTime = processingTimes.Any() ? processingTimes.Average() : 0;

                var refundRate = groupApps.Count > 0 ? (double)refundApps / groupApps.Count * 100 : 0;

                // AvgSatisfaction: satisfaction rate = count(Rating >= 4) / total * 100 across this group's applications.
                var groupRatings = groupApps
                    .SelectMany(a => ratingsByAppId.TryGetValue(a.Id.ToString(), out var rs) ? rs : new List<byte>())
                    .ToList();
                var avgSatisfaction = groupRatings.Count > 0
                    ? (double)groupRatings.Count(r => r >= 4) / groupRatings.Count * 100
                    : 0;

                result[g.Key] = (groupApps.Count, revenue, Math.Round(approvalRate, 1), Math.Round(avgProcessingTime, 1), refundApps, refundAmount, Math.Round(refundRate, 1), Math.Round(avgSatisfaction, 1));
            }

            return result;
        }

        public async Task<PageResponse<ApplicationServiceDashboardListDto>> GetServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc")
        {
            var data = await GetServiceDashboardListInternalAsync(days, startDate, endDate, keyword, option);

            data = ApplySort(data, orderby, sort, new Dictionary<string, Func<ApplicationServiceDashboardListDto, IComparable>>
            {
                ["applications"] = x => x.Applications,
                ["totalrevenue"] = x => x.TotalRevenue,
                ["approvalrate"] = x => x.ApprovalRate,
                ["avgprocessingtime"] = x => x.AvgProcessingTime,
                ["avgsatisfaction"] = x => x.AvgSatisfaction,
                ["refundapplications"] = x => x.RefundApplications,
                ["totalrefunds"] = x => x.TotalRefunds,
                ["refundrate"] = x => x.RefundRate,
            });

            var total = data.Count;
            var items = data.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToList();

            return new PageResponse<ApplicationServiceDashboardListDto>(items, total, pageIndex, pageSize);
        }
        public async Task<byte[]> ExportServiceDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null, string? orderby = null, string? sort = "desc")
        {
            var data = await GetServiceDashboardListInternalAsync(days, startDate, endDate, keyword, option);

            data = ApplySort(data, orderby, sort, new Dictionary<string, Func<ApplicationServiceDashboardListDto, IComparable>>
            {
                ["applications"] = x => x.Applications,
                ["totalrevenue"] = x => x.TotalRevenue,
                ["approvalrate"] = x => x.ApprovalRate,
                ["avgprocessingtime"] = x => x.AvgProcessingTime,
                ["avgsatisfaction"] = x => x.AvgSatisfaction,
                ["refundapplications"] = x => x.RefundApplications,
                ["totalrefunds"] = x => x.TotalRefunds,
                ["refundrate"] = x => x.RefundRate,
            });

            var headers = new List<string>
            {
                option == "AllCategories" ? "Service Category" : "Service Name",
                "Applications",
                "Total Revenue",
                "Approval Rate (%)",
                "Avg Processing Time (d)",
                "Avg Satisfaction (%)",
                "Refund Applications",
                "Total Refunds",
                "Refund Rate (%)"
            };

            using (var ms = new MemoryStream())
            {
                using (var sw = new StreamWriter(ms, Encoding.UTF8))
                {
                    sw.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
                    foreach (var item in data)
                    {
                        var row = new List<string>
                        {
                            option == "AllCategories" ? item.ServiceCategory ?? "" : item.ServiceName,
                            item.Applications.ToString(),
                            item.TotalRevenue.ToString("F2"),
                            $"{item.ApprovalRate:F1}%",
                            item.AvgProcessingTime,
                            $"{item.AvgSatisfaction:F1}%",
                            item.RefundApplications.ToString(),
                            item.TotalRefunds.ToString("F2"),
                            $"{item.RefundRate:F1}%"
                        };
                        sw.WriteLine(string.Join(",", row.Select(cell => $"\"{cell.Replace("\"", "\"\"")}\"")));
                    }
                }
                return ms.ToArray();
            }
        }
        private async Task<List<ApplicationServiceDashboardListDto>> GetServiceDashboardListInternalAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? option = null)
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var duration = end - start;
            var prevStart = start.Add(-duration);
            var prevEnd = start;

            // 1. Get Base Services/Categories for Department 1
            var servicesQuery = _db.ServiceConfigs
                .Where(s => s.Department == (int)DepartmentEnum.Licensing && s.IsCurrentVersion && s.Status == "5");

            if (option == "AllCategories")
            {
                var categories = await (from s in servicesQuery
                                        join c in _db.ServiceCategories on s.ServiceCategoryId equals c.Id
                                        select new { c.Id, c.NameEn })
                                        .Distinct()
                                        .ToListAsync();

                if (!string.IsNullOrEmpty(keyword))
                {
                    categories = categories.Where(c => c.NameEn.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                // Batch-aggregate metrics for all categories in one set of queries (eliminates the per-category N+1).
                var currentBatch = await GetPeriodMetricsBatchAsync(1, true, start, end);
                var prevBatch = await GetPeriodMetricsBatchAsync(1, true, prevStart, prevEnd);

                var list = new List<ApplicationServiceDashboardListDto>();
                foreach (var cat in categories)
                {
                    var dto = BuildServiceDashboardDto(
                        currentBatch.GetValueOrDefault(cat.Id, EmptyPeriodMetrics),
                        prevBatch.GetValueOrDefault(cat.Id, EmptyPeriodMetrics));
                    dto.ServiceCategory = cat.NameEn;
                    dto.ServiceName = "";
                    list.Add(dto);
                }
                return list;
            }
            else
            {
                var services = await servicesQuery.Select(s => new { s.Id, s.NameEn, s.ServiceCategoryId }).ToListAsync();
                if (!string.IsNullOrEmpty(keyword))
                {
                    services = services.Where(s => s.NameEn != null && s.NameEn.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                // Batch-aggregate metrics for all services in one set of queries (eliminates the per-service N+1).
                var currentBatch = await GetPeriodMetricsBatchAsync(1, false, start, end);
                var prevBatch = await GetPeriodMetricsBatchAsync(1, false, prevStart, prevEnd);

                var list = new List<ApplicationServiceDashboardListDto>();
                foreach (var svc in services)
                {
                    var dto = BuildServiceDashboardDto(
                        currentBatch.GetValueOrDefault(svc.Id, EmptyPeriodMetrics),
                        prevBatch.GetValueOrDefault(svc.Id, EmptyPeriodMetrics));
                    dto.ServiceName = svc.NameEn ?? "Unknown";
                    dto.ServiceCategory = null;
                    list.Add(dto);
                }
                return list;
            }
        }

        private static readonly (int Applications, decimal TotalRevenue, double ApprovalRate, double AvgProcessingTime, int RefundApplications, decimal TotalRefunds, double RefundRate, double AvgSatisfaction)
            EmptyPeriodMetrics = (0, 0m, 0d, 0d, 0, 0m, 0d, 0d);

        private ApplicationServiceDashboardListDto BuildServiceDashboardDto(
            (int Applications, decimal TotalRevenue, double ApprovalRate, double AvgProcessingTime, int RefundApplications, decimal TotalRefunds, double RefundRate, double AvgSatisfaction) currentData,
            (int Applications, decimal TotalRevenue, double ApprovalRate, double AvgProcessingTime, int RefundApplications, decimal TotalRefunds, double RefundRate, double AvgSatisfaction) prevData)
        {
            return new ApplicationServiceDashboardListDto
            {
                Applications = currentData.Applications,
                TotalRevenue = currentData.TotalRevenue,
                ApprovalRate = currentData.ApprovalRate,
                AvgProcessingTime = ContentDashboardSharedSupportService.FormatDuration(currentData.AvgProcessingTime, false),
                RefundApplications = currentData.RefundApplications,
                TotalRefunds = currentData.TotalRefunds,
                RefundRate = currentData.RefundRate,
                // Satisfaction data is not yet collected; expose as missing (0) instead of mocking.
                AvgSatisfaction = 0
            };
        }
        private async Task<List<MyTeamReviewPageResponse>> GetMyTeamReviewListAsync(string departmentId)
        {
            var user = await _userService.GetAsync(_currentUserService.UserId!);
            if (user == null)
                return new List<MyTeamReviewPageResponse>();

            var departmentIds = user.UserDepartments.Where(a => a.IsLeader ?? false).Select(a => a.DepartmentId + "").ToArray();
            if (departmentIds.Length == 0)
                return new List<MyTeamReviewPageResponse>();

            var taskList = await _camundaWorkflowDomainService.GetTaskListByDepartmentId(departmentIds);
            // DispositionCases.FinalDispositionStatusId holds DispositionVerificationStatus values
            // (1=PendingDisposition, 2=DispositionVerification, 3=Verified, 4=NotVerified).
            var dispositionCaseStatusIds = new int?[]
            {
                (int)DispositionVerificationStatus.PendingDisposition,
                (int)DispositionVerificationStatus.DispositionVerification,
                (int)DispositionVerificationStatus.Verified,
                (int)DispositionVerificationStatus.NotVerified
            };
            // Push the department filter down so only the current leader's department's
            // DispositionCases are loaded, instead of every department's rows.
            // This follows the same filter chain as GetListByIds(applicationIds, departmentId):
            // DispositionCase.ApplicationId -> Application.ServiceId -> ServiceConfig.Department == departmentId.
            // The result set is identical to the original logic (cases outside this department
            // were previously dropped via 'continue' when applicationLookup returned no application);
            // the only difference is the filter now runs in SQL so the DB no longer returns other departments' rows.
            var departmentIdInt = departmentId.ToInt();
            var deptApplicationIdQuery =
                from app in _db.Applications.AsNoTracking()
                join svc in _db.ServiceConfigs.AsNoTracking() on app.ServiceId equals svc.Id
                where svc.Department == departmentIdInt && app.IsDelete == false
                select app.Id;

            var dispositionCases = await _db.DispositionCases
                .AsNoTracking()
                .Where(x => dispositionCaseStatusIds.Contains(x.FinalDispositionStatusId))
                .Where(x => deptApplicationIdQuery.Contains(x.ApplicationId))
                .ToListAsync();
            var dispositionReviewerIds = await LoadDispositionReviewerIdsAsync(_db, dispositionCases);
            var dispositionAssignments = BuildDispositionAssignments(dispositionCases, dispositionReviewerIds);
            var dispositionReviewerNames = await LoadAdminUserDisplayNamesAsync(dispositionReviewerIds.Values);

            if (!taskList.Any() && !dispositionCases.Any())
                return new List<MyTeamReviewPageResponse>();

            var applicationIds = taskList.Where(a => a.ProcessInstance != null).Select(a => a.ProcessInstance.ApplicationId)
                .Concat(dispositionCases.Select(x => x.ApplicationId))
                .Distinct()
                .ToArray();
            var applicationList = await _applicationService.GetListByIds(applicationIds, departmentId);
            if (!applicationList.Any())
                return new List<MyTeamReviewPageResponse>();
            var serviceTypes = await _typeDictionaryService.GetListAsync("ServiceConfigServiceType");

            var profileIds = applicationList.Select(a => a.ProfileId).Where(a => a > 0).Distinct().ToArray();
            var applyForList = await _userService.GetEstablishmentsByProfileIdsAsync(profileIds);
            if (!applyForList.Any())
                return new List<MyTeamReviewPageResponse>();

            var assigneeUserIds = taskList.Select(a => a.Assignee).ToArray();
            var leaveLogList = await _userService.GetLeaveLogListAsync(assigneeUserIds);
            // Batched here to replace the per-row queries inside BuildReviewResponseAsync (N+1).
            var lastTimelineTimeMap = await GetLastTimelineTimeMapAsync(applicationIds);
            var latestDispositionStatusMap = await GetLatestDispositionStatusMapAsync(
                taskList.Select(a => a.ProcessInstanceId));
            var dispositionCaseIds = dispositionCases.Select(x => x.Id).ToArray();
            var latestSubmissions = dispositionCaseIds.Length == 0
                ? new Dictionary<int, Domain.Models.Workflow.DispositionSubmission>()
                : (await _db.DispositionSubmissions
                    .AsNoTracking()
                    .Where(x => dispositionCaseIds.Contains(x.DispositionCaseId))
                    .ToListAsync())
                    .GroupBy(x => x.DispositionCaseId)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.Id).First());

            // Disposition is single-node (302), so the disposition case is the canonical row:
            // suppress ALL the application's Camunda tasks (active AND terminal). Mirrors
            // BuildReviewListAsync so terminal disposition cases also leave the team to-do list.
            var dispositionApplicationIds = dispositionCases
                .Select(x => x.ApplicationId)
                .ToHashSet();

            // Index lookups once so the two enrichment loops below are O(1) per row instead
            // of O(n) FirstOrDefault scans (previously O(n*m) over the whole list).
            var applicationLookup = applicationList.ToLookup(a => (int?)a.Id);
            var applyForLookup = applyForList.ToLookup(a => a.Id);
            var serviceTypeLookup = serviceTypes.ToLookup(a => a.Code);
            var leaveLogLookup = leaveLogList.ToLookup(a => a.UserId);

            // Review-node SLA + initial-review elapsed per disposition case, for the SLA
            // pause(Pending Disposition)/resume(Disposition Verification) behavior. Mirrors
            // BuildReviewListAsync. Batched to avoid N+1.
            var dispositionServiceIds = dispositionCases
                .Select(c => applicationLookup[c.ApplicationId].FirstOrDefault()?.ServiceId)
                .Where(s => s.HasValue)
                .Select(s => s!.Value)
                .Distinct()
                .ToArray();
            var reviewSlaByService = new Dictionary<short, TimeSpan>();
            if (dispositionServiceIds.Length > 0)
            {
                var reviewNodes = await (
                    from cfg in _db.WorkflowConfigurations.AsNoTracking()
                    join n in _db.WorkflowNodes.AsNoTracking() on cfg.Id equals n.WorkflowConfigurationId
                    where dispositionServiceIds.Contains(cfg.ServiceId) && n.NodeType.ToLower() == "usertask"
                    select new { cfg.ServiceId, ConfigId = cfg.Id, n.SlaType, n.SlaTime }
                ).ToListAsync();
                reviewSlaByService = reviewNodes
                    .GroupBy(x => x.ServiceId)
                    .ToDictionary(
                        g => g.Key,
                        g =>
                        {
                            var latest = g.OrderByDescending(x => x.ConfigId).First();
                            return ToSlaTimeSpan(latest.SlaType, latest.SlaTime);
                        });
            }
            var sourceRecordIds = dispositionCases
                .Where(c => c.SourceApprovalRecordId.HasValue)
                .Select(c => c.SourceApprovalRecordId!.Value)
                .Distinct()
                .ToArray();
            var initialReviewMinutesByRecordId = sourceRecordIds.Length == 0
                ? new Dictionary<int, double>()
                : (await _db.ApprovalRecords.AsNoTracking()
                        .Where(r => sourceRecordIds.Contains(r.Id))
                        .Select(r => new { r.Id, r.ActualDurationMinutes })
                        .ToListAsync())
                    .ToDictionary(r => r.Id, r => r.ActualDurationMinutes ?? 0);

            var list = new List<MyTeamReviewPageResponse>();
            foreach (var taskItem in taskList)
            {
                if (taskItem.ProcessInstance == null) continue;
                if (dispositionApplicationIds.Contains(taskItem.ProcessInstance.ApplicationId))
                {
                    continue;
                }

                var application = applicationLookup[taskItem.ProcessInstance.ApplicationId].FirstOrDefault();
                if (application == null) continue;

                var applyFor = applyForLookup[application.ProfileId].FirstOrDefault();
                if (applyFor == null) continue;

                var serviceType = serviceTypeLookup[application.Service?.Type].FirstOrDefault();
                if (serviceType == null) continue;

                latestDispositionStatusMap.TryGetValue(taskItem.ProcessInstanceId ?? string.Empty, out var taskDispositionStatusId);
                var taskLastTimelineTime = lastTimelineTimeMap.TryGetValue(application.Id, out var taskLastTime) ? taskLastTime : (DateTime?)null;
                var item = await BuildReviewResponseAsync<MyTeamReviewPageResponse>(
                    taskItem,
                    application,
                    applyFor,
                    serviceType,
                    taskDispositionStatusId,
                    taskLastTimelineTime);
                var leaveLog = leaveLogLookup[taskItem.Assignee].FirstOrDefault();
                item.IsUrgent = !taskItem.ApprovalAt.HasValue && (leaveLog != null && leaveLog.IsLeave) && item.SLA <= (24 * 60);
                list.Add(item);
            }

            foreach (var dispositionAssignment in dispositionAssignments)
            {
                var dispositionCase = dispositionAssignment.DispositionCase;
                var application = applicationLookup[dispositionCase.ApplicationId].FirstOrDefault();
                if (application == null) continue;

                var applyFor = applyForLookup[application.ProfileId].FirstOrDefault();
                if (applyFor == null) continue;

                var serviceType = serviceTypeLookup[application.Service?.Type].FirstOrDefault();
                if (serviceType == null) continue;

                latestSubmissions.TryGetValue(dispositionCase.Id, out var submission);
                var dispositionLastTimelineTime = lastTimelineTimeMap.TryGetValue(dispositionCase.ApplicationId, out var dispositionLastTime) ? dispositionLastTime : (DateTime?)null;
                reviewSlaByService.TryGetValue(application.ServiceId, out var dispositionReviewSla);
                double initialReviewMinutes = 0;
                if (dispositionCase.SourceApprovalRecordId.HasValue)
                    initialReviewMinutesByRecordId.TryGetValue(dispositionCase.SourceApprovalRecordId.Value, out initialReviewMinutes);
                var assignedReviewerId = dispositionAssignment.ReviewerId;
                dispositionReviewerNames.TryGetValue(assignedReviewerId, out var assignedReviewerName);
                list.Add(await BuildDispositionReviewResponseAsync<MyTeamReviewPageResponse>(dispositionCase, application, applyFor, serviceType, assignedReviewerId, assignedReviewerName, submission, dispositionLastTimelineTime, dispositionReviewSla, initialReviewMinutes));
            }

            return list.OrderBy(a => a.Id).ThenByDescending(a => a.TaskCreatedTime).ToList();
        }

        private async Task<List<MyReviewPageResponse>> GetMyReviewListAsync(string departmentId)
        {
            var taskList = await _camundaWorkflowDomainService.GetTaskListByAssigneeAsync(_currentUserService.UserId);
            var departmentTasks = FilterPersonalWorkflowTasksByDepartment(taskList, departmentId);
            return await BuildReviewListAsync(
                departmentTasks,
                departmentId,
                loadTaskApplicationsAcrossServiceDepartments: true);
        }

        internal static IEnumerable<Domain.Models.Workflow.CamundaTask> FilterPersonalWorkflowTasksByDepartment(
            IEnumerable<Domain.Models.Workflow.CamundaTask> taskList,
            string departmentId)
        {
            if (!int.TryParse(departmentId, out var requestedDepartmentId))
            {
                return Enumerable.Empty<Domain.Models.Workflow.CamundaTask>();
            }

            return taskList.Where(task => task.ApprovalDepartment == requestedDepartmentId);
        }

        // Detail variant: regular workflow tasks are authorized by their runtime department before
        // the application is loaded. This allows a task to move across departments without changing
        // the owning department of its service. Synthetic disposition rows retain their existing
        // service-department scope and are handled by the shared builder's default path.
        private async Task<List<MyReviewPageResponse>> GetReviewListByTaskIdAsync(string taskId, string departmentId)
        {
            var taskList = (await _camundaWorkflowDomainService.GetTaskListByTaskIdAsync(taskId)).ToList();
            if (taskList.Count == 0)
            {
                return await BuildReviewListAsync(taskList, departmentId);
            }

            var task = taskList.FirstOrDefault(item => string.Equals(item.TaskId, taskId, StringComparison.OrdinalIgnoreCase));
            if (task == null || !CanViewWorkflowTaskDetail(
                    task,
                    departmentId,
                    _currentUserService.UserId))
            {
                return new List<MyReviewPageResponse>();
            }

            return await BuildReviewListAsync(
                new[] { task },
                departmentId,
                loadTaskApplicationsAcrossServiceDepartments: true,
                includeDispositionCases: false,
                allowMissingProfileForWorkflowTasks: true);
        }

        internal static bool CanViewWorkflowTaskDetail(
            Domain.Models.Workflow.CamundaTask task,
            string departmentId,
            string? currentUserId)
        {
            return int.TryParse(departmentId, out var requestedDepartmentId)
                   && task.ApprovalDepartment == requestedDepartmentId
                   && !string.IsNullOrWhiteSpace(currentUserId);
        }

        private async Task<List<MyReviewPageResponse>> BuildReviewListAsync(
            IEnumerable<Domain.Models.Workflow.CamundaTask> taskList,
            string departmentId,
            bool loadTaskApplicationsAcrossServiceDepartments = false,
            bool includeDispositionCases = true,
            bool allowMissingProfileForWorkflowTasks = false)
        {
            // "NotVerified" is the BG-job's expired-without-action status. Without it, the
            // 14-day timeout cases (spec §4.4.4) silently disappear from the My Completed
            // / list view because the join key never matches.
            var dispositionCaseStatusIds = new int?[]
            {
                (int)DispositionVerificationStatus.PendingDisposition,
                (int)DispositionVerificationStatus.DispositionVerification,
                (int)DispositionVerificationStatus.Verified,
                (int)DispositionVerificationStatus.NotVerified
            };
            var allDispositionCases = includeDispositionCases
                ? await _db.DispositionCases
                    .AsNoTracking()
                    .Where(x => dispositionCaseStatusIds.Contains(x.FinalDispositionStatusId))
                    .ToListAsync()
                : new List<Domain.Models.Workflow.DispositionCase>();
            var dispositionReviewerIds = await LoadDispositionReviewerIdsAsync(_db, allDispositionCases);
            var dispositionScope = BuildPersonalDispositionReviewScope(
                allDispositionCases,
                dispositionReviewerIds,
                _currentUserService.UserId);
            var dispositionAssignments = dispositionScope.VisibleAssignments;
            var dispositionCases = dispositionAssignments
                .Select(assignment => assignment.DispositionCase)
                .ToList();
            var dispositionCaseIdSet = dispositionCases.Select(dispositionCase => dispositionCase.Id).ToHashSet();
            var dispositionReviewerNames = await LoadAdminUserDisplayNamesAsync(
                dispositionReviewerIds
                    .Where(item => dispositionCaseIdSet.Contains(item.Key))
                    .Select(item => item.Value));

            if (!taskList.Any() && !dispositionCases.Any())
                return new List<MyReviewPageResponse>();

            var taskApplicationIds = taskList
                .Where(a => a.ProcessInstance != null)
                .Select(a => a.ProcessInstance.ApplicationId)
                .Distinct()
                .ToArray();
            var dispositionApplicationIds = dispositionCases
                .Select(a => a.ApplicationId)
                .Distinct()
                .ToArray();
            var applicationIds = taskApplicationIds
                .Concat(dispositionApplicationIds)
                .Distinct()
                .ToArray();

            IEnumerable<ApplicationModel> applicationList;
            if (loadTaskApplicationsAcrossServiceDepartments)
            {
                var taskApplications = taskApplicationIds.Length == 0
                    ? Enumerable.Empty<ApplicationModel>()
                    : await _applicationService.GetListByIds(taskApplicationIds, null);
                var dispositionApplications = dispositionApplicationIds.Length == 0
                    ? Enumerable.Empty<ApplicationModel>()
                    : await _applicationService.GetListByIds(dispositionApplicationIds, departmentId);
                applicationList = taskApplications
                    .Concat(dispositionApplications)
                    .GroupBy(application => application.Id)
                    .Select(group => group.First())
                    .ToList();
            }
            else
            {
                applicationList = await _applicationService.GetListByIds(applicationIds, departmentId);
            }
            if (!applicationList.Any())
                return new List<MyReviewPageResponse>();

            var profileIds = applicationList.Select(a => a.ProfileId).Where(a => a > 0).ToArray();
            var applyForList = await _userService.GetEstablishmentsByProfileIdsAsync(profileIds);

            var serviceTypes = await _typeDictionaryService.GetListAsync("ServiceConfigServiceType");

            // Batched here to replace the per-row queries that BuildReviewResponseAsync would
            // otherwise run inside the loops below (each was an N+1 hit).
            var lastTimelineTimeMap = await GetLastTimelineTimeMapAsync(applicationIds);
            var latestDispositionStatusMap = await GetLatestDispositionStatusMapAsync(
                taskList.Select(a => a.ProcessInstanceId));

            var dispositionCaseIds = dispositionCases.Select(x => x.Id).ToArray();
            var latestSubmissions = dispositionCaseIds.Length == 0
                ? new Dictionary<int, Domain.Models.Workflow.DispositionSubmission>()
                : (await _db.DispositionSubmissions
                    .AsNoTracking()
                    .Where(x => dispositionCaseIds.Contains(x.DispositionCaseId))
                    .ToListAsync())
                    .GroupBy(x => x.DispositionCaseId)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.Id).First());

            // Disposition is only ever triggered for the single-node 302 service, so the
            // disposition case is the canonical row for the entire post-approval flow. Suppress
            // ALL of the application's Camunda task rows — active AND terminal. For terminal
            // cases this also hides any spurious "next" task the engine opened on completion: a
            // single-node service has no genuine next node, so such a task must not leak into the
            // to-do list once the case has settled (Verified / NotVerified). The disposition row
            // itself carries the to-do vs completed classification (see BuildDispositionReviewResponse).
            var dispositionApplicationIdSet = dispositionScope.SuppressedApplicationIds;

            // Index the related collections once so each row resolves in O(1). These were
            // FirstOrDefault scans per row (O(n*m)) — a second quadratic cost alongside the
            // task list when a user's queue holds thousands of rows.
            var applicationById = applicationList
                .GroupBy(a => a.Id)
                .ToDictionary(g => g.Key, g => g.First());
            var applyForById = applyForList
                .GroupBy(a => a.Id)
                .ToDictionary(g => g.Key, g => g.First());
            var serviceTypeByCode = serviceTypes
                .Where(a => a.Code != null)
                .GroupBy(a => a.Code)
                .ToDictionary(g => g.Key, g => g.First());

            // Review-node SLA per service. The disposition SLA is PAUSED while the case waits on
            // the applicant (Pending Disposition) and RESUMES from the applicant's submission time
            // once it returns to the admin (Disposition Verification). 302 is single-node, so the
            // service's USER_TASK node SLA is the admin review window. Batched to avoid N+1.
            var dispositionServiceIds = dispositionCases
                .Select(c => applicationById.TryGetValue(c.ApplicationId, out var a) ? (short?)a.ServiceId : null)
                .Where(s => s.HasValue)
                .Select(s => s!.Value)
                .Distinct()
                .ToArray();
            var reviewSlaByService = new Dictionary<short, TimeSpan>();
            if (dispositionServiceIds.Length > 0)
            {
                var reviewNodes = await (
                    from cfg in _db.WorkflowConfigurations.AsNoTracking()
                    join n in _db.WorkflowNodes.AsNoTracking() on cfg.Id equals n.WorkflowConfigurationId
                    // NodeType is stored camelCase ("userTask") and the column collation is
                    // case-sensitive, so match case-insensitively.
                    where dispositionServiceIds.Contains(cfg.ServiceId) && n.NodeType.ToLower() == "usertask"
                    select new { cfg.ServiceId, ConfigId = cfg.Id, n.SlaType, n.SlaTime }
                ).ToListAsync();
                reviewSlaByService = reviewNodes
                    .GroupBy(x => x.ServiceId)
                    .ToDictionary(
                        g => g.Key,
                        g =>
                        {
                            var latest = g.OrderByDescending(x => x.ConfigId).First();
                            return ToSlaTimeSpan(latest.SlaType, latest.SlaTime);
                        });
            }

            // Initial-review elapsed (minutes the employee already spent BEFORE handing off to the
            // applicant) per case, taken from the source approve/reject ApprovalRecord's
            // ActualDurationMinutes (= action time − task creation time). Used so the resumed
            // disposition SLA CONTINUES from where the initial review left off, rather than
            // restarting a full window — matching the spec's session-accumulation intent.
            var sourceRecordIds = dispositionCases
                .Where(c => c.SourceApprovalRecordId.HasValue)
                .Select(c => c.SourceApprovalRecordId!.Value)
                .Distinct()
                .ToArray();
            var initialReviewMinutesByRecordId = sourceRecordIds.Length == 0
                ? new Dictionary<int, double>()
                : (await _db.ApprovalRecords.AsNoTracking()
                        .Where(r => sourceRecordIds.Contains(r.Id))
                        .Select(r => new { r.Id, r.ActualDurationMinutes })
                        .ToListAsync())
                    .ToDictionary(r => r.Id, r => r.ActualDurationMinutes ?? 0);

            var list = new List<MyReviewPageResponse>();
            foreach (var taskItem in taskList)
            {
                if (taskItem.ProcessInstance == null) continue;
                if (dispositionApplicationIdSet.Contains(taskItem.ProcessInstance.ApplicationId))
                    continue;

                if (!applicationById.TryGetValue(taskItem.ProcessInstance.ApplicationId, out var application))
                    continue;

                applyForById.TryGetValue(application.ProfileId, out var applyFor);
                if (!ShouldIncludeWorkflowTaskWithProfile(applyFor, allowMissingProfileForWorkflowTasks))
                    continue;

                if (application.Service?.Type == null || !serviceTypeByCode.TryGetValue(application.Service.Type, out var serviceType))
                    continue;

                latestDispositionStatusMap.TryGetValue(taskItem.ProcessInstanceId ?? string.Empty, out var taskDispositionStatusId);
                var taskLastTimelineTime = lastTimelineTimeMap.TryGetValue(application.Id, out var taskLastTime) ? taskLastTime : (DateTime?)null;
                list.Add(await BuildReviewResponseAsync<MyReviewPageResponse>(taskItem, application, applyFor, serviceType, taskDispositionStatusId, taskLastTimelineTime));
            }

            foreach (var dispositionAssignment in dispositionAssignments)
            {
                var dispositionCase = dispositionAssignment.DispositionCase;
                if (!applicationById.TryGetValue(dispositionCase.ApplicationId, out var application))
                    continue;

                if (!applyForById.TryGetValue(application.ProfileId, out var applyFor))
                    continue;

                if (application.Service?.Type == null || !serviceTypeByCode.TryGetValue(application.Service.Type, out var serviceType))
                    continue;

                latestSubmissions.TryGetValue(dispositionCase.Id, out var submission);
                var dispositionLastTimelineTime = lastTimelineTimeMap.TryGetValue(dispositionCase.ApplicationId, out var dispositionLastTime) ? dispositionLastTime : (DateTime?)null;
                reviewSlaByService.TryGetValue(application.ServiceId, out var dispositionReviewSla);
                double initialReviewMinutes = 0;
                if (dispositionCase.SourceApprovalRecordId.HasValue)
                    initialReviewMinutesByRecordId.TryGetValue(dispositionCase.SourceApprovalRecordId.Value, out initialReviewMinutes);
                var assignedReviewerId = dispositionAssignment.ReviewerId;
                dispositionReviewerNames.TryGetValue(assignedReviewerId, out var assignedReviewerName);
                list.Add(await BuildDispositionReviewResponseAsync<MyReviewPageResponse>(dispositionCase, application, applyFor, serviceType, assignedReviewerId, assignedReviewerName, submission, dispositionLastTimelineTime, dispositionReviewSla, initialReviewMinutes));
            }

            // The service-category Arabic name lives in Lookup.SubjectCategories, keyed by the same
            // id as ServiceConfig.ServiceCategoryId. The ServiceCategory navigation loaded in
            // ApplicationService.GetListByIds resolves against Lookup.ServiceCategories, whose NameAr
            // column actually holds English text — so the Arabic display path (GetMyReviewPageAsync
            // / ExportMyReviewAsync overwrite ServiceCategoryNameEn from ServiceCategoryNameAr) still
            // showed English. Backfill the real Arabic name from SubjectCategories here so every
            // consumer of this list (todo page, completed page, CSV export) gets it.
            await BackfillServiceCategoryArabicNamesAsync(list).ConfigureAwait(false);

            return list.OrderBy(a => a.Id).ThenByDescending(a => a.TaskCreatedTime).ToList();
            }

            /// <summary>
            /// Fills each row's <see cref="MyReviewPageResponse.ServiceCategoryNameAr"/> from
            /// <c>Lookup.SubjectCategories</c> (the table that carries the real Arabic category name),
            /// matched on <see cref="MyReviewPageResponse.ServiceCategoryId"/> == SubjectCategory.Id.
            /// Rows whose category has no SubjectCategories match keep their existing value.
            /// </summary>
            private async Task BackfillServiceCategoryArabicNamesAsync(IReadOnlyList<MyReviewPageResponse> rows)
            {
            if (rows.Count == 0)
                return;

            var categoryIds = rows
                .Select(r => r.ServiceCategoryId)
                .Where(id => id > 0)
                .Select(id => (short)id)
                .Distinct()
                .ToArray();
            if (categoryIds.Length == 0)
                return;

            var arabicNameById = await _db.Set<SubjectCategory>()
                .AsNoTracking()
                .Where(x => categoryIds.Contains(x.Id) && x.NameAr != null && x.NameAr != "")
                .Select(x => new { x.Id, x.NameAr })
                .ToDictionaryAsync(x => x.Id, x => x.NameAr)
                .ConfigureAwait(false);
            if (arabicNameById.Count == 0)
                return;

            foreach (var row in rows)
            {
                if (row.ServiceCategoryId > 0
                && arabicNameById.TryGetValue((short)row.ServiceCategoryId, out var nameAr))
                {
                row.ServiceCategoryNameAr = nameAr;
                }
            }
            }

        // ButtonJson ships the node's designer-authored action config verbatim (approve/reject +
        // externalApproval/requestModification/sendBack switches). External Approval is a
        // once-per-node round trip: entering it parks the node and stamps a record on this TaskId
        // with InstanceStatusId == ExternalApproval that survives the round. Once a node has been
        // through that round, keep offering Approve/Reject but drop the "External Approval" (enter)
        // switch so the same node can't be sent to an outside authority twice. Mirrors the same
        // suppression in WorkflowActionResolver.GetTaskActionsAsync; batched here (one query per
        // page) to avoid an N+1 across list rows.
        private async Task SuppressCompletedExternalApprovalButtonsAsync(IReadOnlyList<MyReviewPageResponse> rows)
        {
            var candidates = rows
                .Where(r => !string.IsNullOrEmpty(r.TaskId)
                            && !string.IsNullOrEmpty(r.ButtonJson)
                            && r.ButtonJson.Contains("externalApproval", StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (candidates.Count == 0)
                return;

            var taskIds = candidates.Select(r => r.TaskId!).Distinct().ToList();
            var completedExternalTaskIds = (await _db.ApprovalRecords
                    .AsNoTracking()
                    .Where(r => taskIds.Contains(r.TaskId)
                                && r.InstanceStatusId == (int)ApprovalNodeOrder.ExternalApproval)
                    .Select(r => r.TaskId)
                    .ToListAsync())
                .ToHashSet();
            if (completedExternalTaskIds.Count == 0)
                return;

            foreach (var row in candidates)
            {
                if (completedExternalTaskIds.Contains(row.TaskId!))
                    row.ButtonJson = DisableExternalApprovalSwitch(row.ButtonJson!);
            }
        }

        // Flip only the externalApproval switch to false, preserving every other field (labels,
        // action codes, other switches) and the designer's original casing. Leaves malformed
        // designer JSON untouched rather than dropping the row's buttons.
        private static string DisableExternalApprovalSwitch(string buttonJson)
        {
            try
            {
                if (JsonNode.Parse(buttonJson) is JsonObject obj)
                {
                    var key = obj
                        .Select(kvp => kvp.Key)
                        .FirstOrDefault(k => string.Equals(k, "externalApproval", StringComparison.OrdinalIgnoreCase));
                    if (key != null && obj[key] is JsonValue value && value.TryGetValue<bool>(out var enabled) && enabled)
                    {
                        obj[key] = false;
                        return obj.ToJsonString();
                    }
                }
            }
            catch (System.Text.Json.JsonException)
            {
                // Designer-authored ButtonJson is malformed — leave it as-is.
            }
            return buttonJson;
        }

        private async Task<T> BuildReviewResponseAsync<T>(
            Domain.Models.Workflow.CamundaTask taskItem
            , Domain.Models.Application.ApplicationModel application
            , UserProfile? applyFor
            , Infrastructure.Models.TypeDictionary serviceType
            , int? dispositionStatusId
            , DateTime? lastTimelineTime)
            where T : MyReviewPageResponse, new()
        {
            var buttonJson = IsCompletedTaskStatus(taskItem.StatusId) ? null : taskItem.WorkflowNode?.PropertiesJson;

            var processStatusLabel = await PostCertificateDispositionPolicy.LocalizeDispositionFinalStatusAsync(
                taskItem.ProcessInstance.StatusId,
                dispositionStatusId,
                (isArabic ? "ar" : "en"),
                _typeDictionaryService);
            // Stays NameEn deliberately: TaskStatus is both a display label AND the value the
            // approvalStatus filter matches on (MyReviewFilter), and the dropdown the frontend
            // posts back is built from these same strings. Localizing here would desync the two.
            // The CSV localizes this column at render time instead — see ExportMyReviewAsync.
            var taskStatusLabel = taskItem.StatusId.HasValue
                ? (await _typeDictionaryService.GetByCodeAsync("ApprovalNodeOrder", taskItem.StatusId.Value.ToString()))?.NameEn
                : null;

            var t = new T()
            {
                Id = application.Id,
                ApplicationNumber = application.ApplicationNumber,
                ServiceCategoryId = application.Service?.ServiceCategoryId ?? 0,
                ServiceCategoryNameAr = application.Service?.ServiceCategory?.NameAr,
                ServiceCategoryNameEn = application.Service?.ServiceCategory?.NameEn,
                ServiceId = application.ServiceId,
                ServiceCode = application.Service?.Code,
                ServiceNameAr = application.Service?.NameAr,
                ServiceNameEn = application.Service?.NameEn,
                ServiceTypeId = application.Service?.Type,
                ServiceTypeNameAr = serviceType?.NameAr,
                ServiceTypeNameEn = serviceType?.NameEn,
                Assignee = taskItem.Assignee,
                AssignedTo = BuildAssignedToDisplay(taskItem.Assignee, taskItem.AssigneeUser?.FirstName, taskItem.AssigneeUser?.LastName, taskItem.AssigneeUser?.UserName) ?? string.Empty,
                ApplyForAr = applyFor?.Establishment?.NameAr,
                ApplyForEn = applyFor?.Establishment?.NameEn,
                UserTypeCode = applyFor?.UserType?.Code,
                Status = processStatusLabel,
                StatusId = taskItem.ProcessInstance.StatusId,
                SubmissionTime = application.CreatedOn,
                LastUpdatedTime = lastTimelineTime ?? taskItem.ApprovalAt ?? taskItem.CreatedTime,
                AIStatus = application.ApplicationExt.AIStatus,
                AIResult = application.ApplicationExt.AIResult,

                ApplicationDetailId = application.ApplicationDetail?.Id ?? 0,
                ProcessInstanceId = taskItem.ProcessInstanceId,
                OldProcessInstanceId = application.ApplicationExt.ProcessInstanceId,
                TaskId = taskItem.TaskId,
                TaskStatus = taskStatusLabel,
                TaskStatusId = taskItem.StatusId,
                TaskCreatedTime = taskItem.CreatedTime,
                TaskDueTime = taskItem.DueDate,
                TaskApprovalAt = taskItem.ApprovalAt,
                TaskApprovalDepartment = taskItem.ApprovalDepartment,
                TaskApprovalRole = taskItem.ApprovalRole,
                ButtonJson = buttonJson,
                UserId = application.UserId,
                ProfileId = application.ProfileId,
                ProfileIsVIP = ResolveProfileIsVip(applyFor),
                EstablishmentId = application.EstablishmentId
            };

            // External Approval is a parked state (node waits on an outside authority), so its
            // elapsed time is not counted against the node SLA — leave SLA unset (null).
            t.SLA = t.TaskStatusId == (int)ApprovalNodeOrder.ExternalApproval
                ? null
                : ((t.TaskApprovalAt ?? DateTimeHelper.Now) - t.TaskDueTime)?.TotalMinutes ?? 0;
            t.IsArabic = _currentUserService.IsArabicLanguage;

            EnrichAiAuditDisplay(t);
            return t;
        }

        internal static bool? ResolveProfileIsVip(UserProfile? applyFor)
            => applyFor?.IsVip;

        internal static bool ShouldIncludeWorkflowTaskWithProfile(
            UserProfile? applyFor,
            bool allowMissingProfile)
            => applyFor != null || allowMissingProfile;

        private static bool IsUserTaskNode(WorkflowNode node)
        {
            return string.Equals(node.NodeType, "userTask", StringComparison.OrdinalIgnoreCase)
                || string.Equals(node.NodeType, "USER_TASK", StringComparison.OrdinalIgnoreCase);
        }

        internal static bool IsFirstWorkflowUserTask(
            IEnumerable<WorkflowNode> workflowNodes,
            string? taskDefinitionKey)
        {
            if (string.IsNullOrWhiteSpace(taskDefinitionKey))
            {
                return false;
            }

            var firstUserTask = workflowNodes
                .Where(IsUserTaskNode)
                .OrderBy(node => node.NodeOrder)
                .ThenBy(node => node.Id)
                .FirstOrDefault();

            return firstUserTask != null
                && string.Equals(firstUserTask.NodeId, taskDefinitionKey, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCompletedTaskStatus(int? taskStatusId)
        {
            return taskStatusId.HasValue && Extensions.CompletedTaskStatus.Contains(taskStatusId.Value);
        }

        internal static readonly string[] MyDecisionOptionValues =
        {
            "Approved",
            "Rejected",
            "Send Back",
            "-"
        };

        internal static string? TryNormalizeMyDecision(int? workflowActionCode, string? approvalResult)
        {
            var actionDecision = workflowActionCode switch
            {
                1 or 3 or 4 or 5 or 6 or 201 or 301 => "Approved",
                101 or 102 or 104 or 105 or 106 or 107 or 202 or 302 => "Rejected",
                200 or 300 => "-",
                400 => "Send Back",
                _ => null
            };
            if (actionDecision != null)
                return actionDecision;

            if (string.IsNullOrWhiteSpace(approvalResult))
                return null;

            return approvalResult.Trim().ToUpperInvariant() switch
            {
                "APPROVED" => "Approved",
                "REJECTED" => "Rejected",
                "REQUEST MODIFICATION" or "PENDING MODIFICATION" or "EXTERNAL APPROVAL" => "-",
                "SEND BACK" or "SENDBACK" => "Send Back",
                _ => null
            };
        }

        internal static string ResolveMyDecision(
            IEnumerable<(int? WorkflowActionCode, string? ApprovalResult, DateTime? ApprovalDate, int Id)> approvalRecords,
            bool isOverdue)
        {
            TryResolveMyDecision(approvalRecords, isOverdue, out var decision);
            return decision;
        }

        internal static bool TryResolveMyDecision(
            IEnumerable<(int? WorkflowActionCode, string? ApprovalResult, DateTime? ApprovalDate, int Id)> approvalRecords,
            bool isOverdue,
            out string decision)
        {
            if (isOverdue)
            {
                decision = "-";
                return true;
            }

            var resolvedDecision = approvalRecords
                .Select(record => new
                {
                    Decision = TryNormalizeMyDecision(record.WorkflowActionCode, record.ApprovalResult),
                    record.ApprovalDate,
                    record.Id
                })
                .Where(record => record.Decision != null)
                .OrderByDescending(record => record.ApprovalDate ?? DateTime.MinValue)
                .ThenByDescending(record => record.Id)
                .Select(record => record.Decision)
                .FirstOrDefault();
            decision = resolvedDecision ?? "-";
            return resolvedDecision != null;
        }

        internal static string ResolveMyDecisionForTask(
            IEnumerable<(string? TaskId, int? SourceSubmissionId, int? WorkflowActionCode, string? ApprovalResult, DateTime? ApprovalDate, int Id)> approvalRecords,
            string? taskId,
            int? sourceSubmissionId,
            bool isOverdue)
        {
            if (isOverdue)
                return "-";

            var records = approvalRecords.ToList();
            if (sourceSubmissionId.HasValue)
            {
                var submissionRecords = records
                    .Where(record => record.SourceSubmissionId == sourceSubmissionId.Value)
                    .Select(record =>
                        (record.WorkflowActionCode, record.ApprovalResult, record.ApprovalDate, record.Id));
                return ResolveMyDecision(submissionRecords, isOverdue: false);
            }

            var taskRecords = !string.IsNullOrEmpty(taskId)
                ? records.Where(record => record.TaskId == taskId).ToList()
                : [];

            if (taskRecords.Count > 0)
            {
                var taskDecisionRecords =
                    taskRecords.Select(record => (record.WorkflowActionCode, record.ApprovalResult, record.ApprovalDate, record.Id));
                if (TryResolveMyDecision(taskDecisionRecords, isOverdue: false, out var taskDecision))
                    return taskDecision;
            }

            var legacyRecords = records
                .Where(record => string.IsNullOrEmpty(record.TaskId))
                .Select(record => new
                {
                    record.WorkflowActionCode,
                    record.ApprovalResult,
                    record.ApprovalDate,
                    record.Id,
                    Decision = TryNormalizeMyDecision(record.WorkflowActionCode, record.ApprovalResult)
                })
                .Where(record => record.Decision != null)
                .ToList();

            if (legacyRecords.Count != 1)
                return "-";

            return ResolveMyDecision(
                legacyRecords.Select(record =>
                    (record.WorkflowActionCode, record.ApprovalResult, record.ApprovalDate, record.Id)),
                isOverdue: false);
        }

        internal static string ResolveDispositionMyDecision(
            int? sourceWorkflowActionCode,
            int? sourceRecordWorkflowActionCode,
            string? sourceRecordApprovalResult)
        {
            var sourceDecision = sourceWorkflowActionCode switch
            {
                2 => "Approved",
                103 => "Rejected",
                _ => TryNormalizeMyDecision(sourceWorkflowActionCode, null)
            };

            return sourceDecision
                ?? TryNormalizeMyDecision(sourceRecordWorkflowActionCode, sourceRecordApprovalResult)
                ?? "-";
        }

        private async Task PopulateCompletedMyDecisionsAsync(List<MyReviewPageResponse> items)
        {
            var dispositionCaseIds = items
                .Where(item => item.DispositionCaseId.HasValue)
                .Select(item => item.DispositionCaseId!.Value)
                .Distinct()
                .ToList();
            var dispositionDecisionSourceByCase = dispositionCaseIds.Count == 0
                ? new Dictionary<int, (int SourceWorkflowActionCode, int? SourceApprovalRecordId)>()
                : (await _db.DispositionCases
                    .AsNoTracking()
                    .Where(dispositionCase => dispositionCaseIds.Contains(dispositionCase.Id))
                    .Select(dispositionCase => new
                    {
                        dispositionCase.Id,
                        dispositionCase.SourceWorkflowActionCode,
                        dispositionCase.SourceApprovalRecordId
                    })
                    .ToListAsync())
                    .ToDictionary(
                        dispositionCase => dispositionCase.Id,
                        dispositionCase => (
                            dispositionCase.SourceWorkflowActionCode,
                            dispositionCase.SourceApprovalRecordId));
            var sourceApprovalRecordIds = dispositionDecisionSourceByCase.Values
                .Where(source => source.SourceApprovalRecordId.HasValue)
                .Select(source => source.SourceApprovalRecordId!.Value)
                .Distinct()
                .ToList();

            var processInstanceIds = items
                .Select(item => item.ProcessInstanceId)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList();

            var approvalRecords = new List<(
                string? ProcessInstanceId,
                string? TaskId,
                int? SourceSubmissionId,
                int? WorkflowActionCode,
                string? ApprovalResult,
                DateTime? ApprovalDate,
                int Id)>();

            // SQL Server has a finite parameter limit. Querying in bounded batches keeps a
            // large completed history safe without falling back to one query per row.
            foreach (var processInstanceIdBatch in processInstanceIds.Chunk(1000))
            {
                var batchIds = processInstanceIdBatch.ToList();
                var batchRecords = await _db.ApprovalRecords
                    .AsNoTracking()
                    .Where(record => batchIds.Contains(record.ProcessInstanceId))
                    .Select(record => new
                    {
                        record.ProcessInstanceId,
                        record.TaskId,
                        record.SourceSubmissionId,
                        record.WorkflowActionCode,
                        record.ApprovalResult,
                        record.ApprovalDate,
                        record.Id
                    })
                    .ToListAsync();

                approvalRecords.AddRange(batchRecords.Select(record =>
                    (record.ProcessInstanceId, record.TaskId, record.SourceSubmissionId, record.WorkflowActionCode, record.ApprovalResult, record.ApprovalDate, record.Id)));
            }

            foreach (var sourceRecordIdBatch in sourceApprovalRecordIds.Chunk(1000))
            {
                var batchIds = sourceRecordIdBatch.ToList();
                var sourceRecords = await _db.ApprovalRecords
                    .AsNoTracking()
                    .Where(record => batchIds.Contains(record.Id))
                    .Select(record => new
                    {
                        record.ProcessInstanceId,
                        record.TaskId,
                        record.SourceSubmissionId,
                        record.WorkflowActionCode,
                        record.ApprovalResult,
                        record.ApprovalDate,
                        record.Id
                    })
                    .ToListAsync();

                approvalRecords.AddRange(sourceRecords.Select(record =>
                    (record.ProcessInstanceId, record.TaskId, record.SourceSubmissionId, record.WorkflowActionCode, record.ApprovalResult, record.ApprovalDate, record.Id)));
            }

            approvalRecords = approvalRecords
                .DistinctBy(record => record.Id)
                .ToList();

            var recordsByInstance = approvalRecords
                .Where(record => !string.IsNullOrEmpty(record.ProcessInstanceId))
                .GroupBy(record => record.ProcessInstanceId!)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .Select(record => (record.TaskId, record.SourceSubmissionId, record.WorkflowActionCode, record.ApprovalResult, record.ApprovalDate, record.Id))
                        .ToList());
            var recordsById = approvalRecords.ToDictionary(record => record.Id);

            foreach (var item in items)
            {
                if (item.DispositionCaseId.HasValue
                    && dispositionDecisionSourceByCase.TryGetValue(item.DispositionCaseId.Value, out var source))
                {
                    var sourceRecord = source.SourceApprovalRecordId.HasValue
                        && recordsById.TryGetValue(source.SourceApprovalRecordId.Value, out var record)
                            ? record
                            : default;
                    item.MyDecision = ResolveDispositionMyDecision(
                        source.SourceWorkflowActionCode,
                        sourceRecord.WorkflowActionCode,
                        sourceRecord.ApprovalResult);
                    continue;
                }

                var records = !string.IsNullOrEmpty(item.ProcessInstanceId)
                    && recordsByInstance.TryGetValue(item.ProcessInstanceId, out var instanceRecords)
                        ? instanceRecords
                        : [];

                item.MyDecision = ResolveMyDecisionForTask(
                    records,
                    item.TaskId,
                    sourceSubmissionId: null,
                    item.IsOverdue);
            }
        }

        internal static void ApplyCompletedMyDecisionCompatibility(IEnumerable<MyReviewPageResponse> items)
        {
            foreach (var item in items)
            {
                item.MyDecision ??= "-";
                item.TaskStatus = item.MyDecision;
            }
        }

        private static bool IsCompletedReviewItem(MyReviewPageResponse item)
        {
            // Check both task-level and process-level status: when an application is Cancelled,
            // the Camunda task's own StatusId may still reflect the last active approval step
            // rather than Cancelled(10), while ProcessInstance.StatusId is correctly updated to 10.
            return IsCompletedTaskStatus(item.TaskStatusId)
                || IsCompletedTaskStatus(item.StatusId);
        }

        // External-approval tasks (status 11) surface only in the assignee's My Review todo,
        // never in the team todo — a leader does not action a node parked at an outside authority.
        private static bool IsExternalApprovalItem(MyReviewPageResponse item)
        {
            return item.TaskStatusId == (int)ApprovalNodeOrder.ExternalApproval;
        }

        private static bool IsTodoReviewItem(MyReviewPageResponse item)
        {
            // OldProcessInstanceId is the application's canonical ProcessInstanceId (ApplicationsExt.ProcessInstanceId).
            // A null/empty value means it was never recorded — e.g. the post-commit, cross-service content workflow
            // start persisted the Camunda instance on AdminPortal but the customer-side ApplicationsExt write-back did
            // not complete. That is NOT a superseded instance, so a live (non-completed) task for it must still surface
            // in the team todo. Only a mismatch between two *known* instance ids means the task belongs to a superseded
            // process instance and should be hidden.
            return !IsCompletedReviewItem(item) && ReviewTaskProjection.IsCurrentInstance(item);
        }

        /// <summary>
        /// "Pending Review" is the collapsed multi-level approval chain, Initial..Final
        /// (ApprovalNodeOrder 2..7). Same definition as
        /// LicenseDashboardAppService.ResolvePriorityCardStatus — a RANGE check rather than an
        /// exclusion list, so adding a new terminal/parked status cannot silently widen it.
        /// </summary>
        private static bool IsPendingReviewStatus(int? statusId)
            => statusId is >= (int)ApprovalNodeOrder.InitialApproval
                        and <= (int)ApprovalNodeOrder.FinalApproval;

        // api/Content/MyTodoPage default-order priority buckets:
        //   0 = VIP (the row the UI marks with an icon), any status
        //   1 = live admin work: Pending Review (2..7), plus the two live disposition statuses
        //       (108/109) and legacy StatusId == null rows
        //   2 = parked on someone else: Pending Modification(13) / External Approval(11)
        //
        // Bucket 1 leads with the range check but keeps an explicit 108/109/null clause. That
        // clause is what makes this partition IDENTICAL to the old "!= 13 && != 11" one on the
        // rows that can actually reach here: SelectPersonalTodo drops every row whose StatusId is
        // in Extensions.CompletedTaskStatus {8,9,10,12,14,15} (via IsCompletedReviewItem), so a
        // todo row's StatusId is only ever 2..7, 11, 13, 108, 109 or null. Dropping the clause
        // would demote the 302 disposition rows — a Content-department-only flow — into the parked
        // bucket, and DispositionVerification(109) is real todo work with a live SLA, so it belongs
        // in the actionable bucket. Null-status rows are legacy, not *known* to be parked;
        // demoting unknown data is the worse default.
        private static int ContentTodoPriorityRank(MyReviewPageResponse a)
        {
            if (a.ProfileIsVIP == true) return 0;
            if (IsPendingReviewStatus(a.StatusId)
                || a.StatusId == (int)ApplicationStatus.PendingDisposition
                || a.StatusId == (int)ApplicationStatus.DispositionVerification
                || a.StatusId == null)
                return 1;
            return 2;
        }

        // The submissionTime sort ranks by VIP ONLY: the status buckets deliberately do not
        // participate, so a parked row can sort ahead of a Pending Review row on submission time.
        private static int ContentTodoVipRank(MyReviewPageResponse a)
            => a.ProfileIsVIP == true ? 0 : 1;

        // A row shows "-" in the SLA column either because it has no SLA (External Approval(11),
        // Pending Disposition) or because the page blanks it out AFTER sorting (Pending
        // Modification(13) — GetMyReviewPageAsync, ExportMyReviewAsync). Both kinds must sink to
        // the bottom of an SLA sort in BOTH directions: nullable-double ordering would otherwise
        // float the nulls to the TOP on ascending, ahead of every "Due in" row.
        private static int SlaDisplayRank(MyReviewPageResponse a)
            => a.SLA.HasValue && a.StatusId != (int)ApprovalNodeOrder.PendingModification ? 0 : 1;

        /// <summary>
        /// The single definition of how a team-review row set is ordered, mirroring what
        /// <see cref="ApplyMyReviewSort"/> does for the personal queue. Shared by the paged team
        /// list (GetMyTeamReviewPageAsync) and the team CSV export (ExportMyTeamReviewAsync) so the
        /// CSV rows come out in the order the user saw them.
        /// Internal (not private) for focused unit tests via InternalsVisibleTo.
        /// </summary>
        internal static IQueryable<T> ApplyMyTeamReviewSort<T>(IQueryable<T> query, MyTeamReviewPageRequest req)
            where T : MyTeamReviewPageResponse
        {
            var urgentFirst = query.OrderByDescending(a => a.IsUrgent);

            // Untrimmed, matching the paged list's prior behavior: " lastUpdatedTime" falls
            // through to the SubmissionTime default rather than sorting by LastUpdatedTime.
            if (!req.SortBy.IsNullOrEmpty() && req.SortBy.ToLower() == "lastupdatedtime")
            {
                if (req.SortDirection == SortDirection.Ascending)
                    return urgentFirst.ThenBy(a => a.LastUpdatedTime);
                if (req.SortDirection == SortDirection.Descending)
                    return urgentFirst.ThenByDescending(a => a.LastUpdatedTime);
            }

            return urgentFirst.ThenByDescending(a => a.SubmissionTime);
        }

        /// <summary>
        /// The single definition of how a MyReview row set is ordered. Shared by the paged list
        /// (GetMyReviewPageAsync) and the CSV export (ExportMyReviewAsync) so the CSV rows come out
        /// in the same order the user saw them: the export previously emitted the raw
        /// GetMyReviewListAsync order, which made a filtered CSV look like a different result set
        /// even though it held exactly the same rows.
        ///
        /// Two dispatches, deliberately:
        ///  - api/Content/MyTodoPage (status == 1, department 2) has its own ordering spec —
        ///    VIP -> Pending Review -> SubmissionTime desc by default, a submissionTime sort, and
        ///    an SLA sort that sinks "-" rows last — and its own TRIMMED dispatch, because the
        ///    frontend sends padded values ("lastUpdatedTime ").
        ///  - every other caller keeps the legacy UNTRIMMED switch verbatim, so Licensing
        ///    MyTodoPage, both completed lists and the dashboard read paths cannot move.
        /// Internal (not private) for focused unit tests via InternalsVisibleTo.
        /// </summary>
        internal static IQueryable<T> ApplyMyReviewSort<T>(
            IQueryable<T> query,
            MyReviewPageRequest req,
            int status,
            string departmentId)
            where T : MyReviewPageResponse
        {
            var isContentTodo = status == 1
                && departmentId == ((int)DepartmentEnum.Content).ToString();

            if (isContentTodo)
            {
                // Trimmed: the frontend sends trailing whitespace. This extends the precedent set
                // by d20ed2e3 ("the Content-todo branch trims") to the whole Content-todo dispatch.
                switch (req.SortBy?.Trim().ToLower())
                {
                    // SLA keeps the signed-minutes direction semantics AND the Sort bucket, and VIP
                    // stays out of it. The only change is that rows displaying "-" now sink to the
                    // bottom in BOTH directions instead of floating to the top on ascending.
                    case "sla":
                        var slaQuery = query
                            .OrderBy(a => a.Sort)
                            .ThenBy(a => SlaDisplayRank(a));
                        if (req.SortDirection == SortDirection.Ascending)
                            return slaQuery.ThenBy(a => a.SLA);
                        if (req.SortDirection == SortDirection.Descending)
                            return slaQuery.ThenByDescending(a => a.SLA);
                        return slaQuery;

                    // Submission time: VIP first, then the requested direction. No status buckets.
                    case "submissiontime":
                        var submissionQuery = query.OrderBy(a => ContentTodoVipRank(a));
                        if (req.SortDirection == SortDirection.Ascending)
                            return submissionQuery.ThenBy(a => a.SubmissionTime);
                        if (req.SortDirection == SortDirection.Descending)
                            return submissionQuery.ThenByDescending(a => a.SubmissionTime);
                        return submissionQuery;

                    // LastUpdatedTime ASCENDING is the one explicit column sort left untouched:
                    // the legacy Sort bucket, then oldest first.
                    case "lastupdatedtime" when req.SortDirection == SortDirection.Ascending:
                        return query.OrderBy(a => a.Sort).ThenBy(a => a.LastUpdatedTime);

                    // The default Content-todo ordering: VIP, then Pending Review, then newest
                    // submission first. Reached by
                    //  - no sortBy / sortBy="Id" (PageRequest's default) / any unknown value, and
                    //  - lastUpdatedTime + descending, which is the view the frontend opens with:
                    //    the requirement is that this view IS the default ordering, keyed on
                    //    SubmissionTime and NOT on LastUpdatedTime.
                    default:
                        return query
                            .OrderBy(a => ContentTodoPriorityRank(a))
                            .ThenByDescending(a => a.SubmissionTime);
                }
            }

            var orderQuery = query.OrderBy(a => a.Sort);
            // Deliberately switches on the UNTRIMMED value: only the Content-todo dispatch above
            // tolerates padding. Live DP confirms sortBy="sla " currently falls through to the
            // default branch on these endpoints, so trimming here would silently re-sort existing
            // list pages. Pinned by
            // MyReviewSort_DoesNotTrimSortBy_SoPaddedValuesKeepFallingThrough.
            switch (req.SortBy?.ToLower())
            {
                case "sla":
                    if (req.SortDirection == SortDirection.Ascending)
                        return orderQuery.ThenBy(a => a.SLA);
                    if (req.SortDirection == SortDirection.Descending)
                        return orderQuery.ThenByDescending(a => a.SLA);
                    return orderQuery;
                case "lastupdatedtime":
                    if (req.SortDirection == SortDirection.Ascending)
                        return orderQuery.ThenBy(a => a.LastUpdatedTime);
                    if (req.SortDirection == SortDirection.Descending)
                        return orderQuery.ThenByDescending(a => a.LastUpdatedTime);
                    return orderQuery;
                default:
                    return orderQuery.ThenByDescending(a => a.LastUpdatedTime);
            }
        }

        /// <summary>
        /// Applies page-scoped Recall eligibility without adding, removing or reordering rows.
        /// Internal visibility keeps the response-only behavior covered by focused unit tests.
        /// </summary>
        internal static void ApplyRecallEligibility(
            IReadOnlyCollection<MyReviewPageResponse> pageData,
            IReadOnlyDictionary<int, bool> eligibilityMap)
        {
            foreach (var item in pageData)
            {
                item.IsEligible = eligibilityMap.GetValueOrDefault(item.Id);
            }
        }

        // WorkflowNode SLA (SlaType + SlaTime) -> TimeSpan. Mirrors the SendBack SLA conversion.
        private static TimeSpan ToSlaTimeSpan(string? slaType, int slaTime)
        {
            return slaType?.ToLowerInvariant() switch
            {
                "hours" => TimeSpan.FromHours(slaTime),
                "minutes" => TimeSpan.FromMinutes(slaTime),
                _ => TimeSpan.FromDays(slaTime)
            };
        }

        private async Task<T> BuildDispositionReviewResponseAsync<T>(
            DispositionCase dispositionCase,
            Domain.Models.Application.ApplicationModel application,
            UserProfile applyFor,
            Infrastructure.Models.TypeDictionary serviceType,
            string assignedReviewerId,
            string? assignedReviewerName,
            Domain.Models.Workflow.DispositionSubmission? submission = null,
            DateTime? lastTimelineTime = null,
            TimeSpan reviewSla = default,
            double initialReviewMinutes = 0)
            where T : MyReviewPageResponse, new()
        {
            var processInstanceId = dispositionCase.ProcessInstanceId ?? application.ApplicationExt.ProcessInstanceId ?? string.Empty;
            // The disposition stage runs after approvals, so its own update time is normally the
            // latest event; still take the later of it and the newest ApprovalRecord to be safe.
            var dispositionUpdatedTime = dispositionCase.UpdatedOn ?? dispositionCase.CreatedOn;
            var lastUpdatedTime = lastTimelineTime.HasValue && lastTimelineTime.Value > dispositionUpdatedTime
                ? lastTimelineTime.Value
                : dispositionUpdatedTime;
            // Both the Admin-driven verification ("Verified") and the BG-job timeout
            // ("NotVerified") are terminal disposition states; either one means the row
            // belongs in the Completed list rather than the to-do list.
            var isCompleted = PostCertificateDispositionPolicy.IsCompletedDispositionCaseStatus(dispositionCase.FinalDispositionStatusId);
            // ApplicationStatuses 108 = "Pending Disposition", 109 = "Disposition Verification" — Lookup.TypeDictionary.
            var liveStatus = dispositionCase.LastSubmissionId.HasValue
                ? await _typeDictionaryService.GetLocalizedNameAsync(
                    "ApplicationStatuses", ((int)ApplicationStatus.DispositionVerification).ToString(), (isArabic ? "ar" : "en"))
                : await _typeDictionaryService.GetLocalizedNameAsync(
                    "ApplicationStatuses", ((int)ApplicationStatus.PendingDisposition).ToString(), (isArabic ? "ar" : "en"));
            var taskStatus = isCompleted ? "completed" : liveStatus;
            // dispositionCase.FinalStatusId stores ApplicationStatus (Completed/Rejected);
            // FinalDispositionStatusId stores Verified/NotVerified. Four fixed labels.
            var finalAdminStatus = PostCertificateDispositionPolicy.LocalizeDispositionCaseFinalStatus(
                dispositionCase.FinalStatusId, dispositionCase.FinalDispositionStatusId, (isArabic ? "ar" : "en"));

            var dispositionCaseDto = submission != null ? await BuildDispositionCaseDtoAsync(dispositionCase, submission) : null;

            // SLA pause/resume:
            //  - Pending Disposition (LastSubmissionId == null): ball in the applicant's court —
            //    the admin clock is paused, so SLA is null and the UI shows "-".
            //  - Disposition Verification (a submission exists): the admin must review, so the SLA
            //    resumes. It CONTINUES the employee's clock — the verification window is the node
            //    SLA MINUS the time already spent in the initial review; it restarts at the
            //    submission moment, so the applicant's upload time is naturally excluded. (negative
            //    = remaining / "Due in", positive = "Overdue", same convention as normal task rows.)
            //  - Terminal (Verified/NotVerified): no live SLA.
            double? sla = null;
            if (!isCompleted && submission != null && dispositionCase.LastSubmissionId.HasValue)
            {
                var remainingReviewWindow = reviewSla - TimeSpan.FromMinutes(initialReviewMinutes);
                var reviewDue = submission.SubmittedOn + remainingReviewWindow;
                sla = (DateTimeHelper.Now - reviewDue).TotalMinutes;
            }

            var dispositionAssignee = BuildDispositionAssignee(assignedReviewerId, assignedReviewerName);
            var reviewItem = new T
            {
                Id = application.Id,
                ApplicationNumber = application.ApplicationNumber,
                // ServiceCode drives service-specific rendering (e.g. the 302 material-list
                // approved/rejected badge on the timeline). Disposition rows previously left it
                // null, so a disposition-{caseId} detail could not be recognized as 302.
                ServiceCode = application.Service?.Code,
                ServiceCategoryId = application.Service?.ServiceCategoryId ?? 0,
                ServiceCategoryNameAr = application.Service?.ServiceCategory?.NameAr,
                ServiceCategoryNameEn = application.Service?.ServiceCategory?.NameEn,
                ServiceId = application.ServiceId,
                ServiceNameAr = application.Service?.NameAr,
                ServiceNameEn = application.Service?.NameEn,
                ServiceTypeId = application.Service?.Type,
                ServiceTypeNameAr = serviceType?.NameAr,
                ServiceTypeNameEn = serviceType?.NameEn,
                Assignee = dispositionAssignee.Assignee,
                AssignedTo = dispositionAssignee.AssignedTo,
                ApplyForAr = applyFor?.Establishment?.NameAr,
                ApplyForEn = applyFor?.Establishment?.NameEn,
                UserTypeCode = applyFor.UserType?.Code,
                Status = isCompleted
                    ? (string.IsNullOrWhiteSpace(finalAdminStatus)
                        ? await _typeDictionaryService.GetLocalizedNameAsync(
                            "ApplicationStatuses", ((int)ApplicationStatus.DispositionVerification).ToString(), (isArabic ? "ar" : "en"))
                        : finalAdminStatus)
                    : liveStatus,
                // Numeric status for the frontend (StatusId). A disposition row has no
                // ApprovalNodeOrder process node, so mirror the ApplicationStatus already shown in
                // `Status`: Pending Disposition (108) / Disposition Verification (109) while live,
                // or the case's final application status (Completed/Rejected) once terminal. This
                // was previously unset, so a 302 in Pending Disposition returned StatusId = null
                // and the frontend had no value to branch on.
                StatusId = isCompleted
                    ? (dispositionCase.FinalStatusId ?? (int)ApplicationStatus.Completed)
                    : (dispositionCase.LastSubmissionId.HasValue
                        ? (int)ApplicationStatus.DispositionVerification
                        : (int)ApplicationStatus.PendingDisposition),
                SubmissionTime = application.CreatedOn,
                LastUpdatedTime = lastUpdatedTime,
                AIStatus = application.ApplicationExt.AIStatus,
                AIResult = application.ApplicationExt.AIResult,
                ApplicationDetailId = application.ApplicationDetail?.Id ?? dispositionCase.ApplicationDetailId ?? 0,
                ProcessInstanceId = processInstanceId,
                OldProcessInstanceId = processInstanceId,
                TaskId = $"disposition-{dispositionCase.Id}",
                TaskStatus = taskStatus,
                // Drive the to-do vs completed classification (IsCompletedReviewItem reads
                // TaskStatusId): a terminal disposition (Verified/NotVerified) maps to the
                // completed Camunda status that matches the case's final application status
                // (Completed/Rejected) so it lands in the Completed tab and leaves the to-do
                // list; an active disposition stays null and remains a to-do.
                TaskStatusId = isCompleted
                    ? (dispositionCase.FinalStatusId == (int)ApplicationStatus.Rejected
                        ? (int)ApprovalNodeOrder.Rejected
                        : (int)ApprovalNodeOrder.Completed)
                    : (int?)null,
                TaskCreatedTime = dispositionCase.UpdatedOn ?? dispositionCase.CreatedOn,
                TaskDueTime = dispositionCase.DueDate,
                TaskApprovalAt = isCompleted ? dispositionCase.VerifiedAt ?? dispositionCase.ExpiredAt : null,
                TaskApprovalDepartment = null,
                TaskApprovalRole = null,
                ButtonJson = isCompleted ? null : PostCertificateDispositionPolicy.BuildDispositionVerificationButtonJson((isArabic ? "ar" : "en"), _workflowTransitionRegistry),
                DispositionCaseId = dispositionCase.Id,
                DispositionCase = dispositionCaseDto,
                UserId = application.UserId,
                ProfileId = application.ProfileId,
                ProfileIsVIP = applyFor?.IsVip ?? false,
                EstablishmentId = application.EstablishmentId,
                SLA = sla,
                IsArabic = _currentUserService.IsArabicLanguage
            };

            EnrichAiAuditDisplay(reviewItem);
            return reviewItem;
        }

        internal static async Task<Dictionary<int, string>> LoadDispositionReviewerIdsAsync(
            AdminPortalDBContext dbContext,
            IEnumerable<DispositionCase> dispositionCases)
        {
            var cases = dispositionCases.ToList();
            var sourceRecordIds = cases
                .Where(dispositionCase => dispositionCase.SourceApprovalRecordId.HasValue)
                .Select(dispositionCase => dispositionCase.SourceApprovalRecordId!.Value)
                .Distinct()
                .ToArray();
            var sourceApproverIds = sourceRecordIds.Length == 0
                ? new Dictionary<int, string?>()
                : await dbContext.ApprovalRecords
                    .AsNoTracking()
                    .Where(record => sourceRecordIds.Contains(record.Id))
                    .ToDictionaryAsync(record => record.Id, record => record.ApproverId);

            var result = new Dictionary<int, string>();
            foreach (var dispositionCase in cases)
            {
                var sourceApproverId = dispositionCase.SourceApprovalRecordId.HasValue
                    && sourceApproverIds.TryGetValue(dispositionCase.SourceApprovalRecordId.Value, out var approverId)
                        ? approverId
                        : null;
                var assignedReviewerId = DispositionCaseAppService.ResolveAssignedReviewerId(
                    sourceApproverId,
                    dispositionCase.CreatedBy);
                if (!string.IsNullOrWhiteSpace(assignedReviewerId))
                {
                    result[dispositionCase.Id] = assignedReviewerId;
                }
            }

            return result;
        }

        internal static IEnumerable<DispositionCase> FilterDispositionCasesByReviewer(
            IEnumerable<DispositionCase> dispositionCases,
            IReadOnlyDictionary<int, string> reviewerIds,
            string? currentUserId)
        {
            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                return Enumerable.Empty<DispositionCase>();
            }

            return dispositionCases.Where(dispositionCase =>
                reviewerIds.TryGetValue(dispositionCase.Id, out var reviewerId)
                && string.Equals(reviewerId, currentUserId, StringComparison.OrdinalIgnoreCase));
        }

        internal static List<DispositionAssignment> BuildDispositionAssignments(
            IEnumerable<DispositionCase> dispositionCases,
            IReadOnlyDictionary<int, string> reviewerIds)
        {
            return dispositionCases
                .Where(dispositionCase => reviewerIds.ContainsKey(dispositionCase.Id))
                .Select(dispositionCase => new DispositionAssignment(
                    dispositionCase,
                    reviewerIds[dispositionCase.Id]))
                .ToList();
        }

        internal static PersonalDispositionReviewScope BuildPersonalDispositionReviewScope(
            IEnumerable<DispositionCase> dispositionCases,
            IReadOnlyDictionary<int, string> reviewerIds,
            string? currentUserId)
        {
            var allCases = dispositionCases.ToList();
            var visibleAssignments = string.IsNullOrWhiteSpace(currentUserId)
                ? new List<DispositionAssignment>()
                : BuildDispositionAssignments(allCases, reviewerIds)
                    .Where(assignment => string.Equals(
                        assignment.ReviewerId,
                        currentUserId,
                        StringComparison.OrdinalIgnoreCase))
                    .ToList();

            return new PersonalDispositionReviewScope(
                visibleAssignments,
                allCases.Select(dispositionCase => dispositionCase.ApplicationId).ToHashSet());
        }

        internal static (string Assignee, string AssignedTo) BuildDispositionAssignee(
            string assignedReviewerId,
            string? assignedReviewerName)
        {
            return (assignedReviewerId, assignedReviewerName ?? assignedReviewerId);
        }

        internal sealed record DispositionAssignment(
            DispositionCase DispositionCase,
            string ReviewerId);

        internal sealed record PersonalDispositionReviewScope(
            IReadOnlyList<DispositionAssignment> VisibleAssignments,
            HashSet<int> SuppressedApplicationIds);

        private async Task<Dictionary<string, string>> LoadAdminUserDisplayNamesAsync(
            IEnumerable<string> userIds)
        {
            var ids = userIds
                .Where(userId => !string.IsNullOrWhiteSpace(userId))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (ids.Length == 0)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            var users = await _db.AdminUsers
                .AsNoTracking()
                .Where(user => ids.Contains(user.Id))
                .Select(user => new { user.Id, user.FirstName, user.LastName, user.UserName })
                .ToListAsync();

            return users.ToDictionary(
                user => user.Id,
                user => BuildUserName(user.FirstName, user.LastName, user.UserName) ?? user.Id,
                StringComparer.OrdinalIgnoreCase);
        }

        private async Task<DispositionCaseDetailDto> BuildDispositionCaseDtoAsync(
            DispositionCase dispositionCase,
            Domain.Models.Workflow.DispositionSubmission? submission)
        {
            return new DispositionCaseDetailDto
            {
                CaseId = dispositionCase.Id,
                CaseStatus = await PostCertificateDispositionPolicy.GetDispositionCaseStatusDisplayAsync(
                    dispositionCase.FinalDispositionStatusId, (isArabic ? "ar" : "en"), _typeDictionaryService),
                DueDate = dispositionCase.DueDate,
                LatestSubmission = submission == null ? null : new DispositionSubmissionDetailDto
                {
                    SubmissionId = submission.Id,
                    Method = submission.Method,
                    SupportingDocuments = System.Text.Json.JsonSerializer.Deserialize<List<string>>(submission.SupportingDocumentsJson) ?? new(),
                    Notes = submission.Notes,
                    SubmittedBy = submission.SubmittedBy,
                    SubmittedOn = submission.SubmittedOn,
                    ReviewResult = submission.ReviewWorkflowActionCode.HasValue
                        ? (isArabic
                            ? _workflowTransitionRegistry.GetByActionCode(submission.ReviewWorkflowActionCode.Value).LabelAr
                            : _workflowTransitionRegistry.GetByActionCode(submission.ReviewWorkflowActionCode.Value).LabelEn)
                        : null,
                    ReviewerComment = submission.ReviewerComment,
                    ReviewedBy = submission.ReviewedBy,
                    ReviewedOn = submission.ReviewedOn,
                }
            };
        }

        public async Task<TeamDashboardResponse> GetContentTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc")
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;

            // Use AdminUsers (same as Licensing path) — Content dept staff are stored in AdminUsers.
            var departmentUsers = await (from ud in _db.UserDepartments
                                         join u in _db.AdminUsers on ud.UserId equals u.Id
                                         where ud.DepartmentId == (int)DepartmentEnum.Content && u.IsActive
                                         select u).ToListAsync();
            var userIds = departmentUsers.Select(u => u.Id).ToList();

            // Use the same GetDepartmentTasksAsync as Licensing — applies svc.Department == Content filter
            // and resolves ApprovalDate from ApprovalRecords (inner-joins only tasks with an approval record).
            var allCurrentTasks = await GetDepartmentTasksAsync((int)DepartmentEnum.Content, userIds, start, end);

            var list = await GetTeamDashboardListInternalAsync((int)DepartmentEnum.Content, days, startDate, endDate, keyword, orderby, sort);

            var total = list.Count;
            var pagedList = list.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToList();

            // 1. AvgApprovalRate: Average of each member's ApprovalRate
            var avgApprovalRate = list.Any() ? list.Average(x => x.ApprovalRate) : 0;

            // 2. AvgProcessingTime: task-level definition (docs §1-2) — prefer ActualDurationMinutes, fall back to ApprovalDate−CreatedTime
            var allCompletedTasks = allCurrentTasks.Where(t => t.ApprovalDate.HasValue).ToList();
            var avgProcessingMinutes = allCompletedTasks.Any()
                ? allCompletedTasks.Average(t => ResolveTaskProcessingMinutes(t.CreatedTime, t.ApprovalDate, t.ActualDurationMinutes))
                : 0;

            // 3. AvgSLACompliance: Percentage of ALL completed tasks that are SLA compliant
            var allSlaCompliantTasks = allCompletedTasks.Count(t => t.DueDate.HasValue && t.ApprovalDate!.Value <= t.DueDate.Value);
            var avgSlaCompliance = allCompletedTasks.Any()
                ? (double)allSlaCompliantTasks / allCompletedTasks.Count * 100
                : 100;

            return new TeamDashboardResponse
            {
                AvgSLACompliance = Math.Round(avgSlaCompliance, 1),
                AvgProcessingTime = ContentDashboardSharedSupportService.FormatDuration(avgProcessingMinutes, false),
                AvgApprovalRate = Math.Round(avgApprovalRate, 1),
                Page = new PageResponse<TeamMemberDashboardListDto>(pagedList, total, pageIndex, pageSize)
            };
        }

        public async Task<byte[]> ExportContentTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? orderby = null, string? sort = "desc")
        {
            var data = await GetTeamDashboardListInternalAsync((int)DepartmentEnum.Content, days, startDate, endDate, keyword, orderby, sort);
            return BuildTeamExportCsv(data);
        }

        public async Task<TeamDashboardResponse> GetTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, int pageIndex = 1, int pageSize = 10, string? orderby = null, string? sort = "desc")
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;

            // Fetch team members for Department 1
            var departmentUsers = await (from ud in _db.UserDepartments
                                         join u in _db.AdminUsers on ud.UserId equals u.Id
                                         where ud.DepartmentId == (int)DepartmentEnum.Licensing && u.IsActive
                                         select u).ToListAsync();
            var userIds = departmentUsers.Select(u => u.Id).ToList();

            // Fetch all tasks for these users in the current period (filtered by Department 1 services)
            var baseTasks = await (from t in _db.CamundaTasks
                                   join proc in _db.CamundaProcessInstances on t.ProcessInstanceId equals proc.ProcessInstanceId
                                   join app in _db.Applications on proc.ApplicationId equals app.Id
                                   join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                                   where t.Assignee != null && userIds.Contains(t.Assignee)
                                         && t.CreatedTime >= start && t.CreatedTime <= end
                                         && svc.Department == (int)DepartmentEnum.Licensing
                                   select new { t.TaskId, t.Assignee, t.StatusId, t.ApprovalAt, t.CreatedTime, t.DueDate })
                                   .ToListAsync();

            // Resolve ApprovalDate (+ ActualDurationMinutes) from ApprovalRecords (two-step to avoid EF Core subquery translation issues)
            var licTaskIds = baseTasks.Select(t => t.TaskId).Distinct().ToList();
            var licApprovalRows = licTaskIds.Any()
                ? await _db.ApprovalRecords
                    .Where(r => r.TaskId != null && licTaskIds.Contains(r.TaskId) && r.ApprovalDate != null)
                    .Select(r => new { r.TaskId, r.ApprovalDate, r.ActualDurationMinutes })
                    .ToListAsync()
                : new();
            var licApprovalMap = licApprovalRows
                .GroupBy(r => r.TaskId!)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.ApprovalDate).First());

            var allCurrentTasks = baseTasks
                .Select(t => {
                    var hasApproval = licApprovalMap.TryGetValue(t.TaskId, out var appr);
                    return new {
                        t.Assignee, t.StatusId, t.ApprovalAt, t.CreatedTime, t.DueDate,
                        ApprovalDate = hasApproval ? appr!.ApprovalDate : t.ApprovalAt,
                        ActualDurationMinutes = hasApproval ? appr!.ActualDurationMinutes : (double?)null
                    };
                }).ToList();

            var list = await GetTeamDashboardListInternalAsync((int)DepartmentEnum.Licensing, days, startDate, endDate, keyword, orderby, sort);

            var total = list.Count;
            var pagedList = list.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToList();

            // 1. AvgApprovalRate: Average of each member's ApprovalRate
            var avgApprovalRate = list.Any() ? list.Average(x => x.ApprovalRate) : 0;

            // 2. AvgProcessingTime: task-level definition (docs §1-2) — prefer ActualDurationMinutes, fall back to ApprovalDate−CreatedTime
            var allCompletedTasks = allCurrentTasks.Where(t => t.ApprovalDate.HasValue).ToList();
            var avgProcessingMinutes = allCompletedTasks.Any()
                ? allCompletedTasks.Average(t => ResolveTaskProcessingMinutes(t.CreatedTime, t.ApprovalDate, t.ActualDurationMinutes))
                : 0;

            // 3. AvgSLACompliance: Percentage of ALL completed tasks that are SLA compliant
            var allSlaCompliantTasks = allCompletedTasks.Count(t => t.DueDate.HasValue && t.ApprovalDate!.Value <= t.DueDate.Value);
            var avgSlaCompliance = allCompletedTasks.Any()
                ? (double)allSlaCompliantTasks / allCompletedTasks.Count * 100
                : 100;

            return new TeamDashboardResponse
            {
                AvgSLACompliance = Math.Round(avgSlaCompliance, 1),
                AvgProcessingTime = ContentDashboardSharedSupportService.FormatDuration(avgProcessingMinutes, false),
                AvgApprovalRate = Math.Round(avgApprovalRate, 1),
                Page = new PageResponse<TeamMemberDashboardListDto>(pagedList, total, pageIndex, pageSize)
            };
        }
        public async Task<byte[]> ExportTeamDashboardListAsync(int days, DateTime? startDate = null, DateTime? endDate = null, string? keyword = null, string? orderby = null, string? sort = "desc")
        {
            var data = await GetTeamDashboardListInternalAsync((int)DepartmentEnum.Licensing, days, startDate, endDate, keyword, orderby, sort);
            return BuildTeamExportCsv(data);
        }
        private async Task<List<TeamMemberDashboardListDto>> GetTeamDashboardListInternalAsync(
            int departmentId, int days, DateTime? startDate = null, DateTime? endDate = null,
            string? keyword = null, string? orderby = null, string? sort = "desc")
        {
            var start = startDate ?? DateTimeHelper.Now.Date.AddDays(-(days - 1));
            var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? DateTimeHelper.Now;
            var periodDays = (int)(end - start).TotalDays + 1;
            var prevStart = start.AddDays(-periodDays);

            var userQuery = from ud in _db.UserDepartments
                            join u in _db.AdminUsers on ud.UserId equals u.Id
                            where ud.DepartmentId == departmentId && u.IsActive
                            select u;

            if (!string.IsNullOrEmpty(keyword))
                userQuery = userQuery.Where(u => (u.FirstName + " " + u.LastName).Contains(keyword));

            var users = await userQuery
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .ToListAsync();

            var userIds = users.Select(u => u.Id).ToList();

            var currentTasks = await GetDepartmentTasksAsync(departmentId, userIds, start, end);
            var prevTasks = await GetDepartmentTasksAsync(departmentId, userIds, prevStart, start.AddTicks(-1));

            var list = new List<TeamMemberDashboardListDto>();
            foreach (var user in users)
            {
                var curUserTasks = currentTasks.Where(t => t.Assignee == user.Id).ToList();
                var preUserTasks = prevTasks.Where(t => t.Assignee == user.Id).ToList();

                var curTotal = curUserTasks.Count;
                var curApproved = curUserTasks.Count(t => t.StatusId == (int)ApprovalNodeOrder.Completed || t.StatusId == (int)ApprovalNodeOrder.Approved);
                var curRejected = curUserTasks.Count(t => t.StatusId == (int)ApprovalNodeOrder.Rejected);
                var curApprovalRate = (curApproved + curRejected) > 0 ? (double)curApproved / (curApproved + curRejected) * 100 : 0;

                var curCompletedTasks = curUserTasks.Where(t => t.ApprovalDate.HasValue).ToList();
                var curAvgProcTime = curCompletedTasks.Any()
                    ? curCompletedTasks.Average(t => ResolveTaskProcessingMinutes(t.CreatedTime, t.ApprovalDate, t.ActualDurationMinutes))
                    : 0;

                var curSlaCompliant = curCompletedTasks.Count(t => t.DueDate.HasValue && t.ApprovalDate!.Value <= t.DueDate.Value);
                var curSlaRate = curCompletedTasks.Any() ? (double)curSlaCompliant / curCompletedTasks.Count * 100 : 100;
                var curSlaBreaches = curCompletedTasks.Count(t => t.DueDate.HasValue && t.ApprovalDate!.Value > t.DueDate.Value);
                var curSlaBreachesRate = curCompletedTasks.Any() ? (double)curSlaBreaches / curCompletedTasks.Count * 100 : 100;

                var preTotal = preUserTasks.Count;
                var preApproved = preUserTasks.Count(t => t.StatusId == (int)ApprovalNodeOrder.Completed || t.StatusId == (int)ApprovalNodeOrder.Approved);
                var preRejected = preUserTasks.Count(t => t.StatusId == (int)ApprovalNodeOrder.Rejected);
                var preApprovalRate = (preApproved + preRejected) > 0 ? (double)preApproved / (preApproved + preRejected) * 100 : 0;

                var preCompletedTasks = preUserTasks.Where(t => t.ApprovalDate.HasValue).ToList();
                var preAvgProcTime = preCompletedTasks.Any()
                    ? preCompletedTasks.Average(t => ResolveTaskProcessingMinutes(t.CreatedTime, t.ApprovalDate, t.ActualDurationMinutes))
                    : 0;

                var preSlaCompliant = preCompletedTasks.Count(t => t.DueDate.HasValue && t.ApprovalDate!.Value <= t.DueDate.Value);
                var preSlaRate = preCompletedTasks.Any() ? (double)preSlaCompliant / preCompletedTasks.Count * 100 : 100;
                var preSlaBreaches = preCompletedTasks.Count(t => t.DueDate.HasValue && t.ApprovalDate!.Value > t.DueDate.Value);
                var preSlaBreachesRate = preCompletedTasks.Any() ? (double)preSlaBreaches / preCompletedTasks.Count * 100 : 100;

                list.Add(new TeamMemberDashboardListDto
                {
                    TeamMember = $"{user.FirstName} {user.LastName}",
                    ApplicationTasks = curTotal,
                    ApprovedApplications = curApproved,
                    RejectedApplications = curRejected,
                    ApprovalRate = Math.Round(curApprovalRate, 1),
                    AvgProcessingTime = curCompletedTasks.Any()
                        ? ContentDashboardSharedSupportService.FormatDuration(curAvgProcTime, false)
                        : "-",
                    AvgProcessingTimeMinutes = curAvgProcTime,
                    SLA = Math.Round(curSlaRate, 1),
                    SLACount = curSlaCompliant,
                    SLAPreCount = preSlaCompliant,
                    SlaBreaches = curSlaBreaches,
                    SlaBreachesCount = curSlaBreaches,
                    SlaPreBreachesCount = preSlaBreaches
                });
            }

            return ApplySort(list, orderby, sort, new Dictionary<string, Func<TeamMemberDashboardListDto, IComparable>>
            {
                ["applicationtasks"] = x => x.ApplicationTasks,
                ["approvedapplications"] = x => x.ApprovedApplications,
                ["rejectedapplications"] = x => x.RejectedApplications,
                ["approvalrate"] = x => x.ApprovalRate,
                ["avgprocessingtime"] = x => x.AvgProcessingTimeMinutes,
                ["sla"] = x => x.SLA,
                ["slabreaches"] = x => x.SlaBreaches,
            });
        }
        private double CalculateChange(double current, double previous)
        {
            if (previous == 0) return current > 0 ? 100 : 0;
            return Math.Round((current - previous) / previous * 100, 1);
        }

        // Projection type shared by department task queries to avoid anonymous-type duplication.
        // StatusId is the new int ApprovalNodeOrder id; the legacy string Status column was
        // removed as part of the Workflow.* status int migration.
        private record TaskSnapshot(string? Assignee, int? StatusId, DateTime? ApprovalAt, DateTime CreatedTime, DateTime? DueDate, DateTime? ApprovalDate, double? ActualDurationMinutes);

        // Task-level processing duration (minutes), aligned with docs/analytics/team-management-members-avg-processing-time.md §1-2:
        // (1) prefer ApprovalRecords.ActualDurationMinutes; (2) fall back to (ApprovalDate/ApprovalAt − CreatedTime).
        // Only called for completed tasks (with ApprovalDate/ApprovalAt); incomplete tasks are not counted in the average.
        private static double ResolveTaskProcessingMinutes(DateTime createdTime, DateTime? completedAt, double? actualDurationMinutes)
        {
            if (actualDurationMinutes.HasValue)
                return Math.Max(actualDurationMinutes.Value, 0);
            return completedAt.HasValue
                ? Math.Max((completedAt.Value - createdTime).TotalMinutes, 0)
                : 0;
        }

        // Generic in-memory sort driven by a caller-supplied key→selector map.
        private static List<T> ApplySort<T>(List<T> data, string? orderby, string? sort,
            Dictionary<string, Func<T, IComparable>> selectors)
        {
            if (string.IsNullOrEmpty(orderby) || !selectors.TryGetValue(orderby.ToLower(), out var selector))
                return data;
            bool isDesc = sort?.ToLower() == "desc";
            return isDesc ? data.OrderByDescending(selector).ToList() : data.OrderBy(selector).ToList();
        }

        // Fetches CamundaTasks for a department within a time window.
        // Department 1 (License) joins Application+ServiceConfig to exclude content tasks that may be assigned
        // to the same users; Department 2 (Content) relies on user-department membership for isolation.
        private async Task<List<TaskSnapshot>> GetDepartmentTasksAsync(
            int departmentId, List<string> userIds, DateTime start, DateTime end)
        {
            // Step 1: fetch base task rows.
            // Unified period time anchor: filter by the joined [Application].[Applications].[CreatedOn]
            // (the SAME table/column used by statistics TotalApplications and service/list), NOT the
            // task's own CamundaTasks.CreatedTime. This keeps the period scope consistent across the three
            // Content dashboards so their totals are computed over the same set of period applications.
            var tasks = await (from t in _db.CamundaTasks
                               join proc in _db.CamundaProcessInstances on t.ProcessInstanceId equals proc.ProcessInstanceId
                               join app in _db.Applications on proc.ApplicationId equals app.Id
                               join svc in _db.ServiceConfigs on app.ServiceId equals svc.Id
                               where t.Assignee != null && userIds.Contains(t.Assignee)
                                     && app.CreatedOn >= start && app.CreatedOn <= end
                                     && svc.Department == departmentId
                               select new { t.TaskId, t.Assignee, t.StatusId, t.ApprovalAt, t.CreatedTime, t.DueDate })
                              .ToListAsync();

            if (!tasks.Any())
                return new List<TaskSnapshot>();

            // Step 2: fetch the latest ApprovalDate (+ its ActualDurationMinutes) per TaskId from ApprovalRecords.
            var taskIds = tasks.Select(t => t.TaskId).Distinct().ToList();
            var approvalRows = await _db.ApprovalRecords
                .Where(r => r.TaskId != null && taskIds.Contains(r.TaskId) && r.ApprovalDate != null)
                .Select(r => new { r.TaskId, r.ApprovalDate, r.ActualDurationMinutes })
                .ToListAsync();
            var approvalDateMap = approvalRows
                .GroupBy(r => r.TaskId!)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(r => r.ApprovalDate).First());

            // Step 3: inner-join — only keep tasks that have a matching ApprovalRecord.
            return tasks
                .Where(t => approvalDateMap.ContainsKey(t.TaskId))
                .Select(t => new TaskSnapshot(
                    t.Assignee,
                    t.StatusId,
                    t.ApprovalAt,
                    t.CreatedTime,
                    t.DueDate,
                    approvalDateMap[t.TaskId].ApprovalDate,
                    approvalDateMap[t.TaskId].ActualDurationMinutes
                )).ToList();
        }

        // Shared CSV builder for both team dashboard export methods.
        private byte[] BuildTeamExportCsv(List<TeamMemberDashboardListDto> data)
        {
            var headers = new[]
            {
                "Team Member",
                "Application Tasks",
                "Approved Applications",
                "Rejected Applications",
                "Approval Rate (%)",
                "Avg Processing Time (d)",
                "SLA Compliance (%)"
            };
            using var ms = new MemoryStream();
            using (var sw = new StreamWriter(ms, Encoding.UTF8, leaveOpen: true))
            {
                sw.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
                foreach (var item in data)
                {
                    var row = new List<string>
                    {
                        item.TeamMember,
                        item.ApplicationTasks.ToString(),
                        item.ApprovedApplications.ToString(),
                        item.RejectedApplications.ToString(),
                        $"{item.ApprovalRate:F1}%",
                        item.AvgProcessingTime,
                        $"{item.SLA:F1}%"
                    };
                    sw.WriteLine(string.Join(",", row.Select(cell => $"\"{cell.Replace("\"", "\"\"")}\"")));
                }
            }
            return ms.ToArray();
        }

        public async Task<List<UserDepartLogsDto>> TeamMemberUserLeavesAsync(int departmentId)
        {
            var userleavelogsQuery = from ud in _queryableContext.GetQueryable<UserDepartmentModel>()
                                     from log in _queryableContext.GetQueryable<LeaveLogModel>().Where(w => w.UserId == ud.UserId).DefaultIfEmpty()
                                     from u in _queryableContext.GetQueryable<UMC.AdminPortal.Domain.Models.AdminUser>().Where(w => w.Id == ud.UserId).DefaultIfEmpty()

                                     where ud.DepartmentId == departmentId && u.Id != null
                                     select new UserDepartLogsDto(ud.UserId, u.FirstName + " " + u.LastName, ud.DepartmentId, ud.IsMaster, ud.IsLeader, log.IsLeave, log.LeaveTypeCode, log.BriefDescription, log.ExpectedReturnDate, log.CreatedOn);

            return await userleavelogsQuery.AsNoTracking().ToListAsync();

            //var Data = await userleavelogsQuery.AsNoTracking().ToListAsync();

            //var userLogs = Data.Select(s => (  s.userDeps, s.userLogs));
            //if (userLogs.Any())
            //{
            //    foreach (var (userDep, log) in userLogs)
            //    {
            //        // await _dbTypeDictionary.FindAsync(a => a.Scope == "LeaveTypes");
            //        var leaveTypes = await _typeDictionaryService.GetListAsync("LeaveTypes");
            //        userDepartLogsList.Add(new UserDepartLogsDto(userDep.UserId, userDep.DepartmentId, userDep.IsMaster, userDep.IsLeader, log.IsLeave, log.LeaveTypeCode, log.ExpectedReturnDate, log.CreatedOn));
            //    }
            //}
            //return userDepartLogsList;

        }
        internal static IQueryable<GetPageByProfilePageResponse> ApplyApplicationPageByProfileDateFilterAndSort(
            IQueryable<GetPageByProfilePageResponse> query,
            GetPageByProfilePageRequest req)
        {
            if (req.SubmissionStartTime.HasValue)
                query = query.Where(a => a.LastUpdatedTime >= req.SubmissionStartTime.Value);
            if (req.SubmissionEndTime.HasValue)
                query = query.Where(a => a.LastUpdatedTime < req.SubmissionEndTime.Value.AddDays(1));

            switch (req.SortBy?.ToLower())
            {
                case "sla":
                    {
                        if (req.SortDirection == SortDirection.Ascending)
                            query = query.OrderBy(a => a.SLA);
                        else if (req.SortDirection == SortDirection.Descending)
                            query = query.OrderByDescending(a => a.SLA);
                    }
                    break;
                case "lastupdatedtime":
                    {
                        if (req.SortDirection == SortDirection.Ascending)
                            query = query.OrderBy(a => a.LastUpdatedTime);
                        else if (req.SortDirection == SortDirection.Descending)
                            query = query.OrderByDescending(a => a.LastUpdatedTime);
                    }
                    break;
                default:
                    query = query.OrderByDescending(a => a.LastUpdatedTime);
                    break;
            }

            return query;
        }
        public async Task<GetApplicationPageByProfileResponse> GetApplicationPageByProfileAsync(GetPageByProfilePageRequest req)
        {
            var result = new GetApplicationPageByProfileResponse();
            var applicationList = await _applicationService.GetApplicationListByProfileAsync(req.UserId, req.ProfileId);
            if (!applicationList.Any())
                return result;

            var applicationIds = applicationList.Select(a => a.Id).ToArray();
            var applicationStatusMap = (await _db.ApplicationDetails
                .AsNoTracking()
                .Where(a => applicationIds.Contains(a.ApplicationId) && !a.DeletedOn.HasValue)
                .Select(a => new { a.Id, a.ApplicationId, a.ApplicationStatusId })
                .ToListAsync())
                .GroupBy(a => a.ApplicationId)
                .ToDictionary(a => a.Key, a => a.OrderByDescending(x => x.Id).First().ApplicationStatusId.ToString());
            var processInstanceList = await _db.CamundaProcessInstances.Where(a => applicationIds.Contains(a.ApplicationId)).ToListAsync();
            var processInstanceIds = processInstanceList.Select(a => a.ProcessInstanceId).Distinct().ToArray();
            var taskList = await _db.CamundaTasks.Where(a => processInstanceIds.Contains(a.ProcessInstanceId)).ToListAsync();
            var lastTimelineTimeMap = await GetLastTimelineTimeMapAsync(applicationIds);
            // Batched here to replace the per-row GetLatestDispositionStatusAsync query inside the loop (N+1 -> 1).
            var dispositionStatusMap = await GetLatestDispositionStatusMapAsync(
                processInstanceList.Select(a => a.ProcessInstanceId));
            var profileIds = applicationList.Select(a => a.ProfileId).Where(a => a > 0).ToArray();
            var applyForList = await _userService.GetEstablishmentsByProfileIdsAsync(profileIds);
            var serviceTypeList = await _typeDictionaryService.GetListAsync("ServiceConfigServiceType");
            var assigneeIds = taskList
                .Select(a => a.Assignee)
                .Where(a => !string.IsNullOrWhiteSpace(a))
                .Distinct()
                .ToArray()!;
            var assigneeMap = assigneeIds.Length == 0
                ? new Dictionary<string, AdminUser>(StringComparer.OrdinalIgnoreCase)
                : (await _db.AdminUsers
                    .Where(a => assigneeIds.Contains(a.Id))
                    .ToListAsync())
                    .GroupBy(a => a.Id, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(a => a.Key, a => a.First(), StringComparer.OrdinalIgnoreCase);

            var list = new List<GetPageByProfilePageResponse>();
            foreach (var application in applicationList)
            {
                var processInstance = processInstanceList.Where(a => a.ApplicationId == application.Id).OrderByDescending(a => a.Id).FirstOrDefault();
                if (processInstance == null)
                    continue;
                var task = taskList.Where(a => a.ProcessInstanceId == processInstance.ProcessInstanceId).OrderByDescending(a => a.Id).FirstOrDefault();
                if (task == null)
                    continue;
                var applyFor = applyForList.FirstOrDefault(a => a.Id == application.ProfileId);
                if (applyFor == null)
                    continue;
                var serviceType = serviceTypeList.FirstOrDefault(a => a.Code == application.Service?.Type);
                dispositionStatusMap.TryGetValue(processInstance?.ProcessInstanceId ?? string.Empty, out var dispositionStatusId);
                var statusLabel = await PostCertificateDispositionPolicy.LocalizeDispositionFinalStatusAsync(
                    processInstance?.StatusId, dispositionStatusId, (isArabic ? "ar" : "en"), _typeDictionaryService);
                assigneeMap.TryGetValue(task.Assignee ?? string.Empty, out var assignee);
                var slaRemainingMinutes = task.DueDate.HasValue ? (task.DueDate.Value - DateTimeHelper.Now).TotalMinutes : (double?)null;
                var taskCategoryDisplay = isArabic ? "الطلبات" : "Applications";
                list.Add(new GetPageByProfilePageResponse()
                {
                    ApplicationId = application.Id,
                    ApplicationNumber = application.ApplicationNumber,
                    ServiceName = isArabic ? application.Service?.NameAr : application.Service?.NameEn,
                    ServiceCategoryName = isArabic ? application.Service?.ServiceCategory?.NameAr : application.Service?.ServiceCategory?.NameEn,
                    Type = application.Service?.Type,
                    TypeName = isArabic ? serviceType?.NameAr : serviceType?.NameEn,
                    SLA = ((task.ApprovalAt ?? DateTimeHelper.Now) - task.DueDate)?.TotalMinutes,
                    IsArabic = _currentUserService.IsArabicLanguage,
                    Status = statusLabel,
                    StatusId = processInstance?.StatusId,
                    SubmissionTime = application.CreatedOn,
                    LastUpdatedTime = lastTimelineTimeMap.TryGetValue(application.Id, out var lastTimelineTime)
                        ? lastTimelineTime
                        : application.CreatedOn,
                    ServiceDepartment = application.Service?.DepartmentInfo?.NameEn,
                    ServiceDepartmentId = application.Service?.Department ?? 0,
                    ApplyFor = isArabic ? applyFor.Establishment?.NameAr : applyFor.Establishment?.NameEn,
                    UserTypeCode = applyFor.UserType?.Code,
                    TaskId = task.TaskId,
                    SourceId = task.TaskId,
                    TaskNo = application.ApplicationNumber,
                    TaskCategoryDisplay = taskCategoryDisplay,
                    AssignedToUserId = task.Assignee,
                    AssignedTo = BuildAssignedToDisplay(task.Assignee, assignee?.FirstName, assignee?.LastName, assignee?.UserName),
                    StatusCode = processInstance?.StatusId?.ToString(),
                    ApplicationStatusCode = applicationStatusMap.GetValueOrDefault(application.Id),
                    StatusDisplay = statusLabel,
                    LastUpdatedOn = task.ApprovalAt ?? task.CreatedTime,
                    IsUrgent = false,
                    CanReassign = !task.ApprovalAt.HasValue
                        && processInstance?.StatusId.HasValue == true
                        && !WorkflowNonReassignableStatuses.Contains(processInstance.StatusId.Value),
                    DetailTarget = $"applications/{application.Id}?taskId={task.TaskId}",
                    SlaInfo = new GetPageByProfileSlaInfo
                    {
                        RemainingMinutes = slaRemainingMinutes,
                        DisplayText = slaRemainingMinutes.ToSLAString(_currentUserService.IsArabicLanguage),
                        IsOverdue = task.DueDate.HasValue && task.DueDate.Value < DateTimeHelper.Now,
                        DueOn = task.DueDate
                    }
                });
            }

            result.Report = new GetPageByProfileReportResponse()
            {
                TotalCount = list.Count(),
                LicenseCount = list.Count(a => a.ServiceDepartmentId == (int)DepartmentEnum.Licensing),
                ContentCount = list.Count(a => a.ServiceDepartmentId == (int)DepartmentEnum.Content),
                CompletedCount = list.Count(a => a.StatusId == (int)ApprovalNodeOrder.Completed),
                RejectedCount = list.Count(a => a.StatusId == (int)ApprovalNodeOrder.Rejected),
                CancelledCount = list.Count(a => a.StatusId == (int)ApprovalNodeOrder.Cancelled)

            };

            result.ProcessInstanceStatus = list.Select(a => a.Status).Distinct().ToArray();

            var query = list.AsQueryable();

            if (!req.Keyword.IsNullOrEmpty())
            {
                req.Keyword = req.Keyword.ToLower();
                query = query.Where(a => a.ApplicationNumber.ToLower().Contains(req.Keyword) ||
                                        a.ServiceName.ToLower().Contains(req.Keyword) ||
                                        a.ApplyFor.ToLower().Contains(req.Keyword)
                                        );
            }
            if (!req.ServiceType.IsNullOrEmpty())
                query = query.Where(a => a.Type == req.ServiceType);
            if (!req.ApplicationStatusCode.IsNullOrEmpty() && req.ApplicationStatusCode != ((int)ApplicationStatus.AllStatuses).ToString())
                query = query.Where(a => a.ApplicationStatusCode == req.ApplicationStatusCode);
            if (!req.ProcessInstanceStatusCode.IsNullOrEmpty())
                query = query.Where(a => a.StatusCode == req.ProcessInstanceStatusCode);
            else if (!req.ProcessInstanceStatus.IsNullOrEmpty())
                query = query.Where(a => a.Status == req.ProcessInstanceStatus);
            query = ApplyApplicationPageByProfileDateFilterAndSort(query, req);

            var totalPageData = query.ToList();
            var pageData = totalPageData
                .Skip((req.PageIndex - 1) * req.PageSize)
                .Take(req.PageSize)
                .ToList();

            result.Page = new PageResponse<GetPageByProfilePageResponse>(pageData, totalPageData.Count, req.PageIndex, req.PageSize);

            return result;
        }

        public async Task<ApplicationApplicantDetailDto> GetApplicationApplicantDetailByApplicationIdAsync(int applicationId)
        {
            if (applicationId <= 0)
            {
                throw new BusinessException("Application id is required.");
            }

            var application = await _db.Applications
                .AsNoTracking()
                .FirstOrDefaultAsync(x => !x.IsDelete && x.Id == applicationId);

            if (application == null)
            {
                throw new BusinessException($"Application {applicationId} was not found.");
            }

            var userProfile = application.ProfileId > 0
                ? await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == application.ProfileId)
                : null;

            var user = !string.IsNullOrWhiteSpace(userProfile?.UserId)
                ? await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userProfile.UserId)
                : null;

            var userType = userProfile != null
                ? await _db.UserTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userProfile.UserTypeId)
                : null;

            var person = userProfile != null && userProfile.PersonId > 0
                ? await _db.Persons.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userProfile.PersonId)
                : null;

            var address = userProfile != null && userProfile.AddressId > 0
                ? await _db.Address.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userProfile.AddressId)
                : null;

            var addressDto = await BuildApplicationApplicantAddressAsync(address);

            return new ApplicationApplicantDetailDto
            {
                Application = new ApplicationApplicantApplicationDto
                {
                    Id = application.Id,
                    ApplicationNumber = application.ApplicationNumber,
                    ServiceId = application.ServiceId,
                    UserId = application.UserId,
                    ProfileId = application.ProfileId,
                    EstablishmentId = application.EstablishmentId,
                    OfficeId = application.OfficeId,
                    CreatedOn = application.CreatedOn,
                    IsTest = application.IsTest
                },
                UserProfile = userProfile == null
                    ? null
                    : new ApplicationApplicantUserProfileDto
                    {
                        Id = userProfile.Id,
                        UserId = userProfile.UserId,
                        UserTypeId = userProfile.UserTypeId,
                        PersonId = userProfile.PersonId,
                        AddressId = userProfile.AddressId,
                        MediaFileNumber = userProfile.MediaFileNumber,
                        ProfileCode = userProfile.ProfileCode,
                        Status = userProfile.Status,
                        IsVip = userProfile.IsVip,
                        IsActive = userProfile.IsActive,
                        CreatedOn = userProfile.CreatedOn,
                        UpdateOn = userProfile.UpdateOn
                    },
                User = user == null
                    ? null
                    : new ApplicationApplicantUserDto
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Email = user.Email,
                        PhoneNumber = ContactNumberHelper.Compose(user.PhoneCountryCode, user.PhoneLocalNumber, user.PhoneNumber),
                        PhoneCountryCode = user.PhoneCountryCode,
                        PhoneLocalNumber = user.PhoneLocalNumber,
                        IsActive = user.IsActive,
                        Status = user.Status,
                        CreatedOn = user.CreatedOn,
                        LastLoginDate = user.LastLoginDate
                    },
                UserType = userType == null
                    ? null
                    : new ApplicationApplicantUserTypeDto
                    {
                        Id = userType.Id,
                        Code = userType.Code,
                        Name = isArabic ? userType.NameAr : userType.NameEn
                    },
                Person = person == null
                    ? null
                    : new ApplicationApplicantPersonDto
                    {
                        Id = person.Id,
                        Name = isArabic && !string.IsNullOrWhiteSpace(person.NameAr) ? person.NameAr : person.Name,
                        NationalityId = person.NationalityId,
                        EmiratesId = person.EmiratesId,
                        PassportNumber = person.PassportNumber,
                        UID = person.UID,
                        PersonalEmail = person.PersonalEmail,
                        PersonalMobile = ContactNumberHelper.Compose(person.MobileCountryCode, person.MobileLocalNumber, person.PersonalMobile),
                        MobileCountryCode = person.MobileCountryCode,
                        MobileLocalNumber = person.MobileLocalNumber,
                        DateOfBirth = person.DateOfBirth,
                        PhotoUrl = person.PhotoUrl,
                        IsSmartpass = person.IsSmartpass
                    },
                Address = addressDto
            };
        }

        private async Task<ApplicationApplicantAddressDto?> BuildApplicationApplicantAddressAsync(Address? address)
        {
            if (address == null)
            {
                return null;
            }

            Community? community = null;
            if (address.CommunityId.HasValue)
            {
                community = await _db.Set<Community>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == address.CommunityId.Value);
            }

            Region? region = null;
            var resolvedRegionId = address.RegionId;
            if (!resolvedRegionId.HasValue && community?.RegionId.HasValue == true)
            {
                resolvedRegionId = community.RegionId.Value;
            }

            if (resolvedRegionId.HasValue)
            {
                region = await _db.Regions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == resolvedRegionId.Value);
            }

            Emirate? emirate = null;
            var resolvedEmirateId = address.EmirateId;
            if (!resolvedEmirateId.HasValue && region != null)
            {
                resolvedEmirateId = region.EmirateId;
            }

            if (resolvedEmirateId.HasValue)
            {
                emirate = await _db.Emirates
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == resolvedEmirateId.Value);
            }

            var country = address.CountryId.HasValue
                ? await _db.Countries
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == address.CountryId.Value)
                : null;

            var isCountryAddress = address.CountryId.HasValue
                && !resolvedEmirateId.HasValue
                && !resolvedRegionId.HasValue
                && !address.CommunityId.HasValue;

            return new ApplicationApplicantAddressDto
            {
                Id = address.Id,
                CountryId = address.CountryId,
                CountryName = isArabic && !string.IsNullOrWhiteSpace(country?.NameAr) ? country.NameAr : country?.NameEn,
                EmirateId = resolvedEmirateId,
                EmirateName = isArabic && !string.IsNullOrWhiteSpace(emirate?.NameAr) ? emirate.NameAr : emirate?.NameEn,
                RegionId = resolvedRegionId,
                RegionName = isArabic && !string.IsNullOrWhiteSpace(region?.NameAr) ? region.NameAr : region?.NameEn,
                CommunityId = address.CommunityId,
                CommunityName = isArabic && !string.IsNullOrWhiteSpace(community?.NameAr) ? community.NameAr : community?.NameEn,
                Street = address.Street,
                PhoneNumber = ContactNumberHelper.Compose(address.PhoneCountryCode, address.PhoneLocalNumber, address.PhoneNumber),
                PhoneCountryCode = address.PhoneCountryCode,
                PhoneLocalNumber = address.PhoneLocalNumber,
                Longitude = address.Longitude,
                Latitude = address.Latitude,
                LocationUrl = address.LocationUrl,
                IsCountryAddress = isCountryAddress
            };
        }

        private static string? BuildUserName(string? firstName, string? lastName, string? fallback)
        {
            var fullName = string.Join(" ", new[] { firstName, lastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return string.IsNullOrWhiteSpace(fullName) ? fallback : fullName;
        }

        private static string? BuildAssignedToDisplay(string? assignee, string? firstName, string? lastName, string? fallback)
        {
            return string.Equals(assignee, SelfMonitorSystemRole.FallbackAssigneeId, StringComparison.OrdinalIgnoreCase)
                ? SelfMonitorSystemRole.FallbackAssigneeId
                : BuildUserName(firstName, lastName, fallback);
        }

        /// <summary>
        /// Fills §6 AI audit display hints on review DTOs for Admin frontend.
        /// </summary>
        private static void EnrichAiAuditDisplay(MyReviewPageResponse item)
        {
            ContentAiAuditDisplayHelper.ApplyDisplayFields(
                item.AIStatus,
                item.AIResult,
                (labelEn, inProgress, showReport, riskLevel) =>
                {
                    item.AIAnalysisPhaseLabelEn = labelEn;
                    item.AIAnalysisInProgress = inProgress;
                    item.AIAnalysisShowReport = showReport;
                    item.AIRiskLevel = riskLevel;
                });
        }

    }


}

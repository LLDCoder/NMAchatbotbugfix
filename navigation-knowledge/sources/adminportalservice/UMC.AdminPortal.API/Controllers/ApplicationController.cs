using Microsoft.AspNetCore.Mvc;
using System;
using Microsoft.AspNetCore.Authorization;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.Dtos.Application;
using UMC.AdminPortal.Application.Dtos.Workflow;
using UMC.AdminPortal.Application.Services;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.ApprovalRecall;
using UMC.AdminPortal.Application.Services.Pdf.Photography;
using UMC.AdminPortal.API.Filters;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.Utils.Framework.Page;
using UMC.Utils.Framework.GlobalException;

namespace UMC.AdminPortal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [TypeFilter(typeof(MaterialStatusExceptionFilter))]
    public class ApplicationController(
        IApplicationAppService _applicationApp,
        ICurrentUserService _currentUserService,
        IApprovalRecallApplicationService _approvalRecallApplicationService,
        IPhotographyApplicationPdfService _photographyApplicationPdfService
    ) : ControllerBase
    {
        private static readonly string DepartmentId = ((int)DepartmentEnum.Licensing).ToString();

        [HttpPost("MyTodoPage")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.View)]
        public async Task<MyReviewResponse> GetMyTodoPageAsync([FromBody] MyReviewPageRequest request)
        {
            var userId = _currentUserService.UserId;
            /*var claimsPrincipal = _contextAccessor.HttpContext?.User;
            var userId = claimsPrincipal?.FindFirst("UserID")?.Value;
            var email = claimsPrincipal?.FindFirst("email")?.Value
                        ?? claimsPrincipal?.FindFirst(ClaimTypes.Email)?.Value;*/
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyReviewPageAsync(request, 1, DepartmentId);
        }

        [HttpPost("MyComplatedPage")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyCompleted.View)]
        public async Task<MyReviewResponse> MyComplatedPageAsync([FromBody] MyReviewPageRequest request)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyReviewPageAsync(request, 2, DepartmentId, includeRecallEligibility: true);
        }

        [HttpGet("MyReviewDetail/{taskId}")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Detail)]
        public async Task<MyReviewDetailResponse> GetMyReviewDetailAsync(string taskId)
        {
            return await _applicationApp.GetMyReviewDetailAsync(taskId, DepartmentId);
        }

        // Deprecated: superseded by ApproveV2. Kept here commented for reference; remove once frontend confirms no callers remain.
        // [HttpPost("Approve")]
        // public async Task<bool> ApproveAsync([FromBody] TaskActionDto req)
        // {
        //     return await _applicationApp.ApproveAsync(req, DepartmentId);
        // }

        [HttpPost("ApproveV2")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Approve)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("WorkflowApprove")]
        public async Task<WorkflowActionExecuteResponse> ApproveV2Async([FromBody] TaskActionDto req, CancellationToken cancellationToken = default)
        {
            return await _applicationApp.ApproveV2Async(req, DepartmentId, cancellationToken);
        }

        /// <summary>
        /// Durably starts a Req 147 approval Recall. The idempotency key prevents duplicate
        /// orchestration when the browser retries after a timeout. The saga is normally driven
        /// to completion inside this request, so Status is "Completed" and NewTaskId is populated.
        /// A non-terminal Status means the caller must fall back to polling recall-approval/status.
        /// </summary>
        [HttpPost("{applicationId:int}/recall-approval")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Approve)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("WorkflowApprovalRecall")]
        public async Task<ApprovalRecallStartResponse> RecallApprovalAsync(
            int applicationId,
            [FromBody] ApprovalRecallRequest request,
            [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
            CancellationToken cancellationToken = default)
        {
            if (!Guid.TryParse(idempotencyKey, out var requestId) || requestId == Guid.Empty)
            {
                throw new BusinessException(ApprovalRecallErrorCodes.InvalidIdempotencyKey);
            }

            return await _approvalRecallApplicationService.StartAsync(
                applicationId,
                requestId,
                request,
                cancellationToken);
        }

        /// <summary>
        /// Returns the latest durable Recall orchestration state for polling and diagnostics.
        /// </summary>
        [HttpGet("{applicationId:int}/recall-approval/status")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Approve)]
        public Task<ApprovalRecallStatusResponse> GetRecallApprovalStatusAsync(
            int applicationId,
            CancellationToken cancellationToken = default) =>
            _approvalRecallApplicationService.GetStatusAsync(applicationId, cancellationToken);

        /// <summary>
        /// Evaluates whether the current user may Recall the application's final approval.
        /// </summary>
        [HttpGet("{applicationId:int}/recall-approval/eligibility")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Approve)]
        public Task<ApprovalRecallEligibilityResponse> GetRecallApprovalEligibilityAsync(
            int applicationId,
            CancellationToken cancellationToken = default) =>
            _approvalRecallApplicationService.GetEligibilityAsync(applicationId, cancellationToken);

        [HttpPost("ExportMyTodoReview")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyTodoReviewAsync([FromBody] MyReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyReviewAsync(req, 1, DepartmentId);
            var fileName = $"MyTodoList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpPost("ExportMyCompletedReview")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyCompleted.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyCompletedReviewAsync([FromBody] MyReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyReviewAsync(req, 2, DepartmentId);
            var fileName = $"MyCompletedList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpPost("MyTeamTodoPage")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTeam.View)]
        public async Task<MyTeamReviewResponse> GetMyTeamTodoPageAsync([FromBody] MyTeamReviewPageRequest req)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyTeamReviewPageAsync(req, 1, DepartmentId);
        }

        [HttpPost("MyTeamComplatedPage")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTeam.View)]
        public async Task<MyTeamReviewResponse> GetMyTeamReviewPageAsync([FromBody] MyTeamReviewPageRequest req)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyTeamReviewPageAsync(req, 2, DepartmentId);
        }

        [HttpPost("MyTeamMemberTask")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTeam.Assign)]
        public async Task<List<MyTeamMemberTaskResponse>> GetMyTeamMemberTaskAsync([FromBody] MyTeamMemberTaskRequest req)
        {
            return await _applicationApp.GetMyTeamMemberTaskAsync(req, DepartmentId);
        }

        [HttpPost("ExportMyTeamTodoReview")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTeam.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyTeamTodoReviewAsync([FromBody] MyTeamReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyTeamReviewAsync(req, 1, DepartmentId);
            var fileName = $"MyTeamTodoList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpPost("ExportMyTeamCompletedReview")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTeam.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyTeamCompletedReviewAsync([FromBody] MyTeamReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyTeamReviewAsync(req, 2, DepartmentId);
            var fileName = $"MyTeamCompletedList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpGet("IsLeader")]
        //[RequirePermission(AccountPermissionCodes.Workflow.MyTeam.Assign)]
        public async Task<bool> IsLeaderAsync()
        {
            return await _applicationApp.IsLeaderAsync(DepartmentId);
        }

        [HttpGet("UrgenCount")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTeam.Urgent)]
        public async Task<int> GetUrgenCountAsync()
        {
            return await _applicationApp.GetUrgenCountAsync(DepartmentId);
        }
        [HttpPost("ApplicationPageByProfile")]
        //this api for every adminuser,no need more accuracy permission
        //[RequirePermission(AccountPermissionCodes.Customer.View, AccountPermissionCodes.Profile.View)]
        public async Task<GetApplicationPageByProfileResponse> GetApplicationPageByProfileAsync(GetPageByProfilePageRequest req)
        {
            return await _applicationApp.GetApplicationPageByProfileAsync(req);
        }

        [HttpGet("ApplicantDetailByApplicationId")]
        [RequirePermission(AccountPermissionCodes.Customer.View, AccountPermissionCodes.Profile.View)]
        public async Task<ApplicationApplicantDetailDto> GetApplicationApplicantDetailByApplicationIdAsync([FromQuery] int applicationId)
        {
            return await _applicationApp.GetApplicationApplicantDetailByApplicationIdAsync(applicationId);
        }

        [HttpGet("dashboard/statistics")]
        [RequirePermission(AccountPermissionCodes.Workflow.Dashboard.View)]
        public async Task<ApplicationDashboardStatisticsResponse> GetApplicationDashboardStatisticsAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            return await _applicationApp.GetApplicationDashboardStatisticsAsync(days, startDate, endDate);
        }
        [HttpGet("dashboard/service/list")]
        [RequirePermission(AccountPermissionCodes.Workflow.Dashboard.View)]
        public async Task<PageResponse<ApplicationServiceDashboardListDto>> GetServiceDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? keyword = null,
            [FromQuery] string? option = null,
            [FromQuery] int pageIndex = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? orderby = null,
            [FromQuery] string? sort = "desc")
        {
            return await _applicationApp.GetServiceDashboardListAsync(days, startDate, endDate, keyword, option, pageIndex, pageSize, orderby, sort);
        }

        [HttpGet("dashboard/service/list/export")]
        [RequirePermission(AccountPermissionCodes.Workflow.Dashboard.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportServiceDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? keyword = null,
            [FromQuery] string? option = null,
            [FromQuery] string? orderby = null,
            [FromQuery] string? sort = "desc")
        {
            var buffer = await _applicationApp.ExportServiceDashboardListAsync(days, startDate, endDate, keyword, option, orderby, sort);
            var fileName = $"ServiceDashboardList_{DateTimeHelper.Now:ddMMyyyy_HHmmss}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpGet("dashboard/team/list")]
        [RequirePermission(AccountPermissionCodes.Workflow.Dashboard.View)]
        public async Task<TeamDashboardResponse> GetTeamDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? keyword = null,
            [FromQuery] int pageIndex = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? orderby = null,
            [FromQuery] string? sort = "desc")
        {
            return await _applicationApp.GetTeamDashboardListAsync(days, startDate, endDate, keyword, pageIndex, pageSize, orderby, sort);
        }

        [HttpGet("dashboard/team/list/export")]
        [RequirePermission(AccountPermissionCodes.Workflow.Dashboard.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportTeamDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? keyword = null,
            [FromQuery] string? orderby = null,
            [FromQuery] string? sort = "desc")
        {
            var buffer = await _applicationApp.ExportTeamDashboardListAsync(days, startDate, endDate, keyword, orderby, sort);
            var fileName = $"TeamDashboardList_{DateTimeHelper.Now:ddMMyyyy_HHmmss}.csv";
            return File(buffer, "text/csv", fileName);
        }


        /// <summary>
        /// Exports a service 7 (Ground Photography Permit) paper form as PDF for the external
        /// approving authority. documentType=application-form returns the application sheet;
        /// documentType=team-member returns one filming team member's information form, addressed by
        /// the submitted form member id (memberIndex is a 1-based fallback).
        /// </summary>
        [HttpGet("{applicationId:int}/photography-documents/download")]
        [RequirePermission(AccountPermissionCodes.Workflow.MyTodo.Detail)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Application.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> DownloadPhotographyDocumentAsync(
            int applicationId,
            [FromQuery] string documentType,
            [FromQuery] string? memberId = null,
            [FromQuery] int? memberIndex = null,
            CancellationToken cancellationToken = default)
        {
            var document = await _photographyApplicationPdfService.GeneratePdfAsync(
                applicationId, documentType, memberId, memberIndex, cancellationToken);

            return File(document.Content, document.ContentType, document.FileName);
        }

    }
}

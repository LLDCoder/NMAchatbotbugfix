using Microsoft.AspNetCore.Mvc;
using System;
using Microsoft.AspNetCore.Authorization;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.Dtos.Application;
using UMC.AdminPortal.Application.Dtos.Workflow;
using UMC.AdminPortal.Application.Services;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.API.Filters;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [TypeFilter(typeof(MaterialStatusExceptionFilter))]
    public class ContentController(
        IApplicationAppService _applicationApp
    ) : ControllerBase
    {
        private static readonly string DepartmentId = ((int)DepartmentEnum.Content).ToString();

        [HttpPost("MyTodoPage")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.View)]
        public async Task<MyReviewResponse> GetMyTodoPageAsync([FromBody] MyReviewPageRequest request)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyReviewPageAsync(request, 1, DepartmentId);
        }

        [HttpPost("MyComplatedPage")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.View)]
        public async Task<MyReviewResponse> MyComplatedPageAsync([FromBody] MyReviewPageRequest request)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyReviewPageAsync(request, 2, DepartmentId);
        }

        [HttpGet("MyReviewDetail/{taskId}")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.Detail)]
        public async Task<MyReviewDetailResponse> GetMyReviewDetailAsync(string taskId)
        {
            return await _applicationApp.GetMyReviewDetailAsync(taskId, DepartmentId);
        }

        [HttpPut("ApplicationMaterials/{materialId}/Status")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.Approve)]
        public async Task<UpdateApplicationMaterialStatusResponse> UpdateApplicationMaterialStatusAsync(
            string materialId,
            [FromBody] UpdateApplicationMaterialStatusRequest request,
            CancellationToken cancellationToken = default)
        {
            return await _applicationApp.UpdateApplicationMaterialStatusAsync(request, materialId, cancellationToken);
        }

        // Deprecated: superseded by ApproveV2. Kept here commented for reference; remove once frontend confirms no callers remain.
        // [HttpPost("Approve")]
        // public async Task<bool> ApproveAsync([FromBody] TaskActionDto req)
        // {
        //     return await _applicationApp.ApproveAsync(req, DepartmentId);
        // }

        [HttpPost("ApproveV2")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.Approve)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("ContentWorkflowApprove")]
        public async Task<WorkflowActionExecuteResponse> ApproveV2Async([FromBody] TaskActionDto req, CancellationToken cancellationToken = default)
        {
            return await _applicationApp.ApproveV2Async(req, DepartmentId, cancellationToken);
        }

        [HttpPost("ExportMyTodoReview")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Content.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyTodoReviewAsync([FromBody] MyReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyReviewAsync(req, 1, DepartmentId);
            var fileName = $"MyTodoList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpPost("ExportMyCompletedReview")]
        [RequirePermission(AccountPermissionCodes.Content.MyReview.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Content.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyCompletedReviewAsync([FromBody] MyReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyReviewAsync(req, 2, DepartmentId);
            var fileName = $"MyCompletedList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpPost("MyTeamTodoPage")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.View)]
        public async Task<MyTeamReviewResponse> GetMyTeamTodoPageAsync([FromBody] MyTeamReviewPageRequest req)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyTeamReviewPageAsync(req, 1, DepartmentId);
        }

        [HttpPost("MyTeamComplatedPage")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.View)]
        public async Task<MyTeamReviewResponse> GetMyTeamReviewPageAsync([FromBody] MyTeamReviewPageRequest req)
        {
            // Language mapping is already handled in ApplicationAppService
            return await _applicationApp.GetMyTeamReviewPageAsync(req, 2, DepartmentId);
        }

        [HttpPost("MyTeamMemberTask")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.View)]
        public async Task<List<MyTeamMemberTaskResponse>> GetMyTeamMemberTaskAsync([FromBody] MyTeamMemberTaskRequest req)
        {
            return await _applicationApp.GetMyTeamMemberTaskAsync(req, DepartmentId);
        }

        [HttpPost("ExportMyTeamTodoReview")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Content.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyTeamTodoReviewAsync([FromBody] MyTeamReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyTeamReviewAsync(req, 1, DepartmentId);
            var fileName = $"MyTeamTodoList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpPost("ExportMyTeamCompletedReview")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Content.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportMyTeamCompletedReviewAsync([FromBody] MyTeamReviewPageRequest req)
        {
            var buffer = await _applicationApp.ExportMyTeamReviewAsync(req, 2, DepartmentId);
            var fileName = $"MyTeamCompletedList-{DateTimeHelper.Now.ToString("ddMMyyyyHHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpGet("IsLeader")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.View)]
        public async Task<bool> IsLeaderAsync()
        {
            return await _applicationApp.IsLeaderAsync(DepartmentId);
        }

        [HttpGet("UrgenCount")]
        [RequirePermission(AccountPermissionCodes.Content.TeamReview.Urgent)]
        public async Task<int> GetUrgenCountAsync()
        {
            return await _applicationApp.GetUrgenCountAsync(DepartmentId);
        }
        
        [HttpGet("dashboard/statistics")]
        [RequirePermission(AccountPermissionCodes.Content.Dashboard.View)]
        public async Task<ContentDashboardStatisticsResponse> GetContentDashboardStatisticsAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            return await _applicationApp.GetContentDashboardStatisticsAsync(days, startDate, endDate);
        }

        [HttpGet("dashboard/service/list")]
        [RequirePermission(AccountPermissionCodes.Content.Dashboard.View)]
        public async Task<PageResponse<ContentServiceDashboardListDto>> GetServiceDashboardListAsync(
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
            return await _applicationApp.GetContentServiceDashboardListAsync(days, startDate, endDate, keyword, option, pageIndex, pageSize, orderby, sort);
        }

        [HttpGet("dashboard/service/list/export")]
        [RequirePermission(AccountPermissionCodes.Content.Dashboard.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Content.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportServiceDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? keyword = null,
            [FromQuery] string? option = null,
            [FromQuery] string? orderby = null,
            [FromQuery] string? sort = "desc")
        {
            var buffer = await _applicationApp.ExportContentServiceDashboardListAsync(days, startDate, endDate, keyword, option, orderby, sort);
            var fileName = $"ContentServiceDashboardList_{DateTimeHelper.Now:ddMMyyyy_HHmmss}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpGet("dashboard/team/list")]
        [RequirePermission(AccountPermissionCodes.Content.Dashboard.View)]
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
            return await _applicationApp.GetContentTeamDashboardListAsync(days, startDate, endDate, keyword, pageIndex, pageSize, orderby, sort);
        }

        [HttpGet("dashboard/team/list/export")]
        [RequirePermission(AccountPermissionCodes.Content.Dashboard.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Content.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportTeamDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? keyword = null,
            [FromQuery] string? orderby = null,
            [FromQuery] string? sort = "desc")
        {
            var buffer = await _applicationApp.ExportContentTeamDashboardListAsync(days, startDate, endDate, keyword, orderby, sort);
            var fileName = $"ContentTeamDashboardList_{DateTimeHelper.Now:ddMMyyyy_HHmmss}.csv";
            return File(buffer, "text/csv", fileName);
        }

    }
}

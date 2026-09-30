using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.Dtos.Inspection;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.InspectionViolations;
using UMC.AdminPortal.Domain.Shares;

namespace UMC.AdminPortal.API.Controllers
{
    [Route("api/admin/inspection/violations")]
    [ApiController]
    [Authorize]
    public class InspectionViolationController : ControllerBase
    {
        private readonly IInspectionViolationAppService _inspectionViolationAppService;

        public InspectionViolationController(IInspectionViolationAppService inspectionViolationAppService)
        {
            _inspectionViolationAppService = inspectionViolationAppService;
        }

        [HttpGet]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.View)]
        public async Task<ActionResult<InspectionViolationListResponseDto>> GetListAsync([FromQuery] InspectionViolationListRequestDto request)
        {
            var result = await _inspectionViolationAppService.GetListAsync(request);
            return Ok(result);
        }

        [HttpGet("customer")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.View)]
        public async Task<ActionResult<IReadOnlyList<InspectionCustomerViolationListItemDto>>> GetCustomerViolationsAsync([FromQuery] InspectionCustomerViolationListRequestDto request)
        {
            var result = await _inspectionViolationAppService.GetCustomerViolationsAsync(request);
            return Ok(result);
        }

        [HttpGet("by-target")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.View)]
        public async Task<ActionResult<InspectionUserViolationListResponseDto>> GetUserViolationsAsync([FromQuery] InspectionUserViolationListRequestDto request)
        {
            var result = await _inspectionViolationAppService.GetUserViolationsAsync(request);
            return Ok(result);
        }

        [HttpGet("stats")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.View)]
        public async Task<ActionResult<InspectionViolationStatsResponseDto>> GetStatsAsync([FromQuery] InspectionViolationListRequestDto request)
        {
            var result = await _inspectionViolationAppService.GetStatsAsync(request);
            return Ok(result);
        }

        [HttpGet("{id:int}")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Detail,AccountPermissionCodes.Inspection.Appeal.Detail)]
        public async Task<ActionResult<InspectionViolationDetailDto>> GetDetailAsync(int id)
        {
            var result = await _inspectionViolationAppService.GetDetailAsync(id);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("by-violation-no/{violationNo}/penalty-order")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Detail)]
        public async Task<ActionResult<InspectionViolationPenaltyOrderDetailDto>> GetPenaltyOrderDetailByViolationNoAsync(string violationNo)
        {
            var result = await _inspectionViolationAppService.GetPenaltyOrderDetailByViolationNoAsync(violationNo);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id:int}/penalty-standard")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Detail)]
        public async Task<ActionResult<InspectionViolationPenaltyStandardDto>> GetPenaltyStandardAsync(int id)
        {
            var result = await _inspectionViolationAppService.GetPenaltyStandardAsync(id);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id:int}/timeline")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Detail)]
        public async Task<ActionResult<List<InspectionViolationTimelineItemDto>>> GetTimelineAsync(int id)
        {
            var result = await _inspectionViolationAppService.GetTimelineAsync(id);
            return Ok(result);
        }

        [HttpGet("{id:int}/target-overview")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Detail)]
        public async Task<ActionResult<InspectionTaskTargetOverviewLimitedDto>> GetTargetOverviewAsync(int id)
        {
            var result = await _inspectionViolationAppService.GetTargetOverviewAsync(id);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpPost("{id:int}/route")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Route)]
        public async Task<ActionResult<object>> RouteAsync(int id, [FromBody] RouteInspectionViolationRequestDto request)
        {
            await _inspectionViolationAppService.RouteAsync(id, request);
            return Ok(new { routed = true });
        }

        [HttpPost("{id:int}/content-report")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Content)]
        public async Task<ActionResult<object>> SubmitContentReportAsync(int id, [FromBody] SubmitInspectionContentReportRequestDto request)
        {
            await _inspectionViolationAppService.SubmitContentReportAsync(id, request);
            return Ok(new { submitted = true });
        }
        

        [HttpPost("{id:int}/decide")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Decide)]
        public async Task<ActionResult<object>> DecideAsync(int id, [FromBody] DecideInspectionViolationRequestDto request)
        {
            await _inspectionViolationAppService.DecideAsync(id, request);
            return Ok(new { decided = true });
        }

        [HttpPost("{id:int}/approval")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Approval)]
        public async Task<ActionResult<object>> ApprovalAsync(int id)
        {
            await _inspectionViolationAppService.ApprovalAsync(id);
            return Ok(new { approved = true });
        }

        [HttpGet("export")]
        [RequirePermission(AccountPermissionCodes.Inspection.Violation.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionViolation.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportAsync([FromQuery] InspectionViolationListRequestDto request)
        {
            var content = await _inspectionViolationAppService.ExportAsync(request);
            return File(content, "text/csv; charset=utf-8", $"inspection-violations-export-{DateTimeHelper.Now:yyyyMMddHHmmss}.csv");
        }
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.BackgroundJobs;
using UMC.AdminPortal.Application.Dtos.Inspection;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.InspectionTasks;
using UMC.AdminPortal.Application.Services.InspectionTasks.Pdf;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Shares;

namespace UMC.AdminPortal.API.Controllers
{
    /// <summary>Request body for the update-declaration-template-html endpoint.</summary>
    public sealed class UpdateDeclarationTemplateHtmlRequestDto
    {
        /// <summary>Relative path to an HTML file under the configured declaration template root.</summary>
        public string RelativePath { get; set; } = string.Empty;
    }
    [Route("api/admin/inspection/tasks")]
    [ApiController]
    //[AllowAnonymous]
    [Authorize]
    public class InspectionTaskController : ControllerBase
    {
        private readonly IInspectionTaskAppService _inspectionTaskAppService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IDeclarationDocumentPdfService _declarationDocumentPdfService;
        private readonly InspectionDailyAutoTaskBackgroundJob _dailyAutoTaskJob;
        private readonly InspectionTaskAutoAssignBackgroundJob _autoAssignJob;

        public InspectionTaskController(
            IInspectionTaskAppService inspectionTaskAppService,
            ICurrentUserService currentUserService,
            IDeclarationDocumentPdfService declarationDocumentPdfService,
            InspectionDailyAutoTaskBackgroundJob dailyAutoTaskJob,
            InspectionTaskAutoAssignBackgroundJob autoAssignJob)
        {
            _inspectionTaskAppService = inspectionTaskAppService;
            _currentUserService = currentUserService;
            _declarationDocumentPdfService = declarationDocumentPdfService;
            _dailyAutoTaskJob = dailyAutoTaskJob;
            _autoAssignJob = autoAssignJob;
        }

        /// <summary>
        /// Immediately triggers the daily auto-schedule background job once.
        /// Creates up to 10 AI-generated scheduled tasks (and their risk profiles) for due dates that do not already have a task.
        /// </summary>
        [HttpPost("auto-schedule/trigger")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Create)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionAutoScheduleTrigger")]
        public async Task<ActionResult<object>> TriggerAutoScheduleAsync(CancellationToken cancellationToken)
        {
            var taskIds = await _dailyAutoTaskJob.ExecuteOnceAsync(cancellationToken);
            if (taskIds.Count == 0)
            {
                return Ok(new { created = false, count = 0, message = "All scheduled tasks for the planned due dates already exist." });
            }
            return Ok(new { created = true, count = taskIds.Count, taskIds });
        }

        /// <summary>
        /// Immediately triggers the auto-assign background job once. Assigns an inspector to each
        /// Queued (StatusId=0) inspection task following the role / area / load-balancing rules, and
        /// returns the taskId → inspectorId map for the tasks it assigned this run.
        /// </summary>
        [HttpPost("auto-assign/trigger")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Create)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionAutoAssignTrigger")]
        public async Task<ActionResult<object>> TriggerAutoAssignAsync(CancellationToken cancellationToken)
        {
            var assignments = await _autoAssignJob.AutoAssignOnceAsync(cancellationToken);
            return Ok(new { assigned = assignments.Count > 0, count = assignments.Count, assignments });
        }
        
        [HttpPost]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Create)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskCreate")]
        public async Task<ActionResult<int>> CreateAsync([FromBody] CreateInspectionTaskRequestDto request)
        {
            var result = await _inspectionTaskAppService.CreateAsync(request);
            return Ok(result);
        }

        [HttpPost("batch-by-activity")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Create)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskBatchCreate")]
        public async Task<ActionResult<BatchCreateInspectionTaskResponseDto>> CreateBatchByActivityAsync([FromBody] BatchCreateInspectionTaskByActivityRequestDto request)
        {
            var result = await _inspectionTaskAppService.CreateBatchByActivityAsync(request);
            return Ok(result);
        }


        [HttpGet]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.View)]
        public async Task<ActionResult<InspectionTaskListResponseDto>> GetListAsync([FromQuery] InspectionTaskListRequestDto request)
        {
            /*var accessResult = RequireTaskManagementListAccess();
            if (accessResult != null)
            {
                return accessResult;
            }*/

            var result = await _inspectionTaskAppService.GetListAsync(request);
            return Ok(result);
        }

        [HttpGet("by-target")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.View)]
        public async Task<ActionResult<InspectionTaskByTargetResponseDto>> GetByTargetAsync([FromQuery] InspectionTaskByTargetRequestDto request)
        {
            var result = await _inspectionTaskAppService.GetByTargetAsync(request);
            return Ok(result);
        }

        [HttpGet("created-by-users")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Create)]
        public async Task<ActionResult<IReadOnlyList<InspectionLookupStringValueDto>>> GetCreatedByUsersAsync([FromQuery] InspectionTaskListRequestDto request)
        {
            /*var accessResult = RequireTaskManagementListAccess();
            if (accessResult != null)
            {
                return accessResult;
            }*/

            var result = await _inspectionTaskAppService.GetCreatedByOptionsAsync(request);
            return Ok(result);
        }

        [HttpGet("stats")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.View)]
        public async Task<ActionResult<InspectionTaskListStatsDto>> GetStatsAsync([FromQuery] InspectionTaskListRequestDto request)
        {
            /*var accessResult = RequireTaskManagementListAccess();
            if (accessResult != null)
            {
                return accessResult;
            }*/

            var result = await _inspectionTaskAppService.GetStatsAsync(request);
            return Ok(result);
        }

        [HttpGet("{id}")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Detail)]
        public async Task<ActionResult<InspectionTaskDetailDto>> GetDetailAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetDetailAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id}/last-inspection")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Detail)]
        public async Task<ActionResult<InspectionTaskLastInspectionDto?>> GetLastInspectionAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetLastInspectionAsync(taskId.Value);
            return Ok(result);
        }

        [HttpGet("{id}/reinspection-task")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Detail)]
        public async Task<ActionResult<InspectionTaskReinspectionLookupDto?>> GetReinspectionTaskAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetReinspectionTaskAsync(taskId.Value);
            return Ok(result);
        }

        [HttpGet("{id}/target-overview")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Detail)]
        public async Task<ActionResult<InspectionTaskTargetOverviewLimitedDto>> GetTargetOverviewAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetTargetOverviewAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id}/digital-presence")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        public async Task<ActionResult<InspectionTaskDigitalPresenceDto>> GetDigitalPresenceAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetDigitalPresenceAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id}/report")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        public async Task<ActionResult<InspectionTaskReportDto>> GetReportAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetReportAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id}/execution-result")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        public async Task<ActionResult<InspectionTaskExecutionResultDto>> GetExecutionResultAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetExecutionResultAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id}/checklist-template")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        public async Task<ActionResult<InspectionChecklistTemplateResponseDto>> GetChecklistTemplateAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetChecklistTemplateAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        [HttpGet("{id}/review")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        public async Task<ActionResult<InspectionTaskReviewDto>> GetReviewAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetReviewAsync(taskId.Value);
            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }


        [HttpPost("validate")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        public async Task<ActionResult<InspectionTaskValidationResponseDto>> ValidateAsync([FromBody] CreateInspectionTaskRequestDto request)
        {
            var result = await _inspectionTaskAppService.ValidateAsync(request);
            return Ok(result);
        }

        [HttpPost("{id}/edit")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Create)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskUpdate")]
        public async Task<ActionResult<object>> EditAsync(string id, [FromBody] EditInspectionTaskRequestDto request)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            await _inspectionTaskAppService.EditAsync(taskId.Value, request);
            return Ok(new { updated = true });
        }

        [HttpPost("{id}/cancel")]
        [RequirePermission(AccountPermissionCodes.Inspection.Execution.TaskExecution)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskCancel")]
        public async Task<ActionResult<object>> CancelAsync(string id, [FromBody] CancelInspectionTaskRequestDto request)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            await _inspectionTaskAppService.CancelAsync(taskId.Value, request);
            return Ok(new { cancelled = true });
        }

        [HttpPost("{id}/duplicate")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Duplicate)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskDuplicate")]
        public async Task<ActionResult<int>> DuplicateAsync(string id, [FromBody] DuplicateInspectionTaskRequestDto request)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.DuplicateAsync(taskId.Value, request);
            return Ok(result);
        }

        [HttpPost("{id}/assign")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Assign)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskAssign")]
        public async Task<ActionResult<object>> AssignAsync(string id, [FromBody] AssignInspectionTaskRequestDto request)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            await _inspectionTaskAppService.AssignAsync(taskId.Value, request);
            return Ok(new { assigned = true });
        }

        [HttpPost("batch-assign")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Assign)]
        [UMC.Utils.Framework.Logging.Client.LogUserActivity]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTaskBatchAssign")]
        public async Task<ActionResult<object>> BatchAssignAsync([FromBody] BatchAssignInspectionTaskRequestDto request)
        {
            await _inspectionTaskAppService.BatchAssignAsync(request);
            return Ok(new { assigned = true });
        }

        [HttpGet("{id}/timeline")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Detail)]
        public async Task<ActionResult<List<InspectionTaskTimelineItemDto>>> GetTimelineAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetTimelineAsync(taskId.Value);
            return Ok(result);
        }

        /// <summary>
        /// Reads an HTML file under the configured declaration template root and writes its content
        /// into the <c>ContentHtml</c> column of the specified <c>SerivceCertificateTemplates</c> record.
        /// <para>
        /// Example: POST …/declaration-template/27/html-from-file
        ///          Body: { "relativePath": "imports/declaration-acknowledgement.html" }
        /// </para>
        /// </summary>
       // [HttpPost("declaration-template/{templateId:int}/html-from-file")]
        //[RequirePermission(AccountPermissionCodes.Inspection.Task.ManageDeclarationTemplates)]
        public async Task<ActionResult<object>> UpdateDeclarationTemplateHtmlAsync(
            int templateId,
            [FromBody] UpdateDeclarationTemplateHtmlRequestDto request,
            CancellationToken cancellationToken)
        {
            var result = await _declarationDocumentPdfService.UpdateTemplateHtmlFromFileAsync(
                templateId, request.RelativePath, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// Reverse of <c>html-from-file</c>: reads the <c>ContentHtml</c> column of the specified
        /// <c>SerivceCertificateTemplates</c> record and writes it to a new safely named file under
        /// the configured declaration template root.
        /// <para>
        /// Example: POST …/declaration-template/54/file-from-html
        /// </para>
        /// </summary>
        //[HttpPost("declaration-template/{templateId:int}/file-from-html")]
        //[RequirePermission(AccountPermissionCodes.Inspection.Task.ManageDeclarationTemplates)]
        public async Task<ActionResult<object>> ExportDeclarationTemplateHtmlAsync(
            int templateId,
            CancellationToken cancellationToken)
        {
            var result = await _declarationDocumentPdfService.ExportTemplateHtmlToFileAsync(
                templateId, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// Returns unified person information related to the given inspection task.
        /// <para>
        /// - If the task targets an individual: returns the Person linked via UserProfiles.PersonId.<br/>
        /// - If the task targets an establishment whose UserTypeId is in (2, 22, 20, 27):
        ///   returns the union of EstablishmentPartners persons and UserProfiles persons, deduplicated.<br/>
        /// - Otherwise: returns the InspectionTaskContactPersons recorded on the task.
        /// </para>
        /// </summary>
        [HttpGet("{id}/persons")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Detail)]
        public async Task<ActionResult<IReadOnlyList<InspectionTaskPersonInfoDto>>> GetPersonsAsync(string id)
        {
            var taskId = await _inspectionTaskAppService.ResolveTaskIdAsync(id);
            if (!taskId.HasValue) return NotFound();

            var result = await _inspectionTaskAppService.GetPersonsAsync(taskId.Value);
            return Ok(result);
        }


        [HttpGet("export")]
        [RequirePermission(AccountPermissionCodes.Inspection.Task.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("InspectionTask.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportAsync([FromQuery] InspectionTaskListRequestDto request)
        {
        {
            /*var accessResult = RequireTaskManagementListAccess();
            if (accessResult != null)
            {
                return accessResult;
            }*/

            var content = await _inspectionTaskAppService.ExportAsync(request);
            var scopeSuffix = string.IsNullOrWhiteSpace(request.Scope)
                ? "all"
                : request.Scope.Trim().ToLowerInvariant();
            return File(content, "text/csv; charset=utf-8", $"inspection-tasks-export-{scopeSuffix}-{DateTimeHelper.Now:yyyyMMddHHmmss}.csv");
        }
}

        /*private ActionResult? RequireTaskManagementListAccess()
        {
            if (!_currentUserService.IsAuthenticated)
            {
                return Unauthorized();
            }

            return _currentUserService.IsInRole("Admin")
                   || _currentUserService.IsInRole("Manager")
                   || _currentUserService.IsInRole("Inspector")
                ? null
                : Forbid();
        }*/
    }
}

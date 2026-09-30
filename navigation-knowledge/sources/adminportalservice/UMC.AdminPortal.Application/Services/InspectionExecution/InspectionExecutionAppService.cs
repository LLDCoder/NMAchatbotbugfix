using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NanoidDotNet;
using UMC.AdminPortal.Application.Dtos.Inspection;
using UMC.AdminPortal.Application.Services.Inspection;
using UMC.AdminPortal.Application.Services.InspectionAI;
using UMC.AdminPortal.Application.Services.InspectionDeclaration;
using UMC.AdminPortal.Application.Services.InspectionSignature;
using UMC.AdminPortal.Application.Services.InspectionTasks.Notification;
using UMC.AdminPortal.Application.Services.InspectionTasks.Pdf;
using UMC.AdminPortal.Application.Services.InspectionViolations.Notification;
using UMC.AdminPortal.Application.Services.InspectionViolations.Pdf;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Service.Inspection;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Infrastructure;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Logging.Client;
using UMC.Utils.Framework.Module.Attributes;

namespace UMC.AdminPortal.Application.Services.InspectionExecution;

[InjectOnScoped]
public class InspectionExecutionAppService : IInspectionExecutionAppService
{
    private readonly AdminPortalDBContext _dbContext;
    private readonly IInspectionTaskRepository _taskRepository;
    private readonly IBaseRepository<InspectionTaskExecution> _executionRepository;
    private readonly IBaseRepository<InspectionTaskChecklistItem> _checklistItemRepository;
    private readonly IBaseRepository<InspectionTaskChecklistViolation> _checklistViolationRepository;
    private readonly IBaseRepository<InspectionSeizedMaterial> _seizedMaterialRepository;
    private readonly IBaseRepository<InspectionTaskContactPerson> _contactPersonRepository;
    private readonly IBaseRepository<InspectionTaskAttachment> _taskAttachmentRepository;
    private readonly IBaseRepository<InspectionTaskTimelineEvent> _timelineRepository;
    private readonly IInspectionViolationDomainService _inspectionViolationDomainService;
    private readonly IInspectionViolationCatalogRepository _violationCatalogRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly IDeclarationDocumentPdfService _declarationDocumentPdfService;
    private readonly IAccessFailedReportPdfService _accessFailedReportPdfService;
    private readonly IViolationReportPdfService _violationReportPdfService;
    private readonly IViolationApprovalReportPdfService _violationApprovalReportPdfService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InspectionExecutionAppService> _logger;
    private readonly IPermissionService _permissionService;
    private readonly IInspectionAiAppService? _inspectionAiAppService;
    private readonly IAuditLogger? _auditLogger;
    private readonly IInspectionViolationStaffNotificationService? _violationStaffNotificationService;
    private readonly IDeclarationLinkNotificationService? _declarationLinkNotificationService;
    private readonly IInspectionTaskNotificationService? _taskNotificationService;
    private readonly IInspectionTaskSignatureLinkProvisionService? _signatureLinkProvisionService;
    private readonly IServiceScopeFactory _scopeFactory;

    public InspectionExecutionAppService(
        AdminPortalDBContext dbContext,
        IInspectionTaskRepository taskRepository,
        IBaseRepository<InspectionTaskExecution> executionRepository,
        IBaseRepository<InspectionTaskChecklistItem> checklistItemRepository,
        IBaseRepository<InspectionTaskChecklistViolation> checklistViolationRepository,
        IBaseRepository<InspectionSeizedMaterial> seizedMaterialRepository,
        IBaseRepository<InspectionTaskContactPerson> contactPersonRepository,
        IBaseRepository<InspectionTaskAttachment> taskAttachmentRepository,
        IBaseRepository<InspectionTaskTimelineEvent> timelineRepository,
        IInspectionViolationDomainService inspectionViolationDomainService,
        IInspectionViolationCatalogRepository violationCatalogRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IDeclarationDocumentPdfService declarationDocumentPdfService,
        IAccessFailedReportPdfService accessFailedReportPdfService,
        IViolationReportPdfService violationReportPdfService,
        IViolationApprovalReportPdfService violationApprovalReportPdfService,
        IConfiguration configuration,
        ILogger<InspectionExecutionAppService> logger,
        IPermissionService permissionService,
        IInspectionAiAppService? inspectionAiAppService = null,
        IAuditLogger? auditLogger = null,
        IInspectionViolationStaffNotificationService? violationStaffNotificationService = null,
        IDeclarationLinkNotificationService? declarationLinkNotificationService = null,
        IInspectionTaskNotificationService? taskNotificationService = null,
        IInspectionTaskSignatureLinkProvisionService? signatureLinkProvisionService = null,
        IServiceScopeFactory scopeFactory = null!)
    {
        _dbContext = dbContext;
        _taskRepository = taskRepository;
        _executionRepository = executionRepository;
        _checklistItemRepository = checklistItemRepository;
        _checklistViolationRepository = checklistViolationRepository;
        _seizedMaterialRepository = seizedMaterialRepository;
        _contactPersonRepository = contactPersonRepository;
        _taskAttachmentRepository = taskAttachmentRepository;
        _timelineRepository = timelineRepository;
        _inspectionViolationDomainService = inspectionViolationDomainService;
        _violationCatalogRepository = violationCatalogRepository;
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _declarationDocumentPdfService = declarationDocumentPdfService;
        _accessFailedReportPdfService = accessFailedReportPdfService;
        _violationReportPdfService = violationReportPdfService;
        _violationApprovalReportPdfService = violationApprovalReportPdfService;
        _configuration = configuration;
        _logger = logger;
        _permissionService = permissionService;
        _inspectionAiAppService = inspectionAiAppService;
        _auditLogger = auditLogger;
        _violationStaffNotificationService = violationStaffNotificationService;
        _declarationLinkNotificationService = declarationLinkNotificationService;
        _taskNotificationService = taskNotificationService;
        _signatureLinkProvisionService = signatureLinkProvisionService;
    }

    public async Task<InspectionExecutionSummaryDto> StartVisitAsync(int taskId, StartInspectionVisitRequestDto request)
    {
        var (task, execution) = await RequireTaskForExecutionAsync(taskId).ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: true, expectedMinStep: null);
        var reopeningAccessFailedTask = task.StatusId == (int)InspectionTaskStatus.AccessFailed;
        var fromStatusId = task.StatusId;

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.ReviewTaskDetailConfirmed = request.ReviewTaskDetailConfirmed;
        execution.ReviewInspectionTargetDetailsConfirmed = request.ReviewInspectionTargetDetailsConfirmed;
        execution.EnsureToolsReadyConfirmed = request.EnsureToolsReadyConfirmed;
        if (reopeningAccessFailedTask)
        {
            execution.AccessOutcomeCode = null;
            execution.AccessFailedReasonCode = null;
            execution.AccessFailedRemark = null;
            task.StatusId = (int)InspectionTaskStatus.PendingVisit;
            TouchTask(task);
            RemoveAttachments(task, InspectionTaskAttachmentCategory.AccessFailedEvidence, InspectionTaskAttachmentRelatedEntityType.TaskExecution);
        }

        task.StatusId = (int)InspectionTaskStatus.InProgress;
        TouchTask(task);

        execution.CurrentStepId = (int)InspectionExecutionStep.PreVisitChecklist;
        TouchExecution(execution);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "InspectionStarted", content: $"Inspection started for task {task.TaskNo} by {GetOperatorName()}.", fromStatusId: fromStatusId, toStatusId: task.StatusId, task: task).ConfigureAwait(false);
        return MapSummary(task, execution);
    }

    public async Task<InspectionExecutionSummaryDto> CheckinAsync(int taskId, InspectionTaskCheckinRequestDto request)
    {
        var (task, execution) = await RequireTaskForExecutionAsync(taskId).ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.PreVisitChecklist);
        var now = DateTimeHelper.Now;
        var fromStatusId = task.StatusId;

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.CheckinAt = now;
        execution.CheckinLat = request.CheckInLat;
        execution.CheckinLng = request.CheckInLng;
        execution.CheckinAddress = request.CheckInAddress;
        execution.CurrentStepId = (int)InspectionExecutionStep.Checkin;
        TouchExecution(execution);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "InspectionCheckIn", content: "Check-in completed.", fromStatusId: fromStatusId, toStatusId: task.StatusId, locationText: ResolveLocationText(request.CheckInAddress, request.CheckInLat, request.CheckInLng), task: task).ConfigureAwait(false);
        return MapSummary(task, execution);
    }

    public async Task<InspectionExecutionSummaryDto> MarkAccessFailedAsync(int taskId, InspectionTaskAccessFailedRequestDto request)
    {
        var (task, execution) = await RequireTaskForExecutionAsync(taskId).ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: true, expectedMinStep: (int)InspectionExecutionStep.PreVisitChecklist);
        ValidateAccessFailedRequest(request);
        var fromStatusId = task.StatusId;

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.AccessOutcomeCode = string.IsNullOrWhiteSpace(request.AccessOutcomeCode) ? "UnableToAccess" : request.AccessOutcomeCode.Trim();
        execution.AccessFailedReasonCode = request.AccessFailedReasonCode.Trim();
        execution.AccessFailedRemark = request.AccessFailedRemark?.Trim();
        execution.CurrentStepId = (int)InspectionExecutionStep.AccessFailed;
        TouchExecution(execution);

        task.StatusId = (int)InspectionTaskStatus.AccessFailed;
        task.CountsTowardInspectionInterval = false;
        TouchTask(task);

        await ReplaceAttachmentsByCategoryAsync(
            task,
            request.Attachments,
            InspectionTaskAttachmentCategory.AccessFailedEvidence,
            InspectionTaskAttachmentRelatedEntityType.TaskExecution,
            relatedEntityId: execution.Id).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        // Resolve the access-failed reason display name from TypeDictionary for the timeline Content.
        string? accessFailedReasonDisplayName = null;
        if (!string.IsNullOrWhiteSpace(execution.AccessFailedReasonCode))
        {
            accessFailedReasonDisplayName = await _dbContext.TypeDictionaries
                .AsNoTracking()
                .Where(x => x.Scope == "InspectionFieldAccessFailedReason"
                             && x.Code == execution.AccessFailedReasonCode)
                .Select(x => x.NameEn)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
        }

        await WriteTaskTimelineAsync(
            task.Id,
            "InspectionAccessFailed",
            content: accessFailedReasonDisplayName ?? BuildAccessFailedTimelineContent(execution),
            fromStatusId: fromStatusId,
            toStatusId: task.StatusId,
            reasonCode: execution.AccessFailedReasonCode,
            reasonText: execution.AccessFailedRemark,
            resultCode: NormalizeOptional(execution.AccessOutcomeCode),
            task: task).ConfigureAwait(false);

        // Generate and persist the unable-to-access report PDF (non-fatal – failure is logged but won't
        // roll back the access-failed status that was already saved above).
        try
        {
            await _accessFailedReportPdfService
                .GenerateAndSaveAsync(task, execution)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unexpected error generating unable-to-access report PDF. taskId={TaskId}. The access-failed status was already saved.",
                task.Id);
        }

        return MapSummary(task, execution);
    }

    public async Task<IReadOnlyList<InspectionChecklistTemplateCatalogItemDto>> GetChecklistTemplateItemsAsync(int taskId)
    {
        if (_inspectionAiAppService == null)
        {
            return Array.Empty<InspectionChecklistTemplateCatalogItemDto>();
        }

        var task = await _dbContext.InspectionTasks
        .AsNoTracking()
        .Where(x => x.Id == taskId)
        .Select(x => new { x.TargetTypeId, x.EstablishmentId, x.IndividualId })
        .FirstOrDefaultAsync()
        .ConfigureAwait(false);

        if (task == null)
        {
        return Array.Empty<InspectionChecklistTemplateCatalogItemDto>();
        }

        var isIndividual = task.TargetTypeId == (int)InspectionTargetType.Individual;
        var targetId = isIndividual ? task.IndividualId : task.EstablishmentId;

        if (!targetId.HasValue || targetId.Value <= 0)
        {
        return Array.Empty<InspectionChecklistTemplateCatalogItemDto>();
        }

        var smartChecklist = await _inspectionAiAppService
        .GetSmartChecklistAsync(new InspectionAiSmartChecklistRequestDto
        {
            TargetType = isIndividual ? "INDIVIDUAL" : "ESTABLISHMENT",
            EstablishmentId = isIndividual ? null : targetId.Value,
            IndividualId = isIndividual ? targetId.Value : null,
            ExecutionId = null
        })
        .ConfigureAwait(false);

        if (smartChecklist.Code < 200 || smartChecklist.Code >= 300 || smartChecklist.Data == null)
        {
        return Array.Empty<InspectionChecklistTemplateCatalogItemDto>();
        }

        await PersistSmartChecklistItemLogsAsync(taskId, targetId.Value, smartChecklist).ConfigureAwait(false);

        var checklistCodes = smartChecklist.Data.ChecklistCategories
            .SelectMany(x => x.CheckItems)
            .Select(x => x.ItemId?.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .GroupBy(x => x![0].ToString().ToUpperInvariant())
            .Where(group => group.Key is "L" or "C")
            .SelectMany(group => group.AsEnumerable())
            .ToList();

        if (checklistCodes.Count == 0)
        {
            return Array.Empty<InspectionChecklistTemplateCatalogItemDto>();
        }

        var templateItems = await InspectionChecklistTemplateCatalogReader
            .GetItemsAsync(_dbContext, includeInactive: false, visibleOnly: true)
            .ConfigureAwait(false);

        var requestedCodeOrder = checklistCodes
            .Select((code, index) => new { Code = code.Trim(), Index = index })
            .ToDictionary(x => x.Code, x => x.Index, StringComparer.OrdinalIgnoreCase);

        return templateItems
            .Where(x => requestedCodeOrder.ContainsKey(x.ChecklistCode))
            .OrderBy(x => requestedCodeOrder[x.ChecklistCode])
            .ThenBy(x => x.DisplayOrder)
            .Select(MapChecklistTemplateCatalogItem)
            .ToList();
    }

    /// <summary>
    /// Persists the AI smart-checklist items returned for this task into
    /// <c>[Inspection].[InspectionSmartChecklistItemLogs]</c> for downstream analytics.
    /// The real task id is available here, so one row = one (TaskId, ItemId) association.
    /// Best-effort: failures are logged but never fail the checklist-items response.
    /// </summary>
    private async Task PersistSmartChecklistItemLogsAsync(int taskId, int establishmentId, InspectionAiSmartChecklistResponseDto smartChecklist)
    {
        try
        {
            var categories = smartChecklist.Data?.ChecklistCategories;
            if (categories == null || categories.Count == 0)
            {
                return;
            }

            var batchId = Guid.NewGuid();
            var createdOn = DateTime.UtcNow;

            var logs = new List<InspectionSmartChecklistItemLog>();
            foreach (var category in categories)
            {
                var items = category?.CheckItems;
                if (items == null)
                {
                    continue;
                }

                foreach (var item in items)
                {
                    if (item == null || string.IsNullOrWhiteSpace(item.ItemId))
                    {
                        continue;
                    }

                    logs.Add(new InspectionSmartChecklistItemLog
                    {
                        TaskId = taskId,
                        BatchId = batchId,
                        EstablishmentId = establishmentId > 0 ? establishmentId : (int?)null,
                        VisitId = null,
                        CategoryId = string.IsNullOrWhiteSpace(category!.CategoryId) ? null : category.CategoryId,
                        CategoryName = string.IsNullOrWhiteSpace(category.CategoryName) ? null : category.CategoryName,
                        ItemId = item.ItemId,
                        ItemOrder = item.ItemOrder,
                        DescriptionEn = string.IsNullOrWhiteSpace(item.DescriptionEn) ? null : item.DescriptionEn,
                        DescriptionAr = string.IsNullOrWhiteSpace(item.DescriptionAr) ? null : item.DescriptionAr,
                        RiskTriggered = category.RiskTriggered,
                        CreatedOn = createdOn
                    });
                }
            }

            if (logs.Count == 0)
            {
                return;
            }

            // Keep only the latest smart-checklist result for this task: remove any rows
            // persisted by previous calls before inserting the new batch. Repeated calls
            // must not accumulate duplicate rows.
            var existing = await _dbContext.InspectionSmartChecklistItemLogs
                .Where(x => x.TaskId == taskId)
                .ToListAsync()
                .ConfigureAwait(false);
            if (existing.Count > 0)
            {
                _dbContext.InspectionSmartChecklistItemLogs.RemoveRange(existing);
            }

            await _dbContext.InspectionSmartChecklistItemLogs.AddRangeAsync(logs).ConfigureAwait(false);
            await _dbContext.SaveChangesAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // Persistence is best-effort analytics; never fail the API response because of it.
            _logger.LogError(ex, "Failed to persist Inspection AI SmartChecklist items for TaskId {TaskId}.", taskId);
        }
    }

    public async Task<InspectionExecutionSummaryDto> SaveChecklistAsync(int taskId, InspectionTaskChecklistSubmitRequestDto request)
    {
        var (task, execution) = await RequireTaskForExecutionAsync(taskId).ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.Checkin);

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        var violationsByChecklistCode = await BuildChecklistViolationLookupByCodeAsync(request).ConfigureAwait(false);

        RemoveAttachments(task, InspectionTaskAttachmentCategory.ChecklistEvidence, InspectionTaskAttachmentRelatedEntityType.ChecklistItem);

        foreach (var item in task.ChecklistItems.ToList())
        {
            foreach (var violation in item.Violations.ToList())
            {
                _checklistViolationRepository.Remove(violation);
                item.Violations.Remove(violation);
            }
        }

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        foreach (var item in task.ChecklistItems.ToList())
        {
            _checklistItemRepository.Remove(item);
        }

        task.ChecklistItems.Clear();
        var now = DateTimeHelper.Now;
        foreach (var item in request.Items)
        {
            ValidateChecklistItem(item);
            var resolvedViolation = item.ResultId == (int)InspectionChecklistResult.Violation
                ? ResolveChecklistViolation(item, violationsByChecklistCode)
                : null;

            var checklistItem = new InspectionTaskChecklistItem
            {
                TaskId = task.Id,
                ChecklistCode = item.ChecklistCode,
                ChecklistName = item.ChecklistName,
                ResultId = item.ResultId,
                Notes = item.Notes,
                DisplayOrder = item.DisplayOrder,
                RecordedAt = now,
                CreatedOn = now,
                LastUpdatedOn = now,
                CreatedBy = _currentUserService.UserId,
                UpdatedBy = _currentUserService.UserId
            };

            await _checklistItemRepository.AddAsync(checklistItem).ConfigureAwait(false);
            task.ChecklistItems.Add(checklistItem);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

            if (resolvedViolation != null)
            {
                var violation = new InspectionTaskChecklistViolation
                {
                    TaskId = task.Id,
                    TaskChecklistItemId = checklistItem.Id,
                    ViolationItemId = resolvedViolation.Id,
                    ViolationItemCode = resolvedViolation.Code,
                    ViolationTypeId = resolvedViolation.ViolationTypeId,
                    Reported = true,
                    // Licensing (ViolationTypeId=1) needs no committee second review → CommitteeReview=true immediately.
                    // Content (ViolationTypeId=2) → left null until the decide step sets it.
                    CommitteeReview = resolvedViolation.ViolationTypeId == (int)InspectionViolationType.Licensing ? true : null,
                    Degree = 0,
                    FineAmount = 0m,
                    Notes = item.Notes,
                    CreatedOn = now,
                    LastUpdatedOn = now,
                    CreatedBy = _currentUserService.UserId,
                    UpdatedBy = _currentUserService.UserId
                };

                await _checklistViolationRepository.AddAsync(violation).ConfigureAwait(false);
                checklistItem.Violations.Add(violation);
            }

            await AddAttachmentsAsync(
                task,
                NormalizeManagedAttachments(item.Attachments),
                InspectionTaskAttachmentCategory.ChecklistEvidence,
                InspectionTaskAttachmentRelatedEntityType.ChecklistItem,
                checklistItem.Id,
                resolvedViolation?.Code,
                now).ConfigureAwait(false);
        }

        await _inspectionViolationDomainService
            .RecalculateChecklistViolationAmountsAsync(task, execution, _currentUserService.UserId, GetOperatorName())
            .ConfigureAwait(false);

        execution.CurrentStepId = (int)InspectionExecutionStep.Checklist;
        TouchExecution(execution);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        if (task.Violations.Count > 0)
        {
            var existingViolationIds = task.Violations.Where(item => item.Id > 0).Select(item => item.Id).ToHashSet();
            var refreshedViolations = await _inspectionViolationDomainService
                .CreateFromTaskReportAsync(task, execution, _currentUserService.UserId, GetOperatorName())
                .ConfigureAwait(false);

            await EnsureDirectPendingPaymentPenaltyOrdersCreatedAsync(refreshedViolations).ConfigureAwait(false);
            await TrySendNewContentViolationNotificationsAsync(refreshedViolations, existingViolationIds).ConfigureAwait(false);
        }

        await WriteTaskTimelineAsync(task.Id, "InspectionChecklistSaved", content: $"Checklist saved for task {task.TaskNo}.", task: task).ConfigureAwait(false);
        return MapSummary(task, execution);
    }

    private static IReadOnlyList<InspectionChecklistTemplateCatalogReadModel> FilterExecutionChecklistTemplateItems(
        IReadOnlyList<InspectionChecklistTemplateCatalogReadModel> templateItems)
    {
        if (templateItems.Count == 0)
        {
            return Array.Empty<InspectionChecklistTemplateCatalogReadModel>();
        }

        return templateItems
            .Where(x => x.IsVisibleInChecklist)
            .GroupBy(x => x.ViolationTypeId)
            .OrderBy(group => group.Key)
            .SelectMany(group => PickRandomChecklistItems(group, maxCount: 2))
            .ToList();
    }

    private static IReadOnlyList<InspectionChecklistTemplateCatalogReadModel> PickRandomChecklistItems(
        IEnumerable<InspectionChecklistTemplateCatalogReadModel> items,
        int maxCount)
    {
        var candidates = items.ToList();
        if (candidates.Count <= maxCount)
        {
            return candidates;
        }

        for (var index = candidates.Count - 1; index > 0; index--)
        {
            var swapIndex = Random.Shared.Next(index + 1);
            (candidates[index], candidates[swapIndex]) = (candidates[swapIndex], candidates[index]);
        }

        return candidates
            .Take(maxCount)
            .ToList();
    }


    private static InspectionChecklistTemplateCatalogItemDto MapChecklistTemplateCatalogItem(InspectionChecklistTemplateCatalogReadModel item)
        => new()
        {
            Id = item.Id,
            ChecklistCode = item.ChecklistCode,
            ViolationDescription = item.ViolationDescription,
            ViolationDescriptionAr = item.ViolationDescriptionAr,
            ChecklistName = item.ChecklistName,
            ViolationItemId = item.TemplateItemId,
            LegacyViolationItemId = item.LegacyViolationItemId,
            ViolationItemCode = item.EffectiveViolationCode,
            ViolationTypeId = item.ViolationTypeId,
            ViolationTypeCode = item.ViolationTypeId switch
            {
                1 => "LicensingViolation",
                2 => "ContentViolation",
                _ => $"ViolationType{item.ViolationTypeId}"
            },
            IsVisibleInChecklist = item.IsVisibleInChecklist,
            IsSystemTriggered = item.IsSystemTriggered,
            RequiredWhenViolation = item.RequiredWhenViolation,
            DisplayOrder = item.DisplayOrder,
            IsActive = item.IsActive,
            CreatedOn = item.CreatedOn,
            CreatedBy = item.CreatedBy,
            ApplicableTemplateTypes = item.ApplicableTemplateTypes.ToList()
        };

    private async Task<Dictionary<string, InspectionPenaltyRule>> BuildChecklistViolationLookupByCodeAsync(InspectionTaskChecklistSubmitRequestDto request)
    {
        if (!request.Items.Any(x => x.ResultId == (int)InspectionChecklistResult.Violation))
        {
            return new Dictionary<string, InspectionPenaltyRule>(StringComparer.OrdinalIgnoreCase);
        }

        var checklistCodes = request.Items
            .Where(x => x.ResultId == (int)InspectionChecklistResult.Violation)
            .Select(x => x.ChecklistCode)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var catalogItems = await _violationCatalogRepository.GetByChecklistCodesAsync(checklistCodes).ConfigureAwait(false);
        var byCode = new Dictionary<string, InspectionPenaltyRule>(StringComparer.OrdinalIgnoreCase);

        foreach (var catalogItem in catalogItems)
        {
            if (!string.IsNullOrWhiteSpace(catalogItem.Code) && !byCode.ContainsKey(catalogItem.Code))
            {
                byCode[catalogItem.Code.Trim()] = catalogItem;
            }
        }

        return byCode;
    }

    private static InspectionPenaltyRule ResolveChecklistViolation(
        InspectionChecklistItemSubmitDto item,
        IReadOnlyDictionary<string, InspectionPenaltyRule> violationsByCode)
    {
        var normalizedChecklistCode = NormalizeOptional(item.ChecklistCode);
        if (!string.IsNullOrWhiteSpace(normalizedChecklistCode)
            && violationsByCode.TryGetValue(normalizedChecklistCode, out var resolvedByCode))
        {
            return resolvedByCode;
        }


        throw new BusinessException("Inspection.Execution.ChecklistViolationItemNotFound", "");
    }

    public async Task<InspectionExecutionSummaryDto> SaveSeizedMaterialsAsync(int taskId, SaveInspectionSeizedMaterialsRequestDto request)
    {
        // Only load the aggregate slices this endpoint actually reads/writes: Execution
        // (step + summary), Attachments (evidence rebuild), SeizedMaterials (replace),
        // ContactPersons (step resolution) and Inspectors (timeline owner). Loading the full
        // aggregate (checklist items, violations, timeline, OCR results) made large submissions
        // needlessly slow via extra split-query round-trips.
        const InspectionTaskIncludes includes = InspectionTaskIncludes.Execution
            | InspectionTaskIncludes.Attachments
            | InspectionTaskIncludes.SeizedMaterials
            | InspectionTaskIncludes.ContactPersons
            | InspectionTaskIncludes.Inspectors;
        var (task, execution) = await RequireTaskForExecutionAsync(taskId, includes).ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.Checklist);
        EnsureFieldInspection(task);

        RemoveAttachments(task, InspectionTaskAttachmentCategory.SeizedMaterialEvidence, InspectionTaskAttachmentRelatedEntityType.SeizedMaterial);

        foreach (var existing in task.SeizedMaterials.ToList())
        {
            _seizedMaterialRepository.Remove(existing);
        }

        task.SeizedMaterials.Clear();
        var now = DateTimeHelper.Now;

        // Batch the writes: build every material first, persist them all in ONE SaveChanges
        // to obtain the generated Ids, then attach evidence and save once more. The previous
        // implementation called SaveChangesAsync per item (N round-trips + N aggregate change
        // scans), which made large submissions very slow.
        var itemsWithEntities = new List<(InspectionSeizedMaterialSubmitDto Item, InspectionSeizedMaterial Entity)>(request.Items.Count);
        foreach (var item in request.Items)
        {
            var materialTypeId = await ResolveSeizedMaterialTypeIdAsync(item).ConfigureAwait(false);
            if (materialTypeId <= 0)
            {
                throw new BusinessException("Inspection.Execution.SeizedMaterialTypeRequired", "");
            }

            var entity = new InspectionSeizedMaterial
            {
                TaskId = task.Id,
                MaterialTypeId = materialTypeId,
                Isbn = item.Isbn,
                Title = item.Title,
                Author = item.Author,
                LanguageId = item.LanguageId,
                NumberOfCopy = item.NumberOfCopy,
                Notes = item.Notes,
                CreatedOn = now,
                LastUpdatedOn = now,
                CreatedBy = _currentUserService.UserId,
                UpdatedBy = _currentUserService.UserId
            };

            await _seizedMaterialRepository.AddAsync(entity).ConfigureAwait(false);
            task.SeizedMaterials.Add(entity);
            itemsWithEntities.Add((item, entity));
        }

        // Single round-trip to insert all materials and populate their generated Ids.
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        foreach (var (item, entity) in itemsWithEntities)
        {
            await AddAttachmentsAsync(
                task,
                item.Attachments,
                InspectionTaskAttachmentCategory.SeizedMaterialEvidence,
                InspectionTaskAttachmentRelatedEntityType.SeizedMaterial,
                entity.Id,
                null,
                now).ConfigureAwait(false);
        }

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.CurrentStepId = (int)InspectionExecutionStep.SeizedMaterials;
        TouchExecution(execution);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "InspectionSeizedMaterialsSaved", content: $"Seized materials saved for task {task.TaskNo}.", task: task).ConfigureAwait(false);
        return MapSummary(task, execution);
    }

    private async Task<int> ResolveSeizedMaterialTypeIdAsync(InspectionSeizedMaterialSubmitDto item)
    {
        if (item.MaterialTypeId > 0)
        {
            return item.MaterialTypeId;
        }

        if (string.IsNullOrWhiteSpace(item.MaterialTypeCodeAlias))
        {
            return item.MaterialTypeId;
        }

        var rawMaterialTypeCode = item.MaterialTypeCodeAlias;

        if (string.IsNullOrWhiteSpace(rawMaterialTypeCode))
        {
            return item.MaterialTypeId;
        }

        if (int.TryParse(rawMaterialTypeCode.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedMaterialTypeId)
            && parsedMaterialTypeId > 0)
        {
            return parsedMaterialTypeId;
        }

        var normalizedMaterialTypeCode = rawMaterialTypeCode.Trim();
        return await _dbContext.MaterialTypes
            .AsNoTracking()
            .Where(x => x.Code == normalizedMaterialTypeCode)
            .Select(x => (int)x.Id)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);
    }

    public async Task<InspectionExecutionSummaryDto> SaveContactPersonAsync(int taskId, SaveInspectionTaskContactPersonRequestDto request)
    {
        // Perf: this endpoint only touches ContactPersons (remove/clear/re-add + step resolution),
        // Execution, and Inspectors (timeline owner resolution). Loading the full aggregate
        // (Attachments, ChecklistItems+Violations, SeizedMaterials, TimelineEvents, OcrScanResults,
        // Violations) via AsSplitQuery issued ~9 SQL round-trips over unbounded collections
        // (TimelineEvents grows on every action) and was the source of the slowness.
        var (task, execution) = await RequireTaskForExecutionAsync(
            taskId,
            InspectionTaskIncludes.Execution | InspectionTaskIncludes.ContactPersons | InspectionTaskIncludes.Inspectors)
        .ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.Checklist);
        EnsureFieldInspection(task);
        ValidateFieldInspectionContactPersonRequest(request);

        foreach (var existing in task.ContactPersons.ToList())
        {
            _contactPersonRepository.Remove(existing);
        }

        task.ContactPersons.Clear();
        var now = DateTimeHelper.Now;
        var entity = new InspectionTaskContactPerson
        {
            TaskId = task.Id,
            FullName = request.FullName.Trim(),
            Position = request.Position?.Trim(),
            Mobile = request.Mobile.Trim(),
            Email = request.Email?.Trim(),
            EmiratesId = EmiratesIdLookupHelper.NormalizeForStorage(request.EmiratesId),
            CollectedChannelCode = NormalizeOptional(request.CollectedChannelCode),
            SubmittedOn = now,
            EidAttachmentFileName = request.EidAttachmentFileName?.Trim(),
            EidAttachmentFileUrl = request.EidAttachmentFileUrl?.Trim(),
            DeclarationAcknowledged = false,
            HasSignedDeclaration = null,
            DeclarationDeclinedReason = null,
            SignatureImageFileName = null,
            SignatureImageFileUrl = null,
            SignatureSignedOn = null,
            CreatedOn = now,
            LastUpdatedOn = now,
            CreatedBy = _currentUserService.UserId,
            UpdatedBy = _currentUserService.UserId
        };

        await _contactPersonRepository.AddAsync(entity).ConfigureAwait(false);

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.CurrentStepId = (int)InspectionExecutionStep.ContactPerson;
        TouchExecution(execution);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "InspectionContactPersonSaved", content: $"Contact person saved for task {task.TaskNo}.", task: task).ConfigureAwait(false);
        return MapSummary(task, execution);
    }

    public async Task<InspectionExecutionSummaryDto> SaveContactPersonDeclarationAsync(int taskId, SaveInspectionTaskContactPersonDeclarationRequestDto request)
    {
        // Perf: this endpoint only reads/writes ContactPersons (declaration + signature),
        // Execution (step advance), and Inspectors (timeline owner resolution in WriteTaskTimelineAsync).
        // Loading the full aggregate (Attachments, ChecklistItems+Violations, SeizedMaterials,
        // TimelineEvents, OcrScanResults, Violations) via AsSplitQuery issued ~9 SQL round-trips over
        // unbounded collections (TimelineEvents grows on every task action), which made this endpoint
        // slow enough to hit the gateway timeout ("connection refused") on long-lived tasks.
        var (task, execution) = await RequireTaskForExecutionAsync(
        taskId,
        InspectionTaskIncludes.Execution | InspectionTaskIncludes.ContactPersons | InspectionTaskIncludes.Inspectors)
        .ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.Checklist);
        EnsureFieldInspection(task);
        ValidateFieldInspectionContactPersonDeclarationRequest(request);

        var contactPerson = task.ContactPersons
            .OrderByDescending(x => x.SubmittedOn ?? x.CreatedOn)
            .FirstOrDefault();

        if (contactPerson == null)
        {
            throw new BusinessException("Inspection.Execution.ContactPersonRequired", "");
        }

        var now = DateTimeHelper.Now;
        contactPerson.DeclarationAcknowledged = request.DeclarationAcknowledged;
        contactPerson.HasSignedDeclaration = request.HasSignedDeclaration;
        contactPerson.DeclarationDeclinedReason = request.HasSignedDeclaration
            ? null
            : NormalizeOptional(request.DeclarationDeclinedReason);
        contactPerson.SignatureImageFileName = request.HasSignedDeclaration
            ? NormalizeOptional(request.SignatureImageFileName)
            : null;
        contactPerson.SignatureImageFileUrl = request.HasSignedDeclaration
            ? NormalizeOptional(request.SignatureImageFileUrl)
            : null;
        // Clear any previously generated declaration document when the signature is revoked
        contactPerson.DeclarationDocumentFileName = request.HasSignedDeclaration
            ? BuildDeclarationDocumentFileName(task.TaskNo, contactPerson.Id)
            : null;
        contactPerson.DeclarationDocumentFileUrl = null; // cleared; GenerateAsync will write the real MinIO path
        contactPerson.DeclarationDocumentGeneratedOn = request.HasSignedDeclaration ? now : null;
        contactPerson.SignatureSignedOn = request.HasSignedDeclaration ? now : null;
        contactPerson.LastUpdatedOn = now;
        contactPerson.UpdatedBy = _currentUserService.UserId;

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.CurrentStepId = (int)InspectionExecutionStep.declarationAcknowledgement;
        TouchExecution(execution);

        // Save the signature and declaration state first so GenerateAsync can read them from DB
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "InspectionContactPersonDeclarationSaved", content: $"Contact person declaration saved for task {task.TaskNo}.", task: task).ConfigureAwait(false);

        // Generate the real declaration PDF and persist the URL/filename.
        // This is fired to the background: rendering the declaration PDF makes a synchronous HTTP call
        // to the external render service (headless-browser rendering of a >1MB template), which takes
        // several seconds. The response DTO does not include the PDF URL/filename, and the upload is
        // already eventually-consistent, so blocking the request on it only adds latency with no value.
        if (request.HasSignedDeclaration && !string.IsNullOrWhiteSpace(contactPerson.SignatureImageFileUrl))
        {
        var capturedTaskId = taskId;
        var capturedContactPersonId = contactPerson.Id;
        _ = Task.Run(async () =>
        {
            try
            {
            // Dedicated DI scope so the scoped PDF service / DbContext outlives the HTTP request.
            using var scope = _scopeFactory.CreateScope();
            var pdfService = scope.ServiceProvider.GetRequiredService<IDeclarationDocumentPdfService>();
            await pdfService.GenerateAsync(capturedTaskId, capturedContactPersonId).ConfigureAwait(false);
            // GenerateAsync saves DeclarationDocumentFileUrl, DeclarationDocumentFileName,
            // DeclarationDocumentGeneratedOn directly via its own db.SaveChangesAsync()
            }
            catch (Exception ex)
            {
            // PDF generation is best-effort: the signature is already saved.
            // Log the failure so it can be retried via the dedicated generate endpoint.
            _logger.LogError(ex,
                "Failed to auto-generate declaration PDF. taskId={TaskId}, contactPersonId={ContactPersonId}. " +
                "The signature has been saved; use the generate-declaration-pdf endpoint to retry.",
                capturedTaskId, capturedContactPersonId);
            }
        }, CancellationToken.None);
        }

        return MapSummary(task, execution);
    }

    public async Task<InspectionExecutionSummaryDto> SaveReinspectionAsync(int taskId, SaveInspectionTaskReinspectionRequestDto request)
    {
        // Reinspection only reads Execution (state), ContactPersons (EnsureStepAllowed) and
        // Inspectors (copied into the reinspection task). Loading InspectionTaskIncludes.All here
        // fans out into ~9 AsSplitQuery round-trips against the remote DB (TimelineEvents,
        // OcrScanResults, Violations, ChecklistItems, Attachments, SeizedMaterials) that this
        // endpoint never touches — the dominant latency source. Narrow to what is actually used.
        var (task, execution) = await RequireTaskForExecutionAsync(
            taskId,
            InspectionTaskIncludes.Execution | InspectionTaskIncludes.ContactPersons | InspectionTaskIncludes.Inspectors)
            .ConfigureAwait(false);
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.Checklist);
        ValidateReinspectionRequest(request);

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.NeedsReinspection = request.NeedsReinspection;
        execution.ReinspectionDueDate = request.NeedsReinspection ? request.ReinspectionDueDate : null;
        execution.ReinspectionNote = request.NeedsReinspection ? NormalizeOptional(request.ReinspectionNote) : null;
        execution.CurrentStepId = (int)InspectionExecutionStep.Reinspection;
        TouchExecution(execution);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "InspectionReinspectionSaved", content: $"Reinspection settings saved for task {task.TaskNo}.", task: task).ConfigureAwait(false);

        if (request.NeedsReinspection && request.ReinspectionDueDate.HasValue)
        {
            await CreateReinspectionTaskIfNeededAsync(task, request.ReinspectionDueDate.Value, request.RelatedViolationId).ConfigureAwait(false);
        }

        return MapSummary(task, execution);
    }

    private async Task CreateReinspectionTaskIfNeededAsync(InspectionTask sourceTask, DateTime dueDate, int? requestedViolationId)
    {
        // Avoid creating duplicate reinspection tasks on repeated calls
        var alreadyExists = await _dbContext.InspectionTasks
            .AsNoTracking()
            .AnyAsync(x => x.ReinspectionNo == sourceTask.TaskNo)
            .ConfigureAwait(false);
        if (alreadyExists)
        {
            return;
        }

        var now = DateTimeHelper.Now;
        var reinspectionReasonId = await ResolveCorrectiveActionReinspectionReasonIdAsync().ConfigureAwait(false);
        var inspectors = sourceTask.Inspectors.ToList();
        var hasInspectors = inspectors.Count > 0;
        var relatedViolationId = await ResolveReinspectionViolationIdAsync(sourceTask.Id, requestedViolationId).ConfigureAwait(false);

        var reinspectionTask = new InspectionTask
        {
            TaskNo = await GenerateTaskNoAsync().ConfigureAwait(false),
            TargetTypeId = sourceTask.TargetTypeId,
            SourceTypeId = sourceTask.SourceTypeId,
            InspectionMethodId = sourceTask.InspectionMethodId,
            ActivityId = sourceTask.ActivityId,
            EstablishmentId = sourceTask.EstablishmentId,
            IndividualId = sourceTask.IndividualId,
            EstablishmentTypeId = sourceTask.EstablishmentTypeId,
            EstablishmentName = sourceTask.EstablishmentName,
            TradeLicenseNumber = sourceTask.TradeLicenseNumber,
            FullName = sourceTask.FullName,
            EmiratesId = sourceTask.EmiratesId,
            Email = sourceTask.Email,
            Mobile = sourceTask.Mobile,
            InspectionReasonId = reinspectionReasonId,
            PriorityId = sourceTask.PriorityId,
            EmirateId = sourceTask.EmirateId,
            AuthorityId = sourceTask.AuthorityId,
            RegionId = sourceTask.RegionId,
            CommunityId = sourceTask.CommunityId,
            AreaStreet = sourceTask.AreaStreet,
            DueDate = dueDate,
            Remarks = sourceTask.Remarks,
            ReinspectionNo = sourceTask.TaskNo,
            RelatedTaskId = sourceTask.Id,
            RelatedViolationId = relatedViolationId,
            StatusId = hasInspectors ? (int)InspectionTaskStatus.PendingVisit : (int)InspectionTaskStatus.Queued,
            CountsTowardInspectionInterval = false,
            AssignedOn = hasInspectors ? now : null,
            CreatedOn = now,
            LastUpdatedOn = now,
            CreatedBy = _currentUserService.UserId,
            UpdatedBy = _currentUserService.UserId,
        };

        if (hasInspectors)
        {
            var primary = inspectors.FirstOrDefault(x => x.IsPrimary) ?? inspectors[0];
            var allNames = string.Join(", ", inspectors
                .Select(x => x.InspectorName ?? x.InspectorId)
                .Where(n => !string.IsNullOrWhiteSpace(n)));
            reinspectionTask.CurrentOwnerTypeCode = inspectors.Count > 1 ? "MultipleInspectors" : "User";
            reinspectionTask.CurrentOwnerUserId = primary.InspectorId;
            reinspectionTask.CurrentOwnerUserName = primary.InspectorName;
            reinspectionTask.CurrentOwnerSummary = allNames;
        }
        else
        {
            reinspectionTask.CurrentOwnerTypeCode = "Queue";
            reinspectionTask.CurrentOwnerSummary = "Queue";
        }

        await _taskRepository.AddAsync(reinspectionTask).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        if (hasInspectors)
        {
            foreach (var inspector in inspectors)
            {
                await _dbContext.InspectionTaskInspectors.AddAsync(new InspectionTaskInspector
                {
                    TaskId = reinspectionTask.Id,
                    InspectorId = inspector.InspectorId,
                    InspectorName = inspector.InspectorName,
                    IsPrimary = inspector.IsPrimary,
                    AssignedOn = now,
                    CreatedOn = now,
                    LastUpdatedOn = now,
                    CreatedBy = _currentUserService.UserId,
                    UpdatedBy = _currentUserService.UserId
                }).ConfigureAwait(false);
            }

            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        }

        var createdTimelineEventId = await WriteTaskTimelineAsync(
            reinspectionTask.Id,
            "ReinspectionTaskAutoCreated",
            content: $"Reinspection task {reinspectionTask.TaskNo} created from {sourceTask.TaskNo}.",
            toStatusId: -1,
            eventCode: "ReinspectionTaskAutoCreated",
            targetHandlerUserId: hasInspectors ? (inspectors.FirstOrDefault(x => x.IsPrimary) ?? inspectors[0]).InspectorId : null,
            targetHandlerUserName: hasInspectors ? (inspectors.FirstOrDefault(x => x.IsPrimary) ?? inspectors[0]).InspectorName : null,
            task: reinspectionTask).ConfigureAwait(false);

        if (hasInspectors)
        {
            var primary = inspectors.FirstOrDefault(x => x.IsPrimary) ?? inspectors[0];
            var managerRecipients = await (
                    from department in _dbContext.UserDepartments.AsNoTracking()
                    join user in _dbContext.AdminUsers.AsNoTracking() on department.UserId equals user.Id
                    where department.DepartmentId == (int)UMC.AdminPortal.Domain.Shares.Enums.DepartmentEnum.Inspection
                        && department.IsLeader == true
                        && user.IsActive
                        && (user.Status == null || user.Status == UMC.AdminPortal.Domain.Models.AdminUser.ActiveStatusCode)
                    select new { user.Id, user.FirstName, user.LastName, user.UserName })
                .ToListAsync().ConfigureAwait(false);
            var snapshots = managerRecipients
                .Select(user => new InspectionTaskTimelineRecipientSnapshot
                {
                    TimelineEventId = createdTimelineEventId,
                    UserId = user.Id,
                    UserName = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(value => !string.IsNullOrWhiteSpace(value))).Trim() is { Length: > 0 } name
                        ? name
                        : user.UserName,
                    CreatedOn = now
                })
                .Append(new InspectionTaskTimelineRecipientSnapshot
                {
                    TimelineEventId = createdTimelineEventId,
                    UserId = primary.InspectorId,
                    UserName = primary.InspectorName,
                    CreatedOn = now
                })
                .GroupBy(snapshot => snapshot.UserId, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();
            await _dbContext.InspectionTaskTimelineRecipientSnapshots.AddRangeAsync(snapshots).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        }

        if (relatedViolationId.HasValue && hasInspectors && _taskNotificationService != null)
        {
            await _taskNotificationService.TrySendAsync(reinspectionTask.Id, createdTimelineEventId).ConfigureAwait(false);
        }

        if (hasInspectors)
        {
            var primary = inspectors.FirstOrDefault(x => x.IsPrimary) ?? inspectors[0];
            await WriteTaskTimelineAsync(
                reinspectionTask.Id,
                "TaskAssigned",
                content: "Task assigned to inspector(s).",
                fromStatusId: (int)InspectionTaskStatus.Queued,
                toStatusId: (int)InspectionTaskStatus.PendingVisit,
                targetHandlerUserId: primary.InspectorId,
                task: reinspectionTask).ConfigureAwait(false);
        }
    }

    private async Task<int?> ResolveReinspectionViolationIdAsync(int sourceTaskId, int? requestedViolationId)
    {
        var violationIds = await _dbContext.InspectionViolations.AsNoTracking()
            .Where(violation => violation.SourceTaskId == sourceTaskId)
            .Select(violation => violation.Id)
            .ToListAsync()
            .ConfigureAwait(false);

        if (requestedViolationId.HasValue)
        {
            if (!violationIds.Contains(requestedViolationId.Value))
            {
                throw new BusinessException("Inspection.Task.ReinspectionViolationInvalid", "");
            }

            return requestedViolationId.Value;
        }

        if (violationIds.Count > 1)
        {
            throw new BusinessException("Inspection.Task.ReinspectionViolationRequired", "");
        }

        return violationIds.SingleOrDefault() is var violationId && violationId > 0 ? violationId : null;
    }

    private async Task<string> GenerateTaskNoAsync()
    {
        var year = DateTimeHelper.Now.Year;
        //var nextSequence = await _taskRepository.GetMaxTaskNoSequenceAsync().ConfigureAwait(false) + 1;

        while (true)
        {
            var nextSequence = Nanoid.Generate("0123456789", 7);
            var taskNo = $"IN-{year}-{nextSequence:D7}";
            if (!await _taskRepository.ExistsTaskNoAsync(taskNo).ConfigureAwait(false))
            {
                return taskNo;
            }
        }
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ValidateAccessFailedRequest(InspectionTaskAccessFailedRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.AccessFailedReasonCode))
        {
            throw new BusinessException("Inspection.Execution.AccessFailedReasonRequired", "");
        }

        if (request.Attachments == null || request.Attachments.Count == 0)
        {
            throw new BusinessException("Inspection.Execution.AccessFailedAttachmentRequired", "");
        }

        if (string.Equals(request.AccessFailedReasonCode.Trim(), "Other", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(request.AccessFailedRemark))
        {
            throw new BusinessException("Inspection.Execution.AccessFailedRemarkRequired", "");
        }

        ValidateAttachments(request.Attachments, "Inspection.Execution.AccessFailedAttachmentRequired");
    }

    private static void ValidateChecklistItem(InspectionChecklistItemSubmitDto item)
    {
        if (item.ResultId != (int)InspectionChecklistResult.Violation)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(item.Notes))
        {
            throw new BusinessException("Inspection.Execution.ChecklistViolationNotesRequired", "");
        }

        if (item.Attachments == null || item.Attachments.Count == 0)
        {
            throw new BusinessException("Inspection.Execution.ChecklistViolationEvidenceRequired", "");
        }

        ValidateAttachments(item.Attachments, "Inspection.Execution.ChecklistViolationEvidenceRequired");
    }

    private static void ValidateAttachments(IReadOnlyCollection<InspectionRequestAttachmentDto> attachments, string errorCode)
    {
        if (attachments.Any(x => string.IsNullOrWhiteSpace(x.FileName) || string.IsNullOrWhiteSpace(x.FileUrl)))
        {
            throw new BusinessException(errorCode, "");
        }
    }

    private static IReadOnlyCollection<InspectionRequestAttachmentDto> NormalizeManagedAttachments(
        IReadOnlyCollection<InspectionRequestAttachmentDto>? attachments)
    {
        if (attachments == null || attachments.Count == 0)
        {
            return Array.Empty<InspectionRequestAttachmentDto>();
        }

        return attachments
            .Select(x => new InspectionRequestAttachmentDto
            {
                FileName = x.FileName,
                FileUrl = x.FileUrl,
                ContentType = NormalizeOptional(x.ContentType)
            })
            .ToList();
    }

    private static void ValidateReinspectionRequest(SaveInspectionTaskReinspectionRequestDto request)
    {
        if (!request.NeedsReinspection)
        {
            return;
        }

        if (!request.ReinspectionDueDate.HasValue)
        {
            throw new BusinessException("Inspection.Execution.ReinspectionDueDateRequired", "");
        }
    }

    private static string BuildMockDeclarationDocumentFileName(InspectionTask task, InspectionTaskContactPerson contactPerson)
        => $"declaration-acknowledgement-{task.TaskNo}-{contactPerson.Id}.pdf";

    private static string BuildMockDeclarationDocumentFileUrl(InspectionTask task, InspectionTaskContactPerson contactPerson)
        => $"/api/admin/inspection/mock-files/declarations/{BuildMockDeclarationDocumentFileName(task, contactPerson)}";

    /// <summary>
    /// Returns the deterministic PDF file name for a declaration document.
    /// Must stay in sync with the naming formula in <c>DeclarationDocumentPdfService.GenerateAsync</c>.
    /// </summary>
    private static string BuildDeclarationDocumentFileName(string taskNo, int contactPersonId)
    {
        var safeTaskNo = string.Concat(taskNo.Select(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' ? c : '_'));
        return $"{safeTaskNo}-declaration-{contactPersonId}.pdf";
    }

    private async Task ReplaceAttachmentsByCategoryAsync(
        InspectionTask task,
        IReadOnlyCollection<InspectionRequestAttachmentDto> attachments,
        InspectionTaskAttachmentCategory attachmentCategory,
        InspectionTaskAttachmentRelatedEntityType relatedEntityType,
        int? relatedEntityId,
        string? relatedEntityCode = null)
    {
        RemoveAttachments(task, attachmentCategory, relatedEntityType);
        await AddAttachmentsAsync(task, attachments, attachmentCategory, relatedEntityType, relatedEntityId, relatedEntityCode, DateTimeHelper.Now).ConfigureAwait(false);
    }

    private void RemoveAttachments(InspectionTask task, InspectionTaskAttachmentCategory attachmentCategory, InspectionTaskAttachmentRelatedEntityType relatedEntityType)
    {
        foreach (var existingAttachment in task.Attachments
                     .Where(x => attachmentCategory.Matches(x.AttachmentCategory)
                                 && MatchesAttachmentRelatedEntityType(x, attachmentCategory, relatedEntityType))
                     .ToList())
        {
            _taskAttachmentRepository.Remove(existingAttachment);
            task.Attachments.Remove(existingAttachment);
        }
    }

    private static bool MatchesAttachmentRelatedEntityType(
        InspectionTaskAttachment attachment,
        InspectionTaskAttachmentCategory attachmentCategory,
        InspectionTaskAttachmentRelatedEntityType relatedEntityType)
    {
        if (relatedEntityType.Matches(attachment.RelatedEntityType))
        {
            return true;
        }

        return attachmentCategory == InspectionTaskAttachmentCategory.AccessFailedEvidence
               && relatedEntityType == InspectionTaskAttachmentRelatedEntityType.TaskExecution
               && string.Equals(attachment.RelatedEntityType, nameof(InspectionTaskStatus.AccessFailed), StringComparison.OrdinalIgnoreCase);
    }

    private async Task AddAttachmentsAsync(
        InspectionTask task,
        IReadOnlyCollection<InspectionRequestAttachmentDto>? attachments,
        InspectionTaskAttachmentCategory defaultAttachmentCategory,
        InspectionTaskAttachmentRelatedEntityType defaultRelatedEntityType,
        int? relatedEntityId,
        string? relatedEntityCode,
        DateTime now)
    {
        if (attachments == null || attachments.Count == 0)
        {
            return;
        }

        ValidateAttachments(attachments, "Inspection.Task.AttachmentFileRequired");
        var resolvedAttachmentCategory = defaultAttachmentCategory.GetValue();
        var resolvedRelatedEntityType = defaultRelatedEntityType.GetValue();

        foreach (var attachment in attachments)
        {
            var entity = new InspectionTaskAttachment
            {
                TaskId = task.Id,
                Task = task,
                RelatedEntityType = resolvedRelatedEntityType,
                RelatedEntityId = relatedEntityId,
                RelatedEntityCode = NormalizeOptional(attachment.RelatedEntityCode) ?? NormalizeOptional(relatedEntityCode),
                AttachmentCategory = resolvedAttachmentCategory,
                FileName = attachment.FileName.Trim(),
                FileUrl = attachment.FileUrl.Trim(),
                ContentType = NormalizeOptional(attachment.ContentType),
                UploadedBy = _currentUserService.UserId,
                UploadedAt = now,
                LastUpdatedOn = now,
                CreatedOn = now,
                CreatedBy = _currentUserService.UserId,
                UpdatedBy = _currentUserService.UserId
            };

            await _taskAttachmentRepository.AddAsync(entity).ConfigureAwait(false);
        }
    }

    private static void EnsureStepAllowed(InspectionTask task, InspectionTaskExecution? execution, bool allowAccessFailedBranch, int? expectedMinStep)
    {
        if (task.StatusId == (int)InspectionTaskStatus.Cancelled || task.StatusId == (int)InspectionTaskStatus.Completed)
        {
            throw new BusinessException("Inspection.Execution.TaskClosed", "");
        }

        if (!allowAccessFailedBranch && task.StatusId == (int)InspectionTaskStatus.AccessFailed)
        {
            throw new BusinessException("Inspection.Execution.AccessFailedClosed", "");
        }

        var resolvedCurrentStepId = InspectionExecutionStepResolver.ResolveCurrentStepId(task.StatusId, execution, task.ContactPersons);
        if (expectedMinStep.HasValue && (!resolvedCurrentStepId.HasValue || resolvedCurrentStepId.Value < expectedMinStep.Value))
        {
            throw new BusinessException("Inspection.Execution.StepOutOfOrder", "");
        }
    }

    private async Task<InspectionTaskExecution> CreateExecutionAsync(int taskId)
    {
        var now = DateTimeHelper.Now;
        var execution = new InspectionTaskExecution
        {
            TaskId = taskId,
            CreatedOn = now,
            LastUpdatedOn = now,
            CreatedBy = _currentUserService.UserId,
            UpdatedBy = _currentUserService.UserId
        };

        await _executionRepository.AddAsync(execution).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        return execution;
    }

    private async Task<int> WriteTaskTimelineAsync(
        int taskId,
        string eventType,
        string? content = null,
        int? fromStatusId = null,
        int? toStatusId = null,
        InspectionTask? task = null,
        string? eventCode = null,
        string? eventName = null,
        string? targetHandlerTypeCode = null,
        string? targetHandlerUserId = null,
        string? targetHandlerUserName = null,
        string? actorTypeCode = null,
        string? actorUserId = null,
        string? actorUserName = null,
        int? actorRoleId = null,
        string? resultCode = "Success",
        string? locationText = null,
        string? reasonCode = null,
        string? reasonText = null)
    {
        var resolvedEventCode = NormalizeOptional(eventCode) ?? ResolveTimelineEventCode(eventType);
        var resolvedEventName = NormalizeOptional(eventName) ?? ResolveTimelineEventName(resolvedEventCode);
        var resolvedTargetHandler = ResolveTimelineTargetHandler(task, eventType, toStatusId, targetHandlerTypeCode, targetHandlerUserId, targetHandlerUserName);
        var resolvedActorUserId = NormalizeOptional(actorUserId) ?? _currentUserService.UserId;
        var resolvedActorUserName = NormalizeOptional(actorUserName) ?? GetOperatorName();
        var resolvedActorRoleId = actorRoleId ?? GetOperatorRoleId();
        var resolvedActorTypeCode = NormalizeOptional(actorTypeCode) ?? ResolveTimelineActorTypeCode(resolvedActorUserId, resolvedActorUserName);
        var resolvedContent = NormalizeOptional(content);

        var timelineEvent = new InspectionTaskTimelineEvent
        {
            TaskId = taskId,
            EventType = eventType,
            EventCode = resolvedEventCode,
            EventName = resolvedEventName,
            Label = !string.IsNullOrWhiteSpace(resolvedContent)
                ? resolvedContent
                : !string.IsNullOrWhiteSpace(resolvedEventName)
                    ? resolvedEventName
                    : resolvedEventCode,
            FromStatusId = fromStatusId,
            ToStatusId = toStatusId,
            TargetHandlerTypeCode = resolvedTargetHandler?.TypeCode,
            TargetHandlerUserId = resolvedTargetHandler?.UserId,
            TargetHandlerUserName = resolvedTargetHandler?.UserName,
            ActorTypeCode = resolvedActorTypeCode,
            ActorUserId = resolvedActorUserId,
            ActorUserName = resolvedActorUserName,
            ActorRoleId = resolvedActorRoleId,
            ResultCode = NormalizeOptional(resultCode),
            Content = resolvedContent,
            LocationText = NormalizeOptional(locationText),
            ReasonCode = NormalizeOptional(reasonCode),
            ReasonText = NormalizeOptional(reasonText),
            CreatedOn = DateTimeHelper.Now
        };
        await _timelineRepository.AddAsync(timelineEvent).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        return timelineEvent.Id;
    }

    private async Task<int> ResolveCorrectiveActionReinspectionReasonIdAsync()
    {
        var item = await _dbContext.TypeDictionaries
            .AsNoTracking()
            .Where(x => x.Scope == nameof(InspectionReason)
                        && x.NameEn == "Corrective Action Re-inspection")
            .OrderBy(x => x.Sort)
            .ThenBy(x => x.Id)
            .Select(x => new { x.Id, x.Code, x.Sort })
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        return item == null
            ? (int)InspectionReason.CorrectiveActionReinspection
            : ResolveEnumDictionaryValueId(item.Code, item.Sort, item.Id);
    }

    private static int ResolveEnumDictionaryValueId(string? code, int? sort, int fallbackId)
    {
        if (int.TryParse(code, out var parsedCode))
        {
            return parsedCode;
        }

        return sort ?? fallbackId;
    }

    private static string BuildAccessFailedTimelineContent(InspectionTaskExecution execution)
    {
        var reasonCode = NormalizeOptional(execution.AccessFailedReasonCode);
        var remark = NormalizeOptional(execution.AccessFailedRemark);

        if (!string.IsNullOrWhiteSpace(reasonCode) && !string.IsNullOrWhiteSpace(remark))
        {
            return $"Unable to access. Reason: {reasonCode}. Remark: {remark}";
        }

        if (!string.IsNullOrWhiteSpace(reasonCode))
        {
            return $"Unable to access. Reason: {reasonCode}.";
        }

        if (!string.IsNullOrWhiteSpace(remark))
        {
            return $"Unable to access. Remark: {remark}";
        }

        return "Unable to access.";
    }

    private static string BuildInspectionCompletedTimelineContent(InspectionTask task, InspectionTaskExecution execution)
    {
        var inspectionResult = execution.HasViolationFound switch
        {
            true => "Violation found",
            false => "Compliant",
            null when task.Violations.Count > 0 => "Violation found",
            _ => null
        };

        return string.IsNullOrWhiteSpace(inspectionResult)
            ? "Check-out completed."
            : $"Check-out completed. Inspection Result: {inspectionResult}.";
    }

    private static string? ResolveLocationText(string? address, decimal? latitude, decimal? longitude)
        => !string.IsNullOrWhiteSpace(address)
            ? address.Trim()
            : latitude.HasValue && longitude.HasValue
                ? $"{latitude.Value}, {longitude.Value}"
                : null;

    private async Task TriggerDigitalViolationNoticeAsync(InspectionTask task, IReadOnlyList<InspectionViolation> violations)
    {
        if (task.InspectionMethodId != (int)InspectionMethod.DigitalInspection || violations.Count == 0)
        {
            return;
        }

        var recipientAddress = ResolveDeclarationRecipientAddress(task);
        if (string.IsNullOrWhiteSpace(recipientAddress) && _declarationLinkNotificationService != null)
        {
            // Digital tasks are created without an on-site contact, so InspectionTasks.Email/Mobile are
            // often empty; without this fallback CP-056 was skipped silently for those tasks.
            recipientAddress = await _declarationLinkNotificationService
                .ResolveAccountHolderEmailAsync(task)
                .ConfigureAwait(false);
        }

        if (string.IsNullOrWhiteSpace(recipientAddress))
        {
            _logger.LogWarning(
                "Digital violation notice skipped: no declaration recipient could be resolved. taskId={TaskId}.",
                task.Id);
            return;
        }

        var now = DateTimeHelper.Now;
        var expiresOn = now.AddDays(GetDeclarationLinkExpiryDays());
        var timelineItems = new List<(InspectionViolation Violation, string MaskedRecipient, string Channel, DateTime ExpiresOnUtc)>();

        foreach (var violation in violations.Where(x => x.DeclarationLinkSentOn == null))
        {
            violation.DeclarationRecipientAddress = recipientAddress;
            violation.DeclarationLinkSentOn = now;
            violation.DeclarationLinkExpiresOn = expiresOn;
            violation.LastUpdatedOn = now;
            violation.UpdatedBy = _currentUserService.UserId;

            timelineItems.Add((
                violation,
                MaskRecipient(recipientAddress),
                ResolveDeclarationChannel(recipientAddress),
                expiresOn));
        }

        if (timelineItems.Count == 0)
        {
            return;
        }

        var dispatchIds = _declarationLinkNotificationService == null
            ? Array.Empty<long>()
            : await _declarationLinkNotificationService
                .PrepareAsync(task, timelineItems.Select(item => item.Violation).ToList())
                .ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        var timelineResult = IsMockDeliveryEnabled() ? "Simulated" : "Prepared";

        foreach (var item in timelineItems)
        {
            await _inspectionViolationDomainService.AddTimelineEventAsync(new InspectionViolationTimelineEvent
            {
                ViolationId = item.Violation.Id,
                EventType = InspectionViolationTimelineEventCodes.ViolationNoticeSent,
                EventCode = InspectionViolationTimelineEventCodes.ViolationNoticeSent,
                EventName = InspectionViolationTimelineEventCodes.GetName(InspectionViolationTimelineEventCodes.ViolationNoticeSent),
                Label = InspectionViolationTimelineEventCodes.GetName(InspectionViolationTimelineEventCodes.ViolationNoticeSent),
                FromStatusId = item.Violation.StatusId,
                ToStatusId = item.Violation.StatusId,
                TargetHandlerTypeCode = "Customer",
                TargetHandlerUserName = item.MaskedRecipient,
                ActorTypeCode = "User",
                ActorUserId = _currentUserService.UserId,
                ActorUserName = GetOperatorName(),
                ActorRoleId = GetOperatorRoleId(),
                Content = $"Violation notice sent for {item.Violation.ViolationNo} to {item.MaskedRecipient} via {item.Channel}. Result: {timelineResult}.",
                CreatedOn = DateTimeHelper.Now
            }).ConfigureAwait(false);
        }

        if (_declarationLinkNotificationService != null && dispatchIds.Count > 0)
        {
            await _declarationLinkNotificationService.DispatchAsync(dispatchIds).ConfigureAwait(false);
        }
    }

    private async Task TrySendNewContentViolationNotificationsAsync(
        IReadOnlyList<InspectionViolation> violations,
        IReadOnlySet<int> existingViolationIds)
    {
        if (_violationStaffNotificationService == null)
        {
            return;
        }

        foreach (var violation in violations.Where(item => item.ViolationTypeId == (int)InspectionViolationType.Content
                                                            && !existingViolationIds.Contains(item.Id)))
        {
            var timelineEventId = await _dbContext.InspectionViolationTimelineEvents.AsNoTracking()
                .Where(item => item.ViolationId == violation.Id
                    && item.EventCode == InspectionViolationTimelineEventCodes.PendingRouting
                    && item.EventType == InspectionViolationTimelineEventCodes.PendingRouting)
                .OrderByDescending(item => item.Id)
                .Select(item => (int?)item.Id)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (!timelineEventId.HasValue)
            {
                continue;
            }

            try
            {
                await _violationStaffNotificationService.TrySendAsync(violation.Id, timelineEventId.Value).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Content violation notification failed after persistence. ViolationId={ViolationId}, TimelineEventId={TimelineEventId}.",
                    violation.Id,
                    timelineEventId.Value);
            }
        }
    }

    private void TouchTask(InspectionTask task)
    {
        ApplyTaskCurrentOwnerSnapshot(task);
        task.LastUpdatedOn = DateTimeHelper.Now;
        task.UpdatedBy = _currentUserService.UserId;
    }

    private static void ApplyTaskCurrentOwnerSnapshot(InspectionTask task)
    {
        var currentOwner = ResolveTaskCurrentOwner(task);
        task.CurrentOwnerTypeCode = currentOwner?.TypeCode;
        task.CurrentOwnerUserId = currentOwner?.UserId;
        task.CurrentOwnerUserName = currentOwner?.UserName;
        task.CurrentOwnerSummary = currentOwner?.Summary;
    }

    private static string ResolveTimelineEventCode(string eventType)
    {
        return eventType switch
        {
            "InspectionCheckIn" => "InspectionStarted",
            "InspectionReportSubmitted" => "InspectionCompleted",
            "InspectionCheckedOut" => "InspectionCompleted",
            _ => eventType
        };
    }

    private static string ResolveTimelineEventName(string eventCode)
    {
        return eventCode switch
        {
            "InspectionStarted" => "Inspection Started",
            "InspectionAccessFailed" => "Access Failed",
            "InspectionCompleted" => "Inspection Completed",
            "InspectionChecklistSaved" => "Checklist Saved",
            "InspectionSeizedMaterialsSaved" => "Seized Materials Saved",
            "InspectionContactPersonSaved" => "Contact Person Saved",
            "InspectionContactPersonDeclarationSaved" => "Contact Person Declaration Saved",
            "InspectionReinspectionSaved" => "Reinspection Settings Saved",
            _ => eventCode
        };
    }

    private static string ResolveTimelineActorTypeCode(string? actorUserId, string? actorUserName)
    {
        if (string.IsNullOrWhiteSpace(actorUserId)
            && (string.Equals(actorUserName, "System", StringComparison.OrdinalIgnoreCase)
                || string.Equals(actorUserName, "Automated System", StringComparison.OrdinalIgnoreCase)))
        {
            return "System";
        }

        return string.IsNullOrWhiteSpace(actorUserId) && string.IsNullOrWhiteSpace(actorUserName)
            ? "System"
            : "User";
    }

    private static TaskTimelineHandlerSnapshot? ResolveTimelineTargetHandler(
        InspectionTask? task,
        string eventType,
        int? toStatusId,
        string? targetHandlerTypeCode,
        string? targetHandlerUserId,
        string? targetHandlerUserName)
    {
        var explicitUserId = NormalizeOptional(targetHandlerUserId);
        var explicitSummary = NormalizeOptional(targetHandlerUserName);
        var explicitTypeCode = NormalizeOptional(targetHandlerTypeCode);
        var currentOwner = task == null ? null : ResolveTaskCurrentOwner(task);

        if (!string.IsNullOrWhiteSpace(explicitUserId)
            || !string.IsNullOrWhiteSpace(explicitSummary)
            || !string.IsNullOrWhiteSpace(explicitTypeCode))
        {
            return new TaskTimelineHandlerSnapshot(
                explicitTypeCode ?? currentOwner?.TypeCode ?? InferTimelineHandlerTypeCode(explicitSummary, explicitUserId),
                explicitUserId ?? currentOwner?.UserId,
                explicitSummary ?? currentOwner?.Summary ?? currentOwner?.UserName ?? explicitUserId);
        }

        if (string.Equals(eventType, "TaskQueued", StringComparison.Ordinal)
            || (string.Equals(eventType, "TaskCreated", StringComparison.Ordinal) && toStatusId == (int)InspectionTaskStatus.Queued))
        {
            return new TaskTimelineHandlerSnapshot("Automated", null, "Automated");
        }

        if (currentOwner != null)
        {
            return new TaskTimelineHandlerSnapshot(currentOwner.TypeCode, currentOwner.UserId, currentOwner.Summary);
        }

        return null;
    }

    private static string? InferTimelineHandlerTypeCode(string? summary, string? userId)
    {
        if (string.Equals(summary, "Queue", StringComparison.OrdinalIgnoreCase))
        {
            return "Queue";
        }

        return string.IsNullOrWhiteSpace(summary) && string.IsNullOrWhiteSpace(userId)
            ? null
            : "User";
    }

    private static TaskTimelineCurrentOwnerSnapshot? ResolveTaskCurrentOwner(InspectionTask task)
    {
        var persistedTypeCode = NormalizeOptional(task.CurrentOwnerTypeCode);
        var persistedUserId = NormalizeOptional(task.CurrentOwnerUserId);
        var persistedUserName = NormalizeOptional(task.CurrentOwnerUserName);
        var persistedSummary = NormalizeOptional(task.CurrentOwnerSummary);
        if (!string.IsNullOrWhiteSpace(persistedTypeCode)
            || !string.IsNullOrWhiteSpace(persistedUserId)
            || !string.IsNullOrWhiteSpace(persistedUserName)
            || !string.IsNullOrWhiteSpace(persistedSummary))
        {
            return new TaskTimelineCurrentOwnerSnapshot(
                persistedTypeCode ?? "User",
                persistedUserId,
                persistedUserName,
                persistedSummary ?? persistedUserName ?? persistedUserId ?? string.Empty);
        }

        return task.StatusId switch
        {
            (int)InspectionTaskStatus.Queued => new TaskTimelineCurrentOwnerSnapshot("Queue", null, null, "Queue"),
            (int)InspectionTaskStatus.PendingVisit or (int)InspectionTaskStatus.InProgress => BuildInspectorCurrentOwner(task.Inspectors),
            _ => null
        };
    }

    private static TaskTimelineCurrentOwnerSnapshot? BuildInspectorCurrentOwner(IEnumerable<InspectionTaskInspector> inspectors)
    {
        var orderedInspectors = inspectors
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.AssignedOn)
            .ThenBy(x => x.Id)
            .ToList();

        if (orderedInspectors.Count == 0)
        {
            return null;
        }

        var primaryInspector = orderedInspectors.FirstOrDefault(x => x.IsPrimary) ?? orderedInspectors[0];
        var summary = string.Join(", ", orderedInspectors.Select(x => NormalizeOptional(x.InspectorName) ?? x.InspectorId).Where(x => !string.IsNullOrWhiteSpace(x)));
        var typeCode = orderedInspectors.Count > 1 ? "MultipleInspectors" : "User";

        return new TaskTimelineCurrentOwnerSnapshot(
            typeCode,
            primaryInspector.InspectorId,
            NormalizeOptional(primaryInspector.InspectorName) ?? primaryInspector.InspectorId,
            summary);
    }

    private void TouchExecution(InspectionTaskExecution execution)
    {
        execution.LastUpdatedOn = DateTimeHelper.Now;
        execution.UpdatedBy = _currentUserService.UserId;
    }

    private int GetDeclarationLinkExpiryDays()
    {
        var configuredDays = _configuration.GetValue<int?>("InspectionDeclaration:LinkExpiryDays");
        var effectiveDays = configuredDays.GetValueOrDefault();
        return effectiveDays > 0 ? effectiveDays : 3;
    }

    private bool IsMockDeliveryEnabled()
        => _configuration.GetValue<bool?>("InspectionDeclaration:MockDeliveryEnabled") ?? true;

    private static string? ResolveDeclarationRecipientAddress(InspectionTask task)
    {
        if (!string.IsNullOrWhiteSpace(task.Email))
        {
            return task.Email.Trim();
        }

        var composedMobile = ContactNumberHelper.Compose(task.MobileCountryCode, task.MobileLocalNumber, task.Mobile);
        if (!string.IsNullOrWhiteSpace(composedMobile))
        {
            return composedMobile.Trim();
        }

        return null;
    }

    private static string ResolveDeclarationChannel(string recipientAddress)
        => recipientAddress.Contains('@') ? "Email" : "Mobile";

    private static string MaskRecipient(string recipientAddress)
    {
        var normalized = recipientAddress.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return string.Empty;
        }

        if (normalized.Contains('@'))
        {
            var parts = normalized.Split('@', 2);
            var local = parts[0];
            var domain = parts[1];
            var visibleLocal = local.Length <= 2
                ? local[0] + "*"
                : local[..2] + new string('*', Math.Max(1, local.Length - 2));
            return $"{visibleLocal}@{domain}";
        }

        if (normalized.Length <= 4)
        {
            return new string('*', normalized.Length);
        }

        return $"{normalized[..2]}{new string('*', normalized.Length - 4)}{normalized[^2..]}";
    }

    private InspectionExecutionSummaryDto MapSummary(InspectionTask task, InspectionTaskExecution execution)
    {
        return new InspectionExecutionSummaryDto
        {
            TaskId = task.Id,
            CurrentStepId = InspectionExecutionStepResolver.ResolveCurrentStepId(task.StatusId, execution, task.ContactPersons),
            TaskStatusId = task.StatusId,
            AccessOutcomeCode = execution.AccessOutcomeCode,
            AccessFailedReasonCode = execution.AccessFailedReasonCode,
            HasViolationFound = execution.HasViolationFound,
            NeedsReinspection = execution.NeedsReinspection,
            ReinspectionDueDate = execution.ReinspectionDueDate,
            ReinspectionNote = execution.ReinspectionNote,
            ReportSubmittedAt = execution.ReportSubmittedAt,
            CheckinAt = execution.CheckinAt,
            CheckoutAt = execution.CheckoutAt,
            CountsTowardInspectionInterval = task.CountsTowardInspectionInterval
        };
    }

    private int GetOperatorRoleId()
    {
        // Default role ID for general users
        return 6;
    }

    private string GetOperatorName() => _currentUserService.UserName ?? _currentUserService.UserId ?? "System";

    private sealed record TaskTimelineHandlerSnapshot(string? TypeCode, string? UserId, string? UserName);

    private sealed record TaskTimelineCurrentOwnerSnapshot(string TypeCode, string? UserId, string? UserName, string Summary);


    private static string EscapeJson(string value) => value.Replace("\\", "\\\\").Replace("\"", "\\\"");

    // ── interface implementations ──────────────────────────────────────────────

    public async Task<SubmitInspectionReviewResponseDto> SubmitReportAsync(int taskId, InspectionTaskSubmitReportRequestDto request)
    {
        // Submit-report reads: ChecklistItems (+their violations, via CreateFromTaskReportAsync),
        // ContactPersons (EnsureFieldInspectionContactPersonReadyForReviewSubmit), Attachments
        // (RemoveAttachments), and Violations (existing-id diff + timeline). Narrow the aggregate load
        // instead of InspectionTaskIncludes.All, whose 9 AsSplitQuery SELECTs against the remote DB
        // were the dominant latency source (Inspectors/SeizedMaterials/TimelineEvents/OcrScanResults
        // are unused here; TimelineEvents in particular grows unbounded per task action).
        var (task, execution) = await RequireTaskForExecutionAsync(
            taskId,
            InspectionTaskIncludes.Execution
            | InspectionTaskIncludes.ChecklistItemsWithViolations
            | InspectionTaskIncludes.ContactPersons
            | InspectionTaskIncludes.Attachments
            | InspectionTaskIncludes.Violations)
            .ConfigureAwait(false);
        // Checkout (85) must run before submit-report (90): enforce the ordering server-side.
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.CheckOut);
        var now = DateTimeHelper.Now;

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        if (!task.ChecklistItems.Any())
        {
            throw new BusinessException("Inspection.Execution.ChecklistRequired", "");
        }

        if (task.InspectionMethodId != (int)InspectionMethod.DigitalInspection)
        {
            EnsureFieldInspectionContactPersonReadyForReviewSubmit(task);
        }

        execution.HasViolationFound = request.HasViolationFound;
        execution.NeedsReinspection = request.NeedsReinspection;
        execution.ReinspectionDueDate = request.ReinspectionDueDate;
        execution.ReinspectionNote = request.NeedsReinspection ? NormalizeOptional(request.ReinspectionNote) : null;
        execution.ReportSubmittedAt = now;
        execution.CurrentStepId = (int)InspectionExecutionStep.ReviewAndSubmit;
        TouchExecution(execution);

        // The inspection report PDF is generated asynchronously (background Task.Run below); its real
        // MinIO URL is persisted to InspectionTaskExecution.ReportFileUrl once the upload completes.
        // Do NOT write a placeholder/default report attachment URL here — only clear any stale report
        // attachment so the read side surfaces the real URL as soon as the background job reconciles it.
        RemoveAttachments(
        task,
        InspectionTaskAttachmentCategory.InspectionReport,
        InspectionTaskAttachmentRelatedEntityType.TaskExecution);

        // Mark task Completed here (moved from CheckoutAsync — checkout now runs before submit-report).
        var fromStatusId = task.StatusId;
        task.StatusId = (int)InspectionTaskStatus.Completed;
        task.CountsTowardInspectionInterval = true;
        TouchTask(task);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
 
        var existingViolationIds = task.Violations.Where(item => item.Id > 0).Select(item => item.Id).ToHashSet();
        var createdViolations = await _inspectionViolationDomainService
            .CreateFromTaskReportAsync(task, execution, _currentUserService.UserId, GetOperatorName())
            .ConfigureAwait(false);

        await EnsureDirectPendingPaymentPenaltyOrdersCreatedAsync(createdViolations).ConfigureAwait(false);
        await TrySendNewContentViolationNotificationsAsync(createdViolations, existingViolationIds).ConfigureAwait(false);
        await TryEnsureDigitTaskSignatureLinkAsync(task.Id, createdViolations.Count > 0).ConfigureAwait(false);

        await WriteTaskTimelineAsync(
            task.Id,
            "InspectionReportSubmitted",
            content: BuildInspectionCompletedTimelineContent(task, execution),
            fromStatusId: fromStatusId,
            toStatusId: task.StatusId,
            resultCode: execution.HasViolationFound == true ? "Violation Found"
                      : execution.HasViolationFound == false ? "Compliant"
                      : "Submitted",
            task: task).ConfigureAwait(false);

        await TriggerDigitalViolationNoticeAsync(task, createdViolations).ConfigureAwait(false);

        // PDF generation makes synchronous HTTP calls to the external render service (headless-browser
        // PDF generation is already backgrounded INSIDE each PDF service: both
        // ViolationReportPdfService.GenerateAndSaveAsync and
        // ViolationApprovalReportPdfService.GenerateAndSaveAsync run their heavy render + MinIO
        // upload on a dedicated DI scope via their own Task.Run, and persist the REAL ReportFileUrl
        // only after the upload succeeds (no placeholder/fake URL is ever written).
        // We therefore call them directly with the still-live request aggregate. The previous outer
        // Task.Run wrapper was redundant double-backgrounding, and its GetAggregateAsync(All) reload
        // was both wasteful and the likely reason the reports failed to generate.
        try
        {
            await _violationReportPdfService.GenerateAndSaveAsync(task, execution).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unexpected error queuing violation report PDF. taskId={TaskId}. The submission was already saved.",
                task.Id);
        }

        // For Licensing violations (ViolationTypeId == 1) generate the violation approval report —
        // these bypass manual committee approval, so no approval workflow will trigger it later.
        // Req 70: notifyCustomer:true emails the report by status (Warning Issued → CP-050,
        // Pending Payment → CP-051), both with the report attached.
        var licensingViolationIds = createdViolations
            .Where(v => v.ViolationTypeId == (int)InspectionViolationType.Licensing)
            .Select(v => v.Id)
            .ToList();
        foreach (var violationId in licensingViolationIds)
        {
            try
            {
                await _violationApprovalReportPdfService
                    .GenerateAndSaveAsync(violationId, ViolationReportFilterMode.CommitteeReview, notifyCustomer: true)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Unexpected error queuing violation approval report PDF for licensing violation. " +
                    "violationId={ViolationId}, taskId={TaskId}. The submission was already saved.",
                    violationId, task.Id);
            }
            }

            return new SubmitInspectionReviewResponseDto
        {
            TaskId = task.Id,
            Submitted = true,
            HasViolation = createdViolations.Count > 0,
            CreatedViolations = createdViolations
                .Select(x => new CreatedInspectionViolationSummaryDto
                {
                    ViolationId = x.Id,
                    ViolationNo = x.ViolationNo,
                    Type = x.ViolationTypeId == (int)InspectionViolationType.Content ? "ContentViolation" : "LicensingViolation"
                })
                .ToList()
        };
    }

    public async Task<InspectionExecutionSummaryDto> CheckoutAsync(int taskId, InspectionTaskCheckoutRequestDto request)
    {
        // Checkout only updates the execution row; it reads ContactPersons (EnsureStepAllowed) and
        // Violations (BuildInspectionCompletedTimelineContent). Narrow the aggregate load instead of
        // InspectionTaskIncludes.All, whose 9 AsSplitQuery SELECTs against the remote DB were the
        // dominant latency source (TimelineEvents/OcrScanResults/Attachments/etc. are unused here).
        var (task, execution) = await RequireTaskForExecutionAsync(
            taskId,
            InspectionTaskIncludes.Execution | InspectionTaskIncludes.ContactPersons | InspectionTaskIncludes.Violations)
            .ConfigureAwait(false);
        // Checkout now happens BEFORE submit-report, so only require checklist to be done.
        EnsureStepAllowed(task, execution, allowAccessFailedBranch: false, expectedMinStep: (int)InspectionExecutionStep.Checklist);
        var now = DateTimeHelper.Now;

        execution ??= await CreateExecutionAsync(taskId).ConfigureAwait(false);
        execution.CheckoutAt = now;
        execution.CheckoutLat = request.CheckOutLat;
        execution.CheckoutLng = request.CheckOutLng;
        execution.CheckoutAddress = request.CheckOutAddress;
        execution.CurrentStepId = (int)InspectionExecutionStep.CheckOut;
        TouchExecution(execution);

        // Task is NOT marked Completed here — submit-report (called after checkout) does that.

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(
            task.Id,
            "InspectionCheckedOut",
            content: BuildInspectionCompletedTimelineContent(task, execution),
            resultCode: "CheckedOut",
            locationText: ResolveLocationText(request.CheckOutAddress, request.CheckOutLat, request.CheckOutLng),
            task: task).ConfigureAwait(false);
        return MapSummary(task, execution);
    }

    // ── private helpers ────────────────────────────────────────────────────────
 
    private async Task TryEnsureDigitTaskSignatureLinkAsync(int taskId, bool hasViolation)
    {
        if (_signatureLinkProvisionService == null)
        {
            return;
        }
 
        try
        {
            await _signatureLinkProvisionService
                .EnsureDigitTaskSignatureLinkAsync(taskId, hasViolation)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unexpected error creating digit inspection task signature link. taskId={TaskId}. The submission was already saved.",
                taskId);
        }
    }
 
    private async Task<(InspectionTask task, InspectionTaskExecution? execution)> RequireTaskForExecutionAsync(
        int taskId,
        InspectionTaskIncludes includes = InspectionTaskIncludes.All)
    {
        var task = await _taskRepository.GetAggregateAsync(taskId, includes).ConfigureAwait(false);
        if (task == null)
        {
            throw new BusinessException("Inspection.Task.NotFound", "");
        }

        return (task, task.Execution);
    }

    private async Task EnsureDirectPendingPaymentPenaltyOrdersCreatedAsync(IReadOnlyList<InspectionViolation> violations)
    {
        if (violations.Count == 0)
        {
            return;
        }

        var candidateViolations = violations
            .Where(x => x.Id > 0
                        && x.ViolationTypeId == (int)InspectionViolationType.Licensing
                        && x.StatusId == (int)InspectionViolationStatus.PendingPayment)
            .ToList();

        if (candidateViolations.Count == 0)
        {
            return;
        }

        var violationIds = candidateViolations.Select(x => x.Id).Distinct().ToList();
        var existingViolationIds = await _dbContext.InspectionViolationPenaltyOrders
            .AsNoTracking()
            .Where(x => violationIds.Contains(x.ViolationId))
            .Select(x => x.ViolationId)
            .ToListAsync()
            .ConfigureAwait(false);

        var createdOrders = new List<InspectionViolationPenaltyOrder>();
        foreach (var violation in candidateViolations)
        {
            if (existingViolationIds.Contains(violation.Id))
            {
                continue;
            }

            if (violation.FineAmount <= 0m)
            {
                continue;
            }

            var orderTimestamp = violation.LastUpdatedOn == default
                ? (violation.CreatedOn == default ? DateTimeHelper.Now : violation.CreatedOn)
                : violation.LastUpdatedOn;

            var penaltyOrder = new InspectionViolationPenaltyOrder
            {
                ViolationId = violation.Id,
                ViolationNo = violation.ViolationNo,
                TotalAmount = violation.FineAmount,
                Currency = "AED",
                StatusId = (int)InspectionViolationPenaltyOrderStatus.PendingPayment,
                PendingTransactionId = null,
                EngineCorrelationId = null,
                CalculatedAt = orderTimestamp,
                CreatedAt = orderTimestamp,
                PaidAt = null,
                RawEngineResponseJson = null,
                CreatedBy = violation.UpdatedBy ?? violation.CreatedBy ?? _currentUserService.UserId,
                UpdatedAt = null,
                UpdatedBy = null
            };

            await _dbContext.InspectionViolationPenaltyOrders.AddAsync(penaltyOrder).ConfigureAwait(false);
            createdOrders.Add(penaltyOrder);
        }

        if (createdOrders.Count > 0)
        {
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
            foreach (var order in createdOrders)
            {
                LogPenaltyOrderCreated(order);
            }
        }
    }

    private void LogPenaltyOrderCreated(InspectionViolationPenaltyOrder order)
    {
        _auditLogger?.LogChange(
            "InspectionPenaltyOrderCreate",
            null,
            new
            {
                penaltyOrderId = order.PenaltyOrderId,
                violationId = order.ViolationId,
                violationNo = order.ViolationNo,
                totalAmount = order.TotalAmount,
                currency = order.Currency,
                statusId = order.StatusId,
                orderStatus = order.OrderStatus,
                calculatedAt = order.CalculatedAt,
                createdAt = order.CreatedAt,
                createdBy = order.CreatedBy
            });
    }


    private static void EnsureFieldInspection(InspectionTask task)
    {
        if (task.InspectionMethodId == (int)InspectionMethod.DigitalInspection)
        {
            throw new BusinessException("Inspection.Execution.DigitalStepNotSupported", "");
        }
    }

    private static void ValidateFieldInspectionContactPersonRequest(SaveInspectionTaskContactPersonRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonNameRequired", "");
        }

        if (string.IsNullOrWhiteSpace(request.Position))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonPositionRequired", "");
        }

        if (string.IsNullOrWhiteSpace(request.Mobile))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonMobileRequired", "");
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonEmailRequired", "");
        }

        if (string.IsNullOrWhiteSpace(request.EmiratesId))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonEmiratesIdRequired", "");
        }

        if (string.IsNullOrWhiteSpace(request.EidAttachmentFileName) || string.IsNullOrWhiteSpace(request.EidAttachmentFileUrl))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonEidAttachmentRequired", "");
        }
    }

    private static void ValidateFieldInspectionContactPersonDeclarationRequest(SaveInspectionTaskContactPersonDeclarationRequestDto request)
    {
        if (request.HasSignedDeclaration &&
            (string.IsNullOrWhiteSpace(request.SignatureImageFileName) || string.IsNullOrWhiteSpace(request.SignatureImageFileUrl)))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonSignatureRequired", "");
        }

        if (!request.HasSignedDeclaration && string.IsNullOrWhiteSpace(request.DeclarationDeclinedReason))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonDeclineReasonRequired", "");
        }
    }

    private static void EnsureFieldInspectionContactPersonReadyForReviewSubmit(InspectionTask task)
    {
        var contactPerson = task.ContactPersons
            .OrderByDescending(x => x.SubmittedOn ?? x.CreatedOn)
            .FirstOrDefault();

        if (contactPerson == null)
        {
            throw new BusinessException("Inspection.Execution.ContactPersonRequired", "");
        }

        if (string.IsNullOrWhiteSpace(contactPerson.FullName))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonNameRequired", "");
        }

        if (string.IsNullOrWhiteSpace(contactPerson.Position))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonPositionRequired", "");
        }

        if (string.IsNullOrWhiteSpace(contactPerson.Mobile))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonMobileRequired", "");
        }

        if (string.IsNullOrWhiteSpace(contactPerson.Email))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonEmailRequired", "");
        }

        if (string.IsNullOrWhiteSpace(contactPerson.EmiratesId))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonEmiratesIdRequired", "");
        }

        if (string.IsNullOrWhiteSpace(contactPerson.EidAttachmentFileName) || string.IsNullOrWhiteSpace(contactPerson.EidAttachmentFileUrl))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonEidAttachmentRequired", "");
        }

        if (!contactPerson.HasSignedDeclaration.HasValue)
        {
            throw new BusinessException("Inspection.Execution.ContactPersonDeclarationSelectionRequired", "");
        }

        if (contactPerson.HasSignedDeclaration == true &&
            (string.IsNullOrWhiteSpace(contactPerson.SignatureImageFileName) || string.IsNullOrWhiteSpace(contactPerson.SignatureImageFileUrl)))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonSignatureRequired", "");
        }

        if (contactPerson.HasSignedDeclaration == false && string.IsNullOrWhiteSpace(contactPerson.DeclarationDeclinedReason))
        {
            throw new BusinessException("Inspection.Execution.ContactPersonDeclineReasonRequired", "");
        }
    }

    // ── Permission and role check helpers ──────────────────────────────────────

    /// <summary>
    /// Checks if current user is a Manager (departmentId=6 and isLeader=true)
    /// </summary>
    private async Task<bool> IsManagerAsync()
    {
        // Check if user is in department 6 and is a leader
        if (_currentUserService.DepartmentId != 6)
        {
            return false;
        }

        var userId = _currentUserService.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return false;
        }

        // Check if user is a leader in department 6
        var isLeader = await _dbContext.UserDepartments
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.DepartmentId == 6 && x.IsLeader == true)
            .AnyAsync()
            .ConfigureAwait(false);

        return isLeader;
    }

    /// <summary>
    /// Checks if current user has Content permission
    /// </summary>
    private async Task<bool> IsContentUserAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationContent")
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Checks if current user has Committee permission
    /// </summary>
    private async Task<bool> IsCommitteeUserAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationDecide")
            .ConfigureAwait(false);
    }

}

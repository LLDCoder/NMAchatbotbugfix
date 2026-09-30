using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Text;
using Microsoft.Extensions.Logging;
using NanoidDotNet;
using UMC.AdminPortal.Application.Dtos.Inspection;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Application;
using UMC.AdminPortal.Domain.Models.Core;
using UMC.AdminPortal.Application.Services.Inspection;
using UMC.AdminPortal.Application.Services.InspectionAI;
using UMC.AdminPortal.Application.Services.InspectionDeclaration;
using UMC.AdminPortal.Application.Services.InspectionTasks.Notification;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Models.License;
using UMC.AdminPortal.Domain.Models.Lookup;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Infrastructure;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Module.Attributes;

namespace UMC.AdminPortal.Application.Services.InspectionTasks;

[InjectOnScoped]
public class InspectionTaskAppService : IInspectionTaskAppService
{
    private sealed class InspectionTaskReadProjection
    {
        public int TaskId { get; set; }
        public string TaskNo { get; set; } = string.Empty;
        public int TargetTypeId { get; set; }
        public int SourceTypeId { get; set; }
        public int InspectionMethodId { get; set; }
        public int StatusId { get; set; }
        public int? ActivityId { get; set; }
        public string? ActivityName { get; set; }
        public int? EstablishmentId { get; set; }
        public string? EstablishmentName { get; set; }
        public int? IndividualId { get; set; }
        public string? FullName { get; set; }
        public int? EstablishmentTypeId { get; set; }
        public string? EstablishmentTypeName { get; set; }
        public int? InspectionReasonId { get; set; }
        public string? InspectionReasonName { get; set; }
        public int? PriorityId { get; set; }
        public string? PriorityName { get; set; }
        public int? EmirateId { get; set; }
        public string? EmirateName { get; set; }
        public int? AuthorityId { get; set; }
        public string? AuthorityName { get; set; }
        public int? RegionId { get; set; }
        public string? RegionName { get; set; }
        public int? CommunityId { get; set; }
        public string? CommunityName { get; set; }
        public DateTime DueDate { get; set; }
        public DateTime? AssignedOn { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime LastUpdatedOn { get; set; }
        public DateTime? ReportSubmittedAt { get; set; }
        public DateTime? CheckoutAt { get; set; }
        public string? CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public string? InspectorName { get; set; }
        public bool HasInspectors { get; set; }
        public bool CountsTowardInspectionInterval { get; set; }
        public string? TargetName { get; set; }
        public string? AccountOwnerName { get; set; }
    }

    private sealed class AccessFailedReadProjection
    {
        public string? AccessOutcomeCode { get; init; }
        public string? AccessOutcomeName { get; init; }
        public string? AccessFailedReasonCode { get; init; }
        public string? AccessFailedReasonName { get; init; }
        public string? AccessFailedRemark { get; init; }
        public List<InspectionAttachmentDto> Attachments { get; init; } = new();
        public bool IsMock { get; init; }
    }


    private sealed class TargetOverviewProfileProjection
    {
        public int ProfileId { get; init; }
        public string? UserId { get; init; }
        public short UserTypeId { get; init; }
        public string? UserTypeCode { get; init; }
    }

    private sealed record ActivityBasedEstablishmentMatch(
        int EstablishmentId,
        int ActivityId,
        string? EstablishmentName,
        int? EstablishmentTypeId,
        string? TradeLicenseNumber,
        string? Email,
        string? Mobile,
        int? EmirateId,
        int? AuthorityId,
        int? RegionId,
        int? CommunityId,
        string? AreaStreet,
        double? Latitude,
        double? Longitude);

    private readonly AdminPortalDBContext _dbContext;
    private readonly IInspectionTaskRepository _taskRepository;
    private readonly IBaseRepository<InspectionTaskInspector> _taskInspectorRepository;
    private readonly IBaseRepository<InspectionTaskAttachment> _taskAttachmentRepository;
    private readonly IBaseRepository<InspectionTaskTimelineEvent> _taskTimelineRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly IInspectionDeclarationLinkService? _inspectionDeclarationLinkService;
    private readonly IInspectionAiAppService? _inspectionAiAppService;
    private readonly ILogger<InspectionTaskAppService>? _logger;
    private readonly IInspectionTaskNotificationService? _notificationService;

    private sealed record TaskCreationResult(int TaskId, int CreatedTimelineEventId, int? AssignedTimelineEventId);

    public InspectionTaskAppService(
        AdminPortalDBContext dbContext,
        IInspectionTaskRepository taskRepository,
        IBaseRepository<InspectionTaskInspector> taskInspectorRepository,
        IBaseRepository<InspectionTaskAttachment> taskAttachmentRepository,
        IBaseRepository<InspectionTaskTimelineEvent> taskTimelineRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService)
        : this(
            dbContext,
            taskRepository,
            taskInspectorRepository,
            taskAttachmentRepository,
            taskTimelineRepository,
            unitOfWork,
            currentUserService,
            null)
    {
    }

    public InspectionTaskAppService(
        AdminPortalDBContext dbContext,
        IInspectionTaskRepository taskRepository,
        IBaseRepository<InspectionTaskInspector> taskInspectorRepository,
        IBaseRepository<InspectionTaskAttachment> taskAttachmentRepository,
        IBaseRepository<InspectionTaskTimelineEvent> taskTimelineRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IInspectionDeclarationLinkService? inspectionDeclarationLinkService,
        IInspectionAiAppService? inspectionAiAppService = null,
        ILogger<InspectionTaskAppService>? logger = null,
        IInspectionTaskNotificationService? notificationService = null)
    {
        _dbContext = dbContext;
        _taskRepository = taskRepository;
        _taskInspectorRepository = taskInspectorRepository;
        _taskAttachmentRepository = taskAttachmentRepository;
        _taskTimelineRepository = taskTimelineRepository;
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _inspectionDeclarationLinkService = inspectionDeclarationLinkService;
        _inspectionAiAppService = inspectionAiAppService;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task<InspectionTaskListResponseDto> GetListAsync(InspectionTaskListRequestDto request)
    {
        var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
        var pageSize = request.PageSize <= 0 ? 20 : request.PageSize;
        var query = BuildTaskListQuery(request, applyScopeFilter: true);
        query = ApplySorting(query, request.SortBy, request.SortDirection);

        var totalCount = await query.CountAsync().ConfigureAwait(false);
        var items = await BuildPagedTaskListItemsAsync(query, pageIndex, pageSize).ConfigureAwait(false);

        if (!string.Equals(request.Scope, "todo", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var item in items)
            {
                item.CancelView = null;
            }
        }

        return new InspectionTaskListResponseDto
        {
            Items = items,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<InspectionTaskByTargetResponseDto> GetByTargetAsync(InspectionTaskByTargetRequestDto request, bool bypassDataScope = false)
    {
        ArgumentNullException.ThrowIfNull(request);
        request = await ResolveTaskByTargetRequestAsync(request).ConfigureAwait(false);
        ValidateTaskTargetScope(request.EstablishmentId, request.IndividualId);

        var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
        var pageSize = request.PageSize <= 0 ? 20 : request.PageSize;

        var listQuery = BuildTaskByTargetQuery(request, applyScopeFilter: true, bypassDataScope: bypassDataScope);
        listQuery = ApplySorting(listQuery, request.SortBy, request.SortDirection);

        var totalCount = await listQuery.CountAsync().ConfigureAwait(false);
        var items = await BuildPagedTaskListItemsAsync(listQuery, pageIndex, pageSize).ConfigureAwait(false);

        var countsByStatus = await BuildTaskByTargetQuery(request, applyScopeFilter: false, bypassDataScope: bypassDataScope)
            .GroupBy(x => x.StatusId)
            .Select(group => new
            {
                StatusId = group.Key,
                Count = group.Count()
            })
            .ToDictionaryAsync(x => x.StatusId, x => x.Count)
            .ConfigureAwait(false);

        return new InspectionTaskByTargetResponseDto
        {
            Items = items,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount,
            Statuses = BuildTaskStatusStats(countsByStatus)
        };
    }

    public async Task<IReadOnlyList<InspectionLookupStringValueDto>> GetCreatedByOptionsAsync(InspectionTaskListRequestDto request)
    {
        var lookupRequest = BuildCreatedByLookupRequest(request);
        var createdByValues = await BuildTaskListQuery(lookupRequest, applyScopeFilter: true)
            .Where(x => x.CreatedBy != null && x.CreatedBy.Trim() != string.Empty)
            .Select(x => x.CreatedBy!)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync()
            .ConfigureAwait(false);

        if (createdByValues.Count == 0)
        {
            return Array.Empty<InspectionLookupStringValueDto>();
        }

        var userMatches = await _dbContext.Users
            .AsNoTracking()
            .Where(x => createdByValues.Contains(x.Id) || createdByValues.Contains(x.UserName))
            .Select(x => new
            {
                x.Id,
                x.UserName,
                x.FirstName,
                x.LastName,
                x.Email
            })
            .ToListAsync()
            .ConfigureAwait(false);

        var adminUserMatches = await _dbContext.AdminUsers
            .AsNoTracking()
            .Where(x => createdByValues.Contains(x.Id) || createdByValues.Contains(x.UserName))
            .Select(x => new
            {
                x.Id,
                x.UserName,
                x.FirstName,
                x.LastName,
                x.Email
            })
            .ToListAsync()
            .ConfigureAwait(false);

        var displayNameByRawValue = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var user in userMatches)
        {
            var displayName = BuildResolvedUserDisplayName(user.FirstName, user.LastName, user.UserName, user.Email, user.Id);
            displayNameByRawValue[user.Id] = displayName;
            displayNameByRawValue[user.UserName] = displayName;
        }

        foreach (var adminUser in adminUserMatches)
        {
            var displayName = BuildResolvedUserDisplayName(adminUser.FirstName, adminUser.LastName, adminUser.UserName, adminUser.Email, adminUser.Id);
            if (!displayNameByRawValue.ContainsKey(adminUser.Id))
            {
                displayNameByRawValue[adminUser.Id] = displayName;
            }

            if (!displayNameByRawValue.ContainsKey(adminUser.UserName))
            {
                displayNameByRawValue[adminUser.UserName] = displayName;
            }
        }

        return createdByValues
            .Select(rawValue => new InspectionLookupStringValueDto
            {
                Id = rawValue,
                NameEn = displayNameByRawValue.TryGetValue(rawValue, out var displayName) ? displayName : rawValue,
                NameAr = displayNameByRawValue.TryGetValue(rawValue, out displayName) ? displayName : rawValue
            })
            .ToList();
    }

    public async Task<InspectionTaskListStatsDto> GetStatsAsync(InspectionTaskListRequestDto request)
    {
        var baseQuery = BuildTaskListQuery(request, applyScopeFilter: false);
        var countsByStatus = await baseQuery
            .GroupBy(x => x.StatusId)
            .Select(group => new
            {
                StatusId = group.Key,
                Count = group.Count()
            })
            .ToDictionaryAsync(x => x.StatusId, x => x.Count)
            .ConfigureAwait(false);

        var statuses = BuildTaskStatusStats(countsByStatus);

        var queuedCount = countsByStatus.TryGetValue((int)InspectionTaskStatus.Queued, out var queued) ? queued : 0;
        var pendingVisitCount = countsByStatus.TryGetValue((int)InspectionTaskStatus.PendingVisit, out var pendingVisit) ? pendingVisit : 0;
        var inProgressCount = countsByStatus.TryGetValue((int)InspectionTaskStatus.InProgress, out var inProgress) ? inProgress : 0;
        var accessFailedCount = countsByStatus.TryGetValue((int)InspectionTaskStatus.AccessFailed, out var accessFailed) ? accessFailed : 0;
        var completedCount = countsByStatus.TryGetValue((int)InspectionTaskStatus.Completed, out var completed) ? completed : 0;
        var cancelledCount = countsByStatus.TryGetValue((int)InspectionTaskStatus.Cancelled, out var cancelled) ? cancelled : 0;

        return new InspectionTaskListStatsDto
        {
            TodoCount = await ApplyScopeFilter(baseQuery, "todo").CountAsync().ConfigureAwait(false),
            CompletedCount = completedCount,
            QueuedCount = queuedCount,
            PendingVisitCount = pendingVisitCount,
            InProgressCount = inProgressCount,
            AccessFailedCount = accessFailedCount,
            CancelledCount = cancelledCount,
            Statuses = statuses,
            // Derived from the GroupBy result above — avoids a separate CountAsync() round-trip.
            TeamCount = countsByStatus.Values.Sum(),
            IsMock = false
        };
    }

    private async Task<List<InspectionTaskListItemDto>> BuildPagedTaskListItemsAsync(IQueryable<InspectionTask> query, int pageIndex, int pageSize)
    {
        var rawItems = await query
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new InspectionTaskReadProjection
            {
                TaskId = x.Id,
                TaskNo = x.TaskNo,
                TargetTypeId = x.TargetTypeId,
                SourceTypeId = x.SourceTypeId,
                InspectionMethodId = x.InspectionMethodId,
                StatusId = x.StatusId,
                ActivityId = x.ActivityId,
                ActivityName = null,
                EstablishmentId = x.EstablishmentId,
                EstablishmentName = x.EstablishmentName,
                IndividualId = x.IndividualId,
                FullName = x.FullName,
                EstablishmentTypeId = x.EstablishmentTypeId,
                EstablishmentTypeName = null,
                InspectionReasonId = x.InspectionReasonId,
                InspectionReasonName = null,
                EmirateId = x.EmirateId,
                EmirateName = null,
                AuthorityId = x.AuthorityId,
                AuthorityName = null,
                RegionId = x.RegionId,
                RegionName = null,
                CommunityId = x.CommunityId,
                CommunityName = null,
                PriorityId = x.PriorityId,
                PriorityName = null,
                DueDate = x.DueDate,
                AssignedOn = x.AssignedOn,
                CreatedOn = x.CreatedOn,
                LastUpdatedOn = x.LastUpdatedOn,
                ReportSubmittedAt = x.Execution != null ? x.Execution.ReportSubmittedAt : null,
                CheckoutAt = x.Execution != null ? x.Execution.CheckoutAt : null,
                CreatedBy = x.CreatedBy,
                InspectorName = x.Inspectors
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.AssignedOn)
                    .Select(i => i.InspectorName ?? i.InspectorId)
                    .FirstOrDefault(),
                HasInspectors = x.Inspectors.Any(),
                CountsTowardInspectionInterval = x.CountsTowardInspectionInterval
            })
            .ToListAsync()
            .ConfigureAwait(false);

        await ResolveTaskReadNamesAsync(rawItems, resolveEstablishmentTypeNames: false).ConfigureAwait(false);
        await ResolveCreatedByUserNamesAsync(rawItems).ConfigureAwait(false);

        return rawItems
            .Select(x => new InspectionTaskListItemDto
            {
                Id = x.TaskId,
                TaskNo = x.TaskNo,
                TargetTypeId = x.TargetTypeId,
                TargetTypeCode = MapTargetTypeCode(x.TargetTypeId),
                TargetTypeName = MapTargetTypeName(x.TargetTypeId),
                TargetName = x.TargetName,
                InspectionMethodId = x.InspectionMethodId,
                InspectionMethodCode = MapInspectionMethodCode(x.InspectionMethodId),
                InspectionMethodName = MapInspectionMethodName(x.InspectionMethodId),
                StatusId = x.StatusId,
                StatusCode = MapTaskStatusCode(x.StatusId),
                StatusName = MapTaskStatusNameLocalized(x.StatusId),
                ActivityName = x.ActivityName,
                EstablishmentName = x.EstablishmentName,
                FullName = x.FullName,
                InspectionReasonName = x.InspectionReasonName,
                EmirateName = x.EmirateName,
                AuthorityName = x.AuthorityName,
                PriorityName = x.PriorityName,
                DueDate = x.DueDate,
                AssignedOn = x.AssignedOn,
                Sla = BuildTaskListSlaSummary(x, _currentUserService.IsArabicLanguage),
                CreatedOn = x.CreatedOn,
                LastUpdatedOn = x.LastUpdatedOn,
                CreatedByName = x.CreatedByName,
                InspectorName = x.InspectorName,
                AssignmentState = x.HasInspectors ? "Assigned" : "Unassigned",
                ScopeCode = ResolveTaskScopeCode(x.StatusId, x.HasInspectors),
                CountsTowardInspectionInterval = x.CountsTowardInspectionInterval,
                CancelView = ShouldShowTaskCancelView(x.SourceTypeId, x.CreatedBy),
                IsMock = false
            })
            .ToList();
    }

    private static List<InspectionTaskStatusStatDto> BuildTaskStatusStats(IReadOnlyDictionary<int, int> countsByStatus)
    {
        var orderedStatuses = new[]
        {
            InspectionTaskStatus.Queued,
            InspectionTaskStatus.PendingVisit,
            InspectionTaskStatus.InProgress,
            InspectionTaskStatus.AccessFailed,
            InspectionTaskStatus.Completed,
            InspectionTaskStatus.Cancelled
        };

        return orderedStatuses
            .Select(status => new InspectionTaskStatusStatDto
            {
                StatusId = (int)status,
                StatusCode = MapTaskStatusCode((int)status),
                StatusName = MapTaskStatusName((int)status),
                Count = countsByStatus.TryGetValue((int)status, out var count) ? count : 0
            })
            .ToList();
    }

    public async Task<int?> ResolveTaskIdAsync(string idOrTaskNo)
    {
        if (int.TryParse(idOrTaskNo, out var numericId))
            return numericId;

        return await _dbContext.InspectionTasks
            .AsNoTracking()
            .Where(x => x.TaskNo == idOrTaskNo)
            .Select(x => (int?)x.Id)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);
    }

    public async Task<InspectionTaskDetailDto?> GetDetailAsync(int id)
    {
        var task = await _taskRepository.GetDetailAggregateAsync(id).ConfigureAwait(false);

        return task == null ? null : await BuildTaskDetailAsync(task).ConfigureAwait(false);
    }

    public async Task<InspectionTaskLastInspectionDto?> GetLastInspectionAsync(int id)
    {
        var task = await _taskRepository.GetAggregateAsync(id,
            InspectionTaskIncludes.Inspectors | InspectionTaskIncludes.Execution | InspectionTaskIncludes.Violations,
            asNoTracking: true).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        IQueryable<InspectionTask> query = ApplyTaskDataScope(_dbContext.InspectionTasks.AsNoTracking());
        if (task.EstablishmentId.HasValue)
        {
            var establishmentId = task.EstablishmentId.Value;
            query = query.Where(x => x.EstablishmentId == establishmentId);
        }
        else if (task.IndividualId.HasValue)
        {
            var individualId = task.IndividualId.Value;
            query = query.Where(x => x.IndividualId == individualId);
        }
        else
        {
            return null;
        }

        query = query.Where(x => x.Id != task.Id
                                 && x.StatusId == (int)InspectionTaskStatus.Completed
                                 && (x.LastUpdatedOn < task.LastUpdatedOn
                                     || (x.LastUpdatedOn == task.LastUpdatedOn && x.Id < task.Id)));

        var lastTask = await query
            .Select(x => new
            {
                x.Id,
                x.LastUpdatedOn,
                x.TaskNo,
                Inspector = x.Inspectors
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.AssignedOn)
                    .Select(i => i.InspectorName ?? i.InspectorId)
                    .FirstOrDefault(),
                CompletionTime = x.Execution != null
                    ? x.Execution.ReportSubmittedAt ?? x.Execution.CheckoutAt
                    : null,
                ViolationNo = x.Violations
                    .OrderByDescending(v => v.CreatedOn)
                    .ThenByDescending(v => v.Id)
                    .Select(v => v.ViolationNo)
                    .FirstOrDefault(),
                CheckinAt = x.Execution != null ? x.Execution.CheckinAt : (DateTime?)null,
                HasViolationFound = x.Execution != null ? x.Execution.HasViolationFound : (bool?)null,
            })
            .OrderByDescending(x => x.LastUpdatedOn)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (lastTask == null)
            return null;

        // Load LicensePermitCurrentStatus for the CURRENT task's establishment
        string? licensePermitCurrentStatus = null;
        if (task.EstablishmentId.HasValue)
        {
            licensePermitCurrentStatus = await _dbContext.LicensePermitIndexRecords
                .AsNoTracking()
                .Where(x => x.EstablishmentId == task.EstablishmentId.Value)
                .Select(x => x.CurrentStatus)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
        }

        return new InspectionTaskLastInspectionDto
        {
            TaskNumber            = lastTask.TaskNo,
            Inspector             = lastTask.Inspector,
            CompletionTime        = lastTask.CompletionTime,
            ViolationNo           = lastTask.ViolationNo,
            CheckinAt             = lastTask.CheckinAt,
            HasViolationFound     = lastTask.HasViolationFound,
            LicensePermitCurrentStatus = licensePermitCurrentStatus,
        };
    }

    public async Task<InspectionTaskReinspectionLookupDto?> GetReinspectionTaskAsync(int id)
    {
        var task = await _taskRepository.GetAggregateAsync(id,
            InspectionTaskIncludes.Inspectors,
            asNoTracking: true).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(task.TaskNo))
        {
            return null;
        }

        var taskNo = task.TaskNo.Trim();
        return await ApplyTaskDataScope(_dbContext.InspectionTasks.AsNoTracking())
            .Where(x => x.Id != task.Id && x.ReinspectionNo == taskNo)
            .Select(x => new
            {
                x.Id,
                x.CreatedOn,
                x.TaskNo,
                x.DueDate,
                Inspector = x.Inspectors
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.AssignedOn)
                    .Select(i => i.InspectorName ?? i.InspectorId)
                    .FirstOrDefault(),
                Status = MapTaskStatusName(x.StatusId)
            })
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .Select(x => new InspectionTaskReinspectionLookupDto
            {
                TaskNumber = x.TaskNo,
                DueDate = x.DueDate,
                Inspector = x.Inspector,
                Status = x.Status
            })
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);
    }

    public async Task<InspectionTaskDigitalPresenceDto?> GetDigitalPresenceAsync(int id)
    {
        var task = await _taskRepository.GetAggregateAsync(id,
            InspectionTaskIncludes.None,
            asNoTracking: true).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        return await BuildDigitalPresenceAsync(task).ConfigureAwait(false);
    }

    public async Task<InspectionTaskTargetOverviewLimitedDto?> GetTargetOverviewAsync(int id)
    {
        var task = await _taskRepository.GetAggregateAsync(id,
            InspectionTaskIncludes.None,
            asNoTracking: true).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        return await BuildTargetOverviewAsync(task).ConfigureAwait(false);
    }

    public async Task<InspectionTaskReportDto?> GetReportAsync(int id)
    {
        var task = await _taskRepository.GetReportAggregateAsync(id).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        return await BuildReportAsync(task).ConfigureAwait(false);
    }

    public async Task<InspectionTaskExecutionResultDto?> GetExecutionResultAsync(int id)
    {
        var task = await _taskRepository.GetAggregateAsync(id,
            InspectionTaskIncludes.Execution | InspectionTaskIncludes.Violations
            | InspectionTaskIncludes.ViolationDeclarationAttachments | InspectionTaskIncludes.ContactPersons,
            asNoTracking: true).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        // violationAttachmentsPreloaded: GetAggregateAsync included ViolationDeclarationAttachments —
        // skips the separate InspectionViolationAttachments DB round-trip.
        var declarationDocuments = await BuildTaskDeclarationDocumentsAsync(task, violationAttachmentsPreloaded: true).ConfigureAwait(false);
        return await BuildExecutionResultAsync(task, declarationDocuments).ConfigureAwait(false);
    }

    public async Task<InspectionTaskValidationResponseDto> ValidateAsync(CreateInspectionTaskRequestDto request)
    {
        var response = new InspectionTaskValidationResponseDto();

        if (request.DueDate == default)
        {
            response.BlockingErrors.Add(new InspectionTaskValidationWarningDto
            {
                Code = "DueDateRequired",
                Message = "Due date is required.",
                IsMock = false
            });
            return response;
        }

        var recentTasks = await FindRecentTasksAsync(request).ConfigureAwait(false);
        response.RecentTasks = recentTasks;
        if (recentTasks.Count > 0)
        {
            response.Warnings.Add(new InspectionTaskValidationWarningDto
            {
                Code = "RecentInspectionWithin90Days",
                Message = "A related inspection task exists within the last 90 days.",
                IsMock = false
            });
        }

        return response;
    }

    public async Task<InspectionChecklistTemplateResponseDto?> GetChecklistTemplateAsync(int id)
    {
        var task = await _taskRepository.GetAggregateAsync(id,
            InspectionTaskIncludes.ChecklistItemsWithViolations,
            asNoTracking: true).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }


        var resolvedTask = await ResolveTaskReadNamesAsync(task).ConfigureAwait(false);
        var contentType = ResolveContentType(task, resolvedTask);
        var templateRows = await InspectionChecklistTemplateCatalogReader
            .GetItemsAsync(_dbContext, visibleOnly: true)
            .ConfigureAwait(false);

        if (templateRows.Count == 0)
        {
            return BuildFallbackChecklistTemplate(task, contentType);
        }

        var lookupKeys = templateRows
            .Where(x => !string.IsNullOrWhiteSpace(x.ChecklistCode))
            .Select(x => InspectionPenaltyStandardLookupReader.CreateKey(x.ViolationTypeId, x.ChecklistCode))
            .Distinct()
            .ToList();
        var penaltyStandardsByKey = lookupKeys.Count == 0
            ? new Dictionary<InspectionPenaltyStandardLookupKey, InspectionPenaltyRule>()
            : new Dictionary<InspectionPenaltyStandardLookupKey, InspectionPenaltyRule>(
                await InspectionPenaltyStandardLookupReader
                    .GetByTypeAndChecklistCodesAsync(_dbContext, lookupKeys)
                    .ConfigureAwait(false));

        var savedChecklistItemsByCode = task.ChecklistItems
            .GroupBy(x => x.ChecklistCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(x => x.RecordedAt).ThenByDescending(x => x.Id).First(),
                StringComparer.OrdinalIgnoreCase);

        var templateItemIdByStoredId = BuildTemplateItemIdByStoredIdMap(templateRows);

        var resultOptions = GetChecklistResultOptions();

        var items = templateRows
            .Select(row =>
            {
                savedChecklistItemsByCode.TryGetValue(row.ChecklistCode, out var savedItem);
                penaltyStandardsByKey.TryGetValue(
                    InspectionPenaltyStandardLookupReader.CreateKey(row.ViolationTypeId, row.ChecklistCode),
                    out var penaltyStandard);

                var mappedViolationItems = row.ViolationItemId.HasValue
                    ? new List<InspectionViolationItemLookupDto>
                    {
                        new()
                        {
                            Id = row.TemplateItemId,
                            LegacyViolationItemId = row.LegacyViolationItemId,
                            Code = row.EffectiveViolationCode,
                            ViolationTypeId = row.ViolationTypeId,
                            ViolationTypeCode = row.ViolationTypeId == 1 ? "LicensingViolation" : row.ViolationTypeId == 2 ? "ContentViolation" : $"ViolationType{row.ViolationTypeId}",
                            NameEn = row.EffectiveNameEn,
                            NameAr = row.EffectiveNameAr,
                            FineDay1To30 = penaltyStandard?.FineDay1To30 ?? 0m,
                            FineDay31To90 = penaltyStandard?.FineDay31To90 ?? 0m,
                            FineMax = penaltyStandard?.FineMax ?? 0m,
                            IsActive = row.IsActive,
                            DisplayOrder = row.DisplayOrder,
                            ApplicableTemplateTypes = row.ApplicableTemplateTypes.ToList()
                        }
                    }
                    : new List<InspectionViolationItemLookupDto>();

                return new InspectionChecklistTemplateItemDto
                {
                    Id = row.Id,
                    ChecklistCode = row.ChecklistCode,
                    ViolationDescription = row.ViolationDescription,
                    ChecklistName = row.ChecklistName,
                    ViolationItemId = row.TemplateItemId,
                    LegacyViolationItemId = row.LegacyViolationItemId,
                    ViolationItemCode = row.EffectiveViolationCode,
                    ViolationTypeId = row.ViolationTypeId,
                    ViolationTypeCode = MapViolationTypeCode(row.ViolationTypeId),
                    DisplayOrder = row.DisplayOrder,
                    IsVisibleInChecklist = row.IsVisibleInChecklist,
                    IsActive = row.IsActive,
                    RequiredWhenViolation = row.RequiredWhenViolation,
                    IsSystemTriggered = row.IsSystemTriggered,
                    ApplicableTemplateTypes = row.ApplicableTemplateTypes.ToList(),
                    MappedViolationCodes = new List<string> { row.EffectiveViolationCode },
                    ResultOptions = resultOptions,
                    MappedViolationItems = mappedViolationItems,
                    SavedResult = savedItem?.ResultId,
                    SavedNotes = savedItem?.Notes,
                    SavedSelectedViolationItemIds = savedItem?.Violations
                        .Select(x => NormalizeTemplateItemId(x.ViolationItemId, templateItemIdByStoredId))
                        .Distinct()
                        .OrderBy(x => x)
                        .ToList() ?? new List<int>()
                };
            })
            .ToList();

        return new InspectionChecklistTemplateResponseDto
        {
            TaskId = task.Id,
            ContentType = contentType,
            TargetTypeId = task.TargetTypeId,
            InspectionMethodId = task.InspectionMethodId,
            TemplateType = "AllChecklistItems",
            TemplateSource = "Inspection checklist database (full list)",
            Items = items
        };
    }

    private static Dictionary<int, int> BuildTemplateItemIdByStoredIdMap(IEnumerable<InspectionChecklistTemplateCatalogReadModel> templateRows)
    {
        var map = new Dictionary<int, int>();

        foreach (var row in templateRows)
        {
            map[row.TemplateItemId] = row.TemplateItemId;
            if (row.LegacyViolationItemId.HasValue)
            {
                map[row.LegacyViolationItemId.Value] = row.TemplateItemId;
            }
        }

        return map;
    }

    private static int NormalizeTemplateItemId(int storedId, IReadOnlyDictionary<int, int> templateItemIdByStoredId)
        => templateItemIdByStoredId.TryGetValue(storedId, out var normalizedId)
            ? normalizedId
            : storedId;

    public async Task<int> CreateAsync(CreateInspectionTaskRequestDto request)
    {
        var shouldNotifyInspectionLeaders = IsInteractiveInspectorSelfSubmission(request);
        var creation = await CreateTaskCoreAsync(
            request,
            enforcePermissions: true,
            forceQueuedWithoutInspectors: false,
            actorUserId: null,
            actorUserName: null).ConfigureAwait(false);

        await SendCreationNotificationsAsync(creation).ConfigureAwait(false);
        if (shouldNotifyInspectionLeaders)
        {
            var submittedTimelineEventId = await WriteInspectorTaskSubmittedTimelineAsync(creation.TaskId).ConfigureAwait(false);
            await TrySendTaskNotificationAsync(creation.TaskId, submittedTimelineEventId).ConfigureAwait(false);
        }
        await TryCreateRiskProfileForTaskAsync(creation.TaskId, request).ConfigureAwait(false);
        return creation.TaskId;
    }

    private async Task TryCreateRiskProfileForTaskAsync(int taskId, CreateInspectionTaskRequestDto request)
    {
        if (_inspectionAiAppService == null)
        {
            return;
        }

        var riskProfileRequest = BuildRiskProfileRequest(request);
        if (riskProfileRequest == null)
        {
            return;
        }

        try
        {
            var response = await _inspectionAiAppService.GetRiskProfileAsync(riskProfileRequest).ConfigureAwait(false);
            if (response.Code < 200 || response.Code >= 300 || response.Data == null)
            {
                _logger?.LogWarning(
                    "Inspection AI risk-profile returned non-success response while creating task {TaskId}. Code={Code}, Message={Message}",
                    taskId,
                    response.Code,
                    response.Message);
                return;
            }

            await SaveRiskProfileAsync(taskId, response.Data.RiskProfile).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to create Inspection AI risk profile for task {TaskId}.", taskId);
        }
    }

    private static InspectionAiRiskProfileRequestDto? BuildRiskProfileRequest(CreateInspectionTaskRequestDto request)
    {
        if (request.EstablishmentId is > 0)
        {
            return new InspectionAiRiskProfileRequestDto
            {
                TargetType = "ESTABLISHMENT",
                EstablishmentId = request.EstablishmentId
            };
        }

        if (request.IndividualId is > 0)
        {
            return new InspectionAiRiskProfileRequestDto
            {
                TargetType = "INDIVIDUAL",
                IndividualId = request.IndividualId
            };
        }

        return null;
    }

    private async Task SaveRiskProfileAsync(int taskId, InspectionAiGeneratedRiskProfileDto riskProfile)
    {
        var now = DateTimeHelper.Now;
        var riskLevel = string.IsNullOrWhiteSpace(riskProfile.RiskLevel)
            ? ResolveAiRiskLevel(riskProfile.RiskScore)
            : riskProfile.RiskLevel;

        var profile = new InspectionTaskRiskProfile
        {
            TaskId = taskId,
            RiskScore = riskProfile.RiskScore,
            RiskLevel = riskLevel,
            RiskDescription = "AI generated risk profile.",
            LastAssessmentDate = riskProfile.LastAssessmentDate ?? now,
            CreatedOn = now,
            LastUpdatedOn = now,
            CreatedBy = _currentUserService.UserId,
            UpdatedBy = _currentUserService.UserId,
            RiskFactors = riskProfile.RiskFactors.Select(f => new InspectionTaskRiskFactor
            {
                FactorType = f.FactorType,
                FactorNameEn = f.FactorNameEn,
                FactorNameAr = f.FactorNameAr,
                ContributionScore = f.ContributionScore,
                Details = f.Details,
                CreatedOn = now,
                LastUpdatedOn = now,
                CreatedBy = _currentUserService.UserId,
                UpdatedBy = _currentUserService.UserId
            }).ToList()
        };

        _dbContext.InspectionTaskRiskProfiles.Add(profile);
        await _dbContext.SaveChangesAsync().ConfigureAwait(false);
    }

    private static int ResolveTaskTargetTypeId(CreateInspectionTaskRequestDto request)
        => request.TargetTypeId == (int)InspectionTargetType.Individual || request.IndividualId is > 0
            ? (int)InspectionTargetType.Individual
            : (int)InspectionTargetType.Establishment;

    private static string ResolveAiRiskLevel(int score) => score switch
    {
        >= 90 => "CRITICAL",
        >= 70 => "HIGH",
        >= 40 => "MEDIUM",
        _ => "LOW"
    };

    public async Task<BatchCreateInspectionTaskResponseDto> CreateBatchByActivityAsync(BatchCreateInspectionTaskByActivityRequestDto request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.TargetTypeId == (int)InspectionTargetType.Individual || request.IndividualId is > 0)
        {
            throw new BusinessException("Inspection.Task.BatchCreateEstablishmentOnly", "");
        }

        var normalizedActivityIds = await NormalizeBatchActivityIdsAsync(request.ActivityIds).ConfigureAwait(false);

        //EnsureCanCreateTask(BuildBatchPermissionProbeRequest(request, normalizedActivityIds[0]));

        var establishments = await ResolveActivityBasedEstablishmentsAsync(
            normalizedActivityIds,
            request.EmirateId,
            request.AuthorityId).ConfigureAwait(false);

        if (establishments.Count == 0)
        {
            return new BatchCreateInspectionTaskResponseDto
            {
                ActivityIds = normalizedActivityIds,
                MatchedEstablishmentCount = 0,
                CreatedCount = 0
            };
        }

        IDbContextTransaction? transaction = null;
        if (_dbContext.Database.IsRelational())
        {
            transaction = await _dbContext.Database.BeginTransactionAsync().ConfigureAwait(false);
        }

        try
        {
            var createdTaskIds = new List<int>(establishments.Count);
            var creationResults = new List<TaskCreationResult>(establishments.Count);
            foreach (var establishment in establishments)
            {
                var batchRequest = BuildActivityBatchTaskRequest(request, establishment);
                var creation = await CreateTaskCoreAsync(
                    batchRequest,
                    enforcePermissions: false,
                    forceQueuedWithoutInspectors: true,
                    actorUserId: null,
                    actorUserName: null).ConfigureAwait(false);
                createdTaskIds.Add(creation.TaskId);
                creationResults.Add(creation);
            }

            if (transaction != null)
            {
                await transaction.CommitAsync().ConfigureAwait(false);
            }

            foreach (var creation in creationResults)
            {
                await SendCreationNotificationsAsync(creation).ConfigureAwait(false);
            }

            var items = await LoadBatchCreatedTaskItemsAsync(createdTaskIds).ConfigureAwait(false);
            return new BatchCreateInspectionTaskResponseDto
            {
                ActivityIds = normalizedActivityIds,
                MatchedEstablishmentCount = establishments.Count,
                CreatedCount = items.Count,
                MatchedEstablishmentIds = establishments.Select(x => x.EstablishmentId).ToList(),
                Items = items
            };
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync().ConfigureAwait(false);
            }

            throw;
        }
        finally
        {
            if (transaction != null)
            {
                await transaction.DisposeAsync().ConfigureAwait(false);
            }
        }
    }

    public async Task<int> CreateAutomatedQueuedTaskAsync(CreateInspectionTaskRequestDto request, string createdByUserId, string createdByUserName)
    {
        var creation = await CreateTaskCoreAsync(
                request,
                enforcePermissions: false,
                forceQueuedWithoutInspectors: true,
                actorUserId: createdByUserId,
                actorUserName: createdByUserName)
            .ConfigureAwait(false);
        await SendCreationNotificationsAsync(creation).ConfigureAwait(false);
        return creation.TaskId;
    }

    public async Task<int> CreateAutomatedScheduledTaskAsync(CreateInspectionTaskRequestDto request, string createdByUserId, string createdByUserName)
    {
        ArgumentNullException.ThrowIfNull(request);

        var normalizedActivity = await NormalizeActivityAsync(
            request.ActivityId,
            request.TargetTypeId,
            request.SourceTypeId).ConfigureAwait(false);

        var task = await CreateTaskEntityAsync(
            request,
            normalizedActivity.ActivityId,
            forceQueuedWithoutInspectors: request.Inspectors == null || request.Inspectors.Count == 0,
            actorUserId: createdByUserId,
            actorUserName: createdByUserName).ConfigureAwait(false);

        ApplyTaskCurrentOwnerSnapshot(task);
        await _taskRepository.AddAsync(task).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        if (request.Inspectors is { Count: > 0 })
        {
            await ReplaceTaskInspectorsAsync(task, request.Inspectors, DateTimeHelper.Now)
                .ConfigureAwait(false);

            ApplyTaskCurrentOwnerSnapshot(task);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        }

        return task.Id;
    }

    private async Task<TaskCreationResult> CreateTaskCoreAsync(
        CreateInspectionTaskRequestDto request,
        bool enforcePermissions,
        bool forceQueuedWithoutInspectors,
        string? actorUserId,
        string? actorUserName)
    {
        ArgumentNullException.ThrowIfNull(request);

        /*if (enforcePermissions)
        {
            EnsureCanCreateTask(request);
        }
        else
        {
            ValidateTaskAttachments(request.Attachments);
        }*/

        var normalizedActivity = await NormalizeActivityAsync(
            request.ActivityId,
            request.TargetTypeId,
            request.SourceTypeId).ConfigureAwait(false);

        var now = DateTimeHelper.Now;
        var effectiveActorUserId = NormalizeOptional(actorUserId) ?? _currentUserService.UserId;
        var effectiveActorUserName = NormalizeOptional(actorUserName) ?? await GetOperatorNameAsync().ConfigureAwait(false);
        var effectiveInspectors = forceQueuedWithoutInspectors ? null : request.Inspectors;
        var hasInlineInspectors = effectiveInspectors is { Count: > 0 };
        var timelineActorTypeCode = forceQueuedWithoutInspectors ? "System" : null;
        int? timelineActorRoleId = forceQueuedWithoutInspectors ? 6 : null;
        var task = await CreateTaskEntityAsync(
            request,
            normalizedActivity.ActivityId,
            forceQueuedWithoutInspectors,
            effectiveActorUserId,
            effectiveActorUserName).ConfigureAwait(false);

        if (request.InspectionReasonId == (int)InspectionReason.CorrectiveActionReinspection)
        {
            task.ReinspectionNo = await ResolveReinspectionNoByTargetAsync(request.EstablishmentId, request.IndividualId).ConfigureAwait(false);
        }

        await _taskRepository.AddAsync(task).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        if (effectiveInspectors != null)
        {
            await ReplaceTaskInspectorsAsync(task, effectiveInspectors, now).ConfigureAwait(false);
        }

        if (request.Attachments != null)
        {
            await ReplaceTaskAttachmentsAsync(task, request.Attachments).ConfigureAwait(false);
        }

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        var primaryInspectorId = hasInlineInspectors ? effectiveInspectors!.First(x => x.IsPrimary).InspectorId : null;
        var taskCreatedTimelineOn = task.CreatedOn;
        var createdTimelineEventId = await WriteTaskTimelineAsync(
            task.Id,
            "TaskCreated",
            content: BuildTaskCreatedTimelineContent(task.TaskNo, effectiveActorUserName),
            toStatusId: -1,
            createdOn: taskCreatedTimelineOn,
            targetHandlerUserId: primaryInspectorId,
            actorTypeCode: timelineActorTypeCode,
            actorUserId: effectiveActorUserId,
            actorUserName: effectiveActorUserName,
            actorRoleId: timelineActorRoleId,
            taskEntity: task).ConfigureAwait(false);

        var shouldWriteQueuedTimeline = ShouldWriteQueuedTimeline(task.SourceTypeId);
        if (shouldWriteQueuedTimeline)
        {
            await WriteTaskTimelineAsync(
                task.Id,
                "TaskQueued",
                content: BuildTaskQueuedTimelineContent(),
                toStatusId: (int)InspectionTaskStatus.Queued,
                createdOn: taskCreatedTimelineOn.AddSeconds(1),
                actorTypeCode: timelineActorTypeCode,
                actorUserId: effectiveActorUserId,
                actorUserName: effectiveActorUserName,
                actorRoleId: timelineActorRoleId,
                taskEntity: task).ConfigureAwait(false);
        }

        int? assignedTimelineEventId = null;
        if (hasInlineInspectors)
        {
            var primary = effectiveInspectors!.First(x => x.IsPrimary);
            assignedTimelineEventId = await WriteTaskTimelineAsync(
                task.Id,
                "TaskAssigned",
                content: BuildAssignmentTimelineContent(effectiveInspectors!, isReassigned: false),
                fromStatusId: (int)InspectionTaskStatus.Queued,
                toStatusId: task.StatusId,
                eventCode: "TaskAssigned",
                targetHandlerUserId: primary.InspectorId,
                createdOn: taskCreatedTimelineOn.AddSeconds(shouldWriteQueuedTimeline ? 2 : 1),
                taskEntity: task).ConfigureAwait(false);
        }

        return new TaskCreationResult(task.Id, createdTimelineEventId, assignedTimelineEventId);
    }

    /// <summary>
    /// Returns the coordinate pair only when it is usable, otherwise (null, null).
    ///
    /// Unlike a profile save, a bad coordinate must not block task creation: the address text is what the
    /// task is really about, and existing behaviour already lets a task be created with no address data at
    /// all. A rejected pair degrades to null, which the caller renders as "no pin" exactly like the
    /// existing tasks that predate this column.
    /// </summary>
    private (double? Latitude, double? Longitude) SanitizeTaskCoordinates(double? latitude, double? longitude, string context)
    {
        if (latitude is null && longitude is null)
        {
            return (null, null);
        }

        if (latitude is null || longitude is null)
        {
            _logger.LogWarning("Dropping inspection task coordinates for {Context}: latitude and longitude must be provided together.", context);
            return (null, null);
        }

        var lat = latitude.Value;
        var lng = longitude.Value;

        if (double.IsNaN(lat) || double.IsInfinity(lat) || lat < -90d || lat > 90d
            || double.IsNaN(lng) || double.IsInfinity(lng) || lng < -180d || lng > 180d)
        {
            _logger.LogWarning("Dropping out-of-range inspection task coordinates for {Context}.", context);
            return (null, null);
        }

        // 0,0 is in range but is the default of a non-nullable double/FLOAT, so it means "never assigned".
        if (lat == 0d && lng == 0d)
        {
            _logger.LogWarning("Dropping 0,0 inspection task coordinates for {Context}.", context);
            return (null, null);
        }

        return (lat, lng);
    }

    public async Task<bool> ExistsByOuterIdAsync(int outerId)
    {
        if (outerId <= 0)
        {
            return false;
        }

        return await _dbContext.InspectionTasks
            .AsNoTracking()
            .AnyAsync(x => x.OuterId == outerId)
            .ConfigureAwait(false);
    }

    private async Task<InspectionTask> CreateTaskEntityAsync(
        CreateInspectionTaskRequestDto request,
        int? normalizedActivityId,
        bool forceQueuedWithoutInspectors,
        string? actorUserId,
        string? actorUserName)
    {
        var now = DateTimeHelper.Now;
        var effectiveActorUserId = NormalizeOptional(actorUserId) ?? _currentUserService.UserId;
        var effectiveInspectors = forceQueuedWithoutInspectors ? null : request.Inspectors;
        var hasInlineInspectors = effectiveInspectors is { Count: > 0 };
        var (latitude, longitude) = SanitizeTaskCoordinates(request.Latitude, request.Longitude, "task creation");

        return new InspectionTask
        {
        OuterId = request.OuterId,
        TaskNo = await GenerateTaskNoAsync().ConfigureAwait(false),
            TargetTypeId = ResolveTaskTargetTypeId(request),
            SourceTypeId = request.SourceTypeId,
            InspectionMethodId = request.InspectionMethodId,
            ActivityId = normalizedActivityId,
            EstablishmentId = request.EstablishmentId,
            IndividualId = request.IndividualId,
            EstablishmentTypeId = request.EstablishmentTypeId,
            EstablishmentName = request.EstablishmentName,
            TradeLicenseNumber = request.TradeLicenseNumber,
            FullName = request.FullName,
            // Normalize new task writes so future exact-match filters do not depend on client formatting.
            EmiratesId = EmiratesIdLookupHelper.NormalizeForStorage(request.EmiratesId),
            Email = request.Email,
            Mobile = request.Mobile,
            MobileCountryCode = request.MobileCountryCode,
            MobileLocalNumber = request.MobileLocalNumber,
            InspectionReasonId = request.InspectionReasonId,
            PriorityId = request.PriorityId,
            EmirateId = request.EmirateId,
            AuthorityId = request.AuthorityId,
            RegionId = request.RegionId,
            CommunityId = request.CommunityId,
            AreaStreet = request.AreaStreet,
            Latitude = latitude,
            Longitude = longitude,
            DueDate = request.DueDate,
            Remarks = request.Remarks,
            StatusId = hasInlineInspectors ? (int)InspectionTaskStatus.PendingVisit : (int)InspectionTaskStatus.Queued,
            CountsTowardInspectionInterval = false,
            AssignedOn = hasInlineInspectors ? now : null,
            CreatedOn = now,
            LastUpdatedOn = now,
            CreatedBy = effectiveActorUserId,
            UpdatedBy = effectiveActorUserId,
            CurrentOwnerTypeCode = hasInlineInspectors ? null : "Queue",
            CurrentOwnerUserId = null,
            CurrentOwnerUserName = null,
            CurrentOwnerSummary = hasInlineInspectors ? null : "Queue"
        };
    }

    /// <summary>
    /// When InspectionReasonId is CorrectiveActionReinspection, look up the most recent previous task
    /// for the same establishment or individual and return its TaskNo as the ReinspectionNo.
    /// Returns null if no previous task is found.
    /// </summary>
    private async Task<string?> ResolveReinspectionNoByTargetAsync(int? establishmentId, int? individualId)
    {
        IQueryable<InspectionTask> query = _dbContext.InspectionTasks.AsNoTracking();

        if (establishmentId.HasValue && establishmentId.Value > 0)
        {
            var id = establishmentId.Value;
            query = query.Where(x => x.EstablishmentId == id);
        }
        else if (individualId.HasValue && individualId.Value > 0)
        {
            var id = individualId.Value;
            query = query.Where(x => x.IndividualId == id);
        }
        else
        {
            return null;
        }

        return await query
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .Select(x => x.TaskNo)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);
    }

    public async Task EditAsync(int id, EditInspectionTaskRequestDto request)
    {

        var normalizedActivity = await NormalizeActivityAsync(
            request.ActivityId,
            request.TargetTypeId,
            request.SourceTypeId).ConfigureAwait(false);

        var task = await RequireTaskAsync(id).ConfigureAwait(false);
        EnsureTaskEditable(task);
        var originalStatusId = task.StatusId;
        var previousInspectors = task.Inspectors
            .Select(x => new InspectionTaskInspector
            {
                InspectorId = x.InspectorId,
                InspectorName = x.InspectorName,
                IsPrimary = x.IsPrimary,
                AssignedOn = x.AssignedOn
            })
            .ToList();
        var previousPrimaryInspector = ResolvePrimaryInspector(previousInspectors);
        var originalTargetName = FirstNonEmpty(task.EstablishmentName, task.FullName);
        var originalPriorityId = task.PriorityId;
        var originalDueDate = task.DueDate;

        task.TargetTypeId = request.TargetTypeId;
        task.SourceTypeId = request.SourceTypeId;
        task.InspectionMethodId = request.InspectionMethodId;
        task.ActivityId = normalizedActivity.ActivityId;
        task.EstablishmentId = request.EstablishmentId;
        task.IndividualId = request.IndividualId;
        task.EstablishmentTypeId = request.EstablishmentTypeId;
        task.EstablishmentName = request.EstablishmentName;
        task.TradeLicenseNumber = request.TradeLicenseNumber;
        task.FullName = request.FullName;
        task.EmiratesId = EmiratesIdLookupHelper.NormalizeForStorage(request.EmiratesId);
        task.Email = request.Email;
        task.Mobile = request.Mobile;
        task.MobileCountryCode = request.MobileCountryCode;
        task.MobileLocalNumber = request.MobileLocalNumber;
        task.InspectionReasonId = request.InspectionReasonId;
        task.PriorityId = request.PriorityId;
        task.EmirateId = request.EmirateId;
        task.AuthorityId = request.AuthorityId;
        task.RegionId = request.RegionId;
        task.CommunityId = request.CommunityId;
        task.AreaStreet = request.AreaStreet;
        (task.Latitude, task.Longitude) = SanitizeTaskCoordinates(request.Latitude, request.Longitude, $"task {task.Id} edit");
        task.DueDate = request.DueDate;
        task.Remarks = request.Remarks;
        var now = DateTimeHelper.Now;

        if (request.Inspectors != null)
        {
            await ReplaceTaskInspectorsAsync(task, request.Inspectors, now).ConfigureAwait(false);
        }

        if (request.Attachments != null)
        {
            await ReplaceTaskAttachmentsAsync(task, request.Attachments).ConfigureAwait(false);
        }

        TouchTask(task);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        await WriteTaskTimelineAsync(task.Id, "TaskEdited", content: $"Task {task.TaskNo} updated by {await GetOperatorNameAsync().ConfigureAwait(false)}.", fromStatusId: originalStatusId, toStatusId: task.StatusId, taskEntity: task).ConfigureAwait(false);

        var updatedFields = BuildImportantUpdatedFields(
            originalTargetName,
            FirstNonEmpty(task.EstablishmentName, task.FullName),
            originalPriorityId,
            task.PriorityId,
            originalDueDate,
            task.DueDate);
        var primaryInspector = task.Inspectors
            .OrderByDescending(inspector => inspector.IsPrimary)
            .ThenBy(inspector => inspector.Id)
            .FirstOrDefault();
        if (updatedFields.Count > 0 && primaryInspector != null)
        {
            var importantDetailsTimelineEventId = await WriteTaskTimelineAsync(
                task.Id,
                "TaskEdited",
                content: $"Important task details updated: {string.Join(", ", updatedFields)}.",
                fromStatusId: originalStatusId,
                toStatusId: task.StatusId,
                eventCode: "ImportantDetailsUpdated",
                targetHandlerUserId: primaryInspector.InspectorId,
                targetHandlerUserName: primaryInspector.InspectorName,
                reasonText: string.Join(", ", updatedFields),
                taskEntity: task).ConfigureAwait(false);
            await TrySendTaskNotificationAsync(task.Id, importantDetailsTimelineEventId).ConfigureAwait(false);
        }

        if (request.Inspectors != null)
        {
            if (request.Inspectors.Count == 0)
            {
                await WriteTaskTimelineAsync(
                    task.Id,
                    "TaskUnassigned",
                    content: BuildTaskUnassignedTimelineContent(previousInspectors),
                    fromStatusId: originalStatusId,
                    toStatusId: task.StatusId,
                    taskEntity: task).ConfigureAwait(false);
            }
            else
            {
                var primary = request.Inspectors.First(x => x.IsPrimary);
                var assignmentEventCode = ResolveAssignmentEventCode(previousInspectors, request.Inspectors);
                var addedInspectors = assignmentEventCode is "TaskReassigned" or "TaskAssignmentUpdated"
                    ? ResolveAddedInspectors(previousInspectors, request.Inspectors)
                    : [];
                var assignmentTimelineEventId = await WriteTaskTimelineAsync(
                    task.Id,
                    "TaskAssigned",
                    content: BuildAssignmentTimelineContent(request.Inspectors!, assignmentEventCode == "TaskReassigned"),
                    fromStatusId: originalStatusId,
                    toStatusId: task.StatusId,
                    eventCode: assignmentEventCode,
                    targetHandlerUserId: primary.InspectorId,
                    previousPrimaryInspectorUserId: assignmentEventCode == "TaskReassigned" ? previousPrimaryInspector?.InspectorId : null,
                    previousPrimaryInspectorUserName: assignmentEventCode == "TaskReassigned" ? previousPrimaryInspector?.InspectorName : null,
                    taskEntity: task).ConfigureAwait(false);
                await AddTaskTimelineRecipientSnapshotsAsync(assignmentTimelineEventId, addedInspectors).ConfigureAwait(false);
                await TrySendTaskNotificationAsync(task.Id, assignmentTimelineEventId).ConfigureAwait(false);
            }
        }
    }

    public async Task CancelAsync(int id, CancelInspectionTaskRequestDto request)
    {

        if (string.IsNullOrWhiteSpace(request.CancelReason))
        {
            throw new BusinessException("Inspection.Task.CancelReasonRequired", "");
        }

        var task = await RequireTaskAsync(id).ConfigureAwait(false);
        EnsureTaskEditable(task);
        var originalStatusId = task.StatusId;
        var primaryInspector = ResolvePrimaryInspector(task.Inspectors);

        task.StatusId = (int)InspectionTaskStatus.Cancelled;
        task.CancelReason = request.CancelReason.Trim();
        TouchTask(task);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        var cancelledTimelineEventId = await WriteTaskTimelineAsync(
            task.Id,
            "TaskCancelled",
            content: BuildTaskCancelledTimelineContent(task.CancelReason),
            fromStatusId: originalStatusId,
            toStatusId: task.StatusId,
            targetHandlerUserId: primaryInspector?.InspectorId,
            targetHandlerUserName: primaryInspector?.InspectorName,
            reasonText: NormalizeOptional(task.CancelReason),
            taskEntity: task).ConfigureAwait(false);
        if (primaryInspector != null)
        {
            await TrySendTaskNotificationAsync(task.Id, cancelledTimelineEventId).ConfigureAwait(false);
        }
    }

    public async Task<int> DuplicateAsync(int id, DuplicateInspectionTaskRequestDto request)
    {

        var sourceTask = await RequireTaskAsync(id).ConfigureAwait(false);
        var now = DateTimeHelper.Now;
        var duplicatedTask = new InspectionTask
        {
            TaskNo = await GenerateTaskNoAsync().ConfigureAwait(false),
            TargetTypeId = sourceTask.TargetTypeId,
            ActivityId = sourceTask.ActivityId,
            EstablishmentId = sourceTask.EstablishmentId,
            IndividualId = sourceTask.IndividualId,
            EstablishmentTypeId = sourceTask.EstablishmentTypeId,
            EmirateId = sourceTask.EmirateId,
            AuthorityId = sourceTask.AuthorityId,
            RegionId = sourceTask.RegionId,
            CommunityId = sourceTask.CommunityId,
            AreaStreet = sourceTask.AreaStreet,
            Latitude = sourceTask.Latitude,
            Longitude = sourceTask.Longitude,
            TradeLicenseNumber = sourceTask.TradeLicenseNumber,
            EstablishmentName = sourceTask.EstablishmentName,
            EmiratesId = sourceTask.EmiratesId,
            FullName = sourceTask.FullName,
            Email = sourceTask.Email,
            Mobile = sourceTask.Mobile,
            InspectionReasonId = sourceTask.InspectionReasonId,
            PriorityId = sourceTask.PriorityId,
            InspectionMethodId = sourceTask.InspectionMethodId,
            DueDate = request.DueDate?.Date ?? sourceTask.DueDate,
            SourceTypeId = sourceTask.SourceTypeId,
            StatusId = request.CopyAssignments && sourceTask.Inspectors.Count > 0
                ? (int)InspectionTaskStatus.PendingVisit
                : (int)InspectionTaskStatus.Queued,
            CountsTowardInspectionInterval = false,
            RelatedTaskId = sourceTask.Id,
            Remarks = sourceTask.Remarks,
            CreatedOn = now,
            LastUpdatedOn = now,
            CreatedBy = _currentUserService.UserId,
            UpdatedBy = _currentUserService.UserId
        };

        await _taskRepository.AddAsync(duplicatedTask).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

        var hasCopiedAssignments = request.CopyAssignments && sourceTask.Inspectors.Count > 0;
        if (hasCopiedAssignments)
        {
            var assignedOn = DateTimeHelper.Now;
            foreach (var inspector in sourceTask.Inspectors)
            {
                await _taskInspectorRepository.AddAsync(new InspectionTaskInspector
                {
                    TaskId = duplicatedTask.Id,
                    InspectorId = inspector.InspectorId,
                    InspectorName = inspector.InspectorName,
                    IsPrimary = inspector.IsPrimary,
                    AssignedOn = assignedOn,
                    CreatedOn = assignedOn,
                    LastUpdatedOn = assignedOn,
                    CreatedBy = _currentUserService.UserId,
                    UpdatedBy = _currentUserService.UserId
                }).ConfigureAwait(false);
            }

            duplicatedTask.AssignedOn = assignedOn;
            TouchTask(duplicatedTask, assignedOn);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
            }

            var sourceTaskAttachments = sourceTask.Attachments
            .Where(x => InspectionTaskAttachmentCategory.TaskAttachment.Matches(x.AttachmentCategory)
              && InspectionTaskAttachmentRelatedEntityType.Task.Matches(x.RelatedEntityType))
            .ToList();
            if (sourceTaskAttachments.Count > 0)
            {
            var attachmentCopiedOn = DateTimeHelper.Now;
            foreach (var sourceAttachment in sourceTaskAttachments)
            {
             await _taskAttachmentRepository.AddAsync(new InspectionTaskAttachment
             {
             TaskId = duplicatedTask.Id,
             RelatedEntityType = sourceAttachment.RelatedEntityType,
             RelatedEntityId = duplicatedTask.Id,
             RelatedEntityCode = sourceAttachment.RelatedEntityCode,
             AttachmentCategory = sourceAttachment.AttachmentCategory,
             FileName = sourceAttachment.FileName,
             FileUrl = sourceAttachment.FileUrl,
             ContentType = sourceAttachment.ContentType,
             UploadedBy = _currentUserService.UserId,
             UploadedAt = attachmentCopiedOn,
             CreatedOn = attachmentCopiedOn,
             LastUpdatedOn = attachmentCopiedOn,
             CreatedBy = _currentUserService.UserId,
             UpdatedBy = _currentUserService.UserId
             }).ConfigureAwait(false);
            }

            TouchTask(duplicatedTask, attachmentCopiedOn);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
            }

            var duplicatedPrimaryInspector = hasCopiedAssignments
            ? sourceTask.Inspectors.FirstOrDefault(x => x.IsPrimary) ?? sourceTask.Inspectors.FirstOrDefault()
            : null;
        var duplicatedTaskCreatedTimelineOn = duplicatedTask.CreatedOn;

        var duplicatedCreatedTimelineEventId = await WriteTaskTimelineAsync(
            duplicatedTask.Id,
            "TaskCreated",
            content: BuildTaskCreatedTimelineContent(duplicatedTask.TaskNo, await GetOperatorNameAsync().ConfigureAwait(false)),
            toStatusId: -1,
            createdOn: duplicatedTaskCreatedTimelineOn,
            targetHandlerUserId: duplicatedPrimaryInspector?.InspectorId,
            taskEntity: duplicatedTask).ConfigureAwait(false);

        var shouldWriteDuplicatedQueuedTimeline = ShouldWriteQueuedTimeline(duplicatedTask.SourceTypeId);
        if (shouldWriteDuplicatedQueuedTimeline)
        {
            await WriteTaskTimelineAsync(
                duplicatedTask.Id,
                "TaskQueued",
                content: BuildTaskQueuedTimelineContent(),
                toStatusId: (int)InspectionTaskStatus.Queued,
                createdOn: duplicatedTaskCreatedTimelineOn.AddSeconds(1),
                taskEntity: duplicatedTask).ConfigureAwait(false);
        }

        await TrySendTaskNotificationAsync(duplicatedTask.Id, duplicatedCreatedTimelineEventId).ConfigureAwait(false);

        if (hasCopiedAssignments)
        {
            var assignmentTimelineEventId = await WriteTaskTimelineAsync(
                duplicatedTask.Id,
                "TaskAssigned",
                content: BuildAssignmentTimelineContent(sourceTask.Inspectors.Select(x => new AssignInspectionTaskItemDto
                {
                    InspectorId = x.InspectorId,
                    InspectorName = x.InspectorName,
                    IsPrimary = x.IsPrimary
                }).ToList(), isReassigned: false),
                fromStatusId: (int)InspectionTaskStatus.Queued,
                toStatusId: duplicatedTask.StatusId,
                eventCode: "TaskAssigned",
                targetHandlerUserId: duplicatedPrimaryInspector?.InspectorId,
                createdOn: duplicatedTaskCreatedTimelineOn.AddSeconds(shouldWriteDuplicatedQueuedTimeline ? 2 : 1),
                taskEntity: duplicatedTask).ConfigureAwait(false);
            await TrySendTaskNotificationAsync(duplicatedTask.Id, assignmentTimelineEventId).ConfigureAwait(false);
        }

        return duplicatedTask.Id;
    }

    public async Task AssignAsync(int id, AssignInspectionTaskRequestDto request)
    {
        await AssignInternalAsync(new[] { id }, request).ConfigureAwait(false);
    }

    public async Task BatchAssignAsync(BatchAssignInspectionTaskRequestDto request)
    {
        if (request.TaskIds == null || request.TaskIds.Count == 0)
        {
            throw new BusinessException("Inspection.Task.BatchAssignRequiresTasks", "");
        }

        await AssignInternalAsync(request.TaskIds, new AssignInspectionTaskRequestDto
        {
            Inspectors = request.Inspectors
        }).ConfigureAwait(false);
    }

    public async Task<List<InspectionTaskTimelineItemDto>> GetTimelineAsync(int id)
    {
        var task = await RequireTaskAsync(id,
            InspectionTaskIncludes.TimelineEvents | InspectionTaskIncludes.Attachments,
            asNoTracking: true).ConfigureAwait(false);

        var items = BuildProjectedTimeline(task);

        // For AccessFailed events (toStatusId == 3), attach AccessFailedEvidence attachments.
        var accessFailedAttachments = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.AccessFailedEvidence.Matches(x.AttachmentCategory))
            .OrderByDescending(x => x.UploadedAt)
            .ThenByDescending(x => x.Id)
            .Select(MapAttachment)
            .ToList();

        if (accessFailedAttachments.Count > 0)
        {
            foreach (var item in items.Where(x => x.ToStatusId == (int)InspectionTaskStatus.AccessFailed))
                item.Attachments = accessFailedAttachments;
        }

        return items;
    }

    public Task<byte[]> ExportAsync(InspectionTaskListRequestDto request)
    {
        return ExportInternalAsync(request);
    }

    private async Task<byte[]> ExportInternalAsync(InspectionTaskListRequestDto request)
    {
        var query = BuildTaskListQuery(request, applyScopeFilter: true);
        query = ApplySorting(query, request.SortBy, request.SortDirection);

        var rawRows = await query
            .Select(x => new InspectionTaskReadProjection
            {
                TaskNo = x.TaskNo,
                TargetTypeId = x.TargetTypeId,
                InspectionMethodId = x.InspectionMethodId,
                StatusId = x.StatusId,
                ActivityId = x.ActivityId,
                ActivityName = null,
                EstablishmentId = x.EstablishmentId,
                EstablishmentName = x.EstablishmentName,
                IndividualId = x.IndividualId,
                FullName = x.FullName,
                InspectionReasonId = x.InspectionReasonId,
                InspectionReasonName = null,
                EmirateId = x.EmirateId,
                EmirateName = null,
                AuthorityId = x.AuthorityId,
                AuthorityName = null,
                PriorityId = x.PriorityId,
                PriorityName = null,
                DueDate = x.DueDate,
                AssignedOn = x.AssignedOn,
                CreatedOn = x.CreatedOn,
                LastUpdatedOn = x.LastUpdatedOn,
                ReportSubmittedAt = x.Execution != null ? x.Execution.ReportSubmittedAt : null,
                CheckoutAt = x.Execution != null ? x.Execution.CheckoutAt : null,
                CreatedBy = x.CreatedBy,
                InspectorName = x.Inspectors.OrderByDescending(i => i.IsPrimary).Select(i => i.InspectorName ?? i.InspectorId).FirstOrDefault(),
                HasInspectors = x.Inspectors.Any(),
                CountsTowardInspectionInterval = x.CountsTowardInspectionInterval
            })
            .ToListAsync()
            .ConfigureAwait(false);

        await ResolveTaskReadNamesAsync(rawRows).ConfigureAwait(false);
        await ResolveCreatedByUserNamesAsync(rawRows).ConfigureAwait(false);

        var rows = rawRows.Select(x => new InspectionTaskListItemDto
        {
            TaskNo = x.TaskNo,
            TargetTypeId = x.TargetTypeId,
            TargetTypeCode = MapTargetTypeCode(x.TargetTypeId),
            TargetTypeName = MapTargetTypeName(x.TargetTypeId),
            TargetName = x.TargetName,
            InspectionMethodId = x.InspectionMethodId,
            InspectionMethodCode = MapInspectionMethodCode(x.InspectionMethodId),
            InspectionMethodName = MapInspectionMethodName(x.InspectionMethodId),
            StatusId = x.StatusId,
            StatusCode = MapTaskStatusCode(x.StatusId),
            StatusName = MapTaskStatusNameLocalized(x.StatusId),
            ActivityName = x.ActivityName,
            EstablishmentName = x.EstablishmentName,
            FullName = x.FullName,
            InspectionReasonName = x.InspectionReasonName,
            EmirateName = x.EmirateName,
            AuthorityName = x.AuthorityName,
            PriorityName = x.PriorityName,
            DueDate = x.DueDate,
            AssignedOn = x.AssignedOn,
            Sla = BuildTaskListSlaSummary(x, _currentUserService.IsArabicLanguage),
            CreatedOn = x.CreatedOn,
            LastUpdatedOn = x.LastUpdatedOn,
            CreatedByName = x.CreatedByName,
            InspectorName = x.InspectorName,
            AssignmentState = x.HasInspectors ? "Assigned" : "Unassigned",
            ScopeCode = ResolveTaskScopeCode(x.StatusId, x.HasInspectors),
            CountsTowardInspectionInterval = x.CountsTowardInspectionInterval
        }).ToList();

        // Completed scope shows "Last Update"; every other scope (Todo default) shows "Assigned Time".
        // Only these 12 columns are exported, in the fixed order requested by the business.
        var isCompletedScope = string.Equals(request.Scope?.Trim(), "Completed", StringComparison.OrdinalIgnoreCase);
        var isArabic = _currentUserService.IsArabicLanguage;
        var tenthColumnHeader = isCompletedScope
        ? (isArabic ? "آخر تحديث" : "Last Update")
        : (isArabic ? "وقت التكليف" : "Assigned Time");

        var builder = new StringBuilder();
        builder.AppendLine(isArabic
        ? string.Join(',',
         "رقم المهمة",
         "هدف التفتيش",
         "سبب التفتيش",
         "الأولوية",
         "تاريخ الاستحقاق",
         "اتفاقية مستوى الخدمة",
         "الحالة",
         "الإمارة",
         "الجهة",
         tenthColumnHeader,
         "طريقة التفتيش",
         "أنشئ بواسطة")
        : $"Task No.,Inspection Target,Inspection Reason,Priority,Due Date,SLA,Status,Emirate,Authority,{tenthColumnHeader},Inspection Method,Created By");
        foreach (var row in rows)
        {
            var tenthColumnValue = isCompletedScope
                ? row.LastUpdatedOn.ToString("dd/MM/yyyy HH:mm:ss")
                : row.AssignedOn?.ToString("dd/MM/yyyy HH:mm:ss");

            builder.AppendLine(string.Join(',',
                EscapeCsv(row.TaskNo),
                EscapeCsv(row.TargetName),
                EscapeCsv(row.InspectionReasonName),
                EscapeCsv(row.PriorityName),
                EscapeCsv(row.DueDate.ToString("dd/MM/yyyy")),
                EscapeCsv(row.Sla?.DisplayText),
                EscapeCsv(row.StatusName),
                EscapeCsv(row.EmirateName),
                EscapeCsv(row.AuthorityName),
                EscapeCsv(tenthColumnValue),
                EscapeCsv(row.InspectionMethodName),
                EscapeCsv(row.CreatedByName)));
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var payload = Encoding.UTF8.GetBytes(builder.ToString());
        var result = new byte[preamble.Length + payload.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(payload, 0, result, preamble.Length, payload.Length);
        return result;
    }

    private IQueryable<InspectionTask> BuildTaskListQuery(InspectionTaskListRequestDto request, bool applyScopeFilter, bool bypassDataScope = false)
    {
        var search = request.Search?.Trim();
        var emirateId = int.TryParse(request.EmiratesId?.Trim(), out var parsedEmirateId) ? parsedEmirateId : (int?)null;
        var normalizedCreateBy = request.CreateBy?.Trim();

        var query = _dbContext.InspectionTasks.AsNoTracking();
        if (!bypassDataScope)
        {
            query = ApplyTaskDataScope(query);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var matchedEstablishmentIds = _dbContext.Establishments
                .AsNoTracking()
                .Where(e =>
                    (e.NameEn != null && e.NameEn.Contains(search)) ||
                    (e.NameAr != null && e.NameAr.Contains(search)))
                .Select(e => e.Id);

            // IndividualId stores profile IDs. To search by person name, join UserProfiles → Persons
            // to get matching profile IDs, then filter tasks by IndividualId (profile ID).
            var matchedIndividualIds = from up in _dbContext.UserProfiles.AsNoTracking()
                                       join p in _dbContext.Persons.AsNoTracking() on up.PersonId equals p.Id
                                       where (p.Name != null && p.Name.Contains(search)) ||
                                             (p.NameAr != null && p.NameAr.Contains(search))
                                       select up.Id;

            var matchedActivityIds = _dbContext.EconomicActivities
                .AsNoTracking()
                .Where(a =>
                    (a.NameEn != null && a.NameEn.Contains(search)) ||
                    (a.NameAr != null && a.NameAr.Contains(search)))
                .Select(a => a.Id);

            query = query.Where(x =>
                x.TaskNo.Contains(search) ||
                (x.EstablishmentName != null && x.EstablishmentName.Contains(search)) ||
                (x.FullName != null && x.FullName.Contains(search)) ||
                (x.EstablishmentId.HasValue && matchedEstablishmentIds.Contains(x.EstablishmentId.Value)) ||
                (x.IndividualId.HasValue && matchedIndividualIds.Contains(x.IndividualId.Value)) ||
                (x.ActivityId.HasValue && matchedActivityIds.Contains(x.ActivityId.Value)) ||
                (x.EmiratesId != null && x.EmiratesId.Contains(search))||
                (x.TradeLicenseNumber != null && x.TradeLicenseNumber.Contains(search)) 
                );
        }

        if (request.StatusId.HasValue)
        {
            query = query.Where(x => x.StatusId == request.StatusId.Value);
        }

        if (request.TargetTypeId.HasValue)
        {
            query = query.Where(x => x.TargetTypeId == request.TargetTypeId.Value);
        }

        if (request.InspectionReasonId.HasValue)
        {
            query = query.Where(x => x.InspectionReasonId == request.InspectionReasonId.Value);
        }

        if (request.InspectionMethodId.HasValue)
        {
            query = query.Where(x => x.InspectionMethodId == request.InspectionMethodId.Value);
        }

        if (emirateId.HasValue)
        {
            // EmiratesId query parameter is treated as an emirate id and matched
            // against InspectionTask.EmirateId instead of the EID string column.
            query = query.Where(x => x.EmirateId == emirateId.Value);
        }

        if (request.AuthorityId.HasValue)
        {
            query = query.Where(x => x.AuthorityId == request.AuthorityId.Value);
        }

        if (request.PriorityId.HasValue)
        {
            query = query.Where(x => x.PriorityId == request.PriorityId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.AssignedInspectorId))
        {
            query = query.Where(x => x.Inspectors.Any(i => i.InspectorId == request.AssignedInspectorId));
        }

        if (request.DueDateFrom.HasValue)
        {
            query = query.Where(x => x.DueDate >= request.DueDateFrom.Value.Date);
        }

        if (request.DueDateTo.HasValue)
        {
            query = query.Where(x => x.DueDate <= request.DueDateTo.Value.Date);
        }

        if (!string.IsNullOrWhiteSpace(normalizedCreateBy))
        {
            query = query.Where(x => x.CreatedBy != null && x.CreatedBy == normalizedCreateBy);
        }

        if (request.CreateAtFrom.HasValue)
        {
            query = query.Where(x => x.CreatedOn >= request.CreateAtFrom.Value);
        }

        if (request.CreateAtTo.HasValue)
        {
        query = query.Where(x => x.CreatedOn <= request.CreateAtTo.Value);
        }

        if (request.AssignedTimeFrom.HasValue)
        {
        query = query.Where(x => x.AssignedOn.HasValue && x.AssignedOn.Value >= request.AssignedTimeFrom.Value);
        }

        if (request.AssignedTimeTo.HasValue)
        {
        query = query.Where(x => x.AssignedOn.HasValue && x.AssignedOn.Value <= request.AssignedTimeTo.Value);
        }

        if (applyScopeFilter)
        {
            query = ApplyScopeFilter(query, request.Scope);
        }

        return query;
    }

    private IQueryable<InspectionTask> BuildTaskByTargetQuery(InspectionTaskByTargetRequestDto request, bool applyScopeFilter, bool bypassDataScope = false)
    {
        var query = BuildTaskListQuery(request, applyScopeFilter, bypassDataScope);

        if (request.EstablishmentId.HasValue)
        {
            return query.Where(x => x.EstablishmentId == request.EstablishmentId.Value);
        }

        return query.Where(x => x.IndividualId == request.IndividualId!.Value);
    }

    private async Task<InspectionTaskByTargetRequestDto> ResolveTaskByTargetRequestAsync(InspectionTaskByTargetRequestDto request)
    {
        request.EstablishmentId = request.EstablishmentId > 0 ? request.EstablishmentId : null;
        request.IndividualId = request.IndividualId > 0 ? request.IndividualId : null;
        request.TaskId = request.TaskId > 0 ? request.TaskId : null;

        if (!request.TaskId.HasValue)
        {
            return request;
        }

        var task = await _dbContext.InspectionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.TaskId.Value)
            .ConfigureAwait(false);

        if (task == null)
        {
            throw new BusinessException("Inspection.Task.NotFound", "");
        }

        request.EstablishmentId = task.EstablishmentId > 0 ? task.EstablishmentId : null;
        request.IndividualId = task.IndividualId > 0 ? task.IndividualId : null;

        return request;
    }

    private static void ValidateTaskTargetScope(int? establishmentId, int? individualId)
    {
        if (establishmentId.HasValue == individualId.HasValue
            || establishmentId is <= 0
            || individualId is <= 0)
        {
            throw new BusinessException("Inspection.Task.InvalidTargetScope", "");
        }
    }

    private static InspectionTaskListRequestDto BuildCreatedByLookupRequest(InspectionTaskListRequestDto request)
        => new()
        {
            Search = request.Search,
            Scope = request.Scope,
            StatusId = request.StatusId,
            TargetTypeId = request.TargetTypeId,
            InspectionReasonId = request.InspectionReasonId,
            InspectionMethodId = request.InspectionMethodId,
            EmiratesId = request.EmiratesId,
            AuthorityId = request.AuthorityId,
            PriorityId = request.PriorityId,
            AssignedInspectorId = request.AssignedInspectorId,
            DueDateFrom = request.DueDateFrom,
            DueDateTo = request.DueDateTo,
            AssignedTimeFrom = request.AssignedTimeFrom,
            AssignedTimeTo = request.AssignedTimeTo,
            CreateAtFrom = request.CreateAtFrom,
            CreateAtTo = request.CreateAtTo,
            PageIndex = 1,
            PageSize = int.MaxValue
        };

    private static IQueryable<InspectionTask> ApplyScopeFilter(IQueryable<InspectionTask> query, string? scope)
    {
        return scope?.Trim().ToLowerInvariant() switch
        {
            "todo" => query.Where(x =>
                x.StatusId == (int)InspectionTaskStatus.InProgress ||
                (x.StatusId == (int)InspectionTaskStatus.PendingVisit && x.Inspectors.Any())),
            "completed" => query.Where(x => x.StatusId == (int)InspectionTaskStatus.Completed || x.StatusId == (int)InspectionTaskStatus.AccessFailed || x.StatusId == (int)InspectionTaskStatus.Cancelled),
            "queued" => query.Where(x => x.StatusId == (int)InspectionTaskStatus.Queued || (x.StatusId == (int)InspectionTaskStatus.PendingVisit && !x.Inspectors.Any())),
            _ => query
        };
    }

    private IQueryable<InspectionTask> ApplyTaskDataScope(IQueryable<InspectionTask> query)
    {
        // If user is authenticated, filter tasks to:
        // 1. Tasks assigned to the current user as inspector, OR
        // 2. Tasks that are queued (not assigned yet), OR
        // 3. Tasks with PendingVisit status that have no inspectors (unassigned)
        if ( !string.IsNullOrWhiteSpace(_currentUserService.UserId))
        {
            var currentUserId = _currentUserService.UserId;
            return query.Where(x => 
                x.Inspectors.Any(i => i.InspectorId == currentUserId) ||
                x.StatusId == (int)InspectionTaskStatus.Queued ||
                (x.StatusId == (int)InspectionTaskStatus.PendingVisit && !x.Inspectors.Any()));
        }

        // If user is not authenticated, return all tasks (don't filter)
        // This allows the API to work when called without authentication
        return query;
    }

    private async Task ResolveCreatedByUserNamesAsync(ICollection<InspectionTaskReadProjection> items)
    {
        foreach (var item in items)
        {
            item.CreatedByName = item.CreatedBy;
        }

        var createdByValues = items
            .Select(x => x.CreatedBy?.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (createdByValues.Count == 0)
        {
            return;
        }

        var userMatches = await _dbContext.AdminUsers
            .AsNoTracking()
            .Where(x => createdByValues.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.FirstName,
                x.LastName,
                x.UserName
            })
            .ToListAsync()
            .ConfigureAwait(false);

        var displayNameById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var user in userMatches)
        {
            var fullName = string.Join(" ", new[] { user.FirstName?.Trim(), user.LastName?.Trim() }
                .Where(x => !string.IsNullOrWhiteSpace(x)));
            displayNameById[user.Id] = !string.IsNullOrWhiteSpace(fullName) ? fullName : (user.UserName ?? user.Id);
        }

        foreach (var item in items)
        {
            if (!string.IsNullOrWhiteSpace(item.CreatedBy) && displayNameById.TryGetValue(item.CreatedBy, out var displayName))
            {
                item.CreatedByName = displayName;
            }
        }
    }

    private bool ShouldShowTaskCancelView(int sourceTypeId, string? createdBy)
    {
        if (!_currentUserService.IsAuthenticated || string.IsNullOrWhiteSpace(createdBy))
        {
            return false;
        }

        var normalizedCreatedBy = createdBy.Trim();
        return string.Equals(normalizedCreatedBy, _currentUserService.UserId, StringComparison.OrdinalIgnoreCase)
               || string.Equals(normalizedCreatedBy, _currentUserService.UserName, StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildResolvedUserDisplayName(string? firstName, string? lastName, string userName, string? email, string fallbackValue)
    {
        var fullName = string.Join(" ", new[] { firstName?.Trim(), lastName?.Trim() }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return !string.IsNullOrWhiteSpace(fullName)
            ? fullName
            : !string.IsNullOrWhiteSpace(userName)
                ? userName
                : !string.IsNullOrWhiteSpace(email)
                    ? email
                    : fallbackValue;
    }

    private InspectionChecklistTemplateResponseDto BuildFallbackChecklistTemplate(InspectionTask task, string contentType)
    {
        var provider = new UMC.AdminPortal.Application.Services.Inspection.InspectionChecklistTemplateProvider();
        var template = provider.ResolveTemplate(task);

        var savedChecklistItemsByCode = task.ChecklistItems
            .GroupBy(x => x.ChecklistCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(x => x.RecordedAt).ThenByDescending(x => x.Id).First(),
                StringComparer.OrdinalIgnoreCase);

        return new InspectionChecklistTemplateResponseDto
        {
            TaskId = task.Id,
            ContentType = contentType,
            TargetTypeId = task.TargetTypeId,
            InspectionMethodId = task.InspectionMethodId,
            TemplateType = template.TemplateType,
            TemplateSource = template.TemplateSource,
            Items = template.Items
                .Select(item =>
                {
                    savedChecklistItemsByCode.TryGetValue(item.ChecklistCode, out var savedItem);

                    return new InspectionChecklistTemplateItemDto
                    {
                        Id = 0,
                        ChecklistCode = item.ChecklistCode,
                        ChecklistName = item.ChecklistName,
                        ViolationTypeId = 0,
                        DisplayOrder = item.DisplayOrder,
                        IsVisibleInChecklist = true,
                        IsActive = true,
                        RequiredWhenViolation = true,
                        ApplicableTemplateTypes = new List<string> { template.TemplateType },
                        MappedViolationCodes = item.MappedViolationCodes.ToList(),
                        ResultOptions = GetChecklistResultOptions(),
                        SavedResult = savedItem?.ResultId,
                        SavedNotes = savedItem?.Notes,
                        SavedSelectedViolationItemIds = savedItem?.Violations
                            .Select(x => x.ViolationItemId)
                            .Distinct()
                            .OrderBy(x => x)
                            .ToList() ?? new List<int>()
                    };
                })
                .ToList()
        };
    }

    public async Task<InspectionTaskReviewDto?> GetReviewAsync(int id)
    {
        var task = await _taskRepository.GetReviewAggregateAsync(id).ConfigureAwait(false);
        if (task == null)
        {
            return null;
        }

        var checklistCodes = task.ChecklistItems
            .Select(x => x.ChecklistCode)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();

        var violationDescriptionByCode = await _dbContext.InspectionChecklistTemplateItems
            .Where(t => checklistCodes.Contains(t.ChecklistCode) && !string.IsNullOrWhiteSpace(t.ViolationDescription))
            .GroupBy(t => t.ChecklistCode)
            .Select(g => new { Code = g.Key, Description = g.First().ViolationDescription })
            .ToDictionaryAsync(x => x.Code, x => x.Description)
            .ConfigureAwait(false);

        // violationAttachmentsPreloaded: GetReviewAggregateAsync now ThenIncludes declaration
        // attachments on violations — skip the separate InspectionViolationAttachments query.
        var declarationDocuments = await BuildTaskDeclarationDocumentsAsync(task, violationAttachmentsPreloaded: true).ConfigureAwait(false);
        return BuildTaskReview(task, declarationDocuments, violationDescriptionByCode: violationDescriptionByCode);
    }

    private static string ResolveContentType(InspectionTask task, InspectionTaskReadProjection? resolvedTask = null)
    {
        var candidates = new[]
        {
            resolvedTask?.ActivityName,
            resolvedTask?.EstablishmentTypeName,
            resolvedTask?.EstablishmentName ?? task.EstablishmentName,
            resolvedTask?.FullName ?? task.FullName,
            task.Remarks
        }
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .Select(x => x!.Trim())
        .ToList();

        if (candidates.Any(x => x.Contains("book", StringComparison.OrdinalIgnoreCase))) return "Book";
        if (candidates.Any(x => x.Contains("cinema", StringComparison.OrdinalIgnoreCase) || x.Contains("movie", StringComparison.OrdinalIgnoreCase))) return "Cinema";
        if (candidates.Any(x => x.Contains("game", StringComparison.OrdinalIgnoreCase))) return "Game";
        if (candidates.Any(x => x.Contains("publisher", StringComparison.OrdinalIgnoreCase) || x.Contains("publishing", StringComparison.OrdinalIgnoreCase))) return "Publisher";
        if (candidates.Any(x => x.Contains("newspaper", StringComparison.OrdinalIgnoreCase) || x.Contains("magazine", StringComparison.OrdinalIgnoreCase))) return "Newspaper";
        if (candidates.Any(x => x.Contains("printing", StringComparison.OrdinalIgnoreCase) || x.Contains("press", StringComparison.OrdinalIgnoreCase))) return "Printing";
        if (candidates.Any(x => x.Contains("advertising", StringComparison.OrdinalIgnoreCase))) return "Advertising";
        if (candidates.Any(x => x.Contains("film", StringComparison.OrdinalIgnoreCase) || x.Contains("video", StringComparison.OrdinalIgnoreCase))) return "FilmVideo";
        if (candidates.Any(x => x.Contains("production", StringComparison.OrdinalIgnoreCase) || x.Contains("studio", StringComparison.OrdinalIgnoreCase))) return "Production";
        if (candidates.Any(x => x.Contains("broadcast", StringComparison.OrdinalIgnoreCase) || x.Contains("radio", StringComparison.OrdinalIgnoreCase) || x.Contains("television", StringComparison.OrdinalIgnoreCase))) return "Broadcast";
        if (candidates.Any(x => x.Contains("digital", StringComparison.OrdinalIgnoreCase) || x.Contains("platform", StringComparison.OrdinalIgnoreCase))) return "Digital";
        if (candidates.Any(x => x.Contains("podcast", StringComparison.OrdinalIgnoreCase) || x.Contains("vlog", StringComparison.OrdinalIgnoreCase) || x.Contains("video blog", StringComparison.OrdinalIgnoreCase))) return "Podcast";
        if (task.TargetTypeId == (int)InspectionTargetType.Individual || candidates.Any(x => x.Contains("social", StringComparison.OrdinalIgnoreCase) || x.Contains("influencer", StringComparison.OrdinalIgnoreCase))) return "Social";
        if (candidates.Any(x => x.Contains("foreign", StringComparison.OrdinalIgnoreCase) || x.Contains("journalist", StringComparison.OrdinalIgnoreCase) || x.Contains("correspondent", StringComparison.OrdinalIgnoreCase))) return "ForeignMedia";

        return "Book";
    }

    private static string ResolveTemplateTypeCode(string contentType)
        => contentType switch
        {
            "Book" => "Bookstore",
            "Cinema" => "CinemaTheater",
            "Game" => "GameRetail",
            "Publisher" => "Publisher",
            "Newspaper" => "NewspaperMagazine",
            "Printing" => "PrintingPress",
            "Advertising" => "AdvertisingAgency",
            "FilmVideo" => "FilmVideoDistributor",
            "Production" => "ProductionCompany",
            "Broadcast" => "BroadcastingStation",
            "Digital" => "DigitalMediaPlatform",
            "Podcast" => "PodcastVideoBlogPlatform",
            "Social" => "SocialMediaInfluencer",
            "ForeignMedia" => "ForeignMediaOffice",
            _ => "Bookstore"
        };

    private static List<InspectionChecklistResultOptionDto> GetChecklistResultOptions()
        => new()
        {
            new() { Id = (int)InspectionChecklistResult.Compliant, Code = "Compliant", Name = "Compliant" },
            new() { Id = (int)InspectionChecklistResult.Violation, Code = "Violation", Name = "Violation" },
            new() { Id = (int)InspectionChecklistResult.NotApplicable, Code = "NotApplicable", Name = "Not Applicable" }
        };

    private async Task<(int? ActivityId, string? ActivityName)> NormalizeActivityAsync(int? activityId, int targetTypeId, int sourceTypeId)
    {
        if (sourceTypeId == (int)InspectionSourceType.ActivityBased)
        {
            if (!activityId.HasValue || activityId.Value <= 0)
            {
                throw new BusinessException("Inspection.Task.ActivityRequired", "");
            }

            var activity = await _dbContext.EconomicActivities
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == activityId.Value)
                .ConfigureAwait(false);
            if (activity == null)
            {
                throw new BusinessException("Inspection.Task.ActivityNotFound", "");
            }

            return (activity.Id, null);
        }

        if (activityId.HasValue && activityId.Value > 0)
        {
            var activity = await _dbContext.EconomicActivities
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == activityId.Value)
                .ConfigureAwait(false);
            if (activity == null)
            {
                throw new BusinessException("Inspection.Task.ActivityNotFound", "");
            }

            return (activity.Id, null);
        }

        return (null, null);
    }

    private async Task<List<int>> NormalizeBatchActivityIdsAsync(IReadOnlyCollection<int>? activityIds)
    {
        var normalizedActivityIds = (activityIds ?? Array.Empty<int>())
            .Where(x => x > 0)
            .Distinct()
            .ToList();

        if (normalizedActivityIds.Count == 0)
        {
            throw new BusinessException("Inspection.Task.ActivityRequired", "");
        }

        var existingActivityIds = await _dbContext.EconomicActivities
            .AsNoTracking()
            .Where(x => normalizedActivityIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync()
            .ConfigureAwait(false);

        if (existingActivityIds.Count != normalizedActivityIds.Count)
        {
            throw new BusinessException("Inspection.Task.ActivityNotFound", "");
        }

        return normalizedActivityIds;
    }

    private async Task<List<ActivityBasedEstablishmentMatch>> ResolveActivityBasedEstablishmentsAsync(IReadOnlyCollection<int> activityIds, int? emirateId, int? authorityId)
    {
        var normalizedActivityIds = activityIds
            .Where(x => x > 0)
            .Distinct()
            .ToList();

        if (normalizedActivityIds.Count == 0)
        {
            return new List<ActivityBasedEstablishmentMatch>();
        }

        var activityOrderById = normalizedActivityIds
            .Select((activityId, index) => new { activityId, index })
            .ToDictionary(x => x.activityId, x => x.index);

        var establishmentActivityPairs = await (
                from application in _dbContext.Applications.AsNoTracking()
                join applicationDetail in _dbContext.ApplicationDetails.AsNoTracking() on application.Id equals applicationDetail.ApplicationId
                join mediaLicense in _dbContext.MediaLicenses.AsNoTracking() on applicationDetail.Id equals mediaLicense.ApplicationDetailId
                join mediaLicenseEconomicActivity in _dbContext.MediaLicenseEconomicActivities.AsNoTracking() on mediaLicense.Id equals mediaLicenseEconomicActivity.MedialLicenseId
                where !application.IsDelete
                      && application.EstablishmentId.HasValue
                      && applicationDetail.DeletedOn == null
                      && normalizedActivityIds.Contains((int)mediaLicenseEconomicActivity.EconomicActivityId)
                select new
                {
                    EstablishmentId = application.EstablishmentId!.Value,
                    ActivityId = (int)mediaLicenseEconomicActivity.EconomicActivityId
                })
            .Distinct()
            .ToListAsync()
            .ConfigureAwait(false);

        var establishmentIds = establishmentActivityPairs
            .Select(x => x.EstablishmentId)
            .Distinct()
            .ToList();

        if (establishmentIds.Count == 0)
        {
            return new List<ActivityBasedEstablishmentMatch>();
        }

        var preferredActivityIdByEstablishmentId = establishmentActivityPairs
            .GroupBy(x => x.EstablishmentId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(x => activityOrderById[x.ActivityId])
                    .ThenBy(x => x.ActivityId)
                    .Select(x => x.ActivityId)
                    .First());

        var establishments = await _dbContext.Establishments
            .AsNoTracking()
            .Where(x => establishmentIds.Contains(x.Id) && x.DeletedOn == null)
            .OrderBy(x => x.Id)
            .ToListAsync()
            .ConfigureAwait(false);

        if (establishments.Count == 0)
        {
            return new List<ActivityBasedEstablishmentMatch>();
        }

        var filteredEstablishmentIds = establishments.Select(x => x.Id).Distinct().ToList();
        var userEstablishments = await _dbContext.UserEstablishments
            .AsNoTracking()
            .Where(x => filteredEstablishmentIds.Contains(x.EstablishmentId))
            .ToListAsync()
            .ConfigureAwait(false);

        var userProfileIds = userEstablishments.Select(x => x.UserProfileId).Distinct().ToList();
        var userProfiles = userProfileIds.Count == 0
            ? new List<UserProfile>()
            : await _dbContext.UserProfiles
                .AsNoTracking()
                .Where(x => userProfileIds.Contains(x.Id))
                .ToListAsync()
                .ConfigureAwait(false);

        var addressIds = establishments
            .Where(x => x.AddressId.HasValue)
            .Select(x => x.AddressId!.Value)
            .Concat(userProfiles.Select(x => x.AddressId))
            .Distinct()
            .ToList();

        var addresses = addressIds.Count == 0
            ? new Dictionary<int, Address>()
            : await _dbContext.Address
                .AsNoTracking()
                .Where(x => addressIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id)
                .ConfigureAwait(false);

        var authorityIds = establishments
            .Where(x => x.AuthorityId.HasValue)
            .Select(x => x.AuthorityId!.Value)
            .Distinct()
            .ToList();

        var authorities = authorityIds.Count == 0
            ? new Dictionary<int, Authority>()
            : await _dbContext.Authorities
                .AsNoTracking()
                .Where(x => authorityIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id)
                .ConfigureAwait(false);

        var communityIds = addresses.Values
            .Select(address => address.CommunityId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var communities = communityIds.Count == 0
            ? new Dictionary<int, Community>()
            : await _dbContext.Set<Community>()
                .AsNoTracking()
                .Where(x => communityIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id)
                .ConfigureAwait(false);

        var regionIds = addresses.Values
            .Select(address => address.RegionId)
            .Concat(communities.Values.Select(x => x.RegionId))
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var regions = regionIds.Count == 0
            ? new Dictionary<short, Region>()
            : await _dbContext.Regions
                .AsNoTracking()
                .Where(x => regionIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id)
                .ConfigureAwait(false);

        var userEstablishmentsByEstablishmentId = userEstablishments
            .GroupBy(x => x.EstablishmentId)
            .ToDictionary(x => x.Key, x => x.ToList());

        var userProfilesById = userProfiles.ToDictionary(x => x.Id);

        return establishments
            .Select(establishment =>
            {
                authorities.TryGetValue(establishment.AuthorityId ?? 0, out var authority);
                var profile = SelectPreferredRegisteredProfile(establishment.Id, userEstablishmentsByEstablishmentId, userProfilesById);
                var address = ResolvePreferredEstablishmentAddress(establishment, profile, addresses);
                var regionId = (int?)address?.RegionId;
                Region? region = null;
                if (regionId.HasValue)
                {
                    regions.TryGetValue((short)regionId.Value, out region);
                }

                var communityId = address?.CommunityId;
                Community? community = null;
                if (communityId.HasValue)
                {
                    communities.TryGetValue(communityId.Value, out community);
                }

                if (community == null && address?.CommunityId is int addressCommunityId)
                {
                    communities.TryGetValue(addressCommunityId, out community);
                }

                return new ActivityBasedEstablishmentMatch(
                    establishment.Id,
                    preferredActivityIdByEstablishmentId.TryGetValue(establishment.Id, out var preferredActivityId)
                        ? preferredActivityId
                        : normalizedActivityIds[0],
                    FirstNonEmpty(NormalizeDisplayName(establishment.NameEn), NormalizeDisplayName(establishment.NameAr)),
                    establishment.EstablishmentTypeId.HasValue ? establishment.EstablishmentTypeId.Value : null,
                    FirstNonEmpty(NormalizeDisplayName(establishment.LicenseNumber), NormalizeDisplayName(establishment.Trnumber)),
                    NormalizeDisplayName(establishment.Emails),
                    NormalizeDisplayName(establishment.PhoneNumber),
                    ResolvePreferredEstablishmentEmirateId(authority, region, community, address, regions),
                    establishment.AuthorityId,
                    regionId,
                    communityId ?? community?.Id,
                    NormalizeDisplayName(address?.Street),
                    // Coordinates come from the same resolved Address row as the street text above, so a
                    // task never ends up with text from one address and a pin from another.
                    address?.Latitude,
                    address?.Longitude);
            })
            .Where(x => !authorityId.HasValue || x.AuthorityId == authorityId.Value)
            .Where(x => !emirateId.HasValue || x.EmirateId == emirateId.Value)
            .OrderBy(x => x.EstablishmentName)
            .ThenBy(x => x.EstablishmentId)
            .ToList();
    }

    private static CreateInspectionTaskRequestDto BuildBatchPermissionProbeRequest(
        BatchCreateInspectionTaskByActivityRequestDto request,
        int activityId)
        => new()
        {
            TargetTypeId = request.TargetTypeId,
            SourceTypeId = request.SourceTypeId,
            InspectionMethodId = request.InspectionMethodId,
            ActivityId = activityId,
            EstablishmentId = request.EstablishmentId,
            IndividualId = request.IndividualId,
            EstablishmentTypeId = request.EstablishmentTypeId,
            EstablishmentName = request.EstablishmentName,
            TradeLicenseNumber = request.TradeLicenseNumber,
            FullName = request.FullName,
            EmiratesId = request.EmiratesId,
            Email = request.Email,
            Mobile = request.Mobile,
            InspectionReasonId = request.InspectionReasonId,
            PriorityId = request.PriorityId,
            EmirateId = request.EmirateId,
            AuthorityId = request.AuthorityId,
            RegionId = request.RegionId,
            CommunityId = request.CommunityId,
            AreaStreet = request.AreaStreet,
            Inspectors = null,
            DueDate = request.DueDate,
            Remarks = request.Remarks,
            Attachments = CloneTaskRequestAttachments(request.Attachments)
        };

    private CreateInspectionTaskRequestDto BuildActivityBatchTaskRequest(
        BatchCreateInspectionTaskByActivityRequestDto request,
        ActivityBasedEstablishmentMatch establishment)
        => new()
        {
            TargetTypeId = request.TargetTypeId,
            SourceTypeId = request.SourceTypeId,
            InspectionMethodId = request.InspectionMethodId,
            ActivityId = establishment.ActivityId,
            EstablishmentId = establishment.EstablishmentId,
            IndividualId = null,
            EstablishmentTypeId = establishment.EstablishmentTypeId ?? request.EstablishmentTypeId,
            EstablishmentName = FirstNonEmpty(establishment.EstablishmentName, request.EstablishmentName),
            TradeLicenseNumber = FirstNonEmpty(establishment.TradeLicenseNumber, request.TradeLicenseNumber),
            FullName = request.FullName,
            EmiratesId = request.EmiratesId,
            Email = FirstNonEmpty(establishment.Email, request.Email),
            Mobile = FirstNonEmpty(establishment.Mobile, request.Mobile),
            InspectionReasonId = request.InspectionReasonId,
            PriorityId = request.PriorityId,
            EmirateId = establishment.EmirateId ?? request.EmirateId,
            AuthorityId = establishment.AuthorityId ?? request.AuthorityId,
            RegionId = establishment.RegionId ?? request.RegionId,
            CommunityId = establishment.CommunityId ?? request.CommunityId,
            AreaStreet = FirstNonEmpty(establishment.AreaStreet, request.AreaStreet),
            // Unlike the text fields above, coordinates must not fall back to the batch request: the batch
            // covers many establishments, so one request-level pin would send every inspector to the same
            // wrong place. Both axes come from this establishment's address or neither does.
            Latitude = establishment.Latitude,
            Longitude = establishment.Longitude,
            Inspectors = CloneTaskRequestInspectors(request.Inspectors),
            DueDate = request.DueDate,
            Remarks = request.Remarks,
            Attachments = CloneTaskRequestAttachments(request.Attachments)
        };

    private async Task<List<BatchCreateInspectionTaskItemDto>> LoadBatchCreatedTaskItemsAsync(IReadOnlyCollection<int> createdTaskIds)
    {
        if (createdTaskIds.Count == 0)
        {
            return new List<BatchCreateInspectionTaskItemDto>();
        }

        var itemsByTaskId = await _dbContext.InspectionTasks
            .AsNoTracking()
            .Where(x => createdTaskIds.Contains(x.Id))
            .Select(x => new BatchCreateInspectionTaskItemDto
            {
                TaskId = x.Id,
                TaskNo = x.TaskNo,
                EstablishmentId = x.EstablishmentId ?? 0,
                EstablishmentName = x.EstablishmentName,
                TradeLicenseNumber = x.TradeLicenseNumber,
                EmirateId = x.EmirateId,
                AuthorityId = x.AuthorityId
            })
            .ToDictionaryAsync(x => x.TaskId)
            .ConfigureAwait(false);

        return createdTaskIds
            .Where(itemsByTaskId.ContainsKey)
            .Select(taskId => itemsByTaskId[taskId])
            .ToList();
    }

    private static List<AssignInspectionTaskItemDto>? CloneTaskRequestInspectors(IReadOnlyCollection<AssignInspectionTaskItemDto>? inspectors)
        => inspectors?.Select(x => new AssignInspectionTaskItemDto
        {
            InspectorId = x.InspectorId,
            InspectorName = x.InspectorName,
            IsPrimary = x.IsPrimary
        }).ToList();

    private static List<InspectionRequestAttachmentDto>? CloneTaskRequestAttachments(IReadOnlyCollection<InspectionRequestAttachmentDto>? attachments)
        => attachments?.Select(x => new InspectionRequestAttachmentDto
        {
            RelatedEntityType = x.RelatedEntityType,
            RelatedEntityId = x.RelatedEntityId,
            RelatedEntityCode = x.RelatedEntityCode,
            AttachmentCategory = x.AttachmentCategory,
            FileName = x.FileName,
            FileUrl = x.FileUrl,
            ContentType = x.ContentType
        }).ToList();

    private static UserProfile? SelectPreferredRegisteredProfile(
        int establishmentId,
        IReadOnlyDictionary<int, List<UserEstablishment>> userEstablishmentsByEstablishmentId,
        IReadOnlyDictionary<int, UserProfile> userProfilesById)
    {
        if (!userEstablishmentsByEstablishmentId.TryGetValue(establishmentId, out var links))
        {
            return null;
        }

        return links
            .Select(x => userProfilesById.TryGetValue(x.UserProfileId, out var profile) ? profile : null)
            .Where(x => x != null)
            .OrderByDescending(x => x!.Status == "3")
            .ThenByDescending(x => x!.IsActive == true)
            .ThenByDescending(x => x!.UpdateOn ?? x.CreatedOn)
            .ThenByDescending(x => x!.Id)
            .FirstOrDefault();
    }

    // Establishment.AddressId is a legacy misnamed column holding an Emirate id, not an Address.Id,
    // so the establishment never contributes an address here; only the owning profile does.
    private static Address? ResolvePreferredEstablishmentAddress(
        Establishment establishment,
        UserProfile? userProfile,
        IReadOnlyDictionary<int, Address> addresses)
    {
        if (userProfile != null && addresses.TryGetValue(userProfile.AddressId, out var profileAddress))
        {
            return profileAddress;
        }

        return null;
    }

    private static int? ResolvePreferredEstablishmentEmirateId(
        Authority? authority,
        Region? region,
        Community? community,
        Address? address,
        IReadOnlyDictionary<short, Region> regions)
    {
        if (authority != null)
        {
            return authority.EmirateId;
        }

        if (region != null)
        {
            return region.EmirateId;
        }

        if (community?.RegionId is short communityRegionId && regions.TryGetValue(communityRegionId, out var communityRegion))
        {
            return communityRegion.EmirateId;
        }

        return address?.EmirateId;
    }

    private static int? ParseNullableInt(string? value)
        => int.TryParse(value?.Trim(), out var parsedValue) ? parsedValue : null;


    /*private void EnsureCanCreateTask(CreateInspectionTaskRequestDto request)
    {
        if (!_currentUserService.IsAuthenticated)
        {
            throw new BusinessException("Inspection.Task.Forbidden", "");
        }

        ValidateInlineInspectors(request.Inspectors, requireInspectors: true, enforceCurrentInspectorOnly: true);
        ValidateTaskAttachments(request.Attachments);
    }*/

    private static void EnsureTaskEditable(InspectionTask task)
    {
        if (task.StatusId == (int)InspectionTaskStatus.Completed ||
            task.StatusId == (int)InspectionTaskStatus.AccessFailed ||
            task.StatusId == (int)InspectionTaskStatus.Cancelled)
        {
            throw new BusinessException("Inspection.Task.NotEditable", "");
        }
    }

    private async Task<InspectionTask> RequireTaskAsync(int id, InspectionTaskIncludes includes = InspectionTaskIncludes.All, bool asNoTracking = false)
    {
        var task = await _taskRepository.GetAggregateAsync(id, includes, asNoTracking).ConfigureAwait(false);
        if (task == null)
        {
            throw new BusinessException("Inspection.Task.NotFound", "");
        }

        return task;
    }

    private async Task AssignInternalAsync(IEnumerable<int> taskIds, AssignInspectionTaskRequestDto request)
    {
        if (request.Inspectors == null || request.Inspectors.Count == 0)
        {
            throw new BusinessException("Inspection.Task.AssignRequiresInspectors", "");
        }

        if (request.Inspectors.Count(x => x.IsPrimary) != 1)
        {
            throw new BusinessException("Inspection.Task.AssignRequiresSinglePrimaryInspector", "");
        }

        var assignedOn = DateTimeHelper.Now;
        foreach (var taskId in taskIds.Distinct())
        {
            var task = await RequireTaskAsync(taskId).ConfigureAwait(false);
            EnsureTaskEditable(task);
            var originalStatusId = task.StatusId;
            var previousInspectors = task.Inspectors
                .Select(x => new InspectionTaskInspector
                {
                    InspectorId = x.InspectorId,
                    InspectorName = x.InspectorName,
                    IsPrimary = x.IsPrimary,
                    AssignedOn = x.AssignedOn
                })
                .ToList();
            var previousPrimaryInspector = ResolvePrimaryInspector(previousInspectors);

            await ReplaceTaskInspectorsAsync(task, request.Inspectors, assignedOn).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

            var primary = request.Inspectors.First(x => x.IsPrimary);
            var assignmentEventCode = ResolveAssignmentEventCode(previousInspectors, request.Inspectors);
            var addedInspectors = assignmentEventCode is "TaskReassigned" or "TaskAssignmentUpdated"
                ? ResolveAddedInspectors(previousInspectors, request.Inspectors)
                : [];
            var assignmentTimelineEventId = await WriteTaskTimelineAsync(
                task.Id,
                "TaskAssigned",
                content: BuildAssignmentTimelineContent(request.Inspectors, assignmentEventCode == "TaskReassigned"),
                fromStatusId: originalStatusId,
                toStatusId: task.StatusId,
                eventCode: assignmentEventCode,
                targetHandlerUserId: primary.InspectorId,
                previousPrimaryInspectorUserId: assignmentEventCode == "TaskReassigned" ? previousPrimaryInspector?.InspectorId : null,
                previousPrimaryInspectorUserName: assignmentEventCode == "TaskReassigned" ? previousPrimaryInspector?.InspectorName : null,
                taskEntity: task).ConfigureAwait(false);
            await AddTaskTimelineRecipientSnapshotsAsync(assignmentTimelineEventId, addedInspectors).ConfigureAwait(false);
            await TrySendTaskNotificationAsync(task.Id, assignmentTimelineEventId).ConfigureAwait(false);
        }
    }

    private async Task AddTaskTimelineRecipientSnapshotsAsync(
        int timelineEventId,
        IReadOnlyCollection<AssignInspectionTaskItemDto> inspectors)
    {
        if (inspectors.Count == 0)
        {
            return;
        }

        var createdOn = DateTimeHelper.Now;
        foreach (var inspector in inspectors
            .Where(item => !string.IsNullOrWhiteSpace(item.InspectorId))
            .DistinctBy(item => item.InspectorId, StringComparer.OrdinalIgnoreCase))
        {
            _dbContext.InspectionTaskTimelineRecipientSnapshots.Add(new InspectionTaskTimelineRecipientSnapshot
            {
                TimelineEventId = timelineEventId,
                UserId = inspector.InspectorId!,
                UserName = NormalizeOptional(inspector.InspectorName),
                CreatedOn = createdOn
            });
        }

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
    }

    private static List<AssignInspectionTaskItemDto> ResolveAddedInspectors(
        IReadOnlyCollection<InspectionTaskInspector> previousInspectors,
        IReadOnlyCollection<AssignInspectionTaskItemDto> currentInspectors)
    {
        var previousIds = previousInspectors
            .Select(item => NormalizeOptional(item.InspectorId))
            .Where(item => item != null)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return currentInspectors
            .Where(item => !string.IsNullOrWhiteSpace(item.InspectorId)
                && !previousIds.Contains(item.InspectorId.Trim()))
            .DistinctBy(item => item.InspectorId, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task ReplaceTaskInspectorsAsync(InspectionTask task, IReadOnlyCollection<AssignInspectionTaskItemDto> inspectors, DateTime assignedOn)
    {
        ValidateInlineInspectors(inspectors, requireInspectors: false, enforceCurrentInspectorOnly: false);

        foreach (var existingInspector in task.Inspectors.ToList())
        {
            _taskInspectorRepository.Remove(existingInspector);
        }

        task.Inspectors.Clear();
        task.AssignedOn = inspectors.Count == 0 ? null : assignedOn;
        task.StatusId = ResolvePlannedTaskStatus(task.StatusId, inspectors.Count > 0);

        // Bulk-load display names from AdminUsers so InspectorName stores FirstName + LastName
        var inspectorIds = inspectors
            .Select(i => i.InspectorId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var displayNameMap = inspectorIds.Count > 0
            ? (await _dbContext.AdminUsers.AsNoTracking()
                .Where(u => inspectorIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.UserName })
                .ToListAsync()
                .ConfigureAwait(false))
              .ToDictionary(
                  u => u.Id,
                  u =>
                  {
                      var joined = string.Join(" ", new[] { u.FirstName, u.LastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
                      return !string.IsNullOrWhiteSpace(joined) ? joined : (u.UserName ?? u.Id);
                  },
                  StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var inspector in inspectors)
        {
            var resolvedName = inspector.InspectorId != null && displayNameMap.TryGetValue(inspector.InspectorId, out var dn)
                ? dn
                : NormalizeOptional(inspector.InspectorName);
            var entity = new InspectionTaskInspector
            {
                TaskId = task.Id,
                InspectorId = inspector.InspectorId,
                InspectorName = resolvedName,
                IsPrimary = inspector.IsPrimary,
                AssignedOn = assignedOn,
                CreatedOn = assignedOn,
                LastUpdatedOn = assignedOn,
                CreatedBy = _currentUserService.UserId,
                UpdatedBy = _currentUserService.UserId
            };

            await _taskInspectorRepository.AddAsync(entity).ConfigureAwait(false);
        }

        TouchTask(task, assignedOn);
    }

    private async Task ReplaceTaskAttachmentsAsync(InspectionTask task, IReadOnlyCollection<InspectionRequestAttachmentDto> attachments)
    {
        ValidateTaskAttachments(attachments);

        foreach (var existingAttachment in task.Attachments
                     .Where(x => InspectionTaskAttachmentCategory.TaskAttachment.Matches(x.AttachmentCategory)
                                 && InspectionTaskAttachmentRelatedEntityType.Task.Matches(x.RelatedEntityType))
                     .ToList())
        {
            _taskAttachmentRepository.Remove(existingAttachment);
            task.Attachments.Remove(existingAttachment);
        }

        var now = DateTimeHelper.Now;
        var taskRelatedEntityType = InspectionTaskAttachmentRelatedEntityType.Task.GetValue();
        var taskAttachmentCategory = InspectionTaskAttachmentCategory.TaskAttachment.GetValue();
        foreach (var attachment in attachments)
        {
            var entity = new InspectionTaskAttachment
            {
                TaskId = task.Id,
                Task = task,
                RelatedEntityType = taskRelatedEntityType,
                RelatedEntityId = task.Id,
                AttachmentCategory = taskAttachmentCategory,
                FileName = attachment.FileName.Trim(),
                FileUrl = attachment.FileUrl.Trim(),
                ContentType = NormalizeOptional(attachment.ContentType),
                UploadedBy = _currentUserService.UserId,
                UploadedAt = now,
                CreatedOn = now,
                LastUpdatedOn = now,
                CreatedBy = _currentUserService.UserId,
                UpdatedBy = _currentUserService.UserId
            };

            await _taskAttachmentRepository.AddAsync(entity).ConfigureAwait(false);
        }

        TouchTask(task, now);
    }

    private void ValidateInlineInspectors(IReadOnlyCollection<AssignInspectionTaskItemDto>? inspectors, bool requireInspectors, bool enforceCurrentInspectorOnly)
    {
        if (inspectors == null)
        {
            if (requireInspectors)
            {
                throw new BusinessException("Inspection.Task.InspectorSelfAssignmentOnly", "");
            }

            return;
        }

        if (inspectors.Count == 0)
        {
            if (requireInspectors)
            {
                throw new BusinessException("Inspection.Task.InspectorSelfAssignmentOnly", "");
            }

            return;
        }

        if (inspectors.Count(x => x.IsPrimary) != 1)
        {
            throw new BusinessException("Inspection.Task.InlineAssignmentRequiresSinglePrimaryInspector", "");
        }

        if (!enforceCurrentInspectorOnly)
        {
            return;
        }

        var onlyInspector = inspectors.Single();
        if (string.IsNullOrWhiteSpace(_currentUserService.UserId) ||
            inspectors.Count != 1 ||
            !onlyInspector.IsPrimary ||
            !string.Equals(onlyInspector.InspectorId, _currentUserService.UserId, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Inspection.Task.InspectorSelfAssignmentOnly", "");
        }
    }

    private static void ValidateTaskAttachments(IReadOnlyCollection<InspectionRequestAttachmentDto>? attachments)
    {
        if (attachments == null)
        {
            return;
        }

        if (attachments.Any(x =>  string.IsNullOrWhiteSpace(x.FileUrl)))
        {
            throw new BusinessException("Inspection.Task.AttachmentFileRequired", "");
        }
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string BuildTaskCreatedTimelineContent(string taskNo, string operatorName)
        => $"Task {taskNo} created by {operatorName}.";

    private static string BuildTaskQueuedTimelineContent()
        => "Task created and queued for assignment.";

    private static bool ShouldWriteQueuedTimeline(int sourceTypeId)
        => sourceTypeId == (int)InspectionSourceType.ActivityBased;

    private static string BuildAssignmentTimelineContent(IReadOnlyCollection<AssignInspectionTaskItemDto> inspectors, bool isReassigned)
    {
        var summary = BuildInspectorSummary(inspectors);
        if (string.IsNullOrWhiteSpace(summary))
        {
            return isReassigned
                ? "Task Reassigned."
                : "Task Assigned.";
        }

        return isReassigned
            ? $"Task Reassigned to {summary}."
            : $"Task Assigned to {summary}.";
    }

    private static string BuildTaskUnassignedTimelineContent(IReadOnlyCollection<InspectionTaskInspector> previousInspectors)
    {
        var summary = BuildInspectorSummary(previousInspectors);
        return string.IsNullOrWhiteSpace(summary)
            ? "Task returned to queue."
            : $"Task returned to queue from {summary}.";
    }

    private static string BuildTaskCancelledTimelineContent(string? cancelReason)
        => string.IsNullOrWhiteSpace(cancelReason)
            ? "Task cancelled."
            : $"Reason: {cancelReason}";

    private static string? BuildInspectorSummary(IEnumerable<AssignInspectionTaskItemDto> inspectors)
        => NormalizeDisplayName(string.Join(", ", inspectors
            .Select(x => FirstNonEmpty(NormalizeOptional(x.InspectorName), x.InspectorId))
            .Where(x => !string.IsNullOrWhiteSpace(x))));

    private static string? BuildInspectorSummary(IEnumerable<InspectionTaskInspector> inspectors)
        => NormalizeDisplayName(string.Join(", ", inspectors
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.AssignedOn)
            .Select(x => FirstNonEmpty(NormalizeOptional(x.InspectorName), x.InspectorId))
            .Where(x => !string.IsNullOrWhiteSpace(x))));

    private static bool IsInspectorReassignment(
        IReadOnlyCollection<InspectionTaskInspector>? previousInspectors,
        IReadOnlyCollection<AssignInspectionTaskItemDto> currentInspectors)
    {
        var previousPrimaryInspectorId = previousInspectors?
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.AssignedOn)
            .Select(x => x.InspectorId)
            .FirstOrDefault();
        var currentPrimaryInspectorId = currentInspectors
            .OrderByDescending(x => x.IsPrimary)
            .Select(x => x.InspectorId)
            .FirstOrDefault();

        return !string.IsNullOrWhiteSpace(previousPrimaryInspectorId)
               && !string.IsNullOrWhiteSpace(currentPrimaryInspectorId)
               && !string.Equals(previousPrimaryInspectorId, currentPrimaryInspectorId, StringComparison.OrdinalIgnoreCase);
    }

    private static InspectionTaskInspector? ResolvePrimaryInspector(IEnumerable<InspectionTaskInspector> inspectors)
        => inspectors
            .Where(inspector => inspector.IsPrimary)
            .OrderBy(inspector => inspector.AssignedOn)
            .FirstOrDefault();

    private bool IsInteractiveInspectorSelfSubmission(CreateInspectionTaskRequestDto request)
    {
        if (!_currentUserService.IsAuthenticated || !_currentUserService.IsInRole("Inspector"))
        {
            return false;
        }

        if (request.Inspectors is not { Count: 1 })
        {
            return false;
        }

        var inspector = request.Inspectors[0];
        return inspector != null
            && inspector.IsPrimary
            && string.Equals(inspector.InspectorId, _currentUserService.UserId, StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveAssignmentEventCode(
        IReadOnlyCollection<InspectionTaskInspector>? previousInspectors,
        IReadOnlyCollection<AssignInspectionTaskItemDto> currentInspectors)
    {
        var previousPrimaryInspectorId = previousInspectors?
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.AssignedOn)
            .Select(x => x.InspectorId)
            .FirstOrDefault();
        if (string.IsNullOrWhiteSpace(previousPrimaryInspectorId))
        {
            return "TaskAssigned";
        }

        return IsInspectorReassignment(previousInspectors, currentInspectors)
            ? "TaskReassigned"
            : "TaskAssignmentUpdated";
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

    private async Task<int> WriteTaskTimelineAsync(
        int taskId,
        string eventType,
        string? content = null,
        int? fromStatusId = null,
        int? toStatusId = null,
        DateTime? createdOn = null,
        InspectionTask? taskEntity = null,
        string? eventCode = null,
        string? eventName = null,
        string? targetHandlerTypeCode = null,
        string? targetHandlerUserId = null,
        string? targetHandlerUserName = null,
        string? previousPrimaryInspectorUserId = null,
        string? previousPrimaryInspectorUserName = null,
        string? actorTypeCode = null,
        string? actorUserId = null,
        string? actorUserName = null,
        int? actorRoleId = null,
        string? resultCode = "Success",
        string? locationText = null,
        string? reasonCode = null,
        string? reasonText = null)
    {
        var now = createdOn ?? DateTimeHelper.Now;
        var resolvedEventCode = NormalizeOptional(eventCode) ?? ResolveTimelineEventCode(eventType);
        var resolvedEventName = NormalizeOptional(eventName) ?? ResolveTimelineEventName(resolvedEventCode);
        var resolvedTargetHandler = ResolveTimelineTargetHandler(taskEntity, eventType, toStatusId, targetHandlerTypeCode, targetHandlerUserId, targetHandlerUserName);
        var resolvedActorUserId = NormalizeOptional(actorUserId) ?? _currentUserService.UserId;
        var resolvedActorUserName = NormalizeOptional(actorUserName) ?? await GetOperatorNameAsync().ConfigureAwait(false);
        var resolvedActorRoleId = actorRoleId ?? GetOperatorRoleId();
        var resolvedActorTypeCode = NormalizeOptional(actorTypeCode) ?? ResolveTimelineActorTypeCode(resolvedActorUserId, resolvedActorUserName);
        var resolvedContent = NormalizeOptional(content);

        var timelineEvent = new InspectionTaskTimelineEvent
        {
            TaskId = taskId,
            EventType = eventType,
            EventCode = resolvedEventCode,
            EventName = resolvedEventName,
            Label = FirstNonEmpty(resolvedContent, resolvedEventName) ?? resolvedEventCode,
            FromStatusId = fromStatusId,
            ToStatusId = toStatusId,
            TargetHandlerTypeCode = resolvedTargetHandler?.TypeCode,
            TargetHandlerUserId = resolvedTargetHandler?.UserId,
            TargetHandlerUserName = resolvedTargetHandler?.UserName,
            PreviousPrimaryInspectorUserId = NormalizeOptional(previousPrimaryInspectorUserId),
            PreviousPrimaryInspectorUserName = NormalizeOptional(previousPrimaryInspectorUserName),
            ActorTypeCode = resolvedActorTypeCode,
            ActorUserId = resolvedActorUserId,
            ActorUserName = resolvedActorUserName,
            ActorRoleId = resolvedActorRoleId,
            ResultCode = NormalizeOptional(resultCode),
            Content = resolvedContent,
            LocationText = NormalizeOptional(locationText),
            ReasonCode = NormalizeOptional(reasonCode),
            ReasonText = NormalizeOptional(reasonText),
            CreatedOn = now
        };
        await _taskTimelineRepository.AddAsync(timelineEvent).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        return timelineEvent.Id;
    }

    private async Task<int> WriteInspectorTaskSubmittedTimelineAsync(int taskId)
    {
        var timelineEventId = await WriteTaskTimelineAsync(
            taskId,
            "InspectorTaskSubmitted",
            content: "Inspection task submitted by inspector.",
            eventCode: "InspectorTaskSubmitted").ConfigureAwait(false);

        var leaders = await (
                from userDepartment in _dbContext.UserDepartments.AsNoTracking()
                join user in _dbContext.AdminUsers.AsNoTracking() on userDepartment.UserId equals user.Id
                where userDepartment.DepartmentId == (int)DepartmentEnum.Inspection
                    && userDepartment.IsLeader == true
                    && user.IsActive
                    && (user.Status == null || user.Status == AdminUser.ActiveStatusCode)
                select new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.UserName
                })
            .Distinct()
            .ToListAsync()
            .ConfigureAwait(false);

        var createdOn = DateTimeHelper.Now;
        foreach (var leader in leaders)
        {
            _dbContext.InspectionTaskTimelineRecipientSnapshots.Add(new InspectionTaskTimelineRecipientSnapshot
            {
                TimelineEventId = timelineEventId,
                UserId = leader.Id,
                UserName = FirstNonEmpty(
                    string.Join(" ", new[] { leader.FirstName, leader.LastName }.Where(value => !string.IsNullOrWhiteSpace(value))),
                    leader.UserName,
                    leader.Id),
                CreatedOn = createdOn
            });
        }

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        return timelineEventId;
    }

    private async Task SendCreationNotificationsAsync(TaskCreationResult creation)
    {
        await TrySendTaskNotificationAsync(creation.TaskId, creation.CreatedTimelineEventId).ConfigureAwait(false);
        if (creation.AssignedTimelineEventId.HasValue)
        {
            await TrySendTaskNotificationAsync(creation.TaskId, creation.AssignedTimelineEventId.Value).ConfigureAwait(false);
        }
    }

    private async Task TrySendTaskNotificationAsync(int taskId, int timelineEventId)
    {
        if (_notificationService == null)
        {
            return;
        }

        try
        {
            await _notificationService.TrySendAsync(taskId, timelineEventId).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            _logger?.LogError(
                exception,
                "Inspection task notification failed after persistence. TaskId={TaskId}, TimelineEventId={TimelineEventId}.",
                taskId,
                timelineEventId);
        }
    }

    private static List<string> BuildImportantUpdatedFields(
        string? originalTargetName,
        string? updatedTargetName,
        int? originalPriorityId,
        int? updatedPriorityId,
        DateTime originalDueDate,
        DateTime updatedDueDate)
    {
        var fields = new List<string>();
        if (!string.Equals(NormalizeOptional(originalTargetName), NormalizeOptional(updatedTargetName), StringComparison.Ordinal))
        {
            fields.Add("Inspection Target");
        }
        if (originalPriorityId != updatedPriorityId)
        {
            fields.Add("Priority");
        }
        if (originalDueDate != updatedDueDate)
        {
            fields.Add("Due Date");
        }
        return fields;
    }

    private void TouchTask(InspectionTask task, DateTime? now = null)
    {
        var effectiveNow = now ?? DateTimeHelper.Now;
        ApplyTaskCurrentOwnerSnapshot(task);
        task.LastUpdatedOn = effectiveNow;
        task.UpdatedBy = _currentUserService.UserId;
    }

    private static void ApplyTaskCurrentOwnerSnapshot(InspectionTask task)
    {
        var currentOwner = ResolveDerivedTaskCurrentOwner(task);
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
            "TaskCreated" => "Task Created",
            "TaskQueued" => "Task Queued",
            "TaskAssigned" => "Task Assigned",
            "TaskReassigned" => "Task Reassigned",
            "TaskAssignmentUpdated" => "Task Assignment Updated",
            "TaskEdited" => "Task Updated",
            "TaskUnassigned" => "Task Unassigned",
            "TaskCancelled" => "Task Cancelled",
            "InspectorTaskSubmitted" => "Inspector Task Submitted",
            "InspectionStarted" => "Inspection Started",
            "InspectionAccessFailed" => "Access Failed",
            "InspectionCompleted" => "Inspection Completed",
            "InspectionChecklistSaved" => "Checklist Saved",
            "InspectionSeizedMaterialsSaved" => "Seized Materials Saved",
            "InspectionContactPersonSaved" => "Contact Person Saved",
            "InspectionContactPersonDeclarationSaved" => "Contact Person Declaration Saved",
            "InspectionReinspectionSaved" => "Reinspection Settings Saved",
            "InspectionReportSubmitted" => "Inspection Report Submitted",
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
        var explicitTargetSummary = NormalizeDisplayName(targetHandlerUserName);
        var explicitTargetUserId = NormalizeDisplayName(targetHandlerUserId);
        var explicitTargetTypeCode = NormalizeDisplayName(targetHandlerTypeCode);
        var currentOwner = task == null ? null : ResolveTaskCurrentOwner(task);

        if (!string.IsNullOrWhiteSpace(explicitTargetUserId)
            || !string.IsNullOrWhiteSpace(explicitTargetSummary)
            || !string.IsNullOrWhiteSpace(explicitTargetTypeCode))
        {
            return new TaskTimelineHandlerSnapshot(
                FirstNonEmpty(explicitTargetTypeCode, currentOwner?.TypeCode, InferTimelineHandlerTypeCode(explicitTargetSummary, explicitTargetUserId)),
                FirstNonEmpty(explicitTargetUserId, currentOwner?.UserId),
                FirstNonEmpty(explicitTargetSummary, currentOwner?.Summary, currentOwner?.UserName, explicitTargetUserId));
        }

        if (string.Equals(eventType, "TaskQueued", StringComparison.Ordinal))
        {
            return new TaskTimelineHandlerSnapshot("Automated", null, "Automated");
        }

        if (string.Equals(eventType, "TaskCreated", StringComparison.Ordinal)
            && (toStatusId ?? task?.StatusId) == (int)InspectionTaskStatus.Queued)
        {
            return new TaskTimelineHandlerSnapshot("Automated", null, "Automated");
        }

        if (task != null
            && (string.Equals(eventType, "TaskCreated", StringComparison.Ordinal)
                || string.Equals(eventType, "TaskAssigned", StringComparison.Ordinal)
                || string.Equals(eventType, "TaskEdited", StringComparison.Ordinal)
                || string.Equals(eventType, "TaskUnassigned", StringComparison.Ordinal)
                || string.Equals(eventType, "InspectionStarted", StringComparison.Ordinal)
                || string.Equals(eventType, "InspectionCheckIn", StringComparison.Ordinal)))
        {
            if (currentOwner != null)
            {
                return new TaskTimelineHandlerSnapshot(currentOwner.TypeCode, currentOwner.UserId, currentOwner.Summary);
            }
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

    private int GetOperatorRoleId()
    {
        // Default role ID for general users
        return 6;
    }

    private async Task<string> GetOperatorNameAsync()
    {
        var userId = _currentUserService.UserId;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            var user = await _dbContext.AdminUsers.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.FirstName, u.LastName })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (user != null)
            {
                var displayName = string.Join(" ", new[] { user.FirstName, user.LastName }
                    .Where(x => !string.IsNullOrWhiteSpace(x)));
                if (!string.IsNullOrWhiteSpace(displayName)) return displayName;
            }
        }
        return _currentUserService.UserName ?? _currentUserService.UserId ?? "System";
    }


    private static IQueryable<InspectionTask> ApplySorting(
        IQueryable<InspectionTask> query,
        string? sortBy,
        string? sortDirection)
    {
        var normalizedSortBy = sortBy?.Trim().ToLowerInvariant();
        var ascending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);

        return normalizedSortBy switch
        {
            "priority" => ascending
                ? query.OrderBy(x => x.PriorityId ?? int.MaxValue)
                    .ThenBy(x => x.DueDate)
                    .ThenByDescending(x => x.AssignedOn ?? DateTime.MinValue)
                    .ThenBy(x => x.TaskNo)
                : query.OrderByDescending(x => x.PriorityId ?? int.MinValue)
                    .ThenByDescending(x => x.DueDate)
                    .ThenByDescending(x => x.AssignedOn ?? DateTime.MinValue)
                    .ThenByDescending(x => x.TaskNo),
            "taskno" => ascending
                ? query.OrderBy(x => x.TaskNo).ThenBy(x => x.DueDate)
                : query.OrderByDescending(x => x.TaskNo).ThenByDescending(x => x.DueDate),
            "statusid" => ascending
                ? query.OrderBy(x => x.StatusId).ThenBy(x => x.DueDate)
                : query.OrderByDescending(x => x.StatusId).ThenByDescending(x => x.DueDate),
            "assignedon" => ascending
                ? query.OrderBy(x => x.AssignedOn).ThenBy(x => x.DueDate)
                : query.OrderByDescending(x => x.AssignedOn).ThenByDescending(x => x.DueDate),
            "duedate" => ascending
                ? query.OrderBy(x => x.DueDate).ThenBy(x => x.TaskNo)
                : query.OrderByDescending(x => x.DueDate).ThenByDescending(x => x.TaskNo),
            "sla" or "sladeadlineat" => ascending
                ? query.OrderBy(x => x.DueDate)
                    .ThenBy(x => x.PriorityId ?? int.MaxValue)
                    .ThenByDescending(x => x.AssignedOn ?? DateTime.MinValue)
                    .ThenBy(x => x.TaskNo)
                : query.OrderByDescending(x => x.DueDate)
                    .ThenBy(x => x.PriorityId ?? int.MaxValue)
                    .ThenByDescending(x => x.AssignedOn ?? DateTime.MinValue)
                    .ThenByDescending(x => x.TaskNo),
            "lastupdatedon" => ascending
                ? query.OrderBy(x => x.LastUpdatedOn).ThenBy(x => x.TaskNo)
                : query.OrderByDescending(x => x.LastUpdatedOn).ThenByDescending(x => x.TaskNo),
            "createdon" => ascending
                ? query.OrderBy(x => x.CreatedOn).ThenBy(x => x.TaskNo)
                : query.OrderByDescending(x => x.CreatedOn).ThenByDescending(x => x.TaskNo),
            _ => query.OrderBy(x => x.PriorityId ?? int.MaxValue)
                .ThenBy(x => x.DueDate)
                .ThenByDescending(x => x.AssignedOn ?? DateTime.MinValue)
                .ThenBy(x => x.TaskNo)
        };
    }

    private static InspectionTaskSlaSummaryDto BuildTaskListSlaSummary(InspectionTaskReadProjection item, bool isArabic)
    {
        var dueOn = item.DueDate;
        return InspectionSlaSummaryBuilder.Build(
            dueOn,
            item.StatusId,
            item.CheckoutAt,
            item.ReportSubmittedAt,
            item.LastUpdatedOn,
            isArabic);
    }

    private async Task<InspectionTaskReadProjection> ResolveTaskReadNamesAsync(InspectionTask task)
    {
        var resolvedTask = new InspectionTaskReadProjection
        {
            TaskId = task.Id,
            TaskNo = task.TaskNo,
            TargetTypeId = task.TargetTypeId,
            ActivityId = task.ActivityId,
            ActivityName = null,
            EstablishmentId = task.EstablishmentId,
            EstablishmentName = task.EstablishmentName,
            IndividualId = task.IndividualId,
            FullName = task.FullName,
            EstablishmentTypeId = task.EstablishmentTypeId,
            EstablishmentTypeName = null,
            InspectionReasonId = task.InspectionReasonId,
            InspectionReasonName = null,
            PriorityId = task.PriorityId,
            PriorityName = null,
            EmirateId = task.EmirateId,
            EmirateName = null,
            AuthorityId = task.AuthorityId,
            AuthorityName = null,
            RegionId = task.RegionId,
            RegionName = null,
            CommunityId = task.CommunityId,
            CommunityName = null
        };

        await ResolveTaskReadNamesAsync(new[] { resolvedTask }).ConfigureAwait(false);
        return resolvedTask;
    }

    private async Task ResolveTaskReadNamesAsync(
        IReadOnlyList<InspectionTaskReadProjection> tasks,
        bool resolveEstablishmentTypeNames = true)
    {
        if (tasks.Count == 0)
        {
            return;
        }

        var activityNames = await ResolveEconomicActivityNamesAsync(CollectIds(tasks.Select(x => x.ActivityId))).ConfigureAwait(false);
        var establishmentNames = await ResolveEstablishmentNamesAsync(CollectIds(tasks.Select(x => x.EstablishmentId))).ConfigureAwait(false);
        var individualNames = await ResolveIndividualNamesAsync(CollectIds(tasks.Select(x => x.IndividualId))).ConfigureAwait(false);
        var establishmentTypeNames = resolveEstablishmentTypeNames
            ? await ResolveEstablishmentTypeNamesAsync(CollectShortIds(tasks.Select(x => x.EstablishmentTypeId))).ConfigureAwait(false)
            : new Dictionary<int, string>();
        var (inspectionReasonNames, priorityNames) = await ResolveInspectionReasonAndPriorityNamesBatchAsync(
            CollectIds(tasks.Select(x => x.InspectionReasonId)),
            CollectIds(tasks.Select(x => x.PriorityId))).ConfigureAwait(false);
        var emirateNames = await ResolveEmirateNamesAsync(CollectShortIds(tasks.Select(x => x.EmirateId))).ConfigureAwait(false);
        var authorityNames = await ResolveAuthorityNamesAsync(CollectIds(tasks.Select(x => x.AuthorityId))).ConfigureAwait(false);
        var regionNames = await ResolveRegionNamesAsync(CollectShortIds(tasks.Select(x => x.RegionId))).ConfigureAwait(false);
        var communityNames = await ResolveCommunityNamesAsync(CollectIds(tasks.Select(x => x.CommunityId))).ConfigureAwait(false);

        foreach (var task in tasks)
        {
            task.ActivityName = ResolveLookupName(activityNames, task.ActivityId, task.ActivityName);
            task.EstablishmentName = ResolveLookupName(establishmentNames, task.EstablishmentId, task.EstablishmentName);
            task.FullName = ResolveLookupName(individualNames, task.IndividualId, task.FullName);
            task.EstablishmentTypeName = ResolveLookupName(establishmentTypeNames, task.EstablishmentTypeId, task.EstablishmentTypeName);
            task.InspectionReasonName = ResolveLookupName(inspectionReasonNames, task.InspectionReasonId, task.InspectionReasonName);
            task.PriorityName = ResolveLookupName(priorityNames, task.PriorityId, task.PriorityName);
            task.EmirateName = ResolveLookupName(emirateNames, task.EmirateId, task.EmirateName);
            task.AuthorityName = ResolveLookupName(authorityNames, task.AuthorityId, task.AuthorityName);
            task.RegionName = ResolveLookupName(regionNames, task.RegionId, task.RegionName);
            task.CommunityName = ResolveLookupName(communityNames, task.CommunityId, task.CommunityName);
            task.TargetName = ResolveTargetName(task);
            task.AccountOwnerName = ResolveAccountOwnerName(task);
        }
    }

    private async Task<Dictionary<int, string>> ResolveEconomicActivityNamesAsync(IReadOnlyList<int> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.EconomicActivities
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.NameEn, x.NameAr })
            .ToDictionaryAsync(x => x.Id, x => CoalesceDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
            .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveEstablishmentNamesAsync(IReadOnlyList<int> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.Establishments
        .AsNoTracking()
        .Where(x => ids.Contains(x.Id))
        .Select(x => new { x.Id, x.NameEn, x.NameAr })
        .ToDictionaryAsync(x => x.Id, x => ResolveLocalizedDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
        .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveIndividualNamesAsync(IReadOnlyList<int> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        // IndividualId stores UserProfile.Id (profile ID).
        // Resolve the display name via UserProfiles.PersonId → Persons.Name.
        var profilePersonPairs = await _dbContext.UserProfiles
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { ProfileId = x.Id, x.PersonId })
            .ToListAsync()
            .ConfigureAwait(false);

        if (profilePersonPairs.Count == 0)
            return new Dictionary<int, string>();

        var personIds = profilePersonPairs.Select(x => x.PersonId).Distinct().ToList();
        var personNames = await _dbContext.Persons
            .AsNoTracking()
            .Where(x => personIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.NameAr })
            .ToDictionaryAsync(x => x.Id, x => ResolveLocalizedDisplayName(x.Name, x.NameAr) ?? x.Id.ToString())
            .ConfigureAwait(false);

        return profilePersonPairs
            .Where(p => personNames.ContainsKey(p.PersonId))
            .ToDictionary(p => p.ProfileId, p => personNames[p.PersonId]);
    }

    private async Task<Dictionary<int, string>> ResolveEstablishmentTypeNamesAsync(IReadOnlyList<short> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.UserTypes
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.NameEn, x.NameAr })
            .ToDictionaryAsync(x => (int)x.Id, x => CoalesceDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
            .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveEmirateNamesAsync(IReadOnlyList<short> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.Emirates
        .AsNoTracking()
        .Where(x => ids.Contains(x.Id))
        .Select(x => new { x.Id, x.NameEn, x.NameAr })
        .ToDictionaryAsync(x => (int)x.Id, x => ResolveLocalizedDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
        .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveAuthorityNamesAsync(IReadOnlyList<int> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.Authorities
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.NameEn, x.NameAr })
            .ToDictionaryAsync(x => x.Id, x => CoalesceDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
            .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveRegionNamesAsync(IReadOnlyList<short> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.Regions
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.NameEn, x.NameAr })
            .ToDictionaryAsync(x => (int)x.Id, x => CoalesceDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
            .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveCommunityNamesAsync(IReadOnlyList<int> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _dbContext.Set<Community>()
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.NameEn, x.NameAr })
            .ToDictionaryAsync(x => x.Id, x => CoalesceDisplayName(x.NameEn, x.NameAr) ?? x.Id.ToString())
            .ConfigureAwait(false);
    }

    private async Task<Dictionary<int, string>> ResolveEnumTypeDictionaryNamesAsync(string scope, IReadOnlyList<int> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        var codes = ids.Select(x => x.ToString()).ToList();
        var items = await _dbContext.TypeDictionaries
            .AsNoTracking()
            .Where(x => x.Scope == scope && (codes.Contains(x.Code) || (x.Sort.HasValue && ids.Contains(x.Sort.Value)) || ids.Contains(x.Id)))
            .OrderBy(x => x.Sort)
            .ThenBy(x => x.Id)
            .Select(x => new { x.Id, x.Code, x.NameEn, x.NameAr, x.Sort })
            .ToListAsync()
            .ConfigureAwait(false);

        var resolved = new Dictionary<int, string>();
        foreach (var item in items)
        {
            var resolvedId = ResolveEnumDictionaryValueId(item.Code, item.Sort, item.Id);
            if (!resolved.ContainsKey(resolvedId))
            {
                resolved[resolvedId] = CoalesceDisplayName(item.NameEn, item.NameAr) ?? resolvedId.ToString();
            }
        }

        return resolved;
    }

    /// <summary>
    /// Fetches InspectionReason and InspectionPriority TypeDictionary entries in a single DB round-trip.
    /// </summary>
    private async Task<(Dictionary<int, string> reasonNames, Dictionary<int, string> priorityNames)>
        ResolveInspectionReasonAndPriorityNamesBatchAsync(IReadOnlyList<int> reasonIds, IReadOnlyList<int> priorityIds)
    {
        var reasonScope = nameof(InspectionReason);
        var priorityScope = nameof(InspectionPriority);

        var hasReason = reasonIds.Count > 0;
        var hasPriority = priorityIds.Count > 0;

        if (!hasReason && !hasPriority)
            return (new Dictionary<int, string>(), new Dictionary<int, string>());

        // Load all rows for both scopes in a single query; TypeDictionaries is a small reference table.
        var scopesToLoad = new List<string>(2);
        if (hasReason) scopesToLoad.Add(reasonScope);
        if (hasPriority) scopesToLoad.Add(priorityScope);

        var allItems = await _dbContext.TypeDictionaries
            .AsNoTracking()
            .Where(x => scopesToLoad.Contains(x.Scope))
            .OrderBy(x => x.Scope)
            .ThenBy(x => x.Sort)
            .ThenBy(x => x.Id)
            .Select(x => new { x.Id, x.Scope, x.Code, x.NameEn, x.NameAr, x.Sort })
            .ToListAsync()
            .ConfigureAwait(false);

        Dictionary<int, string> BuildDict(string scope, IReadOnlyList<int> ids)
        {
            var resolved = new Dictionary<int, string>();
            if (ids.Count == 0) return resolved;
            foreach (var item in allItems.Where(x => x.Scope == scope))
            {
                var resolvedId = ResolveEnumDictionaryValueId(item.Code, item.Sort, item.Id);
                if (ids.Contains(resolvedId) && !resolved.ContainsKey(resolvedId))
                resolved[resolvedId] = ResolveLocalizedDisplayName(item.NameEn, item.NameAr) ?? resolvedId.ToString();
            }
            return resolved;
        }

        return (BuildDict(reasonScope, reasonIds), BuildDict(priorityScope, priorityIds));
    }

    private static int ResolveEnumDictionaryValueId(string? code, int? sort, int fallbackId)
    {
        if (int.TryParse(code, out var parsedCode))
        {
            return parsedCode;
        }

        return sort ?? fallbackId;
    }

    private static List<int> CollectIds(IEnumerable<int?> ids)
        => ids.Where(x => x.HasValue && x.Value > 0)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

    private static List<short> CollectShortIds(IEnumerable<int?> ids)
        => ids.Where(x => x.HasValue && x.Value > 0 && x.Value <= short.MaxValue)
            .Select(x => (short)x!.Value)
            .Distinct()
            .ToList();

    private static string? ResolveLookupName(IReadOnlyDictionary<int, string> names, int? id, string? fallback)
    {
        if (id.HasValue && names.TryGetValue(id.Value, out var currentName))
        {
            return currentName;
        }

        return NormalizeDisplayName(fallback);
    }

    private static string ResolveTargetName(InspectionTaskReadProjection task)
        => task.TargetTypeId switch
        {
            (int)InspectionTargetType.Establishment => FirstNonEmpty(task.EstablishmentName, task.FullName, task.ActivityName, task.TaskNo) ?? task.TaskNo,
            (int)InspectionTargetType.Individual => FirstNonEmpty(task.FullName, task.EstablishmentName, task.ActivityName, task.TaskNo) ?? task.TaskNo,
            _ => FirstNonEmpty(task.EstablishmentName, task.FullName, task.ActivityName, task.TaskNo) ?? task.TaskNo
        };

    private static string ResolveAccountOwnerName(InspectionTaskReadProjection task)
        => FirstNonEmpty(task.FullName, task.EstablishmentName, task.ActivityName) ?? "Mock Owner";

    private static string? CoalesceDisplayName(string? primary, string? secondary)
        => FirstNonEmpty(primary, secondary);

    // Arabic requests get the Arabic display name (when present); otherwise fall back to the
    // English-first CoalesceDisplayName. Used for the fields the inspection task list must
    // localize: establishmentName, emirateName, inspectionReasonName.
    private string? ResolveLocalizedDisplayName(string? nameEn, string? nameAr)
        => _currentUserService.IsArabicLanguage && !string.IsNullOrWhiteSpace(nameAr)
            ? nameAr.Trim()
            : CoalesceDisplayName(nameEn, nameAr);

    private static string? NormalizeDisplayName(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();

    /// <summary>
    /// Individual-target tasks can be created without any address input, leaving every address
    /// column null and the execution page's Target Access map with nothing to render. For display
    /// only, fall back to the individual's registered profile address (UserProfile.AddressId is a
    /// real Address foreign key). All-or-nothing: if the task row carries any address data of its
    /// own, keep it untouched rather than mixing fields from two sources. The task aggregate is
    /// loaded AsNoTracking, so mutating it here never persists.
    /// </summary>
    private async Task BackfillIndividualTargetAddressAsync(InspectionTask task)
    {
        if (task.TargetTypeId != (int)InspectionTargetType.Individual || task.IndividualId is not > 0)
        {
            return;
        }

        var hasOwnAddressData = task.EmirateId.HasValue
            || task.RegionId.HasValue
            || task.CommunityId.HasValue
            || !string.IsNullOrWhiteSpace(task.AreaStreet)
            || task.Latitude.HasValue
            || task.Longitude.HasValue;
        if (hasOwnAddressData)
        {
            return;
        }

        var individualId = task.IndividualId.Value;
        var address = await _dbContext.UserProfiles
            .AsNoTracking()
            .Where(x => x.Id == individualId)
            .Join(_dbContext.Address.AsNoTracking(), profile => profile.AddressId, addr => addr.Id, (profile, addr) => addr)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);
        if (address == null)
        {
            return;
        }

        task.EmirateId = address.EmirateId;
        task.RegionId = address.RegionId;
        task.CommunityId = address.CommunityId;
        task.AreaStreet = address.Street;
        (task.Latitude, task.Longitude) = SanitizeTaskCoordinates(
            address.Latitude,
            address.Longitude,
            $"task {task.Id} individual profile address");
    }

    private async Task<InspectionTaskDetailDto> BuildTaskDetailAsync(InspectionTask task)
    {
        await BackfillIndividualTargetAddressAsync(task).ConfigureAwait(false);
        var resolvedTask = await ResolveTaskReadNamesAsync(task).ConfigureAwait(false);
        var createdByName = await ResolveCreatedByUserNameAsync(task.CreatedBy).ConfigureAwait(false);
        // violationAttachmentsPreloaded: GetDetailAggregateAsync now ThenIncludes declaration
        // attachments on violations — skip the separate InspectionViolationAttachments query.
        var declarationDocuments = await BuildTaskDeclarationDocumentsAsync(task, includeMockFallbacks: false, violationAttachmentsPreloaded: true).ConfigureAwait(false);
        var accessFailed = BuildAccessFailedReadProjection(task);

        // Risk profile is enterprise/individual-scoped, not task-scoped: the same target
        // shares one risk assessment across all its tasks. Resolve the latest risk profile
        // for the same establishment/individual instead of binding strictly to this TaskId.
        var riskProfileQuery = _dbContext.InspectionTaskRiskProfiles
            .AsNoTracking()
            .Include(p => p.RiskFactors)
            .AsQueryable();

        if (task.EstablishmentId.HasValue)
        {
            var establishmentId = task.EstablishmentId.Value;
            riskProfileQuery = riskProfileQuery.Where(p =>
                _dbContext.Set<InspectionTask>().Any(t => t.Id == p.TaskId && t.EstablishmentId == establishmentId));
        }
        else if (task.IndividualId.HasValue)
        {
            var individualId = task.IndividualId.Value;
            riskProfileQuery = riskProfileQuery.Where(p =>
                _dbContext.Set<InspectionTask>().Any(t => t.Id == p.TaskId && t.IndividualId == individualId));
        }
        else
        {
            riskProfileQuery = riskProfileQuery.Where(p => p.TaskId == task.Id);
        }

        var riskProfile = await riskProfileQuery
            .OrderByDescending(p => p.LastAssessmentDate)
            .ThenByDescending(p => p.CreatedOn)
            .ThenByDescending(p => p.Id)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        int? profileId = null;
        string? userProfileUserId = null;
        short? userProfileUserTypeId = null;

        if (task.IndividualId.HasValue)
        {
            profileId = task.IndividualId.Value;
        }
        else if (task.EstablishmentId.HasValue)
        {
            profileId = await _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(x => x.EstablishmentId == task.EstablishmentId.Value)
                .Select(x => (int?)x.UserProfileId)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
        }

        // Lookup UserProfile to populate identity fields for Overview
        // Lookup UserProfile to populate identity fields for Overview
        string? userTypeCode = null;
        if (profileId.HasValue)
        {
            var up = await _dbContext.Set<UserProfile>()
                .AsNoTracking()
                .Where(x => x.Id == profileId.Value)
                .Select(x => new { x.UserId, x.UserTypeId })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (up != null)
            {
                userProfileUserId = up.UserId;
                userProfileUserTypeId = up.UserTypeId;

                // Resolve UserType.Code from lookup table
                if (up.UserTypeId > 0)
                {
                    userTypeCode = await _dbContext.Set<UserType>()
                        .AsNoTracking()
                        .Where(x => x.Id == up.UserTypeId)
                        .Select(x => x.Code)
                        .FirstOrDefaultAsync()
                        .ConfigureAwait(false);
                }
            }
        }

        // Resolve Establishment identity fields (EstablishmentNameAr, LicenseNumber)
        string? establishmentNameAr = null;
        string? licenseNumber = null;
        if (task.EstablishmentId.HasValue)
        {
            var est = await _dbContext.Set<Establishment>()
                .AsNoTracking()
                .Where(x => x.Id == task.EstablishmentId.Value)
                .Select(x => new { x.NameAr, x.LicenseNumber })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (est != null)
            {
                establishmentNameAr = est.NameAr;
                licenseNumber = est.LicenseNumber;
            }
        }

        var detail = MapDetail(task, resolvedTask, createdByName, declarationDocuments, accessFailed, riskProfile, profileId);
        detail.UserProfileId = profileId;
        detail.UserId = userProfileUserId;
        detail.UserTypeId = userProfileUserTypeId;
        detail.UserTypeCode = userTypeCode ?? userProfileUserTypeId?.ToString();
        detail.EstablishmentNameAr = establishmentNameAr;
        detail.LicenseNumber = licenseNumber;
        detail.TargetName = ResolveTargetName(resolvedTask);
        return detail;
    }

    private async Task<InspectionTaskDigitalPresenceDto> BuildDigitalPresenceAsync(InspectionTask task)
    {
        var profiles = await LoadDigitalPresenceProfilesAsync(task).ConfigureAwait(false);
        var profileIds = profiles.Select(x => x.Id).Distinct().ToList();
        var userIds = profiles
            .Select(x => NormalizeDisplayName(x.UserId))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var applications = profileIds.Count == 0 && userIds.Count == 0
            ? new List<ApplicationModel>()
            : await _dbContext.Applications
                .AsNoTracking()
                .Where(x => !x.IsDelete
                            && ((profileIds.Count > 0 && profileIds.Contains(x.ProfileId))
                                || (userIds.Count > 0 && userIds.Contains(x.UserId))))
                .OrderByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .ToListAsync()
                .ConfigureAwait(false);

        var applicationIds = applications.Select(x => x.Id).Distinct().ToList();
        var applicationDetails = applicationIds.Count == 0
            ? new List<DigitalPresenceApplicationDetailProjection>()
            : await _dbContext.ApplicationDetails
                .AsNoTracking()
                .Where(x => applicationIds.Contains(x.ApplicationId) && x.DeletedOn == null)
                .Select(x => new DigitalPresenceApplicationDetailProjection(x.Id, x.ApplicationId))
                .ToListAsync()
                .ConfigureAwait(false);

        var applicationDetailsById = applicationDetails.ToDictionary(x => x.Id);
        var applicationDetailIds = applicationDetailsById.Keys.ToList();
        
        var mediaLicenses = applicationDetailIds.Count == 0
            ? new List<DigitalPresenceMediaLicenseProjection>()
            : await _dbContext.MediaLicenses
                .AsNoTracking()
                .Where(x => applicationDetailIds.Contains(x.ApplicationDetailId))
                .Select(x => new DigitalPresenceMediaLicenseProjection(x.Id, x.ApplicationDetailId))
                .ToListAsync()
                .ConfigureAwait(false);

        var mediaLicensesById = mediaLicenses.ToDictionary(x => x.Id);
        var mediaLicenseIds = mediaLicensesById.Keys.ToList();
        var economicActivities = mediaLicenseIds.Count == 0
            ? new List<DigitalPresenceEconomicActivityProjection>()
            : await _dbContext.MediaLicenseEconomicActivities
                .AsNoTracking()
                .Where(x => mediaLicenseIds.Contains(x.MedialLicenseId))
                .Select(x => new DigitalPresenceEconomicActivityProjection(x.Id, x.MedialLicenseId))
                .ToListAsync()
                .ConfigureAwait(false);

        var economicActivitiesById = economicActivities.ToDictionary(x => x.Id);
        var economicActivityIds = economicActivitiesById.Keys.ToList();
        var economicActivityExternalAccounts = economicActivityIds.Count == 0
            ? new List<DigitalPresenceEconomicActivityExternalMediaAccountProjection>()
            : await _dbContext.MediaLicenseEconomicActivityExternalMediaAccounts
                .AsNoTracking()
                .Where(x => economicActivityIds.Contains(x.MediaLicenseEconomicActivityId))
                .Select(x => new DigitalPresenceEconomicActivityExternalMediaAccountProjection(x.Id, x.MediaLicenseEconomicActivityId, x.ExternalMediaAccountId))
                .ToListAsync()
                .ConfigureAwait(false);

        var externalMediaAccountIds = economicActivityExternalAccounts.Select(x => x.ExternalMediaAccountId).Distinct().ToList();
        var externalMediaAccounts = externalMediaAccountIds.Count == 0
            ? new List<DigitalPresenceExternalMediaAccountProjection>()
            : await _dbContext.ExternalMediaAccounts
                .AsNoTracking()
                .Where(x => externalMediaAccountIds.Contains(x.Id) && x.DeletedOn == null)
                .Select(x => new DigitalPresenceExternalMediaAccountProjection(x.Id, x.SocialMediaId, x.DisplayName, x.WebsiteUrl))
                .ToListAsync()
                .ConfigureAwait(false);

        var externalMediaAccountsById = externalMediaAccounts.ToDictionary(x => x.Id);
        var socialMediaIds = externalMediaAccounts.Select(x => x.SocialMediaId).Distinct().ToList();
        var socialMedias = socialMediaIds.Count == 0
            ? new Dictionary<short, DigitalPresenceSocialMediaProjection>()
            : await _dbContext.SocialMedias
                .AsNoTracking()
                .Where(x => socialMediaIds.Contains(x.Id))
                .Select(x => new DigitalPresenceSocialMediaProjection(x.Id, x.NameEn, x.NameAr))
                .ToDictionaryAsync(x => x.Id)
                .ConfigureAwait(false);

        var establishment = task.EstablishmentId.HasValue
            ? await _dbContext.Establishments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == task.EstablishmentId.Value).ConfigureAwait(false)
            : null;
        // IndividualId stores a profile ID; resolve the Person through UserProfile.PersonId.
        Person? person = null;
        if (task.IndividualId.HasValue)
        {
            var personId = await _dbContext.UserProfiles
                .AsNoTracking()
                .Where(x => x.Id == task.IndividualId.Value)
                .Select(x => (int?)x.PersonId)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (personId.HasValue)
            {
                person = await _dbContext.Persons.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == personId.Value)
                    .ConfigureAwait(false);
            }
        }

        var applicationsById = applications.ToDictionary(x => x.Id);
        var socialMediaAccounts = new List<InspectionTaskSocialMediaAccountDto>();
        var socialMediaAccountKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var accountLink in economicActivityExternalAccounts.OrderBy(x => x.Id))
        {
            if (!externalMediaAccountsById.TryGetValue(accountLink.ExternalMediaAccountId, out var externalMediaAccount))
            {
                continue;
            }

            economicActivitiesById.TryGetValue(accountLink.MediaLicenseEconomicActivityId, out var economicActivity);
            DigitalPresenceMediaLicenseProjection? mediaLicense = null;
            if (economicActivity != null)
            {
                mediaLicensesById.TryGetValue(economicActivity.MedialLicenseId, out mediaLicense);
            }

            DigitalPresenceApplicationDetailProjection? applicationDetail = null;
            if (mediaLicense != null)
            {
                applicationDetailsById.TryGetValue(mediaLicense.ApplicationDetailId, out applicationDetail);
            }

            ApplicationModel? application = null;
            if (applicationDetail != null)
            {
                applicationsById.TryGetValue(applicationDetail.ApplicationId, out application);
            }

            socialMedias.TryGetValue(externalMediaAccount.SocialMediaId, out var socialMedia);

            AddSocialMediaAccount(
                socialMediaAccounts,
                socialMediaAccountKeys,
                new InspectionTaskSocialMediaAccountDto
                {
                    SourceType = "ExternalMediaAccount",
                    ProfileId = application?.ProfileId,
                    ApplicationId = application?.Id,
                    ApplicationDetailId = applicationDetail?.Id,
                    MediaLicenseId = mediaLicense?.Id,
                    MediaLicenseEconomicActivityId = economicActivity?.Id,
                    ExternalMediaAccountId = externalMediaAccount.Id,
                    SocialMediaId = externalMediaAccount.SocialMediaId,
                    SocialMediaName = FirstNonEmpty(socialMedia?.NameEn, socialMedia?.NameAr),
                    SocialMediaNameAr = socialMedia?.NameAr,
                    AccountName = FirstNonEmpty(externalMediaAccount.DisplayName, externalMediaAccount.WebsiteUrl),
                    WebsiteUrl = externalMediaAccount.WebsiteUrl
                });
        }

        var personProfile = person == null ? null : profiles.FirstOrDefault(x => x.PersonId == person.Id);
        if (!string.IsNullOrWhiteSpace(person?.TwitterAccount))
        {
            AddSocialMediaAccount(
                socialMediaAccounts,
                socialMediaAccountKeys,
                new InspectionTaskSocialMediaAccountDto
                {
                    SourceType = "PersonTwitterAccount",
                    ProfileId = personProfile?.Id,
                    SocialMediaName = "Twitter",
                    AccountName = person.TwitterAccount
                });
        }

        var filteredSocialMediaAccounts = socialMediaAccounts
            .Where(IsSocialMediaAccountCandidate)
            .ToList();

        var websites = new List<InspectionTaskWebsiteDto>();
        var websiteKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var account in socialMediaAccounts.Where(IsWebsiteCandidate))
        {
            AddWebsiteCandidate(
                websites,
                websiteKeys,
                account.WebsiteUrl,
                "ExternalMediaAccount",
                account.ProfileId,
                account.ApplicationId,
                account.ApplicationDetailId,
                account.MediaLicenseId,
                account.MediaLicenseEconomicActivityId,
                account.ExternalMediaAccountId,
                account.SocialMediaId,
                account.SocialMediaName,
                account.SocialMediaNameAr);
        }

        return new InspectionTaskDigitalPresenceDto
        {
            Websites = websites,
            SocialMedia = filteredSocialMediaAccounts
        };
    }

    private async Task<List<UserProfile>> LoadDigitalPresenceProfilesAsync(InspectionTask task)
    {
        IQueryable<UserProfile> query = _dbContext.UserProfiles.AsNoTracking().Where(_ => false);
        if (task.EstablishmentId.HasValue)
        {
            var profileIds = await _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(x => x.EstablishmentId == task.EstablishmentId.Value)
                .Select(x => x.UserProfileId)
                .Distinct()
                .ToListAsync()
                .ConfigureAwait(false);

            if (profileIds.Count == 0)
            {
                return new List<UserProfile>();
            }

            query = _dbContext.UserProfiles.AsNoTracking().Where(x => profileIds.Contains(x.Id));
        }
        else if (task.IndividualId.HasValue)
        {
            // IndividualId stores UserProfile.Id (profile ID), not PersonId.
            var profileId = task.IndividualId.Value;
            query = _dbContext.UserProfiles
                .AsNoTracking()
                .Where(x => x.Id == profileId);
        }

        return await query
            .OrderByDescending(x => x.Status == "3")
            .ThenByDescending(x => x.IsActive == true)
            .ThenByDescending(x => x.UpdateOn ?? x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .ToListAsync()
            .ConfigureAwait(false);
    }

    private static void AddSocialMediaAccount(
        ICollection<InspectionTaskSocialMediaAccountDto> accounts,
        ISet<string> seenKeys,
        InspectionTaskSocialMediaAccountDto account)
    {
        account.SourceType = NormalizeDisplayName(account.SourceType) ?? string.Empty;
        account.SocialMediaName = NormalizeDisplayName(account.SocialMediaName);
        account.SocialMediaNameAr = NormalizeDisplayName(account.SocialMediaNameAr);
        account.AccountName = NormalizeDisplayName(account.AccountName);
        account.WebsiteUrl = NormalizeDisplayName(account.WebsiteUrl);

        var key = string.Join("|",
            account.SourceType,
            account.ProfileId?.ToString() ?? string.Empty,
            account.ApplicationId?.ToString() ?? string.Empty,
            account.ApplicationDetailId?.ToString() ?? string.Empty,
            account.MediaLicenseId?.ToString() ?? string.Empty,
            account.MediaLicenseEconomicActivityId?.ToString() ?? string.Empty,
            account.ExternalMediaAccountId?.ToString() ?? string.Empty,
            account.SocialMediaId?.ToString() ?? string.Empty,
            account.AccountName ?? string.Empty,
            account.WebsiteUrl ?? string.Empty);

        if (seenKeys.Add(key))
        {
            accounts.Add(account);
        }
    }

    private static void AddWebsiteCandidate(
        ICollection<InspectionTaskWebsiteDto> websites,
        ISet<string> seenKeys,
        string? url,
        string sourceType,
        int? profileId = null,
        int? applicationId = null,
        int? applicationDetailId = null,
        int? mediaLicenseId = null,
        int? mediaLicenseEconomicActivityId = null,
        int? externalMediaAccountId = null,
        short? socialMediaId = null,
        string? socialMediaName = null,
        string? socialMediaNameAr = null)
    {
        var normalizedUrl = NormalizeDisplayName(url);
        if (string.IsNullOrWhiteSpace(normalizedUrl))
        {
            return;
        }

        var normalizedSourceType = NormalizeDisplayName(sourceType) ?? string.Empty;
        var normalizedSocialMediaName = NormalizeDisplayName(socialMediaName);
        var normalizedSocialMediaNameAr = NormalizeDisplayName(socialMediaNameAr);
        var key = string.Join("|",
            normalizedSourceType,
            normalizedUrl,
            profileId?.ToString() ?? string.Empty,
            applicationId?.ToString() ?? string.Empty,
            applicationDetailId?.ToString() ?? string.Empty,
            mediaLicenseId?.ToString() ?? string.Empty,
            mediaLicenseEconomicActivityId?.ToString() ?? string.Empty,
            externalMediaAccountId?.ToString() ?? string.Empty,
            socialMediaId?.ToString() ?? string.Empty,
            normalizedSocialMediaName ?? string.Empty,
            normalizedSocialMediaNameAr ?? string.Empty);

        if (seenKeys.Add(key))
        {
            websites.Add(new InspectionTaskWebsiteDto
            {
                Url = normalizedUrl,
                SourceType = normalizedSourceType,
                ProfileId = profileId,
                ApplicationId = applicationId,
                ApplicationDetailId = applicationDetailId,
                MediaLicenseId = mediaLicenseId,
                MediaLicenseEconomicActivityId = mediaLicenseEconomicActivityId,
                ExternalMediaAccountId = externalMediaAccountId,
                SocialMediaId = socialMediaId,
                SocialMediaName = normalizedSocialMediaName,
                SocialMediaNameAr = normalizedSocialMediaNameAr
            });
        }
    }

    private static bool IsWebsiteCandidate(InspectionTaskSocialMediaAccountDto account)
        => string.Equals(account.SourceType, "ExternalMediaAccount", StringComparison.OrdinalIgnoreCase)
           && account.SocialMediaId == 1;

    private static bool IsSocialMediaAccountCandidate(InspectionTaskSocialMediaAccountDto account)
        => string.Equals(account.SourceType, "ExternalMediaAccount", StringComparison.OrdinalIgnoreCase)
           && account.SocialMediaId.HasValue
           && account.SocialMediaId.Value != 1;

    private async Task<InspectionTaskTargetOverviewLimitedDto> BuildTargetOverviewAsync(InspectionTask task)
    {
        // When both EstablishmentId and IndividualId are null the target entity
        // does not exist in the database — return zeros immediately.
        if (!task.EstablishmentId.HasValue && !task.IndividualId.HasValue)
        {
            return new InspectionTaskTargetOverviewLimitedDto { ViolationCount = 0, UnpayCount = 0 };
        }

        var taskLinkedQuery = BuildRelatedViolationQuery(task).Where(v => v.ApprovalOn != null);

        // Standalone violations (SourceTaskId = 0 or null) linked to same target via SourceSnapshot
        IQueryable<InspectionViolation> standaloneQuery;
        if (task.EstablishmentId.HasValue)
        {
            var matchingIds = _dbContext.InspectionViolationSourceSnapshots
                .AsNoTracking()
                .Where(s => s.EstablishmentId == task.EstablishmentId)
                .Select(s => s.ViolationId);
            standaloneQuery = _dbContext.InspectionViolations
                .AsNoTracking()
                .Where(v => (v.SourceTaskId == null || v.SourceTaskId == 0)
                            && matchingIds.Contains(v.Id)
                            && v.ApprovalOn != null);
        }
        else if (task.IndividualId.HasValue)
        {
            var matchingIds = _dbContext.InspectionViolationSourceSnapshots
                .AsNoTracking()
                .Where(s => s.IndividualId == task.IndividualId)
                .Select(s => s.ViolationId);
            standaloneQuery = _dbContext.InspectionViolations
                .AsNoTracking()
                .Where(v => (v.SourceTaskId == null || v.SourceTaskId == 0)
                            && matchingIds.Contains(v.Id)
                            && v.ApprovalOn != null);
        }
        else
        {
            standaloneQuery = Enumerable.Empty<InspectionViolation>().AsQueryable();
        }

        var taskLinkedCount = await taskLinkedQuery.CountAsync().ConfigureAwait(false);
        var standaloneCount = await standaloneQuery
            .CountAsync(x => x.StatusId == (int)InspectionViolationStatus.Paid)
            .ConfigureAwait(false);
        var taskLinkedUnpay = await taskLinkedQuery
            .CountAsync(x => x.StatusId == (int)InspectionViolationStatus.PendingPayment)
            .ConfigureAwait(false);
        const int standaloneUnpay = 0;

        var targetIdentity = await BuildTargetOverviewIdentityAsync(task).ConfigureAwait(false);

        return new InspectionTaskTargetOverviewLimitedDto
        {
            ViolationCount = taskLinkedCount + standaloneCount,
            UnpayCount = taskLinkedUnpay + standaloneUnpay,
            ProfileId = targetIdentity.ProfileId,
            UserProfileId = targetIdentity.UserProfileId,
            UserId = targetIdentity.UserId,
            UserTypeId = targetIdentity.UserTypeId,
            UserTypeCode = targetIdentity.UserTypeCode,
            EstablishmentId = targetIdentity.EstablishmentId,
            IndividualId = targetIdentity.IndividualId,
            EstablishmentName = targetIdentity.EstablishmentName,
            EstablishmentNameAr = targetIdentity.EstablishmentNameAr,
            LicenseNumber = targetIdentity.LicenseNumber
        };
    }

    private async Task<InspectionTaskTargetOverviewLimitedDto> BuildTargetOverviewIdentityAsync(InspectionTask task)
    {
        var result = new InspectionTaskTargetOverviewLimitedDto
        {
            EstablishmentId = task.EstablishmentId,
            IndividualId = task.IndividualId,
            EstablishmentName = NormalizeDisplayName(task.EstablishmentName),
            LicenseNumber = NormalizeDisplayName(task.TradeLicenseNumber)
        };

        if (task.EstablishmentId.HasValue)
        {
            var establishment = await _dbContext.Establishments
                .AsNoTracking()
                .Where(x => x.Id == task.EstablishmentId.Value)
                .Select(x => new
                {
                    x.Id,
                    x.LicenseNumber,
                    EstablishmentName = x.NameEn,
                    EstablishmentNameAr = x.NameAr
                })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            if (establishment != null)
            {
                result.EstablishmentId = establishment.Id;
                result.EstablishmentName = NormalizeDisplayName(establishment.EstablishmentName) ?? result.EstablishmentName;
                result.EstablishmentNameAr = NormalizeDisplayName(establishment.EstablishmentNameAr);
                result.LicenseNumber = NormalizeDisplayName(establishment.LicenseNumber) ?? result.LicenseNumber;
            }
        }

        TargetOverviewProfileProjection? profile = null;
        if (task.IndividualId.HasValue)
        {
            profile = await BuildUserProfileProjectionQuery()
                .Where(x => x.ProfileId == task.IndividualId.Value)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
        }

        if (profile == null && task.EstablishmentId.HasValue)
        {
            profile = await (
                    from link in _dbContext.UserEstablishments.AsNoTracking()
                    join userProfile in BuildUserProfileProjectionQuery()
                        on link.UserProfileId equals userProfile.ProfileId
                    where link.EstablishmentId == task.EstablishmentId.Value
                    orderby link.Id
                    select userProfile)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
        }

        if (profile != null)
        {
            result.ProfileId = profile.ProfileId;
            result.UserProfileId = profile.ProfileId;
            result.UserId = profile.UserId;
            result.UserTypeId = profile.UserTypeId;
            result.UserTypeCode = profile.UserTypeCode;
        }

        return result;
    }

    private IQueryable<TargetOverviewProfileProjection> BuildUserProfileProjectionQuery()
        => from profile in _dbContext.UserProfiles.AsNoTracking()
           join userType in _dbContext.UserTypes.AsNoTracking()
               on profile.UserTypeId equals userType.Id into userTypes
           from userType in userTypes.DefaultIfEmpty()
           select new TargetOverviewProfileProjection
           {
               ProfileId = profile.Id,
               UserId = profile.UserId,
               UserTypeId = profile.UserTypeId,
               UserTypeCode = userType != null ? userType.Code : null
           };

    private IQueryable<InspectionViolation> BuildRelatedViolationQuery(InspectionTask task)
    {
        var query = _dbContext.InspectionViolations
            .AsNoTracking()
            .Include(x => x.SourceTask)
            .Where(x => x.SourceTask != null);

        return task.TargetTypeId switch
        {
            (int)InspectionTargetType.Establishment when task.EstablishmentId.HasValue => query.Where(x => x.SourceTask!.EstablishmentId == task.EstablishmentId),
            (int)InspectionTargetType.Individual when task.IndividualId.HasValue => query.Where(x => x.SourceTask!.IndividualId == task.IndividualId),
            _ when task.SourceTypeId == (int)InspectionSourceType.ActivityBased && task.ActivityId.HasValue => query.Where(x => x.SourceTask!.ActivityId == task.ActivityId),
            _ => query.Where(x => x.SourceTask!.EstablishmentName == task.EstablishmentName || x.SourceTask!.FullName == task.FullName)
        };
    }

    private async Task<InspectionTaskReportDto> BuildReportAsync(InspectionTask task)
    {
        // violationAttachmentsPreloaded: GetReportAggregateAsync now ThenIncludes declaration
        // attachments on violations, so we can skip the separate InspectionViolationAttachments query.
        var declarationDocuments = await BuildTaskDeclarationDocumentsAsync(task, includeMockFallbacks: false, violationAttachmentsPreloaded: true).ConfigureAwait(false);
        var seizedMaterialTypeNames = await ResolveEnumTypeDictionaryNamesAsync(
            nameof(InspectionMaterialType),
            task.SeizedMaterials.Select(x => x.MaterialTypeId).Distinct().ToList()).ConfigureAwait(false);
        var review = BuildTaskReview(task, declarationDocuments, seizedMaterialTypeNames);
        var checklistAttachmentsByItemId = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.ChecklistEvidence.Matches(x.AttachmentCategory)
                        && InspectionTaskAttachmentRelatedEntityType.ChecklistItem.Matches(x.RelatedEntityType)
                        && x.RelatedEntityId.HasValue)
            .GroupBy(x => x.RelatedEntityId!.Value)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<InspectionAttachmentDto>)group
                    .OrderByDescending(x => x.UploadedAt)
                    .ThenByDescending(x => x.Id)
                    .Select(MapAttachment)
                    .ToList());
        var checklistEvidence = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.ChecklistEvidence.Matches(x.AttachmentCategory)
                        && InspectionTaskAttachmentRelatedEntityType.ChecklistItem.Matches(x.RelatedEntityType))
            .OrderByDescending(x => x.UploadedAt)
            .Select(MapAttachment)
            .ToList();
        var accessFailed = BuildAccessFailedReadProjection(task);
        var reportAttachments = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.InspectionReport.Matches(x.AttachmentCategory)
                        && InspectionTaskAttachmentRelatedEntityType.TaskExecution.Matches(x.RelatedEntityType))
            .OrderByDescending(x => x.UploadedAt)
            .Select(MapAttachment)
            .Where(x => !IsMockFileUrl(x.FileUrl))
            .ToList();

        var execution = task.Execution;
        var checkinTimeline = FindLatestTimelineEvent(task, "InspectionCheckIn");
        var checkoutTimeline = FindLatestTimelineEvent(task, "InspectionCheckedOut");
        var reportAttachment = reportAttachments.FirstOrDefault();
        var reportFileUrl = FirstNonEmpty(
            reportAttachment?.FileUrl,
            IsMockFileUrl(execution?.ReportFileUrl) ? null : execution?.ReportFileUrl);
        var reportFileName = FirstNonEmpty(
            reportAttachment?.FileName,
            reportFileUrl == null ? null : execution?.ReportFileName);
        var hasExecutionOutcome = task.StatusId == (int)InspectionTaskStatus.Completed
                                  || task.StatusId == (int)InspectionTaskStatus.AccessFailed
                                  || execution?.ReportSubmittedAt.HasValue == true
                                  || execution?.CheckoutAt.HasValue == true;
        var reportStatusCode = ResolveReportStatusCode(task, execution);

        var checklistCodes = task.ChecklistItems
            .Select(x => x.ChecklistCode)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();
        var violationDescriptionByCode = checklistCodes.Count > 0
            ? await _dbContext.InspectionChecklistTemplateItems
                .Where(t => checklistCodes.Contains(t.ChecklistCode) && !string.IsNullOrWhiteSpace(t.ViolationDescription))
                .GroupBy(t => t.ChecklistCode)
                .Select(g => new { Code = g.Key, Description = g.First().ViolationDescription })
                .ToDictionaryAsync(x => x.Code, x => x.Description!)
                .ConfigureAwait(false)
            : new Dictionary<string, string>();

        // Load ViolationNo from InspectionViolations keyed by ViolationTypeId.
        // CreateFromTaskReportAsync creates one InspectionViolation per type (Licensing / Content) per task.
        var violationNoRaw = await _dbContext.InspectionViolations
            .AsNoTracking()
            .Where(v => v.SourceTaskId == task.Id)
            .Select(v => new { v.ViolationTypeId, v.ViolationNo })
            .ToListAsync()
            .ConfigureAwait(false);
        var violationNoMap = violationNoRaw
            .GroupBy(x => x.ViolationTypeId)
            .ToDictionary(g => g.Key, g => g.First().ViolationNo);

        // Resolve accessOutcomeName from TypeDictionary[Scope="InspectionFieldAccessFailedReason"]
        // using AccessOutcomeCode as the lookup key. Falls back to the static-resolved name.
        var resolvedAccessOutcomeName = accessFailed.AccessOutcomeName;
        if (!string.IsNullOrWhiteSpace(accessFailed.AccessOutcomeCode))
        {
            var dictName = await _dbContext.TypeDictionaries
                .AsNoTracking()
                .Where(x => x.Scope == "InspectionFieldAccessFailedReason"
                             && x.Code == accessFailed.AccessOutcomeCode)
                .Select(x => x.NameEn)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(dictName))
                resolvedAccessOutcomeName = dictName;
        }

        // Resolve accessFailedReasonName from TypeDictionary based on InspectionMethodId:
        //   InspectionMethodId=1 (Field)   → Scope="InspectionFieldAccessFailedReason"
        //   InspectionMethodId=2 (Digital) → Scope="InspectionDigitalAccessFailedReason"
        var resolvedAccessFailedReasonName = accessFailed.AccessFailedReasonName;
        if (!string.IsNullOrWhiteSpace(accessFailed.AccessFailedReasonCode))
        {
            var reasonScope = task.InspectionMethodId == (int)InspectionMethod.DigitalInspection
                ? "InspectionDigitalAccessFailedReason"
                : "InspectionFieldAccessFailedReason";
            var reasonDictName = await _dbContext.TypeDictionaries
                .AsNoTracking()
                .Where(x => x.Scope == reasonScope && x.Code == accessFailed.AccessFailedReasonCode)
                .Select(x => x.NameEn)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(reasonDictName))
                resolvedAccessFailedReasonName = reasonDictName;
        }

        // Build ChecklistViolations once so we can also split by ViolationTypeId.
        var checklistViolations = task.ChecklistItems
            .GroupBy(x => x.Id)
            .Select(group => group.First())
            .Where(x => x.ResultId == (int)InspectionChecklistResult.Violation)
            .OrderBy(x => x.DisplayOrder ?? int.MaxValue)
            .ThenBy(x => x.RecordedAt)
            .ThenBy(x => x.Id)
            .SelectMany(checklistItem => checklistItem.Violations
                .GroupBy(violation => violation.Id)
                .Select(group => group.First())
                .Where(violation => violation.Reported == true)
                .OrderBy(violation => violation.Id)
                .Select(violation => new InspectionTaskReportChecklistViolationDto
                {
                    Id = violation.Id,
                    TaskChecklistItemId = checklistItem.Id,
                    ChecklistCode = checklistItem.ChecklistCode,
                    ChecklistName = checklistItem.ChecklistName,
                    ViolationDescription = violationDescriptionByCode.TryGetValue(violation.ViolationItemCode, out var vd) ? vd : null,
                    RecordedAt = checklistItem.RecordedAt,
                    ViolationItemId = violation.ViolationItemId,
                    ViolationItemCode = violation.ViolationItemCode,
                    ViolationTypeId = violation.ViolationTypeId,
                    ViolationNo = violationNoMap.TryGetValue(violation.ViolationTypeId, out var vno) ? vno : null,
                    FineAmount = violation.FineAmount,
                    Notes = violation.Notes,
                    Reported = violation.Reported,
                    CommitteeReview = violation.CommitteeReview,
                    Attachments = ResolveChecklistViolationAttachments(checklistAttachmentsByItemId, checklistItem.Id, violation.ViolationItemCode)
                }))
            .ToList();

        return new InspectionTaskReportDto
        {
            ReportStatusId = ResolveReportStatusId(reportStatusCode),
            ReportStatusCode = reportStatusCode,
            ReportNo = execution?.ReportSubmittedAt.HasValue == true ? $"RPT-{task.TaskNo}" : null,
            SubmittedOn = execution?.ReportSubmittedAt,
            SubmittedByName = execution?.UpdatedBy ?? task.UpdatedBy ?? task.CreatedBy,
            Summary = FirstNonEmpty(execution?.ReviewNote, execution?.ReinspectionNote),
            CheckinAt = execution?.CheckinAt ?? checkinTimeline?.CreatedOn,
            CheckinLat = execution?.CheckinLat,
            CheckinLng = execution?.CheckinLng,
            CheckinAddress = FirstNonEmpty(execution?.CheckinAddress, checkinTimeline?.LocationText),
            CheckoutAt = execution?.CheckoutAt ?? checkoutTimeline?.CreatedOn,
            CheckoutLat = execution?.CheckoutLat,
            CheckoutLng = execution?.CheckoutLng,
            CheckoutAddress = FirstNonEmpty(execution?.CheckoutAddress, checkoutTimeline?.LocationText),
            HasViolationFound = execution?.HasViolationFound,
            OutcomeCode = hasExecutionOutcome ? ResolveOutcomeCode(task) : null,
            OutcomeName = hasExecutionOutcome ? ResolveOutcomeName(task) : null,
            NeedsReinspection = execution?.NeedsReinspection,
            ReinspectionDueDate = execution?.ReinspectionDueDate,
            ReinspectionNote = execution?.ReinspectionNote,
            ChecklistItems = BuildChecklistReviewItems(task, checklistAttachmentsByItemId, violationOnly: false, violationDescriptionByCode: violationDescriptionByCode),
            ChecklistViolations = checklistViolations,
            LicenseViolations   = checklistViolations.Where(x => x.ViolationTypeId == (int)InspectionViolationType.Licensing).ToList(),
            LicenseViolationNo  = violationNoMap.TryGetValue((int)InspectionViolationType.Licensing, out var lvno) ? lvno : null,
            ContentViolations   = checklistViolations.Where(x => x.ViolationTypeId == (int)InspectionViolationType.Content).ToList(),
            ContentViolationNo  = violationNoMap.TryGetValue((int)InspectionViolationType.Content,   out var cvno) ? cvno : null,
            SeizedMaterials = review.SeizedMaterials,
            ContactPerson = review.ContactPerson,
            ChecklistEvidence = checklistEvidence,
            AccessFailedReport = task.StatusId == (int)InspectionTaskStatus.AccessFailed || accessFailed.Attachments.Count > 0
                ? new InspectionTaskAccessFailedReportDto
                {
                    AccessOutcomeCode = accessFailed.AccessOutcomeCode,
                    AccessOutcomeName = resolvedAccessOutcomeName,
                    AccessFailedReasonCode = accessFailed.AccessFailedReasonCode,
                    AccessFailedReasonName = resolvedAccessFailedReasonName,
                    AccessFailedRemark = accessFailed.AccessFailedRemark,
                    FailureReason = FirstNonEmpty(resolvedAccessFailedReasonName, accessFailed.AccessFailedReasonCode),
                    Attachments = accessFailed.Attachments,
                    AttachEvidence = accessFailed.Attachments,
                    IsMock = accessFailed.IsMock
                }
                : null,
            ReportAttachments = reportAttachments,
            PdfFileName = reportFileName,
            PdfFileUrl = reportFileUrl,
            DeclarationDocuments = declarationDocuments,
            IsMock = false
        };
    }

    private async Task<InspectionTaskExecutionResultDto> BuildExecutionResultAsync(InspectionTask task, IReadOnlyList<InspectionAttachmentDto> declarationDocuments)
    {
        var reinspectionTasks = await BuildReinspectionTasksAsync(task).ConfigureAwait(false);
        if (reinspectionTasks.Count == 0 && task.Execution?.NeedsReinspection == true)
        {
            reinspectionTasks.Add(new InspectionTaskReinspectionTaskDto
            {
                TaskId = 0,
                TaskNo = $"RE-{task.TaskNo}",
                StatusCode = MapTaskStatusCode((int)InspectionTaskStatus.PendingVisit),
                StatusName = MapTaskStatusName((int)InspectionTaskStatus.PendingVisit),
                DueDate = task.Execution.ReinspectionDueDate,
                IsMock = true
            });
        }

        return new InspectionTaskExecutionResultDto
        {
            OutcomeCode = ResolveOutcomeCode(task),
            OutcomeName = ResolveOutcomeName(task),
            ViolationCount = task.Violations.Count,
            NeedsReinspection = task.Execution?.NeedsReinspection,
            ReinspectionDueDate = task.Execution?.ReinspectionDueDate,
            ReinspectionNote = task.Execution?.ReinspectionNote,
            ViolationTickets = task.Violations
                .OrderByDescending(x => x.CreatedOn)
                .Select(x =>
                {
                    var latestContactPerson = task.ContactPersons
                        .OrderByDescending(c => c.SubmittedOn ?? c.CreatedOn)
                        .FirstOrDefault();
                    var declarationDocument = ResolveViolationDeclarationDocument(task, x, latestContactPerson, declarationDocuments);
                    var declarationToken = BuildDeclarationToken(x);

                    return new InspectionTaskViolationTicketDto
                    {
                        ViolationId = x.Id,
                        ViolationNo = x.ViolationNo,
                        TypeCode = MapViolationTypeCode(x.ViolationTypeId),
                        TypeName = MapViolationTypeName(x.ViolationTypeId),
                        StatusCode = MapViolationStatusCode(x.StatusId),
                        StatusName = MapViolationStatusName(x.StatusId),
                        FineAmount = x.FineAmount,
                        DeclarationStatusCode = ResolveDeclarationStatusCodeForContext(latestContactPerson, x),
                        DeclarationStatusName = ResolveDeclarationStatusNameForContext(latestContactPerson, x),
                        DeclarationRecipientAddress = x.DeclarationRecipientAddress,
                        DeclarationLinkSentOn = x.DeclarationLinkSentOn,
                        DeclarationLinkExpiresOn = x.DeclarationLinkExpiresOn,
                        DeclarationSubmittedOn = x.DeclarationSubmittedOn ?? latestContactPerson?.SignatureSignedOn ?? latestContactPerson?.SubmittedOn ?? declarationDocument?.UploadedAt,
                        DeclarationPortalUrl = BuildDeclarationPortalUrl(x, declarationToken),
                        DeclarationToken = declarationToken,
                        DeclarationDocumentFileName = declarationDocument?.FileName,
                        DeclarationDocumentFileUrl = declarationDocument?.FileUrl,
                        DeclarationIsMock = _inspectionDeclarationLinkService == null || declarationDocument?.Id == 0
                    };
                })
                .ToList(),
            ReinspectionTasks = reinspectionTasks,
            CheckoutOn = task.Execution?.CheckoutAt,
            CountsTowardInspectionInterval = task.CountsTowardInspectionInterval,
            IsMock = reinspectionTasks.Any(x => x.IsMock)
        };
    }

    private InspectionTaskDetailDto MapDetail(
        InspectionTask task,
        InspectionTaskReadProjection resolvedTask,
        string? createdByName,
        IReadOnlyList<InspectionAttachmentDto> declarationDocuments,
        AccessFailedReadProjection? accessFailed = null,
        InspectionTaskRiskProfile? riskProfile = null,
        int? profileId = null)
    {

        return new InspectionTaskDetailDto
        {
            Id = task.Id,
            TaskNo = task.TaskNo,
            TargetTypeId = task.TargetTypeId,
            TargetTypeCode = MapTargetTypeCode(task.TargetTypeId),
            TargetTypeName = MapTargetTypeName(task.TargetTypeId),
            SourceTypeId = task.SourceTypeId,
            SourceTypeCode = MapSourceTypeCode(task.SourceTypeId),
            SourceTypeName = MapSourceTypeName(task.SourceTypeId),
            InspectionMethodId = task.InspectionMethodId,
            InspectionMethodCode = MapInspectionMethodCode(task.InspectionMethodId),
            InspectionMethodName = MapInspectionMethodName(task.InspectionMethodId),
            StatusId = task.StatusId,
            StatusCode = MapTaskStatusCode(task.StatusId),
            StatusName = MapTaskStatusName(task.StatusId),
            ActivityId = task.ActivityId,
            ActivityName = resolvedTask.ActivityName,
            EstablishmentId = task.EstablishmentId,
            IndividualId = task.IndividualId,
            ProfileId = profileId,
            EstablishmentTypeId = task.EstablishmentTypeId,
            EstablishmentTypeName = resolvedTask.EstablishmentTypeName,
            EstablishmentName = resolvedTask.EstablishmentName,
            TradeLicenseNumber = task.TradeLicenseNumber,
            FullName = resolvedTask.FullName,
            EmiratesId = task.EmiratesId,
            Email = task.Email,
            Mobile = ContactNumberHelper.Compose(task.MobileCountryCode, task.MobileLocalNumber, task.Mobile),
            MobileCountryCode = task.MobileCountryCode,
            MobileLocalNumber = task.MobileLocalNumber,
            CurrentStepId = InspectionExecutionStepResolver.ResolveCurrentStepId(task) ?? 0,
            AccessOutcomeCode = accessFailed?.AccessOutcomeCode,
            AccessOutcomeName = accessFailed?.AccessOutcomeName,
            AccessFailedReasonCode = accessFailed?.AccessFailedReasonCode,
            AccessFailedReasonName = accessFailed?.AccessFailedReasonName,
            AccessFailedRemark = accessFailed?.AccessFailedRemark,
            AccessFailedAttachments = accessFailed != null ? accessFailed.Attachments.ToList() : new List<InspectionAttachmentDto>(),
            InspectionReasonId = task.InspectionReasonId,
            InspectionReasonName = resolvedTask.InspectionReasonName,
            PriorityId = task.PriorityId,
            PriorityName = resolvedTask.PriorityName,
            EmirateId = task.EmirateId,
            EmirateName = resolvedTask.EmirateName,
            AuthorityId = task.AuthorityId,
            AuthorityName = resolvedTask.AuthorityName,
            RegionId = task.RegionId,
            RegionName = resolvedTask.RegionName,
            CommunityId = task.CommunityId,
            CommunityName = resolvedTask.CommunityName,
            AreaStreet = task.AreaStreet,
            Latitude = task.Latitude,
            Longitude = task.Longitude,
            DueDate = task.DueDate,
            AssignedOn = task.AssignedOn,
            Remarks = task.Remarks,
            CancelReason = task.CancelReason,
            CountsTowardInspectionInterval = task.CountsTowardInspectionInterval,
            AssignmentState = task.Inspectors.Count == 0 ? "Unassigned" : "Assigned",
            ScopeCode = ResolveTaskScopeCode(task.StatusId, task.Inspectors.Count > 0),
            ReinspectionNo = task.ReinspectionNo,
            CreatedOn = task.CreatedOn,
            CreatedBy = task.CreatedBy,
            CreatedByName = createdByName,
            LastUpdatedOn = task.LastUpdatedOn,
            Inspectors = task.Inspectors
                .OrderByDescending(x => x.IsPrimary)
                .ThenBy(x => x.AssignedOn)
                .Select(x => new InspectionTaskInspectorDto
                {
                    Id = x.Id,
                    InspectorId = x.InspectorId,
                    InspectorName = x.InspectorName,
                    IsPrimary = x.IsPrimary,
                    AssignedOn = x.AssignedOn
                })
                .ToList(),
            Attachments = task.Attachments
                .Where(x => InspectionTaskAttachmentCategory.TaskAttachment.Matches(x.AttachmentCategory)
                            && InspectionTaskAttachmentRelatedEntityType.Task.Matches(x.RelatedEntityType))
                .OrderByDescending(x => x.UploadedAt)
                .Select(x => new InspectionAttachmentDto
                {
                    Id = x.Id,
                    RelatedEntityType = x.RelatedEntityType,
                    RelatedEntityId = x.RelatedEntityId,
                    RelatedEntityCode = x.RelatedEntityCode,
                    AttachmentCategory = x.AttachmentCategory,
                    FileName = x.FileName,
                    FileUrl = x.FileUrl,
                    ContentType = x.ContentType,
                    UploadedBy = x.UploadedBy,
                    UploadedAt = x.UploadedAt
                })
                .ToList(),
            ContactPersons = MapContactPersons(task, declarationDocuments, includeMockFallbacks: false),
            RiskProfile = riskProfile == null ? null : new InspectionTaskRiskProfileDto
            {
                Id                 = riskProfile.Id,
                TaskId             = riskProfile.TaskId,
                RiskScore          = riskProfile.RiskScore,
                RiskLevel          = riskProfile.RiskLevel,
                RiskDescription    = riskProfile.RiskDescription,
                LastAssessmentDate = riskProfile.LastAssessmentDate,
                CreatedOn          = riskProfile.CreatedOn,
                LastUpdatedOn      = riskProfile.LastUpdatedOn,
                CreatedBy          = riskProfile.CreatedBy,
                RiskFactors        = riskProfile.RiskFactors
                    .OrderBy(f => f.Id)
                    .Select(f => new InspectionTaskRiskFactorDto
                    {
                        Id                = f.Id,
                        FactorType        = f.FactorType,
                        FactorNameEn      = f.FactorNameEn,
                        FactorNameAr      = f.FactorNameAr,
                        ContributionScore = f.ContributionScore,
                        Details           = f.Details,
                    })
                    .ToList()
            }
        };
    }

    private static AccessFailedReadProjection BuildAccessFailedReadProjection(InspectionTask task)
    {
                        var timelineEvent = task.TimelineEvents
                            .Where(x => string.Equals(x.EventType, "InspectionAccessFailed", StringComparison.OrdinalIgnoreCase)
                                        || string.Equals(x.EventCode, "InspectionAccessFailed", StringComparison.OrdinalIgnoreCase))
                            .OrderByDescending(x => x.CreatedOn)
                            .ThenByDescending(x => x.Id)
                            .FirstOrDefault();

                        var accessOutcomeCode = FirstNonEmpty(
                            NormalizeDisplayName(task.Execution?.AccessOutcomeCode),
                            NormalizeDisplayName(timelineEvent?.ResultCode),
                            task.StatusId == (int)InspectionTaskStatus.AccessFailed ? "UnableToAccess" : null,
                            string.Equals(NormalizeDisplayName(timelineEvent?.Label), "Unable to access", StringComparison.OrdinalIgnoreCase)
                            || string.Equals(NormalizeDisplayName(timelineEvent?.Content), "Unable to access", StringComparison.OrdinalIgnoreCase)
                                ? "UnableToAccess"
                                : null);

                        var accessFailedReasonCode = FirstNonEmpty(
                            NormalizeDisplayName(task.Execution?.AccessFailedReasonCode),
                            NormalizeDisplayName(timelineEvent?.ReasonCode),
                            ExtractAccessFailedSegment(timelineEvent?.Content, "Reason"),
                            ExtractAccessFailedSegment(timelineEvent?.Label, "Reason"));

                        var accessFailedRemark = FirstNonEmpty(
                            NormalizeDisplayName(task.Execution?.AccessFailedRemark),
                            NormalizeDisplayName(timelineEvent?.ReasonText),
                            ExtractAccessFailedSegment(timelineEvent?.Content, "Remark"),
                            ExtractAccessFailedSegment(timelineEvent?.Label, "Remark"));

                        var attachments = ResolveAccessFailedAttachments(task);

                        return new AccessFailedReadProjection
                        {
                            AccessOutcomeCode = accessOutcomeCode,
                            AccessOutcomeName = ResolveAccessOutcomeName(accessOutcomeCode),
                            AccessFailedReasonCode = accessFailedReasonCode,
                            AccessFailedReasonName = ResolveAccessFailedReasonName(task.InspectionMethodId, accessFailedReasonCode),
                            AccessFailedRemark = accessFailedRemark,
                            Attachments = attachments,
                            IsMock = task.Execution == null && timelineEvent == null && attachments.Count == 0
                        };
                    }

                    private static string? ResolveAccessOutcomeName(string? accessOutcomeCode)
                    {
                        return NormalizeDisplayName(accessOutcomeCode) switch
                        {
                            null => null,
                            "UnableToAccess" => "Unable to access",
                            var code => code
                        };
                    }

                    private static string? ResolveAccessFailedReasonName(int inspectionMethodId, string? accessFailedReasonCode)
                    {
                        return NormalizeDisplayName(accessFailedReasonCode) switch
                        {
                            null => null,
                            "AddressNotFound" => "Address not found",
                            "PremisesClosed" or "EstablishmentClosed" => "Establishment closed",
                            "NoContactAvailable" => "No contact available",
                            "WebsiteSocialMediaAccountNotFound" => "Website/social media account not found",
                            "AccountInactive" => "Account inactive",
                            "AccessRestricted" => "Access restricted",
                            "Other" => "Other",
                            var code when inspectionMethodId == (int)InspectionMethod.FieldInspection && string.Equals(code, "WebsiteSocialMediaAccountNotFound", StringComparison.OrdinalIgnoreCase)
                                => "Website/social media account not found",
                            var code => code
                        };
                    }

                    private static string? ExtractAccessFailedSegment(string? text, string label)
                    {
                        var normalizedText = NormalizeDisplayName(text);
                        if (string.IsNullOrWhiteSpace(normalizedText))
                        {
                            return null;
                        }

                        var token = label + ":";
                        var startIndex = normalizedText.IndexOf(token, StringComparison.OrdinalIgnoreCase);
                        if (startIndex < 0)
                        {
                            return null;
                        }

                        startIndex += token.Length;
                        while (startIndex < normalizedText.Length && normalizedText[startIndex] == ' ')
                        {
                            startIndex++;
                        }

                        if (startIndex >= normalizedText.Length)
                        {
                            return null;
                        }

                        var endIndex = normalizedText.IndexOf('.', startIndex);
                        var value = (endIndex >= 0 ? normalizedText[startIndex..endIndex] : normalizedText[startIndex..]).Trim();
                        return string.IsNullOrWhiteSpace(value) ? null : value;
                    }

    private async Task<string?> ResolveCreatedByUserNameAsync(string? createdBy)
    {
        if (string.IsNullOrWhiteSpace(createdBy))
        {
            return createdBy;
        }

        var adminUser = await _dbContext.AdminUsers
            .AsNoTracking()
            .Where(x => x.Id == createdBy)
            .Select(x => new { x.FirstName, x.LastName, x.UserName })
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (adminUser != null)
        {
            var fullName = string.Join(" ", new[] { adminUser.FirstName, adminUser.LastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (!string.IsNullOrWhiteSpace(fullName))
            {
                return fullName;
            }

            return !string.IsNullOrWhiteSpace(adminUser.UserName) ? adminUser.UserName : createdBy;
        }

        return createdBy;
    }

    private static List<InspectionTaskTimelineItemDto> BuildProjectedTimeline(InspectionTask task)
    {
        var orderedTimelineEvents = task.TimelineEvents
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .ToList();

        if (orderedTimelineEvents.Count == 0)
        {
            return new List<InspectionTaskTimelineItemDto>();
        }

        var projectedItems = new List<ProjectedTaskTimelineItem>();
        var assignmentEventTypes = ResolveAssignmentEventTypes(orderedTimelineEvents);
        var hasQueuedEvent = orderedTimelineEvents.Any(x => string.Equals(ResolveTimelineRawEventType(x), "TaskQueued", StringComparison.Ordinal));
        var hasCheckInEvent = orderedTimelineEvents.Any(x => string.Equals(ResolveTimelineRawEventType(x), "InspectionCheckIn", StringComparison.Ordinal));
        var hasCheckedOutEvent = orderedTimelineEvents.Any(x => string.Equals(ResolveTimelineRawEventType(x), "InspectionCheckedOut", StringComparison.Ordinal));

        foreach (var timelineEvent in orderedTimelineEvents)
        {
            switch (ResolveTimelineRawEventType(timelineEvent))
            {
                case "TaskCreated":
                    if (!hasQueuedEvent && ShouldProjectQueuedEvent(task, timelineEvent))
                    {
                        projectedItems.Add(CreateProjectedTimelineItem(
                            timelineEvent,
                            normalizedEventCode: "TaskQueued",
                            displayTitle: "Task Queued",
                            sortOrder: 0,
                            overrideId: timelineEvent.Id == 0 ? 0 : -Math.Abs(timelineEvent.Id)));
                    }

                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: "TaskCreated",
                        displayTitle: "Task Created",
                        sortOrder: 1));
                    break;

                case "TaskQueued":
                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: "TaskQueued",
                        displayTitle: "Task Queued",
                        sortOrder: 0));
                    break;

                case "TaskAssigned":
                    var assignmentEventType = assignmentEventTypes.TryGetValue(timelineEvent.Id, out var resolvedAssignmentEventType)
                        ? resolvedAssignmentEventType
                        : "TaskAssigned";

                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: assignmentEventType,
                        displayTitle: string.Equals(assignmentEventType, "TaskReassigned", StringComparison.Ordinal)
                            ? "Task Reassigned"
                            : "Task Assigned"));
                    break;

                case "InspectionStarted":
                    if (!hasCheckInEvent)
                    {
                        projectedItems.Add(CreateProjectedTimelineItem(
                            timelineEvent,
                            normalizedEventCode: "InspectionStarted",
                            displayTitle: "Inspection Started"));
                    }
                    break;

                case "InspectionCheckIn":
                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: "InspectionStarted",
                        displayTitle: "Inspection Started"));
                    break;

                case "InspectionAccessFailed":
                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: "InspectionAccessFailed",
                        displayTitle: "Access Failed"));
                    break;

                case "InspectionCheckedOut":
                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: "InspectionCompleted",
                        displayTitle: "Inspection Completed"));
                    break;

                case "InspectionReportSubmitted":
                    if (!hasCheckedOutEvent)
                    {
                        projectedItems.Add(CreateProjectedTimelineItem(
                            timelineEvent,
                            normalizedEventCode: "InspectionCompleted",
                            displayTitle: "Inspection Completed"));
                    }
                    break;

                case "TaskCancelled":
                    projectedItems.Add(CreateProjectedTimelineItem(
                        timelineEvent,
                        normalizedEventCode: "TaskCancelled",
                        displayTitle: "Task Cancelled"));
                    break;
            }
        }

        var orderedProjectedItems = projectedItems
            .OrderByDescending(x => x.CreatedOn)
            .ThenBy(x => x.SortOrder)
            .ThenByDescending(x => x.Id)
            .ToList();

        ApplyProjectedTimelineDisplayFields(task, orderedProjectedItems);

        return orderedProjectedItems
            .Select(x => x.Item)
            .ToList();
    }

    private static void ApplyProjectedTimelineDisplayFields(InspectionTask task, List<ProjectedTaskTimelineItem> projectedItems)
    {
        var currentStatusItem = projectedItems.FirstOrDefault(x => ResolveProjectedStatusId(task, x) == task.StatusId)
            ?? projectedItems.FirstOrDefault();
        var currentOwner = ResolveTaskCurrentOwner(task);

        foreach (var projectedItem in projectedItems)
        {
            var item = projectedItem.Item;
            var actualActor = ResolveActualActor(projectedItem.SourceEvent);
            var pendingHandler = ResolvePendingHandler(task, projectedItem);
            var isCurrentStatusItem = currentStatusItem != null && ReferenceEquals(projectedItem, currentStatusItem);

            item.ActualActorName = actualActor?.UserName;
            item.PendingHandlerName = pendingHandler?.UserName;
            item.CurrentOwnerTypeCode = isCurrentStatusItem ? currentOwner?.TypeCode : null;
            item.CurrentOwnerSummary = isCurrentStatusItem ? currentOwner?.Summary : null;
            item.DisplayActor = ResolveProjectedDisplayActor(task, projectedItem, isCurrentStatusItem, actualActor, pendingHandler, currentOwner);
            item.DisplayActorSource = ResolveProjectedDisplayActorSource(task, projectedItem, isCurrentStatusItem, item.DisplayActor, pendingHandler, currentOwner);
            item.ResultCode = ResolveProjectedResultCode(task, projectedItem, item.ResultCode);
            item.DisplayTime = ResolveProjectedDisplayTime(task, projectedItem);
            item.DisplayDetails = ResolveProjectedDisplayDetails(task, projectedItem);
            item.DisplayLocation = ResolveProjectedDisplayLocation(task, projectedItem);
            item.DisplayStatusCode = ResolveProjectedDisplayStatusCode(task, projectedItem);
            item.Attachments = ResolveProjectedAttachments(task, projectedItem);
        }

        if (currentStatusItem != null)
        {
            currentStatusItem.Item.IsCurrentStatusEvent = true;
        }
    }

    private static Dictionary<int, string> ResolveAssignmentEventTypes(IReadOnlyList<InspectionTaskTimelineEvent> orderedTimelineEvents)
    {
        var eventTypes = new Dictionary<int, string>();
        string? previousPrimaryInspectorId = null;

        foreach (var timelineEvent in orderedTimelineEvents
                     .Where(x => string.Equals(ResolveTimelineRawEventType(x), "TaskAssigned", StringComparison.Ordinal))
                     .OrderBy(x => x.CreatedOn)
                     .ThenBy(x => x.Id))
        {
            var persistedEventCode = NormalizeOptional(timelineEvent.EventCode);
            if (string.Equals(persistedEventCode, "TaskAssigned", StringComparison.Ordinal)
                || string.Equals(persistedEventCode, "TaskReassigned", StringComparison.Ordinal))
            {
                eventTypes[timelineEvent.Id] = persistedEventCode!;

                var persistedPrimaryInspectorId = ResolveAssignmentPrimaryInspectorId(timelineEvent);
                if (!string.IsNullOrWhiteSpace(persistedPrimaryInspectorId))
                {
                    previousPrimaryInspectorId = persistedPrimaryInspectorId;
                }

                continue;
            }

            var primaryInspectorId = ResolveAssignmentPrimaryInspectorId(timelineEvent);
            var isReassigned = !string.IsNullOrWhiteSpace(previousPrimaryInspectorId)
                               && !string.IsNullOrWhiteSpace(primaryInspectorId)
                               && !string.Equals(previousPrimaryInspectorId, primaryInspectorId, StringComparison.OrdinalIgnoreCase);

            eventTypes[timelineEvent.Id] = isReassigned ? "TaskReassigned" : "TaskAssigned";

            if (!string.IsNullOrWhiteSpace(primaryInspectorId))
            {
                previousPrimaryInspectorId = primaryInspectorId;
            }
        }

        return eventTypes;
    }

    private static string? ResolveAssignmentPrimaryInspectorId(InspectionTaskTimelineEvent timelineEvent)
        => NormalizeDisplayName(timelineEvent.TargetHandlerUserId);

    private static TaskTimelineActorSnapshot? ResolveActualActor(InspectionTaskTimelineEvent timelineEvent)
    {
        var userId = NormalizeDisplayName(timelineEvent.ActorUserId);
        var userName = NormalizeDisplayName(timelineEvent.ActorUserName);

        return string.IsNullOrWhiteSpace(userId) && string.IsNullOrWhiteSpace(userName)
            ? null
            : new TaskTimelineActorSnapshot(userId, userName);
    }

    private static TaskTimelineHandlerSnapshot? ResolvePendingHandler(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
    {
        return projectedItem.Item.EventCode switch
        {
            "TaskQueued" => new TaskTimelineHandlerSnapshot("Automated", null, "Automated"),
            "TaskAssigned" or "TaskReassigned" => ResolvePendingHandlerFromTimelineEvent(projectedItem.SourceEvent),
            "InspectionStarted" => ResolveCurrentInspectorHandler(task, projectedItem.SourceEvent),
            _ => null
        };
    }

    private static TaskTimelineHandlerSnapshot? ResolvePendingHandlerFromTimelineEvent(InspectionTaskTimelineEvent timelineEvent)
    {
        var persistedTypeCode = NormalizeDisplayName(timelineEvent.TargetHandlerTypeCode);
        var persistedSummary = NormalizeDisplayName(timelineEvent.TargetHandlerUserName);
        var persistedUserId = NormalizeDisplayName(timelineEvent.TargetHandlerUserId);
        if (!string.IsNullOrWhiteSpace(persistedUserId) || !string.IsNullOrWhiteSpace(persistedSummary))
        {
            return new TaskTimelineHandlerSnapshot(
                FirstNonEmpty(persistedTypeCode, InferTimelineHandlerTypeCode(persistedSummary, persistedUserId)),
                persistedUserId,
                persistedSummary);
        }

        return null;
    }

    private static TaskTimelineHandlerSnapshot? ResolveCurrentInspectorHandler(InspectionTask task, InspectionTaskTimelineEvent timelineEvent)
    {
        var currentOwner = ResolveTaskCurrentOwner(task);
        if (currentOwner != null)
        {
            return new TaskTimelineHandlerSnapshot(currentOwner.TypeCode, currentOwner.UserId, currentOwner.Summary);
        }

        var actualActor = ResolveActualActor(timelineEvent);
        return actualActor == null
            ? null
            : new TaskTimelineHandlerSnapshot("User", actualActor.UserId, actualActor.UserName);
    }

    private static TaskTimelineCurrentOwnerSnapshot? ResolveTaskCurrentOwner(InspectionTask task)
    {
        var persistedCurrentOwner = ReadPersistedTaskCurrentOwner(task);
        if (persistedCurrentOwner != null)
        {
            return persistedCurrentOwner;
        }

        return ResolveDerivedTaskCurrentOwner(task);
    }

    private static TaskTimelineCurrentOwnerSnapshot? ReadPersistedTaskCurrentOwner(InspectionTask task)
    {
        var typeCode = NormalizeDisplayName(task.CurrentOwnerTypeCode);
        var userId = NormalizeDisplayName(task.CurrentOwnerUserId);
        var userName = NormalizeDisplayName(task.CurrentOwnerUserName);
        var summary = NormalizeDisplayName(task.CurrentOwnerSummary);

        return string.IsNullOrWhiteSpace(typeCode)
               && string.IsNullOrWhiteSpace(userId)
               && string.IsNullOrWhiteSpace(userName)
               && string.IsNullOrWhiteSpace(summary)
            ? null
            : new TaskTimelineCurrentOwnerSnapshot(
                FirstNonEmpty(typeCode, "User") ?? "User",
                userId,
                userName,
                FirstNonEmpty(summary, userName, userId) ?? string.Empty);
    }

    private static TaskTimelineCurrentOwnerSnapshot? ResolveDerivedTaskCurrentOwner(InspectionTask task)
    {
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
        var summary = string.Join(", ", orderedInspectors.Select(x => FirstNonEmpty(x.InspectorName, x.InspectorId)).Where(x => !string.IsNullOrWhiteSpace(x)));
        var typeCode = orderedInspectors.Count > 1 ? "MultipleInspectors" : "User";

        return new TaskTimelineCurrentOwnerSnapshot(
            typeCode,
            primaryInspector.InspectorId,
            FirstNonEmpty(primaryInspector.InspectorName, primaryInspector.InspectorId),
            summary);
    }

    private static bool ShouldProjectQueuedEvent(InspectionTask task, InspectionTaskTimelineEvent timelineEvent)
    {
        if (!ShouldWriteQueuedTimeline(task.SourceTypeId))
        {
            return false;
        }

        if (timelineEvent.ToStatusId == (int)InspectionTaskStatus.Queued)
        {
            return true;
        }

        return task.StatusId == (int)InspectionTaskStatus.Queued
               && !task.Inspectors.Any()
               && string.Equals(ResolveTimelineRawEventType(timelineEvent), "TaskCreated", StringComparison.Ordinal);
    }

    private static ProjectedTaskTimelineItem CreateProjectedTimelineItem(
        InspectionTaskTimelineEvent timelineEvent,
        string normalizedEventCode,
        string displayTitle,
        int sortOrder = 0,
        int? overrideId = null)
    {
        var item = MapTimeline(timelineEvent);
        item.Id = overrideId ?? item.Id;
        item.EventCode = normalizedEventCode;
        item.Title = displayTitle;

        return new ProjectedTaskTimelineItem(item, timelineEvent, item.CreatedOn, sortOrder, item.Id);
    }

    private static string? ResolveProjectedDisplayActor(
        InspectionTask task,
        ProjectedTaskTimelineItem projectedItem,
        bool isCurrentStatusItem,
        TaskTimelineActorSnapshot? actualActor,
        TaskTimelineHandlerSnapshot? pendingHandler,
        TaskTimelineCurrentOwnerSnapshot? currentOwner)
    {
        if (isCurrentStatusItem && ShouldUseCurrentOwnerDisplay(task.StatusId, projectedItem.Item.EventCode))
        {
            return NormalizeDisplayName(FirstNonEmpty(
                currentOwner?.Summary,
                currentOwner?.UserName,
                pendingHandler?.UserName,
                actualActor?.UserName));
        }

        if (ShouldUsePendingHandlerDisplay(projectedItem.Item.EventCode))
        {
            return NormalizeDisplayName(FirstNonEmpty(pendingHandler?.UserName, actualActor?.UserName));
        }

        return NormalizeDisplayName(actualActor?.UserName);
    }

    private static string ResolveProjectedDisplayActorSource(
        InspectionTask task,
        ProjectedTaskTimelineItem projectedItem,
        bool isCurrentStatusItem,
        string? displayActor,
        TaskTimelineHandlerSnapshot? pendingHandler,
        TaskTimelineCurrentOwnerSnapshot? currentOwner)
    {
        if (string.IsNullOrWhiteSpace(displayActor))
        {
            return "None";
        }

        if (isCurrentStatusItem && ShouldUseCurrentOwnerDisplay(task.StatusId, projectedItem.Item.EventCode)
            && !string.IsNullOrWhiteSpace(FirstNonEmpty(currentOwner?.Summary, currentOwner?.UserName)))
        {
            return "CurrentOwner";
        }

        if (ShouldUsePendingHandlerDisplay(projectedItem.Item.EventCode)
            && !string.IsNullOrWhiteSpace(pendingHandler?.UserName))
        {
            return "PendingHandler";
        }

        return "ActualActor";
    }

    private static bool ShouldUseCurrentOwnerDisplay(int taskStatusId, string eventType)
        => taskStatusId is (int)InspectionTaskStatus.Queued or (int)InspectionTaskStatus.PendingVisit or (int)InspectionTaskStatus.InProgress
           && eventType is "TaskQueued" or "TaskAssigned" or "TaskReassigned" or "InspectionStarted";

    private static bool ShouldUsePendingHandlerDisplay(string eventType)
        => eventType is "TaskAssigned" or "TaskReassigned" or "TaskQueued";

    private static DateTime ResolveProjectedDisplayTime(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
        => projectedItem.Item.EventCode switch
        {
            "InspectionStarted" when string.Equals(ResolveTimelineRawEventType(projectedItem.SourceEvent), "InspectionCheckIn", StringComparison.Ordinal)
                => task.Execution?.CheckinAt ?? projectedItem.Item.CreatedOn,
            "InspectionCompleted" when string.Equals(ResolveTimelineRawEventType(projectedItem.SourceEvent), "InspectionCheckedOut", StringComparison.Ordinal)
                => task.Execution?.CheckoutAt ?? projectedItem.Item.CreatedOn,
            "InspectionCompleted"
                => task.Execution?.ReportSubmittedAt ?? projectedItem.Item.CreatedOn,
            _ => projectedItem.Item.CreatedOn
        };

    private static string? ResolveProjectedDisplayDetails(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
    {
        return projectedItem.Item.EventCode switch
        {
            "TaskCreated" => null,
            "TaskQueued" => null,
            "TaskAssigned" => BuildAssignmentDisplayDetails(task, projectedItem, "Task Assigned to"),
            "TaskReassigned" => BuildAssignmentDisplayDetails(task, projectedItem, "Task Reassigned to"),
            "InspectionStarted" when string.Equals(ResolveTimelineRawEventType(projectedItem.SourceEvent), "InspectionCheckIn", StringComparison.Ordinal)
                => FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.Content), "Check-in completed."),
            "InspectionStarted" => FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.Content), projectedItem.Item.Title),
            "InspectionAccessFailed" => BuildAccessFailedDisplayDetails(task, projectedItem.SourceEvent),
            "InspectionCompleted" => FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.Content), BuildCompletedDisplayDetails(task)),
            "TaskCancelled" => BuildCancellationDisplayDetails(task, projectedItem.SourceEvent),
            _ => FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.Content), projectedItem.Item.Title)
        };
    }

    private static string? ResolveProjectedDisplayLocation(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
        => projectedItem.Item.EventCode switch
        {
            "InspectionStarted" => FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.LocationText), task.Execution?.CheckinAddress, FormatCoordinates(task.Execution?.CheckinLat, task.Execution?.CheckinLng)),
            "InspectionCompleted" => FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.LocationText), task.Execution?.CheckoutAddress, FormatCoordinates(task.Execution?.CheckoutLat, task.Execution?.CheckoutLng)),
            _ => null
        };

    private static string? ResolveProjectedDisplayStatusCode(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
    {
        var statusId = ResolveProjectedStatusId(task, projectedItem);
        return statusId.HasValue ? MapTaskStatusCode(statusId.Value) : null;
    }

    private static string? ResolveProjectedResultCode(InspectionTask task, ProjectedTaskTimelineItem projectedItem, string? currentResultCode)
    {
        var statusId = ResolveProjectedStatusId(task, projectedItem);
        if (statusId == (int)InspectionTaskStatus.Completed)
        {
            // Use the ResultCode stored at inspection time as the authoritative value.
            // It was written when the report was submitted / checkout was done and
            // reflects the actual inspection outcome regardless of any subsequent
            // violation status changes (e.g. appeals, cancellations).
            if (!string.IsNullOrWhiteSpace(currentResultCode))
                return currentResultCode;

            // Fallback: no stored value — derive from current violations (legacy data).
            return task.Violations.Any() ? "Violation Found" : "Compliant";
        }

        return currentResultCode;
    }

    private static List<InspectionAttachmentDto> ResolveProjectedAttachments(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
    {
        return projectedItem.Item.EventCode switch
        {
            "InspectionAccessFailed" => ResolveAccessFailedAttachments(task),
            _ => new List<InspectionAttachmentDto>()
        };
    }

    private static List<InspectionAttachmentDto> ResolveAccessFailedAttachments(InspectionTask task)
    {
        var attachments = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.AccessFailedEvidence.Matches(x.AttachmentCategory)
                        && IsAccessFailedAttachmentRelatedEntityType(x.RelatedEntityType))
            .OrderByDescending(x => x.UploadedAt)
            .ToList();

        if (attachments.Count == 0)
        {
            return new List<InspectionAttachmentDto>();
        }

        var executionId = task.Execution?.Id;
        var matchedExecutionAttachments = executionId.HasValue
            ? attachments.Where(x => x.RelatedEntityId == executionId.Value).ToList()
            : new List<InspectionTaskAttachment>();

        var effectiveAttachments = matchedExecutionAttachments.Count > 0
            ? matchedExecutionAttachments
            : attachments;

        return effectiveAttachments
            .Select(MapAccessFailedAttachment)
            .ToList();
    }

    private static bool IsAccessFailedAttachmentRelatedEntityType(string? relatedEntityType)
        => InspectionTaskAttachmentRelatedEntityType.TaskExecution.Matches(relatedEntityType)
           || string.Equals(relatedEntityType, nameof(InspectionTaskStatus.AccessFailed), StringComparison.OrdinalIgnoreCase);

    private static InspectionAttachmentDto MapAccessFailedAttachment(InspectionTaskAttachment attachment)
    {
        var mapped = MapAttachment(attachment);
        mapped.RelatedEntityType = InspectionTaskAttachmentRelatedEntityType.TaskExecution.GetValue();
        return mapped;
    }


    private static int? ResolveProjectedStatusId(InspectionTask task, ProjectedTaskTimelineItem projectedItem)
    {
        return projectedItem.Item.EventCode switch
        {
            "TaskQueued" => (int)InspectionTaskStatus.Queued,
            "TaskAssigned" or "TaskReassigned" => (int)InspectionTaskStatus.PendingVisit,
            "InspectionStarted" when string.Equals(ResolveTimelineRawEventType(projectedItem.SourceEvent), "InspectionCheckIn", StringComparison.Ordinal)
                => (int)InspectionTaskStatus.InProgress,
            "InspectionStarted" => projectedItem.SourceEvent.ToStatusId ?? (int)InspectionTaskStatus.PendingVisit,
            "InspectionAccessFailed" => (int)InspectionTaskStatus.AccessFailed,
            "InspectionCompleted" => (int)InspectionTaskStatus.Completed,
            "TaskCancelled" => (int)InspectionTaskStatus.Cancelled,
            "TaskCreated" => projectedItem.SourceEvent.ToStatusId is > -1 ? projectedItem.SourceEvent.ToStatusId : null,
            _ => projectedItem.SourceEvent.ToStatusId
        };
    }

    private static string? BuildAssignmentDisplayDetails(InspectionTask task, ProjectedTaskTimelineItem projectedItem, string prefix)
    {
        var primaryInspectorName = ResolvePendingHandlerFromTimelineEvent(projectedItem.SourceEvent)?.UserName
                                   ?? task.Inspectors.FirstOrDefault(x => string.Equals(x.InspectorId, projectedItem.SourceEvent.TargetHandlerUserId, StringComparison.OrdinalIgnoreCase))?.InspectorName
                                   ?? projectedItem.SourceEvent.TargetHandlerUserId;

        return string.IsNullOrWhiteSpace(primaryInspectorName)
            ? FirstNonEmpty(NormalizeDisplayName(projectedItem.SourceEvent.Content), projectedItem.Item.Title)
            : $"{prefix} {primaryInspectorName}.";
    }

    private static string BuildAccessFailedDisplayDetails(InspectionTask task, InspectionTaskTimelineEvent timelineEvent)
    {
        var persistedContent = NormalizeDisplayName(timelineEvent.Content);
        if (!string.IsNullOrWhiteSpace(persistedContent))
        {
            return persistedContent;
        }

        var reasonCode = FirstNonEmpty(NormalizeDisplayName(timelineEvent.ReasonCode), task.Execution?.AccessFailedReasonCode);
        var remark = FirstNonEmpty(NormalizeDisplayName(timelineEvent.ReasonText), task.Execution?.AccessFailedRemark);

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

        return NormalizeDisplayName(timelineEvent.Label) ?? "Unable to access.";
    }

    private static string BuildCompletedDisplayDetails(InspectionTask task)
    {
        var inspectionResult = task.Execution?.HasViolationFound switch
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

    private static string? BuildCancellationDisplayDetails(InspectionTask task, InspectionTaskTimelineEvent timelineEvent)
    {
        var persistedContent = NormalizeDisplayName(timelineEvent.Content);
        if (!string.IsNullOrWhiteSpace(persistedContent))
        {
            return persistedContent;
        }

        var cancelReason = FirstNonEmpty(NormalizeDisplayName(timelineEvent.ReasonText), task.CancelReason);
        return string.IsNullOrWhiteSpace(cancelReason)
            ? NormalizeDisplayName(timelineEvent.Label)
            : $"Reason: {cancelReason}";
    }

    private static string? FormatCoordinates(decimal? latitude, decimal? longitude)
        => latitude.HasValue && longitude.HasValue ? $"{latitude.Value}, {longitude.Value}" : null;

    private static string ResolveTimelineRawEventType(InspectionTaskTimelineEvent timelineEvent)
        => NormalizeDisplayName(FirstNonEmpty(timelineEvent.EventType, timelineEvent.EventCode)) ?? string.Empty;

    private static InspectionTaskReviewDto BuildTaskReview(
        InspectionTask task,
        IReadOnlyList<InspectionAttachmentDto> declarationDocuments,
        IReadOnlyDictionary<int, string>? seizedMaterialTypeNames = null,
        IReadOnlyDictionary<string, string>? violationDescriptionByCode = null)
    {
        var checklistAttachmentsByItemId = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.ChecklistEvidence.Matches(x.AttachmentCategory)
                        && InspectionTaskAttachmentRelatedEntityType.ChecklistItem.Matches(x.RelatedEntityType)
                        && x.RelatedEntityId.HasValue)
            .GroupBy(x => x.RelatedEntityId!.Value)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<InspectionAttachmentDto>)group
                    .OrderByDescending(x => x.UploadedAt)
                    .ThenByDescending(x => x.Id)
                    .Select(MapAttachment)
                    .ToList());

        var seizedMaterialAttachmentsByItemId = task.Attachments
            .Where(x => InspectionTaskAttachmentCategory.SeizedMaterialEvidence.Matches(x.AttachmentCategory)
                        && InspectionTaskAttachmentRelatedEntityType.SeizedMaterial.Matches(x.RelatedEntityType)
                        && x.RelatedEntityId.HasValue)
            .GroupBy(x => x.RelatedEntityId!.Value)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<InspectionAttachmentDto>)group
                    .OrderByDescending(x => x.UploadedAt)
                    .ThenByDescending(x => x.Id)
                    .Select(MapAttachment)
                    .ToList());

        var latestContactPerson = MapContactPersons(task, declarationDocuments, includeMockFallbacks: false)
            .OrderByDescending(x => x.SubmittedOn ?? x.DeclarationSubmittedOn)
            .FirstOrDefault();

        return new InspectionTaskReviewDto
        {
            TaskId = task.Id,
            ChecklistItems = BuildChecklistReviewItems(task, checklistAttachmentsByItemId, violationOnly: true, violationDescriptionByCode),
            SeizedMaterials = task.SeizedMaterials
                .GroupBy(x => x.Id)
                .Select(group => group.First())
                .OrderByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .Select(x => new InspectionTaskSeizedMaterialReviewItemDto
                {
                    Id = x.Id,
                    MaterialTypeId = x.MaterialTypeId,
                    MaterialTypeName = seizedMaterialTypeNames == null
                        ? null
                        : ResolveLookupName(seizedMaterialTypeNames, x.MaterialTypeId, null),
                    Isbn = x.Isbn,
                    Title = x.Title,
                    Author = x.Author,
                    LanguageId = x.LanguageId,
                    NumberOfCopy = x.NumberOfCopy,
                    Notes = x.Notes,
                    Attachments = seizedMaterialAttachmentsByItemId.TryGetValue(x.Id, out var attachments)
                        ? attachments.ToList()
                        : new List<InspectionAttachmentDto>()
                })
                .ToList(),
            ContactPerson = latestContactPerson
        };
    }

    private static List<InspectionTaskChecklistReviewItemDto> BuildChecklistReviewItems(
        InspectionTask task,
        IReadOnlyDictionary<int, IReadOnlyList<InspectionAttachmentDto>> checklistAttachmentsByItemId,
        bool violationOnly,
        IReadOnlyDictionary<string, string>? violationDescriptionByCode = null)
    {
        var checklistItems = task.ChecklistItems
            .GroupBy(x => x.Id)
            .Select(group => group.First());

        if (violationOnly)
        {
            checklistItems = checklistItems.Where(x => x.ResultId == (int)InspectionChecklistResult.Violation);
        }

        return checklistItems
            .OrderBy(x => x.DisplayOrder ?? int.MaxValue)
            .ThenBy(x => x.RecordedAt)
            .ThenBy(x => x.Id)
            .Select(x => new InspectionTaskChecklistReviewItemDto
            {
                Id = x.Id,
                ChecklistCode = x.ChecklistCode,
                ChecklistName = x.ChecklistName,
                ViolationDescription = violationDescriptionByCode != null && violationDescriptionByCode.TryGetValue(x.ChecklistCode, out var desc) ? desc : null,
                ResultId = x.ResultId,
                Notes = x.Notes,
                DisplayOrder = x.DisplayOrder,
                RecordedAt = x.RecordedAt,
                Violations = x.Violations
                    .GroupBy(v => v.Id)
                    .Select(group => group.First())
                    .Where(v => v.Reported == true)
                    .OrderBy(v => v.Id)
                    .Select(v => new InspectionTaskChecklistViolationReviewDto
                    {
                        Id = v.Id,
                        ViolationItemId = v.ViolationItemId,
                        ViolationItemCode = v.ViolationItemCode,
                        ViolationDescription = violationDescriptionByCode != null && violationDescriptionByCode.TryGetValue(v.ViolationItemCode, out var vd) ? vd : null,
                        ViolationTypeId = v.ViolationTypeId,
                        Degree = v.Degree ?? 0,
                        FineAmount = v.FineAmount,
                        Notes = v.Notes,
                        Reported = v.Reported,
                        CommitteeReview = v.CommitteeReview,
                        Attachments = ResolveChecklistViolationAttachments(checklistAttachmentsByItemId, x.Id, v.ViolationItemCode)
                    })
                    .ToList(),
                Attachments = ResolveChecklistItemAttachments(checklistAttachmentsByItemId, x.Id)
            })
            .ToList();
    }

    private static List<InspectionAttachmentDto> ResolveChecklistItemAttachments(
        IReadOnlyDictionary<int, IReadOnlyList<InspectionAttachmentDto>> checklistAttachmentsByItemId,
        int checklistItemId)
        => checklistAttachmentsByItemId.TryGetValue(checklistItemId, out var attachments)
            ? attachments
                .Where(a => InspectionTaskAttachmentCategory.ChecklistEvidence.Matches(a.AttachmentCategory))
                .ToList()
            : new List<InspectionAttachmentDto>();

    private static List<InspectionAttachmentDto> ResolveChecklistViolationAttachments(
        IReadOnlyDictionary<int, IReadOnlyList<InspectionAttachmentDto>> checklistAttachmentsByItemId,
        int checklistItemId,
        string violationItemCode)
        => checklistAttachmentsByItemId.TryGetValue(checklistItemId, out var attachments)
            ? attachments
                .Where(attachment => MatchesChecklistViolationAttachment(attachment, checklistItemId, violationItemCode))
                .ToList()
            : new List<InspectionAttachmentDto>();

    private static bool MatchesChecklistViolationAttachment(
        InspectionAttachmentDto attachment,
        int checklistItemId,
        string violationItemCode)
    {
        var hasMatchingCode = !string.IsNullOrWhiteSpace(attachment.RelatedEntityCode)
                              && string.Equals(attachment.RelatedEntityCode, violationItemCode, StringComparison.OrdinalIgnoreCase);

        if (attachment.RelatedEntityId == checklistItemId)
        {
            return hasMatchingCode || string.IsNullOrWhiteSpace(attachment.RelatedEntityCode);
        }

        return hasMatchingCode;
    }

    private static List<InspectionContactPersonDto> MapContactPersons(
        InspectionTask task,
        IReadOnlyList<InspectionAttachmentDto> declarationDocuments,
        bool includeMockFallbacks = true)
    {
        return task.ContactPersons
            .GroupBy(x => x.Id)
            .Select(group => group.First())
            .OrderByDescending(x => x.SubmittedOn ?? x.CreatedOn)
            .Select(x =>
            {
                var declarationDocument = ResolveDeclarationDocument(task, x, declarationDocuments, includeMockFallbacks);

                return new InspectionContactPersonDto
                {
                    Id = x.Id,
                    FullName = x.FullName,
                    Position = x.Position,
                    Mobile = ContactNumberHelper.Compose(x.MobileCountryCode, x.MobileLocalNumber, x.Mobile),
                    MobileCountryCode = x.MobileCountryCode,
                    MobileLocalNumber = x.MobileLocalNumber,
                    Email = x.Email,
                    EmiratesId = x.EmiratesId,
                    CollectedChannelCode = x.CollectedChannelCode,
                    SubmittedOn = x.SubmittedOn,
                    EidAttachmentFileName = x.EidAttachmentFileName,
                    EidAttachmentFileUrl = x.EidAttachmentFileUrl,
                    DeclarationAcknowledged = x.DeclarationAcknowledged,
                    HasSignedDeclaration = x.HasSignedDeclaration,
                    DeclarationDeclinedReason = x.DeclarationDeclinedReason,
                    SignatureImageFileName = includeMockFallbacks ? x.SignatureImageFileName ?? BuildMockSignatureFileName(task, x) : x.SignatureImageFileName,
                    SignatureImageFileUrl = includeMockFallbacks ? x.SignatureImageFileUrl ?? BuildMockSignatureFileUrl(task, x) : x.SignatureImageFileUrl,
                    SignatureSignedOn = x.SignatureSignedOn,
                    DeclarationStatusCode = ResolveDeclarationStatusCode(task, x),
                    DeclarationStatusName = ResolveDeclarationStatusName(task, x),
                    DeclarationDocumentFileName = declarationDocument?.FileName,
                    DeclarationDocumentFileUrl = declarationDocument?.FileUrl,
                    DeclarationSubmittedOn = ResolveTaskDeclarationSubmittedOn(task, x, declarationDocument),
                    IsMock = includeMockFallbacks && (declarationDocument?.Id == 0 || (x.HasSignedDeclaration == true && string.IsNullOrWhiteSpace(x.SignatureImageFileUrl)))
                };
            })
            .ToList();
    }

    private static InspectionAttachmentDto? ResolveDeclarationDocument(
        InspectionTask task,
        InspectionTaskContactPerson contactPerson,
        IReadOnlyList<InspectionAttachmentDto> declarationDocuments,
        bool includeMockFallbacks = true)
    {
        var relatedDocument = declarationDocuments
            .FirstOrDefault(x => x.RelatedEntityId == contactPerson.Id && (includeMockFallbacks || x.Id != 0));
 
        if (relatedDocument != null)
        {
            return relatedDocument;
        }
 
        if (!string.IsNullOrWhiteSpace(contactPerson.DeclarationDocumentFileName)
            && !string.IsNullOrWhiteSpace(contactPerson.DeclarationDocumentFileUrl))
        {
            return new InspectionAttachmentDto
            {
                Id = 0,
                RelatedEntityType = "DeclarationAcknowledgement",
                RelatedEntityId = contactPerson.Id,
                RelatedEntityCode = null,
                AttachmentCategory = InspectionTaskAttachmentCategory.DeclarationAcknowledgementDocument.GetValue(),
                FileName = contactPerson.DeclarationDocumentFileName,
                FileUrl = contactPerson.DeclarationDocumentFileUrl,
                UploadedBy = contactPerson.UpdatedBy ?? contactPerson.CreatedBy,
                UploadedAt = contactPerson.DeclarationDocumentGeneratedOn
                    ?? contactPerson.SignatureSignedOn
                    ?? contactPerson.SubmittedOn
                    ?? contactPerson.LastUpdatedOn
            };
        }
 
        if (includeMockFallbacks)
        {
            var fallbackDocument = declarationDocuments.FirstOrDefault(x => x.Id != 0) ?? declarationDocuments.FirstOrDefault();
            if (fallbackDocument != null)
            {
                return fallbackDocument;
            }
        }

        if (!includeMockFallbacks)
        {
            return null;
        }

        if (!contactPerson.DeclarationAcknowledged && contactPerson.HasSignedDeclaration != true && contactPerson.HasSignedDeclaration != false)
        {
            return null;
        }

        return new InspectionAttachmentDto
        {
            Id = 0,
            RelatedEntityType = "DeclarationAcknowledgement",
            RelatedEntityId = contactPerson.Id,
            RelatedEntityCode = null,
            AttachmentCategory = InspectionTaskAttachmentCategory.DeclarationAcknowledgementDocument.GetValue(),
            FileName = $"declaration-{task.TaskNo}-{contactPerson.Id}.pdf",
            FileUrl = $"/api/admin/inspection/mock-files/declarations/declaration-{task.TaskNo}-{contactPerson.Id}.pdf",
            UploadedBy = task.UpdatedBy ?? task.CreatedBy,
            UploadedAt = contactPerson.SignatureSignedOn ?? contactPerson.SubmittedOn ?? task.LastUpdatedOn
        };
    }

    private InspectionAttachmentDto? ResolveViolationDeclarationDocument(
        InspectionTask task,
        InspectionViolation violation,
        InspectionTaskContactPerson? contactPerson,
        IReadOnlyList<InspectionAttachmentDto> declarationDocuments)
    {
        var attachment = violation.Attachments
            .Where(x => InspectionTaskAttachmentCategory.DeclarationAcknowledgementDocument.Matches(x.AttachmentCategory))
            .OrderByDescending(x => x.UploadedAt)
            .Select(x => new InspectionAttachmentDto
            {
                Id = x.Id,
                RelatedEntityType = x.RelatedEntityType,
                RelatedEntityId = x.RelatedEntityId,
                RelatedEntityCode = null,
                AttachmentCategory = x.AttachmentCategory,
                FileName = x.FileName,
                FileUrl = x.FileUrl,
                ContentType = x.ContentType,
                UploadedBy = x.UploadedBy,
                UploadedAt = x.UploadedAt
            })
            .FirstOrDefault();

        if (attachment != null)
        {
            return attachment;
        }

        if (contactPerson != null)
        {
            return ResolveDeclarationDocument(task, contactPerson, declarationDocuments);
        }

        return declarationDocuments.FirstOrDefault();
    }

    private static string? BuildMockSignatureFileName(InspectionTask task, InspectionTaskContactPerson contactPerson)
        => contactPerson.HasSignedDeclaration == true
            ? $"signature-{task.TaskNo}-{contactPerson.Id}.png"
            : null;

    private static string? BuildMockSignatureFileUrl(InspectionTask task, InspectionTaskContactPerson contactPerson)
        => contactPerson.HasSignedDeclaration == true
            ? $"/api/admin/inspection/mock-files/signatures/signature-{task.TaskNo}-{contactPerson.Id}.png"
            : null;

    private static InspectionTaskTimelineItemDto MapTimeline(InspectionTaskTimelineEvent timeline)
    {
        var pendingHandler = ResolvePendingHandlerFromTimelineEvent(timeline);
        var actualActor = ResolveActualActor(timeline);
        var resolvedEventCode = ResolveTimelineEventCode(ResolveTimelineRawEventType(timeline));

        return new InspectionTaskTimelineItemDto
        {
            Id = timeline.Id,
            EventCode = resolvedEventCode,
            ResultCode = NormalizeDisplayName(timeline.ResultCode),
            Title = FirstNonEmpty(NormalizeDisplayName(timeline.EventName), NormalizeDisplayName(timeline.Label), ResolveTimelineEventName(resolvedEventCode)) ?? resolvedEventCode,
            FromStatusId = timeline.FromStatusId,
            ToStatusId = timeline.ToStatusId,
            ActualActorName = actualActor?.UserName,
            PendingHandlerName = pendingHandler?.UserName,
            CreatedOn = timeline.CreatedOn,
            DisplayActor = actualActor?.UserName,
            DisplayTime = timeline.CreatedOn
        };
    }

    private sealed record ProjectedTaskTimelineItem(
        InspectionTaskTimelineItemDto Item,
        InspectionTaskTimelineEvent SourceEvent,
        DateTime CreatedOn,
        int SortOrder,
        int Id);

    private sealed record TaskTimelineActorSnapshot(
        string? UserId,
        string? UserName);

    private sealed record TaskTimelineHandlerSnapshot(
        string? TypeCode,
        string? UserId,
        string? UserName);

    private sealed record TaskTimelineCurrentOwnerSnapshot(
        string TypeCode,
        string? UserId,
        string? UserName,
        string Summary);

    private sealed record DigitalPresenceApplicationDetailProjection(
        int Id,
        int ApplicationId);

    private sealed record DigitalPresenceMediaLicenseProjection(
        int Id,
        int ApplicationDetailId);

    private sealed record DigitalPresenceEconomicActivityProjection(
        int Id,
        int MedialLicenseId);

    private sealed record DigitalPresenceEconomicActivityExternalMediaAccountProjection(
        int Id,
        int MediaLicenseEconomicActivityId,
        int ExternalMediaAccountId);

    private sealed record DigitalPresenceExternalMediaAccountProjection(
        int Id,
        short SocialMediaId,
        string? DisplayName,
        string? WebsiteUrl);

    private sealed record DigitalPresenceSocialMediaProjection(
        short Id,
        string NameEn,
        string NameAr);


    private async Task<List<InspectionAttachmentDto>> BuildTaskDeclarationDocumentsAsync(
        InspectionTask task,
        bool includeMockFallbacks = true,
        bool violationAttachmentsPreloaded = false)
    {
        var declarationDocumentCategory = InspectionTaskAttachmentCategory.DeclarationAcknowledgementDocument.GetValue();
        var contactPersonDocuments = task.ContactPersons
            .GroupBy(x => x.Id)
            .Select(group => group.First())
            .Where(x => !string.IsNullOrWhiteSpace(x.DeclarationDocumentFileName)
                        && !string.IsNullOrWhiteSpace(x.DeclarationDocumentFileUrl))
            .OrderByDescending(x => x.DeclarationDocumentGeneratedOn ?? x.SignatureSignedOn ?? x.SubmittedOn ?? x.LastUpdatedOn)
            .ThenByDescending(x => x.Id)
            .Select(x => new InspectionAttachmentDto
            {
                Id = x.Id,
                RelatedEntityType = "DeclarationAcknowledgement",
                RelatedEntityId = x.Id,
                AttachmentCategory = declarationDocumentCategory,
                FileName = x.DeclarationDocumentFileName!,
                FileUrl = x.DeclarationDocumentFileUrl!,
                ContentType = "application/pdf",
                UploadedBy = x.UpdatedBy ?? x.CreatedBy,
                UploadedAt = x.DeclarationDocumentGeneratedOn ?? x.SignatureSignedOn ?? x.SubmittedOn ?? x.LastUpdatedOn
            })
            .ToList();

        // task.Violations is always eagerly loaded by all callers (via GetReportAggregateAsync,
        // GetReviewAggregateAsync, GetDetailAggregateAsync, GetAggregateAsync with Violations flag).
        // The former fallback DB re-query for violation IDs was redundant and has been removed.
        var violationIds = task.Violations.Select(x => x.Id).ToList();

        if (contactPersonDocuments.Count > 0 && violationIds.Count == 0)
        {
            return contactPersonDocuments;
        }

        if (violationIds.Count == 0)
        {
            if (!includeMockFallbacks)
            {
                return new List<InspectionAttachmentDto>();
            }

            return new List<InspectionAttachmentDto>
            {
                new()
                {
                    Id = 0,
                    RelatedEntityType = "DeclarationAcknowledgement",
                    RelatedEntityId = task.ContactPersons.OrderByDescending(x => x.Id).Select(x => (int?)x.Id).FirstOrDefault(),
                    AttachmentCategory = declarationDocumentCategory,
                    FileName = $"declaration-{task.TaskNo}.pdf",
                    FileUrl = $"/api/admin/inspection/mock-files/declarations/declaration-{task.TaskNo}.pdf",
                    UploadedBy = task.UpdatedBy ?? task.CreatedBy,
                    UploadedAt = task.LastUpdatedOn
                }
            };
        }

        List<InspectionAttachmentDto> attachments;
        if (violationAttachmentsPreloaded)
        {
            // Violation attachments (filtered to declaration category) were already ThenIncluded
            // in the aggregate query — no extra DB round-trip needed.
            attachments = task.Violations
                .SelectMany(v => v.Attachments)
                .OrderByDescending(x => x.UploadedAt)
                .Select(x => new InspectionAttachmentDto
                {
                    Id = x.Id,
                    RelatedEntityType = x.RelatedEntityType,
                    RelatedEntityId = x.RelatedEntityId,
                    RelatedEntityCode = null,
                    AttachmentCategory = x.AttachmentCategory,
                    FileName = x.FileName,
                    FileUrl = x.FileUrl,
                    ContentType = x.ContentType,
                    UploadedBy = x.UploadedBy,
                    UploadedAt = x.UploadedAt
                })
                .ToList();
        }
        else
        {
            attachments = await _dbContext.InspectionViolationAttachments
                .AsNoTracking()
                .Where(x => violationIds.Contains(x.ViolationId)
                            && x.AttachmentCategory == declarationDocumentCategory)
                .OrderByDescending(x => x.UploadedAt)
                .Select(x => new InspectionAttachmentDto
                {
                    Id = x.Id,
                    RelatedEntityType = x.RelatedEntityType,
                    RelatedEntityId = x.RelatedEntityId,
                    RelatedEntityCode = null,
                    AttachmentCategory = x.AttachmentCategory,
                    FileName = x.FileName,
                    FileUrl = x.FileUrl,
                    ContentType = x.ContentType,
                    UploadedBy = x.UploadedBy,
                    UploadedAt = x.UploadedAt
                })
                .ToListAsync()
                .ConfigureAwait(false);
        }

        if (contactPersonDocuments.Count > 0)
        {
            return contactPersonDocuments
                .Concat(attachments.Where(attachment => !contactPersonDocuments.Any(contactDocument =>
                    string.Equals(contactDocument.FileName, attachment.FileName, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(contactDocument.FileUrl, attachment.FileUrl, StringComparison.OrdinalIgnoreCase))))
                .ToList();
        }

        if (attachments.Count > 0)
        {
            return attachments;
        }

        if (!includeMockFallbacks)
        {
            return new List<InspectionAttachmentDto>();
        }

        return new List<InspectionAttachmentDto>
        {
            new()
            {
                Id = 0,
                RelatedEntityType = "DeclarationAcknowledgement",
                RelatedEntityId = task.ContactPersons.OrderByDescending(x => x.Id).Select(x => (int?)x.Id).FirstOrDefault(),
                AttachmentCategory = declarationDocumentCategory,
                FileName = $"declaration-{task.TaskNo}.pdf",
                FileUrl = $"/api/admin/inspection/mock-files/declarations/declaration-{task.TaskNo}.pdf",
                UploadedBy = task.UpdatedBy ?? task.CreatedBy,
                UploadedAt = task.LastUpdatedOn
            }
        };
    }


    private async Task<List<InspectionTaskReinspectionTaskDto>> BuildReinspectionTasksAsync(InspectionTask task)
    {
        var violationIds = task.Violations.Select(x => x.Id).ToList();
        return await _dbContext.InspectionTasks
            .AsNoTracking()
            .Where(x => x.RelatedTaskId == task.Id || (x.RelatedViolationId.HasValue && violationIds.Contains(x.RelatedViolationId.Value)))
            .OrderByDescending(x => x.CreatedOn)
            .Select(x => new InspectionTaskReinspectionTaskDto
            {
                TaskId = x.Id,
                TaskNo = x.TaskNo,
                StatusCode = MapTaskStatusCode(x.StatusId),
                StatusName = MapTaskStatusName(x.StatusId),
                DueDate = x.DueDate,
                IsMock = false
            })
            .ToListAsync()
            .ConfigureAwait(false);
    }

    private async Task<List<InspectionTaskValidationRecentTaskDto>> FindRecentTasksAsync(CreateInspectionTaskRequestDto request)
    {
        var cutoff = request.DueDate.Date.AddDays(-90);
        var query = _dbContext.InspectionTasks.AsNoTracking().Where(x => x.CreatedOn >= cutoff);

        query = request.TargetTypeId switch
        {
            (int)InspectionTargetType.Establishment when request.EstablishmentId.HasValue => query.Where(x => x.EstablishmentId == request.EstablishmentId),
            (int)InspectionTargetType.Individual when request.IndividualId.HasValue => query.Where(x => x.IndividualId == request.IndividualId),
            _ when request.SourceTypeId == (int)InspectionSourceType.ActivityBased && request.ActivityId.HasValue => query.Where(x => x.ActivityId == request.ActivityId),
            _ => query.Where(x => false)
        };

        return await query
            .OrderByDescending(x => x.CreatedOn)
            .Take(5)
            .Select(x => new
            {
                TaskId = x.Id,
                TaskNo = x.TaskNo,
                DueDate = x.DueDate,
                StatusId = x.StatusId
            })
            .ToListAsync()
            .ContinueWith(task => task.Result
                .Select(x => new InspectionTaskValidationRecentTaskDto
                {
                    TaskId = x.TaskId,
                    TaskNo = x.TaskNo,
                    DueDate = x.DueDate,
                    StatusCode = MapTaskStatusCode(x.StatusId),
                    StatusName = MapTaskStatusName(x.StatusId)
                })
                .ToList())
            .ConfigureAwait(false);
    }

    private static IQueryable<InspectionTask> ApplySameTargetFilter(IQueryable<InspectionTask> query, InspectionTask task)
    {
        return task.TargetTypeId switch
        {
            (int)InspectionTargetType.Establishment when task.EstablishmentId.HasValue => query.Where(x => x.EstablishmentId == task.EstablishmentId),
            (int)InspectionTargetType.Individual when task.IndividualId.HasValue => query.Where(x => x.IndividualId == task.IndividualId),
            _ when task.SourceTypeId == (int)InspectionSourceType.ActivityBased && task.ActivityId.HasValue => query.Where(x => x.ActivityId == task.ActivityId),
            _ => query.Where(x => x.EstablishmentName == task.EstablishmentName || x.FullName == task.FullName)
        };
    }

    private static InspectionAttachmentDto MapAttachment(InspectionTaskAttachment x)
        => new()
        {
            Id = x.Id,
            RelatedEntityType = x.RelatedEntityType,
            RelatedEntityId = x.RelatedEntityId,
            RelatedEntityCode = x.RelatedEntityCode,
            AttachmentCategory = x.AttachmentCategory,
            FileName = x.FileName,
            FileUrl = x.FileUrl,
            ContentType = x.ContentType,
            UploadedBy = x.UploadedBy,
            UploadedAt = x.UploadedAt
        };

    private static InspectionTaskTimelineEvent? FindLatestTimelineEvent(InspectionTask task, params string[] eventTypes)
        => task.TimelineEvents
            .Where(x => eventTypes.Any(eventType => string.Equals(x.EventType, eventType, StringComparison.OrdinalIgnoreCase)
                                                    || string.Equals(x.EventCode, eventType, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .FirstOrDefault();

    private static bool IsMockFileUrl(string? fileUrl)
        => !string.IsNullOrWhiteSpace(fileUrl)
           && fileUrl.Contains("/mock-files/", StringComparison.OrdinalIgnoreCase);

    private static string ResolveReportStatusCode(InspectionTask task, InspectionTaskExecution? execution)
    {
        if (task.StatusId == (int)InspectionTaskStatus.AccessFailed) return "AccessFailed";
        if (task.StatusId == (int)InspectionTaskStatus.Completed) return "Completed";
        if (execution?.ReportSubmittedAt.HasValue == true) return "Submitted";
        if (!string.IsNullOrWhiteSpace(execution?.ReportFileName) || !string.IsNullOrWhiteSpace(execution?.ReinspectionNote)) return "Draft";
        return "NotStarted";
    }

    private static int ResolveReportStatusId(string reportStatusCode)
        => reportStatusCode switch
        {
            "NotStarted" => 1,
            "Draft" => 2,
            "Submitted" => 3,
            "Completed" => 4,
            "AccessFailed" => 5,
            _ => 0
        };

    private static string BuildTaskReportSummary(InspectionTask task)
        => task.StatusId == (int)InspectionTaskStatus.AccessFailed
            ? "Access failed report is available for review."
            : task.Violations.Count > 0
                ? $"Inspection completed with {task.Violations.Count} related violation(s)."
                : "Inspection completed without recorded violations.";

    private static string ResolveOutcomeCode(InspectionTask task)
    {
        if (task.StatusId == (int)InspectionTaskStatus.AccessFailed) return "AccessFailed";
        if (task.Violations.Count == 0) return "NoViolation";
        if (task.Violations.Any(x => x.FineAmount > 0)) return "FineIssued";
        return "WarningIssued";
    }

    private static string ResolveOutcomeName(InspectionTask task)
        => ResolveOutcomeCode(task) switch
        {
            "AccessFailed" => "Access Failed",
            "FineIssued" => "Fine Issued",
            "WarningIssued" => "Warning Issued",
            _ => "No Violation"
        };

    private static string ResolveDeclarationStatusCode(InspectionTask task, InspectionTaskContactPerson contactPerson)
    {
        var latestViolation = task.Violations
            .OrderByDescending(x => x.DeclarationSubmittedOn ?? x.DeclarationLinkSentOn ?? x.LastUpdatedOn)
            .FirstOrDefault();

        return ResolveDeclarationStatusCode(contactPerson, latestViolation);
    }

    private static string ResolveDeclarationStatusCode(InspectionTaskContactPerson contactPerson, InspectionViolation? violation)
    {
        if (contactPerson.HasSignedDeclaration == true) return "Signed";
        if (contactPerson.HasSignedDeclaration == false) return "Declined";
        if (violation?.DeclarationLinkExpiresOn.HasValue == true && DateTimeHelper.Now > violation.DeclarationLinkExpiresOn.Value) return "ExpiredReadOnly";
        if (violation?.DeclarationLinkSentOn.HasValue == true || contactPerson.DeclarationAcknowledged) return "PendingSignature";
        return "NotInitiated";
    }

    private static string ResolveDeclarationStatusCodeForContext(InspectionTaskContactPerson? contactPerson, InspectionViolation? violation)
    {
        if (contactPerson == null)
        {
            if (violation?.DeclarationLinkExpiresOn.HasValue == true && DateTimeHelper.Now > violation.DeclarationLinkExpiresOn.Value) return "ExpiredReadOnly";
            if (violation?.DeclarationLinkSentOn.HasValue == true) return "PendingSignature";
            return "NotInitiated";
        }

        return ResolveDeclarationStatusCode(contactPerson, violation);
    }

    private static string ResolveDeclarationStatusName(InspectionTask task, InspectionTaskContactPerson contactPerson)
        => ResolveDeclarationStatusCode(task, contactPerson) switch
        {
            "Signed" => "Signed",
            "Declined" => "Declined",
            "ExpiredReadOnly" => "Expired (Read Only)",
            "PendingSignature" => "Pending Signature",
            _ => "Not Initiated"
        };

    private static string ResolveDeclarationStatusNameForContext(InspectionTaskContactPerson? contactPerson, InspectionViolation? violation)
        => ResolveDeclarationStatusCodeForContext(contactPerson, violation) switch
        {
            "Signed" => "Signed",
            "Declined" => "Declined",
            "ExpiredReadOnly" => "Expired (Read Only)",
            "PendingSignature" => "Pending Signature",
            _ => "Not Initiated"
        };

    private static DateTime? ResolveTaskDeclarationSubmittedOn(
        InspectionTask task,
        InspectionTaskContactPerson contactPerson,
        InspectionAttachmentDto? declarationDocument)
        => contactPerson.DeclarationDocumentGeneratedOn
           ?? contactPerson.SignatureSignedOn
           ?? task.Violations
               .Where(x => x.DeclarationSubmittedOn.HasValue)
               .OrderByDescending(x => x.DeclarationSubmittedOn)
               .Select(x => x.DeclarationSubmittedOn)
               .FirstOrDefault()
           ?? contactPerson.SubmittedOn
           ?? declarationDocument?.UploadedAt;

    private string? BuildDeclarationToken(InspectionViolation violation)
    {
        if (string.IsNullOrWhiteSpace(violation.DeclarationRecipientAddress) ||
            !violation.DeclarationLinkExpiresOn.HasValue)
        {
            return violation.DeclarationLinkSentOn.HasValue ? $"mock-token-{violation.Id}" : null;
        }

        if (_inspectionDeclarationLinkService == null)
        {
            return violation.DeclarationLinkSentOn.HasValue ? $"mock-token-{violation.Id}" : null;
        }

        return _inspectionDeclarationLinkService.GenerateToken(
            violation.Id,
            violation.DeclarationRecipientAddress,
            violation.DeclarationLinkExpiresOn.Value);
    }

    private string? BuildDeclarationPortalUrl(InspectionViolation violation, string? token)
    {
        if (!string.IsNullOrWhiteSpace(token) && _inspectionDeclarationLinkService != null)
        {
            return _inspectionDeclarationLinkService.BuildPortalUrl(token);
        }

        return violation.DeclarationLinkSentOn.HasValue
            ? $"https://admin.example.test/inspection/declarations/mock/{violation.Id}"
            : null;
    }

    private static string ResolveTaskScopeCode(int statusId, bool hasInspectors)
    {
        return statusId switch
        {
            (int)InspectionTaskStatus.Queued => "Queued",
            (int)InspectionTaskStatus.PendingVisit or (int)InspectionTaskStatus.InProgress => "Todo",
            (int)InspectionTaskStatus.Completed or (int)InspectionTaskStatus.AccessFailed or (int)InspectionTaskStatus.Cancelled => "Completed",
            _ when !hasInspectors => "Queued",
            _ => "Team"
        };
    }

    private static int ResolvePlannedTaskStatus(int currentStatusId, bool hasInspectors)
    {
        return currentStatusId switch
        {
            (int)InspectionTaskStatus.Queued or (int)InspectionTaskStatus.PendingVisit
                => hasInspectors ? (int)InspectionTaskStatus.PendingVisit : (int)InspectionTaskStatus.Queued,
            _ => currentStatusId
        };
    }

    private static string MapTaskStatusCode(int statusId)
        => statusId switch
        {
            (int)InspectionTaskStatus.Queued => nameof(InspectionTaskStatus.Queued),
            (int)InspectionTaskStatus.PendingVisit => nameof(InspectionTaskStatus.PendingVisit),
            (int)InspectionTaskStatus.InProgress => nameof(InspectionTaskStatus.InProgress),
            (int)InspectionTaskStatus.AccessFailed => nameof(InspectionTaskStatus.AccessFailed),
            (int)InspectionTaskStatus.Completed => nameof(InspectionTaskStatus.Completed),
            (int)InspectionTaskStatus.Cancelled => nameof(InspectionTaskStatus.Cancelled),
            _ => statusId.ToString()
        };

    private static string MapTaskStatusName(int statusId)
        => statusId switch
        {
            (int)InspectionTaskStatus.Queued => "Queued",
            (int)InspectionTaskStatus.PendingVisit => "Pending Visit",
            (int)InspectionTaskStatus.InProgress => "In Progress",
            (int)InspectionTaskStatus.AccessFailed => "Access Failed",
            (int)InspectionTaskStatus.Completed => "Completed",
            (int)InspectionTaskStatus.Cancelled => "Cancelled",
            _ => statusId.ToString()
        };

    private string MapTaskStatusNameLocalized(int statusId)
    {
        if (_currentUserService.IsArabicLanguage)
        {
            return statusId switch
            {
                (int)InspectionTaskStatus.Queued => "في قائمة الانتظار",
                (int)InspectionTaskStatus.PendingVisit => "بانتظار الزيارة",
                (int)InspectionTaskStatus.InProgress => "قيد التنفيذ",
                (int)InspectionTaskStatus.AccessFailed => "فشل الوصول",
                (int)InspectionTaskStatus.Completed => "مكتمل",
                (int)InspectionTaskStatus.Cancelled => "ملغى",
                _ => statusId.ToString()
            };
        }

        return MapTaskStatusName(statusId);
    }

    private static string MapTargetTypeCode(int targetTypeId)
        => targetTypeId switch
        {
            (int)InspectionTargetType.Establishment => nameof(InspectionTargetType.Establishment),
            (int)InspectionTargetType.Individual => nameof(InspectionTargetType.Individual),
            _ => targetTypeId.ToString()
        };

    private static string MapTargetTypeName(int targetTypeId)
        => targetTypeId switch
        {
            (int)InspectionTargetType.Establishment => "Establishment",
            (int)InspectionTargetType.Individual => "Individual",
            _ => targetTypeId.ToString()
        };

    private static string MapSourceTypeCode(int sourceTypeId)
        => sourceTypeId switch
        {
            (int)InspectionSourceType.Manual => nameof(InspectionSourceType.Manual),
            (int)InspectionSourceType.ActivityBased => nameof(InspectionSourceType.ActivityBased),
            _ => sourceTypeId.ToString()
        };

    private static string MapSourceTypeName(int sourceTypeId)
        => sourceTypeId switch
        {
            (int)InspectionSourceType.Manual => "Manual",
            (int)InspectionSourceType.ActivityBased => "Activity Based",
            _ => sourceTypeId.ToString()
        };

    private static string MapInspectionMethodCode(int methodId)
        => methodId switch
        {
            (int)InspectionMethod.FieldInspection => nameof(InspectionMethod.FieldInspection),
            (int)InspectionMethod.DigitalInspection => nameof(InspectionMethod.DigitalInspection),
            _ => methodId.ToString()
        };

    private string MapInspectionMethodName(int methodId)
    {
        if (_currentUserService.IsArabicLanguage)
        {
            return methodId switch
            {
                (int)InspectionMethod.FieldInspection => "التفتيش الميداني",
                (int)InspectionMethod.DigitalInspection => "التفتيش الرقمي",
                _ => methodId.ToString()
            };
        }

        return methodId switch
        {
            (int)InspectionMethod.FieldInspection => "Field Inspection",
            (int)InspectionMethod.DigitalInspection => "Digital Inspection",
            _ => methodId.ToString()
        };
    }

    private static string MapViolationTypeCode(int typeId)
        => typeId switch
        {
            (int)InspectionViolationType.Licensing => nameof(InspectionViolationType.Licensing),
            (int)InspectionViolationType.Content => nameof(InspectionViolationType.Content),
            _ => typeId.ToString()
        };

    private static string MapViolationTypeName(int typeId)
        => typeId switch
        {
            (int)InspectionViolationType.Licensing => "License Violation",
            (int)InspectionViolationType.Content => "Content Violation",
            _ => typeId.ToString()
        };

    private static string MapViolationStatusCode(int statusId)
        => statusId switch
        {
            (int)InspectionViolationStatus.WarningIssued => nameof(InspectionViolationStatus.WarningIssued),
            (int)InspectionViolationStatus.PendingRouting => nameof(InspectionViolationStatus.PendingRouting),
            (int)InspectionViolationStatus.PendingContentReport => nameof(InspectionViolationStatus.PendingContentReport),
            (int)InspectionViolationStatus.PendingReview => nameof(InspectionViolationStatus.PendingReview),
            (int)InspectionViolationStatus.PendingCommitteeDecision => nameof(InspectionViolationStatus.PendingCommitteeDecision),
            (int)InspectionViolationStatus.PendingPayment => nameof(InspectionViolationStatus.PendingPayment),
            (int)InspectionViolationStatus.UnderAppeal => nameof(InspectionViolationStatus.UnderAppeal),
            (int)InspectionViolationStatus.Paid => nameof(InspectionViolationStatus.Paid),
            (int)InspectionViolationStatus.Cancelled => nameof(InspectionViolationStatus.Cancelled),
            _ => statusId.ToString()
        };

    private static string MapViolationStatusName(int statusId)
        => statusId switch
        {
            (int)InspectionViolationStatus.WarningIssued => "Warning Issued",
            (int)InspectionViolationStatus.PendingRouting => "Pending Routing",
            (int)InspectionViolationStatus.PendingContentReport => "Pending Content Report",
            (int)InspectionViolationStatus.PendingReview => "Pending Review",
            (int)InspectionViolationStatus.PendingCommitteeDecision => "Pending Committee Decision",
            (int)InspectionViolationStatus.PendingPayment => "Pending Payment",
            (int)InspectionViolationStatus.UnderAppeal => "Under Appeal",
            (int)InspectionViolationStatus.Paid => "Paid",
            (int)InspectionViolationStatus.Cancelled => "Cancelled",
            _ => statusId.ToString()
        };
    
    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    /// <summary>
    /// Queries the person-related information for a given inspection task.
    /// <para>
    /// All branches return both Person-table records (where applicable) AND historical
    /// <c>InspectionTaskContactPersons</c> for the same inspection target (individual / establishment).
    /// Deduplication rules (applied after merging):
    /// <list type="number">
    ///   <item>Among contact persons: group by <c>FullName</c> (case-insensitive trim); keep the record
    ///   with the latest <c>CreatedOn</c> (or highest <c>Id</c> as tiebreaker).</item>
    ///   <item>Between Person-table records and contact persons: if a contact person shares the same name
    ///   as a Person record, the contact-person record wins (Person is excluded).</item>
    /// </list>
    /// </para>
    /// </summary>
    public async Task<IReadOnlyList<InspectionTaskPersonInfoDto>> GetPersonsAsync(int taskId)
    {
        // 1. Load the task
        var task = await _dbContext.InspectionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId)
            .ConfigureAwait(false);

        if (task == null)
            return Array.Empty<InspectionTaskPersonInfoDto>();

        // ── Individual branch ────────────────────────────────────────────────
        if (task.IndividualId.HasValue)
        {
            // IndividualId stores UserProfile.Id (profile ID). Resolve the person via profile.PersonId.
            var profileId = task.IndividualId.Value;

            var personId = await _dbContext.UserProfiles
                .AsNoTracking()
                .Where(up => up.Id == profileId)
                .Select(up => (int?)up.PersonId)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            List<int> personIds = personId.HasValue ? new List<int> { personId.Value } : new List<int>();

            var persons = personIds.Count > 0
                ? await _dbContext.Persons
                    .AsNoTracking()
                    .Where(p => personIds.Contains(p.Id) && !string.IsNullOrWhiteSpace(p.Name))
                    .ToListAsync()
                    .ConfigureAwait(false)
                : new List<Person>();

            // Also load all historical contact persons from tasks targeting the same individual (by profile ID)
            var contactPersons = await (
                    from cp in _dbContext.InspectionTaskContactPersons.AsNoTracking()
                    join t in _dbContext.InspectionTasks.AsNoTracking() on cp.TaskId equals t.Id
                    where t.IndividualId == profileId
                    select cp)
                .ToListAsync()
                .ConfigureAwait(false);

            return MergePersonsAndContacts(persons, contactPersons);
        }

        // ── Establishment branch ─────────────────────────────────────────────
        if (task.EstablishmentId.HasValue)
        {
            var establishmentId = task.EstablishmentId.Value;

            var userProfileIds = await _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(ue => ue.EstablishmentId == establishmentId)
                .Select(ue => ue.UserProfileId)
                .ToListAsync()
                .ConfigureAwait(false);

            var userProfiles = await _dbContext.UserProfiles
                .AsNoTracking()
                .Where(up => userProfileIds.Contains(up.Id))
                .ToListAsync()
                .ConfigureAwait(false);

            // Load all historical contact persons for the same establishment (all branches need them)
            var allEstablishmentContacts = await (
                    from cp in _dbContext.InspectionTaskContactPersons.AsNoTracking()
                    join t in _dbContext.InspectionTasks.AsNoTracking() on cp.TaskId equals t.Id
                    where t.EstablishmentId == establishmentId
                    select cp)
                .ToListAsync()
                .ConfigureAwait(false);

            var partnerUserTypeIds = new short[] { 2, 22, 20, 27 };
            var hasPartnerType = userProfiles.Any(up => partnerUserTypeIds.Contains(up.UserTypeId));

            if (hasPartnerType)
            {
                var partnerPersonIds = await _dbContext.EstablishmentPartners
                    .AsNoTracking()
                    .Where(ep => ep.EstablishmentId == establishmentId && ep.PersonId.HasValue)
                    .Select(ep => ep.PersonId!.Value)
                    .ToListAsync()
                    .ConfigureAwait(false);

                var profilePersonIds = userProfiles.Select(up => up.PersonId).ToList();
                var allPersonIds = partnerPersonIds.Union(profilePersonIds).Distinct().ToList();

                var persons = await _dbContext.Persons
                    .AsNoTracking()
                    .Where(p => allPersonIds.Contains(p.Id) && !string.IsNullOrWhiteSpace(p.Name))
                    .ToListAsync()
                    .ConfigureAwait(false);

                return MergePersonsAndContacts(persons, allEstablishmentContacts);
            }

            // Non-partner: return deduplicated establishment contact persons
            return MergePersonsAndContacts(Array.Empty<Person>(), allEstablishmentContacts);
        }

        // ── Fallback: no individual or establishment linked ──────────────────
        var fallbackContactPersons = await _dbContext.InspectionTaskContactPersons
            .AsNoTracking()
            .Where(cp => cp.TaskId == taskId)
            .ToListAsync()
            .ConfigureAwait(false);

        return MapLatestContactPersonsByName(fallbackContactPersons)
            .ToList();
    }

    /// <summary>
    /// Merges Person-table records with InspectionTaskContactPerson records.
    /// Contact persons are first deduplicated by name (case-insensitive trim, latest CreatedOn / highest Id wins).
    /// If a contact person shares the same name as a Person record, the contact-person entry wins.
    /// </summary>
    private static List<InspectionTaskPersonInfoDto> MergePersonsAndContacts(
        IEnumerable<Person> persons,
        IEnumerable<InspectionTaskContactPerson> contactPersons)
    {
        // Step 1: deduplicate contact persons by name, keep latest
        var latestContacts = contactPersons
            .Where(cp => !string.IsNullOrWhiteSpace(cp.FullName))
            .GroupBy(cp => cp.FullName.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(cp => cp.CreatedOn).ThenByDescending(cp => cp.Id).First())
            .ToList();

        // Step 2: build a name-set of winning contacts so we can exclude same-named Person records
        var contactNameSet = new HashSet<string>(
            latestContacts.Select(cp => cp.FullName.Trim()),
            StringComparer.OrdinalIgnoreCase);

        // Step 3: Person records not overridden by a contact with the same name
        var personDtos = persons
            .Where(p => !string.IsNullOrWhiteSpace(p.Name) && !contactNameSet.Contains(p.Name.Trim()))
            .Select(MapPersonToPersonInfoDto);

        return personDtos.Concat(latestContacts.Select(MapContactPersonToPersonInfoDto)).ToList();
    }

    private static InspectionTaskPersonInfoDto MapPersonToPersonInfoDto(Person person)
        => new()
        {
            PersonId = person.Id,
            Name = person.Name,
            SourceType = TaskPersonSourceType.Person,
            Position = person.Occupation,
            Mobile = ContactNumberHelper.Compose(person.MobileCountryCode, person.MobileLocalNumber, person.PersonalMobile),
            MobileCountryCode = person.MobileCountryCode,
            MobileLocalNumber = person.MobileLocalNumber,
            Email = person.PersonalEmail,
            EmiratesId = person.EmiratesId,
            EidAttachmentFileUrl = person.EmiratesIdCopyUrl,
            EidAttachmentFileName = string.IsNullOrWhiteSpace(person.EmiratesIdCopyUrl)
                ? null
                : System.IO.Path.GetFileName(person.EmiratesIdCopyUrl) is { Length: > 0 } fileName
                    ? fileName
                    : null
        };

    private static IEnumerable<InspectionTaskPersonInfoDto> MapLatestContactPersonsByName(IEnumerable<InspectionTaskContactPerson> contactPersons)
        => contactPersons
            .Where(cp => !string.IsNullOrWhiteSpace(cp.FullName))
            .GroupBy(cp => cp.FullName.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => group
                .OrderByDescending(cp => cp.CreatedOn)
                .ThenByDescending(cp => cp.Id)
                .First())
            .Select(MapContactPersonToPersonInfoDto);

    private static InspectionTaskPersonInfoDto MapContactPersonToPersonInfoDto(InspectionTaskContactPerson contactPerson)
        => new()
        {
            PersonId = contactPerson.Id,
            Name = contactPerson.FullName,
            SourceType = TaskPersonSourceType.ContactPerson,
            Position = contactPerson.Position,
            Mobile = ContactNumberHelper.Compose(contactPerson.MobileCountryCode, contactPerson.MobileLocalNumber, contactPerson.Mobile),
            MobileCountryCode = contactPerson.MobileCountryCode,
            MobileLocalNumber = contactPerson.MobileLocalNumber,
            Email = contactPerson.Email,
            EmiratesId = contactPerson.EmiratesId,
            CollectedChannelCode = contactPerson.CollectedChannelCode,
            EidAttachmentFileName = contactPerson.EidAttachmentFileName,
            EidAttachmentFileUrl = contactPerson.EidAttachmentFileUrl
        };

}

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using UMC.AdminPortal.Application.Dtos.Inspection;
using UMC.AdminPortal.Application.Services.Inspection;
using UMC.AdminPortal.Application.Services.InspectionDeclaration;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Service.Inspection;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.Repository;
using UMC.AdminPortal.Infrastructure.Repositorys;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Module.Attributes;
using UMC.AdminPortal.Domain.Serivces.Departments;
using UMC.AdminPortal.Application.Services.InspectionViolations.Notification;
using UMC.AdminPortal.Application.Services.InspectionViolations.Pdf;
using Microsoft.Extensions.Configuration;

namespace UMC.AdminPortal.Application.Services.InspectionViolations;

[InjectOnScoped]
public class InspectionViolationAppService : IInspectionViolationAppService
{
    private const string AppealReasonEnumScope = "AppealReasonEnum";
    private const int InspectionDepartmentId = 6;

    private static readonly int[] ActiveAppealStatusIds =
    {
        (int)InspectionAppealStatus.Pending,
        (int)InspectionAppealStatus.DepartmentProcessing,
        (int)InspectionAppealStatus.DepartmentProcessed,
        (int)InspectionAppealStatus.PendingCustomer
    };

    private static readonly InspectionViolationStatus[] OrderedTargetScopedViolationStatuses =
    {
        InspectionViolationStatus.WarningIssued,
        InspectionViolationStatus.PendingRouting,
        InspectionViolationStatus.PendingContentReport,
        InspectionViolationStatus.PendingReview,
        InspectionViolationStatus.PendingCommitteeDecision,
        InspectionViolationStatus.PendingApproval,
        InspectionViolationStatus.PendingPayment,
        InspectionViolationStatus.UnderAppeal,
        InspectionViolationStatus.Paid,
        InspectionViolationStatus.Cancelled
    };

    private readonly AdminPortalDBContext _dbContext;
    private readonly IInspectionViolationRepository _violationRepository;
    private readonly IBaseRepository<InspectionViolationTimelineEvent> _violationTimelineRepository;
    private readonly IInspectionViolationCatalogRepository _violationCatalogRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IInspectionDeclarationLinkService? _inspectionDeclarationLinkService;
    private readonly InspectionRandomRoleAssigneeResolver _randomRoleAssigneeResolver;
    private readonly IDepartmentService _departmentService;
    private readonly IViolationApprovalReportPdfService? _violationApprovalReportPdfService;
    private readonly IViolationReportCustomerNotificationService? _violationNotificationService;
    private readonly IViolationCancellationCustomerNotificationService? _violationCancellationNotificationService;
    private readonly IInspectionViolationStaffNotificationService? _staffNotificationService;
    private readonly IConfiguration? _configuration;
    private bool? _canManageViolations;

    public InspectionViolationAppService(
        AdminPortalDBContext dbContext,
        IInspectionViolationRepository violationRepository,
        IBaseRepository<InspectionViolationTimelineEvent> violationTimelineRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IDepartmentService departmentService,
        IPermissionService permissionService,
        IConfiguration? configuration = null,
        IViolationApprovalReportPdfService? violationApprovalReportPdfService = null,
        IViolationReportCustomerNotificationService? violationNotificationService = null,
        IViolationCancellationCustomerNotificationService? violationCancellationNotificationService = null,
        IInspectionViolationStaffNotificationService? staffNotificationService = null)
        : this(
            dbContext,
            violationRepository,
            violationTimelineRepository,
            new InspectionViolationCatalogRepository(dbContext),
            unitOfWork,
            currentUserService,
            permissionService,
            departmentService,
            null,
            configuration,
            violationApprovalReportPdfService,
            violationNotificationService,
            violationCancellationNotificationService,
            staffNotificationService)
    {
    }

    public InspectionViolationAppService(
        AdminPortalDBContext dbContext,
        IInspectionViolationRepository violationRepository,
        IBaseRepository<InspectionViolationTimelineEvent> violationTimelineRepository,
        IInspectionViolationCatalogRepository violationCatalogRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IDepartmentService departmentService,
        IInspectionDeclarationLinkService? inspectionDeclarationLinkService,
        IConfiguration? configuration = null,
        IViolationApprovalReportPdfService? violationApprovalReportPdfService = null,
        IViolationReportCustomerNotificationService? violationNotificationService = null,
        IViolationCancellationCustomerNotificationService? violationCancellationNotificationService = null,
        IInspectionViolationStaffNotificationService? staffNotificationService = null)
    {
        _dbContext = dbContext;
        _violationRepository = violationRepository;
        _violationTimelineRepository = violationTimelineRepository;
        _violationCatalogRepository = violationCatalogRepository;
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _permissionService = permissionService;
        _departmentService = departmentService;
        _inspectionDeclarationLinkService = inspectionDeclarationLinkService;
        _configuration = configuration;
        _violationApprovalReportPdfService = violationApprovalReportPdfService;
        _violationNotificationService = violationNotificationService;
        _violationCancellationNotificationService = violationCancellationNotificationService;
        _staffNotificationService = staffNotificationService;
_randomRoleAssigneeResolver = new InspectionRandomRoleAssigneeResolver(
new EFBaseRepository<Role>(dbContext),
new EFBaseRepository<UserRole>(dbContext),
new EFBaseRepository<User>(dbContext),
new EFBaseRepository<AdminUser>(dbContext),
configuration,
new EFBaseRepository<LeaveLogModel>(dbContext),
new EFBaseRepository<InspectionViolationHandler>(dbContext),
new EFBaseRepository<InspectionViolation>(dbContext));
    }

    public InspectionViolationAppService(
        AdminPortalDBContext dbContext,
        IInspectionViolationRepository violationRepository,
        IBaseRepository<InspectionViolationTimelineEvent> violationTimelineRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IDepartmentService departmentService,
        IInspectionDeclarationLinkService? inspectionDeclarationLinkService)
        : this(
            dbContext,
            violationRepository,
            violationTimelineRepository,
            new InspectionViolationCatalogRepository(dbContext),
            unitOfWork,
            currentUserService,
            permissionService,
            departmentService,
            inspectionDeclarationLinkService)
    {
    }

    public async Task<InspectionViolationListResponseDto> GetListAsync(InspectionViolationListRequestDto request)
    {
var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
var pageSize = request.PageSize <= 0 ? 20 : request.PageSize;
var isArabic = _currentUserService.IsArabicLanguage;
var visibilityContext = await BuildVisibilityContextAsync().ConfigureAwait(false);
        var actionContext = await BuildActionContextAsync().ConfigureAwait(false);
        var query = BuildViolationListQuery(request, visibilityContext);

        query = ApplySorting(query, request.SortBy, request.SortDirection);

        var totalCount = await query.CountAsync().ConfigureAwait(false);
        var rawItems = await query
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                Id = x.Id,
                ViolationNo = x.ViolationNo,
                TaskId = x.SourceTaskId,
                TaskNo = x.SourceTask != null ? x.SourceTask.TaskNo : null,
                ViolationTypeId = x.ViolationTypeId,
StatusId = x.StatusId,
ViolatorName = x.ViolatorName,
ViolatorIdentifier = x.ViolatorIdentifier,
ViolatorType = x.ViolatorType,
ReportedByUserId = x.ReportedByUserId,
                ReportedByName = x.ReportedByName,
                CreatedBy = x.CreatedBy,
                FineAmount = x.FineAmount,
                BeforeAppealAdjustedFineAmount = x.BeforeAppealAdjustedFineAmount,
	                AssignedContentId = x.AssignedContentId,
	                CreatedOn = x.CreatedOn,
	                LastUpdatedOn = x.LastUpdatedOn,
	                SlaDeadlineAt = x.SlaDeadlineAt,
	                SourceTaskInspectionReasonId = x.SourceTask != null ? x.SourceTask.InspectionReasonId : null,
	                SourceTaskStatusId = x.SourceTask != null ? (int?)x.SourceTask.StatusId : null,
	                SourceTaskDueDate = x.SourceTask != null ? (DateTime?)x.SourceTask.DueDate : null,
                SourceTaskCheckoutAt = x.SourceTask != null && x.SourceTask.Execution != null ? x.SourceTask.Execution.CheckoutAt : null,
                SourceTaskReportSubmittedAt = x.SourceTask != null && x.SourceTask.Execution != null ? x.SourceTask.Execution.ReportSubmittedAt : null,
SourceTaskLastUpdatedOn = x.SourceTask != null ? (DateTime?)x.SourceTask.LastUpdatedOn : null,
ViolationReportUrl = x.ViolationReportUrl,
SourceTaskEstablishmentId = x.SourceTask != null ? x.SourceTask.EstablishmentId : null,
SourceSnapshotEstablishmentId = x.SourceSnapshot != null ? x.SourceSnapshot.EstablishmentId : null,
SourceTaskIndividualId = x.SourceTask != null ? x.SourceTask.IndividualId : null,
SourceSnapshotIndividualId = x.SourceSnapshot != null ? x.SourceSnapshot.IndividualId : null
	})
	.ToListAsync()
.ConfigureAwait(false);

var violationStatusNames = await ResolveEnumTypeDictionaryNamesAsync(
	nameof(InspectionViolationStatus),
	CollectIds(rawItems.Select(x => (int?)x.StatusId)),
	preferArabic: isArabic)
.ConfigureAwait(false);
var inspectionReasonNames = await ResolveEnumTypeDictionaryNamesAsync(
	nameof(InspectionReason),
	CollectIds(rawItems.Select(x => x.SourceTaskInspectionReasonId)),
	preferArabic: isArabic)
.ConfigureAwait(false);

        // Resolve CreatedBy UUID -> FirstName + LastName from AdminUsers
        var createdByIds = rawItems
            .Select(x => x.CreatedBy?.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var createdByNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (createdByIds.Count > 0)
        {
            var adminUsers = await _dbContext.AdminUsers
                .AsNoTracking()
                .Where(u => createdByIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.UserName })
                .ToListAsync()
                .ConfigureAwait(false);
            foreach (var u in adminUsers)
            {
                var fullName = string.Join(" ", new[] { u.FirstName?.Trim(), u.LastName?.Trim() }
                    .Where(n => !string.IsNullOrWhiteSpace(n)));
                createdByNameMap[u.Id] = !string.IsNullOrWhiteSpace(fullName) ? fullName : (u.UserName ?? u.Id);
            }
        }

// Resolve Arabic establishment names for ViolatorName when Arabic is requested
var violatorNameArMap = new Dictionary<int, string>();
if (isArabic)
{
var establishmentIds = rawItems
	.Select(x => x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)
	.Where(x => x.HasValue && x.Value > 0)
	.Select(x => x!.Value)
	.Distinct()
	.ToList();
if (establishmentIds.Count > 0)
{
	var establishments = await _dbContext.Establishments
	.AsNoTracking()
	.Where(e => establishmentIds.Contains(e.Id))
	.Select(e => new { e.Id, e.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
	foreach (var e in establishments)
	{
	if (!string.IsNullOrWhiteSpace(e.NameAr))
	{
		violatorNameArMap[e.Id] = e.NameAr;
	}
	}
}
}

// Resolve person names for ViolatorName when violator is an individual.
// The individual FK on the task/snapshot is a UserProfiles.Id, NOT a Persons.Id, so
// resolve Core.Persons via Account.UserProfiles.PersonId. Map is keyed by UserProfile.Id
// and carries both languages so English is also served from Core.Persons (not the stale
// stored ViolatorName). English prefers Persons.Name, falling back to NameAr.
var violatorPersonNameMap = new Dictionary<int, (string? NameEn, string? NameAr)>();
{
var profileIds = rawItems
	.Select(x => x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)
	.Where(x => x.HasValue && x.Value > 0)
	.Select(x => x!.Value)
	.Distinct()
	.ToList();
if (profileIds.Count > 0)
{
var persons = await (from up in _dbContext.UserProfiles.AsNoTracking()
	where profileIds.Contains(up.Id) && up.PersonId != 0
	join p in _dbContext.Persons.AsNoTracking() on up.PersonId equals p.Id
	select new { ProfileId = up.Id, p.Name, p.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
foreach (var p in persons)
{
	violatorPersonNameMap[p.ProfileId] = (p.Name, p.NameAr);
}
}
}

// Fallback: violations whose SourceTask/SourceSnapshot carry no Individual/Establishment FK
// (e.g. internal or task-linked records where the party lives only in ViolatorName/ViolatorIdentifier).
// Resolve the Arabic name by matching ViolatorIdentifier against Core.Persons.EmiratesId (individuals)
// or Core.Establishments.LicenseNumber (establishments).
var violatorIdentifierPersonArMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
var violatorIdentifierEstArMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
if (isArabic)
{
var unresolvedIdentifiers = rawItems
	.Where(x => (x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId) is not > 0
	            && (x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId) is not > 0
	            && !string.IsNullOrWhiteSpace(x.ViolatorIdentifier))
	.Select(x => x.ViolatorIdentifier!.Trim())
	.Distinct(StringComparer.OrdinalIgnoreCase)
	.ToList();
if (unresolvedIdentifiers.Count > 0)
{
	var personsByEmiratesId = await _dbContext.Persons
	.AsNoTracking()
	.Where(p => p.EmiratesId != null && unresolvedIdentifiers.Contains(p.EmiratesId) && p.NameAr != null)
	.Select(p => new { p.EmiratesId, p.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
	foreach (var p in personsByEmiratesId)
	{
	if (!string.IsNullOrWhiteSpace(p.EmiratesId) && !string.IsNullOrWhiteSpace(p.NameAr))
	{
		violatorIdentifierPersonArMap[p.EmiratesId!.Trim()] = p.NameAr!;
	}
	}

	var estsByLicense = await _dbContext.Establishments
	.AsNoTracking()
	.Where(e => e.LicenseNumber != null && unresolvedIdentifiers.Contains(e.LicenseNumber) && e.NameAr != null)
	.Select(e => new { e.LicenseNumber, e.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
	foreach (var e in estsByLicense)
	{
	if (!string.IsNullOrWhiteSpace(e.LicenseNumber) && !string.IsNullOrWhiteSpace(e.NameAr))
	{
		violatorIdentifierEstArMap[e.LicenseNumber!.Trim()] = e.NameAr!;
	}
	}
}
}

var items = rawItems
.Select(x =>
{
var statusName = violationStatusNames.TryGetValue(x.StatusId, out var resolvedStatusName)
? resolvedStatusName
: MapViolationStatusName(x.StatusId, isArabic);
                var inspectionReasonName = x.SourceTaskInspectionReasonId.HasValue
                                           && inspectionReasonNames.TryGetValue(x.SourceTaskInspectionReasonId.Value, out var resolvedInspectionReasonName)
                    ? resolvedInspectionReasonName
                    : null;
	                var sla = BuildViolationSla(
	                    x.SlaDeadlineAt,
	                    _currentUserService.IsArabicLanguage);

                var createdByName = !string.IsNullOrWhiteSpace(x.CreatedBy) && createdByNameMap.TryGetValue(x.CreatedBy, out var resolvedCreatedByName)
                    ? resolvedCreatedByName
                    : x.CreatedBy;

                return new InspectionViolationListItemDto
                {
                    Id = x.Id,
                    ViolationNo = x.ViolationNo,
                    TaskId = x.TaskId,
                    TaskNo = x.TaskNo,
                    ViolationTypeId = x.ViolationTypeId,
                    ViolationTypeCode = MapViolationTypeCode(x.ViolationTypeId),
                    ViolationTypeName = MapViolationTypeName(x.ViolationTypeId, isArabic),
                    InspectionReasonName = inspectionReasonName,
                    StatusId = x.StatusId,
                    StatusName = statusName,
ViolatorName = isArabic
&& (x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId) is > 0
&& violatorNameArMap.TryGetValue((x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)!.Value, out var violatorArName)
? violatorArName
: (x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId) is > 0
&& violatorPersonNameMap.TryGetValue((x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)!.Value, out var violatorPerson)
&& !string.IsNullOrWhiteSpace(isArabic ? violatorPerson.NameAr : (violatorPerson.NameEn ?? violatorPerson.NameAr))
? (isArabic ? violatorPerson.NameAr : (violatorPerson.NameEn ?? violatorPerson.NameAr))!
: isArabic
&& !string.IsNullOrWhiteSpace(x.ViolatorIdentifier)
&& violatorIdentifierPersonArMap.TryGetValue(x.ViolatorIdentifier!.Trim(), out var violatorIdPersonAr)
? violatorIdPersonAr
: isArabic
&& !string.IsNullOrWhiteSpace(x.ViolatorIdentifier)
&& violatorIdentifierEstArMap.TryGetValue(x.ViolatorIdentifier!.Trim(), out var violatorIdEstAr)
? violatorIdEstAr
: x.ViolatorName,
	ViolatorIdentifier = x.ViolatorIdentifier,
	TargetTypeCode = ResolveViolatorTargetTypeCode(
	x.ViolatorType,
	x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId,
	x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId),
	ReportedByUserId = x.ReportedByUserId,
                    ReportedByName = x.ReportedByName,
                    CreatedByName = createdByName,
                    FineAmount = x.FineAmount,
                    AssignedContentId = x.AssignedContentId,
                    CreatedOn = x.CreatedOn,
                    LastUpdatedOn = x.LastUpdatedOn,
                    Sla = sla,
                    AvailableActions = ResolveAvailableActions(x.StatusId, actionContext.CanRoute, actionContext.CanContent, actionContext.CanDecide, actionContext.CanApprove, x.ViolationReportUrl),
                    ViolationReportUrl = x.ViolationReportUrl,
                    IsMock = false
                };
            })
            .ToList();

        return new InspectionViolationListResponseDto
        {
            Items = items,
            PageIndex = pageIndex,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<IReadOnlyList<InspectionCustomerViolationListItemDto>> GetCustomerViolationsAsync(InspectionCustomerViolationListRequestDto request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.TaskId <= 0)
        {
            throw new BusinessException("Inspection.Violation.TaskIdRequired", "");
        }

        var task = await _dbContext.InspectionTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.TaskId)
            .ConfigureAwait(false);

        if (task == null)
        {
throw new BusinessException("Inspection.Task.NotFound", "");
}

var isArabic = _currentUserService.IsArabicLanguage;

var query = ApplySameTargetViolationFilter(
            _dbContext.InspectionViolations
                .AsNoTracking()
                .Where(x => x.SourceTask != null),
            task);

        var rawItems = await query
            .Where(x => x.StatusId == (int)InspectionViolationStatus.PendingPayment
                        && !x.Appeals.Any(a => ActiveAppealStatusIds.Contains(a.StatusId)))
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .Select(x => new
            {
                ViolationId = x.Id,
                x.ViolationNo,
                x.ViolatorName,
                x.ViolationTypeId,
                FineAmount = x.FineAmount,
                BeforeAppealAdjustedFineAmount = x.BeforeAppealAdjustedFineAmount,
x.StatusId,
x.CreatedOn,
SourceTaskEstablishmentId = x.SourceTask != null ? x.SourceTask.EstablishmentId : null,
SourceSnapshotEstablishmentId = x.SourceSnapshot != null ? x.SourceSnapshot.EstablishmentId : null,
SourceTaskIndividualId = x.SourceTask != null ? x.SourceTask.IndividualId : null,
SourceSnapshotIndividualId = x.SourceSnapshot != null ? x.SourceSnapshot.IndividualId : null
})
.ToListAsync()
.ConfigureAwait(false);

var violationStatusNames = await ResolveEnumTypeDictionaryNamesAsync(
nameof(InspectionViolationStatus),
CollectIds(rawItems.Select(x => (int?)x.StatusId)),
preferArabic: isArabic)
.ConfigureAwait(false);
var violationTypeNames = await ResolveEnumTypeDictionaryNamesAsync(
nameof(InspectionViolationType),
CollectIds(rawItems.Select(x => (int?)x.ViolationTypeId)),
preferArabic: isArabic)
.ConfigureAwait(false);

// Resolve Arabic establishment names for ViolatorName when Arabic is requested
var customerViolatorNameArMap = new Dictionary<int, string>();
if (isArabic)
{
var estIds = rawItems
.Select(x => x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)
.Where(x => x.HasValue && x.Value > 0)
.Select(x => x!.Value)
.Distinct()
.ToList();
if (estIds.Count > 0)
{
var ests = await _dbContext.Establishments
	.AsNoTracking()
	.Where(e => estIds.Contains(e.Id))
	.Select(e => new { e.Id, e.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
foreach (var e in ests)
{
	if (!string.IsNullOrWhiteSpace(e.NameAr))
	{
		customerViolatorNameArMap[e.Id] = e.NameAr;
	}
}
}
}

// Resolve person names for ViolatorName when violator is an individual.
// Individual FK is a UserProfiles.Id, so resolve Core.Persons via UserProfiles.PersonId.
var customerPersonNameMap = new Dictionary<int, (string? NameEn, string? NameAr)>();
{
var profileIds = rawItems
	.Select(x => x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)
	.Where(x => x.HasValue && x.Value > 0)
	.Select(x => x!.Value)
	.Distinct()
	.ToList();
if (profileIds.Count > 0)
{
var persons = await (from up in _dbContext.UserProfiles.AsNoTracking()
	where profileIds.Contains(up.Id) && up.PersonId != 0
	join p in _dbContext.Persons.AsNoTracking() on up.PersonId equals p.Id
	select new { ProfileId = up.Id, p.Name, p.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
foreach (var p in persons)
{
	customerPersonNameMap[p.ProfileId] = (p.Name, p.NameAr);
}
}
}

return rawItems
.Select(x => new InspectionCustomerViolationListItemDto
{
ViolationId = x.ViolationId,
ViolationNo = x.ViolationNo,
ViolatorName = isArabic
	&& (x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId) is > 0
	&& customerViolatorNameArMap.TryGetValue((x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)!.Value, out var violatorAr)
	? violatorAr
	: (x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId) is > 0
		&& customerPersonNameMap.TryGetValue((x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)!.Value, out var custPerson)
		&& !string.IsNullOrWhiteSpace(isArabic ? custPerson.NameAr : (custPerson.NameEn ?? custPerson.NameAr))
		? (isArabic ? custPerson.NameAr : (custPerson.NameEn ?? custPerson.NameAr))!
		: x.ViolatorName,
ViolationTypeId = x.ViolationTypeId,
ViolationTypeName = violationTypeNames.TryGetValue(x.ViolationTypeId, out var violationTypeName)
	? violationTypeName
	: MapViolationTypeName(x.ViolationTypeId, isArabic),
FineAmount = x.FineAmount,
StatusId = x.StatusId,
StatusName = violationStatusNames.TryGetValue(x.StatusId, out var statusName)
	? statusName
	: MapViolationStatusName(x.StatusId, isArabic),
CreatedOn = x.CreatedOn
})
.ToList();
}

    public async Task<InspectionUserViolationListResponseDto> GetUserViolationsAsync(InspectionUserViolationListRequestDto request, bool bypassDataScope = false)
    {
        ArgumentNullException.ThrowIfNull(request);

var isArabic = _currentUserService.IsArabicLanguage;
var normalizedRequest = await ResolveUserViolationTargetScopeAsync(NormalizeUserViolationListRequest(request)).ConfigureAwait(false);
ValidateTargetScope(normalizedRequest.EstablishmentId, normalizedRequest.IndividualId);
        var (lastUpdatedOnFrom, lastUpdatedOnTo) = ParseUserViolationListDateRange(normalizedRequest.StartTime, normalizedRequest.EndTime);

// Include task-less internal-API violations too: the visibility rules below decide which
// of them stay (task-linked always; §6 MoE auto-fines; internal ones only in Paid/UnderAppeal/
// Cancelled). Do NOT pre-filter on SourceTask != null — that dropped every SourceTaskId=0 record.
var query = _dbContext.InspectionViolations
.AsNoTracking();

query = ExcludeExpiredInternalViolations(query);

        query = ApplyTargetViolationFilter(query, normalizedRequest.EstablishmentId, normalizedRequest.IndividualId);

        if (!string.IsNullOrWhiteSpace(normalizedRequest.Keyword))
        {
            query = query.Where(x => x.ViolationNo.Contains(normalizedRequest.Keyword));
        }

        if (normalizedRequest.ViolationTypeId.HasValue)
        {
            query = query.Where(x => x.ViolationTypeId == normalizedRequest.ViolationTypeId.Value);
        }

        if (normalizedRequest.StatusId.HasValue)
        {
            query = query.Where(x => x.StatusId == normalizedRequest.StatusId.Value);
        }

if (lastUpdatedOnFrom.HasValue)
{
query = query.Where(x => x.LastUpdatedOn >= lastUpdatedOnFrom.Value);
}

if (lastUpdatedOnTo.HasValue)
{
query = query.Where(x => x.LastUpdatedOn <= lastUpdatedOnTo.Value);
}

        // Filter by ApprovalOn (violation time)
        if (normalizedRequest.ApprovalTimeFrom.HasValue)
        {
            query = query.Where(x => x.ApprovalOn.HasValue && x.ApprovalOn.Value >= normalizedRequest.ApprovalTimeFrom.Value);
        }

        if (normalizedRequest.ApprovalTimeTo.HasValue)
        {
            query = query.Where(x => x.ApprovalOn.HasValue && x.ApprovalOn.Value <= normalizedRequest.ApprovalTimeTo.Value);
        }

        // Filter by PaidAt (payment time) - need to join with PenaltyOrders
        if (normalizedRequest.PaidTimeFrom.HasValue || normalizedRequest.PaidTimeTo.HasValue)
        {
            var violationIdsWithPaidTime = _dbContext.InspectionViolationPenaltyOrders
                .AsNoTracking()
                .Where(po => po.PaidAt.HasValue);

            if (normalizedRequest.PaidTimeFrom.HasValue)
            {
                violationIdsWithPaidTime = violationIdsWithPaidTime.Where(po => po.PaidAt.Value >= normalizedRequest.PaidTimeFrom.Value);
            }

            if (normalizedRequest.PaidTimeTo.HasValue)
            {
                violationIdsWithPaidTime = violationIdsWithPaidTime.Where(po => po.PaidAt.Value <= normalizedRequest.PaidTimeTo.Value);
            }

            var violationIds = await violationIdsWithPaidTime.Select(po => po.ViolationId).Distinct().ToListAsync().ConfigureAwait(false);
            query = query.Where(x => violationIds.Contains(x.Id));
        }

        var countsByStatus = await query
            .GroupBy(x => x.StatusId)
            .Select(group => new
            {
                StatusId = group.Key,
                Count = group.Count()
            })
            .ToDictionaryAsync(x => x.StatusId, x => x.Count)
            .ConfigureAwait(false);
var statusNames = await ResolveEnumTypeDictionaryNamesAsync(
	nameof(InspectionViolationStatus),
	OrderedTargetScopedViolationStatuses.Select(x => (int)x).ToList(),
	preferArabic: isArabic)
.ConfigureAwait(false);

        // Get violation type names
        var violationTypeIds = await query.Select(x => x.ViolationTypeId).Distinct().ToListAsync().ConfigureAwait(false);
var violationTypeNames = await ResolveEnumTypeDictionaryNamesAsync(
	nameof(InspectionViolationType),
	violationTypeIds,
	preferArabic: isArabic)
.ConfigureAwait(false);

var rawUserItems = await query
.OrderByDescending(x => x.CreatedOn)
.ThenByDescending(x => x.Id)
.Select(x => new
{
	ViolationId = x.Id,
	x.ViolationNo,
	x.ViolatorName,
	x.ViolationTypeId,
	x.FineAmount,
	x.BeforeAppealAdjustedFineAmount,
	x.StatusId,
	x.SourceTaskId,
	SourceTaskNo = x.SourceTask != null ? x.SourceTask.TaskNo : null,
	x.ReportedByUserId,
	x.ReportedByName,
	x.CreatedOn,
	SourceTaskEstablishmentId = x.SourceTask != null ? x.SourceTask.EstablishmentId : null,
	SourceSnapshotEstablishmentId = x.SourceSnapshot != null ? x.SourceSnapshot.EstablishmentId : null,
	SourceTaskIndividualId = x.SourceTask != null ? x.SourceTask.IndividualId : null,
	SourceSnapshotIndividualId = x.SourceSnapshot != null ? x.SourceSnapshot.IndividualId : null
	})
	.ToListAsync()
.ConfigureAwait(false);

// Fetch PaidAt from PenaltyOrders for each violation
var paidLookupViolationIds = rawUserItems.Select(x => x.ViolationId).ToList();
var paidTimeMap = await _dbContext.InspectionViolationPenaltyOrders
	.AsNoTracking()
	.Where(po => paidLookupViolationIds.Contains(po.ViolationId) && po.PaidAt.HasValue)
	.GroupBy(po => po.ViolationId)
	.Select(g => new { ViolationId = g.Key, PaidAt = g.Max(po => po.PaidAt) })
	.ToDictionaryAsync(x => x.ViolationId, x => x.PaidAt)
	.ConfigureAwait(false);

// Resolve Arabic establishment names for ViolatorName when Arabic is requested
var targetViolatorNameArMap = new Dictionary<int, string>();
if (isArabic)
{
var estIds = rawUserItems
	.Select(x => x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)
	.Where(x => x.HasValue && x.Value > 0)
	.Select(x => x!.Value)
	.Distinct()
	.ToList();
if (estIds.Count > 0)
{
	var ests = await _dbContext.Establishments
	.AsNoTracking()
	.Where(e => estIds.Contains(e.Id))
	.Select(e => new { e.Id, e.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
	foreach (var e in ests)
	{
	if (!string.IsNullOrWhiteSpace(e.NameAr))
	{
		targetViolatorNameArMap[e.Id] = e.NameAr;
	}
	}
}
}

// Resolve person names for ViolatorName when violator is an individual.
// Individual FK is a UserProfiles.Id, so resolve Core.Persons via UserProfiles.PersonId.
var targetPersonNameMap = new Dictionary<int, (string? NameEn, string? NameAr)>();
{
var profileIds = rawUserItems
	.Select(x => x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)
	.Where(x => x.HasValue && x.Value > 0)
	.Select(x => x!.Value)
	.Distinct()
	.ToList();
if (profileIds.Count > 0)
{
var persons = await (from up in _dbContext.UserProfiles.AsNoTracking()
	where profileIds.Contains(up.Id) && up.PersonId != 0
	join p in _dbContext.Persons.AsNoTracking() on up.PersonId equals p.Id
	select new { ProfileId = up.Id, p.Name, p.NameAr })
	.ToListAsync()
	.ConfigureAwait(false);
foreach (var p in persons)
{
	targetPersonNameMap[p.ProfileId] = (p.Name, p.NameAr);
}
}
}

var items = rawUserItems
.Select(x =>
{
	var typeName = violationTypeNames.TryGetValue(x.ViolationTypeId, out var tn) ? tn : MapViolationTypeName(x.ViolationTypeId, isArabic);
	var sName = statusNames.TryGetValue(x.StatusId, out var sn) ? sn : MapViolationStatusName(x.StatusId, isArabic);
	var violatorName = isArabic
	&& (x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId) is > 0
	&& targetViolatorNameArMap.TryGetValue((x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)!.Value, out var violatorAr)
	? violatorAr
	: (x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId) is > 0
		&& targetPersonNameMap.TryGetValue((x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)!.Value, out var targetPerson)
		&& !string.IsNullOrWhiteSpace(isArabic ? targetPerson.NameAr : (targetPerson.NameEn ?? targetPerson.NameAr))
		? (isArabic ? targetPerson.NameAr : (targetPerson.NameEn ?? targetPerson.NameAr))!
		: x.ViolatorName;

	return new InspectionUserViolationListItemDto
	{
	ViolationId = x.ViolationId,
	ViolationNo = x.ViolationNo,
	ViolatorName = violatorName,
	ViolationTypeId = x.ViolationTypeId,
	ViolationTypeName = typeName,
	FineAmount = x.FineAmount,
	BeforeAppealAdjustedFineAmount = x.BeforeAppealAdjustedFineAmount,
	StatusId = x.StatusId,
	StatusName = sName,
	SourceTaskId = x.SourceTaskId,
	SourceTaskNo = x.SourceTaskNo,
	ReportedByUserId = x.ReportedByUserId,
	ReportedByName = x.ReportedByName,
	CreatedOn = x.CreatedOn,
	PaidTime = paidTimeMap.TryGetValue(x.ViolationId, out var paidAt) ? paidAt : null
	};
})
.ToList();

        return new InspectionUserViolationListResponseDto
        {
            Total = items.Count,
            Items = items,
            Statuses = BuildTargetScopedViolationStatusStats(countsByStatus, statusNames)
        };
    }

    private static IQueryable<InspectionViolation> ApplySameTargetViolationFilter(IQueryable<InspectionViolation> query, InspectionTask task)
    {
        return task.TargetTypeId switch
        {
            (int)InspectionTargetType.Establishment when task.EstablishmentId.HasValue => query.Where(x => x.SourceTask!.EstablishmentId == task.EstablishmentId),
            (int)InspectionTargetType.Individual when task.IndividualId.HasValue => query.Where(x => x.SourceTask!.IndividualId == task.IndividualId),
            _ when task.SourceTypeId == (int)InspectionSourceType.ActivityBased && task.ActivityId.HasValue => query.Where(x => x.SourceTask!.ActivityId == task.ActivityId),
            _ => query.Where(x => x.SourceTask!.EstablishmentName == task.EstablishmentName || x.SourceTask!.FullName == task.FullName)
        };
    }

private static IQueryable<InspectionViolation> ApplyTargetViolationFilter(
	IQueryable<InspectionViolation> query,
	int? establishmentId,
	int? individualId)
{
	// Task-linked violations (SourceTaskId > 0) carry their target on SourceTask.
	// Task-less internal-API violations (SourceTaskId = 0/null) carry it on
	// SourceSnapshot instead, so match either side to include both tracks.
	if (establishmentId.HasValue)
	{
		return query.Where(x =>
			(x.SourceTask != null && x.SourceTask.EstablishmentId == establishmentId.Value)
			|| (x.SourceSnapshot != null && x.SourceSnapshot.EstablishmentId == establishmentId.Value));
	}

	return query.Where(x =>
		(x.SourceTask != null && x.SourceTask.IndividualId == individualId!.Value)
		|| (x.SourceSnapshot != null && x.SourceSnapshot.IndividualId == individualId!.Value));
}

    /// <summary>
    /// ReportedByUserId stamped by the CustomerPortal MoE compliance worker on the §6 automatic fines.
    ///
    /// Those fines are raised with no inspection task on purpose: the violator is a business that never
    /// registered on the portal, so there is nothing for an inspector to have opened a task against. That
    /// makes them indistinguishable, by shape alone, from the internal violations the rule below hides -
    /// and hiding them means an entire enforcement track is invisible to the officers meant to act on it.
    /// </summary>
    private const string MoeComplianceReporterUserId = "customer-portal-moe-compliance";

    /// <summary>
    /// Statuses in which an internal-API violation (no linked task) stays visible. A freshly created
    /// internal violation is hidden until it proves to be a real, acted-upon record rather than a
    /// same-day auto-generated leftover:
    ///   Paid        -> the customer paid it;
    ///   UnderAppeal -> it was paid and is now going through an appeal review;
    ///   Cancelled   -> an appeal decision cancelled it.
    /// Both <see cref="ExcludeExpiredInternalViolations"/> (list) and <see cref="IsExpiredInternalViolation"/>
    /// (detail) read this single set so the two rules can never drift apart.
    /// </summary>
    private static readonly int[] VisibleInternalViolationStatusIds =
    {
        (int)InspectionViolationStatus.Paid,
        (int)InspectionViolationStatus.UnderAppeal,
        (int)InspectionViolationStatus.Cancelled
    };

    /// <summary>
    /// Filters out violations that were created via the internal API (no linked task,
    /// <c>SourceTaskId IS NULL</c> or <c>SourceTaskId = 0</c> sentinel). 
    /// For internal violations, only Paid violations are shown.
    /// Task-linked violations (SourceTaskId > 0) are always shown.
    /// MoE compliance fines are exempt: see <see cref="MoeComplianceReporterUserId"/>.
    /// </summary>
    private static IQueryable<InspectionViolation> ExcludeExpiredInternalViolations(IQueryable<InspectionViolation> query)
    {
return query.Where(x =>
// Keep task-linked violations always
(x.SourceTaskId != null && x.SourceTaskId != 0)
// §6 automatic fines are task-less by design, not leftovers
|| x.ReportedByUserId == MoeComplianceReporterUserId
// For internal violations (SourceTaskId = 0 or null), show the post-payment/appeal states
|| VisibleInternalViolationStatusIds.Contains(x.StatusId));
    }

    /// <summary>
    /// Returns <c>true</c> when <paramref name="violation"/> is an internal-API violation
    /// (no linked task — <c>SourceTaskId</c> is <c>null</c> or the sentinel value <c>0</c>)
    /// and is not in Paid status. Internal violations are only visible if they have been paid.
    /// </summary>
    private static bool IsExpiredInternalViolation(InspectionViolation violation)
    {
        if (violation.SourceTaskId != null && violation.SourceTaskId != 0)
            return false;
        // Must mirror ExcludeExpiredInternalViolations exactly: a violation the list shows but the
        // detail endpoint calls expired is worse than either rule on its own.
if (violation.ReportedByUserId == MoeComplianceReporterUserId)
return false;
// For internal violations (SourceTaskId = 0 or null), only the post-payment/appeal states are visible
return !VisibleInternalViolationStatusIds.Contains(violation.StatusId);
    }

    public async Task<InspectionViolationStatsResponseDto> GetStatsAsync(InspectionViolationListRequestDto request)
    {
        var visibilityContext = await BuildVisibilityContextAsync().ConfigureAwait(false);
        var query = BuildViolationListQuery(request, visibilityContext);

        var countsByStatus = await query
            .GroupBy(x => x.StatusId)
            .Select(group => new
            {
                StatusId = group.Key,
                Count = group.Count()
            })
            .ToDictionaryAsync(x => x.StatusId, x => x.Count)
            .ConfigureAwait(false);

        var requestedStatusIds = request.StatusId.HasValue
            ? new[] { (int)request.StatusId.Value }
            : countsByStatus.Keys.ToArray();

        var statusIds = requestedStatusIds
            .Where(x => x > 0)
            .Distinct()
            .OrderBy(x => x)
            .ToList();

        var violationStatusNames = await ResolveEnumTypeDictionaryNamesAsync(nameof(InspectionViolationStatus), statusIds)
            .ConfigureAwait(false);

        var statuses = statusIds
            .Select(statusId => new InspectionViolationStatusStatDto
            {
                StatusId = statusId,
                StatusName = violationStatusNames.TryGetValue(statusId, out var resolvedStatusName)
                    ? resolvedStatusName
                    : MapViolationStatusName(statusId),
                Count = countsByStatus.TryGetValue(statusId, out var count) ? count : 0
            })
            .ToList();

        return new InspectionViolationStatsResponseDto
        {
            TotalCount = statuses.Sum(x => x.Count),
            Statuses = statuses
        };
    }

    private IQueryable<InspectionViolation> BuildViolationListQuery(
        InspectionViolationListRequestDto request,
        ViolationVisibilityContext context)
    {
        var search = request.Search?.Trim();
        var normalizedScope = NormalizeViolationListScope(request.Scope);
        var hasFineAmountSearch = TryParseViolationListFineAmountSearch(search, out var fineAmountSearch);

        var query = _dbContext.InspectionViolations.AsNoTracking();
        query = ApplyViolationListVisibilityScope(query, normalizedScope, context);
        // Exclude internal-API violations (SourceTaskId IS NULL / taskId=0) unless they are Paid.
        // Internal violations are only visible once they have been paid.
        query = ExcludeExpiredInternalViolations(query);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.ViolationNo.Contains(search) ||
                (x.SourceTask != null && x.SourceTask.TaskNo != null && x.SourceTask.TaskNo.Contains(search)) ||
                x.ViolatorName.Contains(search) ||
                (hasFineAmountSearch && x.FineAmount == fineAmountSearch) ||
                (x.ViolatorIdentifier != null && x.ViolatorIdentifier.Contains(search)) ||
                (x.ReportedByName != null && x.ReportedByName.Contains(search)));
        }

        if (request.StatusId.HasValue)
        {
            query = ApplyWorkflowStatusFilter(query, request.StatusId.Value);
        }

        if (request.ViolationTypeId.HasValue)
        {
            query = query.Where(x => x.ViolationTypeId == request.ViolationTypeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.AssignedContentId))
        {
            query = query.Where(x => x.AssignedContentId == request.AssignedContentId);
        }

        if (!string.IsNullOrWhiteSpace(request.ReportBy))
        {
            var reportBy = request.ReportBy.Trim();
            query = query.Where(x => x.CreatedBy == reportBy);
        }

        if (request.CreatedOnFrom.HasValue)
        {
            query = query.Where(x => x.CreatedOn >= request.CreatedOnFrom.Value);
        }

        if (request.CreatedOnTo.HasValue)
        {
            query = query.Where(x => x.CreatedOn <= request.CreatedOnTo.Value);
        }

        return query;
    }

    public async Task<InspectionViolationDetailDto?> GetDetailAsync(int id)
    {
        var violation = await _violationRepository.GetAggregateAsync(id).ConfigureAwait(false);
        if (violation == null)
        {
            return null;
        }

        // Internal-API violations (SourceTaskId == null / taskId=0) are only valid for the day
        // they were created. If the deadline has passed and the violation is still unpaid it is
        // considered voided (the source system will regenerate it), so we treat it as not found.
        if (IsExpiredInternalViolation(violation))
        {
            return null;
        }
        
        var actionContext = await BuildActionContextAsync().ConfigureAwait(false);
        var violationItemsByStoredId = await LoadViolationItemsByStoredIdAsync(violation).ConfigureAwait(false);
        var appealReasonDisplayNames = await LoadAppealReasonDisplayNamesAsync().ConfigureAwait(false);
        var latestCompletedPayment = await LoadLatestCompletedFinePaymentAsync(violation.ViolationNo).ConfigureAwait(false);
        var relatedAppeals = await LoadRelatedAppealsAsync(violation.Id).ConfigureAwait(false);
        var reinspectionTasks = await BuildReinspectionTasksAsync(violation.SourceTask?.TaskNo).ConfigureAwait(false);
        var (violationCount, unpayCount) = await BuildViolationCountsAsync(violation).ConfigureAwait(false);
        var (establishmentId, individualId) = await GetViolationTargetIdsAsync(violation).ConfigureAwait(false);

        int? profileId = null;
        string? userProfileUserId = null;
        short? userProfileUserTypeId = null;

        if (individualId.HasValue)
        {
            profileId = individualId.Value;
        }
        else if (establishmentId.HasValue)
        {
            profileId = await _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(x => x.EstablishmentId == establishmentId.Value)
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

        // Resolve Establishment identity fields (EstablishmentName, EstablishmentNameAr, LicenseNumber)
        string? establishmentName = null;
        string? establishmentNameAr = null;
        string? licenseNumber = null;
        if (establishmentId.HasValue)
        {
            var est = await _dbContext.Set<Establishment>()
                .AsNoTracking()
                .Where(x => x.Id == establishmentId.Value)
                .Select(x => new { x.NameEn, x.NameAr, x.LicenseNumber })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);
            if (est != null)
            {
                establishmentName = est.NameEn;
                establishmentNameAr = est.NameAr;
                licenseNumber = est.LicenseNumber;
            }
        }

        var detail = MapDetail(
            violation,
            violationItemsByStoredId,
            appealReasonDisplayNames,
            latestCompletedPayment,
            relatedAppeals,
            reinspectionTasks,
            actionContext,
            violationCount,
            unpayCount,
            establishmentId,
            individualId,
            profileId);
        detail.UserProfileId = profileId;
        detail.UserId = userProfileUserId;
        detail.UserTypeId = userProfileUserTypeId;
        detail.UserTypeCode = userTypeCode ?? userProfileUserTypeId?.ToString();
        detail.LicenseNumber = licenseNumber
            ?? violation.SourceTask?.TradeLicenseNumber
            ?? violation.SourceSnapshot?.LicensePermitNo;
detail.EstablishmentName = establishmentName;
detail.EstablishmentNameAr = establishmentNameAr;
detail.TargetName = establishmentName ?? violation.SourceTask?.FullName;

// Resolve ViolatorName from the authoritative party record for both languages:
//  - Establishment (enterprise) -> Core.Establishments (NameEn / NameAr)
//  - Individual (person)        -> Core.Persons via Account.UserProfiles.PersonId
//    (the individual FK is a UserProfiles.Id, NOT a Persons.Id)
// Fall back to identifier-based lookup (EmiratesId / LicenseNumber) when no FK is present.
{
var isArabicDetail = _currentUserService.IsArabicLanguage;
string? resolvedViolatorName = null;

if (establishmentId.HasValue)
{
	resolvedViolatorName = isArabicDetail
		? establishmentNameAr
		: (establishmentName ?? establishmentNameAr);
}
else if (individualId.HasValue)
{
	var person = await (from up in _dbContext.UserProfiles.AsNoTracking()
		where up.Id == individualId.Value && up.PersonId != 0
		join p in _dbContext.Persons.AsNoTracking() on up.PersonId equals p.Id
		select new { p.Name, p.NameAr })
		.FirstOrDefaultAsync()
		.ConfigureAwait(false);
	if (person != null)
	{
		resolvedViolatorName = isArabicDetail
			? person.NameAr
			: (person.Name ?? person.NameAr);
	}
}

if (string.IsNullOrWhiteSpace(resolvedViolatorName)
	&& !establishmentId.HasValue
	&& !individualId.HasValue
	&& !string.IsNullOrWhiteSpace(violation.ViolatorIdentifier))
{
	var identifier = violation.ViolatorIdentifier!.Trim();
	var personByEmiratesId = await _dbContext.Persons
	.AsNoTracking()
	.Where(p => p.EmiratesId != null && p.EmiratesId == identifier)
	.Select(p => new { p.Name, p.NameAr })
	.FirstOrDefaultAsync()
	.ConfigureAwait(false);
	if (personByEmiratesId != null)
	{
	resolvedViolatorName = isArabicDetail
		? personByEmiratesId.NameAr
		: (personByEmiratesId.Name ?? personByEmiratesId.NameAr);
	}
	if (string.IsNullOrWhiteSpace(resolvedViolatorName))
	{
	var estByLicense = await _dbContext.Establishments
		.AsNoTracking()
		.Where(e => e.LicenseNumber != null && e.LicenseNumber == identifier)
		.Select(e => new { e.NameEn, e.NameAr })
		.FirstOrDefaultAsync()
		.ConfigureAwait(false);
	if (estByLicense != null)
	{
		resolvedViolatorName = isArabicDetail
			? estByLicense.NameAr
			: (estByLicense.NameEn ?? estByLicense.NameAr);
	}
	}
}

if (!string.IsNullOrWhiteSpace(resolvedViolatorName))
{
	detail.ViolatorName = resolvedViolatorName;
}
}

return detail;
    }

    public async Task<InspectionViolationPenaltyOrderDetailDto?> GetPenaltyOrderDetailByViolationNoAsync(string violationNo)
    {
        if (string.IsNullOrWhiteSpace(violationNo))
        {
            return null;
        }

        var matchedViolation = await _violationRepository.GetByViolationNoAsync(violationNo.Trim()).ConfigureAwait(false);
        if (matchedViolation == null)
        {
            return null;
        }

        var violation = await _violationRepository.GetAggregateAsync(matchedViolation.Id).ConfigureAwait(false);
        if (violation == null)
        {
            return null;
        }

        // Internal-API violations (SourceTaskId == null / taskId=0) are only visible if they are Paid.
        if (IsExpiredInternalViolation(violation))
        {
            return null;
        }
        

        var penaltyOrder = await _dbContext.InspectionViolationPenaltyOrders
            .AsNoTracking()
            .Where(x => x.ViolationId == violation.Id)
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.PenaltyOrderId)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (penaltyOrder == null)
        {
            return null;
        }

        var violationItemsByStoredId = await LoadViolationItemsByStoredIdAsync(violation).ConfigureAwait(false);
        return MapPenaltyOrderDetail(violation, penaltyOrder, violationItemsByStoredId);
    }

    public async Task<InspectionViolationPenaltyStandardDto?> GetPenaltyStandardAsync(int id)
    {
        var violation = await _violationRepository.GetAggregateAsync(id).ConfigureAwait(false);
        if (violation == null)
        {
            return null;
        }
        
        var violationItemsByStoredId = await LoadViolationItemsByStoredIdAsync(violation).ConfigureAwait(false);
        var standards = await ResolveOrderedPenaltyStandardsAsync(violation, violationItemsByStoredId).ConfigureAwait(false);
        return MapPenaltyStandard(violation, standards);
    }

    public async Task<List<InspectionViolationTimelineItemDto>> GetTimelineAsync(int id)
    {
        var violation = await RequireViolationAsync(id).ConfigureAwait(false);
        var isArabic = _currentUserService.IsArabicLanguage;
        var appealReasonDisplayNames = await LoadAppealReasonDisplayNamesAsync(isArabic).ConfigureAwait(false);
        return BuildProjectedTimeline(violation, appealReasonDisplayNames, isArabic);
    }

    public async Task RouteAsync(int id, RouteInspectionViolationRequestDto request)
    {
        await EnsureCanRouteViolationAsync();

        var violation = await RequireViolationAsync(id).ConfigureAwait(false);
        EnsureViolationType(violation, (int)InspectionViolationType.Content, "Inspection.Violation.RouteOnlySupportsContentViolation");

        var routeTargetCode = NormalizeRouteTargetCode(request.RouteTargetCode);
        var fromStatusId = violation.StatusId;

        if (!string.Equals(routeTargetCode, "Content", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Inspection.Violation.RouteTargetInvalid", "");
        }

        if (string.Equals(routeTargetCode, "Content", StringComparison.OrdinalIgnoreCase))
        {
            if (violation.StatusId != (int)InspectionViolationStatus.PendingRouting)
            {
                throw new BusinessException("Inspection.Violation.InvalidRoutingState", "");
            }
            SetViolationStatus(violation, (int)InspectionViolationStatus.PendingContentReport);
        }
        else
        {
            if (violation.StatusId != (int)InspectionViolationStatus.PendingRouting &&
                violation.StatusId != (int)InspectionViolationStatus.PendingReview)
            {
                throw new BusinessException("Inspection.Violation.InvalidRoutingState", "");
            }

            SetViolationStatus(violation, (int)InspectionViolationStatus.PendingCommitteeDecision);
        }

        violation.LatestTransferNote = request.LatestTransferNote?.Trim();
        TouchViolation(violation);

        var contentHandler = string.Equals(routeTargetCode, "Content", StringComparison.OrdinalIgnoreCase)
            ? await ResolveConfigKeyMatchedViolationTargetAsync(violation.Id, "Content Team", "ContentTeam").ConfigureAwait(false)
            : (null, null);
        var committeeHandler = string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase)
            ? await ResolveConfigKeyMatchedViolationTargetAsync(violation.Id, "Committee", "Committee").ConfigureAwait(false)
            : (null, null);
        var targetHandlerUserId = string.Equals(routeTargetCode, "Content", StringComparison.OrdinalIgnoreCase)
            ? contentHandler.Item1
            : committeeHandler.Item1;
        var targetHandlerUserName = string.Equals(routeTargetCode, "Content", StringComparison.OrdinalIgnoreCase)
            ? contentHandler.Item2
            : committeeHandler.Item2;
        
        if (string.Equals(routeTargetCode, "Content", StringComparison.OrdinalIgnoreCase))
        {
            violation.AssignedContentId = targetHandlerUserId.Trim();
        }

        _violationRepository.Update(violation);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        var routeTimelineEvent = await AddViolationTimelineAsync(
            violation.Id,
            string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase)
                ? "ViolationTransferredToCommittee"
                : "ViolationTransferredToContent",
            string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase)
                ? InspectionViolationTimelineEventCodes.PendingCommitteeDecision
                : InspectionViolationTimelineEventCodes.PendingContentReport,
            content: string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase)
                ? "Violation has been transferred to Committee for review and decision."
                : "Violation has been transferred to Content Department for content assessment report.",
            fromStatusId: fromStatusId,
            toStatusId: violation.StatusId,
            targetHandlerTypeCode: string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase)
                ? "Committee"
                : "ContentDepartment",
            targetHandlerUserId: targetHandlerUserId,
            targetHandlerUserName: targetHandlerUserName,
            persistedHandlerType: string.Equals(routeTargetCode, "Committee", StringComparison.OrdinalIgnoreCase)
                ? "Committee"
                : "Content Team").ConfigureAwait(false);
        await TrySendStaffNotificationAsync(violation.Id, routeTimelineEvent.Id).ConfigureAwait(false);
    }

    public async Task SubmitContentReportAsync(int id, SubmitInspectionContentReportRequestDto request)
    {

        var violation = await RequireViolationAsync(id).ConfigureAwait(false);
        EnsureViolationType(violation, (int)InspectionViolationType.Content, "Inspection.Violation.ContentReportOnlySupportsContentViolation");

        if (violation.StatusId != (int)InspectionViolationStatus.PendingContentReport)
        {
            throw new BusinessException("Inspection.Violation.ContentReportInvalidState", "");
        }

        if (string.IsNullOrWhiteSpace(request.ContentReviewReportUrl))
        {
            throw new BusinessException("Inspection.Violation.ContentReviewReportRequired", "");
        }
var fromStatusId = violation.StatusId;
violation.ContentReviewReportNumber = request.ContentReviewReportNumber?.Trim();
        violation.ContentReviewReportUrl = request.ContentReviewReportUrl.Trim();
        violation.ContentReviewSummary = request.ContentReviewSummary?.Trim();
        violation.ContentReviewNote = request.ContentReviewNote?.Trim();
        SetViolationStatus(violation, (int)InspectionViolationStatus.PendingReview);
        TouchViolation(violation);

        var targetHandlerUserId = ResolveInspectionHandlerUserId(violation);
        var targetHandlerUserName = ResolveInspectionHandlerUserName(violation);

        _violationRepository.Update(violation);
        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        var contentReportTimelineEvent = await AddViolationTimelineAsync(
            violation.Id,
            "ContentReviewReportSubmitted",
            InspectionViolationTimelineEventCodes.PendingReview,
            content: "Content assessment report has been submitted and is waiting for the Inspection Department's review.",
            fromStatusId: fromStatusId,
            toStatusId: violation.StatusId,
            targetHandlerTypeCode: "InspectionDepartment",
            targetHandlerUserId: targetHandlerUserId,
            targetHandlerUserName: targetHandlerUserName).ConfigureAwait(false);
        await TrySendStaffNotificationAsync(violation.Id, contentReportTimelineEvent.Id).ConfigureAwait(false);
    }

    public async Task DecideAsync(int id, DecideInspectionViolationRequestDto request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var violation = await RequireViolationAsync(id).ConfigureAwait(false);
        if (violation.ViolationTypeId == (int)InspectionViolationType.Content &&
            violation.StatusId != (int)InspectionViolationStatus.PendingCommitteeDecision)
        {
            throw new BusinessException("Inspection.Violation.CommitteeDecisionInvalidState", "");
        }

        var fromStatusId = violation.StatusId;
        violation.CommitteeDecisionTypeId = request.CommitteeDecisionTypeId;
        violation.CommitteeDecisionNote = request.CommitteeDecisionNote?.Trim();
        violation.CommitteeDecidedByUserId = _currentUserService.UserId;
        violation.CommitteeDecidedByName = GetOperatorName();
        violation.CommitteeDecidedOn = DateTimeHelper.Now;

        var now = DateTimeHelper.Now;
        var decisionItems = request.Items;

        var violationItemsByStoredId = await LoadViolationItemsByStoredIdAsync(violation).ConfigureAwait(false);

        // Collect the existing checklist violations (Id > 0) that will be modified in-memory by the sync
        // methods below. Because GetAggregateAsync uses AsNoTracking, EF does not auto-detect changes on
        // these entities, so we must explicitly mark them Modified after Attach (called by Update).
        List<InspectionTaskChecklistViolation> checklistViolationsToUpdate;
        if (violation.ViolationTypeId == (int)InspectionViolationType.Content)
        {
            SynchronizeContentChecklistViolationsForDecision(violation, decisionItems, violationItemsByStoredId, now, _currentUserService.UserId);
            // All existing violations in the source task graph (matched + soft-deleted unmatched) were touched.
            // New violations (Id == 0) created by the sync will be auto-tracked as Added by Attach below.
            checklistViolationsToUpdate = ResolveAllChecklistViolations(violation)
                .Where(cv => cv.Id > 0)
                .ToList();
        }
        else
        {
            var checklistViolations = ResolveChecklistViolationsForDecision(violation, decisionItems, violationItemsByStoredId);
            SynchronizeChecklistViolationFineAmounts(checklistViolations, decisionItems, violationItemsByStoredId, now, _currentUserService.UserId);
            checklistViolationsToUpdate = checklistViolations.Where(cv => cv.Id > 0).ToList();
        }

        // Auto-correct CommitteeDecisionTypeId: if the client submitted "Confirmed" (2) but the
        // checklist data shows that at least one item was modified by the committee (Reported ≠ CommitteeReview),
        // override the decision type to "Modified" (1) so the stored value always reflects reality.
        if (request.CommitteeDecisionTypeId == (int)CommitteeDecisionType.Confirmed)
        {
            var hasModifiedItems = ResolveAllChecklistViolations(violation)
                .Any(x => x.Reported != x.CommitteeReview);
            if (hasModifiedItems)
            {
                violation.CommitteeDecisionTypeId = (int)CommitteeDecisionType.Modified;
            }
        }

        var allRelatedChecklistViolations = ResolveAllChecklistViolations(violation)
            .Where(x => x.CommitteeReview == true)
            .ToList();
        var totalFine = allRelatedChecklistViolations.Count > 0
            ? allRelatedChecklistViolations.Sum(x => x.FineAmount)
            : decisionItems.Sum(x => x.FineAmount);
        violation.FineAmount = totalFine;
        violation.BeforeAppealAdjustedFineAmount = totalFine;

        // Sync BeforeAppealAdjustedFineAmount on each checklist violation after FineAmount is finalised.
        foreach (var cv in allRelatedChecklistViolations)
        {
            cv.BeforeAppealAdjustedFineAmount = cv.FineAmount;
        }
        SetViolationStatus(violation, ResolveDecisionStatus(violation.CommitteeDecisionTypeId, totalFine));
        TouchViolation(violation);

        var outcomeEventCode = ResolveCommitteeDecisionTimelineEventCode(violation.StatusId, violation.CommitteeDecisionTypeId);
        var targetHandlerTypeCode = ResolveCommitteeDecisionTargetHandlerTypeCode(outcomeEventCode);
        var targetHandlerUserId = ResolveCommitteeDecisionTargetHandlerUserId(violation, outcomeEventCode);
        var targetHandlerUserName = await ResolveCommitteeDecisionTargetHandlerUserNameAsync(violation, outcomeEventCode, targetHandlerUserId).ConfigureAwait(false);
        var decisionContent = ResolveCommitteeDecisionContent(outcomeEventCode, violation.CommitteeDecisionNote);

        _violationRepository.Update(violation);

        // FIX: GetAggregateAsync uses AsNoTracking so existing InspectionTaskChecklistViolation entities
        // are attached as Unchanged by the Update call above. Mark the ones we modified explicitly so
        // their changes (CommitteeReview, FineAmount, Degree, etc.) are persisted by SaveChangesAsync.
        foreach (var cv in checklistViolationsToUpdate)
        {
            _dbContext.Entry(cv).State = EntityState.Modified;
        }

        // Persist committee decision attachments (one or more per decision item).
        AddCommitteeDecisionAttachments(violation, decisionItems, now);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        var committeeDecisionTimelineEvent = await AddViolationTimelineAsync(
            violation.Id,
            "CommitteeDecisionSubmitted",
            outcomeEventCode,
            content: decisionContent,
            fromStatusId: fromStatusId,
            toStatusId: violation.StatusId,
            targetHandlerTypeCode: targetHandlerTypeCode,
            targetHandlerUserId: targetHandlerUserId,
            targetHandlerUserName: targetHandlerUserName).ConfigureAwait(false);
        await TrySendStaffNotificationAsync(violation.Id, committeeDecisionTimelineEvent.Id).ConfigureAwait(false);

        // Req 70: committee decided a warning only (no fine, no approval step, no report generated) →
        // notify the customer as CP-050 with no attachment. Guarded; a notification failure must not
        // affect the committee decision that just persisted.
        if (violation.StatusId == (int)InspectionViolationStatus.WarningIssued
            && _violationNotificationService != null)
        {
            await _violationNotificationService
                .TrySendStatusNotificationAsync(violation.Id, pdfBytes: null, objectName: null, fileName: null)
                .ConfigureAwait(false);
        }
    }

    public async Task ApprovalAsync(int id)
    {
        await EnsureCanApproveViolationAsync();

        var violation = await RequireViolationAsync(id).ConfigureAwait(false);
        if (violation.StatusId != (int)InspectionViolationStatus.PendingApproval)
        {
            throw new BusinessException("Inspection.Violation.ApprovalInvalidState", "");
        }

        var fromStatusId = violation.StatusId;
        violation.ApprovalOn = DateTimeHelper.Now;
        var now = DateTimeHelper.Now;

        // If the committee decided to cancel the violation, the inspector's approval finalises the cancellation.
        if (violation.CommitteeDecisionTypeId == (int)InspectionDecisionType.CancelViolation)
        {
            SetViolationStatus(violation, (int)InspectionViolationStatus.Cancelled);
            TouchViolation(violation);
            await CancelOpenPenaltyOrdersAsync(violation.Id, now).ConfigureAwait(false);

            _violationRepository.Update(violation);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

            var cancelContent = "Violation has been cancelled after review.";
            var cancelTimelineEvent = await AddViolationTimelineAsync(
                violation.Id,
                "ViolationApproved",
                InspectionViolationTimelineEventCodes.ViolationCancelled,
                content: cancelContent,
                fromStatusId: fromStatusId,
                toStatusId: violation.StatusId,
                targetHandlerTypeCode: null,
                targetHandlerUserId: null,
                targetHandlerUserName: null).ConfigureAwait(false);

            // Req 188 / CP-054: this is the non-appeal direct-cancellation path (committee Cancel
            // Violation decision, finalised here by Inspector Approval). Independent of report
            // regeneration below — a report failure must not block the notification, or vice versa.
            if (_violationCancellationNotificationService != null)
            {
                await _violationCancellationNotificationService
                    .TrySendAsync(violation.Id, cancelTimelineEvent.Id)
                    .ConfigureAwait(false);
            }
        }
        else
        {
            SetViolationStatus(violation, (int)InspectionViolationStatus.PendingPayment);
            TouchViolation(violation);
            await EnsurePenaltyOrderCreatedAsync(violation).ConfigureAwait(false);

            _violationRepository.Update(violation);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
            await AddViolationTimelineAsync(
                violation.Id,
                "ViolationApproved",
                InspectionViolationTimelineEventCodes.PendingPayment,
                content: "Fine has been generated.",
                fromStatusId: fromStatusId,
                toStatusId: violation.StatusId,
                targetHandlerTypeCode: "Customer",
                targetHandlerUserId: null,
                targetHandlerUserName: "Customer").ConfigureAwait(false);
        }

        // Generate violation approval report PDF (CommitteeReview=1 filter).
        // Req 70: this is the committee inspector-approval path (fine → Pending Payment), so the
        // report is emailed to the customer as CP-051 (notifyCommitteeFine: true).
        if (_violationApprovalReportPdfService != null)
        {
            await _violationApprovalReportPdfService.GenerateAndSaveAsync(
                id,
                ViolationReportFilterMode.CommitteeReview,
                notifyCustomer: true).ConfigureAwait(false);
        }
    }

    public async Task<InspectionTaskTargetOverviewLimitedDto?> GetTargetOverviewAsync(int violationId)
    {
        // Step 1: load the violation to determine SourceTaskId
        var violation = await _dbContext.InspectionViolations
            .AsNoTracking()
            .Where(v => v.Id == violationId)
            .Select(v => new { v.Id, v.SourceTaskId })
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (violation == null)
        {
            return null;
        }

        int? establishmentId = null;
        int? individualId = null;

        if (violation.SourceTaskId.HasValue && violation.SourceTaskId.Value > 0)
        {
            // Task-linked: resolve target from the source task
            var taskTarget = await _dbContext.InspectionTasks
                .AsNoTracking()
                .Where(t => t.Id == violation.SourceTaskId.Value)
                .Select(t => new { t.EstablishmentId, t.IndividualId })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            establishmentId = taskTarget?.EstablishmentId;
            individualId = taskTarget?.IndividualId;
        }
        else
        {
            // Standalone (SourceTaskId = 0 or null): resolve target from SourceSnapshot
            var snapshot = await _dbContext.InspectionViolationSourceSnapshots
                .AsNoTracking()
                .Where(s => s.ViolationId == violationId)
                .Select(s => new { s.EstablishmentId, s.IndividualId })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            establishmentId = snapshot?.EstablishmentId;
            individualId = snapshot?.IndividualId;
        }

        if (!establishmentId.HasValue && !individualId.HasValue)
        {
            return new InspectionTaskTargetOverviewLimitedDto { ViolationCount = 0, UnpayCount = 0 };
        }

        // Task-linked violations for this target
        var taskLinkedQuery = _dbContext.InspectionViolations
            .AsNoTracking()
            .Where(v => v.SourceTask != null);

        taskLinkedQuery = establishmentId.HasValue
            ? taskLinkedQuery.Where(v => v.SourceTask!.EstablishmentId == establishmentId)
            : taskLinkedQuery.Where(v => v.SourceTask!.IndividualId == individualId);

        taskLinkedQuery = taskLinkedQuery.Where(v => v.ApprovalOn != null);

        // Standalone violations (SourceTaskId = 0 or null) linked to same target via SourceSnapshot
        var matchingSnapshotViolationIds = establishmentId.HasValue
            ? _dbContext.InspectionViolationSourceSnapshots
                .AsNoTracking()
                .Where(s => s.EstablishmentId == establishmentId)
                .Select(s => s.ViolationId)
            : _dbContext.InspectionViolationSourceSnapshots
                .AsNoTracking()
                .Where(s => s.IndividualId == individualId)
                .Select(s => s.ViolationId);

        var standaloneQuery = _dbContext.InspectionViolations
            .AsNoTracking()
            .Where(v => (v.SourceTaskId == null || v.SourceTaskId == 0)
                        && matchingSnapshotViolationIds.Contains(v.Id)
                        && v.ApprovalOn != null);

        var taskLinkedCount = await taskLinkedQuery.CountAsync().ConfigureAwait(false);
        var standaloneCount = await standaloneQuery
            .CountAsync(v => v.StatusId == (int)InspectionViolationStatus.Paid)
            .ConfigureAwait(false);
        var taskLinkedUnpay = await taskLinkedQuery
            .CountAsync(v => v.StatusId == (int)InspectionViolationStatus.PendingPayment)
            .ConfigureAwait(false);
        const int standaloneUnpay = 0;

        return new InspectionTaskTargetOverviewLimitedDto
        {
            ViolationCount = taskLinkedCount + standaloneCount,
            UnpayCount = taskLinkedUnpay + standaloneUnpay
        };
    }

    private async Task<InspectionViolation> RequireViolationAsync(int id)
    {
        var violation = await _violationRepository.GetAggregateAsync(id).ConfigureAwait(false);
        if (violation == null)
        {
            throw new BusinessException("Inspection.Violation.NotFound", "");
        }
        
        return violation;
    }

    private IQueryable<InspectionViolation> ApplyViolationDataScope(
        IQueryable<InspectionViolation> query,
        ViolationVisibilityContext context)
    {
        if (context.IsManager)
        {
            return query;
        }

        // Dept=2 leader: scope to violations where any department member is a handler
        if (context.IsDepartmentLeader && context.DepartmentMemberUserIds.Count > 0)
        {
            return query.Where(v => _dbContext.InspectionViolationHandlers
                .Any(h => h.ViolationId == v.Id
                          && h.UserId != null
                          && context.DepartmentMemberUserIds.Contains(h.UserId.Trim())));
        }

        return ApplyCurrentUserViolationHandlerScope(query);
    }

    private IQueryable<InspectionViolation> ApplyViolationListVisibilityScope(
        IQueryable<InspectionViolation> query, 
        string? scope,
        ViolationVisibilityContext context)
    {
        if (context.IsManager)
        {
            return query;
        }

        // Dept=2 leader: use department members' handler scope instead of current user only
        IQueryable<InspectionViolation> handlerScopedQuery;
        if (context.IsDepartmentLeader && context.DepartmentMemberUserIds.Count > 0)
        {
            handlerScopedQuery = query.Where(v => _dbContext.InspectionViolationHandlers
                .Any(h => h.ViolationId == v.Id
                          && h.UserId != null
                          && context.DepartmentMemberUserIds.Contains(h.UserId.Trim())));

            // Apply todo/completed scope filter for leader
            if (!string.IsNullOrEmpty(scope))
            {
                var todoStatusId = (int)InspectionViolationStatus.PendingCommitteeDecision;
                handlerScopedQuery = scope switch
                {
                    "todo" => handlerScopedQuery.Where(x => x.StatusId <= todoStatusId),
                    "completed" => handlerScopedQuery.Where(x => x.StatusId > todoStatusId),
                    _ => handlerScopedQuery
                };
            }

            return handlerScopedQuery;
        }

        handlerScopedQuery = ApplyCurrentUserViolationHandlerScope(query);
        var isCommittee = context.IsCommittee;
        var isContent = context.IsContent;

        if (scope == null)
        {
            return handlerScopedQuery;
        }


        IQueryable<InspectionViolation>? combined = null;

        if (isCommittee)
        {
            var committeeScoped = ApplyRoleScope(handlerScopedQuery, (int)InspectionViolationStatus.PendingCommitteeDecision, scope);
            combined = combined == null ? committeeScoped : combined.Union(committeeScoped);
        }

        if (isContent)
        {
            var contentScoped = ApplyRoleScope(handlerScopedQuery, (int)InspectionViolationStatus.PendingContentReport, scope);
            combined = combined == null ? contentScoped : combined.Union(contentScoped);
        }

        return combined ?? handlerScopedQuery;
    }

    private static IQueryable<InspectionViolation> ApplyRoleScope(IQueryable<InspectionViolation> query, int todoStatusId, string? scope)
    {
        return scope switch
        {
            "todo" => query.Where(x => x.StatusId == todoStatusId),
            "completed" => query.Where(x => x.StatusId > todoStatusId),
            _ => query
        };
    }


    private async Task<bool> CanManageViolationsAsync()
    {
        if (_canManageViolations.HasValue)
        {
            return _canManageViolations.Value;
        }

        var userId = _currentUserService.UserId?.Trim();
        if (string.IsNullOrWhiteSpace(userId))
        {
            _canManageViolations = false;
            return false;
        }

        // SUPER_ADMINISTRATOR always sees the full violation scope, regardless of department membership.
        if (await _permissionService.IsSuperAdminAsync().ConfigureAwait(false))
        {
            _canManageViolations = true;
            return true;
        }

        _canManageViolations = await _dbContext.UserDepartments
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.DepartmentId == InspectionDepartmentId && x.IsLeader == true)
            .AnyAsync()
            .ConfigureAwait(false);

        return _canManageViolations.Value;
    }

    // Visibility context to avoid multiple async permission checks
    private sealed class ViolationVisibilityContext
    {
        public bool IsManager { get; set; }
        public bool IsContent { get; set; }
        public bool IsCommittee { get; set; }
        public bool IsDepartmentLeader { get; set; }
        public List<string> DepartmentMemberUserIds { get; set; } = new();
    }

    // Action permission context for resolving available actions
    private sealed class ViolationActionContext
    {
        public bool CanRoute { get; set; }
        public bool CanContent { get; set; }
        public bool CanDecide { get; set; }
        public bool CanApprove { get; set; }
    }

    private async Task<ViolationVisibilityContext> BuildVisibilityContextAsync()
    {
        var context = new ViolationVisibilityContext
        {
            IsManager = await CanManageViolationsAsync().ConfigureAwait(false),
            IsContent = await IsContentUserAsync().ConfigureAwait(false),
            IsCommittee = await IsCommitteeUserAsync().ConfigureAwait(false)
        };

        // dept=2 leader: override manager flag — leader sees only department members' data, not all data.
        // SUPER_ADMINISTRATOR is exempt: it keeps full visibility even when it also sits in dept=2 as leader.
        var currentUserId = _currentUserService.UserId?.Trim();
        if (!string.IsNullOrEmpty(currentUserId) && !context.IsManager)
        {
            var userDepartments = await _departmentService.GetDepartmentUserByIdList(currentUserId).ConfigureAwait(false);
            var isLeader = userDepartments.Any(ud => ud.DepartmentId == 2 && ud.IsLeader == true);
            if (isLeader)
            {
                context.IsManager = false;
                context.IsDepartmentLeader = true;
                context.DepartmentMemberUserIds = await _dbContext.UserDepartments
                    .AsNoTracking()
                    .Where(ud => ud.DepartmentId == 2 && !string.IsNullOrEmpty(ud.UserId))
                    .Select(ud => ud.UserId!.Trim())
                    .Distinct()
                    .ToListAsync()
                    .ConfigureAwait(false);
            }
        }

        return context;
    }

    private async Task<ViolationActionContext> BuildActionContextAsync()
    {
        return new ViolationActionContext
        {
            CanRoute = await CanRouteViolationAsync().ConfigureAwait(false),
            CanContent = await CanSubmitContentReportAsync().ConfigureAwait(false),
            CanDecide = await CanDecideViolationAsync().ConfigureAwait(false),
            CanApprove = await CanApproveViolationAsync().ConfigureAwait(false)
        };
    }

    private async Task<bool> IsContentUserAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationContent")
            .ConfigureAwait(false);
    }

    private async Task<bool> IsCommitteeUserAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationDecide")
            .ConfigureAwait(false);
    }

    private static string? NormalizeViolationListScope(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope))
        {
            return null;
        }

        return scope.Trim().ToLowerInvariant() switch
        {
            "todo" => "todo",
            "completed" => "completed",
            "complated" => "completed",
            _ => null
        };
    }

    private static InspectionUserViolationListRequestDto NormalizeUserViolationListRequest(InspectionUserViolationListRequestDto request)
    {
        request.Keyword = string.IsNullOrWhiteSpace(request.Keyword) ? null : request.Keyword.Trim();
        request.StartTime = string.IsNullOrWhiteSpace(request.StartTime) ? null : request.StartTime.Trim();
        request.EndTime = string.IsNullOrWhiteSpace(request.EndTime) ? null : request.EndTime.Trim();
        request.EstablishmentId = request.EstablishmentId > 0 ? request.EstablishmentId : null;
        request.IndividualId = request.IndividualId > 0 ? request.IndividualId : null;
        request.TaskId = request.TaskId > 0 ? request.TaskId : null;
        request.ViolationTypeId = request.ViolationTypeId > 0 ? request.ViolationTypeId : null;
        request.StatusId = request.StatusId > 0 ? request.StatusId : null;
        return request;
    }

    private static bool TryParseViolationListFineAmountSearch(string? search, out decimal fineAmount)
    {
        fineAmount = 0m;
        if (string.IsNullOrWhiteSpace(search))
        {
            return false;
        }

        var normalizedSearch = search.Trim();
        return decimal.TryParse(normalizedSearch, NumberStyles.Number, CultureInfo.InvariantCulture, out fineAmount)
               || decimal.TryParse(normalizedSearch, NumberStyles.Number, CultureInfo.CurrentCulture, out fineAmount);
    }

    private async Task<InspectionUserViolationListRequestDto> ResolveUserViolationTargetScopeAsync(InspectionUserViolationListRequestDto request)
    {
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

    private static void ValidateTargetScope(int? establishmentId, int? individualId)
    {
        if (establishmentId.HasValue == individualId.HasValue)
        {
            throw new BusinessException("Inspection.Target.ExactlyOneTargetRequired", "");
        }
    }

private static (DateTime? From, DateTime? To) ParseUserViolationListDateRange(string? startTime, string? endTime)
{
	DateTime? from = null;
	DateTime? to = null;

	if (!string.IsNullOrWhiteSpace(startTime))
	{
		if (!DateTime.TryParse(startTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedStart))
		{
			throw new BusinessException("Inspection.Violation.InvalidDateFormat", "");
		}

		from = parsedStart;
	}

	if (!string.IsNullOrWhiteSpace(endTime))
	{
		if (!DateTime.TryParse(endTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedEnd))
		{
			throw new BusinessException("Inspection.Violation.InvalidDateFormat", "");
		}

		to = parsedEnd;
	}

	if (from.HasValue && to.HasValue && from.Value > to.Value)
	{
		throw new BusinessException("Inspection.Violation.InvalidDateRange", "");
	}

	return (from, to);
}

    private static List<InspectionViolationStatusStatDto> BuildTargetScopedViolationStatusStats(
        IReadOnlyDictionary<int, int> countsByStatus,
        IReadOnlyDictionary<int, string> statusNames)
    {
        return OrderedTargetScopedViolationStatuses
            .Select(status => new InspectionViolationStatusStatDto
            {
                StatusId = (int)status,
                StatusName = statusNames.TryGetValue((int)status, out var resolvedStatusName)
                    ? resolvedStatusName
                    : MapViolationStatusName((int)status),
                Count = countsByStatus.TryGetValue((int)status, out var count) ? count : 0
            })
            .ToList();
    }
    

    private static IQueryable<InspectionViolation> ApplySorting(IQueryable<InspectionViolation> query, string? sortBy, string? sortDirection)
    {
        var normalizedSortBy = sortBy?.Trim().ToLowerInvariant();
        var ascending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);

        return normalizedSortBy switch
        {
            "violationno" => ascending
                ? query.OrderBy(x => x.ViolationNo).ThenBy(x => x.CreatedOn)
                : query.OrderByDescending(x => x.ViolationNo).ThenByDescending(x => x.CreatedOn),
            "lastupdatedon" => ascending
                ? query.OrderBy(x => x.LastUpdatedOn).ThenBy(x => x.Id)
                : query.OrderByDescending(x => x.LastUpdatedOn).ThenByDescending(x => x.Id),
            "statusid" => ascending
                ? query.OrderBy(x => x.StatusId).ThenBy(x => x.CreatedOn)
                : query.OrderByDescending(x => x.StatusId).ThenByDescending(x => x.CreatedOn),
	            "sladeadlineat" => ascending
	                ? query.OrderBy(x => x.SlaDeadlineAt).ThenBy(x => x.CreatedOn)
	                : query.OrderByDescending(x => x.SlaDeadlineAt).ThenByDescending(x => x.CreatedOn),
            _ => ascending
                ? query.OrderBy(x => x.LastUpdatedOn).ThenBy(x => x.Id)
                : query.OrderByDescending(x => x.LastUpdatedOn).ThenByDescending(x => x.Id)
        };
    }

	    private static InspectionTaskSlaSummaryDto? BuildTaskDerivedSla(
	        int? sourceTaskStatusId,
	        DateTime? sourceTaskDueDate,
        DateTime? sourceTaskCheckoutAt,
        DateTime? sourceTaskReportSubmittedAt,
        DateTime? sourceTaskLastUpdatedOn,
        bool isArabic = false)
    {
        if (!sourceTaskStatusId.HasValue || !sourceTaskDueDate.HasValue || !sourceTaskLastUpdatedOn.HasValue)
        {
            return null;
        }

        return InspectionSlaSummaryBuilder.Build(
            sourceTaskDueDate.Value,
            sourceTaskStatusId.Value,
            sourceTaskCheckoutAt,
            sourceTaskReportSubmittedAt,
            sourceTaskLastUpdatedOn.Value,
	            isArabic);
	    }
	
	    private static InspectionTaskSlaSummaryDto? BuildViolationSla(
	        DateTime? slaDeadlineAt,
	        bool isArabic = false)
	    {
	        // Violation list/detail SLA is based on InspectionViolations.SlaDeadlineAt, not the source task due date.
	        if (!slaDeadlineAt.HasValue)
	        {
	            return null;
	        }
	
	        return InspectionSlaSummaryBuilder.Build(slaDeadlineAt.Value, completedOn: null, isArabic: isArabic);
	    }
	
	
	private async Task<Dictionary<int, string>> ResolveEnumTypeDictionaryNamesAsync(string scope, IReadOnlyList<int> ids, bool preferArabic = false)
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
				resolved[resolvedId] = preferArabic
					? (CoalesceDisplayName(item.NameAr, item.NameEn) ?? resolvedId.ToString())
					: (CoalesceDisplayName(item.NameEn, item.NameAr) ?? resolvedId.ToString());
			}
		}

		return resolved;
	}

    private static int ResolveEnumDictionaryValueId(string? code, int? sort, int fallbackId)
    {
        if (int.TryParse(code, out var parsedCode))
        {
            return parsedCode;
        }

        return sort ?? fallbackId;
    }

private static string? CoalesceDisplayName(string? primary, string? secondary)
	=> !string.IsNullOrWhiteSpace(primary)
		? primary.Trim()
		: !string.IsNullOrWhiteSpace(secondary)
			? secondary.Trim()
			: null;

/// <summary>
/// Resolves the violator target type code for list/export responses.
/// Prefers the stored <see cref="InspectionViolation.ViolatorType"/> ("Establishment" / "Individual" /
/// "Unregistered"); when absent, falls back to whichever target FK is present on the source task/snapshot.
/// </summary>
private static string? ResolveViolatorTargetTypeCode(string? violatorType, int? establishmentId, int? individualId)
{
	if (!string.IsNullOrWhiteSpace(violatorType))
	{
		return violatorType.Trim();
	}

	if (establishmentId is > 0)
	{
		return nameof(InspectionTargetType.Establishment);
	}

	if (individualId is > 0)
	{
		return nameof(InspectionTargetType.Individual);
	}

	return null;
}


    private static List<int> CollectIds(IEnumerable<int?> ids)
        => ids.Where(x => x.HasValue && x.Value > 0)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

    private async Task<InspectionViolationTimelineEvent> AddViolationTimelineAsync(
        int violationId,
        string eventType,
        string eventCode,
        string? content = null,
        int? departmentId = null,
        int? fromStatusId = null,
        int? toStatusId = null,
        string? targetHandlerTypeCode = null,
        string? targetHandlerUserId = null,
        string? targetHandlerUserName = null,
        string? actorTypeCode = null,
        string? actorUserId = null,
        string? actorUserName = null,
        int? actorRoleId = null,
        string? persistedHandlerType = null)
    {
        var resolvedActorTypeCode = NormalizeTimelineActorTypeCode(actorTypeCode);
        var resolvedActorUserId = actorUserId ?? _currentUserService.UserId;
        var resolvedActorUserName = actorUserName ?? GetOperatorName();

        var resolvedEventName = InspectionViolationTimelineEventCodes.GetName(eventCode);

        var added = await _violationTimelineRepository.AddAsync(new InspectionViolationTimelineEvent
        {
            ViolationId = violationId,
            EventType = eventType,
            EventCode = eventCode,
            EventName = resolvedEventName,
            Label = resolvedEventName,
            FromStatusId = fromStatusId,
            ToStatusId = toStatusId,
            TargetHandlerTypeCode = targetHandlerTypeCode,
            TargetHandlerUserId = targetHandlerUserId,
            TargetHandlerUserName = targetHandlerUserName,
            ActorTypeCode = resolvedActorTypeCode,
            ActorUserId = resolvedActorUserId,
            ActorUserName = resolvedActorUserName,

            Content = content,
            PersistedHandlerType = persistedHandlerType,
            CreatedOn = DateTimeHelper.Now
        }).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
        return added;
    }

    private async Task TrySendStaffNotificationAsync(int violationId, int timelineEventId)
    {
        if (_staffNotificationService == null)
        {
            return;
        }

        try
        {
            await _staffNotificationService.TrySendAsync(violationId, timelineEventId).ConfigureAwait(false);
        }
        catch
        {
            // Notification failures are isolated after the violation event is persisted.
        }
    }

    private async Task<(string? UserId, string? UserName)> ResolveRandomRoleMatchedUserAsync(string roleName)
    {
        var assignee = await _randomRoleAssigneeResolver.ResolveAsync(roleName)
            .ConfigureAwait(false);
        if (assignee == null)
        {
            return (null, null);
        }

        return (assignee.UserId, assignee.UserName);
    }

    private async Task<(string? UserId, string? UserName)> ResolveConfigKeyMatchedViolationTargetAsync(
        int violationId,
        string handlerType,
        string configKey)
    {
        var normalizedHandlerType = handlerType.Trim().ToUpperInvariant();

        var existingUserId = await _dbContext.InspectionViolationHandlers
            .AsNoTracking()
            .Where(x => x.ViolationId == violationId
                        && x.IsActive != false
                        && !string.IsNullOrWhiteSpace(x.UserId)
                        && x.HandlerType != null
                        && x.HandlerType.Trim().ToUpper() == normalizedHandlerType)
            .OrderByDescending(x => x.AssignedAt)
            .ThenByDescending(x => x.Id)
            .Select(x => x.UserId)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (!string.IsNullOrWhiteSpace(existingUserId))
        {
            return (existingUserId, await ResolveUserDisplayNameAsync(existingUserId).ConfigureAwait(false));
        }

        var assignee = await _randomRoleAssigneeResolver
            .ResolveByConfigKeyAsync(configKey)
            .ConfigureAwait(false);

        return assignee == null ? (null, null) : (assignee.UserId, assignee.UserName);
    }

    private async Task<(string? UserId, string? UserName)> ResolveRoleMatchedViolationTargetAsync(
        int violationId,
        string roleNameFilter)
    {
        var normalizedRoleNameFilter = roleNameFilter.Trim().ToUpperInvariant();

        var existingUserId = await _dbContext.InspectionViolationHandlers
            .AsNoTracking()
            .Where(x => x.ViolationId == violationId
                        && x.IsActive != false
                        && !string.IsNullOrWhiteSpace(x.UserId)
                        && x.HandlerType != null
                        && x.HandlerType.Trim().ToUpper() == normalizedRoleNameFilter)
            .OrderByDescending(x => x.AssignedAt)
            .ThenByDescending(x => x.Id)
            .Select(x => x.UserId)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (!string.IsNullOrWhiteSpace(existingUserId))
        {
            return (existingUserId, await ResolveUserDisplayNameAsync(existingUserId).ConfigureAwait(false));
        }

        return await ResolveRandomRoleMatchedUserAsync(roleNameFilter).ConfigureAwait(false);
    }

    private async Task<string?> ResolveRandomRoleMatchedUserIdAsync(string roleNameFilter)
        => (await ResolveRandomRoleMatchedUserAsync(roleNameFilter).ConfigureAwait(false)).UserId;

    private async Task<string?> ResolveRandomRoleMatchedUserNameAsync(string roleNameFilter)
        => (await ResolveRandomRoleMatchedUserAsync(roleNameFilter).ConfigureAwait(false)).UserName;

    private async Task<string?> ResolveUserDisplayNameAsync(string? userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        var user = await _dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => new { x.FirstName, x.LastName, x.UserName, x.Email })
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        return user == null
            ? userId
            : BuildUserDisplayName(user.FirstName, user.LastName, user.UserName, user.Email);
    }

    private static string BuildUserDisplayName(string? firstName, string? lastName, string? userName, string? email)
    {
        var fullName = string.Join(" ", new[] { firstName?.Trim(), lastName?.Trim() }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return FirstNonEmpty(fullName, userName?.Trim(), email?.Trim()) ?? "System";
    }


    private IQueryable<InspectionViolation> ApplyCurrentUserViolationHandlerScope(IQueryable<InspectionViolation> query)
    {
        var currentUserId = _currentUserService.UserId?.Trim();
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return query.Where(_ => false);
        }

        return query.Where(x => _dbContext.InspectionViolationHandlers.Any(handler => handler.ViolationId == x.Id
            && handler.UserId == currentUserId
            && handler.IsActive != false));
    }


    private string? ResolveInspectionHandlerUserId(InspectionViolation violation)
        => FirstNonEmpty(violation.ReportedByUserId, violation.CreatedBy, _currentUserService.UserId);

    private string ResolveInspectionHandlerUserName(InspectionViolation violation)
        => FirstNonEmpty(violation.ReportedByName, _currentUserService.UserName, violation.CreatedBy, _currentUserService.UserId, "Inspection Department")!;

    private static string ResolveCommitteeDecisionTimelineEventCode(int statusId, int? committeeDecisionTypeId = null)
        => statusId switch
        {
            (int)InspectionViolationStatus.PendingPayment => InspectionViolationTimelineEventCodes.PendingPayment,
            (int)InspectionViolationStatus.WarningIssued => InspectionViolationTimelineEventCodes.WarningIssued,
            (int)InspectionViolationStatus.Cancelled => InspectionViolationTimelineEventCodes.ViolationCancelled,
            _ => InspectionViolationTimelineEventCodes.PendingApproval
        };

    private static string? ResolveCommitteeDecisionTargetHandlerTypeCode(string eventCode)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.PendingPayment => "Customer",
            InspectionViolationTimelineEventCodes.WarningIssued => "System",
            InspectionViolationTimelineEventCodes.PendingApproval => "InspectionDepartment",
            _ => null
        };

    private string? ResolveCommitteeDecisionTargetHandlerUserId(InspectionViolation violation, string eventCode)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.PendingPayment => null,
            InspectionViolationTimelineEventCodes.WarningIssued => null,
            InspectionViolationTimelineEventCodes.PendingApproval => ResolveInspectionHandlerUserId(violation),
            _ => null
        };

    private async Task<string?> ResolveCommitteeDecisionTargetHandlerUserNameAsync(InspectionViolation violation, string eventCode, string? targetHandlerUserId)
    {
        return eventCode switch
        {
            InspectionViolationTimelineEventCodes.PendingPayment => "Customer",
            InspectionViolationTimelineEventCodes.WarningIssued => "Automated",
            InspectionViolationTimelineEventCodes.PendingApproval => await Task.FromResult(ResolveInspectionHandlerUserName(violation)).ConfigureAwait(false),
            _ => null
        };
    }

    private static string ResolveCommitteeDecisionContent(string eventCode, string? committeeDecisionNote)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.PendingPayment => "Fine has been generated.",
            InspectionViolationTimelineEventCodes.WarningIssued => "Warning has been issued to the customer based on violation rule and occurrence count.",
            InspectionViolationTimelineEventCodes.ViolationCancelled => "Violation has been cancelled after review.",
            InspectionViolationTimelineEventCodes.PendingApproval => "Committee decision has been made and is waiting for the Inspection Department's approval.",
            _ => InspectionViolationTimelineEventCodes.GetName(eventCode)
        };

    private void TouchViolation(InspectionViolation violation)
    {
        violation.LastUpdatedOn = DateTimeHelper.Now;
        violation.UpdatedBy = _currentUserService.UserId;
    }

    private void SetViolationStatus(InspectionViolation violation, int statusId)
    {
        if (violation.StatusId == statusId)
        {
            return;
        }

        violation.StatusId = statusId;
        TouchViolation(violation);
    }

    private async Task EnsurePenaltyOrderCreatedAsync(InspectionViolation violation)
    {
        if (!ShouldGeneratePenaltyOrder(violation))
        {
            return;
        }

        var hasExistingOrder = await _dbContext.InspectionViolationPenaltyOrders
            .AsNoTracking()
            .AnyAsync(x => x.ViolationId == violation.Id)
            .ConfigureAwait(false);

        if (hasExistingOrder)
        {
            return;
        }

        var orderTimestamp = violation.CommitteeDecidedOn
                             ?? (violation.LastUpdatedOn == default ? DateTimeHelper.Now : violation.LastUpdatedOn);

        await _dbContext.InspectionViolationPenaltyOrders.AddAsync(new InspectionViolationPenaltyOrder
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
            CreatedBy = violation.CommitteeDecidedByUserId ?? violation.UpdatedBy ?? violation.CreatedBy ?? _currentUserService.UserId,
            UpdatedAt = null,
            UpdatedBy = null
        }).ConfigureAwait(false);
    }

    private static bool ShouldGeneratePenaltyOrder(InspectionViolation violation)
        => violation.Id > 0
           && violation.StatusId == (int)InspectionViolationStatus.PendingPayment
           && violation.FineAmount > 0m;

    private async Task CancelOpenPenaltyOrdersAsync(int violationId, DateTime updatedOn)
    {
        if (violationId <= 0)
        {
            return;
        }

        var openPenaltyOrders = await _dbContext.InspectionViolationPenaltyOrders
            .Where(x => x.ViolationId == violationId
                        && x.StatusId != (int)InspectionViolationPenaltyOrderStatus.Paid
                        && x.StatusId != (int)InspectionViolationPenaltyOrderStatus.Cancelled
                        && x.StatusId != (int)InspectionViolationPenaltyOrderStatus.Refunded)
            .ToListAsync()
            .ConfigureAwait(false);

        foreach (var penaltyOrder in openPenaltyOrders)
        {
            penaltyOrder.StatusId = (int)InspectionViolationPenaltyOrderStatus.Cancelled;
            penaltyOrder.UpdatedAt = updatedOn;
            penaltyOrder.UpdatedBy = _currentUserService.UserId;
        }
    }



    private string GetOperatorName() => _currentUserService.UserName ?? _currentUserService.UserId ?? "System";

    private static void EnsureViolationType(InspectionViolation violation, int expectedTypeId, string errorCode)
    {
        if (violation.ViolationTypeId != expectedTypeId)
        {
            throw new BusinessException(errorCode, "");
        }
    }

    private static int ResolveDecisionStatus(int? committeeDecisionTypeId, decimal totalFine)
    {
        if (committeeDecisionTypeId == (int)InspectionDecisionType.CancelViolation)
        {
            // CancelViolation still requires Inspector approval before the violation is actually cancelled.
            return (int)InspectionViolationStatus.PendingApproval;
        }

        if (totalFine > 0)
        {
            return (int)InspectionViolationStatus.PendingApproval;
        }

        return (int)InspectionViolationStatus.WarningIssued;
    }

    private static IQueryable<InspectionViolation> ApplyWorkflowStatusFilter(IQueryable<InspectionViolation> query, InspectionViolationStatus requestedStatus)
    {
        return query.Where(x => x.StatusId == (int)requestedStatus);
    }

    private static string NormalizeRouteTargetCode(string? routeTargetCode)
        => string.IsNullOrWhiteSpace(routeTargetCode) ? "Content Team" : routeTargetCode.Trim();

    private async Task<IReadOnlyDictionary<int, InspectionPenaltyRule>> LoadViolationItemsByStoredIdAsync(InspectionViolation violation)
    {
        // For standalone (taskId=0) internal violations, checklist violations are linked directly
        // via ViolationId on InspectionTaskChecklistViolation rather than through SourceTask.ChecklistItems.
        var isInternalViolation = violation.SourceTaskId == null || violation.SourceTaskId == 0;
        IEnumerable<InspectionTaskChecklistViolation> allChecklistViolationRows = isInternalViolation
            ? violation.DirectChecklistViolations
            : (violation.SourceTask?.ChecklistItems.SelectMany(x => x.Violations)
               ?? Enumerable.Empty<InspectionTaskChecklistViolation>());

        var storedIds = allChecklistViolationRows
            .Select(x => x.ViolationItemId)
            .Where(x => x > 0)
            .Distinct()
            .ToList();

        if (storedIds.Count == 0)
        {
            return new Dictionary<int, InspectionPenaltyRule>();
        }

        var catalogItems = await _violationCatalogRepository.GetByIdsAsync(storedIds).ConfigureAwait(false);
        var catalogByCanonicalId = catalogItems.ToDictionary(x => x.Id);
        var catalogByLegacyId = catalogItems
            .Where(x => x.LegacyViolationItemId.HasValue)
            .GroupBy(x => x.LegacyViolationItemId!.Value)
            .ToDictionary(group => group.Key, group => group.First());
        var catalogByCode = catalogItems
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var storedCodeById = allChecklistViolationRows
            .Select(x => (x.ViolationItemId, x.ViolationItemCode))
            .Where(x => x.ViolationItemId > 0 && !string.IsNullOrWhiteSpace(x.ViolationItemCode))
            .GroupBy(x => x.ViolationItemId)
            .ToDictionary(group => group.Key, group => group.First().ViolationItemCode, EqualityComparer<int>.Default);
        var normalized = new Dictionary<int, InspectionPenaltyRule>();

        foreach (var storedId in storedIds)
        {
            if (catalogByCanonicalId.TryGetValue(storedId, out var canonicalBySameId))
            {
                normalized[storedId] = canonicalBySameId;
                continue;
            }

            if (catalogByLegacyId.TryGetValue(storedId, out var canonicalByLegacyId))
            {
                normalized[storedId] = canonicalByLegacyId;
                continue;
            }

            if (storedCodeById.TryGetValue(storedId, out var storedCode)
                && catalogByCode.TryGetValue(storedCode, out var canonicalByCode))
            {
                normalized[storedId] = canonicalByCode;
            }
        }

        return normalized;
    }

    private async Task<IReadOnlyList<InspectionPenaltyRule>> ResolveOrderedPenaltyStandardsAsync(
        InspectionViolation violation,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        var checklistViolations = violation.SourceTask?.ChecklistItems
            .OrderBy(x => x.DisplayOrder ?? int.MaxValue)
            .ThenBy(x => x.RecordedAt)
            .ThenBy(x => x.Id)
            .SelectMany(item => item.Violations
                .Where(v => v.ViolationTypeId == violation.ViolationTypeId
                            && !string.IsNullOrWhiteSpace(v.ViolationItemCode))
                .OrderBy(v => v.Id)
                .Select(v => new ContentPenaltyStandardLookupItem(v.ViolationItemId, v.ViolationItemCode.Trim())))
            .ToList()
            ?? new List<ContentPenaltyStandardLookupItem>();

        if (checklistViolations.Count == 0)
        {
            return new List<InspectionPenaltyRule>();
        }

        var standardsByKey = await InspectionPenaltyStandardLookupReader
            .GetByTypeAndChecklistCodesAsync(
                _dbContext,
                checklistViolations.Select(x => InspectionPenaltyStandardLookupReader.CreateKey(violation.ViolationTypeId, x.ViolationItemCode)))
            .ConfigureAwait(false);

        if (violation.ViolationTypeId == (int)InspectionViolationType.Content)
        {
            return checklistViolations
                .DistinctBy(x => x.ViolationItemCode, StringComparer.OrdinalIgnoreCase)
                .Select(x => BuildContentPenaltyStandard(x, standardsByKey, violationItemsByStoredId))
                .Where(x => x != null)
                .Cast<InspectionPenaltyRule>()
                .ToList();
        }

        return checklistViolations
            .DistinctBy(x => x.ViolationItemCode, StringComparer.OrdinalIgnoreCase)
            .Select(x => BuildLicensingPenaltyStandard(x, standardsByKey, violationItemsByStoredId))
            .Where(x => x != null)
            .Cast<InspectionPenaltyRule>()
            .ToList();
    }

    private static InspectionLicensingPenaltyRule? BuildLicensingPenaltyStandard(
        ContentPenaltyStandardLookupItem checklistViolation,
        IReadOnlyDictionary<InspectionPenaltyStandardLookupKey, InspectionPenaltyRule> standardsByKey,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        var lookupKey = InspectionPenaltyStandardLookupReader.CreateKey((int)InspectionViolationType.Licensing, checklistViolation.ViolationItemCode);
        if (!standardsByKey.TryGetValue(lookupKey, out var matchedStandard)
            || matchedStandard is not InspectionLicensingPenaltyRule licensingStandard)
        {
            return null;
        }

        violationItemsByStoredId.TryGetValue(checklistViolation.ViolationItemId, out var catalogRule);

        return new InspectionLicensingPenaltyRule
        {
            PenaltyStandardId = licensingStandard.PenaltyStandardId,
            ChecklistCode = checklistViolation.ViolationItemCode,
            ViolationTypeId = (int)InspectionViolationType.Licensing,
            PenaltyModeCode = licensingStandard.PenaltyModeCode,
            FirstFineAmount = licensingStandard.FirstFineAmount,
            RepeatFineAmount = licensingStandard.RepeatFineAmount,
            EscalationFineAmount = licensingStandard.EscalationFineAmount,
            EscalationStartOccurrence = licensingStandard.EscalationStartOccurrence,
            RecurrenceMultiplier = licensingStandard.RecurrenceMultiplier,
            WarningThresholdCount = licensingStandard.WarningThresholdCount,
            GracePeriodDays = licensingStandard.GracePeriodDays,
            DailyFineStartDay = licensingStandard.DailyFineStartDay,
            DailyFineEndDay = licensingStandard.DailyFineEndDay,
            DailyFineAmount = licensingStandard.DailyFineAmount,
            DailyFineMaxAmount = licensingStandard.DailyFineMaxAmount,
            RectificationWindowDays = licensingStandard.RectificationWindowDays,
            ResetWindowMonths = licensingStandard.ResetWindowMonths,
            AdditionalPenaltyAction = licensingStandard.AdditionalPenaltyAction,
            Notes = licensingStandard.Notes,
            IsActive = licensingStandard.IsActive,
            DisplayOrder = catalogRule?.DisplayOrder,
            TemplateItemId = catalogRule?.Id ?? checklistViolation.ViolationItemId,
            LegacyViolationItemId = catalogRule?.LegacyViolationItemId,
            ViolationDescription = catalogRule?.NameEn ?? checklistViolation.ViolationItemCode,
            ChecklistName = catalogRule?.ChecklistName ?? catalogRule?.NameEn ?? checklistViolation.ViolationItemCode
        };
    }

    private static InspectionContentPenaltyRule? BuildContentPenaltyStandard(
        ContentPenaltyStandardLookupItem checklistViolation,
        IReadOnlyDictionary<InspectionPenaltyStandardLookupKey, InspectionPenaltyRule> standardsByKey,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        var lookupKey = InspectionPenaltyStandardLookupReader.CreateKey((int)InspectionViolationType.Content, checklistViolation.ViolationItemCode);
        if (!standardsByKey.TryGetValue(lookupKey, out var matchedStandard)
            || matchedStandard is not InspectionContentPenaltyRule contentStandard)
        {
            return null;
        }

        violationItemsByStoredId.TryGetValue(checklistViolation.ViolationItemId, out var catalogRule);

        return new InspectionContentPenaltyRule
        {
            PenaltyStandardId = contentStandard.PenaltyStandardId,
            ChecklistCode = checklistViolation.ViolationItemCode,
            ViolationTypeId = (int)InspectionViolationType.Content,
            Degree1FineAmount = contentStandard.Degree1FineAmount,
            Degree2FineAmount = contentStandard.Degree2FineAmount,
            Degree3FineAmount = contentStandard.Degree3FineAmount,
            Degree4FineAmount = contentStandard.Degree4FineAmount,
            RectificationWindowDays = contentStandard.RectificationWindowDays,
            ResetWindowMonths = contentStandard.ResetWindowMonths,
            AdditionalPenaltyAction = contentStandard.AdditionalPenaltyAction,
            Notes = contentStandard.Notes,
            IsActive = contentStandard.IsActive,
            DisplayOrder = catalogRule?.DisplayOrder,
            TemplateItemId = catalogRule?.Id ?? checklistViolation.ViolationItemId,
            LegacyViolationItemId = catalogRule?.LegacyViolationItemId,
            ViolationDescription = catalogRule?.NameEn ?? checklistViolation.ViolationItemCode,
            ChecklistName = catalogRule?.ChecklistName ?? catalogRule?.NameEn ?? checklistViolation.ViolationItemCode
        };
    }

    private readonly record struct ContentPenaltyStandardLookupItem(int ViolationItemId, string ViolationItemCode);

    private static InspectionViolationPenaltyStandardDto MapPenaltyStandard(
        InspectionViolation violation,
        IReadOnlyList<InspectionPenaltyRule> standards)
    {
        var result = new InspectionViolationPenaltyStandardDto
        {
            ViolationId = violation.Id,
            ViolationNo = violation.ViolationNo,
            ViolationTypeId = violation.ViolationTypeId,
            ViolationTypeCode = MapViolationTypeCode(violation.ViolationTypeId),
            ViolationTypeName = MapViolationTypeName(violation.ViolationTypeId)
        };

        foreach (var standard in standards)
        {
            switch (standard)
            {
                case InspectionLicensingPenaltyRule licensingRule:
                    result.LicensingStandards.Add(MapLicensingPenaltyStandard(licensingRule));
                    break;
                case InspectionContentPenaltyRule contentRule:
                    result.ContentStandards.Add(MapContentPenaltyStandard(contentRule));
                    break;
            }
        }

        return result;
    }

    private static InspectionViolationPenaltyOrderDetailDto MapPenaltyOrderDetail(
        InspectionViolation violation,
        InspectionViolationPenaltyOrder penaltyOrder,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        return new InspectionViolationPenaltyOrderDetailDto
        {
            PenaltyOrderId = penaltyOrder.PenaltyOrderId,
            ViolationId = violation.Id,
            ViolationNo = violation.ViolationNo,
            SourceTaskId = violation.SourceTaskId,
            ViolatorName = violation.ViolatorName,
            ViolatorIdentifier = violation.ViolatorIdentifier,
            TotalAmount = penaltyOrder.TotalAmount,
            BeforeAppealAdjustedTotalAmount = penaltyOrder.BeforeAppealAdjustedTotalAmount,
            Currency = penaltyOrder.Currency,
            StatusId = penaltyOrder.StatusId ?? (int)InspectionViolationPenaltyOrderStatus.PendingPayment,
            OrderStatus = penaltyOrder.OrderStatus,
            PendingTransactionId = penaltyOrder.PendingTransactionId,
            EngineCorrelationId = penaltyOrder.EngineCorrelationId,
            CalculatedAt = penaltyOrder.CalculatedAt,
            CreatedAt = penaltyOrder.CreatedAt,
            PaidAt = penaltyOrder.PaidAt,
            RawEngineResponseJson = penaltyOrder.RawEngineResponseJson,
            Items = BuildChecklistViolationDetails(violation, violationItemsByStoredId)
        };
    }

    private static InspectionViolationLicensingPenaltyStandardItemDto MapLicensingPenaltyStandard(InspectionLicensingPenaltyRule standard)
    {
        return new InspectionViolationLicensingPenaltyStandardItemDto
        {
            PenaltyStandardId = standard.PenaltyStandardId,
            ViolationItemId = standard.Id,
            LegacyViolationItemId = standard.LegacyViolationItemId,
            ViolationItemCode = standard.Code,
            ViolationItemName = standard.NameEn,
            ViolationTypeId = standard.ViolationTypeId,
            RectificationWindowDays = standard.RectificationWindowDays,
            ResetWindowMonths = standard.ResetWindowMonths,
            AdditionalPenaltyAction = standard.AdditionalPenaltyAction,
            Notes = standard.Notes,
            IsActive = standard.IsActive,
            DisplayOrder = standard.DisplayOrder,
            PenaltyModeCode = standard.PenaltyModeCode,
            FirstFineAmount = standard.FirstFineAmount,
            RepeatFineAmount = standard.RepeatFineAmount,
            EscalationFineAmount = standard.EscalationFineAmount,
            EscalationStartOccurrence = standard.EscalationStartOccurrence,
            RecurrenceMultiplier = standard.RecurrenceMultiplier,
            WarningThresholdCount = standard.WarningThresholdCount,
            GracePeriodDays = standard.GracePeriodDays,
            DailyFineStartDay = standard.DailyFineStartDay,
            DailyFineEndDay = standard.DailyFineEndDay,
            DailyFineAmount = standard.DailyFineAmount,
            DailyFineMaxAmount = standard.DailyFineMaxAmount
        };
    }

    private static InspectionViolationContentPenaltyStandardItemDto MapContentPenaltyStandard(InspectionContentPenaltyRule standard)
    {
        return new InspectionViolationContentPenaltyStandardItemDto
        {
            PenaltyStandardId = standard.PenaltyStandardId,
            ViolationItemId = standard.Id,
            LegacyViolationItemId = standard.LegacyViolationItemId,
            ViolationItemCode = standard.Code,
            ViolationItemName = standard.NameEn,
            ViolationTypeId = standard.ViolationTypeId,
            RectificationWindowDays = standard.RectificationWindowDays,
            ResetWindowMonths = standard.ResetWindowMonths,
            AdditionalPenaltyAction = standard.AdditionalPenaltyAction,
            Notes = standard.Notes,
            IsActive = standard.IsActive,
            DisplayOrder = standard.DisplayOrder,
            Degree1FineAmount = standard.Degree1FineAmount,
            Degree2FineAmount = standard.Degree2FineAmount,
            Degree3FineAmount = standard.Degree3FineAmount,
            Degree4FineAmount = standard.Degree4FineAmount
        };
    }

    private InspectionViolationDetailDto MapDetail(
        InspectionViolation violation,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames,
        Transaction? latestCompletedPayment,
        IReadOnlyList<InspectionViolationAppeal> relatedAppeals,
        IReadOnlyList<InspectionViolationReinspectionTaskDto> reinspectionTasks,
        ViolationActionContext actionContext,
        int violationCount = 0,
        int unpayCount = 0,
        int? establishmentId = null,
        int? individualId = null,
        int? profileId = null)
    {
        var orderedAppeals = relatedAppeals
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .ToList();
        var latestRelatedAppeal = orderedAppeals.FirstOrDefault();
        var declarationDocument = violation.Attachments
            .OrderByDescending(x => x.UploadedAt)
            .FirstOrDefault(x => InspectionTaskAttachmentCategory.DeclarationAcknowledgementDocument.Matches(x.AttachmentCategory));
        var latestContactPerson = violation.SourceTask?.ContactPersons
            .OrderByDescending(x => x.SubmittedOn ?? x.CreatedOn)
            .FirstOrDefault();
        var statusCode = MapViolationStatusCode(violation.StatusId);
        var statusName = MapViolationStatusName(violation.StatusId);
        var declarationToken = BuildDeclarationToken(violation);
        var declarationPortalUrl = BuildDeclarationPortalUrl(violation, declarationToken);
        var declarationStatusCode = ResolveDeclarationStatusCodeForContext(latestContactPerson, violation);
        var declarationStatusName = ResolveDeclarationStatusNameForContext(latestContactPerson, violation);
        var contactPersonDeclarationDocumentFileName = latestContactPerson?.DeclarationDocumentFileName;
        var contactPersonDeclarationDocumentFileUrl = latestContactPerson?.DeclarationDocumentFileUrl;
        var declarationSubmittedOn = violation.DeclarationSubmittedOn
                                    ?? latestContactPerson?.DeclarationDocumentGeneratedOn
                                    ?? latestContactPerson?.SignatureSignedOn
                                    ?? latestContactPerson?.SubmittedOn
                                    ?? declarationDocument?.UploadedAt;
        var declarationDocumentFileName = contactPersonDeclarationDocumentFileName ?? declarationDocument?.FileName ?? $"declaration-{violation.ViolationNo}.pdf";
        var declarationDocumentFileUrl = contactPersonDeclarationDocumentFileUrl ?? declarationDocument?.FileUrl ?? $"/api/admin/inspection/mock-files/declarations/declaration-{violation.ViolationNo}.pdf";
        var preferArabic = _currentUserService.IsArabicLanguage;
        var sla = BuildViolationSla(
            violation.SlaDeadlineAt,
            preferArabic);

        return new InspectionViolationDetailDto
        {
            Id = violation.Id,
            ViolationNo = violation.ViolationNo,
            SourceTaskId = violation.SourceTaskId,
            SourceTaskNo = violation.SourceTask?.TaskNo,
            ViolationTypeId = violation.ViolationTypeId,
            ViolationTypeCode = MapViolationTypeCode(violation.ViolationTypeId),
            ViolationTypeName = MapViolationTypeName(violation.ViolationTypeId, preferArabic),
            ViolatorName = violation.ViolatorName,
            ViolatorIdentifier = violation.ViolatorIdentifier,
            ReportedByUserId = violation.ReportedByUserId,
            ReportedByName = violation.ReportedByName,
            EstablishmentId = establishmentId,
            IndividualId = individualId,
            ProfileId = profileId,
            StatusId = violation.StatusId,
            StatusCode = statusCode,
            StatusName = statusName,
            InternalStatusId = violation.StatusId,
            InternalStatusCode = statusCode,
            InternalStatusName = statusName,
            BusinessStatusCode = statusCode,
            BusinessStatusName = statusName,
            FineAmount = violation.FineAmount,
            BeforeAppealAdjustedFineAmount = violation.BeforeAppealAdjustedFineAmount,
            AppealApproval = violation.AppealApproval ?? false,
            Sla = sla,
            AssignedContentId = violation.AssignedContentId,
            DeclarationRecipientAddress = violation.DeclarationRecipientAddress,
            DeclarationStatusCode = declarationStatusCode,
            DeclarationStatusName = declarationStatusName,
            DeclarationLinkSentOn = violation.DeclarationLinkSentOn,
            DeclarationLinkExpiresOn = violation.DeclarationLinkExpiresOn,
            DeclarationSubmittedOn = declarationSubmittedOn,
            DeclarationPortalUrl = declarationPortalUrl,
            DeclarationToken = declarationToken,
            DeclarationDocumentFileName = declarationDocumentFileName,
            DeclarationDocumentFileUrl = declarationDocumentFileUrl,
            ContentReviewReportUrl = violation.ContentReviewReportUrl,
            ContentReviewSummary = violation.ContentReviewSummary,
            LatestTransferNote = violation.LatestTransferNote,
            ContentReviewNote = violation.ContentReviewNote,
            CommitteeDecisionTypeId = violation.CommitteeDecisionTypeId,
            CommitteeDecisionTypeName = MapCommitteeDecisionTypeName(violation.CommitteeDecisionTypeId),
            CommitteeDecisionTypeNameAr = MapCommitteeDecisionTypeNameAr(violation.CommitteeDecisionTypeId),
            CommitteeDecisionNote = violation.CommitteeDecisionNote,
            CommitteeDecidedByUserId = violation.CommitteeDecidedByUserId,
            CommitteeDecidedByName = violation.CommitteeDecidedByName,
            CommitteeDecidedOn = violation.CommitteeDecidedOn,
            AppealDecisionNote = violation.AppealDecisionNote,
            AppealDecidedByUserId = violation.AppealDecidedByUserId,
            AppealDecidedByName = violation.AppealDecidedByName,
            AppealDecidedOn = violation.AppealDecidedOn,
            AppealDecisionTypeId = violation.AppealDecisionTypeId,
            AppealDecisionTypeCode = MapAppealDecisionTypeCode(violation.AppealDecisionTypeId),
            AppealDecisionTypeName = MapAppealDecisionTypeName(violation.AppealDecisionTypeId),
            AppealDecisionTypeNameAr = MapAppealDecisionTypeNameAr(violation.AppealDecisionTypeId),
            CreatedOn = violation.CreatedOn,
            LastUpdatedOn = violation.LastUpdatedOn,
            AvailableActions = ResolveAvailableActions(violation.StatusId, actionContext.CanRoute, actionContext.CanContent, actionContext.CanDecide, actionContext.CanApprove),
            ReinspectionTasks = reinspectionTasks.ToList(),
            RelatedAppeal = MapRelatedAppeal(latestRelatedAppeal, appealReasonDisplayNames),
            IsMock = false,
            ViolationCount = violationCount,
            UnpayCount = unpayCount,
            ChecklistViolations = BuildChecklistViolationDetails(violation, violationItemsByStoredId, filterByCommitteeReview: false, preferArabic: preferArabic),
            Attachments = violation.Attachments
                .OrderBy(x => x.Id)
                .Select(MapViolationAttachment)
                .ToList()
        };
    }

    private Task<Transaction?> LoadLatestCompletedFinePaymentAsync(string? violationNo)
    {
        if (string.IsNullOrWhiteSpace(violationNo))
        {
            return Task.FromResult<Transaction?>(null);
        }

        var normalizedViolationNo = violationNo.Trim();
        return _dbContext.PaymentTransactions
            .AsNoTracking()
            .Where(x => x.TransactionTypeId == 3
                        && x.StatusId == 3
                        && ((x.AppliedFor != null && x.AppliedFor == normalizedViolationNo)
                            || (x.ReferenceNumber != null && x.ReferenceNumber == normalizedViolationNo)))
            .OrderByDescending(x => x.CompletedAt ?? x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync();
    }

    private Task<List<InspectionViolationAppeal>> LoadRelatedAppealsAsync(int violationId)
    {
        return _dbContext.InspectionViolationAppeals
            .AsNoTracking()
            .Where(x => x.ViolationId == violationId)
            .Include(x => x.RefundLinks)
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .ToListAsync();
    }

    private Task<List<InspectionViolationReinspectionTaskDto>> BuildReinspectionTasksAsync(string? sourceTaskNo)
    {
        if (string.IsNullOrWhiteSpace(sourceTaskNo))
        {
            return Task.FromResult(new List<InspectionViolationReinspectionTaskDto>());
        }

        var normalizedSourceTaskNo = sourceTaskNo.Trim();
        return _dbContext.InspectionTasks
            .AsNoTracking()
            .Include(x => x.Inspectors)
            .Where(x => x.ReinspectionNo != null && x.ReinspectionNo == normalizedSourceTaskNo)
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .Select(x => new InspectionViolationReinspectionTaskDto
            {
                TaskId = x.Id,
                TaskNo = x.TaskNo,
                StatusCode = MapTaskStatusCode(x.StatusId),
                StatusName = MapTaskStatusName(x.StatusId),
                DueDate = x.DueDate,
                Inspector = x.Inspectors
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.Id)
                    .Select(i => i.InspectorName)
                    .FirstOrDefault(),
                IsMock = false
            })
            .ToListAsync();
    }

    /// <summary>
    /// Computes the total violation count and unpaid count for the same target (establishment or individual)
    /// as the given <paramref name="violation"/>.
    /// <list type="bullet">
    ///   <item>When the violation has a real linked task (<c>SourceTaskId</c> is set and non-zero),
    ///     the target scope is taken from <c>SourceTask.EstablishmentId</c> / <c>IndividualId</c>.</item>
    ///   <item>When the violation was created via the internal API (no linked task),
    ///     the scope is taken from <c>InspectionViolationSourceSnapshots</c>.</item>
    /// </list>
    /// </summary>
    private async Task<(int? EstablishmentId, int? IndividualId)> GetViolationTargetIdsAsync(InspectionViolation violation)
    {
        var hasTask = violation.SourceTaskId.HasValue && violation.SourceTaskId.Value != 0;
        if (hasTask)
        {
            // Get from the linked task
            return (violation.SourceTask?.EstablishmentId, violation.SourceTask?.IndividualId);
        }
        
        // Get from the source snapshot (internal-API violations)
        var snapshot = await _dbContext.InspectionViolationSourceSnapshots
            .AsNoTracking()
            .Where(x => x.ViolationId == violation.Id)
            .Select(x => new { x.EstablishmentId, x.IndividualId })
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);

        if (snapshot != null)
        {
            return (snapshot.EstablishmentId, snapshot.IndividualId);
        }

        return (null, null);
    }

    /// <summary>
    /// Computes the total violation count and unpaid count for the same target (establishment or individual)
    /// as the given <paramref name="violation"/>.
    /// <list type="bullet">
    ///   <item>When the violation has a real linked task (<c>SourceTaskId</c> is set and non-zero),
    ///     the target scope is taken from <c>SourceTask.EstablishmentId</c> / <c>IndividualId</c>.</item>
    ///   <item>When the violation was created via the internal API (no linked task),
    ///     the scope is taken from <c>InspectionViolationSourceSnapshots</c>.</item>
    /// </list>
    /// </summary>
    private async Task<(int ViolationCount, int UnpayCount)> BuildViolationCountsAsync(InspectionViolation violation)
    {
        int? establishmentId = null;
        int? individualId    = null;

        var hasTask = violation.SourceTaskId.HasValue && violation.SourceTaskId.Value != 0;
        if (hasTask)
        {
            // Scope from the linked task
            establishmentId = violation.SourceTask?.EstablishmentId;
            individualId    = violation.SourceTask?.IndividualId;
        }
        else
        {
            // Scope from the source snapshot (internal-API violations)
            var snapshot = await _dbContext.InspectionViolationSourceSnapshots
                .AsNoTracking()
                .Where(x => x.ViolationId == violation.Id)
                .Select(x => new { x.EstablishmentId, x.IndividualId })
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            if (snapshot != null)
            {
                establishmentId = snapshot.EstablishmentId;
                individualId    = snapshot.IndividualId;
            }
        }

        if (establishmentId == null && individualId == null)
            return (0, 0);

        // Build a base query that joins violations to their target scope
        IQueryable<InspectionViolation> baseQuery;
        if (hasTask)
        {
            // Task-backed violations: filter through SourceTask's EstablishmentId / IndividualId
            var tasksQuery = _dbContext.InspectionViolations
                .AsNoTracking()
                .Where(x => x.SourceTaskId != null && x.SourceTaskId != 0);

            if (establishmentId.HasValue)
                baseQuery = tasksQuery.Where(x => x.SourceTask!.EstablishmentId == establishmentId.Value);
            else
                baseQuery = tasksQuery.Where(x => x.SourceTask!.IndividualId == individualId!.Value);
        }
        else
        {
            // Internal-API violations: filter through InspectionViolationSourceSnapshots
            var snapshotQuery = _dbContext.InspectionViolationSourceSnapshots.AsNoTracking();
            if (establishmentId.HasValue)
                snapshotQuery = snapshotQuery.Where(x => x.EstablishmentId == establishmentId.Value);
            else
                snapshotQuery = snapshotQuery.Where(x => x.IndividualId == individualId!.Value);

            var violationIds = await snapshotQuery
                .Select(x => x.ViolationId)
                .ToListAsync()
                .ConfigureAwait(false);

            if (violationIds.Count == 0)
                return (0, 0);

            baseQuery = _dbContext.InspectionViolations
                .AsNoTracking()
                .Where(x => violationIds.Contains(x.Id));
        }

        baseQuery = ExcludeExpiredInternalViolations(baseQuery);

        var violationCount = await baseQuery.CountAsync().ConfigureAwait(false);
        var unpayCount     = await baseQuery
            .CountAsync(x => x.StatusId == (int)InspectionViolationStatus.PendingPayment)
            .ConfigureAwait(false);

        return (violationCount, unpayCount);
    }

    private static List<InspectionViolationChecklistViolationDto> BuildChecklistViolationDetails(
        InspectionViolation violation,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId,
        bool filterByCommitteeReview = true,
        bool preferArabic = false)
    {
        var committeeDecisionCategory = InspectionTaskAttachmentCategory.CommitteeDecision.GetValue();
        var checklistEvidenceCategory = InspectionTaskAttachmentCategory.ChecklistEvidence.GetValue();
        var checklistAttachments = violation.SourceTask?.Attachments
            .Where(x => (x.TaskId == violation.SourceTaskId || x.TaskId <= 0)
                        && (InspectionTaskAttachmentRelatedEntityType.ChecklistItem.Matches(x.RelatedEntityType)
                            || x.AttachmentCategory == committeeDecisionCategory
                            || x.AttachmentCategory == checklistEvidenceCategory))
            .ToList();

        // Split by category for module-specific groupings.
        var committeeDecisionAttachments = checklistAttachments?
            .Where(x => x.AttachmentCategory == committeeDecisionCategory).ToList();
        var checklistEvidenceAttachments = checklistAttachments?
            .Where(x => x.AttachmentCategory == checklistEvidenceCategory).ToList();

        // For standalone (taskId=0) internal violations, checklist violations are linked directly
        // via ViolationId. SourceTask is null so we iterate DirectChecklistViolations instead.
        var isInternalViolation = violation.SourceTaskId == null || violation.SourceTaskId == 0;
        if (isInternalViolation)
        {
            return violation.DirectChecklistViolations
                .Where(v => v.ViolationTypeId == violation.ViolationTypeId
                            && (!filterByCommitteeReview || v.CommitteeReview == true))
                .OrderBy(v => v.Id)
                .Select(v =>
                {
                    var item = v.TaskChecklistItem;
                    var catalogItem = violationItemsByStoredId.TryGetValue(v.ViolationItemId, out var resolvedItem)
                        ? resolvedItem
                        : null;

                    return new InspectionViolationChecklistViolationDto
                    {
                        Id = v.Id,
                        TaskChecklistItemId = item?.Id ?? v.TaskChecklistItemId,
ChecklistCode = item?.ChecklistCode ?? string.Empty,
ChecklistName = item?.ChecklistName,
ViolationDescription = catalogItem == null
? null
: (preferArabic ? catalogItem.NameAr : catalogItem.NameEn),
RecordedAt = item?.RecordedAt ?? v.CreatedOn,
ViolationItemId = catalogItem?.Id ?? v.ViolationItemId,
ViolationItemCode = catalogItem?.Code ?? v.ViolationItemCode,
ViolationItemName = catalogItem == null
? v.ViolationItemCode
: (preferArabic ? catalogItem.NameAr : catalogItem.NameEn),
ViolationTypeId = catalogItem?.ViolationTypeId ?? v.ViolationTypeId,
ViolationTypeCode = MapViolationTypeCode(catalogItem?.ViolationTypeId ?? v.ViolationTypeId),
ViolationTypeName = MapViolationTypeName(catalogItem?.ViolationTypeId ?? v.ViolationTypeId, preferArabic),
                        AppealResult = violation.StatusId == (int)InspectionViolationStatus.UnderAppeal ? null : v.AppealResult,
                        AppealResultCode = violation.StatusId == (int)InspectionViolationStatus.UnderAppeal ? null : MapAppealResultCode(v.AppealResult),
                        Degree = v.Degree,
                        OldDegree = v.OldDegree,
                        NewDegree = v.NewDegree,
                        FineAmount = v.FineAmount,
                        BeforeAppealAdjustedFineAmount = v.BeforeAppealAdjustedFineAmount,
                        Notes = v.Notes ?? item?.Notes,
                        CommitteeNote = v.CommitteeNote,
                        Reported = v.Reported,
                        CommitteeReview = v.CommitteeReview,
                        // Internal violations have no task-level attachments.
                        Attachments = new List<InspectionViolationAttachmentDto>(),
                        ReportAttachment = new List<InspectionViolationAttachmentDto>(),
                        CommitteeAttachment = new List<InspectionViolationAttachmentDto>(),
                        AppealNote = !string.IsNullOrWhiteSpace(v.CommitteeNote) ? v.CommitteeNote : (v.Notes ?? item?.Notes),
                        AppealAttachment = new List<InspectionViolationAttachmentDto>()
                    };
                })
                .ToList();
        }

        return violation.SourceTask?.ChecklistItems
            .OrderBy(x => x.DisplayOrder ?? int.MaxValue)
            .ThenBy(x => x.RecordedAt)
            .ThenBy(x => x.Id)
            .SelectMany(item => item.Violations
                .Where(v => (v.TaskId == violation.SourceTaskId || v.TaskId <= 0)
                            && v.ViolationTypeId == violation.ViolationTypeId
                            && (!filterByCommitteeReview || v.CommitteeReview == true))
                .OrderBy(v => v.Id)
                .Select(v =>
                {
                    var catalogItem = violationItemsByStoredId.TryGetValue(v.ViolationItemId, out var resolvedItem)
                        ? resolvedItem
                        : null;

                    return new InspectionViolationChecklistViolationDto
                    {
                        Id = v.Id,
                        TaskChecklistItemId = item.Id,
ChecklistCode = item.ChecklistCode,
ChecklistName = item.ChecklistName,
ViolationDescription = catalogItem == null
? null
: (preferArabic ? catalogItem.NameAr : catalogItem.NameEn),
RecordedAt = item.RecordedAt,
ViolationItemId = catalogItem?.Id ?? v.ViolationItemId,
ViolationItemCode = catalogItem?.Code ?? v.ViolationItemCode,
ViolationItemName = catalogItem == null
? v.ViolationItemCode
: (preferArabic ? catalogItem.NameAr : catalogItem.NameEn),
ViolationTypeId = catalogItem?.ViolationTypeId ?? v.ViolationTypeId,
ViolationTypeCode = MapViolationTypeCode(catalogItem?.ViolationTypeId ?? v.ViolationTypeId),
ViolationTypeName = MapViolationTypeName(catalogItem?.ViolationTypeId ?? v.ViolationTypeId, preferArabic),
                        AppealResult = violation.StatusId == (int)InspectionViolationStatus.UnderAppeal ? null : v.AppealResult,
                        AppealResultCode = violation.StatusId == (int)InspectionViolationStatus.UnderAppeal ? null : MapAppealResultCode(v.AppealResult),
                        Degree = v.Degree,
                        OldDegree = v.OldDegree,
                        NewDegree = v.NewDegree,
                        FineAmount = v.FineAmount,
                        BeforeAppealAdjustedFineAmount = v.BeforeAppealAdjustedFineAmount,
                        Notes = v.Notes ?? item.Notes,
                        CommitteeNote = v.CommitteeNote,
                        Reported = v.Reported,
                        CommitteeReview = v.CommitteeReview,
                        Attachments = BuildChecklistViolationAttachments(item, v, checklistAttachments),
                        ReportAttachment = BuildChecklistViolationAttachments(item, v, checklistEvidenceAttachments),
                        CommitteeAttachment = BuildChecklistViolationAttachments(item, v, committeeDecisionAttachments),
                        AppealNote = !string.IsNullOrWhiteSpace(v.CommitteeNote) ? v.CommitteeNote : (v.Notes ?? item.Notes),
                        AppealAttachment = BuildChecklistViolationAttachments(item, v, committeeDecisionAttachments) is { Count: > 0 } ca
                            ? ca
                            : BuildChecklistViolationAttachments(item, v, checklistEvidenceAttachments)
                    };
                }))
            .ToList() ?? new List<InspectionViolationChecklistViolationDto>();
    }

    private static List<InspectionViolationTaskChecklistViolationDto> BuildTaskChecklistViolationRows(
        InspectionViolation violation,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        var checklistItems = violation.SourceTask?.ChecklistItems;
        if (checklistItems == null)
        {
            return new List<InspectionViolationTaskChecklistViolationDto>();
        }

        return checklistItems
            .Where(x => x.TaskId == violation.SourceTaskId || x.TaskId <= 0)
            .OrderBy(x => x.DisplayOrder ?? int.MaxValue)
            .ThenBy(x => x.RecordedAt)
            .ThenBy(x => x.Id)
            .SelectMany(item => item.Violations
                .Where(v => (v.TaskId == violation.SourceTaskId || v.TaskId <= 0)
                            && v.ViolationTypeId == violation.ViolationTypeId
                            && v.CommitteeReview == true)
                .OrderBy(v => v.Id)
                .Select(v =>
                {
                    var catalogItem = violationItemsByStoredId.TryGetValue(v.ViolationItemId, out var resolvedItem)
                        ? resolvedItem
                        : null;

                    return new InspectionViolationTaskChecklistViolationDto
                    {
                        Id = v.Id,
                        TaskId = v.TaskId > 0 ? v.TaskId : violation.SourceTaskId,
                        TaskChecklistItemId = item.Id,
                        ChecklistCode = item.ChecklistCode,
                        ChecklistName = item.ChecklistName,
                        RecordedAt = item.RecordedAt,
                        ViolationItemId = catalogItem?.Id ?? v.ViolationItemId,
                        ViolationItemCode = catalogItem?.Code ?? v.ViolationItemCode,
                        ViolationItemName = catalogItem?.ChecklistName ?? catalogItem?.Code ?? v.ViolationItemCode,
                        ViolationTypeId = catalogItem?.ViolationTypeId ?? v.ViolationTypeId,
                        ViolationTypeCode = MapViolationTypeCode(catalogItem?.ViolationTypeId ?? v.ViolationTypeId),
                        ViolationTypeName = MapViolationTypeName(catalogItem?.ViolationTypeId ?? v.ViolationTypeId),
                        AppealResult = violation.StatusId == (int)InspectionViolationStatus.UnderAppeal ? null : v.AppealResult,
                        AppealResultCode = violation.StatusId == (int)InspectionViolationStatus.UnderAppeal ? null : MapAppealResultCode(v.AppealResult),
                        Degree = v.Degree,
                        OldDegree = v.OldDegree,
                        NewDegree = v.NewDegree,
                        FineAmount = v.FineAmount,
                        BeforeAppealAdjustedFineAmount = v.BeforeAppealAdjustedFineAmount,
                        Notes = v.Notes ?? item.Notes,
                        CommitteeNote = v.CommitteeNote,
                        Reported = v.Reported,
                        CommitteeReview = v.CommitteeReview
                    };
                }))
            .ToList();
    }

    private static string? MapAppealResultCode(InspectionTaskChecklistViolationAppealResult? appealResult)
        => appealResult?.ToString();

    private static List<InspectionViolationTaskChecklistAttachmentDto> BuildTaskChecklistAttachmentRows(InspectionViolation violation)
    {
        var taskAttachments = violation.SourceTask?.Attachments;
        if (taskAttachments == null)
        {
            return new List<InspectionViolationTaskChecklistAttachmentDto>();
        }

        return taskAttachments
            .Where(x => (x.TaskId == violation.SourceTaskId || x.TaskId <= 0)
                        && InspectionTaskAttachmentRelatedEntityType.ChecklistItem.Matches(x.RelatedEntityType))
            .OrderByDescending(x => x.UploadedAt)
            .ThenByDescending(x => x.Id)
            .Select(x => new InspectionViolationTaskChecklistAttachmentDto
            {
                Id = x.Id,
                TaskId = x.TaskId > 0 ? x.TaskId : violation.SourceTaskId,
                RelatedEntityType = x.RelatedEntityType,
                RelatedEntityId = x.RelatedEntityId,
                RelatedEntityCode = x.RelatedEntityCode,
                AttachmentCategory = x.AttachmentCategory,
                FileName = x.FileName,
                FileUrl = x.FileUrl,
                ContentType = x.ContentType,
                UploadedAt = x.UploadedAt
            })
            .ToList();
    }

    /// <summary>
    /// Adds <see cref="InspectionTaskAttachment"/> records (category = CommitteeDecision) for every
    /// decision item that carries attachments.  Attachments are stored under the task of the source
    /// violation and linked to the matching checklist item/violation via RelatedEntityCode so that
    /// <see cref="BuildChecklistViolationAttachments"/> can surface them in the detail response.
    /// </summary>
    private void AddCommitteeDecisionAttachments(
        InspectionViolation violation,
        IReadOnlyCollection<DecideInspectionViolationItemDto> decisionItems,
        DateTime now)
    {
        if (violation.SourceTaskId <= 0)
        {
            return;
        }

        var committeeDecisionCategory = InspectionTaskAttachmentCategory.CommitteeDecision.GetValue();
        var checklistItemRelatedEntityType = InspectionTaskAttachmentRelatedEntityType.ChecklistItem.GetValue();
        var allChecklistViolations = ResolveAllChecklistViolations(violation);

        foreach (var decisionItem in decisionItems)
        {
            if (decisionItem.Attachments == null || decisionItem.Attachments.Count == 0)
            {
                continue;
            }

            // Resolve the corresponding checklist violation to obtain a stable RelatedEntityId.
            var matchedCv = allChecklistViolations
                .FirstOrDefault(cv =>
                    cv.ViolationItemId == decisionItem.ViolationItemId ||
                    string.Equals(cv.ViolationItemCode, decisionItem.ViolationItemCode, StringComparison.OrdinalIgnoreCase));

            foreach (var attachment in decisionItem.Attachments)
            {
                if (string.IsNullOrWhiteSpace(attachment.FileName) || string.IsNullOrWhiteSpace(attachment.FileUrl))
                {
                    continue;
                }

                _dbContext.InspectionTaskAttachments.Add(new InspectionTaskAttachment
                {
                    TaskId = violation.SourceTaskId ?? 0,
                    RelatedEntityType = checklistItemRelatedEntityType,
                    // Use the FK stored on the matched violation (>0 for pre-existing items).
                    // Newly-created checklist items will have Id == 0 until SaveChangesAsync;
                    // matching will fall back to RelatedEntityCode in that case.
                    RelatedEntityId = matchedCv?.TaskChecklistItemId > 0 ? matchedCv.TaskChecklistItemId : null,
                    RelatedEntityCode = decisionItem.ViolationItemCode,
                    AttachmentCategory = committeeDecisionCategory,
                    FileName = attachment.FileName.Trim(),
                    FileUrl = attachment.FileUrl.Trim(),
                    ContentType = string.IsNullOrWhiteSpace(attachment.ContentType) ? null : attachment.ContentType.Trim(),
                    UploadedBy = _currentUserService.UserId,
                    UploadedAt = now,
                    LastUpdatedOn = now,
                    CreatedOn = now,
                    CreatedBy = _currentUserService.UserId,
                    UpdatedBy = _currentUserService.UserId
                });
            }
        }
    }

    private static List<InspectionViolationAttachmentDto> BuildChecklistViolationAttachments(
        InspectionTaskChecklistItem checklistItem,
        InspectionTaskChecklistViolation checklistViolation,
        IReadOnlyCollection<InspectionTaskAttachment>? attachments)
    {
        if (attachments == null || attachments.Count == 0)
        {
            return new List<InspectionViolationAttachmentDto>();
        }

        return attachments
            .Where(x => MatchesChecklistViolationAttachment(x, checklistItem.Id, checklistViolation.ViolationItemCode))
            .OrderByDescending(x => x.UploadedAt)
            .ThenByDescending(x => x.Id)
            .Select(MapViolationAttachment)
            .ToList();
    }

    private static bool MatchesChecklistViolationAttachment(
        InspectionTaskAttachment attachment,
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

    private static InspectionViolationAttachmentDto MapViolationAttachment(InspectionViolationAttachment attachment)
        => new()
        {
            Id = attachment.Id,
            RelatedEntityType = attachment.RelatedEntityType,
            RelatedEntityId = attachment.RelatedEntityId,
            RelatedEntityCode = null,
            AttachmentCategory = attachment.AttachmentCategory,
            FileName = attachment.FileName,
            FileUrl = attachment.FileUrl,
            ContentType = attachment.ContentType,
            UploadedAt = attachment.UploadedAt
        };

    private static InspectionViolationAttachmentDto MapViolationAttachment(InspectionTaskAttachment attachment)
        => new()
        {
            Id = attachment.Id,
            RelatedEntityType = attachment.RelatedEntityType,
            RelatedEntityId = attachment.RelatedEntityId,
            RelatedEntityCode = attachment.RelatedEntityCode,
            AttachmentCategory = attachment.AttachmentCategory,
            FileName = attachment.FileName,
            FileUrl = attachment.FileUrl,
            ContentType = attachment.ContentType,
            UploadedAt = attachment.UploadedAt
        };

    private static void SynchronizeChecklistViolationFineAmounts(
        IReadOnlyCollection<InspectionTaskChecklistViolation> checklistViolations,
        IEnumerable<DecideInspectionViolationItemDto> decisionItems,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId,
        DateTime updatedOn,
        string? updatedBy)
    {
        if (checklistViolations.Count == 0)
        {
            return;
        }

        var decisionItemsByItemId = decisionItems
            .GroupBy(x => x.ViolationItemId)
            .ToDictionary(group => group.Key, group => group.Last());
        var decisionItemsByCode = decisionItems
            .Select(x => new
            {
                Item = x,
                NormalizedCode = NormalizeViolationItemCode(x.ViolationItemCode)
            })
            .Where(x => x.NormalizedCode != null)
            .GroupBy(x => x.NormalizedCode!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Last().Item, StringComparer.OrdinalIgnoreCase);

        foreach (var checklistViolation in checklistViolations)
        {
            var matchedDecisionItem = ResolveMatchedDecisionItem(
                checklistViolation,
                decisionItemsByItemId,
                decisionItemsByCode,
                violationItemsByStoredId);

            checklistViolation.FineAmount = matchedDecisionItem?.FineAmount ?? 0m;
            checklistViolation.OldDegree = matchedDecisionItem?.Degree;
            checklistViolation.Degree = matchedDecisionItem?.Degree ?? 0;
            checklistViolation.CommitteeReview = matchedDecisionItem != null;
            checklistViolation.CommitteeNote = matchedDecisionItem?.CommitteeNote;
            checklistViolation.LastUpdatedOn = updatedOn;
            checklistViolation.UpdatedBy = updatedBy;
        }
    }

    private void SynchronizeContentChecklistViolationsForDecision(
        InspectionViolation violation,
        IReadOnlyCollection<DecideInspectionViolationItemDto> decisionItems,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId,
        DateTime updatedOn,
        string? updatedBy)
    {
        if (violation.SourceTask == null)
        {
            return;
        }

        var existingChecklistViolations = ResolveAllChecklistViolations(violation);
        var matchedChecklistViolations = new HashSet<InspectionTaskChecklistViolation>();

        foreach (var decisionItem in decisionItems)
        {
            var checklistViolation = existingChecklistViolations
                .FirstOrDefault(x => !matchedChecklistViolations.Contains(x)
                                     && DecisionItemMatchesChecklistViolation(x, decisionItem, violationItemsByStoredId));

            if (checklistViolation == null)
            {
                checklistViolation = CreateContentChecklistViolationForDecision(violation, decisionItem, violationItemsByStoredId, updatedOn, updatedBy);
                existingChecklistViolations.Add(checklistViolation);
            }

            matchedChecklistViolations.Add(checklistViolation);
            checklistViolation.CommitteeReview = true;
            ApplyDecisionItemToChecklistViolation(checklistViolation, decisionItem, violationItemsByStoredId, updatedOn, updatedBy);
        }

        // Soft-delete: mark cancelled items CommitteeReview=false instead of physical removal.
        foreach (var checklistViolation in existingChecklistViolations.Where(x => !matchedChecklistViolations.Contains(x)).ToList())
        {
            checklistViolation.CommitteeReview = false;
            checklistViolation.LastUpdatedOn = updatedOn;
            checklistViolation.UpdatedBy = updatedBy;
        }
    }

    private InspectionTaskChecklistViolation CreateContentChecklistViolationForDecision(
        InspectionViolation violation,
        DecideInspectionViolationItemDto decisionItem,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId,
        DateTime createdOn,
        string? createdBy)
    {
        var sourceTask = violation.SourceTask
            ?? throw new BusinessException("Inspection.Task.NotFound", "");
        var resolvedCatalogItem = ResolveDecisionCatalogItem(decisionItem, violationItemsByStoredId);
        var checklistCode = NormalizeViolationItemCode(resolvedCatalogItem?.ChecklistCode)
                            ?? NormalizeViolationItemCode(decisionItem.ViolationItemCode)
                            ?? decisionItem.ViolationItemId.ToString(CultureInfo.InvariantCulture);
        var checklistName = ResolvePreferredChecklistName(resolvedCatalogItem, decisionItem);

        var checklistItem = sourceTask.ChecklistItems
            .FirstOrDefault(x => string.Equals(
                NormalizeViolationItemCode(x.ChecklistCode),
                checklistCode,
                StringComparison.OrdinalIgnoreCase));

        if (checklistItem == null)
        {
            checklistItem = new InspectionTaskChecklistItem
            {
                TaskId = sourceTask.Id,
                ChecklistCode = checklistCode,
                ChecklistName = checklistName,
                ResultId = (int)InspectionChecklistResult.Violation,
                Notes = null,
                DisplayOrder = resolvedCatalogItem?.DisplayOrder,
                RecordedAt = createdOn,
                CreatedOn = createdOn,
                LastUpdatedOn = createdOn,
                CreatedBy = createdBy,
                UpdatedBy = createdBy
            };

            sourceTask.ChecklistItems.Add(checklistItem);
        }

        var checklistViolation = new InspectionTaskChecklistViolation
        {
            TaskId = sourceTask.Id,
            TaskChecklistItem = checklistItem,
            ViolationTypeId = (int)InspectionViolationType.Content,
            CommitteeReview = true,
            CreatedOn = createdOn,
            LastUpdatedOn = createdOn,
            CreatedBy = createdBy,
            UpdatedBy = createdBy
        };

        checklistItem.Violations.Add(checklistViolation);
        return checklistViolation;
    }

    private static void ApplyDecisionItemToChecklistViolation(
        InspectionTaskChecklistViolation checklistViolation,
        DecideInspectionViolationItemDto decisionItem,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId,
        DateTime updatedOn,
        string? updatedBy)
    {
        var resolvedCatalogItem = ResolveDecisionCatalogItem(decisionItem, violationItemsByStoredId);

        checklistViolation.ViolationItemId = resolvedCatalogItem?.Id ?? decisionItem.ViolationItemId;
        checklistViolation.ViolationItemCode = resolvedCatalogItem?.Code ?? decisionItem.ViolationItemCode;
        checklistViolation.ViolationTypeId = resolvedCatalogItem?.ViolationTypeId ?? (int)InspectionViolationType.Content;
        checklistViolation.FineAmount = decisionItem.FineAmount;
        checklistViolation.OldDegree = decisionItem.Degree;
        checklistViolation.Degree = decisionItem.Degree ?? 0;
        checklistViolation.CommitteeNote = decisionItem.CommitteeNote;
        checklistViolation.LastUpdatedOn = updatedOn;
        checklistViolation.UpdatedBy = updatedBy;

        if (checklistViolation.TaskChecklistItem != null)
        {
            checklistViolation.TaskChecklistItem.ChecklistCode = NormalizeViolationItemCode(resolvedCatalogItem?.ChecklistCode)
                ?? NormalizeViolationItemCode(checklistViolation.TaskChecklistItem.ChecklistCode)
                ?? NormalizeViolationItemCode(decisionItem.ViolationItemCode)
                ?? checklistViolation.TaskChecklistItem.ChecklistCode;
            checklistViolation.TaskChecklistItem.ChecklistName = ResolvePreferredChecklistName(resolvedCatalogItem, decisionItem);
            checklistViolation.TaskChecklistItem.Notes = null;
            checklistViolation.TaskChecklistItem.DisplayOrder = resolvedCatalogItem?.DisplayOrder ?? checklistViolation.TaskChecklistItem.DisplayOrder;
            checklistViolation.TaskChecklistItem.LastUpdatedOn = updatedOn;
            checklistViolation.TaskChecklistItem.UpdatedBy = updatedBy;
        }
    }

    private static List<InspectionTaskChecklistViolation> ResolveChecklistViolationsForDecision(
        InspectionViolation violation,
        IReadOnlyCollection<DecideInspectionViolationItemDto> decisionItems,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        var checklistViolations = ResolveAllChecklistViolations(violation)
            .Where(x => x.ViolationTypeId == violation.ViolationTypeId)
            .ToList();

        if (checklistViolations.Count == 0 || decisionItems.Count == 0)
        {
            return checklistViolations;
        }

        var decisionItemsByItemId = decisionItems
            .GroupBy(x => x.ViolationItemId)
            .ToDictionary(group => group.Key, group => group.Last());
        var decisionItemsByCode = decisionItems
            .Select(x => new
            {
                Item = x,
                NormalizedCode = NormalizeViolationItemCode(x.ViolationItemCode)
            })
            .Where(x => x.NormalizedCode != null)
            .GroupBy(x => x.NormalizedCode!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Last().Item, StringComparer.OrdinalIgnoreCase);

        return checklistViolations
            .Where(x => ResolveMatchedDecisionItem(
                            x,
                            decisionItemsByItemId,
                            decisionItemsByCode,
                            violationItemsByStoredId) != null)
            .ToList();
    }

    private static DecideInspectionViolationItemDto? ResolveMatchedDecisionItem(
        InspectionTaskChecklistViolation checklistViolation,
        IReadOnlyDictionary<int, DecideInspectionViolationItemDto> decisionItemsByItemId,
        IReadOnlyDictionary<string, DecideInspectionViolationItemDto> decisionItemsByCode,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        if (decisionItemsByItemId.TryGetValue(checklistViolation.ViolationItemId, out var decisionItemByStoredId))
        {
            return decisionItemByStoredId;
        }

        var normalizedStoredCode = NormalizeViolationItemCode(checklistViolation.ViolationItemCode);
        if (normalizedStoredCode != null && decisionItemsByCode.TryGetValue(normalizedStoredCode, out var decisionItemByStoredCode))
        {
            return decisionItemByStoredCode;
        }

        if (!violationItemsByStoredId.TryGetValue(checklistViolation.ViolationItemId, out var resolvedCatalogItem))
        {
            return null;
        }

        if (decisionItemsByItemId.TryGetValue(resolvedCatalogItem.Id, out var decisionItemByCanonicalId))
        {
            return decisionItemByCanonicalId;
        }

        if (resolvedCatalogItem.LegacyViolationItemId.HasValue
            && decisionItemsByItemId.TryGetValue(resolvedCatalogItem.LegacyViolationItemId.Value, out var decisionItemByLegacyId))
        {
            return decisionItemByLegacyId;
        }

        var normalizedCatalogCode = NormalizeViolationItemCode(resolvedCatalogItem.Code);
        return normalizedCatalogCode != null && decisionItemsByCode.TryGetValue(normalizedCatalogCode, out var decisionItemByCanonicalCode)
            ? decisionItemByCanonicalCode
            : null;
    }

    private static string? NormalizeViolationItemCode(string? violationItemCode)
        => string.IsNullOrWhiteSpace(violationItemCode)
            ? null
            : violationItemCode.Trim();

    private static bool DecisionItemMatchesChecklistViolation(
        InspectionTaskChecklistViolation checklistViolation,
        DecideInspectionViolationItemDto decisionItem,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
    {
        if (checklistViolation.ViolationItemId == decisionItem.ViolationItemId)
        {
            return true;
        }

        var normalizedDecisionCode = NormalizeViolationItemCode(decisionItem.ViolationItemCode);
        if (normalizedDecisionCode == null)
        {
            return false;
        }

        var normalizedChecklistViolationCode = NormalizeViolationItemCode(checklistViolation.ViolationItemCode);
        if (string.Equals(normalizedChecklistViolationCode, normalizedDecisionCode, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!violationItemsByStoredId.TryGetValue(checklistViolation.ViolationItemId, out var resolvedCatalogItem))
        {
            return false;
        }

        return string.Equals(
            NormalizeViolationItemCode(resolvedCatalogItem.Code),
            normalizedDecisionCode,
            StringComparison.OrdinalIgnoreCase);
    }

    private static InspectionPenaltyRule? ResolveDecisionCatalogItem(
        DecideInspectionViolationItemDto decisionItem,
        IReadOnlyDictionary<int, InspectionPenaltyRule> violationItemsByStoredId)
        => violationItemsByStoredId.TryGetValue(decisionItem.ViolationItemId, out var resolvedCatalogItem)
            ? resolvedCatalogItem
            : null;

    private static string ResolvePreferredChecklistName(InspectionPenaltyRule? resolvedCatalogItem, DecideInspectionViolationItemDto decisionItem)
        => resolvedCatalogItem?.ChecklistName
           ?? resolvedCatalogItem?.ViolationDescription
           ?? NormalizeViolationItemCode(decisionItem.ViolationItemName)
           ?? NormalizeViolationItemCode(decisionItem.ViolationItemCode)
           ?? decisionItem.ViolationItemId.ToString(CultureInfo.InvariantCulture);

    private static List<InspectionTaskChecklistViolation> ResolveAllChecklistViolations(InspectionViolation violation)
        => violation.SourceTask?.ChecklistItems
            .SelectMany(x => x.Violations)
            .Where(x => (x.TaskId == violation.SourceTaskId || x.TaskId <= 0)
                        && x.ViolationTypeId == violation.ViolationTypeId)
            .ToList() ?? new List<InspectionTaskChecklistViolation>();

    private static List<InspectionViolationTimelineItemDto> BuildProjectedTimeline(
        InspectionViolation violation,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames,
        bool isArabic = false)
    {
        var orderedTimelineEvents = violation.TimelineEvents
            .Where(x => !ShouldSuppressTimelineEvent(x))
            .OrderBy(x => x.CreatedOn)
            .ThenBy(x => x.Id)
            .ToList();

        var projectedHandlersByEventId = BuildProjectedTimelineHandlers(orderedTimelineEvents);

        var items = orderedTimelineEvents
            .OrderByDescending(x => x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .Select(x => MapTimeline(
                violation,
                x,
                projectedHandlersByEventId.TryGetValue(x.Id, out var projectedHandler) ? projectedHandler : null,
                appealReasonDisplayNames,
                isArabic))
            .ToList();

        if (items.Count > 0)
        {
            items[0].IsCurrentStatusEvent = true;
        }

        return items;
    }

    /// <summary>
    /// Timeline rows that exist for bookkeeping rather than for the reader.
    ///
    /// The notification rows are still written and still kept - the unique index behind
    /// ViolationCustomerNotificationQueued is what makes the customer notification idempotent, the staff
    /// notification service routes AP-092 off it, and appeal reconciliation reads it back - but "we sent
    /// an email" is not a step in the violation's life. Interleaving them also handed the newest row, and
    /// with it IsCurrentStatusEvent, to a notification: 44 violations awaiting payment were showing
    /// "Report Emailed to Customer" as their current status. Filtered on the way out, never on the way in.
    /// </summary>
    private static readonly HashSet<string> SuppressedTimelineEventCodes = new(StringComparer.Ordinal)
    {
        InspectionViolationTimelineEventCodes.ViolationNoticeSent,
        InspectionViolationTimelineEventCodes.DeclarationAcknowledgementSigned,
        InspectionViolationTimelineEventCodes.DeclarationAcknowledgementRefused,
        InspectionViolationTimelineEventCodes.ReportEmailedToCustomer,
        InspectionViolationTimelineEventCodes.WarningEmailedToCustomer,
        InspectionViolationTimelineEventCodes.ViolationCustomerNotificationQueued
    };

    private static bool ShouldSuppressTimelineEvent(InspectionViolationTimelineEvent timelineEvent)
        => timelineEvent.EventCode != null && SuppressedTimelineEventCodes.Contains(timelineEvent.EventCode);

    private static List<InspectionAttachmentDto> ResolveTimelineAttachments(InspectionViolation violation, InspectionViolationTimelineEvent timelineEvent)
    {
        return timelineEvent.EventCode switch
        {
            InspectionViolationTimelineEventCodes.PendingReview when !string.IsNullOrWhiteSpace(violation.ContentReviewReportUrl)
                => new List<InspectionAttachmentDto>
                {
                    new()
                    {
                        RelatedEntityType = "ContentReviewReport",
                        AttachmentCategory = "ContentReviewReport",
                        FileName = BuildFileNameFromUrl(violation.ContentReviewReportUrl!, $"content-review-{violation.ViolationNo}.pdf"),
                        FileUrl = violation.ContentReviewReportUrl!,
                        UploadedAt = timelineEvent.CreatedOn
                    }
                },
            InspectionViolationTimelineEventCodes.FinePaid when violation.FineAmount > 0
                => new List<InspectionAttachmentDto>
                {
                    new()
                    {
                        RelatedEntityType = "PaymentReceipt",
                        AttachmentCategory = "PaymentReceipt",
                        FileName = $"violation-receipt-{violation.ViolationNo}.pdf",
                        FileUrl = $"/api/admin/inspection/mock-files/receipts/violation-receipt-{violation.ViolationNo}.pdf",
                        UploadedAt = timelineEvent.CreatedOn
                    }
                },
            _ => new List<InspectionAttachmentDto>()
        };
    }

    private static Dictionary<int, ProjectedViolationTimelineHandler> BuildProjectedTimelineHandlers(IReadOnlyList<InspectionViolationTimelineEvent> orderedTimelineEvents)
    {
        var handlers = new Dictionary<int, ProjectedViolationTimelineHandler>();

        for (var index = 0; index < orderedTimelineEvents.Count; index++)
        {
            var timelineEvent = orderedTimelineEvents[index];
            var completedStateHandler = ResolveCompletedStateHandler(orderedTimelineEvents, index);
            if (completedStateHandler != null)
            {
                handlers[timelineEvent.Id] = completedStateHandler;
                continue;
            }

            var displayActor = ResolveTimelinePlaceholderActor(timelineEvent);
            handlers[timelineEvent.Id] = new ProjectedViolationTimelineHandler(
                UserId: string.IsNullOrWhiteSpace(displayActor) ? null : timelineEvent.TargetHandlerUserId,
                UserName: displayActor,
                Source: string.IsNullOrWhiteSpace(displayActor) ? "None" : "TargetHandler",
                IsPendingPlaceholder: false);
        }

        return handlers;
    }

    private static ProjectedViolationTimelineHandler? ResolveCompletedStateHandler(IReadOnlyList<InspectionViolationTimelineEvent> orderedTimelineEvents, int index)
    {
        var timelineEvent = orderedTimelineEvents[index];
        if (!timelineEvent.ToStatusId.HasValue || !CanBackfillTimelineHandler(timelineEvent.ToStatusId.Value))
        {
            return null;
        }

        for (var nextIndex = index + 1; nextIndex < orderedTimelineEvents.Count; nextIndex++)
        {
            var nextEvent = orderedTimelineEvents[nextIndex];
            if (nextEvent.Id <= timelineEvent.Id || nextEvent.FromStatusId != timelineEvent.ToStatusId)
            {
                continue;
            }

            var actualActorName = ResolveTimelineActualActor(nextEvent);
            if (string.IsNullOrWhiteSpace(actualActorName))
            {
                continue;
            }

            return new ProjectedViolationTimelineHandler(
                UserId: FirstNonEmpty(NormalizeDisplayName(nextEvent.ActorUserId), NormalizeDisplayName(nextEvent.TargetHandlerUserId)),
                UserName: actualActorName,
                Source: "ActualActor",
                IsPendingPlaceholder: false);
        }

        return null;
    }

    private static bool CanBackfillTimelineHandler(int statusId)
        => statusId == (int)InspectionViolationStatus.PendingRouting
           || statusId == (int)InspectionViolationStatus.PendingContentReport
           || statusId == (int)InspectionViolationStatus.PendingReview
           || statusId == (int)InspectionViolationStatus.PendingCommitteeDecision
           || statusId == (int)InspectionViolationStatus.PendingApproval;

    private static InspectionViolationTimelineItemDto MapTimeline(
        InspectionViolation violation,
        InspectionViolationTimelineEvent item,
        ProjectedViolationTimelineHandler? projectedHandler,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames,
        bool isArabic = false)
    {
        var effectiveHandler = projectedHandler ?? new ProjectedViolationTimelineHandler(
            item.TargetHandlerUserId,
            ResolveTimelinePlaceholderActor(item),
            string.IsNullOrWhiteSpace(ResolveTimelinePlaceholderActor(item)) ? "None" : "TargetHandler",
            false);
        var eventCode = string.IsNullOrWhiteSpace(item.EventCode) ? item.EventType : item.EventCode;
        var eventName = ResolveTimelineEventName(item, eventCode, isArabic);

        return new InspectionViolationTimelineItemDto
        {
            Id = item.Id,
            EventType = eventCode,
            RawEventType = item.EventType,
            Label = eventName,
            Result = eventCode,
            DepartmentId = null,
            FromStatusId = item.FromStatusId,
            ToStatusId = item.ToStatusId,
            HandlerUserId = effectiveHandler.UserId,
            HandlerUserName = effectiveHandler.UserName,
            ActualActorTypeCode = NormalizeTimelineActorTypeCode(item.ActorTypeCode),
            ActualActorUserId = item.ActorUserId,
            ActualActorUserName = NormalizeDisplayName(item.ActorUserName),
            OperatorRoleId = item.ActorRoleId,
            OperatorName = NormalizeDisplayName(item.ActorUserName),
            ActualActorRoleId = item.ActorRoleId,
            PendingHandlerUserId = effectiveHandler.UserId,
            PendingHandlerUserName = effectiveHandler.UserName,
            DisplayActorSource = effectiveHandler.Source,
            IsPendingPlaceholder = effectiveHandler.IsPendingPlaceholder,
            CreatedOn = item.CreatedOn,
            Metadata = null,
            DisplayTitle = eventName,
            DisplayActor = effectiveHandler.UserName,
            DisplayTime = item.CreatedOn,
            DisplayDetails = ResolveTimelineDisplayDetails(violation, item, eventCode, eventName, appealReasonDisplayNames, isArabic),
            DisplayStatusCode = ResolveProjectedDisplayStatusCode(eventCode, item.ToStatusId),
            DisplayStatusName = ResolveProjectedDisplayStatusName(eventCode, item.ToStatusId),
            InternalStatusCode = item.ToStatusId.HasValue ? MapViolationStatusCode(item.ToStatusId.Value) : null,
            InternalStatusName = item.ToStatusId.HasValue ? MapViolationStatusName(item.ToStatusId.Value) : null,
            Attachments = ResolveTimelineAttachments(violation, item)
        };
    }

    private static string ResolveTimelineEventName(InspectionViolationTimelineEvent item, string eventCode, bool isArabic = false)
    {
        string eventName;
        if (string.Equals(item.EventName, "Appeal Decision Made", StringComparison.OrdinalIgnoreCase))
        {
            eventName = InspectionViolationTimelineEventCodes.GetName(InspectionViolationTimelineEventCodes.UnderAppeal);
        }
        else
        {
            eventName = string.IsNullOrWhiteSpace(item.EventName)
                ? InspectionViolationTimelineEventCodes.GetName(eventCode)
                : item.EventName;
        }
 
        return isArabic ? MapTimelineEventNameToArabic(eventCode, eventName) : eventName;
    }
 
    private static string MapTimelineEventNameToArabic(string eventCode, string fallbackName)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.ViolationCreated => "تم إنشاء المخالفة",
            InspectionViolationTimelineEventCodes.WarningIssued => "تم إصدار إنذار",
            InspectionViolationTimelineEventCodes.PendingRouting => "بانتظار التوجيه",
            InspectionViolationTimelineEventCodes.PendingContentReport => "بانتظار تقرير المحتوى",
            InspectionViolationTimelineEventCodes.PendingReview => "بانتظار المراجعة",
            InspectionViolationTimelineEventCodes.PendingCommitteeDecision => "بانتظار قرار اللجنة",
            InspectionViolationTimelineEventCodes.PendingApproval => "بانتظار الموافقة",
            InspectionViolationTimelineEventCodes.PendingPayment => "بانتظار الدفع",
            InspectionViolationTimelineEventCodes.UnderAppeal => "قيد التظلم",
            InspectionViolationTimelineEventCodes.FinePaid => "تم دفع الغرامة",
            InspectionViolationTimelineEventCodes.ViolationCancelled => "تم إلغاء المخالفة",
            _ => fallbackName
        };
    private static string ResolveTimelineDisplayDetails(
        InspectionViolation violation,
        InspectionViolationTimelineEvent item,
        string eventCode,
        string eventName,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames,
        bool isArabic = false)
    {
        if (eventCode == InspectionViolationTimelineEventCodes.FinePaid)
        {
            return string.Empty;
        }
        if (IsUnderAppealTimeline(eventCode, eventName))
        {
            var appealReason = ResolveLatestAppealReasonDisplayName(violation, appealReasonDisplayNames);
            if (!string.IsNullOrWhiteSpace(appealReason))
            {
                return isArabic
                    ? $"سبب التظلم: {appealReason}"
                    : $"Appeal Reason: {appealReason}";
            }
        }
        return isArabic
            ? BuildTimelineArabicDisplayDetails(violation, eventCode, appealReasonDisplayNames)
            : string.IsNullOrWhiteSpace(item.Content)
                ? BuildTimelineFallbackContent(violation, eventCode, appealReasonDisplayNames)
                : item.Content;
    }
    private static bool IsUnderAppealTimeline(string eventCode, string eventName)
        => string.Equals(eventCode, InspectionViolationTimelineEventCodes.UnderAppeal, StringComparison.OrdinalIgnoreCase)
           || string.Equals(eventName, InspectionViolationTimelineEventCodes.GetName(InspectionViolationTimelineEventCodes.UnderAppeal), StringComparison.OrdinalIgnoreCase)
           || string.Equals(eventName, "Appeal Decision Made", StringComparison.OrdinalIgnoreCase);
    private static string ResolveLatestAppealReasonDisplayName(
        InspectionViolation violation,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames)
        => violation.Appeals.Count == 0
            ? string.Empty
            : MapAppealReasonDisplayName(
                violation.Appeals
                    .OrderByDescending(x => x.CreatedOn)
                    .Select(x => x.AppealReason)
                    .FirstOrDefault(),
                appealReasonDisplayNames);

    private static string? ResolveTimelinePlaceholderActor(InspectionViolationTimelineEvent item)
    {
        if (!string.IsNullOrWhiteSpace(item.TargetHandlerUserName))
        {
            return item.TargetHandlerUserName.Trim();
        }

        return item.EventCode switch
        {
            InspectionViolationTimelineEventCodes.WarningIssued => "Automated",
            InspectionViolationTimelineEventCodes.PendingPayment => "Customer",
            _ => null
        };
    }

    private static string? ResolveTimelineActualActor(InspectionViolationTimelineEvent item)
        => FirstNonEmpty(
            NormalizeDisplayName(item.ActorUserName),
            NormalizeDisplayName(item.ActorUserId),
            NormalizeDisplayName(item.TargetHandlerUserName),
            NormalizeDisplayName(item.TargetHandlerUserId));

    private static string BuildTimelineFallbackContent(
        InspectionViolation violation,
        string eventCode,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.ViolationCreated => violation.SourceTask != null
                ? violation.SourceTask.TaskNo
                : violation.SourceTaskId?.ToString() ?? string.Empty,
            InspectionViolationTimelineEventCodes.WarningIssued => "Warning has been issued to the customer based on violation rule and occurrence count.",
            InspectionViolationTimelineEventCodes.PendingRouting => "Content violation is waiting for routing by Inspection Department.",
            InspectionViolationTimelineEventCodes.PendingContentReport => "Violation has been transferred to Content Department for content assessment report.",
            InspectionViolationTimelineEventCodes.PendingReview => "Content assessment report has been submitted and is waiting for the Inspection Department's review.",
            InspectionViolationTimelineEventCodes.PendingCommitteeDecision => "Violation has been transferred to Committee for review and decision.",
            InspectionViolationTimelineEventCodes.PendingApproval => "Committee decision has been made and is waiting for the Inspection Department's approval.",
            InspectionViolationTimelineEventCodes.PendingPayment => "Fine has been generated.",
            InspectionViolationTimelineEventCodes.UnderAppeal => violation.Appeals.Count == 0
                ? "Customer has submitted an appeal for this violation."
                : $"Appeal Reason: {ResolveLatestAppealReasonDisplayName(violation, appealReasonDisplayNames)}",
            InspectionViolationTimelineEventCodes.FinePaid => "Fine payment has been completed.",
            InspectionViolationTimelineEventCodes.ViolationCancelled => "Violation has been cancelled after review.",
            _ => InspectionViolationTimelineEventCodes.GetName(eventCode)
        };

    private static string BuildTimelineArabicDisplayDetails(
        InspectionViolation violation,
        string eventCode,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.ViolationCreated => violation.SourceTask != null
                ? violation.SourceTask.TaskNo
                : violation.SourceTaskId?.ToString() ?? string.Empty,
            InspectionViolationTimelineEventCodes.WarningIssued => "تم إصدار إنذار للمتعامل بناءً على قاعدة المخالفة وعدد مرات التكرار.",
            InspectionViolationTimelineEventCodes.PendingRouting => "مخالفة المحتوى بانتظار التوجيه من إدارة التفتيش.",
            InspectionViolationTimelineEventCodes.PendingContentReport => "تم تحويل المخالفة إلى إدارة المحتوى لإعداد تقرير تقييم المحتوى.",
            InspectionViolationTimelineEventCodes.PendingReview => "تم تقديم تقرير تقييم المحتوى وهو بانتظار مراجعة إدارة التفتيش.",
            InspectionViolationTimelineEventCodes.PendingCommitteeDecision => "تم تحويل المخالفة إلى اللجنة للمراجعة واتخاذ القرار.",
            InspectionViolationTimelineEventCodes.PendingApproval => "تم اتخاذ قرار اللجنة وهو بانتظار موافقة إدارة التفتيش.",
            InspectionViolationTimelineEventCodes.PendingPayment => "تم إنشاء الغرامة.",
            InspectionViolationTimelineEventCodes.UnderAppeal => violation.Appeals.Count == 0
                ? "قدّم المتعامل تظلماً على هذه المخالفة."
                : $"سبب التظلم: {ResolveLatestAppealReasonDisplayName(violation, appealReasonDisplayNames)}",
            InspectionViolationTimelineEventCodes.FinePaid => "تم إكمال دفع الغرامة.",
            InspectionViolationTimelineEventCodes.ViolationCancelled => "تم إلغاء المخالفة بعد المراجعة.",
            _ => MapTimelineEventNameToArabic(eventCode, InspectionViolationTimelineEventCodes.GetName(eventCode))
        };

    private async Task<IReadOnlyDictionary<string, string>> LoadAppealReasonDisplayNamesAsync(bool preferArabic = false)
    {
        var items = await _dbContext.TypeDictionaries
            .AsNoTracking()
            .Where(x => x.Scope == AppealReasonEnumScope
                && x.IsShown
                && (!string.IsNullOrWhiteSpace(x.Code) || !string.IsNullOrWhiteSpace(x.NameEn) || !string.IsNullOrWhiteSpace(x.NameAr)))
            .OrderBy(x => x.Sort)
            .ToListAsync()
            .ConfigureAwait(false);

        return items
            .SelectMany(x =>
            {
                var displayName = preferArabic
                    ? CoalesceDisplayName(x.NameAr, x.NameEn)
                    : CoalesceDisplayName(x.NameEn, x.NameAr);
                if (string.IsNullOrWhiteSpace(displayName))
                {
                    return Array.Empty<KeyValuePair<string, string>>();
                }

                return new[] { x.Code, x.NameEn, x.NameAr }
                    .Where(key => !string.IsNullOrWhiteSpace(key))
                    .Select(key => new KeyValuePair<string, string>(key!.Trim(), displayName));
            })
            .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                x => x.Key,
                x => x.Select(item => item.Value).First(),
                StringComparer.OrdinalIgnoreCase);
    }

    private static string MapAppealReasonDisplayName(string? appealReason, IReadOnlyDictionary<string, string> appealReasonDisplayNames)
    {
        if (string.IsNullOrWhiteSpace(appealReason))
        {
            return string.Empty;
        }

        var normalizedAppealReason = appealReason.Trim();
        return appealReasonDisplayNames.TryGetValue(normalizedAppealReason, out var displayName)
            ? displayName
            : normalizedAppealReason;
    }

    private static string? ResolveProjectedDisplayStatusCode(string eventCode, int? toStatusId)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.ViolationCreated => "Created",
            InspectionViolationTimelineEventCodes.PendingApproval => InspectionViolationTimelineEventCodes.PendingApproval,
            InspectionViolationTimelineEventCodes.FinePaid => nameof(InspectionViolationStatus.Paid),
            InspectionViolationTimelineEventCodes.ViolationCancelled => nameof(InspectionViolationStatus.Cancelled),
            _ => toStatusId.HasValue ? MapViolationStatusCode(toStatusId.Value) : eventCode
        };

    private static string? ResolveProjectedDisplayStatusName(string eventCode, int? toStatusId)
        => eventCode switch
        {
            InspectionViolationTimelineEventCodes.ViolationCreated => "Violation Created",
            InspectionViolationTimelineEventCodes.PendingApproval => "Pending Approval",
            InspectionViolationTimelineEventCodes.FinePaid => "Paid",
            InspectionViolationTimelineEventCodes.ViolationCancelled => "Cancelled",
            _ => toStatusId.HasValue ? MapViolationStatusName(toStatusId.Value) : InspectionViolationTimelineEventCodes.GetName(eventCode)
        };

    private static string BuildFileNameFromUrl(string url, string fallback)
    {
        if (Uri.TryCreate(url, UriKind.RelativeOrAbsolute, out var uri))
        {
            var value = uri.IsAbsoluteUri ? uri.AbsolutePath : uri.OriginalString;
            var fileName = value.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
            if (!string.IsNullOrWhiteSpace(fileName))
            {
                return fileName;
            }
        }

        return fallback;
    }

    private static string? NormalizeDisplayName(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeTimelineActorTypeCode(string? actorTypeCode)
        => actorTypeCode?.Trim() switch
        {
            "Customer" => "Customer",
            "System" => "System",
            _ => "User"
        };

    private async Task<List<string>> ResolveAvailableActionsAsync(int statusId)
    {
        var canRoute    = await CanRouteViolationAsync();
        var canContent  = await CanSubmitContentReportAsync();
        var canDecide   = await CanDecideViolationAsync();
        var canApprove  = await CanApproveViolationAsync();

        return ResolveAvailableActions(statusId, canRoute, canContent, canDecide, canApprove);
    }

    private static List<string> ResolveAvailableActions(int statusId, bool canRoute, bool canContent, bool canDecide, bool canApprove, string? violationReportUrl = null)
    {
        var actions = statusId switch
        {
            (int)InspectionViolationStatus.PendingRouting =>
                new List<string>(
                    (canRoute ? new[] { "TransferToContent", "TransferToCommittee" } : Array.Empty<string>())),
            (int)InspectionViolationStatus.PendingContentReport =>
                new List<string>(
                    canContent ? new[] { "SubmitContentReport" } : Array.Empty<string>()),
            (int)InspectionViolationStatus.PendingReview =>
                new List<string>(
                    canRoute ? new[] { "TransferToCommittee" } : Array.Empty<string>()),
            (int)InspectionViolationStatus.PendingCommitteeDecision =>
                new List<string>(
                    canDecide ? new[] { "ReviewAndDecide" } : Array.Empty<string>()),
            (int)InspectionViolationStatus.PendingApproval =>
                new List<string>(
                    canApprove ? new[] { "Approval" } : Array.Empty<string>()),
            _ => new List<string>()
        };

        if (!string.IsNullOrWhiteSpace(violationReportUrl))
        {
            actions.Add("DownloadReport");
        }

        return actions;
    }

    private static InspectionViolationPaymentSummaryDto BuildPaymentSummary(InspectionViolation violation, Transaction? latestCompletedPayment)
    {
        var hasCompletedPayment = latestCompletedPayment != null;
        var isPaid = hasCompletedPayment || violation.StatusId == (int)InspectionViolationStatus.Paid;
        var isPendingApproval = !hasCompletedPayment && violation.StatusId == (int)InspectionViolationStatus.PendingApproval;
        var isPendingPayment = !hasCompletedPayment && (violation.StatusId == (int)InspectionViolationStatus.PendingPayment || violation.StatusId == (int)InspectionViolationStatus.UnderAppeal);
        return new InspectionViolationPaymentSummaryDto
        {
            PaymentStatusCode = isPaid
                ? "Paid"
                : isPendingApproval && violation.FineAmount > 0
                    ? "PendingApproval"
                    : isPendingPayment && violation.FineAmount > 0
                        ? "PendingPayment"
                        : "NotApplicable",
            PaymentStatusName = isPaid
                ? "Paid"
                : isPendingApproval && violation.FineAmount > 0
                    ? "Pending Approval"
                    : isPendingPayment && violation.FineAmount > 0
                        ? "Pending Payment"
                        : "Not Applicable",
            AmountDue = isPendingPayment ? violation.FineAmount : 0m,
            PaidAmount = hasCompletedPayment ? Math.Abs(latestCompletedPayment!.Amount) : isPaid ? violation.FineAmount : 0m,
            PaidOn = latestCompletedPayment?.CompletedAt ?? latestCompletedPayment?.CreatedOn ?? (violation.StatusId == (int)InspectionViolationStatus.Paid ? violation.LastUpdatedOn : null),
            PaymentReferenceNo = latestCompletedPayment?.TransactionNo,
            ReceiptFileName = null,
            ReceiptFileUrl = null,
            IsMock = false
        };
    }

    private static InspectionViolationRefundSummaryDto BuildRefundSummary(
        InspectionViolationAppeal? latestRelatedAppeal,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames)
    {
        var latestRefundLink = latestRelatedAppeal?.RefundLinks
            .OrderByDescending(x => x.TriggeredOn ?? x.CreatedOn)
            .ThenByDescending(x => x.Id)
            .FirstOrDefault();
        var refundStatus = MapRefundStatus(latestRefundLink);
        return new InspectionViolationRefundSummaryDto
        {
            RefundStatusCode = refundStatus.StatusCode,
            RefundStatusName = refundStatus.StatusName,
            RefundRequestedOn = latestRefundLink?.TriggeredOn ?? latestRefundLink?.CreatedOn,
            RefundApprovedOn = null,
            RefundAmount = latestRefundLink?.RefundAmount ?? 0m,
            RefundReason = FirstNonEmpty(
                latestRefundLink?.FailureReason,
                latestRelatedAppeal?.AppealReasonRemark,
                latestRelatedAppeal == null ? null : MapAppealReasonDisplayName(latestRelatedAppeal.AppealReason, appealReasonDisplayNames)),
            RefundReferenceNo = latestRefundLink?.RefundNo,
            IsMock = false
        };
    }

    private static InspectionViolationRelatedAppealDto? MapRelatedAppeal(
        InspectionViolationAppeal? appeal,
        IReadOnlyDictionary<string, string> appealReasonDisplayNames)
    {
        if (appeal == null)
        {
            return null;
        }

        return new InspectionViolationRelatedAppealDto
        {
            Id = appeal.Id,
            AppealNo = appeal.AppealNo,
            AppealReason = MapAppealReasonDisplayName(appeal.AppealReason, appealReasonDisplayNames),
            AppealReasonRemark = appeal.AppealReasonRemark,
            StatusId = appeal.StatusId,
            StatusCode = MapCustomerAppealStatusCode(appeal.StatusId),
            StatusName = MapCustomerAppealStatusName(appeal.StatusId),
            SlaDueOn = appeal.SlaDueOn,
            AttachmentUrl1 = appeal.AttachmentUrl1,
            AttachmentUrl2 = appeal.AttachmentUrl2,
            AttachmentUrl3 = appeal.AttachmentUrl3
        };
    }

    private static (string StatusCode, string StatusName) MapRefundStatus(InspectionAppealRefundLink? refundLink)
        => refundLink?.TriggerStatusId switch
        {
            (int)InspectionAppealRefundTriggerStatus.PendingCreation => ("PendingCreation", "Pending Creation"),
            (int)InspectionAppealRefundTriggerStatus.Created => ("RefundRequested", "Refund Requested"),
            (int)InspectionAppealRefundTriggerStatus.CreationFailed => ("CreationFailed", "Creation Failed"),
            (int)InspectionAppealRefundTriggerStatus.Retrying => ("Retrying", "Retrying"),
            _ => ("None", "No Refund")
        };

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

    private static string MapViolationTypeCode(int typeId)
        => typeId switch
        {
            (int)InspectionViolationType.Licensing => nameof(InspectionViolationType.Licensing),
            (int)InspectionViolationType.Content => nameof(InspectionViolationType.Content),
            _ => typeId.ToString()
        };

private static string MapViolationTypeName(int typeId, bool arabic = false)
	=> (arabic, typeId) switch
	{
		(false, (int)InspectionViolationType.Licensing) => "License Violation",
		(false, (int)InspectionViolationType.Content) => "Content Violation",
		(true, (int)InspectionViolationType.Licensing) => "مخالفة ترخيص",
		(true, (int)InspectionViolationType.Content) => "مخالفة محتوى",
		_ => typeId.ToString()
	};

    private static string MapViolationStatusCode(int statusId)
        => statusId switch
        {
            (int)InspectionViolationStatus.WarningIssued => nameof(InspectionViolationStatus.WarningIssued),
            (int)InspectionViolationStatus.PendingRouting => nameof(InspectionViolationStatus.PendingRouting),
            (int)InspectionViolationStatus.PendingContentReport => nameof(InspectionViolationStatus.PendingContentReport),
            (int)InspectionViolationStatus.PendingCommitteeDecision => nameof(InspectionViolationStatus.PendingCommitteeDecision),
            (int)InspectionViolationStatus.PendingReview => nameof(InspectionViolationStatus.PendingReview),
            (int)InspectionViolationStatus.PendingApproval => nameof(InspectionViolationStatus.PendingApproval),
            (int)InspectionViolationStatus.PendingPayment => nameof(InspectionViolationStatus.PendingPayment),
            (int)InspectionViolationStatus.UnderAppeal => nameof(InspectionViolationStatus.UnderAppeal),
            (int)InspectionViolationStatus.Paid => nameof(InspectionViolationStatus.Paid),
            (int)InspectionViolationStatus.Cancelled => nameof(InspectionViolationStatus.Cancelled),
            _ => statusId.ToString()
        };

private static string MapViolationStatusName(int statusId, bool arabic = false)
	=> arabic
		? statusId switch
		{
			(int)InspectionViolationStatus.WarningIssued => "تم إصدار إنذار",
			(int)InspectionViolationStatus.PendingRouting => "بانتظار التوجيه",
			(int)InspectionViolationStatus.PendingContentReport => "بانتظار تقرير المحتوى",
			(int)InspectionViolationStatus.PendingCommitteeDecision => "بانتظار قرار اللجنة",
			(int)InspectionViolationStatus.PendingReview => "بانتظار المراجعة",
			(int)InspectionViolationStatus.PendingApproval => "بانتظار الموافقة",
			(int)InspectionViolationStatus.PendingPayment => "بانتظار الدفع",
			(int)InspectionViolationStatus.UnderAppeal => "قيد التظلم",
			(int)InspectionViolationStatus.Paid => "مدفوع",
			(int)InspectionViolationStatus.Cancelled => "ملغى",
			_ => statusId.ToString()
		}
		: statusId switch
		{
			(int)InspectionViolationStatus.WarningIssued => "Warning Issued",
			(int)InspectionViolationStatus.PendingRouting => "Pending Routing",
			(int)InspectionViolationStatus.PendingContentReport => "Pending Content Report",
			(int)InspectionViolationStatus.PendingCommitteeDecision => "Pending Committee Decision",
			(int)InspectionViolationStatus.PendingReview => "Pending Review",
			(int)InspectionViolationStatus.PendingApproval => "Pending Approval",
			(int)InspectionViolationStatus.PendingPayment => "Pending Payment",
			(int)InspectionViolationStatus.UnderAppeal => "Under Appeal",
			(int)InspectionViolationStatus.Paid => "Paid",
			(int)InspectionViolationStatus.Cancelled => "Cancelled",
			_ => statusId.ToString()
		};


    private static string? MapAppealStatusCode(int statusId)
        => statusId switch
        {
            (int)InspectionAppealStatus.Pending => nameof(InspectionAppealStatus.Pending),
            (int)InspectionAppealStatus.Resolved => nameof(InspectionAppealStatus.Resolved),
            (int)InspectionAppealStatus.DepartmentProcessing => nameof(InspectionAppealStatus.DepartmentProcessing),
            (int)InspectionAppealStatus.DepartmentProcessed => nameof(InspectionAppealStatus.DepartmentProcessed),
            (int)InspectionAppealStatus.PendingCustomer => nameof(InspectionAppealStatus.PendingCustomer),
            (int)InspectionAppealStatus.Approved => nameof(InspectionAppealStatus.Approved),
            (int)InspectionAppealStatus.Rejected => nameof(InspectionAppealStatus.Rejected),
            (int)InspectionAppealStatus.Cancelled => nameof(InspectionAppealStatus.Cancelled),
            _ => statusId.ToString()
        };

    private static string? MapAppealStatusName(int statusId)
        => statusId switch
        {
            (int)InspectionAppealStatus.Pending => "Pending",
            (int)InspectionAppealStatus.Resolved => "Resolved",
            (int)InspectionAppealStatus.DepartmentProcessing => "Department Processing",
            (int)InspectionAppealStatus.DepartmentProcessed => "Department Processed",
            (int)InspectionAppealStatus.PendingCustomer => "Pending Customer",
            (int)InspectionAppealStatus.Approved => "Approved",
            (int)InspectionAppealStatus.Rejected => "Rejected",
            (int)InspectionAppealStatus.Cancelled => "Cancelled",
            _ => statusId.ToString()
        };

    /// <summary>Maps appeal statusId using AppealCustomerStatusEnum; statuses not in the enum default to "Under Review".</summary>
    private static string MapCustomerAppealStatusCode(int statusId)
        => statusId switch
        {
            (int)AppealCustomerStatusEnum.Approved => nameof(AppealCustomerStatusEnum.Approved),
            (int)AppealCustomerStatusEnum.Rejected => nameof(AppealCustomerStatusEnum.Rejected),
            (int)AppealCustomerStatusEnum.Cancelled => nameof(AppealCustomerStatusEnum.Cancelled),
            _ => "UnderReview"
        };

    /// <summary>Maps appeal statusId using AppealCustomerStatusEnum; statuses not in the enum default to "Under Review".</summary>
    private static string MapCustomerAppealStatusName(int statusId)
        => statusId switch
        {
            (int)AppealCustomerStatusEnum.Approved => "Approved",
            (int)AppealCustomerStatusEnum.Rejected => "Rejected",
            (int)AppealCustomerStatusEnum.Cancelled => "Cancelled",
            _ => "Under Review"
        };

    private static string? MapDecisionTypeCode(int? decisionTypeId)
        => decisionTypeId switch
        {
            null => null,
            (int)InspectionDecisionType.Warning => nameof(InspectionDecisionType.Warning),
            (int)InspectionDecisionType.Fine => nameof(InspectionDecisionType.Fine),
            (int)InspectionDecisionType.CancelViolation => nameof(InspectionDecisionType.CancelViolation),
            _ => decisionTypeId.Value.ToString()
        };

    private static string? MapDecisionTypeName(int? decisionTypeId)
        => decisionTypeId switch
        {
            null => null,
            (int)InspectionDecisionType.Warning => "Warning",
            (int)InspectionDecisionType.Fine => "Fine",
            (int)InspectionDecisionType.CancelViolation => "Cancel Violation",
            _ => decisionTypeId.Value.ToString()
        };

    private static string? MapAppealDecisionTypeCode(int? appealDecisionTypeId)
        => appealDecisionTypeId switch
        {
            null => null,
            (int)InspectionAppealDecisionType.RejectAppeal => nameof(InspectionAppealDecisionType.RejectAppeal),
            (int)InspectionAppealDecisionType.ModifyViolation => nameof(InspectionAppealDecisionType.ModifyViolation),
            (int)InspectionAppealDecisionType.CancelViolation => nameof(InspectionAppealDecisionType.CancelViolation),
            _ => appealDecisionTypeId.Value.ToString()
        };

    private static string? MapAppealDecisionTypeName(int? appealDecisionTypeId)
        => appealDecisionTypeId switch
        {
            null => null,
            (int)InspectionAppealDecisionType.RejectAppeal => "Reject Appeal",
            (int)InspectionAppealDecisionType.ModifyViolation => "Modify Violation",
            (int)InspectionAppealDecisionType.CancelViolation => "Cancel Violation",
            _ => appealDecisionTypeId.Value.ToString()
        };

    private static string? MapAppealDecisionTypeNameAr(int? appealDecisionTypeId)
        => appealDecisionTypeId switch
        {
            null => null,
            (int)InspectionAppealDecisionType.RejectAppeal => "رفض الاستئناف",
            (int)InspectionAppealDecisionType.ModifyViolation => "تعديل المخالفة",
            (int)InspectionAppealDecisionType.CancelViolation => "إلغاء المخالفة",
            _ => appealDecisionTypeId.Value.ToString()
        };

    private static string? MapCommitteeDecisionTypeName(int? committeeDecisionTypeId)
        => committeeDecisionTypeId switch
        {
            null => null,
            (int)CommitteeDecisionType.Modified => "Violation Modified",
            (int)CommitteeDecisionType.Confirmed => "Violation Confirmed",
            (int)CommitteeDecisionType.Cancelled => "Violation Cancelled",
            _ => committeeDecisionTypeId.Value.ToString()
        };

    private static string? MapCommitteeDecisionTypeNameAr(int? committeeDecisionTypeId)
        => committeeDecisionTypeId switch
        {
            null => null,
            (int)CommitteeDecisionType.Modified => "تعديل المخالفة",
            (int)CommitteeDecisionType.Confirmed => "تأكيد المخالفة",
            (int)CommitteeDecisionType.Cancelled => "إلغاء المخالفة",
            _ => committeeDecisionTypeId.Value.ToString()
        };

    private static string ResolveDeclarationStatusCode(InspectionTaskContactPerson contactPerson, InspectionViolation violation)
    {
        if (contactPerson.HasSignedDeclaration == true) return "Signed";
        if (contactPerson.HasSignedDeclaration == false) return "Declined";
        if (violation.DeclarationLinkExpiresOn.HasValue && DateTimeHelper.Now > violation.DeclarationLinkExpiresOn.Value) return "ExpiredReadOnly";
        if (violation.DeclarationLinkSentOn.HasValue) return "PendingSignature";
        return "NotInitiated";
    }

    private static string ResolveDeclarationStatusCodeForContext(InspectionTaskContactPerson? contactPerson, InspectionViolation violation)
    {
        if (contactPerson == null)
        {
            if (violation.DeclarationLinkExpiresOn.HasValue && DateTimeHelper.Now > violation.DeclarationLinkExpiresOn.Value) return "ExpiredReadOnly";
            if (violation.DeclarationLinkSentOn.HasValue) return "PendingSignature";
            return "NotInitiated";
        }

        return ResolveDeclarationStatusCode(contactPerson, violation);
    }

    private static string ResolveDeclarationStatusName(InspectionTaskContactPerson contactPerson, InspectionViolation violation)
        => ResolveDeclarationStatusCode(contactPerson, violation) switch
        {
            "Signed" => "Signed",
            "Declined" => "Declined",
            "ExpiredReadOnly" => "Expired (Read Only)",
            "PendingSignature" => "Pending Signature",
            _ => "Not Initiated"
        };

    private static string ResolveDeclarationStatusNameForContext(InspectionTaskContactPerson? contactPerson, InspectionViolation violation)
        => ResolveDeclarationStatusCodeForContext(contactPerson, violation) switch
        {
            "Signed" => "Signed",
            "Declined" => "Declined",
            "ExpiredReadOnly" => "Expired (Read Only)",
            "PendingSignature" => "Pending Signature",
            _ => "Not Initiated"
        };

    private string? BuildDeclarationToken(InspectionViolation violation)
    {
        if (_inspectionDeclarationLinkService == null ||
            string.IsNullOrWhiteSpace(violation.DeclarationRecipientAddress) ||
            !violation.DeclarationLinkExpiresOn.HasValue)
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

    private static string? BuildMockSignatureFileName(InspectionViolation violation, InspectionTaskContactPerson contactPerson)
        => contactPerson.HasSignedDeclaration == true
            ? $"signature-{violation.ViolationNo}-{contactPerson.Id}.png"
            : null;

    private static string? BuildMockSignatureFileUrl(InspectionViolation violation, InspectionTaskContactPerson contactPerson)
        => contactPerson.HasSignedDeclaration == true
            ? $"/api/admin/inspection/mock-files/signatures/signature-{violation.ViolationNo}-{contactPerson.Id}.png"
            : null;


    private static string? FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));

    private sealed record ProjectedViolationTimelineHandler(
        string? UserId,
        string? UserName,
        string Source,
        bool IsPendingPlaceholder);

public async Task<byte[]> ExportAsync(InspectionViolationListRequestDto request)
{
	var isArabic = _currentUserService.IsArabicLanguage;
	var visibilityContext = await BuildVisibilityContextAsync().ConfigureAwait(false);
	var query = BuildViolationListQuery(request, visibilityContext);
	query = ApplySorting(query, request.SortBy, request.SortDirection);

	var rawItems = await query
		.Select(x => new
		{
			x.ViolationNo,
			x.ViolationTypeId,
			x.ViolatorName,
			x.ViolatorIdentifier,
			x.FineAmount,
			x.StatusId,
			x.SlaDeadlineAt,
			TaskNo = x.SourceTask != null ? x.SourceTask.TaskNo : null,
			x.ReportedByName,
			x.CreatedOn,
			SourceTaskEstablishmentId = x.SourceTask != null ? x.SourceTask.EstablishmentId : null,
			SourceSnapshotEstablishmentId = x.SourceSnapshot != null ? x.SourceSnapshot.EstablishmentId : null,
			SourceTaskIndividualId = x.SourceTask != null ? x.SourceTask.IndividualId : null,
			SourceSnapshotIndividualId = x.SourceSnapshot != null ? x.SourceSnapshot.IndividualId : null
		})
		.ToListAsync()
		.ConfigureAwait(false);

	var violationStatusNames = await ResolveEnumTypeDictionaryNamesAsync(
			nameof(InspectionViolationStatus),
			CollectIds(rawItems.Select(x => (int?)x.StatusId)),
			preferArabic: isArabic)
		.ConfigureAwait(false);

	// Resolve Arabic establishment names for ViolatorName when Arabic is requested
	var exportViolatorNameArMap = new Dictionary<int, string>();
	if (isArabic)
	{
		var estIds = rawItems
			.Select(x => x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId)
			.Where(x => x.HasValue && x.Value > 0)
			.Select(x => x!.Value)
			.Distinct()
			.ToList();
		if (estIds.Count > 0)
		{
			var ests = await _dbContext.Establishments
				.AsNoTracking()
				.Where(e => estIds.Contains(e.Id))
				.Select(e => new { e.Id, e.NameAr })
				.ToListAsync()
				.ConfigureAwait(false);
			foreach (var e in ests)
			{
				if (!string.IsNullOrWhiteSpace(e.NameAr))
				{
					exportViolatorNameArMap[e.Id] = e.NameAr;
				}
			}
		}
	}

	// Resolve Arabic person names for ViolatorName when violator is individual.
	// The individual FK on the task/snapshot is a UserProfiles.Id, NOT a Persons.Id, so
	// resolve Core.Persons via Account.UserProfiles.PersonId. Map is keyed by UserProfile.Id.
	var exportPersonNameArMap = new Dictionary<int, string>();
	if (isArabic)
	{
		var profileIds = rawItems
			.Select(x => x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId)
			.Where(x => x.HasValue && x.Value > 0)
			.Select(x => x!.Value)
			.Distinct()
			.ToList();
		if (profileIds.Count > 0)
		{
			var persons = await (from up in _dbContext.UserProfiles.AsNoTracking()
				where profileIds.Contains(up.Id) && up.PersonId != 0
				join p in _dbContext.Persons.AsNoTracking() on up.PersonId equals p.Id
				select new { ProfileId = up.Id, p.NameAr })
				.ToListAsync()
				.ConfigureAwait(false);
			foreach (var p in persons)
			{
				if (!string.IsNullOrWhiteSpace(p.NameAr))
				{
					exportPersonNameArMap[p.ProfileId] = p.NameAr;
				}
			}
		}
	}

	// Fallback: resolve Arabic name via ViolatorIdentifier when no target FK is present.
	var exportIdentifierPersonArMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
	var exportIdentifierEstArMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
	if (isArabic)
	{
		var unresolvedIdentifiers = rawItems
			.Where(x => (x.SourceTaskEstablishmentId ?? x.SourceSnapshotEstablishmentId) is not > 0
			            && (x.SourceTaskIndividualId ?? x.SourceSnapshotIndividualId) is not > 0
			            && !string.IsNullOrWhiteSpace(x.ViolatorIdentifier))
			.Select(x => x.ViolatorIdentifier!.Trim())
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.ToList();
		if (unresolvedIdentifiers.Count > 0)
		{
			var personsByEmiratesId = await _dbContext.Persons
				.AsNoTracking()
				.Where(p => p.EmiratesId != null && unresolvedIdentifiers.Contains(p.EmiratesId) && p.NameAr != null)
				.Select(p => new { p.EmiratesId, p.NameAr })
				.ToListAsync()
				.ConfigureAwait(false);
			foreach (var p in personsByEmiratesId)
			{
				if (!string.IsNullOrWhiteSpace(p.EmiratesId) && !string.IsNullOrWhiteSpace(p.NameAr))
				{
					exportIdentifierPersonArMap[p.EmiratesId!.Trim()] = p.NameAr!;
				}
			}

			var estsByLicense = await _dbContext.Establishments
				.AsNoTracking()
				.Where(e => e.LicenseNumber != null && unresolvedIdentifiers.Contains(e.LicenseNumber) && e.NameAr != null)
				.Select(e => new { e.LicenseNumber, e.NameAr })
				.ToListAsync()
				.ConfigureAwait(false);
			foreach (var e in estsByLicense)
			{
				if (!string.IsNullOrWhiteSpace(e.LicenseNumber) && !string.IsNullOrWhiteSpace(e.NameAr))
				{
					exportIdentifierEstArMap[e.LicenseNumber!.Trim()] = e.NameAr!;
				}
			}
		}
	}

	// Only the agreed export columns (in order):
	// Violation No., Violation Type, Violator, Fine Amount, Status, SLA, Source Task, Reported By, Creation Time
	var builder = new System.Text.StringBuilder();
	builder.AppendLine(isArabic
		? string.Join(',',
			"رقم المخالفة",
			"نوع المخالفة",
			"المخالف",
			"مبلغ الغرامة",
			"الحالة",
			"اتفاقية مستوى الخدمة",
			"المهمة المصدر",
			"أبلغ عنها",
			"تاريخ الإنشاء")
		: string.Join(',',
			"Violation No.",
			"Violation Type",
			"Violator",
			"Fine Amount",
			"Status",
			"SLA",
			"Source Task",
			"Reported By",
			"Creation Time"));

	foreach (var item in rawItems)
	{
		var statusName = violationStatusNames.TryGetValue(item.StatusId, out var resolvedStatusName)
			? resolvedStatusName
			: MapViolationStatusName(item.StatusId, isArabic);

		var sla = BuildViolationSla(item.SlaDeadlineAt, isArabic);
		var slaText = sla?.DisplayText ?? string.Empty;

		var violatorDisplayName = isArabic
			&& (item.SourceTaskEstablishmentId ?? item.SourceSnapshotEstablishmentId) is > 0
			&& exportViolatorNameArMap.TryGetValue((item.SourceTaskEstablishmentId ?? item.SourceSnapshotEstablishmentId)!.Value, out var exportViolatorAr)
			? exportViolatorAr
			: isArabic
				&& (item.SourceTaskIndividualId ?? item.SourceSnapshotIndividualId) is > 0
				&& exportPersonNameArMap.TryGetValue((item.SourceTaskIndividualId ?? item.SourceSnapshotIndividualId)!.Value, out var exportPersonAr)
				? exportPersonAr
				: isArabic
					&& !string.IsNullOrWhiteSpace(item.ViolatorIdentifier)
					&& exportIdentifierPersonArMap.TryGetValue(item.ViolatorIdentifier!.Trim(), out var exportIdPersonAr)
					? exportIdPersonAr
					: isArabic
						&& !string.IsNullOrWhiteSpace(item.ViolatorIdentifier)
						&& exportIdentifierEstArMap.TryGetValue(item.ViolatorIdentifier!.Trim(), out var exportIdEstAr)
						? exportIdEstAr
						: item.ViolatorName;

		builder.AppendLine(string.Join(',',
			EscapeCsv(item.ViolationNo),
			EscapeCsv(MapViolationTypeName(item.ViolationTypeId, isArabic)),
			EscapeCsv(violatorDisplayName),
			EscapeCsv(item.FineAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)),
			EscapeCsv(statusName),
			EscapeCsv(slaText),
			EscapeCsv(item.TaskNo),
			EscapeCsv(item.ReportedByName),
				EscapeCsv(item.CreatedOn.ToString("dd/MM/yyyy HH:mm:ss"))));
	}

	var preamble = System.Text.Encoding.UTF8.GetPreamble();
	var payload = System.Text.Encoding.UTF8.GetBytes(builder.ToString());
	var result = new byte[preamble.Length + payload.Length];
	Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
	Buffer.BlockCopy(payload, 0, result, preamble.Length, payload.Length);
	return result;
}

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    // ========== Permission-based Access Control Methods ==========
    
    private async Task<bool> CanRouteViolationAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationRoute");
    }
    
    private async Task<bool> CanSubmitContentReportAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationContent");
    }
    
    private async Task<bool> CanDecideViolationAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationDecide");
    }
    
    private async Task<bool> CanApproveViolationAsync()
    {
        return await _permissionService.HasPermissionAsync("Inspection.ViolationManagement.ViolationApproval");
    }


    private async Task EnsureCanRouteViolationAsync()
    {
        if (!await CanRouteViolationAsync())
        {
            throw new BusinessException("Inspection.Violation.RoutePermissionDenied", "You do not have permission to route violations.");
        }
    }
    
    private async Task EnsureCanSubmitContentReportAsync()
    {
        if (!await CanSubmitContentReportAsync())
        {
            throw new BusinessException("Inspection.Violation.ContentReportPermissionDenied", "You do not have permission to submit content reports.");
        }
    }

    private async Task EnsureCanDecideViolationAsync()
    {
        if (!await CanDecideViolationAsync())
        {
            throw new BusinessException("Inspection.Violation.DecidePermissionDenied", "You do not have permission to decide violations.");
        }
    }
    
    private async Task EnsureCanApproveViolationAsync()
    {
        if (!await CanApproveViolationAsync())
        {
            throw new BusinessException("Inspection.Violation.ApprovalPermissionDenied", "You do not have permission to approve violations.");
        }
    }


}

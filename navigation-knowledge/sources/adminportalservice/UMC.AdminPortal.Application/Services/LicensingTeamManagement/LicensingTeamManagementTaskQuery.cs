using Microsoft.EntityFrameworkCore;
using UMC.AdminPortal.Application.Dtos.Licensing;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Models.Workflow;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.Models;
using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Application.Services.LicensingTeamManagement;

/// <summary>
/// Builds the optimized task-list read model. Every source projects the same
/// shape and Concat is intentionally used so EF generates UNION ALL.
/// </summary>
internal static class LicensingTeamManagementTaskQuery
{
    private const int LicensingDepartmentId = (int)DepartmentEnum.Licensing;
    private const int ContentDepartmentId = (int)DepartmentEnum.Content;
    private const string TransferDepartmentServiceCode = "1201";
    private const string WorkflowStatusDomain = "applicationWorkflow";

    private static readonly short[] EnquiryCompletedStatusIds =
    [
        (short)EnquiryEnum.EnquiryAdminStatus.Resolved,
        (short)EnquiryEnum.EnquiryAdminStatus.Completed,
        (short)EnquiryEnum.EnquiryAdminStatus.Cancelled
    ];

    private static readonly short[] RefundCompletedStatusIds =
    [
        (short)TicketRefundsStatusEnum.Rejected,
        (short)TicketRefundsStatusEnum.Refunded,
        (short)TicketRefundsStatusEnum.Cancelled
    ];

    private static readonly int[] AppealCompletedStatusIds =
    [
        (int)InspectionAppealStatus.Approved,
        (int)InspectionAppealStatus.Rejected,
        (int)InspectionAppealStatus.Cancelled,
        (int)InspectionAppealStatus.Resolved
    ];

    internal static IQueryable<LicensingTaskQueryRow> Build(
        AdminPortalDBContext dbContext,
        LicensingTeamManagementTaskQueryRequest request,
        bool isArabicLanguage,
        string? normalizedCategory)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var completedView = string.Equals(
            request.View,
            LicensingTeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase);
        var query = completedView
            ? ProjectCompletedView(dbContext, isArabicLanguage, urgentDueBefore)
            : ProjectTodoView(dbContext, isArabicLanguage, urgentDueBefore);
        query = ExcludeApplicationRowsSupersededByNewerTask(dbContext, query, completedView);

        if (request.ApplicationTaskOnly)
        {
            query = query.Where(row =>
                row.SourceType == LicensingTeamManagementConstants.SourceApplication);
        }

        return ApplyFilters(query, request, normalizedCategory);
    }

    /// <summary>
    /// OPS-04. Serves the query from the physical table ReadModel.LicensingTeamTaskRead,
    /// maintained by the trigger-driven incremental worker and the nightly rebuild. The urgency
    /// window is re-evaluated at query time from the stored eligibility flags so a row urgent at
    /// sync time does not stay urgent forever.
    /// </summary>
    internal static IQueryable<LicensingTaskQueryRow> BuildFromTable(
        AdminPortalDBContext dbContext,
        LicensingTeamManagementTaskQueryRequest request,
        bool isArabicLanguage,
        string? normalizedCategory)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var viewType = string.Equals(
            request.View,
            LicensingTeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase)
            ? LicensingTeamManagementConstants.ViewCompleted
            : LicensingTeamManagementConstants.ViewTodo;

        var rows = dbContext.Set<LicensingTeamTaskReadRow>().AsNoTracking()
            .Where(row => row.ViewType == viewType);

        var query = isArabicLanguage
            ? rows.Select(row => new LicensingTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                Category = row.Category, ApplyFor = row.ApplyForAr,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo, RawStatusCode = row.RawStatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextAr,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DueOn = row.DueOn, CreatedOn = row.CreatedOn, HasNoSlaSort = row.HasNoSlaSort,
                IsExternalApprovalSort = row.IsExternalApprovalSort,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.DueOn.HasValue && row.DueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            })
            : rows.Select(row => new LicensingTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                Category = row.Category, ApplyFor = row.ApplyForEn,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo, RawStatusCode = row.RawStatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextEn,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DueOn = row.DueOn, CreatedOn = row.CreatedOn, HasNoSlaSort = row.HasNoSlaSort,
                IsExternalApprovalSort = row.IsExternalApprovalSort,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.DueOn.HasValue && row.DueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            });
        // Superseded application rows are already excluded at projection time by
        // BuildApplicationRows (the "no newer task for the same application" predicate), so they
        // never reach the read table. Re-checking here matched every stored row while forcing the
        // correlated CamundaTasks/CamundaProcessInstances subquery onto the whole table: the OR
        // against SourceType blocks predicate pushdown, so all rows -- not just the application
        // ones -- paid for a three-way join. The legacy path in Build() still needs the filter
        // because it projects straight off CamundaTasks.

        if (request.ApplicationTaskOnly)
        {
            query = query.Where(row =>
                row.SourceType == LicensingTeamManagementConstants.SourceApplication);
        }

        return ApplyFilters(query, request, normalizedCategory);
    }

    /// <summary>
    /// Single-source slice of the legacy authoritative projection, used by the incremental sync
    /// (LicensingTeamTaskReadSyncProcessor) so the DirtyQueue maintenance shares one row
    /// definition with the read query and the nightly rebuild. Ownership filters mirror the
    /// PRJ-06 delete predicates: application rows are owned via the DetailTarget prefix
    /// "applications/{id}?" (their SourceId is a Camunda TaskId); all other sources own rows
    /// whose SourceId is "{id}" or "{id}:...".
    /// </summary>

    /// <summary>
    /// Batch slice of the authoritative projection for ONE source type and a set of source keys.
    /// The keys are pushed down as an IN list on the base table's primary key, so the whole batch
    /// stays index-seekable and never touches the UNION ALL read views: one queue batch costs a
    /// constant number of round-trips per source type instead of one query per queue item, and the
    /// scanned volume is proportional to the batch, not to the table size.
    /// </summary>
    internal static IQueryable<LicensingTaskQueryRow> BuildLegacyForSources(
        AdminPortalDBContext dbContext,
        LicensingTeamManagementTaskQueryRequest request,
        bool isArabicLanguage,
        string sourceType,
        int[] sourceEntityIds)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var completedView = string.Equals(
            request.View,
            LicensingTeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase);

        var query = sourceType switch
        {
            LicensingTeamManagementConstants.SourceApplication =>
                BuildApplicationRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            LicensingTeamManagementConstants.SourceProfileVerification =>
                BuildProfileVerificationRows(
                    dbContext, completedView, isArabicLanguage, sourceEntityIds),
            LicensingTeamManagementConstants.SourceEnquiry =>
                BuildEnquiryRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            LicensingTeamManagementConstants.SourceRefund =>
                BuildRefundRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            LicensingTeamManagementConstants.SourceAppeal =>
                BuildAppealRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            _ => throw new ArgumentOutOfRangeException(
                nameof(sourceType), sourceType, "Unsupported source type.")
        };
        // Deliberately NOT ApplyFilters: this is the PROJECTION path. See the matching note in
        // ContentTeamManagementTaskQuery.BuildLegacyForSources.
        return query;
    }

    /// <summary>
    /// Arabic companion of <see cref="BuildLegacyForSources"/>, for the incremental sync only.
    /// The read table stores both languages per row, but ONLY ApplyFor and StatusText depend on the
    /// language -- every other column is byte-identical between the two passes. Composing a narrow
    /// Select over the SAME query lets the provider prune the joins and correlated subqueries that
    /// fed nothing but the dropped columns, so the second language pass stops costing a second full
    /// projection. Narrowing the existing query rather than hand-writing an Arabic one keeps ONE
    /// source of truth for the business rules. Mirrors the Content side.
    /// </summary>
    internal static IQueryable<LicensingTaskLocalizedRow> BuildArabicTextForSources(
        AdminPortalDBContext dbContext,
        LicensingTeamManagementTaskQueryRequest request,
        string sourceType,
        int[] sourceEntityIds)
        => BuildLegacyForSources(
                dbContext, request, isArabicLanguage: true, sourceType, sourceEntityIds)
            .Select(row => new LicensingTaskLocalizedRow
            {
                SourceId = row.SourceId,
                ApplyFor = row.ApplyFor,
                StatusText = row.StatusText
            });

    // Retained during rollout as a result-equivalence oracle and rollback path.
    internal static IQueryable<LicensingTaskQueryRow> BuildLegacy(
        AdminPortalDBContext dbContext,
        LicensingTeamManagementTaskQueryRequest request,
        bool isArabicLanguage,
        string? normalizedCategory)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var completedView = string.Equals(
            request.View,
            LicensingTeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase);

        var applicationQuery = BuildApplicationRows(dbContext, completedView, isArabicLanguage, urgentDueBefore);
        IQueryable<LicensingTaskQueryRow> query;
        if (request.ApplicationTaskOnly)
        {
            query = normalizedCategory == null
                    || normalizedCategory == LicensingTeamManagementConstants.CategoryAll
                    || normalizedCategory == LicensingTeamManagementConstants.CategoryApplications
                ? applicationQuery
                : applicationQuery.Where(_ => false);
        }
        else
        {
            query = normalizedCategory switch
            {
                LicensingTeamManagementConstants.CategoryApplications => applicationQuery,
                LicensingTeamManagementConstants.CategoryProfileVerifications =>
                    BuildProfileVerificationRows(dbContext, completedView, isArabicLanguage),
                LicensingTeamManagementConstants.CategoryEnquiries =>
                    BuildEnquiryRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                LicensingTeamManagementConstants.CategoryRefunds =>
                    BuildRefundRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                LicensingTeamManagementConstants.CategoryAppeals =>
                    BuildAppealRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                _ => applicationQuery
                    .Concat(BuildProfileVerificationRows(dbContext, completedView, isArabicLanguage))
                    .Concat(BuildEnquiryRows(dbContext, completedView, isArabicLanguage, urgentDueBefore))
                    .Concat(BuildRefundRows(dbContext, completedView, isArabicLanguage, urgentDueBefore))
                    .Concat(BuildAppealRows(dbContext, completedView, isArabicLanguage, urgentDueBefore))
            };
        }

        return ApplyFilters(query, request, normalizedCategory);
    }

    private static IQueryable<LicensingTaskQueryRow> ProjectTodoView(
        AdminPortalDBContext dbContext,
        bool isArabicLanguage,
        DateTime urgentDueBefore)
    {
        var rows = dbContext.Set<LicensingTeamTodoReadRow>().AsNoTracking();
        return isArabicLanguage
            ? rows.Select(row => new LicensingTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                Category = row.Category, ApplyFor = row.ApplyForAr,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo, RawStatusCode = row.RawStatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextAr,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DueOn = row.DueOn, CreatedOn = row.CreatedOn, HasNoSlaSort = row.HasNoSlaSort,
                IsExternalApprovalSort = row.IsExternalApprovalSort,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.DueOn.HasValue && row.DueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            })
            : rows.Select(row => new LicensingTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                Category = row.Category, ApplyFor = row.ApplyForEn,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo, RawStatusCode = row.RawStatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextEn,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DueOn = row.DueOn, CreatedOn = row.CreatedOn, HasNoSlaSort = row.HasNoSlaSort,
                IsExternalApprovalSort = row.IsExternalApprovalSort,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.DueOn.HasValue && row.DueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            });
    }

    private static IQueryable<LicensingTaskQueryRow> ProjectCompletedView(
        AdminPortalDBContext dbContext,
        bool isArabicLanguage,
        DateTime urgentDueBefore)
    {
        var rows = dbContext.Set<LicensingTeamCompletedReadRow>().AsNoTracking();
        return isArabicLanguage
            ? rows.Select(row => new LicensingTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                Category = row.Category, ApplyFor = row.ApplyForAr,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo, RawStatusCode = row.RawStatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextAr,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DueOn = row.DueOn, CreatedOn = row.CreatedOn, HasNoSlaSort = row.HasNoSlaSort,
                IsExternalApprovalSort = row.IsExternalApprovalSort,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.DueOn.HasValue && row.DueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            })
            : rows.Select(row => new LicensingTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                Category = row.Category, ApplyFor = row.ApplyForEn,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedUserId = row.AssignedUserId,
                AssignedTo = row.AssignedTo, RawStatusCode = row.RawStatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextEn,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DueOn = row.DueOn, CreatedOn = row.CreatedOn, HasNoSlaSort = row.HasNoSlaSort,
                IsExternalApprovalSort = row.IsExternalApprovalSort,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.DueOn.HasValue && row.DueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            });
    }

    internal static IQueryable<LicensingTaskQueryRow> ExcludeApplicationRowsSupersededByNewerTask(
        AdminPortalDBContext dbContext,
        IQueryable<LicensingTaskQueryRow> query,
        bool completedView)
    {
        return query.Where(row =>
            row.SourceType != LicensingTeamManagementConstants.SourceApplication
            || dbContext.CamundaTasks.Any(sourceTask =>
                sourceTask.TaskId == row.SourceId
                && !(from sourceProcess in dbContext.CamundaProcessInstances
                     join application in dbContext.Applications
                         on sourceProcess.ApplicationId equals application.Id
                     join newerProcess in dbContext.CamundaProcessInstances
                         on sourceProcess.ApplicationId equals newerProcess.ApplicationId
                     join newerTask in dbContext.CamundaTasks
                         on newerProcess.ProcessInstanceId equals newerTask.ProcessInstanceId
                     where sourceProcess.ProcessInstanceId == sourceTask.ProcessInstanceId
                           && (newerTask.CreatedTime > sourceTask.CreatedTime
                               || (newerTask.CreatedTime == sourceTask.CreatedTime
                                   && newerTask.Id > sourceTask.Id))
                           && (!completedView
                               || application.ServiceCode != TransferDepartmentServiceCode
                               || newerTask.ApprovalDepartment == LicensingDepartmentId)
                     select newerTask.Id).Any()));
    }

    internal static IOrderedQueryable<LicensingTaskQueryRow> ApplySorting(
        IQueryable<LicensingTaskQueryRow> query,
        LicensingTeamManagementTaskQueryRequest request)
    {
        var sortBy = string.IsNullOrWhiteSpace(request.SortBy)
            ? "lastUpdatedOn"
            : request.SortBy.Trim();
        var descending = request.SortDirection == SortDirection.Descending;

        var ordered = sortBy.ToLowerInvariant() switch
        {
            "sla" when descending => query
                .OrderByDescending(row => row.IsUrgentSort)
                .ThenBy(row => row.HasNoSlaSort)
                .ThenBy(row => row.DueOn)
                .ThenBy(row => row.IsExternalApprovalSort)
                .ThenByDescending(row => row.LastUpdatedOn),
            "sla" => query
                .OrderBy(row => row.IsExternalApprovalSort)
                .ThenBy(row => row.HasNoSlaSort)
                .ThenByDescending(row => row.DueOn)
                .ThenByDescending(row => row.IsUrgentSort)
                .ThenByDescending(row => row.LastUpdatedOn),
            "taskno" when descending => query
                .OrderByDescending(row => row.TaskNo)
                .ThenByDescending(row => row.LastUpdatedOn),
            "taskno" => query
                .OrderBy(row => row.TaskNo)
                .ThenByDescending(row => row.LastUpdatedOn),
            "assignedto" when descending => query
                .OrderByDescending(row => row.AssignedTo)
                .ThenByDescending(row => row.LastUpdatedOn),
            "assignedto" => query
                .OrderBy(row => row.AssignedTo)
                .ThenByDescending(row => row.LastUpdatedOn),
            _ when descending => query
                .OrderByDescending(row => row.LastUpdatedOn)
                .ThenBy(row => row.TaskNo),
            _ => query
                .OrderBy(row => row.LastUpdatedOn)
                .ThenBy(row => row.TaskNo)
        };
        return ordered
            .ThenBy(row => row.SourceType)
            .ThenBy(row => row.SourceId);
    }

    private static IQueryable<LicensingTaskQueryRow> ApplyFilters(
        IQueryable<LicensingTaskQueryRow> query,
        LicensingTeamManagementTaskQueryRequest request,
        string? normalizedCategory)
    {
        if (!string.IsNullOrWhiteSpace(request.Keyword))
        {
            var keyword = request.Keyword.Trim().ToLower();
            query = query.Where(row =>
                (row.TaskNo != null && row.TaskNo.ToLower().Contains(keyword))
                || (row.ApplyFor != null && row.ApplyFor.ToLower().Contains(keyword))
                || (row.AssignedTo != null && row.AssignedTo.ToLower().Contains(keyword))
                || (row.StatusText != null && row.StatusText.ToLower().Contains(keyword)));
        }

        if (!string.IsNullOrWhiteSpace(normalizedCategory)
            && normalizedCategory != LicensingTeamManagementConstants.CategoryAll)
        {
            query = query.Where(row => row.Category == normalizedCategory);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = request.Status.Trim().ToLower();
            query = query.Where(row =>
                row.StatusFilterCode.ToLower() == status
                || (row.RawStatusCode != null && row.RawStatusCode.ToLower() == status)
                || (row.StatusText != null && row.StatusText.ToLower() == status));
        }

        if (!string.IsNullOrWhiteSpace(request.MemberId))
        {
            var memberId = request.MemberId.Trim().ToLower();
            query = query.Where(row =>
                row.AssignedUserId != null
                && row.AssignedUserId.ToLower() == memberId);
        }

        if (request.LastUpdatedFrom.HasValue)
        {
            query = query.Where(row => row.LastUpdatedOn >= request.LastUpdatedFrom.Value);
        }

        if (request.LastUpdatedTo.HasValue)
        {
            var rangeEndExclusive = request.LastUpdatedTo.Value.Date.AddDays(1);
            query = query.Where(row => row.LastUpdatedOn < rangeEndExclusive);
        }

        if (request.StartDate.HasValue)
            query = query.Where(row => row.CreatedOn >= request.StartDate.Value);

        if (request.EndDate.HasValue)
            query = query.Where(row => row.CreatedOn < request.EndDate.Value);

        return query;
    }

    private static IQueryable<LicensingTaskQueryRow> BuildApplicationRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? sourceEntityIds = null)
    {
        return
            from task in dbContext.CamundaTasks.AsNoTracking()
            join process in dbContext.CamundaProcessInstances.AsNoTracking()
                on task.ProcessInstanceId equals process.ProcessInstanceId
            join application in dbContext.Applications.AsNoTracking()
                on process.ApplicationId equals application.Id
            join service in dbContext.ServiceConfigs.AsNoTracking()
                on application.ServiceId equals service.Id into serviceGroup
            from service in serviceGroup.DefaultIfEmpty()
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on task.Assignee equals assignee.Id into assigneeGroup
            from assignee in assigneeGroup.DefaultIfEmpty()
            join profile in dbContext.UserProfiles.AsNoTracking()
                on application.ProfileId equals profile.Id into profileGroup
            from profile in profileGroup.DefaultIfEmpty()
            join person in dbContext.Persons.AsNoTracking()
                on profile.PersonId equals person.Id into personGroup
            from person in personGroup.DefaultIfEmpty()
            let statusId = task.StatusId ?? process.StatusId
            let statusCode = statusId.ToString()
            // Align the status display with the legacy MyTeamTodoPage / MyTeamComplatedPage:
            // the displayed status text uses the process-instance status, not the task-node
            // status, for both the todo and completed views.
            let displayStatusCode = process.StatusId.ToString()
            // 1201 hands the application over to the Content department once Licensing approves
            // it. The process instance then parks on an in-progress state while Content reviews,
            // but the Licensing task itself is finished, so the parked state describes Content's
            // work rather than unfinished Licensing work.
            let isContentHandoff = application.ServiceCode == TransferDepartmentServiceCode
                && (from handoffTask in dbContext.CamundaTasks
                    join handoffProcess in dbContext.CamundaProcessInstances
                        on handoffTask.ProcessInstanceId equals handoffProcess.ProcessInstanceId
                    where handoffProcess.ApplicationId == application.Id
                          && handoffTask.ApprovalDepartment == ContentDepartmentId
                          && (handoffTask.CreatedTime > task.CreatedTime
                              || (handoffTask.CreatedTime == task.CreatedTime
                                  && handoffTask.Id > task.Id))
                    select handoffTask.Id).Any()
            // FinalApproval / ExternalApproval / PendingModification are in-progress (parked)
            // process states, never terminal. Per requirement they must never appear in the
            // completed list — force them into the todo list even when the latest Licensing
            // task already carries an ApprovalAt. The 1201 Content handoff is the one exception:
            // without it the row is hidden from Completed by this rule and from Todo by the
            // newer-task rule below, so it disappears from the Licensing team entirely.
            let isForceTodoStatus = (process.StatusId == (int)ApprovalNodeOrder.FinalApproval
                || process.StatusId == (int)ApprovalNodeOrder.ExternalApproval
                || process.StatusId == (int)ApprovalNodeOrder.PendingModification)
                && !isContentHandoff
            // Reassign eligibility must stay fail-closed across both status sources. The todo
            // list shows process.StatusId, while task.StatusId can still point at an earlier
            // approval node, so a task-first check alone lets a Pending Modification /
            // External Approval application keep the Reassign action. Block on either source.
            let isReassignBlockedStatus = task.StatusId == (int)ApprovalNodeOrder.ExternalApproval
                || task.StatusId == (int)ApprovalNodeOrder.PendingModification
                || process.StatusId == (int)ApprovalNodeOrder.ExternalApproval
                || process.StatusId == (int)ApprovalNodeOrder.PendingModification
            let statusText = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "ApprovalNodeOrder"
                    && dictionary.Code == displayStatusCode)
                .Select(dictionary => new
                {
                    Display = isArabicLanguage && dictionary.NameAr != null && dictionary.NameAr != string.Empty
                        ? dictionary.NameAr
                        : dictionary.NameEn ?? dictionary.Code,
                    English = dictionary.NameEn ?? dictionary.Code
                })
                .FirstOrDefault()
            let establishmentName = (
                from link in dbContext.UserEstablishments
                join establishment in dbContext.Establishments
                    on link.EstablishmentId equals establishment.Id
                where link.UserProfileId == application.ProfileId
                orderby link.Id
                select isArabicLanguage
                    ? establishment.NameAr ?? establishment.NameEn
                    : establishment.NameEn ?? establishment.NameAr)
                .FirstOrDefault()
            let fullAssigneeName = ((assignee.FirstName ?? string.Empty)
                + " "
                + (assignee.LastName ?? string.Empty)).Trim()
            let latestDutyStatus = dbContext.TeamMemberDutyStatusRecords
                .Where(duty =>
                    duty.DepartmentId == LicensingDepartmentId
                    && duty.UserId == task.Assignee)
                .OrderByDescending(duty => duty.CreatedOn)
                .ThenByDescending(duty => duty.Id)
                .Select(duty => duty.StatusType)
                .FirstOrDefault()
            where (sourceEntityIds == null || sourceEntityIds.Contains(application.Id))
                  && task.ApprovalDepartment == LicensingDepartmentId
                  && (completedView
                        ? (task.ApprovalAt.HasValue && !isForceTodoStatus)
                        : (!task.ApprovalAt.HasValue || isForceTodoStatus))
                  // A newer task normally supersedes the Licensing task. For completed
                  // 1201 applications, a Content handoff preserves the Licensing history, while a
                  // newer Licensing task still supersedes the older row.
                  && !(from otherTask in dbContext.CamundaTasks
                       join otherProcess in dbContext.CamundaProcessInstances
                           on otherTask.ProcessInstanceId equals otherProcess.ProcessInstanceId
                       where otherProcess.ApplicationId == application.Id
                             && (otherTask.CreatedTime > task.CreatedTime
                                 || (otherTask.CreatedTime == task.CreatedTime && otherTask.Id > task.Id))
                             && (!completedView
                                 || application.ServiceCode != TransferDepartmentServiceCode
                                 || otherTask.ApprovalDepartment == LicensingDepartmentId)
                       select otherTask.Id).Any()
            select new LicensingTaskQueryRow
            {
                SourceType = LicensingTeamManagementConstants.SourceApplication,
                SourceId = task.TaskId,
                TaskNo = application.ApplicationNumber,
                Category =
                    service != null
                    && ((service.NameEn != null && service.NameEn.ToLower().Contains("profile"))
                        || (service.Code != null && service.Code.ToLower().Contains("profile")))
                        ? LicensingTeamManagementConstants.CategoryProfileVerifications
                        : LicensingTeamManagementConstants.CategoryApplications,
                ApplyFor = profile == null
                    ? string.Empty
                    : profile.UserTypeId == 1
                        ? isArabicLanguage
                            ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                            : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                        : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                AssignedUserId = task.Assignee,
                AssignedTo = fullAssigneeName != string.Empty
                    ? fullAssigneeName
                    : assignee.UserName ?? string.Empty,
                RawStatusCode = statusCode,
                StatusFilterCode = WorkflowStatusDomain + ":" + statusCode,
                StatusText = statusText == null ? displayStatusCode : statusText.Display,
                StatusDisplayOnly = statusText == null ? displayStatusCode : statusText.English,
                LastUpdatedOn = task.ApprovalAt ?? task.CreatedTime,
                DueOn = statusId.HasValue && statusId.Value == (int)ApprovalNodeOrder.ExternalApproval
                    ? null
                    : task.DueDate,
                CreatedOn = task.CreatedTime,
                HasNoSlaSort = !task.DueDate.HasValue
                    || (statusId.HasValue && statusId.Value == (int)ApprovalNodeOrder.ExternalApproval),
                IsExternalApprovalSort = statusId.HasValue
                    && statusId.Value == (int)ApprovalNodeOrder.ExternalApproval,
                IsUrgentSort = !task.ApprovalAt.HasValue
                    && statusId.HasValue
                    && statusId.Value != (int)ApprovalNodeOrder.ExternalApproval
                    && task.DueDate.HasValue
                    && latestDutyStatus == LicensingTeamManagementConstants.DutyStatusEmergencyLeave
                    && task.DueDate.Value <= urgentDueBefore,
                CanReassign = !task.ApprovalAt.HasValue
                    && statusId.HasValue
                    && !isReassignBlockedStatus,
                DetailTarget = "applications/" + application.Id + "?taskId=" + task.TaskId
            };
    }

    private static IQueryable<LicensingTaskQueryRow> BuildProfileVerificationRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        int[]? sourceEntityIds = null)
    {
        var underReview = (short)UserProfileStatusEnum.UnderReview;
        var approved = (short)UserProfileStatusEnum.Approved;
        var expired = (short)UserProfileStatusEnum.Expired;

        return
            from profile in dbContext.UserProfiles.AsNoTracking()
            join person in dbContext.Persons.AsNoTracking()
                on profile.PersonId equals person.Id into personGroup
            from person in personGroup.DefaultIfEmpty()
            let pendingAssigneeUserId = dbContext.ProfileReviewAssignments
                .Where(assignment =>
                    assignment.ProfileId == profile.Id
                    && assignment.Status == ProfileReviewAssignmentStatuses.Pending)
                .OrderByDescending(assignment => assignment.AssignedAt)
                .ThenByDescending(assignment => assignment.Id)
                .Select(assignment => assignment.AssigneeUserId)
                .FirstOrDefault()
            let pendingAssignee = dbContext.AdminUsers
                .Where(user => user.Id == pendingAssigneeUserId)
                .Select(user => new
                {
                    user.Id,
                    DisplayName = ((user.FirstName ?? "") + " " + (user.LastName ?? "")).Trim() == string.Empty
                        ? user.UserName
                        : ((user.FirstName ?? "") + " " + (user.LastName ?? "")).Trim()
                })
                .FirstOrDefault()
            let statusCode = profile.Status
            let statusText = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "UserProfileStatus_Admin"
                    && dictionary.Code == statusCode)
                .Select(dictionary => new
                {
                    Display = isArabicLanguage && dictionary.NameAr != null && dictionary.NameAr != string.Empty
                        ? dictionary.NameAr
                        : dictionary.NameEn ?? dictionary.Code,
                    English = dictionary.NameEn ?? dictionary.Code
                })
                .FirstOrDefault()
            let establishmentName = (
                from link in dbContext.UserEstablishments
                join establishment in dbContext.Establishments
                    on link.EstablishmentId equals establishment.Id
                where link.UserProfileId == profile.Id
                orderby link.Id
                select isArabicLanguage
                    ? establishment.NameAr ?? establishment.NameEn
                    : establishment.NameEn ?? establishment.NameAr)
                .FirstOrDefault()
            let reviewCycle = dbContext.ProfileVerificationReviewCycles
                .Where(cycle => cycle.ProfileId == profile.Id)
                .OrderByDescending(cycle => cycle.CycleNumber)
                .FirstOrDefault()
            where (sourceEntityIds == null || sourceEntityIds.Contains(profile.Id))
                  && profile.Status != null
                  && profile.IsActive == true
                  && (completedView
                      ? Convert.ToInt16(profile.Status) >= approved
                        && Convert.ToInt16(profile.Status) < expired
                      : Convert.ToInt16(profile.Status) == underReview)
                  // Mirror GetUserApprovesAsync: exclude profiles whose user is an AdminUser
                  && !dbContext.AdminUsers.Any(admin => admin.Id == profile.UserId)
            select new LicensingTaskQueryRow
            {
                SourceType = LicensingTeamManagementConstants.SourceProfileVerification,
                SourceId = profile.Id.ToString(),
                TaskNo = profile.ProfileCode,
                Category = LicensingTeamManagementConstants.CategoryProfileVerifications,
                ApplyFor = profile.UserTypeId == 1
                    ? isArabicLanguage
                        ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                        : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                    : establishmentName ?? profile.EntityName ?? profile.ProfileCode ?? profile.Id.ToString(),
                ApplyForUserTypeId = profile.UserTypeId,
                AssignedUserId = pendingAssignee == null ? null : pendingAssignee.Id,
                AssignedTo = pendingAssignee == null ? null : pendingAssignee.DisplayName,
                RawStatusCode = statusCode,
                StatusFilterCode = LicensingTeamManagementConstants.SourceProfileVerification + ":" + statusCode,
                StatusText = statusText == null ? statusCode : statusText.Display,
                StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                LastUpdatedOn = reviewCycle == null ? profile.UpdateOn ?? profile.CreatedOn : reviewCycle.SubmittedAt,
                DueOn = reviewCycle == null ? null : reviewCycle.DueAt,
                CreatedOn = reviewCycle == null ? profile.CreatedOn : reviewCycle.SubmittedAt,
                HasNoSlaSort = false,
                IsExternalApprovalSort = false,
                IsUrgentSort = false,
                CanReassign = Convert.ToInt16(profile.Status) == underReview
                    && dbContext.ProfileVerificationReviewCycles.Any(cycle =>
                        cycle.ProfileId == profile.Id
                        && cycle.Status == ProfileVerificationReviewCycleStatuses.Active),
                DetailTarget ="licensing/Profile/ProfileDetails?id=" + profile.Id + "&applicationNo=" + profile.ProfileCode + "&userTypeId="+ profile.UserTypeId
            };
    }

    private static IQueryable<LicensingTaskQueryRow> BuildEnquiryRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? sourceEntityIds = null)
    {
        var processingStatus = (short)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessing;
        var processedStatus = (int)EnquiryEnum.EnquiryAdminStatus.DepartmentProcessed;

        if (!completedView)
        {
            return
                from enquiry in dbContext.Enquiries.AsNoTracking()
                join assignee in dbContext.AdminUsers.AsNoTracking()
                on enquiry.HandlerUserId equals assignee.Id into assigneeGroup
                from assignee in assigneeGroup.DefaultIfEmpty()
                join createdUser in dbContext.Users.AsNoTracking()
                on enquiry.CreatedBy equals createdUser.Id into createdUserGroup
                from createdUser in createdUserGroup.DefaultIfEmpty()
                join createdAdmin in dbContext.AdminUsers.AsNoTracking()
                on enquiry.CreatedBy equals createdAdmin.Id into createdAdminGroup
                from createdAdmin in createdAdminGroup.DefaultIfEmpty()
                join enqProfile in dbContext.UserProfiles.AsNoTracking()
                on enquiry.UserProfileId equals (int?)enqProfile.Id into enqProfileGroup
                from enqProfile in enqProfileGroup.DefaultIfEmpty()
                join enqPerson in dbContext.Persons.AsNoTracking()
                on enqProfile.PersonId equals enqPerson.Id into enqPersonGroup
                from enqPerson in enqPersonGroup.DefaultIfEmpty()
                let enqEstablishmentName = (
                from link in dbContext.UserEstablishments
                join est in dbContext.Establishments
                on link.EstablishmentId equals est.Id
                where link.UserProfileId == enquiry.UserProfileId
                orderby link.Id
                select isArabicLanguage
                ? est.NameAr ?? est.NameEn
                : est.NameEn ?? est.NameAr)
                .FirstOrDefault()
                let statusCode = enquiry.EnquiryStatusId.ToString()
                let statusText = dbContext.TypeDictionaries
                    .Where(dictionary =>
                        dictionary.Scope == "InquiryStatusAdmin"
                        && dictionary.Code == statusCode)
                    .Select(dictionary => new
                    {
                        Display = isArabicLanguage && dictionary.NameAr != null && dictionary.NameAr != string.Empty
                            ? dictionary.NameAr
                            : dictionary.NameEn ?? dictionary.Code,
                        English = dictionary.NameEn ?? dictionary.Code
                    })
                    .FirstOrDefault()
                let fullAssigneeName = ((assignee.FirstName ?? string.Empty)
                    + " "
                    + (assignee.LastName ?? string.Empty)).Trim()
                let fullCreatedByName = ((createdUser.FirstName ?? string.Empty)
                    + " "
                    + (createdUser.LastName ?? string.Empty)).Trim()
                let fullCreatedByAdminName = ((createdAdmin.FirstName ?? string.Empty)
                    + " "
                    + (createdAdmin.LastName ?? string.Empty)).Trim()
                let latestDutyStatus = dbContext.TeamMemberDutyStatusRecords
                    .Where(duty =>
                        duty.DepartmentId == LicensingDepartmentId
                        && duty.UserId == enquiry.HandlerUserId)
                    .OrderByDescending(duty => duty.CreatedOn)
                    .ThenByDescending(duty => duty.Id)
                    .Select(duty => duty.StatusType)
                    .FirstOrDefault()
                where (sourceEntityIds == null || sourceEntityIds.Contains(enquiry.Id))
                      && enquiry.DepartmentId == LicensingDepartmentId
                      && !EnquiryCompletedStatusIds.Contains(enquiry.EnquiryStatusId)
                select new LicensingTaskQueryRow
                {
                    SourceType = LicensingTeamManagementConstants.SourceEnquiry,
                    SourceId = enquiry.Id.ToString(),
                    TaskNo = enquiry.EnquiryNumber,
                    Category = LicensingTeamManagementConstants.CategoryEnquiries,
                    ApplyFor = enqProfile != null
                    ? enqProfile.UserTypeId == 1
                    ? isArabicLanguage
                    ? enqPerson.NameAr ?? enqPerson.Name ?? enqProfile.ProfileCode ?? enquiry.CreatedBy
                    : enqPerson.Name ?? enqPerson.NameAr ?? enqProfile.ProfileCode ?? enquiry.CreatedBy
                    : enqEstablishmentName ?? enqProfile.ProfileCode ?? enquiry.CreatedBy
                    : (fullCreatedByName != string.Empty ? fullCreatedByName : null)
                    ?? createdUser.UserName
                    ?? (fullCreatedByAdminName != string.Empty ? fullCreatedByAdminName : null)
                    ?? createdAdmin.UserName
                    ?? enquiry.CreatedBy,
                    ApplyForUserTypeId = enqProfile != null ? enqProfile.UserTypeId : (int?)null,
                    AssignedUserId = enquiry.HandlerUserId,
                    AssignedTo = fullAssigneeName != string.Empty
                        ? fullAssigneeName
                        : assignee.UserName ?? string.Empty,
                    RawStatusCode = statusCode,
                    StatusFilterCode = LicensingTeamManagementConstants.SourceEnquiry + ":" + statusCode,
                    StatusText = statusText == null ? statusCode : statusText.Display,
                    StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                    LastUpdatedOn = enquiry.UpdatedOn ?? enquiry.CreatedOn,
                    DueOn = enquiry.SLAEndTime,
                    CreatedOn = enquiry.CreatedOn,
                    HasNoSlaSort = !enquiry.SLAEndTime.HasValue,
                    IsExternalApprovalSort = false,
                    IsUrgentSort = enquiry.SLAEndTime.HasValue
                        && latestDutyStatus == LicensingTeamManagementConstants.DutyStatusEmergencyLeave
                        && enquiry.SLAEndTime.Value <= urgentDueBefore,
                    CanReassign = true,
                    DetailTarget = "happiness/tickets/tickets-details?id=" + enquiry.Id
                };
        }

        var licensingUserIds = dbContext.UserDepartments.AsNoTracking()
            .Where(userDepartment => userDepartment.DepartmentId == LicensingDepartmentId)
            .Select(userDepartment => userDepartment.UserId);
        var licensingProcessedTrackings = dbContext.EnquiryStatusTracking.AsNoTracking()
            .Where(tracking =>
                tracking.ToStatusId == processedStatus
                && tracking.CreatedBy != null
                && licensingUserIds.Contains(tracking.CreatedBy));

        return
            from enquiry in dbContext.Enquiries.AsNoTracking()
            let latestLicensingProcessedTracking = (
                from tracking in licensingProcessedTrackings
                where tracking.EnquiryId == enquiry.Id
                orderby tracking.CreatedOn descending, tracking.Id descending
                select new
                {
                    OwnerId = tracking.HandlerUserId ?? tracking.CreatedBy ?? string.Empty,
                    tracking.CreatedOn
                })
                .FirstOrDefault()
            let isLicensingCurrentOwner = enquiry.DepartmentId == LicensingDepartmentId
            let isCurrentlyProcessingInLicensing = isLicensingCurrentOwner
                                                  && enquiry.EnquiryStatusId == processingStatus
            let ownerId = latestLicensingProcessedTracking == null
                ? enquiry.HandlerUserId ?? enquiry.CreatedBy ?? string.Empty
                : latestLicensingProcessedTracking.OwnerId
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on ownerId equals assignee.Id into assigneeGroup
            from assignee in assigneeGroup.DefaultIfEmpty()
            join createdUser in dbContext.Users.AsNoTracking()
            on enquiry.CreatedBy equals createdUser.Id into createdUserGroup
            from createdUser in createdUserGroup.DefaultIfEmpty()
            join createdAdmin in dbContext.AdminUsers.AsNoTracking()
            on enquiry.CreatedBy equals createdAdmin.Id into createdAdminGroup
            from createdAdmin in createdAdminGroup.DefaultIfEmpty()
            join enqProfile2 in dbContext.UserProfiles.AsNoTracking()
            on enquiry.UserProfileId equals (int?)enqProfile2.Id into enqProfileGroup2
            from enqProfile2 in enqProfileGroup2.DefaultIfEmpty()
            join enqPerson2 in dbContext.Persons.AsNoTracking()
            on enqProfile2.PersonId equals enqPerson2.Id into enqPersonGroup2
            from enqPerson2 in enqPersonGroup2.DefaultIfEmpty()
            let enqEstablishmentName2 = (
            from link in dbContext.UserEstablishments
            join est in dbContext.Establishments
            on link.EstablishmentId equals est.Id
            where link.UserProfileId == enquiry.UserProfileId
            orderby link.Id
            select isArabicLanguage
            ? est.NameAr ?? est.NameEn
            : est.NameEn ?? est.NameAr)
            .FirstOrDefault()
            let statusCode = enquiry.EnquiryStatusId.ToString()
            let statusText = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "InquiryStatusAdmin"
                    && dictionary.Code == statusCode)
                .Select(dictionary => new
                {
                    Display = isArabicLanguage && dictionary.NameAr != null && dictionary.NameAr != string.Empty
                        ? dictionary.NameAr
                        : dictionary.NameEn ?? dictionary.Code,
                    English = dictionary.NameEn ?? dictionary.Code
                })
                .FirstOrDefault()
            let fullAssigneeName = ((assignee.FirstName ?? string.Empty)
                + " "
                + (assignee.LastName ?? string.Empty)).Trim()
            let fullCreatedByName = ((createdUser.FirstName ?? string.Empty)
                + " "
                + (createdUser.LastName ?? string.Empty)).Trim()
            let fullCreatedByAdminName = ((createdAdmin.FirstName ?? string.Empty)
                + " "
                + (createdAdmin.LastName ?? string.Empty)).Trim()
            where (sourceEntityIds == null || sourceEntityIds.Contains(enquiry.Id))
                  && !isCurrentlyProcessingInLicensing
                  && (latestLicensingProcessedTracking != null || isLicensingCurrentOwner)
            select new LicensingTaskQueryRow
            {
                SourceType = LicensingTeamManagementConstants.SourceEnquiry,
                SourceId = enquiry.Id + ":completed:" + ownerId,
                TaskNo = enquiry.EnquiryNumber,
                Category = LicensingTeamManagementConstants.CategoryEnquiries,
                ApplyFor = enqProfile2 != null
                ? enqProfile2.UserTypeId == 1
                ? isArabicLanguage
                ? enqPerson2.NameAr ?? enqPerson2.Name ?? enqProfile2.ProfileCode ?? enquiry.CreatedBy
                : enqPerson2.Name ?? enqPerson2.NameAr ?? enqProfile2.ProfileCode ?? enquiry.CreatedBy
                : enqEstablishmentName2 ?? enqProfile2.ProfileCode ?? enquiry.CreatedBy
                : (fullCreatedByName != string.Empty ? fullCreatedByName : null)
                ?? createdUser.UserName
                ?? (fullCreatedByAdminName != string.Empty ? fullCreatedByAdminName : null)
                ?? createdAdmin.UserName
                ?? enquiry.CreatedBy,
                ApplyForUserTypeId = enqProfile2 != null ? enqProfile2.UserTypeId : (int?)null,
                AssignedUserId = ownerId,
                AssignedTo = fullAssigneeName != string.Empty
                    ? fullAssigneeName
                    : assignee.UserName ?? ownerId,
                RawStatusCode = statusCode,
                StatusFilterCode = LicensingTeamManagementConstants.SourceEnquiry + ":" + statusCode,
                StatusText = statusText == null ? statusCode : statusText.Display,
                StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                LastUpdatedOn = enquiry.UpdatedOn
                    ?? (latestLicensingProcessedTracking == null
                        ? null
                        : (DateTime?)latestLicensingProcessedTracking.CreatedOn)
                    ?? enquiry.CreatedOn,
                DueOn = enquiry.SLAEndTime,
                CreatedOn = enquiry.CreatedOn,
                HasNoSlaSort = !enquiry.SLAEndTime.HasValue,
                IsExternalApprovalSort = false,
                IsUrgentSort = false,
                CanReassign = false,
                DetailTarget = "happiness/tickets/tickets-details?id=" + enquiry.Id
            };
    }

    private static IQueryable<LicensingTaskQueryRow> BuildRefundRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? sourceEntityIds = null)
    {
        return
            from refund in dbContext.Refunds.AsNoTracking()
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on refund.HandlerUserId equals assignee.Id into assigneeGroup
            from assignee in assigneeGroup.DefaultIfEmpty()
            join profile in dbContext.UserProfiles.AsNoTracking()
                on refund.ProfileId equals (int?)profile.Id into profileGroup
            from profile in profileGroup.DefaultIfEmpty()
            join person in dbContext.Persons.AsNoTracking()
                on profile.PersonId equals person.Id into personGroup
            from person in personGroup.DefaultIfEmpty()
            let statusCode = refund.StatusId.ToString()
            let statusText = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "Refund Status"
                    && dictionary.Code == statusCode)
                .Select(dictionary => new
                {
                    Display = isArabicLanguage && dictionary.NameAr != null && dictionary.NameAr != string.Empty
                        ? dictionary.NameAr
                        : dictionary.NameEn ?? dictionary.Code,
                    English = dictionary.NameEn ?? dictionary.Code
                })
                .FirstOrDefault()
            let establishmentName = (
                from link in dbContext.UserEstablishments
                join establishment in dbContext.Establishments
                    on link.EstablishmentId equals establishment.Id
                where link.UserProfileId == refund.ProfileId
                orderby link.Id
                select isArabicLanguage
                    ? establishment.NameAr ?? establishment.NameEn
                    : establishment.NameEn ?? establishment.NameAr)
                .FirstOrDefault()
            let fullAssigneeName = ((assignee.FirstName ?? string.Empty)
                + " "
                + (assignee.LastName ?? string.Empty)).Trim()
            let latestDutyStatus = dbContext.TeamMemberDutyStatusRecords
                .Where(duty =>
                    duty.DepartmentId == LicensingDepartmentId
                    && duty.UserId == refund.HandlerUserId)
                .OrderByDescending(duty => duty.CreatedOn)
                .ThenByDescending(duty => duty.Id)
                .Select(duty => duty.StatusType)
                .FirstOrDefault()
            where (sourceEntityIds == null || sourceEntityIds.Contains(refund.Id))
                  && refund.ReferenceDepartmentId == LicensingDepartmentId
                  && (completedView
                      ? RefundCompletedStatusIds.Contains(refund.StatusId)
                      : !RefundCompletedStatusIds.Contains(refund.StatusId))
            select new LicensingTaskQueryRow
            {
                SourceType = LicensingTeamManagementConstants.SourceRefund,
                SourceId = refund.Id.ToString(),
                TaskNo = refund.ApplicationNumber
                    ?? refund.ReferenceNumber
                    ?? refund.TransactionNo
                    ?? refund.Id.ToString(),
                Category = LicensingTeamManagementConstants.CategoryRefunds,
                ApplyFor = refund.ProfileId.HasValue
                    ? profile == null
                        ? refund.UserId
                        : profile.UserTypeId == 1
                            ? isArabicLanguage
                                ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                                : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                            : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString()
                    : refund.UserId,
                ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                AssignedUserId = refund.HandlerUserId,
                AssignedTo = fullAssigneeName != string.Empty
                    ? fullAssigneeName
                    : assignee.UserName ?? string.Empty,
                RawStatusCode = statusCode,
                StatusFilterCode = LicensingTeamManagementConstants.SourceRefund + ":" + statusCode,
                StatusText = statusText == null ? statusCode : statusText.Display,
                StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                LastUpdatedOn = refund.UpdateOn,
                DueOn = refund.SLAEndTime,
                CreatedOn = refund.CreatedOn,
                HasNoSlaSort = !refund.SLAEndTime.HasValue,
                IsExternalApprovalSort = false,
                IsUrgentSort = !RefundCompletedStatusIds.Contains(refund.StatusId)
                    && refund.SLAEndTime.HasValue
                    && latestDutyStatus == LicensingTeamManagementConstants.DutyStatusEmergencyLeave
                    && refund.SLAEndTime.Value <= urgentDueBefore,
                CanReassign = !RefundCompletedStatusIds.Contains(refund.StatusId),
                DetailTarget = "finance/refunds/" + (refund.ReferenceNumber ?? refund.Id.ToString())
            };
    }

    private static IQueryable<LicensingTaskQueryRow> BuildAppealRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? sourceEntityIds = null)
    {
        return
            from appeal in dbContext.InspectionViolationAppeals.AsNoTracking()
            join violationSnapshot in dbContext.Set<InspectionViolationSourceSnapshot>().AsNoTracking()
            on appeal.ViolationId equals violationSnapshot.ViolationId into snapshotGroup
            from violationSnapshot in snapshotGroup.DefaultIfEmpty()
            join appealPerson in dbContext.Persons.AsNoTracking()
            on violationSnapshot.IndividualId equals (int?)appealPerson.Id into appealPersonGroup
            from appealPerson in appealPersonGroup.DefaultIfEmpty()
            join appealEstablishment in dbContext.Establishments.AsNoTracking()
            on violationSnapshot.EstablishmentId equals (int?)appealEstablishment.Id into appealEstGroup
            from appealEstablishment in appealEstGroup.DefaultIfEmpty()
            let latestTarget = appeal.TimelineEvents
                .Where(timeline =>
                    (timeline.TargetHandlerUserId != null && timeline.TargetHandlerUserId.Trim() != string.Empty)
                    || (timeline.TargetDepartmentName != null && timeline.TargetDepartmentName.Trim() != string.Empty)
                    || (timeline.TargetDepartmentCode != null && timeline.TargetDepartmentCode.Trim() != string.Empty))
                .OrderByDescending(timeline => timeline.CreatedOn)
                .ThenByDescending(timeline => timeline.Id)
                .Select(timeline => new
                {
                    timeline.TargetHandlerUserId,
                    timeline.TargetHandlerUserName
                })
                .FirstOrDefault()
            let assignedUserId = latestTarget == null ? null : latestTarget.TargetHandlerUserId
            let storedAssigneeName = latestTarget == null ? null : latestTarget.TargetHandlerUserName
            let fallbackAssigneeName = dbContext.AdminUsers
                .Where(user => user.Id == assignedUserId)
                .Select(user => ((user.FirstName ?? string.Empty)
                        + " "
                        + (user.LastName ?? string.Empty)).Trim() != string.Empty
                    ? ((user.FirstName ?? string.Empty)
                        + " "
                        + (user.LastName ?? string.Empty)).Trim()
                    : user.UserName)
                .FirstOrDefault()
            let latestDutyStatus = dbContext.TeamMemberDutyStatusRecords
                .Where(duty =>
                    duty.DepartmentId == LicensingDepartmentId
                    && duty.UserId == assignedUserId)
                .OrderByDescending(duty => duty.CreatedOn)
                .ThenByDescending(duty => duty.Id)
                .Select(duty => duty.StatusType)
                .FirstOrDefault()
            where (sourceEntityIds == null || sourceEntityIds.Contains(appeal.Id))
                  && appeal.TimelineEvents.Any(timeline =>
                      timeline.TargetDepartmentCode == null
                      || timeline.TargetDepartmentCode == "LICENSING"
                      || timeline.TargetDepartmentName == "Licensing")
                  && (completedView
                      ? AppealCompletedStatusIds.Contains(appeal.StatusId)
                      : !AppealCompletedStatusIds.Contains(appeal.StatusId))
            select new LicensingTaskQueryRow
            {
                SourceType = LicensingTeamManagementConstants.SourceAppeal,
                SourceId = appeal.Id.ToString(),
                TaskNo = appeal.AppealNo,
                Category = LicensingTeamManagementConstants.CategoryAppeals,
                ApplyFor = appealPerson != null
                ? isArabicLanguage
                ? appealPerson.NameAr ?? appealPerson.Name ?? (appeal.Violation == null ? null : appeal.Violation.ViolatorName)
                : appealPerson.Name ?? appealPerson.NameAr ?? (appeal.Violation == null ? null : appeal.Violation.ViolatorName)
                : appealEstablishment != null
                ? isArabicLanguage
                ? appealEstablishment.NameAr ?? appealEstablishment.NameEn ?? (appeal.Violation == null ? null : appeal.Violation.ViolatorName)
                : appealEstablishment.NameEn ?? appealEstablishment.NameAr ?? (appeal.Violation == null ? null : appeal.Violation.ViolatorName)
                : appeal.Violation == null ? null : appeal.Violation.ViolatorName,
                ApplyForUserTypeId = violationSnapshot != null
                ? violationSnapshot.IndividualId != null ? 1 : violationSnapshot.EstablishmentId != null ? (int?)2 : null
                : null,
                AssignedUserId = assignedUserId,
                AssignedTo = storedAssigneeName != null && storedAssigneeName != string.Empty
                    ? storedAssigneeName
                    : fallbackAssigneeName ?? string.Empty,
                RawStatusCode = appeal.StatusId.ToString(),
                StatusFilterCode = LicensingTeamManagementConstants.SourceAppeal + ":" + appeal.StatusId,
                StatusText = appeal.StatusId == (int)InspectionAppealStatus.Pending
                    ? isArabicLanguage ? "قيد الانتظار" : "Pending"
                    : appeal.StatusId == (int)InspectionAppealStatus.DepartmentProcessing
                        ? isArabicLanguage ? "قيد المعالجة لدى الإدارة" : "Department Processing"
                        : appeal.StatusId == (int)InspectionAppealStatus.DepartmentProcessed
                            ? isArabicLanguage ? "تمت المعالجة لدى الإدارة" : "Department Processed"
                            : appeal.StatusId == (int)InspectionAppealStatus.PendingCustomer
                                ? isArabicLanguage ? "بانتظار المتعامل" : "Pending Customer"
                                : appeal.StatusId == (int)InspectionAppealStatus.Approved
                                    ? isArabicLanguage ? "معتمد" : "Approved"
                                    : appeal.StatusId == (int)InspectionAppealStatus.Rejected
                                        ? isArabicLanguage ? "مرفوض" : "Rejected"
                                        : appeal.StatusId == (int)InspectionAppealStatus.Cancelled
                                            ? isArabicLanguage ? "ملغي" : "Cancelled"
                                            : appeal.StatusId == (int)InspectionAppealStatus.Resolved
                                                ? isArabicLanguage ? "تم الحل" : "Resolved"
                                                : appeal.StatusId.ToString(),
                StatusDisplayOnly = appeal.StatusId == (int)InspectionAppealStatus.Pending
                    ? "Pending"
                    : appeal.StatusId == (int)InspectionAppealStatus.DepartmentProcessing
                        ? "Department Processing"
                        : appeal.StatusId == (int)InspectionAppealStatus.DepartmentProcessed
                            ? "Department Processed"
                            : appeal.StatusId == (int)InspectionAppealStatus.PendingCustomer
                                ? "Pending Customer"
                                : appeal.StatusId == (int)InspectionAppealStatus.Approved
                                    ? "Approved"
                                    : appeal.StatusId == (int)InspectionAppealStatus.Rejected
                                        ? "Rejected"
                                        : appeal.StatusId == (int)InspectionAppealStatus.Cancelled
                                            ? "Cancelled"
                                            : appeal.StatusId == (int)InspectionAppealStatus.Resolved
                                                ? "Resolved"
                                                : appeal.StatusId.ToString(),
                LastUpdatedOn = appeal.LastUpdatedOn,
                DueOn = appeal.SlaDueOn,
                CreatedOn = appeal.CreatedOn,
                HasNoSlaSort = !appeal.SlaDueOn.HasValue,
                IsExternalApprovalSort = false,
                IsUrgentSort = !AppealCompletedStatusIds.Contains(appeal.StatusId)
                    && appeal.SlaDueOn.HasValue
                    && latestDutyStatus == LicensingTeamManagementConstants.DutyStatusEmergencyLeave
                    && appeal.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = !AppealCompletedStatusIds.Contains(appeal.StatusId),
                DetailTarget = "appeals/" + appeal.Id
            };
    }

}

/// <summary>
/// The language-dependent slice of <see cref="LicensingTaskQueryRow"/>. Everything else in the
/// projection is language-invariant, so the second (Arabic) sync pass only has to fetch these.
/// </summary>
internal sealed class LicensingTaskLocalizedRow
{
    public string SourceId { get; set; } = string.Empty;
    public string? ApplyFor { get; set; }
    public string? StatusText { get; set; }
}

internal sealed class LicensingTaskQueryRow
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string? TaskNo { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? ApplyFor { get; set; }
    public int? ApplyForUserTypeId { get; set; }
    public string? AssignedUserId { get; set; }
    public string? AssignedTo { get; set; }
    public string? RawStatusCode { get; set; }
    public string StatusFilterCode { get; set; } = string.Empty;
    public string? StatusText { get; set; }
    public string? StatusDisplayOnly { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public DateTime? DueOn { get; set; }
    public DateTime CreatedOn { get; set; }
    public bool HasNoSlaSort { get; set; }
    public bool IsExternalApprovalSort { get; set; }
    public bool IsUrgentSort { get; set; }
    public bool CanReassign { get; set; }
    public string? DetailTarget { get; set; }
}

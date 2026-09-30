using Microsoft.EntityFrameworkCore;
using UMC.AdminPortal.Application.Dtos.TeamManagement;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.Models;
using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Application.Services.ContentTeamManagement;

/// <summary>
/// Builds the Content team task list as one server-side read model.
/// Every source has the same projection so EF translates Concat to UNION ALL.
/// <para>
/// INVARIANT: every <see cref="ContentTeamTaskQueryRow"/> projection in this file must assign the
/// SAME set of properties, including the ones that are always null for that branch. EF Core cannot
/// translate a set operation whose sides differ in the properties they initialise -- it throws
/// "Unable to translate set operations when both sides don't assign values to the same properties
/// in the nominal type" at execution time, which takes the whole incremental read-model sync down
/// silently until the DirtyQueue backlog is noticed. Adding a property to the row type therefore
/// means adding it to EVERY projection below, not just the branch that has a real value for it.
/// </para>
/// </summary>
internal static class ContentTeamManagementTaskQuery
{
    private const int ContentDepartmentId = (int)DepartmentEnum.Content;
    private const string TransferDepartmentServiceCode = "1201";
    private const string WorkflowStatusDomain = "applicationWorkflow";
    private const string DispositionStatusDomain = "applicationDisposition";

    internal static IQueryable<ContentTeamTaskQueryRow> Build(
        AdminPortalDBContext dbContext,
        TeamManagementTaskQueryRequest request,
        bool applicationTaskOnly,
        bool isArabicLanguage,
        string? normalizedCategory,
        string? departmentCode,
        string? departmentName)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var completedView = string.Equals(
            request.View,
            TeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase);

        var query = completedView
            ? ProjectCompletedView(dbContext, isArabicLanguage, urgentDueBefore)
            : ProjectTodoView(dbContext, isArabicLanguage, urgentDueBefore);

        if (applicationTaskOnly)
        {
            query = query.Where(row =>
                row.SourceType == TeamManagementConstants.SourceApplication);
        }

        return ApplyFilters(query, request, normalizedCategory);
    }

    // Retained during the Req 189 rollout as the result-equivalence oracle and rollback path.
    internal static IQueryable<ContentTeamTaskQueryRow> BuildLegacy(
        AdminPortalDBContext dbContext,
        TeamManagementTaskQueryRequest request,
        bool applicationTaskOnly,
        bool isArabicLanguage,
        string? normalizedCategory,
        string? departmentCode,
        string? departmentName)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var completedView = string.Equals(
            request.View,
            TeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase);

        var applicationQuery = SelectLatestApplicationRows(
            BuildWorkflowApplicationRows(dbContext, completedView, isArabicLanguage, urgentDueBefore)
                .Concat(BuildDispositionApplicationRows(dbContext, completedView, isArabicLanguage)));
        IQueryable<ContentTeamTaskQueryRow> query;
        if (applicationTaskOnly)
        {
            query = normalizedCategory == null
                    || normalizedCategory == TeamManagementConstants.CategoryAll
                    || normalizedCategory == TeamManagementConstants.CategoryApplications
                ? applicationQuery
                : applicationQuery.Where(_ => false);
        }
        else
        {
            query = normalizedCategory switch
            {
                TeamManagementConstants.CategoryApplications => applicationQuery,
                TeamManagementConstants.CategoryEnquiries =>
                    BuildEnquiryRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                TeamManagementConstants.CategoryRefunds =>
                    BuildRefundRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                TeamManagementConstants.CategoryAppeals =>
                    BuildAppealRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                TeamManagementConstants.CategoryViolations =>
                    BuildViolationRows(dbContext, completedView, isArabicLanguage, urgentDueBefore),
                _ => applicationQuery
                    .Concat(BuildEnquiryRows(dbContext, completedView, isArabicLanguage, urgentDueBefore))
                    .Concat(BuildRefundRows(dbContext, completedView, isArabicLanguage, urgentDueBefore))
                    .Concat(BuildAppealRows(
                        dbContext,
                        completedView,
                        isArabicLanguage,
                        urgentDueBefore))
                    .Concat(BuildViolationRows(
                        dbContext,
                        completedView,
                        isArabicLanguage,
                        urgentDueBefore))
            };
        }

        return ApplyFilters(query, request, normalizedCategory);
    }
 

    /// <summary>
    /// Batch slice of the authoritative projection for ONE source type and a set of source keys.
    /// The keys are pushed down as an IN list on the base table primary key, so the batch stays
    /// index-seekable. Never route the incremental sync through the UNION ALL read views: a
    /// LIKE/EXISTS filter on those cannot seek, so every batch would rebuild each source branch
    /// over the whole table regardless of how few keys are dirty.
    /// </summary>
    internal static IQueryable<ContentTeamTaskQueryRow> BuildLegacyForSources(
        AdminPortalDBContext dbContext,
        TeamManagementTaskQueryRequest request,
        bool isArabicLanguage,
        string sourceType,
        int[] sourceEntityIds,
        string category)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var completedView = string.Equals(
            request.View,
            TeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase);

        var query = sourceType switch
        {
            TeamManagementConstants.SourceApplication => SelectLatestApplicationRows(
                BuildWorkflowApplicationRows(
                        dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds)
                    .Concat(BuildDispositionApplicationRows(
                        dbContext, completedView, isArabicLanguage, sourceEntityIds))),
            TeamManagementConstants.SourceEnquiry =>
                BuildEnquiryRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            TeamManagementConstants.SourceRefund =>
                BuildRefundRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            TeamManagementConstants.SourceAppeal =>
                BuildAppealRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            TeamManagementConstants.SourceViolation =>
                BuildViolationRows(
                    dbContext, completedView, isArabicLanguage, urgentDueBefore, sourceEntityIds),
            _ => throw new ArgumentOutOfRangeException(nameof(sourceType), sourceType, "Unsupported source type.")
        };

        // Deliberately NOT ApplyFilters: this is the PROJECTION path, not a query path. The read
        // table must hold every row the source owns; the request only carries View here, so folding
        // in the query filters is currently a no-op but would silently under-write rows the moment
        // TeamManagementTaskQueryRequest gains a non-empty default filter (a missing row would then
        // only be repaired by the nightly rebuild). Keeps this symmetric with the Licensing side.
        return query;
    }
 
    /// <summary>
    /// Arabic companion of <see cref="BuildLegacyForSources"/>, for the incremental sync only.
    /// The read table stores both languages per row, but ONLY ApplyFor and StatusText depend on the
    /// language -- the other 20 columns are byte-identical between the two passes. Composing a
    /// narrow Select over the SAME query lets the provider prune the joins and correlated
    /// subqueries that fed nothing but the dropped columns; measured against SQL Server the Arabic
    /// statement shrinks to 11%-74% of the full projection depending on source type. Narrowing the
    /// existing query rather than hand-writing an Arabic one keeps ONE source of truth for the
    /// business rules -- the language pass can never drift from the English pass.
    /// </summary>
    internal static IQueryable<ContentTeamTaskLocalizedRow> BuildArabicTextForSources(
        AdminPortalDBContext dbContext,
        TeamManagementTaskQueryRequest request,
        string sourceType,
        int[] sourceEntityIds,
        string category)
        => BuildLegacyForSources(
                dbContext, request, isArabicLanguage: true, sourceType, sourceEntityIds, category)
            .Select(row => new ContentTeamTaskLocalizedRow
            {
                SourceId = row.SourceId,
                ApplyFor = row.ApplyFor,
                StatusText = row.StatusText
            });

    /// <summary>
    /// OPS-04 read path targeting the materialized table ReadModel.ContentTeamTaskRead.
    /// Shares the row shape and the runtime-computed columns (language pick, urgent flag) with
    /// <see cref="Build"/>, so switching the canary between table and views cannot change results
    /// beyond the freshness of the underlying rows.
    /// </summary>
    internal static IQueryable<ContentTeamTaskQueryRow> BuildFromReadTable(
        AdminPortalDBContext dbContext,
        TeamManagementTaskQueryRequest request,
        bool applicationTaskOnly,
        bool isArabicLanguage,
        string? normalizedCategory)
    {
        var urgentDueBefore = DateTimeHelper.Now.AddHours(24);
        var viewType = string.Equals(
            request.View,
            TeamManagementConstants.ViewCompleted,
            StringComparison.OrdinalIgnoreCase)
            ? TeamManagementConstants.ViewCompleted
            : TeamManagementConstants.ViewTodo;

        var query = ProjectReadTable(dbContext, viewType, isArabicLanguage, urgentDueBefore);

        if (applicationTaskOnly)
        {
            query = query.Where(row =>
                row.SourceType == TeamManagementConstants.SourceApplication);
        }

        return ApplyFilters(query, request, normalizedCategory);
    }

    /// <summary>
    /// Projects the physical read table into the shared query row. IsUrgentSort stays a runtime
    /// expression (never materialized) because it depends on "now", and IsEmergencyLeave is always
    /// stored as 0 by both the projection and the rebuild.
    /// </summary>
    private static IQueryable<ContentTeamTaskQueryRow> ProjectReadTable(
        AdminPortalDBContext dbContext,
        string viewType,
        bool isArabicLanguage,
        DateTime urgentDueBefore)
    {
        var rows = dbContext.Set<ContentTeamTaskReadRow>().AsNoTracking()
            .Where(row => row.ViewType == viewType);

        return isArabicLanguage
            ? rows.Select(row => new ContentTeamTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory, ApplyFor = row.ApplyForAr,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedToUserId = row.AssignedToUserId,
                AssignedToName = row.AssignedToName, StatusCode = row.StatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextAr,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DedupCreatedOn = row.LastUpdatedOn, DedupId = 0, DedupSourceRank = 0,
                SlaDueOn = row.SlaDueOn, UrgentEligible = row.UrgentEligible,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.SlaDueOn.HasValue && row.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            })
            : rows.Select(row => new ContentTeamTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory, ApplyFor = row.ApplyForEn,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedToUserId = row.AssignedToUserId,
                AssignedToName = row.AssignedToName, StatusCode = row.StatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextEn,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DedupCreatedOn = row.LastUpdatedOn, DedupId = 0, DedupSourceRank = 0,
                SlaDueOn = row.SlaDueOn, UrgentEligible = row.UrgentEligible,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.SlaDueOn.HasValue && row.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            });
    }

    private static IQueryable<ContentTeamTaskQueryRow> ProjectTodoView(
        AdminPortalDBContext dbContext,
        bool isArabicLanguage,
        DateTime urgentDueBefore)
    {
        var rows = dbContext.Set<ContentTeamTodoReadRow>().AsNoTracking();
        return isArabicLanguage
            ? rows.Select(row => new ContentTeamTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory, ApplyFor = row.ApplyForAr,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedToUserId = row.AssignedToUserId,
                AssignedToName = row.AssignedToName, StatusCode = row.StatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextAr,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DedupCreatedOn = row.LastUpdatedOn, DedupId = 0, DedupSourceRank = 0,
                SlaDueOn = row.SlaDueOn, UrgentEligible = row.UrgentEligible,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.SlaDueOn.HasValue && row.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            })
            : rows.Select(row => new ContentTeamTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory, ApplyFor = row.ApplyForEn,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedToUserId = row.AssignedToUserId,
                AssignedToName = row.AssignedToName, StatusCode = row.StatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextEn,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DedupCreatedOn = row.LastUpdatedOn, DedupId = 0, DedupSourceRank = 0,
                SlaDueOn = row.SlaDueOn, UrgentEligible = row.UrgentEligible,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.SlaDueOn.HasValue && row.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            });
    }

    private static IQueryable<ContentTeamTaskQueryRow> ProjectCompletedView(
        AdminPortalDBContext dbContext,
        bool isArabicLanguage,
        DateTime urgentDueBefore)
    {
        var rows = dbContext.Set<ContentTeamCompletedReadRow>().AsNoTracking();
        return isArabicLanguage
            ? rows.Select(row => new ContentTeamTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory, ApplyFor = row.ApplyForAr,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedToUserId = row.AssignedToUserId,
                AssignedToName = row.AssignedToName, StatusCode = row.StatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextAr,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DedupCreatedOn = row.LastUpdatedOn, DedupId = 0, DedupSourceRank = 0,
                SlaDueOn = row.SlaDueOn, UrgentEligible = row.UrgentEligible,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.SlaDueOn.HasValue && row.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            })
            : rows.Select(row => new ContentTeamTaskQueryRow
            {
                SourceType = row.SourceType, SourceId = row.SourceId, TaskNo = row.TaskNo,
                TaskCategory = row.TaskCategory, ApplyFor = row.ApplyForEn,
                ApplyForUserTypeId = row.ApplyForUserTypeId, AssignedToUserId = row.AssignedToUserId,
                AssignedToName = row.AssignedToName, StatusCode = row.StatusCode,
                StatusFilterCode = row.StatusFilterCode, StatusText = row.StatusTextEn,
                StatusDisplayOnly = row.StatusDisplayOnly, LastUpdatedOn = row.LastUpdatedOn,
                DedupCreatedOn = row.LastUpdatedOn, DedupId = 0, DedupSourceRank = 0,
                SlaDueOn = row.SlaDueOn, UrgentEligible = row.UrgentEligible,
                IsUrgentSort = row.UrgentEligible && row.IsEmergencyLeave &&
                               row.SlaDueOn.HasValue && row.SlaDueOn.Value <= urgentDueBefore,
                CanReassign = row.CanReassign, DetailTarget = row.DetailTarget
            });
    }

    private static IQueryable<ContentTeamTaskQueryRow> SelectLatestApplicationRows(
        IQueryable<ContentTeamTaskQueryRow> query)
    {
        // Keep the incremental projection aligned with the SQL views: both Todo and Completed
        // expose only the latest row for one application, otherwise the Worker can reinsert
        // duplicates immediately after a full read-table rebuild.
        return query.Where(row => !query.Any(other =>
            (other.TaskNo ?? other.SourceId) == (row.TaskNo ?? row.SourceId)
            && (other.LastUpdatedOn > row.LastUpdatedOn
                || (other.LastUpdatedOn == row.LastUpdatedOn
                    && other.DedupCreatedOn > row.DedupCreatedOn)
                || (other.LastUpdatedOn == row.LastUpdatedOn
                    && other.DedupCreatedOn == row.DedupCreatedOn
                    && other.DedupSourceRank > row.DedupSourceRank)
                || (other.LastUpdatedOn == row.LastUpdatedOn
                    && other.DedupCreatedOn == row.DedupCreatedOn
                    && other.DedupSourceRank == row.DedupSourceRank
                    && other.DedupId > row.DedupId))));
    }

    internal static IOrderedQueryable<ContentTeamTaskQueryRow> ApplySorting(
        IQueryable<ContentTeamTaskQueryRow> query,
        TeamManagementTaskQueryRequest request)
    {
        var isDefaultSort = string.IsNullOrWhiteSpace(request.SortBy)
            || string.Equals(request.SortBy.Trim(), "id", StringComparison.OrdinalIgnoreCase);
        var sortBy = isDefaultSort
            ? "default"
            : request.SortBy.Trim();
        var descending = isDefaultSort
            || request.SortDirection == SortDirection.Descending;
        var externalApprovalStatusFilter =
            WorkflowStatusDomain + ":" + (int)ApprovalNodeOrder.ExternalApproval;

        var ordered = sortBy.ToLowerInvariant() switch
        {
            "default" => query
                .OrderBy(row => row.StatusFilterCode == externalApprovalStatusFilter)
                .ThenByDescending(row => row.IsUrgentSort)
                .ThenBy(row => row.SlaDueOn == null)
                .ThenBy(row => row.SlaDueOn)
                .ThenByDescending(row => row.LastUpdatedOn),
            "sla" when descending => query
                .OrderBy(row => row.StatusFilterCode == externalApprovalStatusFilter)
                .ThenByDescending(row => row.IsUrgentSort)
                .ThenBy(row => row.SlaDueOn == null)
                .ThenBy(row => row.SlaDueOn)
                .ThenByDescending(row => row.LastUpdatedOn),
            "sla" => query
                .OrderByDescending(row => row.StatusFilterCode == externalApprovalStatusFilter)
                .ThenBy(row => row.SlaDueOn == null)
                .ThenByDescending(row => row.SlaDueOn)
                .ThenByDescending(row => row.LastUpdatedOn),
            "taskno" when descending => query
                .OrderByDescending(row => row.TaskNo)
                .ThenByDescending(row => row.LastUpdatedOn),
            "taskno" => query
                .OrderBy(row => row.TaskNo)
                .ThenByDescending(row => row.LastUpdatedOn),
            "assignedto" when descending => query
                .OrderByDescending(row => row.AssignedToName)
                .ThenByDescending(row => row.LastUpdatedOn),
            "assignedto" => query
                .OrderBy(row => row.AssignedToName)
                .ThenByDescending(row => row.LastUpdatedOn),
            "lastupdatedon" when descending => query
                .OrderByDescending(row => row.LastUpdatedOn)
                .ThenBy(row => row.TaskNo),
            "lastupdatedon" => query
                .OrderBy(row => row.LastUpdatedOn)
                .ThenBy(row => row.TaskNo),
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

    private static IQueryable<ContentTeamTaskQueryRow> ApplyFilters(
        IQueryable<ContentTeamTaskQueryRow> query,
        TeamManagementTaskQueryRequest request,
        string? normalizedCategory)
    {
        if (!string.IsNullOrWhiteSpace(request.Keyword))
        {
            var keyword = request.Keyword.Trim().ToLower();
            query = query.Where(row =>
                (row.TaskNo != null && row.TaskNo.ToLower().Contains(keyword))
                || (row.ApplyFor != null && row.ApplyFor.ToLower().Contains(keyword))
                || (row.AssignedToName != null && row.AssignedToName.ToLower().Contains(keyword))
                || (row.StatusText != null && row.StatusText.ToLower().Contains(keyword)));
        }

        if (!string.IsNullOrWhiteSpace(normalizedCategory)
            && normalizedCategory != TeamManagementConstants.CategoryAll)
        {
            query = query.Where(row => row.TaskCategory == normalizedCategory);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = request.Status.Trim().ToLower();
            // Terminal disposition rows render a COMPOSITE label ("Completed (Disposition
            // Verified)" and the three siblings), so a plain "completed"/"rejected" selection has
            // to match them by prefix or the 302 rows vanish from a filtered list. Both families
            // are covered: filtering on "rejected" previously dropped every terminal disposition
            // row whose case was rejected.
            var compositeCompleted = PostCertificateDispositionPolicy.VerifiedCompletedStatusEn.ToLower();
            var compositeNotCompleted = PostCertificateDispositionPolicy.NotVerifiedCompletedStatusEn.ToLower();
            var compositeRejected = PostCertificateDispositionPolicy.VerifiedRejectedStatusEn.ToLower();
            var compositeNotRejected = PostCertificateDispositionPolicy.NotVerifiedRejectedStatusEn.ToLower();
            query = query.Where(row =>
                row.StatusFilterCode.ToLower() == status
                || (row.StatusCode != null && row.StatusCode.ToLower() == status)
                || (row.StatusText != null && row.StatusText.ToLower() == status)
                || (status == "completed"
                    && row.StatusText != null
                    && (row.StatusText.ToLower() == compositeCompleted
                        || row.StatusText.ToLower() == compositeNotCompleted))
                || (status == "rejected"
                    && row.StatusText != null
                    && (row.StatusText.ToLower() == compositeRejected
                        || row.StatusText.ToLower() == compositeNotRejected)));
        }

        if (!string.IsNullOrWhiteSpace(request.MemberId))
        {
            var memberId = request.MemberId.Trim().ToLower();
            query = query.Where(row =>
                row.AssignedToUserId != null
                && row.AssignedToUserId.ToLower() == memberId);
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

        return query;
    }

    private static IQueryable<ContentTeamTaskQueryRow> BuildWorkflowApplicationRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? applicationIds = null)
    {
        var activeDispositionStatuses = new int?[]
        {
            (int)DispositionVerificationStatus.PendingDisposition,
            (int)DispositionVerificationStatus.DispositionVerification
        };
        var externalApprovalStatus = (int)ApprovalNodeOrder.ExternalApproval;
        // Align todo status logic with MyTeamTodoPage (IsTodoReviewItem): a task is
        // todo when its StatusId is not in the completed set and is not ExternalApproval.
        // Reuse the same source-of-truth set; project to int?[] so EF translates the
        // NOT IN against the nullable task.StatusId with null treated as todo.
        var completedTaskStatuses = Extensions.CompletedTaskStatus
            .Select(status => (int?)status)
            .ToArray();

        return
            from task in dbContext.CamundaTasks.AsNoTracking()
            join process in dbContext.CamundaProcessInstances.AsNoTracking()
                on task.ProcessInstanceId equals process.ProcessInstanceId
            join application in dbContext.Applications.AsNoTracking()
                on process.ApplicationId equals application.Id
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on task.Assignee equals assignee.Id into assigneeGroup
            from assignee in assigneeGroup.DefaultIfEmpty()
            join profile in dbContext.UserProfiles.AsNoTracking()
                on application.ProfileId equals profile.Id into profileGroup
            from profile in profileGroup.DefaultIfEmpty()
            join person in dbContext.Persons.AsNoTracking()
                on profile.PersonId equals person.Id into personGroup
            from person in personGroup.DefaultIfEmpty()
            let taskStatusId = task.StatusId
            let taskStatusCode = taskStatusId.ToString()
            let effectiveStatusId = task.StatusId ?? process.StatusId
            let processStatusCode = process.StatusId.ToString()
            // Reassign eligibility must stay fail-closed across both status sources. The todo
            // list shows process.StatusId, while task.StatusId can still point at an earlier
            // approval node, so a task-first check alone lets a Pending Modification /
            // External Approval application keep the Reassign action. Block on either source.
            let isReassignBlockedStatus = task.StatusId == (int)ApprovalNodeOrder.ExternalApproval
                || task.StatusId == (int)ApprovalNodeOrder.PendingModification
                || process.StatusId == (int)ApprovalNodeOrder.ExternalApproval
                || process.StatusId == (int)ApprovalNodeOrder.PendingModification
            let processStatusText = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "ApprovalNodeOrder"
                    && dictionary.Code == processStatusCode)
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
                    duty.DepartmentId == ContentDepartmentId
                    && duty.UserId == task.Assignee)
                .OrderByDescending(duty => duty.CreatedOn)
                .ThenByDescending(duty => duty.Id)
                .Select(duty => duty.StatusType)
                .FirstOrDefault()
            let currentApplicationStatusId = dbContext.ApplicationDetails
                .Where(detail => detail.ApplicationId == application.Id
                                 && detail.DeletedOn == null)
                .OrderByDescending(detail => detail.Id)
                .Select(detail => (int?)detail.ApplicationStatusId)
                .FirstOrDefault()
            let currentApplicationStatusCode = currentApplicationStatusId.ToString()
            let finalApplicationStatusText = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "ApplicationStatuses"
                    && dictionary.Code == currentApplicationStatusCode)
                .Select(dictionary => new
                {
                    Display = isArabicLanguage && dictionary.NameAr != null && dictionary.NameAr != string.Empty
                        ? dictionary.NameAr
                        : dictionary.NameEn ?? dictionary.Code,
                    English = dictionary.NameEn ?? dictionary.Code
                })
                .FirstOrDefault()
            where (applicationIds == null || applicationIds.Contains(application.Id))
                  && task.ApprovalDepartment == ContentDepartmentId
                  && (completedView
                        ? task.ApprovalAt.HasValue
                          && (currentApplicationStatusId == (int)ApplicationStatus.Completed
                              || currentApplicationStatusId == (int)ApplicationStatus.Rejected
                              || currentApplicationStatusId == (int)ApplicationStatus.Cancelled
                              || (application.ServiceCode == TransferDepartmentServiceCode
                                  && currentApplicationStatusId == (int)ApplicationStatus.PendingPayment))
                        : !task.ApprovalAt.HasValue
                          && !completedTaskStatuses.Contains(task.StatusId)
                          && currentApplicationStatusId != (int)ApplicationStatus.Cancelled)
                  && (completedView || !dbContext.DispositionCases.Any(disposition =>
                      disposition.ApplicationId == application.Id
                      && activeDispositionStatuses.Contains(disposition.FinalDispositionStatusId)))
            select new ContentTeamTaskQueryRow
            {
                SourceType = TeamManagementConstants.SourceApplication,
                SourceId = task.TaskId,
                TaskNo = application.ApplicationNumber,
                TaskCategory = TeamManagementConstants.CategoryApplications,
                ApplyFor = profile == null
                    ? application.UserId
                    : profile.UserTypeId == 1
                        ? isArabicLanguage
                            ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                            : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                        : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                AssignedToUserId = task.Assignee,
                AssignedToName = completedView
                    ? assignee == null
                        ? task.Assignee
                        : fullAssigneeName != string.Empty
                            ? fullAssigneeName
                            : assignee.UserName
                    : fullAssigneeName != string.Empty
                        ? fullAssigneeName
                        : assignee.UserName,
                ApprovalRole = task.ApprovalRole,
                StatusCode = completedView ? taskStatusCode : processStatusCode,
                StatusFilterCode = WorkflowStatusDomain + ":" + taskStatusCode,
                StatusText = completedView
                    ? (finalApplicationStatusText == null ? currentApplicationStatusCode : finalApplicationStatusText.Display)
                    : (processStatusText == null ? processStatusCode : processStatusText.Display),
                StatusDisplayOnly = completedView
                    ? (finalApplicationStatusText == null ? currentApplicationStatusCode : finalApplicationStatusText.English)
                    : (processStatusText == null ? processStatusCode : processStatusText.English),
                LastUpdatedOn = task.ApprovalAt ?? task.CreatedTime,
                DedupCreatedOn = task.CreatedTime,
                DedupId = task.Id,
                DedupSourceRank = 1,
                SlaDueOn = task.DueDate,
                UrgentEligible = !task.ApprovalAt.HasValue
                    && effectiveStatusId.HasValue
                    && effectiveStatusId.Value != (int)ApprovalNodeOrder.ExternalApproval,
                IsUrgentSort = !task.ApprovalAt.HasValue
                    && effectiveStatusId.HasValue
                    && effectiveStatusId.Value != (int)ApprovalNodeOrder.ExternalApproval
                    && task.DueDate.HasValue
                    && task.DueDate.Value <= urgentDueBefore
                    && latestDutyStatus == TeamManagementConstants.DutyStatusEmergencyLeave,
                CanReassign = !task.ApprovalAt.HasValue
                    && effectiveStatusId.HasValue
                    && !isReassignBlockedStatus,
                DetailTarget = "applications/" + application.Id + "?taskId=" + task.TaskId
            };
    }

    private static IQueryable<ContentTeamTaskQueryRow> BuildDispositionApplicationRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        int[]? applicationIds = null)
    {
        var pendingStatus = (int)DispositionVerificationStatus.PendingDisposition;
        var verificationStatus = (int)DispositionVerificationStatus.DispositionVerification;
        var verifiedStatus = (int)DispositionVerificationStatus.Verified;
        var notVerifiedStatus = (int)DispositionVerificationStatus.NotVerified;
        var rejectedApplicationStatus = (int)ApplicationStatus.Rejected;
        var pendingApplicationStatus = ((int)ApplicationStatus.PendingDisposition).ToString();
        var verificationApplicationStatus = ((int)ApplicationStatus.DispositionVerification).ToString();

        // Terminal disposition labels, aligned with api/Content/MyComplatedPage. That endpoint
        // composes the label from BOTH axes -- the case's final application status
        // (Completed/Rejected) AND its verification outcome (Verified/NotVerified) -- via
        // PostCertificateDispositionPolicy.LocalizeDispositionCaseFinalStatus, which is the source
        // of truth for the four strings below. This projection previously localized FinalStatusId
        // alone, so both verification outcomes collapsed onto a bare "Completed" / "Rejected" and
        // the team list disagreed with the personal completed list on the same application.
        //
        // The literals are duplicated (rather than called) because this runs server-side: the
        // policy helper is a client-side method EF cannot translate. The same four pairs are also
        // spelled out in Req189_TeamCompleted_ReadViews.sql, which feeds the read table -- all
        // three must move together or the read sources drift apart.
        var verifiedCompleted = isArabicLanguage
            ? PostCertificateDispositionPolicy.VerifiedCompletedStatusAr
            : PostCertificateDispositionPolicy.VerifiedCompletedStatusEn;
        var notVerifiedCompleted = isArabicLanguage
            ? PostCertificateDispositionPolicy.NotVerifiedCompletedStatusAr
            : PostCertificateDispositionPolicy.NotVerifiedCompletedStatusEn;
        var verifiedRejected = isArabicLanguage
            ? PostCertificateDispositionPolicy.VerifiedRejectedStatusAr
            : PostCertificateDispositionPolicy.VerifiedRejectedStatusEn;
        var notVerifiedRejected = isArabicLanguage
            ? PostCertificateDispositionPolicy.NotVerifiedRejectedStatusAr
            : PostCertificateDispositionPolicy.NotVerifiedRejectedStatusEn;

        return
            from disposition in dbContext.DispositionCases.AsNoTracking()
            join application in dbContext.Applications.AsNoTracking()
                on disposition.ApplicationId equals application.Id
            join profile in dbContext.UserProfiles.AsNoTracking()
                on application.ProfileId equals profile.Id into profileGroup
            from profile in profileGroup.DefaultIfEmpty()
            join person in dbContext.Persons.AsNoTracking()
                on profile.PersonId equals person.Id into personGroup
            from person in personGroup.DefaultIfEmpty()
            let statusCode = disposition.FinalDispositionStatusId.ToString()
            let liveApplicationStatusCode = disposition.LastSubmissionId.HasValue
                ? verificationApplicationStatus
                : pendingApplicationStatus
            let liveStatus = dbContext.TypeDictionaries
                .Where(dictionary =>
                    dictionary.Scope == "ApplicationStatuses"
                    && dictionary.Code == liveApplicationStatusCode)
                .Select(dictionary => new
                {
                    Display = isArabicLanguage
                        ? dictionary.NameAr ?? string.Empty
                        : dictionary.NameEn ?? string.Empty,
                    English = dictionary.NameEn ?? string.Empty
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
            let sourceReviewer = (
                from record in dbContext.ApprovalRecords.AsNoTracking()
                where record.Id == disposition.SourceApprovalRecordId
                join user in dbContext.AdminUsers.AsNoTracking()
                    on record.ApproverId equals user.Id into reviewerGroup
                from user in reviewerGroup.DefaultIfEmpty()
                select new
                {
                    record.ApproverId,
                    record.ApproverName,
                    FullName = ((user.FirstName ?? string.Empty) + " " + (user.LastName ?? string.Empty)).Trim(),
                    user.UserName
                }).FirstOrDefault()
            where (applicationIds == null || applicationIds.Contains(application.Id))
                  && (completedView
                      ? disposition.FinalDispositionStatusId == verifiedStatus
                        || disposition.FinalDispositionStatusId == notVerifiedStatus
                      : disposition.FinalDispositionStatusId == pendingStatus
                        || disposition.FinalDispositionStatusId == verificationStatus)
            select new ContentTeamTaskQueryRow
            {
                SourceType = TeamManagementConstants.SourceApplication,
                SourceId = "disposition-" + disposition.Id,
                TaskNo = application.ApplicationNumber,
                TaskCategory = TeamManagementConstants.CategoryApplications,
                ApplyFor = profile == null
                    ? application.UserId
                    : profile.UserTypeId == 1
                        ? isArabicLanguage
                            ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                            : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                        : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                // Both live disposition states -- PendingDisposition (1) and DispositionVerification
                // (4) -- show the reviewer who approved the source application. A pending case has
                // no Camunda task and therefore no assignee of its own, but the team list must
                // still name the officer who handled it, otherwise the owner column is blank for
                // the whole 302 pending-disposition backlog. Terminal rows (completed view) keep no
                // assignee by design. Mirrored in Req189_TeamTodo_ReadViews.sql, which feeds the
                // read views and the read table -- all copies must move together.
                AssignedToUserId = completedView || sourceReviewer == null
                    ? null
                    : sourceReviewer.ApproverId,
                AssignedToName = completedView || sourceReviewer == null
                    ? null
                    : (sourceReviewer.FullName != string.Empty
                        ? sourceReviewer.FullName
                        : (sourceReviewer.UserName ?? sourceReviewer.ApproverName)),
                ApprovalRole = null,
                StatusCode =
                    disposition.FinalDispositionStatusId == verifiedStatus
                    || disposition.FinalDispositionStatusId == notVerifiedStatus
                        ? disposition.FinalStatusId == rejectedApplicationStatus
                            ? ((int)ApprovalNodeOrder.Rejected).ToString()
                            : ((int)ApprovalNodeOrder.Completed).ToString()
                        : null,
                StatusFilterCode =
                    disposition.FinalDispositionStatusId == verifiedStatus
                    || disposition.FinalDispositionStatusId == notVerifiedStatus
                        ? disposition.FinalStatusId == rejectedApplicationStatus
                            ? WorkflowStatusDomain + ":" + ((int)ApprovalNodeOrder.Rejected).ToString()
                            : WorkflowStatusDomain + ":" + ((int)ApprovalNodeOrder.Completed).ToString()
                        : DispositionStatusDomain + ":" + statusCode,
                StatusText =
                    disposition.FinalDispositionStatusId == verifiedStatus
                    || disposition.FinalDispositionStatusId == notVerifiedStatus
                        ? (disposition.FinalStatusId == rejectedApplicationStatus
                            ? (disposition.FinalDispositionStatusId == verifiedStatus
                                ? verifiedRejected
                                : notVerifiedRejected)
                            : (disposition.FinalDispositionStatusId == verifiedStatus
                                ? verifiedCompleted
                                : notVerifiedCompleted))
                        : liveStatus == null ? string.Empty : liveStatus.Display,
                StatusDisplayOnly =
                    disposition.FinalDispositionStatusId == verifiedStatus
                    || disposition.FinalDispositionStatusId == notVerifiedStatus
                        ? (disposition.FinalStatusId == rejectedApplicationStatus
                            ? (disposition.FinalDispositionStatusId == verifiedStatus
                                ? PostCertificateDispositionPolicy.VerifiedRejectedStatusEn
                                : PostCertificateDispositionPolicy.NotVerifiedRejectedStatusEn)
                            : (disposition.FinalDispositionStatusId == verifiedStatus
                                ? PostCertificateDispositionPolicy.VerifiedCompletedStatusEn
                                : PostCertificateDispositionPolicy.NotVerifiedCompletedStatusEn))
                        : liveStatus == null ? string.Empty : liveStatus.English,
                LastUpdatedOn = disposition.UpdatedOn ?? disposition.CreatedOn,
                DedupCreatedOn = disposition.CreatedOn,
                DedupId = disposition.Id,
                DedupSourceRank = 2,
                SlaDueOn = disposition.DueDate,
                UrgentEligible = false,
                IsUrgentSort = false,
                CanReassign = false,
                DetailTarget = "applications/" + application.Id + "?taskId=disposition-" + disposition.Id
            };
    }

    private static IQueryable<ContentTeamTaskQueryRow> BuildEnquiryRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? enquiryIds = null)
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
                join profile in dbContext.UserProfiles.AsNoTracking()
                    on enquiry.UserProfileId equals (int?)profile.Id into profileGroup
                from profile in profileGroup.DefaultIfEmpty()
                join person in dbContext.Persons.AsNoTracking()
                    on profile.PersonId equals person.Id into personGroup
                from person in personGroup.DefaultIfEmpty()
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
                let establishmentName = (
                    from link in dbContext.UserEstablishments
                    join establishment in dbContext.Establishments
                        on link.EstablishmentId equals establishment.Id
                    where link.UserProfileId == enquiry.UserProfileId
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
                        duty.DepartmentId == ContentDepartmentId
                        && duty.UserId == enquiry.HandlerUserId)
                    .OrderByDescending(duty => duty.CreatedOn)
                    .ThenByDescending(duty => duty.Id)
                    .Select(duty => duty.StatusType)
                    .FirstOrDefault()
                where (enquiryIds == null || enquiryIds.Contains(enquiry.Id))
                      && enquiry.DepartmentId == ContentDepartmentId
                      && enquiry.EnquiryStatusId == processingStatus
                select new ContentTeamTaskQueryRow
                {
                    SourceType = TeamManagementConstants.SourceEnquiry,
                    SourceId = enquiry.Id.ToString(),
                    TaskNo = enquiry.EnquiryNumber,
                    TaskCategory = TeamManagementConstants.CategoryEnquiries,
                    ApplyFor = profile == null
                        ? enquiry.CreatedBy
                        : profile.UserTypeId == 1
                            ? isArabicLanguage
                                ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                                : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                            : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                    ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                    AssignedToUserId = enquiry.HandlerUserId,
                    AssignedToName = fullAssigneeName != string.Empty
                        ? fullAssigneeName
                        : assignee.UserName,
                    ApprovalRole = null,
                    StatusCode = statusCode,
                    StatusFilterCode = TeamManagementConstants.SourceEnquiry + ":" + statusCode,
                    StatusText = statusText == null ? statusCode : statusText.Display,
                    StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                    LastUpdatedOn = enquiry.UpdatedOn ?? enquiry.CreatedOn,
                    DedupCreatedOn = enquiry.CreatedOn,
                    DedupId = enquiry.Id,
                    DedupSourceRank = 10,
                    SlaDueOn = enquiry.SLAEndTime,
                    UrgentEligible = true,
                    IsUrgentSort = enquiry.SLAEndTime.HasValue
                        && enquiry.SLAEndTime.Value <= urgentDueBefore
                        && latestDutyStatus == TeamManagementConstants.DutyStatusEmergencyLeave,
                    CanReassign = true,
                    DetailTarget = "happiness/tickets/tickets-details?id=" + enquiry.Id
                };
        }

        var contentUserIds = dbContext.UserDepartments.AsNoTracking()
            .Where(userDepartment => userDepartment.DepartmentId == ContentDepartmentId)
            .Select(userDepartment => userDepartment.UserId);
        var contentProcessedTrackings = dbContext.EnquiryStatusTracking.AsNoTracking()
            .Where(tracking =>
                tracking.ToStatusId == processedStatus
                && tracking.CreatedBy != null
                && contentUserIds.Contains(tracking.CreatedBy));
        var contentProcessedEnquiryIds = contentProcessedTrackings
            .Select(tracking => tracking.EnquiryId);

        return
            from enquiry in dbContext.Enquiries.AsNoTracking()
            where (enquiryIds == null || enquiryIds.Contains(enquiry.Id))
                  && (enquiry.DepartmentId == null || enquiry.DepartmentId != ContentDepartmentId)
                  && contentProcessedEnquiryIds.Contains(enquiry.Id)
            let latestContentProcessedTracking = (
                from tracking in contentProcessedTrackings
                where tracking.EnquiryId == enquiry.Id
                orderby tracking.CreatedOn descending, tracking.Id descending
                select new
                {
                    OwnerId = tracking.HandlerUserId ?? tracking.CreatedBy ?? string.Empty,
                    tracking.CreatedOn
                })
                .FirstOrDefault()
            let ownerId = latestContentProcessedTracking == null
                ? enquiry.HandlerUserId ?? enquiry.CreatedBy ?? string.Empty
                : latestContentProcessedTracking.OwnerId
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on ownerId equals assignee.Id into assigneeGroup
            from assignee in assigneeGroup.DefaultIfEmpty()
            join profile in dbContext.UserProfiles.AsNoTracking()
                on enquiry.UserProfileId equals (int?)profile.Id into profileGroup
            from profile in profileGroup.DefaultIfEmpty()
            join person in dbContext.Persons.AsNoTracking()
                on profile.PersonId equals person.Id into personGroup
            from person in personGroup.DefaultIfEmpty()
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
            let establishmentName = (
                from link in dbContext.UserEstablishments
                join establishment in dbContext.Establishments
                    on link.EstablishmentId equals establishment.Id
                where link.UserProfileId == enquiry.UserProfileId
                orderby link.Id
                select isArabicLanguage
                    ? establishment.NameAr ?? establishment.NameEn
                    : establishment.NameEn ?? establishment.NameAr)
                .FirstOrDefault()
            let fullAssigneeName = ((assignee.FirstName ?? string.Empty)
                + " "
                + (assignee.LastName ?? string.Empty)).Trim()
            select new ContentTeamTaskQueryRow
            {
                SourceType = TeamManagementConstants.SourceEnquiry,
                SourceId = enquiry.Id + ":completed:" + ownerId,
                TaskNo = enquiry.EnquiryNumber,
                TaskCategory = TeamManagementConstants.CategoryEnquiries,
                ApplyFor = profile == null
                    ? enquiry.CreatedBy
                    : profile.UserTypeId == 1
                        ? isArabicLanguage
                            ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                            : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                        : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                AssignedToUserId = ownerId,
                AssignedToName = fullAssigneeName != string.Empty
                    ? fullAssigneeName
                    : assignee.UserName ?? ownerId,
                ApprovalRole = null,
                StatusCode = statusCode,
                StatusFilterCode = TeamManagementConstants.SourceEnquiry + ":" + statusCode,
                StatusText = statusText == null ? statusCode : statusText.Display,
                StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                LastUpdatedOn = enquiry.UpdatedOn
                    ?? (latestContentProcessedTracking == null
                        ? null
                        : (DateTime?)latestContentProcessedTracking.CreatedOn)
                    ?? enquiry.CreatedOn,
                DedupCreatedOn = enquiry.CreatedOn,
                DedupId = enquiry.Id,
                DedupSourceRank = 10,
                SlaDueOn = enquiry.SLAEndTime,
                UrgentEligible = false,
                IsUrgentSort = false,
                CanReassign = false,
                DetailTarget = "happiness/tickets/tickets-details?id=" + enquiry.Id
            };
    }

    private static IQueryable<ContentTeamTaskQueryRow> BuildRefundRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? refundIds = null)
    {
        var processingStatus = (short)TicketRefundsStatusEnum.DepartmentProcessing;
        var processedStatus = (int)TicketRefundsStatusEnum.DepartmentProcessed;

        if (!completedView)
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
                        duty.DepartmentId == ContentDepartmentId
                        && duty.UserId == refund.HandlerUserId)
                    .OrderByDescending(duty => duty.CreatedOn)
                    .ThenByDescending(duty => duty.Id)
                    .Select(duty => duty.StatusType)
                    .FirstOrDefault()
                where (refundIds == null || refundIds.Contains(refund.Id))
                      && refund.ReferenceDepartmentId == ContentDepartmentId
                      && refund.StatusId == processingStatus
                select new ContentTeamTaskQueryRow
                {
                    SourceType = TeamManagementConstants.SourceRefund,
                    SourceId = refund.Id.ToString(),
                    TaskNo = refund.ApplicationNumber
                        ?? refund.ReferenceNumber
                        ?? refund.TransactionNo
                        ?? refund.Id.ToString(),
                    TaskCategory = TeamManagementConstants.CategoryRefunds,
                    ApplyFor = profile == null
                        ? refund.UserId
                        : profile.UserTypeId == 1
                            ? isArabicLanguage
                                ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                                : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                            : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                    ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                    AssignedToUserId = refund.HandlerUserId,
                    AssignedToName = fullAssigneeName != string.Empty
                        ? fullAssigneeName
                        : assignee.UserName,
                    ApprovalRole = null,
                    StatusCode = statusCode,
                    StatusFilterCode = TeamManagementConstants.SourceRefund + ":" + statusCode,
                    StatusText = statusText == null ? statusCode : statusText.Display,
                    StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                    LastUpdatedOn = refund.UpdateOn,
                    DedupCreatedOn = refund.CreatedOn,
                    DedupId = refund.Id,
                    DedupSourceRank = 20,
                    SlaDueOn = refund.SLAEndTime,
                    UrgentEligible = true,
                    IsUrgentSort = refund.SLAEndTime.HasValue
                        && refund.SLAEndTime.Value <= urgentDueBefore
                        && latestDutyStatus == TeamManagementConstants.DutyStatusEmergencyLeave,
                    CanReassign = true,
                    DetailTarget = "finance/refunds/" + (refund.ReferenceNumber ?? refund.Id.ToString())
                };
        }

        var contentUserIds = dbContext.UserDepartments.AsNoTracking()
            .Where(userDepartment => userDepartment.DepartmentId == ContentDepartmentId)
            .Select(userDepartment => userDepartment.UserId);
        var contentProcessedRefundIds = dbContext.RefundStatusTrackings.AsNoTracking()
            .Where(tracking => tracking.ToStatusId == processedStatus
                && tracking.CreatedBy != null
                && contentUserIds.Contains(tracking.CreatedBy))
            .Select(tracking => tracking.RefundId);

        return
            from refund in dbContext.Refunds.AsNoTracking()
            where (refundIds == null || refundIds.Contains(refund.Id))
                  && (refund.DepartmentId == null || refund.DepartmentId != ContentDepartmentId)
                  && contentProcessedRefundIds.Contains(refund.Id)
            let ownerId = dbContext.RefundStatusTrackings
                .Where(tracking => tracking.RefundId == refund.Id
                    && tracking.ToStatusId == processedStatus
                    && tracking.CreatedBy != null
                    && contentUserIds.Contains(tracking.CreatedBy))
                .OrderByDescending(tracking => tracking.CreatedOn)
                .ThenByDescending(tracking => tracking.Id)
                .Select(tracking => tracking.CreatedBy)
                .FirstOrDefault()
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on ownerId equals assignee.Id into assigneeGroup
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
            select new ContentTeamTaskQueryRow
            {
                SourceType = TeamManagementConstants.SourceRefund,
                SourceId = refund.Id + ":completed:" + ownerId,
                TaskNo = refund.ApplicationNumber
                    ?? refund.ReferenceNumber
                    ?? refund.TransactionNo
                    ?? refund.Id.ToString(),
                TaskCategory = TeamManagementConstants.CategoryRefunds,
                ApplyFor = profile == null
                    ? refund.UserId
                    : profile.UserTypeId == 1
                        ? isArabicLanguage
                            ? person.NameAr ?? person.Name ?? profile.ProfileCode ?? profile.Id.ToString()
                            : person.Name ?? person.NameAr ?? profile.ProfileCode ?? profile.Id.ToString()
                        : establishmentName ?? profile.ProfileCode ?? profile.Id.ToString(),
                ApplyForUserTypeId = profile == null ? null : profile.UserTypeId,
                AssignedToUserId = ownerId,
                AssignedToName = fullAssigneeName != string.Empty
                    ? fullAssigneeName
                    : assignee.UserName ?? ownerId,
                ApprovalRole = null,
                StatusCode = statusCode,
                StatusFilterCode = TeamManagementConstants.SourceRefund + ":" + statusCode,
                StatusText = statusText == null ? statusCode : statusText.Display,
                StatusDisplayOnly = statusText == null ? statusCode : statusText.English,
                LastUpdatedOn = refund.UpdateOn,
                DedupCreatedOn = refund.CreatedOn,
                DedupId = refund.Id,
                DedupSourceRank = 20,
                SlaDueOn = refund.SLAEndTime,
                UrgentEligible = false,
                IsUrgentSort = false,
                CanReassign = false,
                DetailTarget = "finance/refunds/" + (refund.ReferenceNumber ?? refund.Id.ToString())
            };
    }

    private static IQueryable<ContentTeamTaskQueryRow> BuildViolationRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? violationIds = null)
    {
        var pendingContentReportStatus = (int)InspectionViolationStatus.PendingContentReport;
        var warningIssuedStatus = (int)InspectionViolationStatus.WarningIssued;
        var pendingPaymentStatus = (int)InspectionViolationStatus.PendingPayment;
        var underAppealStatus = (int)InspectionViolationStatus.UnderAppeal;
        var paidStatus = (int)InspectionViolationStatus.Paid;
        var cancelledStatus = (int)InspectionViolationStatus.Cancelled;

        return
            from violation in dbContext.InspectionViolations.AsNoTracking()
            let owner = dbContext.InspectionViolationHandlers
                .Where(handler =>
                    handler.ViolationId == violation.Id
                    && handler.HandlerType != null
                    && handler.HandlerType.Trim().ToLower() == "content team")
                .OrderByDescending(handler => handler.IsActive == true)
                .ThenByDescending(handler => handler.AssignedAt)
                .ThenByDescending(handler => handler.Id)
                .Select(handler => new
                {
                    handler.Id,
                    handler.UserId
                })
                .FirstOrDefault()
            let ownerId = owner == null ? null : owner.UserId
            let assignee = dbContext.AdminUsers
                .Where(user => user.Id == ownerId)
                .Select(user => new
                {
                    user.FirstName,
                    user.LastName,
                    user.UserName
                })
                .FirstOrDefault()
            let fullAssigneeName = assignee == null
                ? string.Empty
                : ((assignee.FirstName ?? string.Empty)
                    + " "
                    + (assignee.LastName ?? string.Empty)).Trim()
            let latestDutyStatus = dbContext.TeamMemberDutyStatusRecords
                .Where(duty =>
                    duty.DepartmentId == ContentDepartmentId
                    && duty.UserId == ownerId)
                .OrderByDescending(duty => duty.CreatedOn)
                .ThenByDescending(duty => duty.Id)
                .Select(duty => duty.StatusType)
                .FirstOrDefault()
            where (violationIds == null || violationIds.Contains(violation.Id))
                  && owner != null
                  && (completedView
                      ? violation.StatusId == warningIssuedStatus
                        || violation.StatusId == pendingPaymentStatus
                        || violation.StatusId == underAppealStatus
                        || violation.StatusId == paidStatus
                        || violation.StatusId == cancelledStatus
                      : violation.StatusId == pendingContentReportStatus)
            select new ContentTeamTaskQueryRow
            {
                SourceType = TeamManagementConstants.SourceViolation,
                SourceId = completedView
                    ? violation.Id + ":completed:" + ownerId
                    : violation.Id.ToString(),
                TaskNo = violation.ViolationNo,
                TaskCategory = TeamManagementConstants.CategoryViolations,
                ApplyFor = violation.ViolatorName,
                ApplyForUserTypeId = null,
                AssignedToUserId = ownerId,
                AssignedToName = fullAssigneeName != string.Empty
                    ? fullAssigneeName
                    : assignee != null && assignee.UserName != null && assignee.UserName != string.Empty
                        ? assignee.UserName
                        : ownerId,
                ApprovalRole = null,
                StatusCode = violation.StatusId.ToString(),
                StatusFilterCode = TeamManagementConstants.SourceViolation + ":" + violation.StatusId,
                StatusText = violation.StatusId == (int)InspectionViolationStatus.WarningIssued
                    ? isArabicLanguage ? "تم إصدار إنذار" : "Warning Issued"
                    : violation.StatusId == (int)InspectionViolationStatus.PendingRouting
                        ? isArabicLanguage ? "بانتظار التوجيه" : "Pending Routing"
                        : violation.StatusId == (int)InspectionViolationStatus.PendingContentReport
                            ? isArabicLanguage ? "بانتظار تقرير المحتوى" : "Pending Content Report"
                            : violation.StatusId == (int)InspectionViolationStatus.PendingReview
                                ? isArabicLanguage ? "بانتظار المراجعة" : "Pending Review"
                                : violation.StatusId == (int)InspectionViolationStatus.PendingCommitteeDecision
                                    ? isArabicLanguage ? "بانتظار قرار اللجنة" : "Pending Committee Decision"
                                    : violation.StatusId == (int)InspectionViolationStatus.PendingApproval
                                        ? isArabicLanguage ? "بانتظار الاعتماد" : "Pending Approval"
                                        : violation.StatusId == (int)InspectionViolationStatus.PendingPayment
                                            ? isArabicLanguage ? "بانتظار الدفع" : "Pending Payment"
                                            : violation.StatusId == (int)InspectionViolationStatus.UnderAppeal
                                                ? isArabicLanguage ? "قيد الطعن" : "Under Appeal"
                                                : violation.StatusId == (int)InspectionViolationStatus.Paid
                                                    ? isArabicLanguage ? "مدفوع" : "Paid"
                                                    : violation.StatusId == (int)InspectionViolationStatus.Cancelled
                                                        ? isArabicLanguage ? "ملغي" : "Cancelled"
                                                        : violation.StatusId.ToString(),
                StatusDisplayOnly = violation.StatusId == (int)InspectionViolationStatus.WarningIssued
                    ? "Warning Issued"
                    : violation.StatusId == (int)InspectionViolationStatus.PendingRouting
                        ? "Pending Routing"
                        : violation.StatusId == (int)InspectionViolationStatus.PendingContentReport
                            ? "Pending Content Report"
                            : violation.StatusId == (int)InspectionViolationStatus.PendingReview
                                ? "Pending Review"
                                : violation.StatusId == (int)InspectionViolationStatus.PendingCommitteeDecision
                                    ? "Pending Committee Decision"
                                    : violation.StatusId == (int)InspectionViolationStatus.PendingApproval
                                        ? "Pending Approval"
                                        : violation.StatusId == (int)InspectionViolationStatus.PendingPayment
                                            ? "Pending Payment"
                                            : violation.StatusId == (int)InspectionViolationStatus.UnderAppeal
                                                ? "Under Appeal"
                                                : violation.StatusId == (int)InspectionViolationStatus.Paid
                                                    ? "Paid"
                                                    : violation.StatusId == (int)InspectionViolationStatus.Cancelled
                                                        ? "Cancelled"
                                                        : violation.StatusId.ToString(),
                LastUpdatedOn = violation.LastUpdatedOn,
                DedupCreatedOn = violation.CreatedOn,
                DedupId = violation.Id,
                DedupSourceRank = 40,
                SlaDueOn = violation.SlaDeadlineAt,
                UrgentEligible = !completedView,
                IsUrgentSort = !completedView
                    && violation.SlaDeadlineAt.HasValue
                    && violation.SlaDeadlineAt.Value <= urgentDueBefore
                    && latestDutyStatus == TeamManagementConstants.DutyStatusEmergencyLeave,
                CanReassign = !completedView,
                DetailTarget = "inspection/violations/detail?violationId=" + violation.Id
            };
    }

    private static IQueryable<ContentTeamTaskQueryRow> BuildAppealRows(
        AdminPortalDBContext dbContext,
        bool completedView,
        bool isArabicLanguage,
        DateTime urgentDueBefore,
        int[]? appealIds = null)
    {
        var processingStatus = (int)InspectionAppealStatus.DepartmentProcessing;
        var processedStatus = (int)InspectionAppealStatus.DepartmentProcessed;
        var cancelledStatus = (int)InspectionAppealStatus.Cancelled;

        // Appeal timeline events store the owning department as free text, and the writers are not
        // consistent about which form they use: reassignment writes the department id into
        // TargetDepartmentCode but the department code into ActorDepartmentCode. Accept every form
        // that maps back to the Content department instead of comparing against a single literal.
        var contentDepartmentIdText = ContentDepartmentId.ToString();
        var contentDepartmentCodes = dbContext.Departments.AsNoTracking()
            .Where(department => department.Id == ContentDepartmentId && department.Code != null)
            .Select(department => department.Code!.Trim().ToLower());
        var contentDepartmentNames = dbContext.Departments.AsNoTracking()
            .Where(department => department.Id == ContentDepartmentId && department.NameEn != null)
            .Select(department => department.NameEn!.Trim().ToLower());

        if (!completedView)
        {
            return
                from appeal in dbContext.InspectionViolationAppeals.AsNoTracking()
                let latestTarget = dbContext.InspectionAppealTimelineEvents
                    .Where(timeline =>
                        timeline.AppealId == appeal.Id
                        && ((timeline.TargetDepartmentCode != null && timeline.TargetDepartmentCode.Trim() != string.Empty)
                            || (timeline.TargetDepartmentName != null && timeline.TargetDepartmentName.Trim() != string.Empty)
                            || (timeline.TargetHandlerUserId != null && timeline.TargetHandlerUserId.Trim() != string.Empty)))
                    .OrderByDescending(timeline => timeline.CreatedOn)
                    .ThenByDescending(timeline => timeline.Id)
                    .Select(timeline => new
                    {
                        timeline.TargetHandlerUserId,
                        timeline.TargetHandlerUserName,
                        timeline.TargetDepartmentCode,
                        timeline.TargetDepartmentName
                    })
                    .FirstOrDefault()
                let ownerId = latestTarget == null ? null : latestTarget.TargetHandlerUserId
                let storedOwnerName = latestTarget == null ? null : latestTarget.TargetHandlerUserName
                let fallbackOwnerName = dbContext.AdminUsers
                    .Where(user => user.Id == ownerId)
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
                        duty.DepartmentId == ContentDepartmentId
                        && duty.UserId == ownerId)
                    .OrderByDescending(duty => duty.CreatedOn)
                    .ThenByDescending(duty => duty.Id)
                    .Select(duty => duty.StatusType)
                    .FirstOrDefault()
                // Reassignment used to write the deadline only onto the timeline event, leaving
                // InspectionViolationAppeals.SlaDueOn null, so those rows rendered "-" here while
                // the appeals workbench showed an SLA. Mirrors the timeline lookup in
                // InspectionAppealAppService.BuildActiveSlaSummary; the write side now fills the
                // column too, but rows written before that still need this fallback.
                let latestResponseDeadline = dbContext.InspectionAppealTimelineEvents
                    .Where(timeline =>
                        timeline.AppealId == appeal.Id
                        && timeline.ResponseDeadline != null)
                    .OrderByDescending(timeline => timeline.CreatedOn)
                    .ThenByDescending(timeline => timeline.Id)
                    .Select(timeline => timeline.ResponseDeadline)
                    .FirstOrDefault()
                let effectiveSlaDueOn = appeal.SlaDueOn ?? latestResponseDeadline
                where (appealIds == null || appealIds.Contains(appeal.Id))
                      && appeal.StatusId == processingStatus
                      && latestTarget != null
                      && ((latestTarget.TargetDepartmentCode != null
                           && (latestTarget.TargetDepartmentCode.Trim() == contentDepartmentIdText
                               || contentDepartmentCodes.Contains(
                                   latestTarget.TargetDepartmentCode.Trim().ToLower())))
                          || (latestTarget.TargetDepartmentName != null
                              && contentDepartmentNames.Contains(
                                  latestTarget.TargetDepartmentName.Trim().ToLower())))
                select new ContentTeamTaskQueryRow
                {
                    SourceType = TeamManagementConstants.SourceAppeal,
                    SourceId = appeal.Id.ToString(),
                    TaskNo = appeal.AppealNo,
                    TaskCategory = TeamManagementConstants.CategoryAppeals,
                    ApplyFor = appeal.Violation == null ? null : appeal.Violation.ViolatorName,
                    ApplyForUserTypeId = null,
                    AssignedToUserId = ownerId,
                    AssignedToName = storedOwnerName != null && storedOwnerName != string.Empty
                        ? storedOwnerName
                        : fallbackOwnerName,
                    ApprovalRole = null,
                    StatusCode = appeal.StatusId.ToString(),
                    StatusFilterCode = TeamManagementConstants.SourceAppeal + ":" + appeal.StatusId,
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
                    DedupCreatedOn = appeal.CreatedOn,
                    DedupId = appeal.Id,
                    DedupSourceRank = 30,
                    SlaDueOn = effectiveSlaDueOn,
                    UrgentEligible = true,
                    IsUrgentSort = effectiveSlaDueOn.HasValue
                        && effectiveSlaDueOn.Value <= urgentDueBefore
                        && latestDutyStatus == TeamManagementConstants.DutyStatusEmergencyLeave,
                    CanReassign = true,
                    DetailTarget = "appeals/" + appeal.Id
                };
        }

        return
            from timeline in dbContext.InspectionAppealTimelineEvents.AsNoTracking()
            let ownerId = timeline.ActorUserId ?? timeline.TargetHandlerUserId ?? string.Empty
            join appeal in dbContext.InspectionViolationAppeals.AsNoTracking()
                on timeline.AppealId equals appeal.Id
            join assignee in dbContext.AdminUsers.AsNoTracking()
                on ownerId equals assignee.Id into assigneeGroup
            from assignee in assigneeGroup.DefaultIfEmpty()
            let fullAssigneeName = ((assignee.FirstName ?? string.Empty)
                + " "
                + (assignee.LastName ?? string.Empty)).Trim()
            // A completed row records what THIS department did to the appeal, so it has to carry the
            // status that event moved the appeal into -- Department Processed or Cancelled, the same
            // two codes LoadCompletedStatusCodesAsync treats as completed for appeals. The appeal
            // itself keeps moving after Content hands it back (Happiness can route it to another
            // department, which puts it back into Department Processing), so projecting the LIVE
            // appeal.StatusId here rendered finished rows as "Department Processing" inside the
            // Completed tab and stamped an in-progress StatusFilterCode that no completed-status
            // filter can ever match. The WHERE below already restricts the event to those two codes.
            let completedStatusId = timeline.ToStatusId == cancelledStatus
                ? cancelledStatus
                : processedStatus
            where (appealIds == null || appealIds.Contains(appeal.Id))
                  && (timeline.ToStatusId == processedStatus || timeline.ToStatusId == cancelledStatus)
                  && ((timeline.TargetDepartmentCode != null
                       && (timeline.TargetDepartmentCode.Trim() == contentDepartmentIdText
                           || contentDepartmentCodes.Contains(timeline.TargetDepartmentCode.Trim().ToLower())))
                      || (timeline.TargetDepartmentName != null
                          && contentDepartmentNames.Contains(timeline.TargetDepartmentName.Trim().ToLower()))
                      || (timeline.ActorDepartmentCode != null
                          && (timeline.ActorDepartmentCode.Trim() == contentDepartmentIdText
                              || contentDepartmentCodes.Contains(timeline.ActorDepartmentCode.Trim().ToLower())))
                      || (timeline.ActorDepartmentName != null
                          && contentDepartmentNames.Contains(timeline.ActorDepartmentName.Trim().ToLower())))
                  && !dbContext.InspectionAppealTimelineEvents.Any(other =>
                      other.AppealId == timeline.AppealId
                      && (other.ActorUserId ?? other.TargetHandlerUserId ?? string.Empty) == ownerId
                      && (other.ToStatusId == processedStatus || other.ToStatusId == cancelledStatus)
                      && ((other.TargetDepartmentCode != null
                           && (other.TargetDepartmentCode.Trim() == contentDepartmentIdText
                               || contentDepartmentCodes.Contains(other.TargetDepartmentCode.Trim().ToLower())))
                          || (other.TargetDepartmentName != null
                              && contentDepartmentNames.Contains(other.TargetDepartmentName.Trim().ToLower()))
                          || (other.ActorDepartmentCode != null
                              && (other.ActorDepartmentCode.Trim() == contentDepartmentIdText
                                  || contentDepartmentCodes.Contains(other.ActorDepartmentCode.Trim().ToLower())))
                          || (other.ActorDepartmentName != null
                              && contentDepartmentNames.Contains(other.ActorDepartmentName.Trim().ToLower())))
                      && (other.CreatedOn > timeline.CreatedOn
                          || other.CreatedOn == timeline.CreatedOn && other.Id > timeline.Id))
            select new ContentTeamTaskQueryRow
            {
                SourceType = TeamManagementConstants.SourceAppeal,
                SourceId = appeal.Id + ":completed:" + ownerId,
                TaskNo = appeal.AppealNo,
                TaskCategory = TeamManagementConstants.CategoryAppeals,
                ApplyFor = appeal.Violation == null ? null : appeal.Violation.ViolatorName,
                ApplyForUserTypeId = null,
                AssignedToUserId = ownerId,
                AssignedToName = timeline.ActorUserName != null && timeline.ActorUserName != string.Empty
                    ? timeline.ActorUserName
                    : timeline.TargetHandlerUserName != null && timeline.TargetHandlerUserName != string.Empty
                        ? timeline.TargetHandlerUserName
                        : fullAssigneeName != string.Empty
                            ? fullAssigneeName
                            : assignee.UserName ?? ownerId,
                ApprovalRole = null,
                StatusCode = completedStatusId.ToString(),
                StatusFilterCode = TeamManagementConstants.SourceAppeal + ":" + completedStatusId,
                StatusText = completedStatusId == cancelledStatus
                    ? isArabicLanguage ? "ملغي" : "Cancelled"
                    : isArabicLanguage ? "تمت المعالجة لدى الإدارة" : "Department Processed",
                StatusDisplayOnly = completedStatusId == cancelledStatus
                    ? "Cancelled"
                    : "Department Processed",
                LastUpdatedOn = appeal.LastUpdatedOn,
                DedupCreatedOn = appeal.CreatedOn,
                DedupId = appeal.Id,
                DedupSourceRank = 30,
                SlaDueOn = appeal.SlaDueOn,
                UrgentEligible = false,
                IsUrgentSort = false,
                CanReassign = false,
                DetailTarget = "appeals/" + appeal.Id
            };
    }

}

/// <summary>
/// The language-dependent slice of <see cref="ContentTeamTaskQueryRow"/>. Everything else in the
/// projection is language-invariant, so the second (Arabic) sync pass only has to fetch these.
/// </summary>
internal sealed class ContentTeamTaskLocalizedRow
{
    public string SourceId { get; set; } = string.Empty;
    public string? ApplyFor { get; set; }
    public string? StatusText { get; set; }
}

internal sealed class ContentTeamTaskQueryRow
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string? TaskNo { get; set; }
    public string TaskCategory { get; set; } = string.Empty;
    public string? ApplyFor { get; set; }
    public int? ApplyForUserTypeId { get; set; }
    public string? AssignedToUserId { get; set; }
    public string? AssignedToName { get; set; }
    public string? ApprovalRole { get; set; }
    public string? StatusCode { get; set; }
    public string StatusFilterCode { get; set; } = string.Empty;
    public string? StatusText { get; set; }
    public string? StatusDisplayOnly { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public DateTime DedupCreatedOn { get; set; }
    public int DedupId { get; set; }
    public int DedupSourceRank { get; set; }
    public DateTime? SlaDueOn { get; set; }
    public bool UrgentEligible { get; set; }
    public bool IsUrgentSort { get; set; }
    public bool CanReassign { get; set; }
    public string? DetailTarget { get; set; }
}

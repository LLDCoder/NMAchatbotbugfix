using UMC.AdminPortal.Application.Dtos.Application;
using UMC.Utils.Framework.Helps;

namespace UMC.AdminPortal.Application.Services;

/// <summary>
/// The single definition of how a <see cref="MyReviewPageRequest"/> narrows a MyReview row set.
///
/// Both the paged list (GetMyReviewPageAsync) and the CSV export (ExportMyReviewAsync) route
/// through here so an export always contains exactly the rows the user was looking at. They
/// previously carried separate hand-rolled filter blocks that had drifted apart: the export
/// silently ignored ServiceTypeId, ServiceCategoryId, ApprovalStatus and ApprovalStatusFilter,
/// searched a different set of Keyword columns, and matched ProcessInstanceStatus by substring
/// instead of equality — so a filtered page exported as unfiltered data.
/// </summary>
internal static class MyReviewFilter
{
    /// <summary>
    /// Applies every <see cref="MyReviewPageRequest"/> filter to the supplied rows.
    /// Sorting and paging stay with the caller; this covers filtering only. MyTodo filters
    /// approvalStatus against TaskStatus, while MyCompleted sets filterByMyDecision and matches
    /// the same request field against MyDecision.
    /// </summary>
    internal static IQueryable<T> Apply<T>(
        IQueryable<T> query,
        MyReviewPageRequest req,
        bool filterByMyDecision = false,
        bool includeReviewStatus = true)
        where T : MyReviewPageResponse
    {
        if (!req.Keyword.IsNullOrEmpty())
        {
            var keyword = req.Keyword!.ToLower();
            query = query.Where(a =>
                (a.ApplicationNumber ?? "").ToLower().Contains(keyword) ||
                (a.ServiceNameAr ?? "").ToLower().Contains(keyword) ||
                (a.ServiceNameEn ?? "").ToLower().Contains(keyword) ||
                (a.ApplyForAr ?? "").ToLower().Contains(keyword) ||
                (a.ApplyForEn ?? "").ToLower().Contains(keyword));
        }

        // "1" is the frontend's "all service types" sentinel, not a real ServiceTypeId.
        if (!req.ServiceTypeId.IsNullOrEmpty() && req.ServiceTypeId != "1")
            query = query.Where(a => a.ServiceTypeId == req.ServiceTypeId);

        if (req.StartTime.HasValue)
            query = query.Where(a => a.LastUpdatedTime >= req.StartTime.Value.Date);

        if (req.EndTime.HasValue)
            query = query.Where(a => a.LastUpdatedTime < req.EndTime.Value.AddDays(1).Date);

        if (!req.ProcessInstanceStatus.IsNullOrEmpty())
            query = query.Where(a => a.Status == req.ProcessInstanceStatus);

        if (req.ServiceCategoryId.HasValue)
            query = query.Where(a => a.ServiceCategoryId == req.ServiceCategoryId.Value);

        // Service filter (the Content list replaced its service-category dropdown with this one).
        // Matched on ServiceCode so all version rows of one service are covered by a single value.
        if (req.ServiceCodes is { Count: > 0 })
        {
            var serviceCodes = req.ServiceCodes
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Select(code => code.Trim())
                .ToList();
            if (serviceCodes.Count > 0)
                query = query.Where(a => a.ServiceCode != null && serviceCodes.Contains(a.ServiceCode));
        }

        if (includeReviewStatus && req.ApprovalStatus != null && req.ApprovalStatus.Count > 0)
        {
            query = filterByMyDecision
                ? query.Where(a => a.MyDecision != null && req.ApprovalStatus.Contains(a.MyDecision))
                : query.Where(a => req.ApprovalStatus.Contains(a.TaskStatus));
        }

        if (includeReviewStatus && !req.ApprovalStatusFilter.IsNullOrEmpty())
        {
            query = filterByMyDecision
                ? query.Where(a => a.MyDecision == req.ApprovalStatusFilter)
                : query.Where(a => a.TaskStatus == req.ApprovalStatusFilter);
        }

        return query;
    }

    internal static IQueryable<T> ApplyReviewStatus<T>(
        IQueryable<T> query,
        MyReviewPageRequest req,
        bool filterByMyDecision)
        where T : MyReviewPageResponse
    {
        if (req.ApprovalStatus != null && req.ApprovalStatus.Count > 0)
        {
            query = filterByMyDecision
                ? query.Where(a => a.MyDecision != null && req.ApprovalStatus.Contains(a.MyDecision))
                : query.Where(a => req.ApprovalStatus.Contains(a.TaskStatus));
        }

        if (!req.ApprovalStatusFilter.IsNullOrEmpty())
        {
            query = filterByMyDecision
                ? query.Where(a => a.MyDecision == req.ApprovalStatusFilter)
                : query.Where(a => a.TaskStatus == req.ApprovalStatusFilter);
        }

        return query;
    }

    internal static MyReviewPageRequest NormalizeCompletedMyDecisionFilters(MyReviewPageRequest req)
    {
        static string Normalize(string value)
        {
            return value.Trim().ToUpperInvariant() switch
            {
                "REQUEST MODIFICATION" or "PENDING MODIFICATION" or "EXTERNAL APPROVAL" => "-",
                "APPROVED" => "Approved",
                "REJECTED" => "Rejected",
                "SEND BACK" or "SENDBACK" => "Send Back",
                _ => value
            };
        }

        return req with
        {
            ApprovalStatus = req.ApprovalStatus?
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(Normalize)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            ApprovalStatusFilter = string.IsNullOrWhiteSpace(req.ApprovalStatusFilter)
                ? req.ApprovalStatusFilter
                : Normalize(req.ApprovalStatusFilter)
        };
    }

    /// <summary>
    /// Compatibility shim for the CSV exports, applied to the request BEFORE <see cref="Apply"/>.
    ///
    /// The frontend's single status dropdown posts its value under a different name per endpoint:
    /// the list sends <c>processInstanceStatus</c> (matched against <c>Status</c>, the process
    /// instance's own state) while the export sends <c>approvalStatus</c> (matched against
    /// <c>TaskStatus</c>, the node the row is currently waiting on). Those are two distinct columns
    /// — <c>Status</c> comes from ProcessInstance.StatusId and <c>TaskStatus</c> from the Camunda
    /// task's StatusId — and they routinely disagree on the same row: a row can sit at TaskStatus
    /// "Initial Approval" while Status reads "Final Approval". Selecting "Initial Approval" therefore
    /// produced a CSV holding MORE rows than the list it was exported from.
    ///
    /// The list is authoritative, so an export carrying a single approval-status value but NO
    /// process-instance status is re-read as the list's filter. Two cases are deliberately left
    /// untouched, because there the caller is using the two filters as the distinct things they are:
    /// a request that already carries <c>processInstanceStatus</c>, and a MULTI-value
    /// <c>approvalStatus</c> (the list's single-valued field cannot express it).
    /// </summary>
    internal static MyReviewPageRequest NormalizeExportStatusFilter(
        MyReviewPageRequest req,
        bool approvalStatusIsMyDecision = false)
    {
        if (approvalStatusIsMyDecision)
            return req;

        if (!req.ProcessInstanceStatus.IsNullOrEmpty())
            return req;

        var single = !req.ApprovalStatusFilter.IsNullOrEmpty()
            ? req.ApprovalStatusFilter
            : req.ApprovalStatus is { Count: 1 } ? req.ApprovalStatus[0] : null;

        if (single.IsNullOrEmpty())
            return req;

        return req with
        {
            ProcessInstanceStatus = single,
            ApprovalStatus = null,
            ApprovalStatusFilter = null
        };
    }
}

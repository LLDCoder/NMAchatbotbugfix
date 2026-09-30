using UMC.AdminPortal.Application.Dtos.Application;

namespace UMC.AdminPortal.Application.Services;

/// <summary>
/// Builds the MyTask read model without deleting Camunda history. OldProcessInstanceId is the
/// legacy DTO name for ApplicationsExt.ProcessInstanceId, i.e. the current/canonical instance.
/// </summary>
internal static class ReviewTaskProjection
{
    internal static List<T> SelectPersonalTodo<T>(
        IEnumerable<T> rows,
        Func<T, bool> isCompleted)
        where T : MyReviewPageResponse
    {
        var seen = new HashSet<(int ApplicationId, int? DispositionCaseId)>();
        return OrderRows(rows)
            .Where(row => !isCompleted(row) && IsCurrentInstance(row))
            .Where(row => seen.Add((row.Id, row.DispositionCaseId)))
            .ToList();
    }

    internal static List<T> SelectTeamTodo<T>(
        IEnumerable<T> rows,
        Func<T, bool> isCompleted,
        Func<T, bool> exclude)
        where T : MyReviewPageResponse
    {
        var seen = new HashSet<int>();
        return OrderRows(rows)
            .Where(row => !isCompleted(row) && IsCurrentInstance(row))
            .Where(row => !exclude(row))
            .Where(row => seen.Add(row.Id))
            .ToList();
    }

    internal static List<T> SelectCompleted<T>(
        IEnumerable<T> rows,
        Func<T, bool> isCompleted)
        where T : MyReviewPageResponse
    {
        var seen = new HashSet<int>();
        return OrderRows(rows)
            .Where(isCompleted)
            .Where(IsCurrentInstance)
            .Where(row => seen.Add(row.Id))
            .ToList();
    }

    internal static List<T> SelectPersonalAll<T>(
        IEnumerable<T> rows,
        Func<T, bool> isCompleted)
        where T : MyReviewPageResponse
    {
        var todo = SelectPersonalTodo(rows, isCompleted);
        var completed = SelectCompleted(rows, isCompleted);
        var seen = new HashSet<(int ApplicationId, int? DispositionCaseId)>();

        return todo.Concat(completed)
            .OrderBy(row => row.Id)
            .ThenByDescending(row => row.TaskCreatedTime)
            .Where(row => seen.Add((row.Id, row.DispositionCaseId)))
            .ToList();
    }

    internal static List<T> SelectTeamAll<T>(
        IEnumerable<T> rows,
        Func<T, bool> isCompleted,
        Func<T, bool> excludeTodo)
        where T : MyReviewPageResponse
    {
        var todo = SelectTeamTodo(rows, isCompleted, excludeTodo);
        var completed = SelectCompleted(rows, isCompleted);
        var seen = new HashSet<int>();

        return todo.Concat(completed)
            .OrderBy(row => row.Id)
            .ThenByDescending(row => row.TaskCreatedTime)
            .Where(row => seen.Add(row.Id))
            .ToList();
    }

    internal static bool IsCurrentInstance(MyReviewPageResponse row)
    {
        // Legacy rows may have no canonical id because the cross-service write-back did not
        // exist or failed. Preserve their prior visibility. When both ids are known, a mismatch
        // unambiguously identifies a superseded process instance and must be hidden from MyTask.
        return string.IsNullOrEmpty(row.OldProcessInstanceId)
            || string.Equals(
                row.ProcessInstanceId,
                row.OldProcessInstanceId,
                StringComparison.Ordinal);
    }

    private static IOrderedEnumerable<T> OrderRows<T>(IEnumerable<T> rows)
        where T : MyReviewPageResponse
        => rows.OrderBy(row => row.Id)
            .ThenByDescending(row => row.TaskCreatedTime)
            .ThenByDescending(row => row.TaskApprovalAt);
}

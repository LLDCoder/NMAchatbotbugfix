using UMC.AdminPortal.Domain.Models.Workflow;
using UMC.AdminPortal.Domain.Shares.Enums.TypeDics;

namespace UMC.AdminPortal.Infrastructure
{
    public static partial class Extensions
    {
        // Status ids correspond to ApprovalNodeOrder values stored on workflow tasks
        // (see UMC.AdminPortal.Domain.Shares.Enums.TypeDics.ApprovalNodeOrder).
        // Workflow.CamundaTasks.StatusId is the int source of truth; API-edge string
        // labels (when needed) come from ITypeDictionaryService.GetByCodeAsync
        // ("ApprovalNodeOrder", id.ToString()) — redis-cached lookup against
        // Lookup.TypeDictionary scope='ApprovalNodeOrder'.
        public static readonly int[] TodoTaskStatus = new[]
        {
            (int)ApprovalNodeOrder.PendingModification, // 13, aka "Request Modification"
            (int)ApprovalNodeOrder.InitialApproval      // 2
        };

        public static readonly int[] CompletedTaskStatus = new[]
        {
            (int)ApprovalNodeOrder.Completed,        // 12
            (int)ApprovalNodeOrder.Rejected,         // 8
            (int)ApprovalNodeOrder.PendingPayment,   // 9
            (int)ApprovalNodeOrder.Cancelled,        // 10
            (int)ApprovalNodeOrder.Approved,         // 15
            (int)ApprovalNodeOrder.SendBack          // 14
        };

        public static readonly int[] TeamCompletedStatus = new[]
        {
            (int)ApprovalNodeOrder.Completed,        // 12
            (int)ApprovalNodeOrder.Rejected,         // 8
            (int)ApprovalNodeOrder.Cancelled         // 10
        };


        public static string ToSLAString(this double? sla, bool isArabic = false)
        {
            if (!sla.HasValue)
                return "-";

            var isRemaining = sla < 0;
            var ts = TimeSpan.FromMinutes(Math.Abs(sla.Value));

            if (isArabic)
            {
                // متبقي = Remaining, متأخر = Overdue (consistent with the inspection SLA formatters)
                var statusAr = isRemaining ? "متبقي" : "متأخر";
                if (ts.Days > 0)
                    return $"{statusAr} {ts.Days} يوم";
                if (ts.Hours > 0)
                    return $"{statusAr} {ts.Hours} ساعة";
                if (ts.Minutes > 0)
                    return $"{statusAr} {ts.Minutes} دقيقة";
                if (ts.Seconds > 0)
                    return $"{statusAr} {ts.Seconds} ثانية";
                return "-";
            }

            var slaText = isRemaining ? "Remaining" : "Overdue";
            if (ts.Days > 0)
                return $"{ts.Days}d {slaText}";
            if (ts.Hours > 0)
                return $"{ts.Hours}h {slaText}";
            if (ts.Minutes > 0)
                return $"{ts.Minutes}m {slaText}";
            if (ts.Seconds > 0)
                return $"{ts.Seconds}s {slaText}";
            return "-";
        }


        // MyTodoPage SLA label per docs/rules/sla-label-display-rule.md (§4/§5):
        //   - MyTodoPage sign convention: negative = time remaining ("Due in"); positive = overdue.
        //   - Single, floored unit only — day OR hour OR minute (never compound, never seconds).
        //     >=1 day  => floored days ("2d"); else >=1 hour => floored hours ("5h");
        //     else floored minutes ("30min", "0min" when under a minute).
        //   - Remaining => "Due in {value}"; Overdue => "{value} Overdue".
        // Examples: "Due in 2d", "Due in 5h", "Due in 30min", "3d Overdue", "45min Overdue".
        public static string ToSLADueInString(this double? sla, bool isArabic = false)
        {
            if (!sla.HasValue)
                return "-";

            var isRemaining = sla < 0;
            var ts = TimeSpan.FromMinutes(Math.Abs(sla.Value));

            if (isArabic)
            {
                // متبقي = Remaining, متأخر = Overdue (consistent with the inspection SLA formatters)
                var statusAr = isRemaining ? "متبقي" : "متأخر";
                string valueAr;
                if (ts.TotalDays >= 1)
                    valueAr = $"{(int)ts.TotalDays} يوم";
                else if (ts.TotalHours >= 1)
                    valueAr = $"{(int)ts.TotalHours} ساعة";
                else
                    valueAr = $"{(int)ts.TotalMinutes} دقيقة";
                return $"{statusAr} {valueAr}";
            }

            string valueText;
            if (ts.TotalDays >= 1)
                valueText = $"{(int)ts.TotalDays}d";
            else if (ts.TotalHours >= 1)
                valueText = $"{(int)ts.TotalHours}h";
            else
                valueText = $"{(int)ts.TotalMinutes}min";

            return isRemaining ? $"Due in {valueText}" : $"{valueText} Overdue";
        }




        public static int HandleSort(int? statusId)
        {
            if (statusId == (int)ApprovalNodeOrder.PendingModification)
                return 999;
            if (statusId.HasValue && CompletedTaskStatus.Contains(statusId.Value))
                return 100;
            return 1;
        }

        // Returns true when the main approval status indicates a team-terminal state.
        // The legacy disposition-suffixed labels ("Completed (Disposition Verified)" /
        // "Rejected (Disposition Not Verified)") are now expressed as the main
        // StatusId on the process instance + verification id on DispositionCase —
        // the main StatusId alone is enough to decide team-completion.
        public static bool IsTeamCompletedStatus(int? statusId)
        {
            return statusId.HasValue && TeamCompletedStatus.Contains(statusId.Value);
        }
    }
}

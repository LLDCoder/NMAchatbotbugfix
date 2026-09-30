using UMC.AdminPortal.Application.Dtos.Inspection;
using UMC.AdminPortal.Domain.Models.Inspection;
using UMC.AdminPortal.Domain.Shares;

namespace UMC.AdminPortal.Application.Services.Inspection;

internal static class InspectionSlaSummaryBuilder
{
    public static InspectionTaskSlaSummaryDto Build(
        DateTime dueOn,
        int statusId,
        DateTime? checkoutAt,
        DateTime? reportSubmittedAt,
        DateTime lastUpdatedOn,
        bool isArabic = false)
    {
        var completedOn = ResolveCompletedOn(statusId, checkoutAt, reportSubmittedAt, lastUpdatedOn);
        return Build(dueOn, completedOn, isArabic);
    }

    public static InspectionTaskSlaSummaryDto Build(DateTime dueOn, DateTime? completedOn, bool isArabic = false)
    {
        if (completedOn.HasValue)
        {
            var onTime = completedOn.Value <= dueOn;
            return new InspectionTaskSlaSummaryDto
            {
                IsVisible = true,
                StatusCode = onTime ? "OnTime" : "Exceeded",
                Color = onTime ? "default" : "red",
                DisplayText = onTime
                    ? (isArabic ? "في الوقت المحدد" : "On Time")
                    : (isArabic ? "تجاوز الوقت" : "Exceeded"),
                DueOn = dueOn,
                CompletedOn = completedOn
            };
        }

        var now = DateTimeHelper.Now;
        var dayDiff = (dueOn.Date - now.Date).Days;
        string statusCode;
        var displayText = InspectionRelativeSlaTextFormatter.FormatActive(dueOn, isArabic, now);

        if (dayDiff > 0)
        {
            statusCode = "Remaining";
        }
        else if (dayDiff == 0)
        {
            statusCode = "DueToday";
        }
        else
        {
            statusCode = "Overdue";
        }

        return new InspectionTaskSlaSummaryDto
        {
            IsVisible = true,
            StatusCode = statusCode,
            Color = statusCode switch
            {
                "Overdue" => "red",
                "DueToday" => "yellow",
                _ => "default"
            },
            DisplayText = displayText,
            DueOn = dueOn,
            CompletedOn = null
        };
    }

    public static DateTime? ResolveCompletedOn(
        int statusId,
        DateTime? checkoutAt,
        DateTime? reportSubmittedAt,
        DateTime lastUpdatedOn)
    {
        return statusId switch
        {
            (int)InspectionTaskStatus.Completed => checkoutAt ?? reportSubmittedAt ?? lastUpdatedOn,
            (int)InspectionTaskStatus.AccessFailed => lastUpdatedOn,
            (int)InspectionTaskStatus.Cancelled => lastUpdatedOn,
            _ => null
        };
    }
}


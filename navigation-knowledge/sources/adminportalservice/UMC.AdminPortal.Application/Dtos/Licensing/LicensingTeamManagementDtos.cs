using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Application.Dtos.Licensing;

public static class LicensingTeamManagementConstants
{
    public const string ViewTodo = "todo";
    public const string ViewCompleted = "completed";
    public const string CategoryAll = "all";
    public const string CategoryApplications = "applications";
    public const string CategoryProfileVerifications = "profileVerifications";
    public const string CategoryEnquiries = "enquiries";
    public const string CategoryRefunds = "refunds";
    public const string CategoryAppeals = "appeals";
    public const string SourceApplication = "application";
    public const string SourceEnquiry = "enquiry";
    public const string SourceRefund = "refund";
    public const string SourceAppeal = "appeal";
    public const string SourceProfileVerification = "profileVerification";
    public const string DutyStatusEmergencyLeave = "EmergencyLeave";
    public const string DutyStatusResumeWork = "ResumeWork";
}

public class LicensingTeamManagementSummaryDto
{
    public int TodoCount { get; set; }
    public int CompletedCount { get; set; }
    public int UrgentCount { get; set; }
    public List<LicensingTeamManagementCategoryCountDto> Categories { get; set; } = [];
}

public class LicensingTeamManagementCategoryCountDto
{
    public string Category { get; set; } = string.Empty;
    public string CategoryDisplay { get; set; } = string.Empty;
    public int TodoCount { get; set; }
    public int CompletedCount { get; set; }
}

public record LicensingTeamManagementTaskQueryRequest : PageRequest
{
    public string View { get; set; } = LicensingTeamManagementConstants.ViewTodo;
    public bool ApplicationTaskOnly { get; set; }
    public string? Keyword { get; set; }
    public string? Category { get; set; }
    public string? Status { get; set; }
    public string? MemberId { get; set; }
    public DateTime? LastUpdatedFrom { get; set; }
    public DateTime? LastUpdatedTo { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

public class LicensingTeamManagementTaskQueryResponse
{
    public PageResponse<LicensingTeamManagementTaskItemDto> Page { get; set; } = new([], 0, 1, 20);
}

public class LicensingTeamManagementStatusOptionDto
{
    public string Code { get; set; } = string.Empty;
    public string Display { get; set; } = string.Empty;
}

public class LicensingTeamManagementMetadataDto
{
    public List<LicensingTeamManagementStatusOptionDto> Categories { get; set; } = [];
    public List<LicensingTeamManagementStatusOptionDto> Statuses { get; set; } = [];
    public List<LicensingTeamManagementStatusOptionDto> TodoStatuses { get; set; } = [];
    public List<LicensingTeamManagementStatusOptionDto> CompletedStatuses { get; set; } = [];
    public List<LicensingTeamManagementStatusOptionDto> LeaveReasons { get; set; } = [];
}

public class LicensingTeamManagementTaskItemDto
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string? TaskNo { get; set; }
    public string TaskCategory { get; set; } = string.Empty;
    public string TaskCategoryCode { get; set; } = string.Empty;
    public string TaskCategoryDisplay { get; set; } = string.Empty;
    public string? ApplyFor { get; set; }
    public int? ApplyForUserTypeId { get; set; }
    public string? ApplyForIconType { get; set; }
    public LicensingTeamManagementSlaDto Sla { get; set; } = new();
    public string? AssignedToUserId { get; set; }
    public string? AssignedTo { get; set; }
    public string? Status { get; set; }
    public string? StatusCode { get; set; }
    public string? StatusId { get; set; }
    public string? StatusDisplay { get; set; }
    public string? StatusDisplayOnly { get; set; }
    public DateTime LastUpdatedOn { get; set; }
    public bool IsUrgent { get; set; }
    public bool CanReassign { get; set; }
    public string? DetailTarget { get; set; }
}

public class LicensingTeamManagementSlaDto
{
    public double? RemainingMinutes { get; set; }
    public string DisplayText { get; set; } = "-";
    public bool IsOverdue { get; set; }
    public DateTime? DueOn { get; set; }
}

public class LicensingTeamManagementReassignRequest
{
    public string? AssignedUserId { get; set; }
    public List<LicensingTeamManagementReassignTaskDto> Tasks { get; set; } = [];
}

public class LicensingTeamManagementReassignTaskDto
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
}

public class LicensingTeamManagementReassignmentMembersRequest
{
    public string? SourceType { get; set; }
    public List<LicensingTeamManagementReassignTaskDto> Tasks { get; set; } = [];
}

public class LicensingTeamManagementReassignResponse
{
    public int ReassignedCount { get; set; }
    public List<LicensingTeamManagementReassignResultDto> Results { get; set; } = [];
}

public class LicensingTeamManagementReassignResultDto
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string AssignedUserId { get; set; } = string.Empty;
    public string AssignedUserName { get; set; } = string.Empty;
}

public class LicensingTeamManagementMembersResponse
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public List<LicensingTeamManagementMemberOptionDto> Members { get; set; } = [];
    public List<LicensingTeamManagementMemberCardDto> Cards { get; set; } = [];
}

public class LicensingTeamManagementMemberOptionDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
}

public class LicensingTeamManagementUserReassignDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
}

public class LicensingTeamManagementMemberCardDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public bool IsOnLeave { get; set; }
    public LicensingTeamManagementLeaveInfoDto? LeaveInfo { get; set; }
    public int TodoTaskCount { get; set; }
    public Dictionary<string, LicensingTeamManagementMemberMetricDto> MetricsByCategory { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public class LicensingTeamManagementLeaveInfoDto
{
    public string? LeaveReasonCode { get; set; }
    public string? LeaveReasonDisplay { get; set; }
    public string? Notes { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }
    public DateTime EffectiveFrom { get; set; }
}

public class LicensingTeamManagementMemberMetricDto
{
    public int CompletedTasks { get; set; }
    public int TotalAssignedTasks { get; set; }
    public double AvgProcessingTime { get; set; }
    public decimal SlaCompliance { get; set; }
    public int OverdueTasks { get; set; }
    public int ApprovedApplicationCount { get; set; }
    public int RejectedApplicationCount { get; set; }
}

public class LicensingTeamManagementEmergencyLeaveRequest
{
    public string LeaveReasonCode { get; set; } = string.Empty;
    public DateTime ExpectedReturnDate { get; set; }
    public string? Notes { get; set; }
}

public class LicensingTeamManagementDutyStatusActionResponse
{
    public bool IsOnLeave { get; set; }
}

public class LicensingUrgentTaskAlertRunResponse
{
    public int ScannedCount { get; set; }
    public int MatchedCount { get; set; }
    public int NotifiedAdminCount { get; set; }
    public int NotifiedTaskCount { get; set; }
    public int SkippedTaskCount { get; set; }
}

/// <summary>
/// Per-member performance row returned by BuildMembersNeedingCoachingAsync.
/// Aligned with ContentDashboardMemberPerformanceSummaryDto field types.
/// </summary>
public class LicensingTeamManagementMemberPerformanceDto
{
    public string MemberId { get; set; } = string.Empty;
    public string MemberName { get; set; } = string.Empty;
    public int OverdueTasks { get; set; }
    public decimal SlaComplianceRate { get; set; }
    public double AvgProcessingTimeMinutes { get; set; }
    public int CompletedTasks { get; set; }
    public int TotalAssignedTasks { get; set; }
}

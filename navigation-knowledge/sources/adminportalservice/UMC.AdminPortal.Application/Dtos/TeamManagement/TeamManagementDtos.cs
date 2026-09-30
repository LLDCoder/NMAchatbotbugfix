using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.Application.Dtos.TeamManagement;

public static class TeamManagementConstants
{
    public const string ViewTodo = "todo";
    public const string ViewCompleted = "completed";
    public const string CategoryAll = "all";
    public const string CategoryApplications = "applications";
    public const string CategoryEnquiries = "enquiries";
    public const string CategoryRefunds = "refunds";
    public const string CategoryAppeals = "appeals";
    public const string CategoryViolations = "violations";
    public const string SourceApplication = "application";
    public const string SourceEnquiry = "enquiry";
    public const string SourceRefund = "refund";
    public const string SourceAppeal = "appeal";
    public const string SourceViolation = "violation";
    public const string DutyStatusEmergencyLeave = "EmergencyLeave";
    public const string DutyStatusResumeWork = "ResumeWork";
}

public class TeamManagementSummaryDto
{
    public int TodoCount { get; set; }
    public int CompletedCount { get; set; }
    public int UrgentCount { get; set; }
    public List<TeamManagementCategoryCountDto> Categories { get; set; } = [];
}

public class TeamManagementCategoryCountDto
{
    public string Category { get; set; } = string.Empty;
    public string CategoryDisplay { get; set; } = string.Empty;
    public int TodoCount { get; set; }
    public int CompletedCount { get; set; }
}

public class TeamManagementOptionDto
{
    public string Code { get; set; } = string.Empty;
    public string Display { get; set; } = string.Empty;
}

public class TeamManagementMetadataDto
{
    public List<TeamManagementOptionDto> Categories { get; set; } = [];
    public List<TeamManagementOptionDto> Statuses { get; set; } = [];
    public List<TeamManagementOptionDto> TodoStatuses { get; set; } = [];
    public List<TeamManagementOptionDto> CompletedStatuses { get; set; } = [];
    public List<TeamManagementOptionDto> LeaveReasons { get; set; } = [];
}

public record TeamManagementTaskQueryRequest : PageRequest
{
    public string View { get; set; } = TeamManagementConstants.ViewTodo;
    public bool? ApplicationTaskOnly { get; set; }
    public string? Keyword { get; set; }
    public string? Category { get; set; }
    public string? Status { get; set; }
    public string? MemberId { get; set; }
    public DateTime? LastUpdatedFrom { get; set; }
    public DateTime? LastUpdatedTo { get; set; }
}

public class TeamManagementTaskQueryResponse
{
    public PageResponse<TeamManagementTaskItemDto> Page { get; set; } = new([], 0, 1, 20);
}

public class TeamManagementTaskItemDto
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string? TaskNo { get; set; }
    public string TaskCategory { get; set; } = string.Empty;
    public string TaskCategoryCode { get; set; } = string.Empty;
    public string TaskCategoryDisplay { get; set; } = string.Empty;
    public string? ApplyFor { get; set; }
    public int? ApplyForUserTypeId { get; set; }
    public TeamManagementSlaDto? Sla { get; set; } = new();
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

public class TeamManagementSlaDto
{
    public double? RemainingMinutes { get; set; }
    public string DisplayText { get; set; } = "-";
    public bool IsOverdue { get; set; }
    public DateTime? DueOn { get; set; }
}

public class TeamManagementReassignRequest
{
    public string AssignedUserId { get; set; } = string.Empty;
    public List<TeamManagementReassignTaskDto> Tasks { get; set; } = [];
}

public class TeamManagementReassignTaskDto
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
}

public class TeamManagementReassignmentMembersRequest
{
    public string? SourceType { get; set; }
    public List<TeamManagementReassignTaskDto> Tasks { get; set; } = [];
}

public class TeamManagementReassignResponse
{
    public int ReassignedCount { get; set; }
    public List<TeamManagementReassignResultDto> Results { get; set; } = [];
}

public class TeamManagementReassignResultDto
{
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string AssignedUserId { get; set; } = string.Empty;
    public string AssignedUserName { get; set; } = string.Empty;
}

public class TeamManagementMembersResponse
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public List<TeamManagementMemberOptionDto> Members { get; set; } = [];
    public List<TeamManagementMemberCardDto> Cards { get; set; } = [];
}

public class TeamManagementMemberOptionDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
}

public class TeamManagementMemberCardDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public bool IsOnLeave { get; set; }
    public TeamManagementLeaveInfoDto? LeaveInfo { get; set; }
    public int TodoTaskCount { get; set; }
    public Dictionary<string, TeamManagementMemberMetricDto> MetricsByCategory { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public class TeamManagementLeaveInfoDto
{
    public string? LeaveReasonCode { get; set; }
    public string? LeaveReasonDisplay { get; set; }
    public string? Notes { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }
    public DateTime EffectiveFrom { get; set; }
}

public class TeamManagementMemberMetricDto
{
    public int CompletedTasks { get; set; }
    public int TotalAssignedTasks { get; set; }
    public double AvgProcessingTime { get; set; }
    public decimal SlaCompliance { get; set; }
    public int OverdueTasks { get; set; }
}

public class TeamManagementEmergencyLeaveRequest
{
    public string LeaveReasonCode { get; set; } = string.Empty;
    public DateTime ExpectedReturnDate { get; set; }
    public string? Notes { get; set; }
}

public class TeamManagementDutyStatusActionResponse
{
    public bool IsOnLeave { get; set; }
}

public class TeamManagementUrgentTaskAlertRunResponse
{
    public int ScannedCount { get; set; }
    public int MatchedCount { get; set; }
    public int NotifiedAdminCount { get; set; }
    public int NotifiedTaskCount { get; set; }
    public int SkippedTaskCount { get; set; }
}

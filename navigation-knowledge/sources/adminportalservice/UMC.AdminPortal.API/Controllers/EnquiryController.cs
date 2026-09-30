using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.Dtos;
using UMC.AdminPortal.Application.Services.EnquiryApp;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.Utils.Framework.Page;

namespace UMC.AdminPortal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EnquiryController(IEnquiryAppService appService) : ControllerBase
    {
        
        [HttpGet("EnquiryTypes")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryTypeObjDto>> GetEnquiryTypesAsync()
        {
            return await appService.GetEnquiryTypes(new EnquiryTypeDto().EnquiryType);
        }

        [HttpGet("EnquirySource")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryTypeObjDto>> GetEnquirySoruceAsync()
        {

            return await appService.GetEnquiryTypes(new EnquiryTypeDto().EnquirySource);
        }

        [HttpGet("EnquiryStatus")]
        public async Task<List<EnquiryTypeObjDto>> GetEnquiriesAsync()
        {
            return await appService.GetEnquiryTypes(new EnquiryTypeDto().EnquiryStatus);
        }

        [HttpGet("EnquiryIssueCategory")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryTypeObjDto>> EnquiryIssueCategoryAsync()
        {
            return await appService.GetEnquiryTypes(new EnquiryTypeDto().EnquiryIssueCategory);
        }

        [HttpGet("PriorityType")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryTypeObjDto>> GetEnquiriesPriorityTypeAsync()
        {
            return await appService.GetEnquiryPrioritiesAsync(); ;
        }

        [HttpGet("ProblemCauses")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryTypeObjDto>> GetEnquiriesProblemCausesAsync()
        {
            return await appService.GetProblemCausesAsync();
        }

      

        #region admin management


        [HttpPost("Management/New")]
        [RequirePermission(AccountPermissionCodes.Ticket.CreateModalSave, AccountPermissionCodes.Ticket.Create, AccountPermissionCodes.Ticket.CreateTableAdd)]
        public async Task<bool> AddEnquiriesAdminAsync([FromBody] EnquiryAdminReqestDot requestDto)
        {
            return await appService.AddEnquiryAdminAsync(requestDto);
        }

        [HttpGet("Management/List")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<PageResponse<EnquiryResponseValueObjAdminDto>> GetAdminEnquiriesAsync([FromQuery] EnquiryPageRequestAdminDto requestDto)
        {
            return await appService.GetAdminEnquiriesAsync(requestDto);
        }

        [HttpGet("Management/List/Export")]
        [RequirePermission(AccountPermissionCodes.Ticket.Export, AccountPermissionCodes.Ticket.ExportTable)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Enquiry.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> GetAdminManagementEnquiriesExportAsync([FromQuery] EnquiryPageRequestAdminDto requestDto)
        {
            var buffer = await appService.GetAdminTeamTaskEnquiriesExportAsync(requestDto);
            var fileName = $"Tickets-MyTasks-{DateTime.UtcNow.AddHours(4).ToString("ddMMyyyy-HHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpGet("Management/TeamTask/List")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<PageResponse<EnquiryResponseValueObjAdminDto>> GetAdminTeamTaskEnquiriesAsync([FromQuery] EnquiryPageRequestAdminDto requestDto)
        {
            return await appService.GetAdminTeamTaskEnquiriesAsync(requestDto);
        }

        [HttpGet("Management/Account/Tickets")]
        public async Task<PageResponse<EnquiryResponseValueObjAdminDto>> GetAdminAccountTaskEnquiriesAsync([FromQuery] EnquiryPageRequestAccountAdminDto requestDto)
        {
            return await appService.GetAdminAccountEnquiriesAsync(requestDto, requestDto.UserProfileId, requestDto.UserId);
        }

        [HttpGet("Management/Account/Tickets/StatusCount")]
        public async Task<EnquiryAdminCountDto> GetAdminAccountTaskEnquiriesAsync(string? _userId, int? _profileId)
        {
            return await appService.EnquiryAdminStatusAccountManagementCountAync( _userId, _profileId);
        }

        [HttpGet("Management/TeamTask/List/Export")]
        [RequirePermission(AccountPermissionCodes.Ticket.ExportTeamTasks)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Enquiry.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> GetAdminTeamTaskEnquiriesExportAsync([FromQuery] EnquiryPageRequestAdminDto requestDto)
        {
            int? departmentId = (int)DeptEnum.HappinessCenter;
            var buffer=  await appService.GetAdminTeamTaskEnquiriesExportAsync(requestDto,true, departmentId);
            var fileName = $"Tickets-TeamTasks-{DateTime.UtcNow.AddHours(4).ToString("ddMMyyyy-HHmmss")}.csv";
            return File(buffer, "text/csv", fileName);
        }

        [HttpGet("Management/TeamMenber/TeamTask")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<TeamMemberEnquiryTaskResponse>> GetAdminTeamTaskEnquiriesTeamsAsync([FromQuery] TeamMemberEnquiryTaskRequest requestDto)
        {
            return await appService.GetTeamMenberInfoAsync(requestDto);
        }


        [HttpGet("Management/Status/Count")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<EnquiryAdminCountDto> GetEnquiriesAdminCountAsync(bool? isTeamTask = false)
        {
            return await appService.EnquiryAdminStatusCountAync(isTeamTask);
        }

        [HttpGet("Management/Applications")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryApplicaitonDto>> GetEnquirApplicationByIdAsync(string? applicatinNo, int? size = 100)
        {
            return await appService.GetEnquirApplicationsAsync(applicatinNo, size);
        }


        [HttpGet("Management/EnquiryStatus")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryTypeObjDto>> GetEnquiriesStatusAsync()
        {
            return await appService.GetEnquiryTypes(new EnquiryTypeDto().EnquiryAdminStatus);
        }

        [HttpGet("Management/Departments")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<DepartmentDto>?> GetDepartmentsAsync()
        {
            return await appService.GetDepartmentsAsync();
        }

        [HttpGet("Management/{enquiryId}/EnquiryInfo")]
        [RequirePermission(AccountPermissionCodes.Ticket.Detail)]
        public async Task<EnquiryResponseValueObjAdminDto?> GetEnquiryAdminByIdAsync(int enquiryId)
        {
            return await appService.GetEnquiryAdminByIdAsync(enquiryId);
        }


        [HttpPost("Management/{enquiryId}/Conversation")]
        [RequirePermission(AccountPermissionCodes.Ticket.Conversation)]
        public async Task<bool> EnquiryConversationAdminAsync([FromBody] EnquiryConversationAdminDto reqest, int enquiryId)
        {
            return await appService.SaveConversationAdminAsync(enquiryId, reqest);
        }

        [HttpPost("Management/{enquiryId}/ChangeStatus")]
        [RequirePermission(AccountPermissionCodes.Ticket.ChangeStatusConfirm, AccountPermissionCodes.Ticket.ChangeStatus)]
        public async Task<bool> EnquiryCustomerChangeStatus([FromBody] EnquiryTransferRequest reqest, int enquiryId)
        {
            return await appService.SaveCustomerTransferAsync(enquiryId, reqest);
        }

        [HttpPost("Management/{enquiryId}/ProcessedTransfer")]
        [RequirePermission(AccountPermissionCodes.Ticket.TransferConfirm)]
        public async Task<bool> EnquiryProcessedTransferAsync([FromBody] EnquiryTransferRequest reqest, int enquiryId)
        {
            return await appService.SaveProcessedTransferAsync(enquiryId, reqest);
        }

        
        [HttpPost("Management/{enquiryId}/Process")]
        [RequirePermission(AccountPermissionCodes.Ticket.ProcessConfirm, AccountPermissionCodes.Ticket.SendBackConfirm, AccountPermissionCodes.Ticket.Process)]
        public async Task<bool> EnquiryProcessAdminAsync([FromBody] EnquiryProcessRequestDto reqest, int enquiryId)
        {
            return await appService.DepartmentProcessTicketAsync(enquiryId, reqest);
        }

        [HttpGet("Management/{enquiryId}/Timeline")]
        [RequirePermission(AccountPermissionCodes.Ticket.Detail)]
        public async Task<IEnumerable<EnquiryTransDto>> GetEnquiryTransAsync(int enquiryId)
        {
            return await appService.GetEnquiryTrackingsAsync(enquiryId);
        }


        [HttpGet("Management/Timeline")]
        [AllowAnonymous]
        public async Task<IEnumerable<EnquiryTransDto>> GetEnquiryTransNumberAsync(string enquiryNumber)
        {
            return await appService.GetEnquiryTrackingNumbersAsync(enquiryNumber);
        }

        [HttpGet("Management/UserInfo")]
        [RequirePermission(AccountPermissionCodes.Ticket.View, AccountPermissionCodes.Ticket.Detail)]
        public async Task<EnquiryCurrentUserInfoDto> GetEnquiryUserInfoAsync()
        {
            return await appService.GetEnquiryCurrentUserInfoAsync();
        }


        [HttpPut("Management/{enquiryId}/Assign")]
        [RequirePermission(AccountPermissionCodes.Ticket.AssignConfirm, AccountPermissionCodes.Ticket.Assign)]
        public async Task<bool> GetEnquiryUserInfoAsync(int enquiryId, EnquiryAssignReqeust request)
        {
            return await appService.AssignTicketAsync(enquiryId, request);
        }

        [HttpGet("Management/GetAssigns")]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<List<EnquiryAssignResponse>> GetEnquiryGetAssignsInfoAsync()
        {
            return await appService.GetCurtormerAssignUserAsync();
        }

        [HttpGet("Management/Application/Task")]
        [RequirePermission(AccountPermissionCodes.Ticket.View, AccountPermissionCodes.Ticket.Detail)]
        public async Task<EnquiryApplicationInfoDto> GetEnquiryApplicationTaskAsync(string applicationNo)
        {
            return await appService.GetEnquiryApplicationTaskAsync(applicationNo);
        }


        [HttpGet("Management/EnquiryInfo/{enquiryId}/Relate")]
        [RequirePermission(AccountPermissionCodes.Ticket.Detail)]
        public async Task<EnquiryRelatedInfoDto?> GetEnquiryTaskRelateAsync(int enquiryId)
        {
            return await appService.GetEnquiryRelatedInfoAsync(enquiryId);
        }

        [HttpGet("Management/EnquiryInfo/{enquiryId}/Applicants")]
        [RequirePermission(AccountPermissionCodes.Ticket.Detail)]
        public async Task<EnquiryApplicantInfo?> GetEnquiryTaskApplicantsAsync(int enquiryId)
        {
            return await appService.GetEnquiryTaskApplicantsAsync(enquiryId);
        }


        [HttpGet("public/EnquiryInfo")]
        [AllowAnonymous]
        public async Task<EnquiryResponseValueObjDto?> GetEnquiryCurrentUserInfoAsync(string enquiryNumber, string email)
        {
            return await  appService. GetEnquiryNumberInfoAsync(email, enquiryNumber);
        }
        #endregion

       

        [HttpGet("GetEnquiryAndTicketSLAExceeded")]
        [Authorize]
        [RequirePermission(AccountPermissionCodes.Ticket.View)]
        public async Task<bool?> GetEnquiryAndTicketSLAExceeded()
        {
            return await appService.GetEnquiryAndTicketSLAExceeded();
        }
        
    }
}

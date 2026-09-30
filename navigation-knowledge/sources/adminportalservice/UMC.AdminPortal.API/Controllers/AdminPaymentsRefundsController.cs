using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.Dtos.Refunds;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Application.Services.Refunds;

namespace UMC.AdminPortal.API.Controllers
{
    [Route("api/admin/payments/refunds")]
    [ApiController]
    [Authorize]
    public class AdminPaymentsRefundsController : ControllerBase
    {
        private readonly IRefundsAppService _refundsAppService;

        public AdminPaymentsRefundsController(IRefundsAppService refundsAppService)
        {
            _refundsAppService = refundsAppService;
        }

        [HttpGet]
        [RequirePermission(AccountPermissionCodes.Finance.Refund.View)]
        public async Task<ActionResult<RefundListResponseDto>> GetListAsync([FromQuery] RefundListRequestDto request)
        {
            var result = await _refundsAppService.GetListAsync(request);
            return Ok(result);
        }

        [HttpGet("statistics")]
        [RequirePermission(AccountPermissionCodes.Finance.Refund.Stats)]
        public async Task<ActionResult<RefundStatisticsDto>> GetStatisticsAsync()
        {
            var result = await _refundsAppService.GetStatisticsAsync();
            return Ok(result);
        }

        [HttpGet("{refundNo}")]
        [RequirePermission(AccountPermissionCodes.Finance.Refund.View)]
        public async Task<ActionResult<RefundDetailDto>> GetDetailAsync(string refundNo)
        {
            var result = await _refundsAppService.GetDetailAsync(refundNo);
            return Ok(result);
        }

        [HttpPost("{refundNo}/execute")]
        [RequirePermission(AccountPermissionCodes.Finance.Refund.Execute)]
        public async Task<ActionResult<ExecuteRefundResponseDto>> ExecuteAsync(string refundNo, [FromBody] ExecuteRefundRequestDto request)
        {
            request.RefundNo = string.IsNullOrWhiteSpace(request.RefundNo) ? refundNo : request.RefundNo;
            var result = await _refundsAppService.ExecuteAsync(refundNo, request);
            return Ok(result);
        }
    }
}


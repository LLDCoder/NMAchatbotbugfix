using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using UMC.AdminPortal.API.Authorization;
using UMC.AdminPortal.Application.Dtos;
using UMC.AdminPortal.Application.Dtos.Finance;
using UMC.AdminPortal.Application.Services.Finance;
using UMC.AdminPortal.Application.Services;
using UMC.AdminPortal.Application.Services.Permissions;
using UMC.AdminPortal.Domain.Shares;

namespace UMC.AdminPortal.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentAppService _paymentAppService;
        private readonly IAdminFinanceTransactionsAppService _adminFinanceTransactionsAppService;

        public PaymentsController(
            IPaymentAppService paymentAppService,
            IAdminFinanceTransactionsAppService adminFinanceTransactionsAppService)
        {
            _paymentAppService = paymentAppService;
            _adminFinanceTransactionsAppService = adminFinanceTransactionsAppService;
        }

        [HttpGet("dashboard/usertype/list")]
        [RequirePermission(AccountPermissionCodes.Finance.PaymentDashboard.View)]
        public async Task<UserTypeRevenueListResponse> GetUserTypeDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string orderby = "TotalRevenue",
            [FromQuery] string sort = "desc")
        {
            return await _paymentAppService.GetUserTypeDashboardListAsync(days, startDate, endDate, orderby, sort);
        }

        [HttpGet("dashboard/usertype/list/export")]
        [RequirePermission(AccountPermissionCodes.Finance.PaymentDashboard.View)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Finance.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportUserTypeDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string orderby = "TotalRevenue",
            [FromQuery] string sort = "desc")
        {
            var bytes = await _paymentAppService.ExportUserTypeDashboardListAsync(days, startDate, endDate, orderby, sort);
            return File(bytes, "text/csv", $"UserTypeRevenue_{DateTimeHelper.Now:yyyyMMddHHmmss}.csv");
        }

        [HttpGet("dashboard/emirates/list")]
        [RequirePermission(AccountPermissionCodes.Finance.PaymentDashboard.View)]
        public async Task<EmirateRevenueListResponse> GetEmirateDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string orderby = "TotalRevenue",
            [FromQuery] string sort = "desc")
        {
            return await _paymentAppService.GetEmirateDashboardListAsync(days, startDate, endDate, orderby, sort);
        }

        [HttpGet("dashboard/emirates/list/export")]
        [RequirePermission(AccountPermissionCodes.Finance.PaymentDashboard.View)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Finance.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportEmirateDashboardListAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string orderby = "TotalRevenue",
            [FromQuery] string sort = "desc")
        {
            var bytes = await _paymentAppService.ExportEmirateDashboardListAsync(days, startDate, endDate, orderby, sort);
            return File(bytes, "text/csv", $"EmirateRevenue_{DateTimeHelper.Now:yyyyMMddHHmmss}.csv");
        }

        [HttpGet("dashboard/statistics")]
        [RequirePermission(AccountPermissionCodes.Finance.PaymentDashboard.View)]
        public async Task<PaymentDashboardStatisticsDto> GetPaymentDashboardStatisticsAsync(
            [FromQuery] int days = 30,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            return await _paymentAppService.GetPaymentDashboardStatisticsAsync(days, startDate, endDate);
        }

        [HttpGet("/api/admin/finance/recharges")]
        [RequirePermission(AccountPermissionCodes.Finance.Recharge.View)]
        public async Task<AdminRechargeListResponseDto> GetAdminFinanceRechargesAsync([FromQuery] AdminRechargeListRequestDto request)
        {
            return await _adminFinanceTransactionsAppService.GetRechargesAsync(request);
        }

        [HttpGet("/api/admin/finance/recharges/statistics")]
        [RequirePermission(AccountPermissionCodes.Finance.Recharge.View)]
        public async Task<AdminRechargeStatisticsDto> GetAdminFinanceRechargeStatisticsAsync()
        {
            return await _adminFinanceTransactionsAppService.GetRechargeStatisticsAsync();
        }

        [HttpGet("/api/admin/finance/recharges/export")]
        [RequirePermission(AccountPermissionCodes.Finance.Recharge.Export)]
        [UMC.Utils.Framework.Logging.Client.LogOperation("Finance.Export", CaptureRequestParameters = false)]
        public async Task<IActionResult> ExportAdminFinanceRechargesAsync([FromQuery] AdminRechargeListRequestDto request)
        {
            var bytes = await _adminFinanceTransactionsAppService.ExportRechargesAsync(request);
            return File(bytes, "text/csv", $"AdminFinanceRecharges_{DateTimeHelper.Now:yyyyMMddHHmmss}.csv");
        }

        [HttpGet("/api/admin/application/{applicationId}")]
        // [RequirePermission(AccountPermissionCodes.Finance.Transaction.View)]
        public async Task<AdminFinanceServiceApplicationPaymentDto?> GetAdminFinanceServiceApplicationPaymentAsync(
            int applicationId,
            CancellationToken cancellationToken)
        {
            return await _adminFinanceTransactionsAppService.GetServiceApplicationPaymentAsync(applicationId, cancellationToken);
        }
    }
}

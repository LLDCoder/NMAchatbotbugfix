using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Data;
using Microsoft.EntityFrameworkCore;
using UMC.AdminPortal.Application.Dtos.Finance;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Models.Application;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Infrastructure;
using UMC.AdminPortal.Infrastructure.Models;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.Utils.Framework.Module.Attributes;

namespace UMC.AdminPortal.Application.Services.Finance
{
    [InjectOnScoped]
    public class AdminFinanceTransactionsAppService : IAdminFinanceTransactionsAppService
    {
        private const short RechargeTransactionTypeId = 1;
        private const short ServicePaymentTransactionTypeId = 2;
        private const short FinesTransactionTypeId = 3;
        private const short RefundTransactionTypeId = 4;
        private const short WalletPaymentMethodId = 9;
        private const short CardPaymentMethodId = 8;
        private const short CompletedTransactionStatusId = 3;
        private const short FailedTransactionStatusId = 4;
        private const short RefundFailedTransactionStatusId = 8;
        private static readonly int[] ServiceApplicationDepartmentIds = new[] { (int)DepartmentEnum.Licensing, (int)DepartmentEnum.Content };

        private const string TransactionTypeScope = "Wallet Transaction Type";
        private const string PaymentMethodScope = "PaymentMethod";
        private const string TransactionStatusScope = "Wallet Transaction Status";
        private const string ApplicationStatusScope = "ApplicationStatuses";
        private const string WalletStatusScope = "Wallet Status";
        private const string RefundReasonScope = "Refund ApplicationModel Reason";
        private const string RefundStatusScope = "Refund Status";
        private const string ViolationTypeScope = "InspectionViolationType";

        private readonly AdminPortalDBContext _dbContext;
        private readonly ITypeDictionaryService _typeDictionaryService;
        private readonly ICurrentUserService _currentUserService;

        public AdminFinanceTransactionsAppService(
            AdminPortalDBContext dbContext,
            ITypeDictionaryService typeDictionaryService,
            ICurrentUserService currentUserService)
        {
            _dbContext = dbContext;
            _typeDictionaryService = typeDictionaryService;
            _currentUserService = currentUserService;
        }

        public async Task<AdminPaymentTransactionListResponseDto> GetTransactionsAsync(AdminPaymentTransactionListRequestDto request)
        {
            var normalizedRequest = NormalizeTransactionRequest(request);
            var query = BuildTransactionsQuery(normalizedRequest);
            var totalCount = await query.CountAsync();
            var transactions = await ApplyTransactionSorting(query, normalizedRequest.SortBy, normalizedRequest.SortDirection, useCompletedAt: true)
                .Skip((normalizedRequest.PageIndex - 1) * normalizedRequest.PageSize)
                .Take(normalizedRequest.PageSize)
                .ToListAsync();

            return new AdminPaymentTransactionListResponseDto
            {
                Items = await MapTransactionsAsync(transactions),
                PageIndex = normalizedRequest.PageIndex,
                PageSize = normalizedRequest.PageSize,
                TotalCount = totalCount
            };
        }

        public async Task<AdminPaymentTransactionListResponseDto> GetTransactionsByUserOrProfileAsync(AdminPaymentTransactionListRequestDto request)
        {
            var normalizedRequest = NormalizeTransactionRequest(request);
            var query = await BuildTransactionsByUserOrProfileQueryAsync(normalizedRequest);
            var totalCount = await query.CountAsync();
            var transactions = await ApplyTransactionSorting(query, normalizedRequest.SortBy, normalizedRequest.SortDirection, useCompletedAt: true)
                .Skip((normalizedRequest.PageIndex - 1) * normalizedRequest.PageSize)
                .Take(normalizedRequest.PageSize)
                .ToListAsync();

            return new AdminPaymentTransactionListResponseDto
            {
                Items = await MapTransactionsAsync(transactions),
                PageIndex = normalizedRequest.PageIndex,
                PageSize = normalizedRequest.PageSize,
                TotalCount = totalCount
            };
        }

        public async Task<AdminPaymentTransactionSummaryResponseDto> GetTransactionSummaryByUserOrProfileAsync(AdminPaymentTransactionListRequestDto request)
        {
            var normalizedRequest = NormalizeTransactionRequest(request);
            var scope = await ResolveTransactionScopeAsync(normalizedRequest);

            var completedRequest = CreateCompletedSummaryRequest(normalizedRequest);
            var baseQuery = BuildTransactionsQuery(completedRequest);
            var scopedTransactionQuery = ApplyOwnershipScope(baseQuery, normalizedRequest, scope);

            var servicePaymentsTotal = await scopedTransactionQuery
                .Where(x => x.TransactionTypeId == ServicePaymentTransactionTypeId)
                .SumAsync(x => (decimal?)x.Amount) ?? 0m;

            var totalFinesPaid = await scopedTransactionQuery
                .Where(x => x.TransactionTypeId == FinesTransactionTypeId)
                .SumAsync(x => (decimal?)x.Amount) ?? 0m;

            var totalRefunds = Math.Abs(await scopedTransactionQuery
                .Where(x => x.TransactionTypeId == RefundTransactionTypeId)
                .SumAsync(x => (decimal?)x.Amount) ?? 0m);

            // Payment-center statistics revenue口径 (docs/bug/payment-center-transactions-statistics-calculation.md §4.2):
            //   total = serviceTotal(S) + fineTotal(F) - refundTotal(R).
            // Refunds must be subtracted, otherwise a user's spending is overstated by every completed refund.
            var totalSpending = servicePaymentsTotal + totalFinesPaid - totalRefunds;

            var serviceApplicationFees = await (
                from transaction in scopedTransactionQuery
                join application in _dbContext.Applications.AsNoTracking() on transaction.ReferenceNumber equals application.ApplicationNumber
                join service in _dbContext.ServiceConfigs.AsNoTracking() on application.ServiceId equals service.Id
                where transaction.TransactionTypeId == ServicePaymentTransactionTypeId
                      && service.Department.HasValue
                      && ServiceApplicationDepartmentIds.Contains(service.Department.Value)
                select (decimal?)transaction.Amount)
                .SumAsync() ?? 0m;

            // Subtract completed refunds whose original payment was a Licensing/Content service application fee.
            // Refund.RelatedTransactionId → original service-payment Transaction.Id.
            var serviceApplicationRefunds = Math.Abs(await (
                from refund in scopedTransactionQuery
                join original in _dbContext.Transactions.AsNoTracking() on refund.RelatedTransactionId equals original.Id
                join application in _dbContext.Applications.AsNoTracking() on original.ReferenceNumber equals application.ApplicationNumber
                join service in _dbContext.ServiceConfigs.AsNoTracking() on application.ServiceId equals service.Id
                where refund.TransactionTypeId == RefundTransactionTypeId
                      && original.TransactionTypeId == ServicePaymentTransactionTypeId
                      && service.Department.HasValue
                      && ServiceApplicationDepartmentIds.Contains(service.Department.Value)
                select (decimal?)refund.Amount)
                .SumAsync() ?? 0m);

            serviceApplicationFees -= serviceApplicationRefunds;

            var totalRecharge = await BuildRechargeSummaryQuery(scope.RechargeUserId, normalizedRequest.StartDate, normalizedRequest.EndDate)
                .SumAsync(x => (decimal?)x.Amount) ?? 0m;

            return new AdminPaymentTransactionSummaryResponseDto
            {
                TotalSpending = totalSpending,
                ServiceApplicationFees = serviceApplicationFees,
                TotalFinesPaid = totalFinesPaid,
                TotalRefunds = totalRefunds,
                TotalRecharge = totalRecharge
            };
        }

        public async Task<AdminFinanceTransactionDetailDto?> GetTransactionAsync(string transactionNo)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(transactionNo);

            var transaction = await _dbContext.Transactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.TransactionNo == transactionNo);

            if (transaction == null)
            {
                return null;
            }

            var extendedLookupBundle = await GetScopedLookupBundleAsync(
                TransactionTypeScope,
                PaymentMethodScope,
                TransactionStatusScope,
                ApplicationStatusScope,
                WalletStatusScope,
                RefundReasonScope,
                RefundStatusScope,
                ViolationTypeScope);
            var applyForMap = await GetApplyForMapAsync(new[] { transaction });
            var profileInfo = transaction.ProfileId.HasValue && applyForMap.TryGetValue(transaction.ProfileId.Value, out var mappedProfile)
                ? mappedProfile
                : null;

            var transactionTypeName = extendedLookupBundle.GetName(TransactionTypeScope, transaction.TransactionTypeId, GetDefaultTransactionTypeName(transaction.TransactionTypeId));
            var paymentMethodName = extendedLookupBundle.GetName(PaymentMethodScope, transaction.PaymentMethodId, GetDefaultPaymentMethodName(transaction.PaymentMethodId));
            var statusName = extendedLookupBundle.GetName(TransactionStatusScope, transaction.StatusId, GetDefaultTransactionStatusName(transaction.StatusId));
            var refundId = await GetRefundIdAsync(transaction);
            var refundExecution = await GetRefundExecutionContextAsync(transaction);

            var detail = new AdminFinanceTransactionDetailDto
            {
                Transaction = new AdminFinanceTransactionInfoDto
                {
                    Id = transaction.Id,
                    TransactionNo = transaction.TransactionNo,
                    RefundId = refundId,
                    TransactionTypeId = transaction.TransactionTypeId,
                    TransactionTypeObj = CreateValueObject(transaction.TransactionTypeId, transactionTypeName),
                    PaymentMethodId = transaction.PaymentMethodId,
                    PaymentMethodObj = CreateValueObject(transaction.PaymentMethodId, paymentMethodName),
                    Amount = Math.Abs(transaction.Amount),
                    StatusId = transaction.StatusId,
                    StatusObj = CreateValueObject(transaction.StatusId, statusName),
                    Description = transaction.Description,
                    CreatedOn = transaction.CreatedOn,
                    CompletedAt = transaction.CompletedAt,
                    UpdateOn = transaction.CompletedAt ?? transaction.CreatedOn,
                    ReferenceNumber = transaction.ReferenceNumber,
                    ApplyForObj = profileInfo,
                    BalanceBefore = transaction.BalanceBefore,
                    BalanceAfter = transaction.BalanceAfter,
                    MaskedCardNumber = Coalesce(transaction.MaskedCardNumber, refundExecution?.MaskedCardNumber),
                    CardBrand = Coalesce(transaction.CardBrand, refundExecution?.CardBrand)
                },
                ApplicationItems = await GetTransactionApplicationsAsync(transaction, profileInfo, extendedLookupBundle),
                Refund = await GetTransactionRefundAsync(transaction, profileInfo, extendedLookupBundle, refundExecution),
                AccountInfo = await GetTransactionAccountInfoAsync(transaction, extendedLookupBundle),
                RelatedViolation = await GetTransactionRelatedViolationAsync(transaction, extendedLookupBundle)
            };

            return detail;
        }

        public async Task<AdminPaymentTransactionStatisticsDto> GetTransactionStatisticsAsync()
        {
            var summary = await _dbContext.Transactions
                .AsNoTracking()
                .Where(x => x.StatusId == CompletedTransactionStatusId && x.TransactionTypeId != RechargeTransactionTypeId)
                .GroupBy(x => x.TransactionTypeId)
                .Select(group => new
                {
                    TransactionTypeId = group.Key,
                    Count = group.Count(),
                    Amount = group.Sum(x => x.Amount)
                })
                .ToListAsync();

            var totalPayments = summary.Sum(x => x.Count);
            var servicePayments = summary.FirstOrDefault(x => x.TransactionTypeId == ServicePaymentTransactionTypeId)?.Amount ?? 0m;
            var fines = summary.FirstOrDefault(x => x.TransactionTypeId == FinesTransactionTypeId)?.Amount ?? 0m;
            var refunds = Math.Abs(summary.FirstOrDefault(x => x.TransactionTypeId == RefundTransactionTypeId)?.Amount ?? 0m);

            // The current window keeps the AddDays(-7) convention already used by the recharge statistics,
            // and the preceding window has the same length so the growth comparison is not biased.
            var currentWindowStart = DateTimeHelper.Now.Date.AddDays(-6);
            var previousWindowStart = currentWindowStart.AddDays(-7);

            var currentWindow = await GetTransactionWindowSummaryAsync(currentWindowStart, null);
            var previousWindow = await GetTransactionWindowSummaryAsync(previousWindowStart, currentWindowStart);

            var last7DaysPayments = CountOf(currentWindow);
            var last7DaysRevenue = RevenueOf(currentWindow);

            return new AdminPaymentTransactionStatisticsDto
            {
                TotalPayments = totalPayments,
                TotalRevenue = servicePayments + fines - refunds,
                ServiceApplicationPayments = servicePayments,
                Fines = fines,
                Refunds = refunds,
                PaymentsDataStatistics = new AdminPaymentsDataStatisticsDto
                {
                    Last7DaysTotal = last7DaysPayments,
                    GrowthCount = last7DaysPayments - CountOf(previousWindow)
                },
                RevenuesDataStatistics = new AdminRevenuesDataStatisticsDto
                {
                    Last7DaysTotal = last7DaysRevenue,
                    RevenueAmount = last7DaysRevenue - RevenueOf(previousWindow)
                }
            };
        }

        /// <summary>Completed non-recharge transactions grouped by type within [startDate, endDate).</summary>
        private async Task<List<TransactionTypeTotal>> GetTransactionWindowSummaryAsync(DateTime startDate, DateTime? endDate)
        {
            return await _dbContext.Transactions
                .AsNoTracking()
                .Where(x =>
                    x.StatusId == CompletedTransactionStatusId &&
                    x.TransactionTypeId != RechargeTransactionTypeId &&
                    x.CreatedOn.Date >= startDate &&
                    (endDate == null || x.CreatedOn.Date < endDate))
                .GroupBy(x => x.TransactionTypeId)
                .Select(group => new TransactionTypeTotal
                {
                    TransactionTypeId = group.Key,
                    Count = group.Count(),
                    Amount = group.Sum(x => x.Amount)
                })
                .ToListAsync();
        }

        private static int CountOf(List<TransactionTypeTotal> window) => window.Sum(x => x.Count);

        private static decimal RevenueOf(List<TransactionTypeTotal> window)
        {
            decimal AmountOf(short transactionTypeId) =>
                window.FirstOrDefault(x => x.TransactionTypeId == transactionTypeId)?.Amount ?? 0m;

            return AmountOf(ServicePaymentTransactionTypeId)
                + AmountOf(FinesTransactionTypeId)
                - Math.Abs(AmountOf(RefundTransactionTypeId));
        }

        private class TransactionTypeTotal
        {
            public short TransactionTypeId { get; set; }
            public int Count { get; set; }
            public decimal Amount { get; set; }
        }

        public async Task<AdminPaymentMethodStatisticsDto> GetPaymentMethodStatisticsAsync()
        {
            var paymentMethodTotals = await _dbContext.Transactions
                .AsNoTracking()
                .Where(x => x.StatusId == CompletedTransactionStatusId && x.TransactionTypeId != RechargeTransactionTypeId)
                .GroupBy(x => x.PaymentMethodId)
                .Select(group => new
                {
                    PaymentMethodId = group.Key,
                    Count = group.Count()
                })
                .ToListAsync();

            var failedTotal = await _dbContext.Transactions
                .AsNoTracking()
                .CountAsync(x => x.TransactionTypeId != RechargeTransactionTypeId && x.StatusId == FailedTransactionStatusId);

            var failedRefundTotal = await _dbContext.Transactions
                .AsNoTracking()
                .CountAsync(x => x.StatusId == RefundFailedTransactionStatusId);

            return new AdminPaymentMethodStatisticsDto
            {
                WalletTotal = paymentMethodTotals.FirstOrDefault(x => x.PaymentMethodId == WalletPaymentMethodId)?.Count ?? 0m,
                CardTotal = paymentMethodTotals.FirstOrDefault(x => x.PaymentMethodId == CardPaymentMethodId)?.Count ?? 0m,
                FailedTotal = failedTotal,
                FailedRefundTotal = failedRefundTotal
            };
        }

        public async Task<byte[]> ExportTransactionsAsync(AdminPaymentTransactionListRequestDto request)
        {
            var normalizedRequest = NormalizeTransactionRequest(request);
            var query = BuildTransactionsQuery(normalizedRequest);
            var transactions = await ApplyTransactionSorting(query, normalizedRequest.SortBy, normalizedRequest.SortDirection, useCompletedAt: true)
                .ToListAsync();
            var items = await MapTransactionsAsync(transactions);

            return BuildCsv(
            _currentUserService.IsArabicLanguage
            ? new[]
            {
            "رقم المعاملة",
            "النوع",
            "الغرض",
            "طريقة الدفع",
            "المبلغ (درهم)",
            "الحالة",
            "وقت المعاملة"
            }
            : new[]
            {
            "Transaction No.",
            "Type",
            "Apply For",
            "Payment Method",
            "Amount(AED)",
            "Status",
            "Transaction Time"
            },
            items.Select(item => new[]
            {
            ToCsvTextValue(item.TransactionNo),
            item.TransactionType,
            ResolveExportApplyFor(item),
            item.PaymentMethod,
            item.Amount.ToString("F2"),
            item.Status,
            item.CreatedOn.ToString("dd/MM/yyyy HH:mm:ss")
            }));
        }

        public async Task<AdminRechargeListResponseDto> GetRechargesAsync(AdminRechargeListRequestDto request)
        {
            var normalizedRequest = NormalizeRechargeRequest(request);
            var query = BuildRechargesQuery(normalizedRequest);
            var totalCount = await query.CountAsync();
            var transactions = await ApplyTransactionSorting(query, normalizedRequest.SortBy, normalizedRequest.SortDirection)
                .Skip((normalizedRequest.PageIndex - 1) * normalizedRequest.PageSize)
                .Take(normalizedRequest.PageSize)
                .ToListAsync();

            return new AdminRechargeListResponseDto
            {
                Items = await MapRechargesAsync(transactions),
                PageIndex = normalizedRequest.PageIndex,
                PageSize = normalizedRequest.PageSize,
                TotalCount = totalCount
            };
        }

        public async Task<AdminRechargeStatisticsDto> GetRechargeStatisticsAsync()
        {
            var rechargeSummary = await _dbContext.Transactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId == RechargeTransactionTypeId)
                .GroupBy(x => x.StatusId)
                .Select(group => new
                {
                    StatusId = group.Key,
                    Count = group.Count(),
                    Amount = group.Sum(x => x.Amount)
                })
                .ToListAsync();

            var completedCount = rechargeSummary.FirstOrDefault(x => x.StatusId == CompletedTransactionStatusId)?.Count ?? 0;
            var failedCount = rechargeSummary.FirstOrDefault(x => x.StatusId == FailedTransactionStatusId)?.Count ?? 0;
            var completedAmount = rechargeSummary.FirstOrDefault(x => x.StatusId == CompletedTransactionStatusId)?.Amount ?? 0m;

            var last7DaysStart = DateTimeHelper.Now.Date.AddDays(-6);
            var last7DaysCompletedAmount = await _dbContext.Transactions
                .AsNoTracking()
                .Where(x =>
                    x.TransactionTypeId == RechargeTransactionTypeId &&
                    x.StatusId == CompletedTransactionStatusId &&
                    x.CreatedOn.Date >= last7DaysStart)
                .SumAsync(x => (decimal?)x.Amount) ?? 0m;

            var paymentMethodTotals = await _dbContext.Transactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId == RechargeTransactionTypeId && x.StatusId == CompletedTransactionStatusId)
                .GroupBy(x => x.PaymentMethodId)
                .Select(group => new
                {
                    PaymentMethodId = group.Key,
                    Amount = group.Sum(x => x.Amount)
                })
                .ToListAsync();

            return new AdminRechargeStatisticsDto
            {
                TotalRecharges = completedCount + failedCount,
                TotalRechargeAmount = completedAmount,
                Last7DaysRechangeAmount = last7DaysCompletedAmount,
                CompletedRecharges = completedCount,
                FailRecharges = failedCount,
                RechargeCount = completedCount + failedCount,
                RechargeAmount = completedAmount,
                WalletRechargeAmount = paymentMethodTotals.FirstOrDefault(x => x.PaymentMethodId == WalletPaymentMethodId)?.Amount ?? 0m,
                CardRechargeAmount = paymentMethodTotals.FirstOrDefault(x => x.PaymentMethodId == CardPaymentMethodId)?.Amount ?? 0m
            };
        }

        public async Task<byte[]> ExportRechargesAsync(AdminRechargeListRequestDto request)
        {
            var normalizedRequest = NormalizeRechargeRequest(request);
            var query = BuildRechargesQuery(normalizedRequest);
            var transactions = await ApplyTransactionSorting(query, normalizedRequest.SortBy, normalizedRequest.SortDirection)
                .ToListAsync();
            var items = await MapRechargesAsync(transactions);

            return BuildCsv(
                _currentUserService.IsArabicLanguage
                ? new[]
                {
                    "رقم المعاملة",
                    "صاحب الحساب",
                    "البريد الإلكتروني للحساب",
                    "المبلغ",
                    "الحالة",
                    "وقت المعاملة"
                }
                : new[]
                {
                    "Transaction No.",
                    "Account Holder",
                    "Account Email",
                    "Amount",
                    "Status",
                    "Transaction Time"
                },
                items.Select(item => new[]
                {
                    item.TransactionNo,
                    item.AccountName ?? string.Empty,
                    item.AccountEmail ?? string.Empty,
                    item.Amount.ToString("F2"),
                    item.Status,
                    item.CreatedTime?.ToString("dd/MM/yyyy HH:mm:ss") ?? string.Empty
                }));
        }

        public async Task<AdminFinanceServiceApplicationPaymentDto?> GetServiceApplicationPaymentAsync(
            int applicationId,
            CancellationToken cancellationToken = default)
        {
            ArgumentOutOfRangeException.ThrowIfNegativeOrZero(applicationId);

            if (!await ServiceApplicationPaymentsTableExistsAsync(cancellationToken))
            {
                return null;
            }

            var payment = await _dbContext.ServiceApplicationPayments
                .AsNoTracking()
                .Where(x => x.ApplicationId == applicationId)
                .OrderByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (payment == null)
            {
                return null;
            }

            return new AdminFinanceServiceApplicationPaymentDto
            {
                Id = payment.Id,
                ApplicationId = payment.ApplicationId,
                ServiceId = payment.ServiceId,
                Amount = payment.Amount,
                CurrencyCode = payment.CurrencyCode,
                FeeVersion = payment.FeeVersion,
                FeeBreakdownJson = payment.FeeBreakdownJson,
                FeeWarningsJson = payment.FeeWarningsJson,
                FreeDecisionJson = payment.FreeDecisionJson,
                FeeQuoteRawResponseJson = payment.FeeQuoteRawResponseJson,
                PricingSource = payment.PricingSource,
                ManualPricingType = payment.ManualPricingType,
                UserTypeCode = payment.UserTypeCode,
                PricingConfigurationId = payment.PricingConfigurationId,
                PricingSnapshotJson = payment.PricingSnapshotJson,
                ReceiptWithHeaderUrl = payment.ReceiptWithHeaderUrl,
                PaymentReceiptWithHeaderUrl = payment.PaymentReceiptWithHeaderUrl,
                ChannelId = payment.ChannelId,
                ExpiresAt = payment.ExpiresAt,
                Status = payment.Status,
                CreatedOn = payment.CreatedOn,
                UpdatedOn = payment.UpdatedOn
            };
        }

        private async Task<bool> ServiceApplicationPaymentsTableExistsAsync(CancellationToken cancellationToken)
        {
            if (!_dbContext.Database.IsRelational())
            {
                return true;
            }

            var connectionString = _dbContext.Database.GetConnectionString();
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                return false;
            }

            var connection = _dbContext.Database.GetDbConnection();
            var openedHere = false;
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
                openedHere = true;
            }

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = """
                                      SELECT 1
                                      FROM sys.tables t
                                      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
                                      WHERE t.name = 'ServiceApplicationPayments'
                                        AND s.name = 'Payment'
                                      """;
                var result = await command.ExecuteScalarAsync(cancellationToken);

                return result != null && result != DBNull.Value;
            }
            finally
            {
                if (openedHere)
                {
                    await connection.CloseAsync();
                }
            }
        }

        public Task<List<AdminFinanceLookupItemDto>> GetTransactionTypesAsync()
            => GetLookupItemsAsync(TransactionTypeScope);

        public Task<List<AdminFinanceLookupItemDto>> GetTransactionStatusesAsync()
            => GetLookupItemsAsync(TransactionStatusScope);

        public Task<List<AdminFinanceLookupItemDto>> GetPaymentMethodsAsync()
            => GetLookupItemsAsync(PaymentMethodScope);

        private IQueryable<Transaction> BuildTransactionsQuery(AdminPaymentTransactionListRequestDto request)
        {
            var query = _dbContext.Transactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId != RechargeTransactionTypeId);

            query = ApplyTransactionFilters(
                query,
                request.Keyword,
                request.TransactionTypeId,
                request.PaymentMethodId,
                request.StatusId,
                request.StartDate,
                request.EndDate,
                useCompletedAt: true);

            return query;
        }

        private IQueryable<Transaction> BuildRechargeSummaryQuery(string? userId, DateTime? startDate, DateTime? endDate)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return _dbContext.Transactions
                    .AsNoTracking()
                    .Where(x => false);
            }

            var query = _dbContext.Transactions
                .AsNoTracking()
                .Where(x =>
                    x.TransactionTypeId == RechargeTransactionTypeId &&
                    x.StatusId == CompletedTransactionStatusId &&
                    x.CreatedBy == userId);

            if (startDate.HasValue)
            {
                var normalizedStart = startDate.Value.Date;
                query = query.Where(x => x.CreatedOn >= normalizedStart);
            }

            if (endDate.HasValue)
            {
                var normalizedEnd = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(x => x.CreatedOn <= normalizedEnd);
            }

            return query;
        }

        private async Task<IQueryable<Transaction>> BuildTransactionsByUserOrProfileQueryAsync(AdminPaymentTransactionListRequestDto request)
        {
            var query = BuildTransactionsQuery(request);
            var scope = await ResolveTransactionScopeAsync(request);
            return ApplyProfileScope(query, scope.ProfileIds);
        }

        private IQueryable<Transaction> BuildRechargesQuery(AdminRechargeListRequestDto request)
        {
            var query = _dbContext.Transactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId == RechargeTransactionTypeId);

            query = ApplyRechargeFilters(query, request);

            return query;
        }

        private IQueryable<Transaction> ApplyRechargeFilters(
            IQueryable<Transaction> query,
            AdminRechargeListRequestDto request)
        {
            if (!string.IsNullOrWhiteSpace(request.Keyword))
            {
                var normalizedKeyword = request.Keyword.Trim();
                var matchingUserIds = _dbContext.Users
                    .AsNoTracking()
                    .Where(x =>
                        ((x.FirstName ?? string.Empty) + " " + (x.LastName ?? string.Empty)).Contains(normalizedKeyword) ||
                        (x.Email ?? string.Empty).Contains(normalizedKeyword))
                    .Select(x => x.Id);

                query = query.Where(x => x.TransactionNo.Contains(normalizedKeyword) || matchingUserIds.Contains(x.CreatedBy));
            }

            if (request.PaymentMethodId.HasValue && request.PaymentMethodId.Value > 0)
            {
                query = query.Where(x => x.PaymentMethodId == request.PaymentMethodId.Value);
            }

            if (request.StatusId.HasValue && request.StatusId.Value > 0)
            {
                query = query.Where(x => x.StatusId == request.StatusId.Value);
            }

            if (request.StartDate.HasValue && request.EndDate.HasValue)
            {
                var normalizedStart = request.StartDate.Value.Date;
                var normalizedEnd = request.EndDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(x => x.CreatedOn >= normalizedStart && x.CreatedOn <= normalizedEnd);
            }

            return query;
        }

        private IQueryable<Transaction> ApplyTransactionFilters(
            IQueryable<Transaction> query,
            string? keyword,
            short? transactionTypeId,
            short? paymentMethodId,
            short? statusId,
            DateTime? startDate,
            DateTime? endDate,
            bool useCompletedAt)
        {
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var normalizedKeyword = keyword.Trim();
                // Apply For / Account Holder are resolved from the profile after paging (see
                // GetApplyForMapAsync), so the keyword has to be matched against the same
                // profile sources here to keep the search consistent with what the list shows.
                var matchingProfileIds = BuildKeywordProfileIdQuery(normalizedKeyword);

                query = query.Where(x =>
                    x.TransactionNo.Contains(normalizedKeyword) ||
                    (x.ReferenceNumber != null && x.ReferenceNumber.Contains(normalizedKeyword)) ||
                    (x.Description != null && x.Description.Contains(normalizedKeyword)) ||
                    (x.AppliedFor != null && x.AppliedFor.Contains(normalizedKeyword)) ||
                    (x.PaymentId != null && x.PaymentId.Contains(normalizedKeyword)) ||
                    (x.TranId != null && x.TranId.Contains(normalizedKeyword)) ||
                    (x.ProfileId.HasValue && matchingProfileIds.Contains(x.ProfileId.Value)));
            }

            if (transactionTypeId.HasValue && transactionTypeId.Value > 0)
            {
                query = query.Where(x => x.TransactionTypeId == transactionTypeId.Value);
            }

            if (paymentMethodId.HasValue && paymentMethodId.Value > 0)
            {
                query = query.Where(x => x.PaymentMethodId == paymentMethodId.Value);
            }

            if (statusId.HasValue && statusId.Value > 0)
            {
                query = query.Where(x => x.StatusId == statusId.Value);
            }

            if (startDate.HasValue)
            {
                var normalizedStart = startDate.Value.Date;
                query = useCompletedAt
                    ? query.Where(x => x.CompletedAt.HasValue && x.CompletedAt.Value >= normalizedStart)
                    : query.Where(x => x.CreatedOn >= normalizedStart);
            }

            if (endDate.HasValue)
            {
                var normalizedEnd = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = useCompletedAt
                    ? query.Where(x => x.CompletedAt.HasValue && x.CompletedAt.Value <= normalizedEnd)
                    : query.Where(x => x.CreatedOn <= normalizedEnd);
            }

            return query;
        }

        /// <summary>
        /// Profile ids whose Apply For name or Account/Card Holder name matches the keyword.
        /// Mirrors the display sources used by <see cref="GetApplyForMapAsync"/>: profile entity
        /// name, linked establishment name, account holder name/username/email and profile code.
        /// </summary>
        private IQueryable<int> BuildKeywordProfileIdQuery(string keyword)
        {
            var matchingUserIds = _dbContext.Users
                .AsNoTracking()
                .Where(x =>
                    ((x.FirstName ?? string.Empty) + " " + (x.LastName ?? string.Empty)).Contains(keyword) ||
                    x.UserName.Contains(keyword) ||
                    (x.Email ?? string.Empty).Contains(keyword))
                .Select(x => x.Id);

            var matchingEstablishmentIds = _dbContext.Establishments
                .AsNoTracking()
                .Where(x => x.NameEn.Contains(keyword) || x.NameAr.Contains(keyword))
                .Select(x => x.Id);
            var matchingPersonIds = _dbContext.Persons
                .AsNoTracking()
                .Where(x => x.Name.Contains(keyword) || (x.NameAr ?? string.Empty).Contains(keyword))
                .Select(x => x.Id);

            var establishmentProfileIds = _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(x => matchingEstablishmentIds.Contains(x.EstablishmentId))
                .Select(x => x.UserProfileId);

            return _dbContext.UserProfiles
                .AsNoTracking()
                .Where(x =>
                    (x.EntityName ?? string.Empty).Contains(keyword) ||
                    (x.ProfileCode ?? string.Empty).Contains(keyword) ||
                    matchingPersonIds.Contains(x.PersonId) ||
                    matchingUserIds.Contains(x.UserId) ||
                    establishmentProfileIds.Contains(x.Id))
                .Select(x => x.Id);
        }

        private async Task<TransactionScope> ResolveTransactionScopeAsync(AdminPaymentTransactionListRequestDto request)
        {
            if (request.ProfileId.HasValue && request.ProfileId.Value > 0)
            {
                var profile = await _dbContext.UserProfiles
                    .AsNoTracking()
                    .Where(x => x.Id == request.ProfileId.Value)
                    .Select(x => new { x.Id, x.UserId })
                    .FirstOrDefaultAsync();

                return profile == null
                    ? new TransactionScope(new List<int> { request.ProfileId.Value }, null)
                    : new TransactionScope(new List<int> { profile.Id }, NormalizeUserId(profile.UserId));
            }

            var normalizedUserId = NormalizeUserId(request.UserId);
            if (string.IsNullOrWhiteSpace(normalizedUserId))
            {
                throw new ArgumentException("Either userId or profileId must be provided.", nameof(request));
            }

            var profileIds = await _dbContext.UserProfiles
                .AsNoTracking()
                .Where(x => x.UserId == normalizedUserId)
                .Select(x => x.Id)
                .ToListAsync();

            return new TransactionScope(profileIds, normalizedUserId);
        }

        private static AdminPaymentTransactionListRequestDto CreateCompletedSummaryRequest(AdminPaymentTransactionListRequestDto request)
        {
            return new AdminPaymentTransactionListRequestDto
            {
                UserId = request.UserId,
                ProfileId = request.ProfileId,
                StatusId = CompletedTransactionStatusId,
                StartDate = request.StartDate,
                EndDate = request.EndDate
            };
        }

        private static IQueryable<Transaction> ApplyProfileScope(IQueryable<Transaction> query, IReadOnlyCollection<int> profileIds)
        {
            if (profileIds.Count == 0)
            {
                return query.Where(x => false);
            }

            return query.Where(x => x.ProfileId.HasValue && profileIds.Contains(x.ProfileId.Value));
        }

        /// <summary>
        /// Applies the payment-center statistics ownership scope (see
        /// docs/bug/payment-center-transactions-statistics-calculation.md §4.1).
        /// Single-profile view (an explicit profileId&gt;0) is intentionally restricted to
        /// <c>ProfileId == profileId</c> and never adds <c>CreatedBy == userId</c>, because
        /// CreatedBy is account-level and shared across every profile of that account, so
        /// including it would leak the whole account's data into a single-profile view.
        /// Account view (only a userId is supplied) resolves to that account's profileIds and
        /// unions <c>CreatedBy == userId</c> to cover institution rows booked by ProfileId with
        /// an empty CreatedBy as well as personal rows tagged only by CreatedBy. When neither a
        /// profileId nor a userId can be resolved the query is closed (fail-closed, never a
        /// full-table fallback).
        /// </summary>
        private static IQueryable<Transaction> ApplyOwnershipScope(
            IQueryable<Transaction> query,
            AdminPaymentTransactionListRequestDto request,
            TransactionScope scope)
        {
            var isSingleProfileView = request.ProfileId.HasValue && request.ProfileId.Value > 0;
            if (isSingleProfileView)
            {
                return ApplyProfileScope(query, scope.ProfileIds);
            }

            var normalizedUserId = scope.RechargeUserId;
            var profileIds = scope.ProfileIds;

            if (string.IsNullOrWhiteSpace(normalizedUserId) && profileIds.Count == 0)
            {
                return query.Where(x => false);
            }

            return query.Where(x =>
                (normalizedUserId != null && x.CreatedBy == normalizedUserId) ||
                (x.ProfileId.HasValue && profileIds.Contains(x.ProfileId.Value)));
        }

        private static string? NormalizeUserId(string? userId)
        {
            return string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        }

        private static IQueryable<Transaction> ApplyTransactionSorting(
            IQueryable<Transaction> query,
            string? sortBy,
            string? sortDirection,
            bool useCompletedAt = false)
        {
            var normalizedSortBy = NormalizeSortBy(sortBy, useCompletedAt);
            var isAscending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);

            return normalizedSortBy switch
            {
                "transactionno" => isAscending
                    ? query.OrderBy(x => x.TransactionNo)
                    : query.OrderByDescending(x => x.TransactionNo),
                "referencenumber" => isAscending
                    ? query.OrderBy(x => x.ReferenceNumber).ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.ReferenceNumber).ThenByDescending(x => x.CreatedOn),
                "transactiontypeid" or "transactiontype" => isAscending
                    ? query.OrderBy(x => x.TransactionTypeId).ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.TransactionTypeId).ThenByDescending(x => x.CreatedOn),
                "paymentmethodid" or "paymentmethod" => isAscending
                    ? query.OrderBy(x => x.PaymentMethodId).ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.PaymentMethodId).ThenByDescending(x => x.CreatedOn),
                "statusid" or "status" => isAscending
                    ? query.OrderBy(x => x.StatusId).ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.StatusId).ThenByDescending(x => x.CreatedOn),
                "amount" => isAscending
                    ? query.OrderBy(x => x.Amount).ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.Amount).ThenByDescending(x => x.CreatedOn),
                "completedat" when useCompletedAt => isAscending
                    ? query.OrderBy(x => x.CompletedAt)
                    .ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.CompletedAt)
                    .ThenByDescending(x => x.CreatedOn),
                "profileid" => isAscending
                    ? query.OrderBy(x => x.ProfileId).ThenBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.ProfileId).ThenByDescending(x => x.CreatedOn),
                _ => isAscending
                    ? query.OrderBy(x => x.CreatedOn)
                    : query.OrderByDescending(x => x.CreatedOn)
            };
        }

        private static string? NormalizeSortBy(string? sortBy, bool useCompletedAt)
        {
            if (!useCompletedAt)
            {
                var normalizedPlainSortBy = sortBy?.Trim().ToLowerInvariant();
                return normalizedPlainSortBy == "updateon" ? "createdon" : normalizedPlainSortBy;
            }

            if (string.IsNullOrWhiteSpace(sortBy))
            {
                return "completedat";
            }

            var normalizedSortBy = sortBy.Trim().ToLowerInvariant();
            return normalizedSortBy switch
            {
                "createdon" or "updateon" => "completedat",
                _ => normalizedSortBy
            };
        }

        private async Task<List<AdminPaymentTransactionListItemDto>> MapTransactionsAsync(List<Transaction> transactions)
        {
            var lookupBundle = await GetLookupBundleAsync();
            var applyForMap = await GetApplyForMapAsync(transactions);

            return transactions.Select(transaction =>
            {
                var transactionTypeName = lookupBundle.GetName(TransactionTypeScope, transaction.TransactionTypeId, GetDefaultTransactionTypeName(transaction.TransactionTypeId));
                var paymentMethodName = lookupBundle.GetName(PaymentMethodScope, transaction.PaymentMethodId, GetDefaultPaymentMethodName(transaction.PaymentMethodId));
                var statusName = lookupBundle.GetName(TransactionStatusScope, transaction.StatusId, GetDefaultTransactionStatusName(transaction.StatusId));
                var (balanceBefore, balanceAfter) = GetBalanceValues(transaction);
                applyForMap.TryGetValue(transaction.ProfileId ?? 0, out var applyFor);

                return new AdminPaymentTransactionListItemDto
                {
                    Id = transaction.Id,
                    TransactionNo = transaction.TransactionNo,
                    TransactionTypeId = transaction.TransactionTypeId,
                    TransactionTypeObj = new AdminFinanceValueObjectDto { Id = transaction.TransactionTypeId, Name = transactionTypeName },
                    PaymentMethodId = transaction.PaymentMethodId,
                    PaymentMethodObj = new AdminFinanceValueObjectDto { Id = transaction.PaymentMethodId, Name = paymentMethodName },
                    StatusId = transaction.StatusId,
                    StatusObj = new AdminFinanceValueObjectDto { Id = transaction.StatusId, Name = statusName },
                    ReferenceNumber = transaction.ReferenceNumber,
                    TransactionType = transactionTypeName,
                    PaymentMethod = paymentMethodName,
                    Status = statusName,
                    Amount = transaction.Amount,
                    Description = transaction.Description,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = balanceAfter,
                    ApplyFor = !string.IsNullOrWhiteSpace(transaction.AppliedFor) ? transaction.AppliedFor : applyFor?.Name,
                    ApplyForObj = applyFor,
                    ProfileId = transaction.ProfileId,
                    CreatedOn = transaction.CreatedOn,
                    UpdateOn = transaction.CompletedAt ?? transaction.CreatedOn,
                    CompletedAt = transaction.CompletedAt
                };
            }).ToList();
        }

        private async Task<List<AdminRechargeListItemDto>> MapRechargesAsync(List<Transaction> transactions)
        {
            var lookupBundle = await GetLookupBundleAsync();
            var createdByUserMap = await GetCreatedByUserMapAsync(transactions);

            return transactions.Select(transaction =>
            {
                var transactionTypeName = lookupBundle.GetName(TransactionTypeScope, transaction.TransactionTypeId, GetDefaultTransactionTypeName(transaction.TransactionTypeId));
                var paymentMethodName = lookupBundle.GetName(PaymentMethodScope, transaction.PaymentMethodId, GetDefaultPaymentMethodName(transaction.PaymentMethodId));
                var statusName = lookupBundle.GetName(TransactionStatusScope, transaction.StatusId, GetDefaultTransactionStatusName(transaction.StatusId));
                createdByUserMap.TryGetValue(transaction.CreatedBy, out var user);
                var accountName = user == null
                    ? null
                    : string.Join(" ", new[] { user.FirstName, user.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();

                if (string.IsNullOrWhiteSpace(accountName))
                {
                    accountName = user?.UserName;
                }

                return new AdminRechargeListItemDto
                {
                    Id = transaction.Id,
                    TransactionNo = transaction.TransactionNo,
                    TransactionTypeId = transaction.TransactionTypeId,
                    TransactionTypeObj = new AdminFinanceValueObjectDto { Id = transaction.TransactionTypeId, Name = transactionTypeName },
                    PaymentMethodId = transaction.PaymentMethodId,
                    PaymentMethodObj = new AdminFinanceValueObjectDto { Id = transaction.PaymentMethodId, Name = paymentMethodName },
                    StatusId = transaction.StatusId,
                    StatusObj = new AdminFinanceValueObjectDto { Id = transaction.StatusId, Name = statusName },
                    ReferenceNumber = transaction.ReferenceNumber,
                    TransactionType = transactionTypeName,
                    PaymentMethod = paymentMethodName,
                    Status = statusName,
                    Amount = transaction.Amount,
                    BalanceBefore = transaction.BalanceBefore,
                    BalanceAfter = transaction.BalanceAfter,
                    Description = transaction.Description,
                    AccountName = accountName,
                    AccountEmail = user?.Email,
                    ProfileId = transaction.ProfileId,
                    CreatedTime = transaction.CreatedOn,
                    CreatedOn = transaction.CreatedOn,
                    CompletedAt = transaction.CompletedAt
                };
            }).ToList();
        }

        private async Task<List<AdminFinanceApplicationInfoDto>> GetTransactionApplicationsAsync(
            Transaction transaction,
            AdminFinanceProfileInfoDto? transactionProfile,
            LookupBundle lookupBundle)
        {
            if (string.IsNullOrWhiteSpace(transaction.ReferenceNumber))
            {
                return new List<AdminFinanceApplicationInfoDto>();
            }

            var applicationInfoQuery =
                from application in _dbContext.Applications.AsNoTracking()
                join applicationDetail in _dbContext.ApplicationDetails.AsNoTracking() on application.Id equals applicationDetail.ApplicationId into applicationDetailGroup
                from applicationDetail in applicationDetailGroup.DefaultIfEmpty()
                join service in _dbContext.ServiceConfigs.AsNoTracking() on application.ServiceId equals service.Id into serviceGroup
                from service in serviceGroup.DefaultIfEmpty()
                join user in _dbContext.Users.AsNoTracking() on application.UserId equals user.Id into userGroup
                from user in userGroup.DefaultIfEmpty()
                select new
                {
                    Application = application,
                    ApplicationDetail = applicationDetail,
                    Service = service,
                    User = user
                };

            // Prefer the unambiguous ApplicationId; after lifecycle unification a ReferenceNumber
            // (= ApplicationNumber) can match multiple sibling applications, so fall back to it only
            // for legacy transactions that predate ApplicationId population (main/earliest wins).
            applicationInfoQuery = transaction.ApplicationId is > 0
                ? applicationInfoQuery.Where(r => r.Application.Id == transaction.ApplicationId.Value)
                : applicationInfoQuery.Where(r => r.Application.ApplicationNumber == transaction.ReferenceNumber).OrderBy(r => r.Application.Id);

            var applicationRows = await applicationInfoQuery.ToListAsync();

            return applicationRows.Select(row =>
            {
                var applicationStatusId = row.ApplicationDetail?.ApplicationStatusId;
                var applicationStatusName = applicationStatusId.HasValue
                    ? lookupBundle.GetName(ApplicationStatusScope, applicationStatusId.Value, string.Empty)
                    : string.Empty;
                var applyFor = transactionProfile?.ProfileId > 0 && transactionProfile.ProfileId == row.Application.ProfileId
                    ? transactionProfile.Name
                    : (row.User == null ? null : BuildUserDisplayName(row.User));

                return new AdminFinanceApplicationInfoDto
                {
                    ApplicationId = row.Application.Id,
                    ApplicationDetailId = row.ApplicationDetail?.Id,
                    ApplicationNumber = row.Application.ApplicationNumber,
                    ServiceName = _currentUserService.IsArabicLanguage
                        ? row.Service?.NameAr ?? row.Service?.NameEn
                        : row.Service?.NameEn ?? row.Service?.NameAr,
                    ServiceNameEn = row.Service?.NameEn,
                    ServiceNameAr = row.Service?.NameAr,
                    ApplicationStatusId = applicationStatusId,
                    ApplicationStatusObj = applicationStatusId.HasValue
                        ? CreateValueObject(applicationStatusId.Value, applicationStatusName)
                        : null,
                    ApplyFor = applyFor,
                    CreatedOn = row.Application.CreatedOn
                };
            }).ToList();
        }

        private async Task<int?> GetRefundIdAsync(Transaction transaction)
        {
            if (transaction.TransactionTypeId != RefundTransactionTypeId)
            {
                return null;
            }

            return await QueryRefundsForTransaction(transaction)
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// Resolves the refund application a transaction belongs to.
        ///
        /// [Payment].[Refunds].TransactionNo is only stamped with the attempt that finally succeeded,
        /// so matching on it alone leaves every failed attempt of a retried refund unlinked. The refund
        /// number in Transactions.ReferenceNumber is stable across all attempts and is the same value
        /// held in Refunds.ApplicationNumber, so refund transactions are matched on that first.
        /// TransactionNo stays as a fallback, and it is the only match used for non-refund transactions
        /// so their ReferenceNumber (a service/licence application number) cannot collide with a refund
        /// application number.
        /// </summary>
        private IQueryable<Refund> QueryRefundsForTransaction(Transaction transaction)
        {
            var refundApplicationNo = transaction.TransactionTypeId == RefundTransactionTypeId
                ? transaction.ReferenceNumber
                : null;
            var transactionNo = transaction.TransactionNo;

            return _dbContext.Refunds
                .AsNoTracking()
                .Where(x => (refundApplicationNo != null && x.ApplicationNumber == refundApplicationNo)
                    || x.TransactionNo == transactionNo)
                .OrderByDescending(x => x.UpdateOn)
                .ThenByDescending(x => x.CreatedOn);
        }

        /// <summary>
        /// Refund details a refund transaction row does not carry itself.
        ///
        /// The card is charged on the original payment, so a refund transaction never has
        /// MaskedCardNumber/CardBrand of its own; both are read back from the payment being refunded.
        /// Refund scope lives on [Payment].[RefundsPendingRecords], keyed by RefundNo — the refund
        /// application number that Transactions.ReferenceNumber holds (its ApplicationNo column is the
        /// original service application number instead). The operator is taken from the audit log row of
        /// this very attempt, so a retried refund reports whoever ran the attempt being viewed.
        /// Refunds created before the pending-record flow have no source for scope or card and stay null.
        /// </summary>
        private sealed class RefundExecutionContext
        {
            public string? MaskedCardNumber { get; init; }
            public string? CardBrand { get; init; }
            public string? RefundScope { get; init; }
            public string? ProcessedBy { get; init; }
            public string? ProcessorAccount { get; init; }
        }

        private async Task<RefundExecutionContext?> GetRefundExecutionContextAsync(Transaction transaction)
        {
            if (transaction.TransactionTypeId != RefundTransactionTypeId)
            {
                return null;
            }

            var refundNo = transaction.ReferenceNumber;
            var refundTransactionNo = transaction.TransactionNo;

            var pendingRecord = string.IsNullOrWhiteSpace(refundNo)
                ? null
                : await _dbContext.RefundPendingRecords
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.RefundNo == refundNo);

            var originalTransaction = pendingRecord == null
                ? null
                : await _dbContext.Transactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == pendingRecord.OriginalTransactionId);

            var (cardBrand, maskedCardNumber) = ResolveRefundCard(originalTransaction, pendingRecord?.MaskedCardInfo);

            var operationLog = await _dbContext.AdminRefundOperationLogs
                .AsNoTracking()
                .Where(x => x.RefundTransactionNo == refundTransactionNo
                    || (refundNo != null && x.RefundNo == refundNo))
                .OrderByDescending(x => x.RefundTransactionNo == refundTransactionNo)
                .ThenByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            var operatorId = Coalesce(operationLog?.OperatorId, pendingRecord?.UpdatedBy);
            var operatorUser = operatorId == null
                ? null
                : await _dbContext.AdminUsers
                    .AsNoTracking()
                    .Where(x => x.Id == operatorId)
                    .Select(x => new { x.UserName, x.FirstName, x.LastName, x.Email })
                    .FirstOrDefaultAsync();

            var operatorDisplayName = Coalesce(
                operationLog?.OperatorName,
                operatorUser?.UserName,
                string.Join(' ', new[] { operatorUser?.FirstName, operatorUser?.LastName }
                    .Where(x => !string.IsNullOrWhiteSpace(x))));

            return new RefundExecutionContext
            {
                MaskedCardNumber = maskedCardNumber,
                CardBrand = cardBrand,
                RefundScope = pendingRecord == null
                    ? null
                    : Coalesce(pendingRecord.RefundScope, "Full"),
                ProcessedBy = operatorDisplayName,
                ProcessorAccount = Coalesce(operatorUser?.Email)
            };
        }

        /// <summary>
        /// Splits the refund card into brand and masked number. The original payment holds both as
        /// separate columns and wins; the pending record snapshot is a single string that is written
        /// either as a bare masked number or as "&lt;brand&gt; &lt;masked number&gt;".
        /// </summary>
        private static (string? CardBrand, string? MaskedCardNumber) ResolveRefundCard(
            Transaction? originalTransaction,
            string? maskedCardInfo)
        {
            var originalMaskedCardNumber = Coalesce(originalTransaction?.MaskedCardNumber);
            if (originalMaskedCardNumber != null)
            {
                return (Coalesce(originalTransaction?.CardBrand), originalMaskedCardNumber);
            }

            var snapshot = Coalesce(maskedCardInfo);
            if (snapshot == null)
            {
                return (null, null);
            }

            var separatorIndex = snapshot.LastIndexOf(' ');
            return separatorIndex > 0
                ? (snapshot[..separatorIndex].Trim(), snapshot[(separatorIndex + 1)..])
                : (null, snapshot);
        }

        /// <summary>Returns the first value that is not null or blank, trimmed; null when there is none.</summary>
        private static string? Coalesce(params string?[] values)
        {
            foreach (var value in values)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }

            return null;
        }

        private async Task<AdminFinanceTransactionRefundInfoDto?> GetTransactionRefundAsync(
            Transaction transaction,
            AdminFinanceProfileInfoDto? transactionProfile,
            LookupBundle lookupBundle,
            RefundExecutionContext? refundExecution)
        {
            var refund = await QueryRefundsForTransaction(transaction)
                .FirstOrDefaultAsync();

            if (refund == null)
            {
                return null;
            }

            var refundStatusName = lookupBundle.GetName(RefundStatusScope, refund.StatusId, string.Empty);
            var refundReasonName = refund.ReasonId.HasValue
                ? lookupBundle.GetName(RefundReasonScope, refund.ReasonId.Value, string.Empty)
                : string.Empty;
            var paymentMethodName = lookupBundle.GetName(PaymentMethodScope, transaction.PaymentMethodId, GetDefaultPaymentMethodName(transaction.PaymentMethodId));

            return new AdminFinanceTransactionRefundInfoDto
            {
                Id = refund.Id,
                ApplicationNo = refund.ApplicationNumber,
                StatusId = refund.StatusId,
                StatusObj = CreateValueObject(refund.StatusId, refundStatusName),
                ReasonId = refund.ReasonId,
                ReasonObj = refund.ReasonId.HasValue ? CreateValueObject(refund.ReasonId.Value, refundReasonName) : null,
                Amount = Math.Abs(refund.Amount),
                PaymentMethodId = transaction.PaymentMethodId,
                PaymentMethodObj = CreateValueObject(transaction.PaymentMethodId, paymentMethodName),
                ApplyForObj = transactionProfile,
                UpdateOn = refund.UpdateOn,
                CreatedOn = refund.CreatedOn,
                RefundScope = refundExecution?.RefundScope,
                ProcessedBy = refundExecution?.ProcessedBy,
                ProcessorAccount = refundExecution?.ProcessorAccount,
                MaskedCardNumber = refundExecution?.MaskedCardNumber,
                CardBrand = refundExecution?.CardBrand
            };
        }

        private async Task<AdminFinanceAccountInfoDto?> GetTransactionAccountInfoAsync(Transaction transaction, LookupBundle lookupBundle)
        {
            if (transaction.PaymentMethodId != WalletPaymentMethodId)
            {
                return null;
            }

            var wallet = await _dbContext.Wallets
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.WalletOwnerUserId == transaction.CreatedBy);

            if (wallet == null)
            {
                return null;
            }

            var user = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == wallet.WalletOwnerUserId);
            var walletStatusName = lookupBundle.GetName(WalletStatusScope, wallet.StatusId, string.Empty);

            return new AdminFinanceAccountInfoDto
            {
                AccountName = user == null ? null : BuildUserDisplayName(user),
                AccountEmail = user?.Email,
                Balance = wallet.Balance,
                Currency = wallet.Currency,
                StatusId = wallet.StatusId,
                StatusObj = CreateValueObject(wallet.StatusId, walletStatusName),
                UpdateOn = wallet.UpdatedOn
            };
        }

        private async Task<AdminFinanceRelatedViolationDto?> GetTransactionRelatedViolationAsync(Transaction transaction, LookupBundle lookupBundle)
        {
            if (transaction.TransactionTypeId != FinesTransactionTypeId || string.IsNullOrWhiteSpace(transaction.ReferenceNumber))
            {
                return null;
            }

            // A fine transaction carries the violation number in ReferenceNumber. The penalty order
            // is not usable as a join key: its PendingTransactionId points at the merged parent
            // payment, which covers several unrelated violations.
            var violation = await _dbContext.InspectionViolations
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ViolationNo == transaction.ReferenceNumber);

            if (violation == null)
            {
                return null;
            }

            var violationTypeName = lookupBundle.GetName(ViolationTypeScope, (short)violation.ViolationTypeId, string.Empty);

            return new AdminFinanceRelatedViolationDto
            {
                ViolationId = violation.Id,
                ViolationNo = violation.ViolationNo,
                ViolationTypeId = violation.ViolationTypeId,
                ViolationTypeObj = string.IsNullOrWhiteSpace(violationTypeName)
                    ? null
                    : CreateValueObject(violation.ViolationTypeId, violationTypeName),
                ViolationTime = violation.CreatedOn,
                FineAmount = violation.FineAmount,
                BeforeAppealAdjustedFineAmount = violation.BeforeAppealAdjustedFineAmount,
                AfterAppealAdjustedFineAmount = violation.AfterAppealAdjustedFineAmount,
                InspectorUserId = violation.ReportedByUserId,
                InspectorName = violation.ReportedByName,
                EntityName = violation.ViolatorName
            };
        }

        private async Task<List<AdminFinanceLookupItemDto>> GetLookupItemsAsync(string scope)
        {
            var items = await _typeDictionaryService.GetListAsync(scope, isShown: true);

            return items
                .Select(item => new AdminFinanceLookupItemDto
                {
                    Id = ParseDictionaryCode(item.Code),
                    Name = GetDictionaryDisplayName(item)
                })
                .ToList();
        }

        private async Task<LookupBundle> GetLookupBundleAsync()
        {
            return await GetScopedLookupBundleAsync(TransactionTypeScope, PaymentMethodScope, TransactionStatusScope);
        }

        private async Task<LookupBundle> GetScopedLookupBundleAsync(params string[] scopes)
        {
            var items = (await _typeDictionaryService.GetListAsync(scopes)).ToList();
            var lookups = new Dictionary<string, Dictionary<short, string>>(StringComparer.OrdinalIgnoreCase);

            foreach (var scopeGroup in items.GroupBy(item => item.Scope))
            {
                lookups[scopeGroup.Key] = scopeGroup
                    .Select(item => new KeyValuePair<short, string>((short)ParseDictionaryCode(item.Code), GetDictionaryDisplayName(item)))
                    .GroupBy(item => item.Key)
                    .ToDictionary(item => item.Key, item => item.Last().Value);
            }

            return new LookupBundle(lookups);
        }

        private async Task<Dictionary<int, AdminFinanceProfileInfoDto>> GetApplyForMapAsync(IEnumerable<Transaction> transactions)
        {
            var profileIds = transactions
                .Where(x => x.ProfileId.HasValue)
                .Select(x => x.ProfileId!.Value)
                .Distinct()
                .ToArray();

            if (profileIds.Length == 0)
            {
                return new Dictionary<int, AdminFinanceProfileInfoDto>();
            }

            var profiles = await _dbContext.UserProfiles
                .AsNoTracking()
                .Where(x => profileIds.Contains(x.Id))
                .ToListAsync();

            var userIds = profiles
                .Select(x => x.UserId)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToArray();

            var users = await _dbContext.Users
                .AsNoTracking()
                .Where(x => userIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id);
            var personIds = profiles
                .Select(x => x.PersonId)
                .Where(x => x > 0)
                .Distinct()
                .ToArray();
            var persons = await _dbContext.Persons
                .AsNoTracking()
                .Where(x => personIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id);
            var userTypeIds = profiles
                .Select(x => x.UserTypeId)
                .Distinct()
                .ToArray();
            var userTypes = await _dbContext.Set<UserType>()
                .AsNoTracking()
                .Where(x => userTypeIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id);

            var userEstablishments = await _dbContext.UserEstablishments
                .AsNoTracking()
                .Where(x => profileIds.Contains(x.UserProfileId))
                .ToListAsync();

            var establishmentIds = userEstablishments
                .Select(x => x.EstablishmentId)
                .Distinct()
                .ToArray();

            var establishments = await _dbContext.Establishments
                .AsNoTracking()
                .Where(x => establishmentIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id);

            var displayMap = new Dictionary<int, AdminFinanceProfileInfoDto>();
            foreach (var profile in profiles)
            {
                users.TryGetValue(profile.UserId, out var user);
                userTypes.TryGetValue(profile.UserTypeId, out var userType);
                var isIndividual = string.Equals(userType?.Code, "1", StringComparison.OrdinalIgnoreCase);
                persons.TryGetValue(profile.PersonId, out var person);
                var establishmentId = userEstablishments
                    .Where(x => x.UserProfileId == profile.Id)
                    .Select(x => (int?)x.EstablishmentId)
                    .FirstOrDefault();
                Establishment? establishment = null;
                if (establishmentId.HasValue)
                {
                    establishments.TryGetValue(establishmentId.Value, out establishment);
                }
                var nameEn = isIndividual
                    ? person?.Name
                    : establishment?.NameEn;
                var nameAr = isIndividual
                    ? person?.NameAr
                    : establishment?.NameAr;
                var displayName = _currentUserService.IsArabicLanguage
                    ? nameAr ?? nameEn
                    : nameEn ?? nameAr;
                if (string.IsNullOrWhiteSpace(displayName) && user != null)
                {
                    displayName = BuildUserDisplayName(user);
                }
                if (string.IsNullOrWhiteSpace(displayName) && !string.IsNullOrWhiteSpace(profile.EntityName))
                {
                    displayName = profile.EntityName;
                }
                if (string.IsNullOrWhiteSpace(displayName) && !string.IsNullOrWhiteSpace(profile.ProfileCode))
                {
                    displayName = profile.ProfileCode;
                }

                var accountName = user == null
                    ? null
                    : string.Join(" ", new[] { user.FirstName, user.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();

                if (string.IsNullOrWhiteSpace(accountName))
                {
                    accountName = user?.UserName;
                }

                displayMap[profile.Id] = new AdminFinanceProfileInfoDto
                {
                    ProfileId = profile.Id,
                    UserTypeId = profile.UserTypeId,
                    Name = displayName,
                    NameEn = nameEn ?? displayName,
                    NameAr = nameAr ?? displayName,
                    AccountName = accountName,
                    AccountEmail = user?.Email
                };
            }

            return displayMap;
        }

        private async Task<Dictionary<string, User>> GetCreatedByUserMapAsync(IEnumerable<Transaction> transactions)
        {
            var userIds = transactions
                .Select(x => x.CreatedBy)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToArray();

            if (userIds.Length == 0)
            {
                return new Dictionary<string, User>();
            }

            return await _dbContext.Users
                .AsNoTracking()
                .Where(x => userIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id);
        }

        private static (decimal? balanceBefore, decimal? balanceAfter) GetBalanceValues(Transaction transaction)
        {
            return (transaction.BalanceBefore, transaction.BalanceAfter);
        }

        private string GetDictionaryDisplayName(TypeDictionary item)
        {
            return _currentUserService.IsArabicLanguage
                ? item.NameAr ?? item.NameEn
                : item.NameEn ?? item.NameAr;
        }

        private static AdminFinanceValueObjectDto CreateValueObject(int id, string name, string? code = null)
        {
            return new AdminFinanceValueObjectDto
            {
                Id = id,
                Name = name,
                Code = code
            };
        }

        private static string BuildUserDisplayName(User user)
        {
            var fullName = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();
            if (!string.IsNullOrWhiteSpace(fullName))
            {
                return fullName;
            }

            return user.Email ?? user.UserName;
        }

        private static byte[] BuildCsv(IEnumerable<string> headers, IEnumerable<string[]> rows)
        {
            using var memoryStream = new MemoryStream();
            using (var writer = new StreamWriter(memoryStream, Encoding.UTF8, leaveOpen: true))
            {
                writer.WriteLine(string.Join(",", headers.Select(EscapeCsv)));
                foreach (var row in rows)
                {
                    writer.WriteLine(string.Join(",", row.Select(EscapeCsv)));
                }
            }

            return memoryStream.ToArray();
        }

        private static string EscapeCsv(string? value)
        {
        return $"\"{(value ?? string.Empty).Replace("\"", "\"\"")}\"";
        }

        /// <summary>
        /// Forces spreadsheet apps to treat the value as text so long numeric-looking ids
        /// (e.g. Transaction No.) keep every digit instead of being rounded to trailing zeros.
        /// Emits an Excel string formula ="value" which is preserved as text on import.
        /// </summary>
        private static string ToCsvTextValue(string? value)
        {
        var text = value ?? string.Empty;
        return $"=\"{text.Replace("\"", "\"\"")}\"";
        }

        private string ResolveExportApplyFor(AdminPaymentTransactionListItemDto item)
        {
        var profile = item.ApplyForObj;
        if (profile != null)
        {
            var name = _currentUserService.IsArabicLanguage
            ? profile.NameAr ?? profile.NameEn
            : profile.NameEn ?? profile.NameAr;
            if (!string.IsNullOrWhiteSpace(name))
            {
            return name;
            }
        }

        return item.ApplyFor ?? string.Empty;
        }

        private static int ParseDictionaryCode(string? code)
        {
            return int.TryParse(code, out var parsedCode) ? parsedCode : 0;
        }

        private static AdminPaymentTransactionListRequestDto NormalizeTransactionRequest(AdminPaymentTransactionListRequestDto? request)
        {
            return request ?? new AdminPaymentTransactionListRequestDto();
        }

        private static AdminRechargeListRequestDto NormalizeRechargeRequest(AdminRechargeListRequestDto? request)
        {
            return request ?? new AdminRechargeListRequestDto();
        }

        private static string GetDefaultTransactionTypeName(short transactionTypeId)
        {
            return transactionTypeId switch
            {
                RechargeTransactionTypeId => "Recharge",
                ServicePaymentTransactionTypeId => "Service Payment",
                FinesTransactionTypeId => "Fines",
                RefundTransactionTypeId => "Refund",
                _ => "Unknown"
            };
        }

        private static string GetDefaultPaymentMethodName(short paymentMethodId)
        {
            return paymentMethodId switch
            {
                WalletPaymentMethodId => "Wallet",
                CardPaymentMethodId => "Credit / Debit Card",
                _ => "Unknown"
            };
        }

        private static string GetDefaultTransactionStatusName(short statusId)
        {
            return statusId switch
            {
                1 => "Pending",
                2 => "Processing",
                CompletedTransactionStatusId => "Completed",
                FailedTransactionStatusId => "Failed",
                _ => "Unknown"
            };
        }

        private sealed class TransactionScope
        {
            public TransactionScope(IReadOnlyCollection<int> profileIds, string? rechargeUserId)
            {
                ProfileIds = profileIds;
                RechargeUserId = rechargeUserId;
            }

            public IReadOnlyCollection<int> ProfileIds { get; }

            public string? RechargeUserId { get; }
        }

        private sealed class LookupBundle
        {
            private readonly Dictionary<string, Dictionary<short, string>> _lookups;

            public LookupBundle(Dictionary<string, Dictionary<short, string>> lookups)
            {
                _lookups = lookups;
            }

            public string GetName(string scope, short id, string fallback)
            {
                return _lookups.TryGetValue(scope, out var scopedItems) && scopedItems.TryGetValue(id, out var value)
                    ? value
                    : fallback;
            }
        }
    }
}

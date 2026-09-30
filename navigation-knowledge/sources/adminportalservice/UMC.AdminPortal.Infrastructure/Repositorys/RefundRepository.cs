using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using NanoidDotNet;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Models.Refunds;
using UMC.AdminPortal.Domain.Share;
using UMC.AdminPortal.Domain.Service.Refunds;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Infrastructure.Models;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Module.Attributes;

namespace UMC.AdminPortal.Infrastructure.Repositorys
{
    [InjectOnScoped]
    public class RefundRepository : IRefundRepository
    {
        private static readonly JsonSerializerOptions AuditJsonOptions = new(JsonSerializerDefaults.Web);
        private const short WalletPaymentMethodId = 9;
        private const short CreditCardPaymentMethodId = 8;
        private const short ServicePaymentTransactionTypeId = 2;
        private const short FinesTransactionTypeId = 3;
        private const short RefundTransactionTypeId = 4;
        private const short CompletedTransactionStatusId = 3;
        private const short FailedTransactionStatusId = 4;
        private const short InspectionAppealRefundCategoryId = 1;
        private const short DefaultRefundReasonId = 1;
        private const short PendingRefundApplicationStatusId = 1;
        private const short CompletedRefundApplicationStatusId = 6;
        private const string CardPaymentTransactionDiscriminator = "CardPayTransaction";
        private const string WalletPaymentTransactionDiscriminator = "WalletTransaction";
        private const string CompletedExecutionStatus = "Completed";

        private readonly AdminPortalDBContext _dbContext;
        private readonly IUnitOfWork _unitOfWork;
        public RefundRepository(
            AdminPortalDBContext dbContext,
            IUnitOfWork unitOfWork)
        {
            _dbContext = dbContext;
            _unitOfWork = unitOfWork;
        }

        public Task<RefundListResult> GetListAsync(RefundQueryRequest request)
        {
            return GetListInternalAsync(request);
        }

        public Task<RefundDetail> GetDetailAsync(string refundNo)
        {
            return GetDetailInternalAsync(refundNo);
        }

        public Task<RefundStatistics> GetStatisticsAsync()
        {
            return GetStatisticsInternalAsync();
        }

        public Task<RefundOriginalPaymentLookupResult?> GetOriginalPaymentAsync(int originalTransactionId)
        {
            return GetOriginalPaymentInternalAsync(originalTransactionId);
        }

        public Task<RefundOriginalPaymentLookupResult?> GetLatestCompletedFinePaymentAsync(string applicationNo)
        {
            return GetLatestCompletedFinePaymentInternalAsync(applicationNo);
        }

        public Task<RefundPendingCreationResult> CreatePendingRefundAsync(RefundPendingCreationRequest request)
        {
            return CreatePendingRefundInternalAsync(request);
        }


        public Task<RefundExecutionValidationContext?> GetExecutionValidationContextAsync(string refundNo)
        {
            return GetExecutionValidationContextInternalAsync(refundNo);
        }

        public Task<RefundExecutionValidationContext> ReserveExecutionAsync(
            RefundExecutionValidationContext validationContext,
            RefundExecutionRequest request)
        {
            return ReserveExecutionInternalAsync(validationContext, request);
        }

        public Task<RefundExecutionResult> PersistExecutionOutcomeAsync(
            RefundExecutionValidationContext validationContext,
            RefundExecutionRequest request,
            RefundExecutionResult executionResult)
        {
            return PersistExecutionOutcomeInternalAsync(validationContext, request, executionResult);
        }

        public Task WriteExecutionAuditLogAsync(
            RefundExecutionValidationContext? validationContext,
            RefundExecutionRequest request,
            RefundExecutionResult? executionResult,
            string operationResult,
            string? failureReason)
        {
            return WriteExecutionAuditLogInternalAsync(validationContext, request, executionResult, operationResult, failureReason);
        }

        private async Task<RefundListResult> GetListInternalAsync(RefundQueryRequest request)
        {
            var pageIndex = request.PageIndex <= 0 ? 1 : request.PageIndex;
            var pageSize = request.PageSize <= 0 ? 10 : request.PageSize;
            var normalizedSearch = request.Search?.Trim();

            IQueryable<RefundPendingRecord> query = _dbContext.RefundPendingRecords
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(normalizedSearch))
            {
                var searchPattern = $"%{normalizedSearch}%";
                query = query.Where(x =>
                    EF.Functions.Like(x.RefundNo, searchPattern) ||
                    EF.Functions.Like(x.OriginalTransactionNo, searchPattern) ||
                    EF.Functions.Like(x.ApplyForName, searchPattern) ||
                    (x.AccountOrCardHolderName != null && EF.Functions.Like(x.AccountOrCardHolderName, searchPattern)));
            }

            if (request.StartTime.HasValue)
            {
                query = query.Where(x => x.LastUpdatedOn >= request.StartTime.Value);
            }

            if (request.EndTime.HasValue)
            {
                query = query.Where(x => x.LastUpdatedOn <= request.EndTime.Value);
            }

            // Staff scope: restrict to refunds handled by the given user. The list read-model
            // (RefundPendingRecords) has no handler column, so match by RefundNo == ApplicationNumber
            // against the domain tables:
            //  - pending side ([Payment].[Refunds].HandlerUserId == me), and
            //  - completed side ([Payment].[RefundStatusTrackings] rows created by me).
            // Status/time/search filters above are preserved; this only narrows to the user's refunds.
            if (!string.IsNullOrWhiteSpace(request.HandlerUserId))
            {
                var handlerUserId = request.HandlerUserId;

                var handledRefundNos = _dbContext.Refunds
                    .AsNoTracking()
                    .Where(r => r.HandlerUserId == handlerUserId && r.ApplicationNumber != null)
                    .Select(r => r.ApplicationNumber!);

                var trackedRefundNos = _dbContext.Set<RefundStatusTracking>()
                    .AsNoTracking()
                    .Where(t => t.CreatedBy == handlerUserId && t.RefundId != null)
                    .Join(_dbContext.Refunds.AsNoTracking().Where(r => r.ApplicationNumber != null),
                          t => t.RefundId,
                          r => r.Id,
                          (t, r) => r.ApplicationNumber!);

                query = query.Where(x => handledRefundNos.Contains(x.RefundNo)
                                         || trackedRefundNos.Contains(x.RefundNo));
            }

            query = ApplyStatusFilter(query, request.Status);

            query = ApplyListSorting(query, request.SortBy, request.SortDirection);

            var totalCount = await query.CountAsync();
            var items = await query
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new RefundListItem
                {
                    RefundNo = x.RefundNo,
                    OriginalTransactionNo = x.OriginalTransactionNo,
                    Type = "Refund",
                    RefundScope = string.IsNullOrWhiteSpace(x.RefundScope) ? "Full" : x.RefundScope,
                    ApplyFor = new RefundApplyFor
                    {
                        UserTypeId = x.ApplyForUserTypeId ?? 0,
                        Name = x.ApplyForName,
                        IconKey = GetApplyForIconKey(x.ApplyForUserTypeId)
                    },
                    AccountOrCardHolder = x.AccountOrCardHolderName ?? string.Empty,
                    PaymentMethod = GetPaymentMethodDisplayName(x.OriginalPaymentMethodId),
                    Amount = -Math.Abs(x.RefundAmount),
                    Currency = "AED",
                    Status = GetRefundDisplayStatus(x.IsPendingRefund, x.LastExecutionStatus),
                    LastUpdatedOn = x.LastUpdatedOn,
                    CanExecuteRefund = x.IsPendingRefund && CanExecuteRefund(x.OriginalPaymentMethodId, null, x.LastExecutionStatus),
                    UnsupportedReason = x.IsPendingRefund
                        ? GetUnsupportedReason(x.OriginalPaymentMethodId, null, x.LastExecutionStatus)
                        : "Refund already completed."
                })
                .ToListAsync();

            return new RefundListResult
            {
                Items = items,
                PageIndex = pageIndex,
                PageSize = pageSize,
                TotalCount = totalCount
            };
        }

        private async Task<RefundDetail> GetDetailInternalAsync(string refundNo)
        {
            var pendingRecord = await _dbContext.RefundPendingRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.RefundNo == refundNo);

            if (pendingRecord == null)
            {
                throw new BusinessException(RefundErrorCodes.RefundNotFound);
            }

            var originalTransaction = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == pendingRecord.OriginalTransactionId);

            var latestPaymentRecord = await _dbContext.MagnatiPaymentRecords
                .AsNoTracking()
                .Where(x => x.TransactionId == pendingRecord.OriginalTransactionId || x.TransactionNo == pendingRecord.OriginalTransactionNo)
                .OrderByDescending(x => x.IsFinalConfirmed)
                .ThenByDescending(x => x.FinalConfirmedAt)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            var latestFailedRefundRecord = await _dbContext.MagnatiRefundRecords
                .AsNoTracking()
                .Where(x => x.RefundNo == refundNo && !x.IsSuccess)
                .OrderByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            var cardInformation = BuildCardInformation(
                pendingRecord.MaskedCardInfo,
                originalTransaction?.CardBrand,
                originalTransaction?.MaskedCardNumber);

            var canExecuteRefund = pendingRecord.IsPendingRefund && CanExecuteRefund(
                pendingRecord.OriginalPaymentMethodId,
                originalTransaction?.StatusId,
                pendingRecord.LastExecutionStatus);
            var unsupportedReason = pendingRecord.IsPendingRefund
                ? GetUnsupportedReason(
                    pendingRecord.OriginalPaymentMethodId,
                    originalTransaction?.StatusId,
                    pendingRecord.LastExecutionStatus)
                : "Refund already completed.";

            return new RefundDetail
            {
                RefundNo = pendingRecord.RefundNo,
                Status = GetRefundDisplayStatus(pendingRecord.IsPendingRefund, pendingRecord.LastExecutionStatus),
                LastUpdatedOn = pendingRecord.LastUpdatedOn,
                Type = "Refund",
                ApplicationInformation = new RefundApplicationInformation
                {
                    PaymentMethod = GetPaymentMethodDisplayName(pendingRecord.OriginalPaymentMethodId),
                    AccountOrCardHolder = pendingRecord.AccountOrCardHolderName ?? string.Empty,
                    CardInformation = cardInformation,
                    Email = pendingRecord.Email ?? "-",
                    ApplyFor = pendingRecord.ApplyForName,
                    AmountCharged = -Math.Abs(pendingRecord.RefundAmount),
                    Currency = "AED",
                    RefundScope = string.IsNullOrWhiteSpace(pendingRecord.RefundScope) ? "Full" : pendingRecord.RefundScope,
                    RefundReason = pendingRecord.RefundReason ?? string.Empty
                },
                FailureReason = BuildFailureReason(pendingRecord, latestFailedRefundRecord),
                RelatedPaymentInformation = new RefundRelatedPayment
                {
                    TransactionNo = originalTransaction?.TransactionNo ?? pendingRecord.OriginalTransactionNo,
                    Status = GetTransactionStatusDisplayName(originalTransaction?.StatusId),
                    TransactionType = GetTransactionTypeDisplayName(originalTransaction?.TransactionTypeId ?? pendingRecord.OriginalTransactionTypeId),
                    LastUpdatedOn = originalTransaction?.CompletedAt ?? originalTransaction?.CreatedOn ?? pendingRecord.LastUpdatedOn,
                    PaymentMethod = GetPaymentMethodDisplayName(originalTransaction?.PaymentMethodId ?? pendingRecord.OriginalPaymentMethodId),
                    CardInformation = cardInformation,
                    AmountCharged = Math.Abs(originalTransaction?.Amount ?? pendingRecord.RefundAmount),
                    Currency = "AED",
                    ApplyFor = pendingRecord.ApplyForName,
                    Description = originalTransaction?.Description ?? pendingRecord.RefundReason ?? latestPaymentRecord?.ErrorText
                },
                CanExecuteRefund = canExecuteRefund,
                UnsupportedReason = unsupportedReason
            };
        }

        private async Task<RefundStatistics> GetStatisticsInternalAsync()
        {
            var completedRefundTransactions = _dbContext.PaymentTransactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId == RefundTransactionTypeId && x.StatusId == CompletedTransactionStatusId);

            var cardRefundAmount = await completedRefundTransactions
                .Where(x => x.PaymentMethodId == CreditCardPaymentMethodId)
                .SumAsync(x => (decimal?)Math.Abs(x.Amount)) ?? 0m;

            var walletRefundAmount = await completedRefundTransactions
                .Where(x => x.PaymentMethodId == WalletPaymentMethodId)
                .SumAsync(x => (decimal?)Math.Abs(x.Amount)) ?? 0m;

            var cardRefundCount = await completedRefundTransactions
                .CountAsync(x => x.PaymentMethodId == CreditCardPaymentMethodId);

            var walletRefundCount = await completedRefundTransactions
                .CountAsync(x => x.PaymentMethodId == WalletPaymentMethodId);

            var pendingRefundCount = await _dbContext.RefundPendingRecords
                .AsNoTracking()
                .CountAsync(x => x.IsPendingRefund);

            var pendingRefundAmount = await _dbContext.RefundPendingRecords
                .AsNoTracking()
                .Where(x => x.IsPendingRefund)
                .SumAsync(x => (decimal?)x.RefundAmount) ?? 0m;

            return new RefundStatistics
            {
                TotalRefundAmount = new RefundAmountStatistics
                {
                    WalletRefundAmount = walletRefundAmount,
                    CardRefundAmount = cardRefundAmount,
                    TotalRefundAmount = walletRefundAmount + cardRefundAmount,
                    Hint = "Only completed refund transactions are counted"
                },
                TotalRefundCount = new RefundCountStatistics
                {
                    WalletRefundCount = walletRefundCount,
                    CardRefundCount = cardRefundCount,
                    TotalRefundCount = walletRefundCount + cardRefundCount,
                    Hint = "Only completed refund transactions are counted"
                },
                PendingRefundCount = pendingRefundCount,
                PendingRefundAmount = pendingRefundAmount,
                Currency = "AED"
            };
        }

        private async Task<RefundOriginalPaymentLookupResult?> GetLatestCompletedFinePaymentInternalAsync(string applicationNo)
        {
            var normalizedApplicationNo = applicationNo.Trim();
            if (string.IsNullOrWhiteSpace(normalizedApplicationNo))
            {
                return null;
            }

            var originalTransaction = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId == FinesTransactionTypeId
                    && x.StatusId == CompletedTransactionStatusId
                    && ((x.AppliedFor != null && x.AppliedFor == normalizedApplicationNo)
                        || (x.ReferenceNumber != null && x.ReferenceNumber == normalizedApplicationNo)))
                .OrderByDescending(x => x.CompletedAt ?? x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            if (originalTransaction == null)
            {
                return null;
            }

            return new RefundOriginalPaymentLookupResult
            {
                OriginalTransactionId = originalTransaction.Id,
                OriginalTransactionNo = originalTransaction.TransactionNo,
                OriginalTransactionTypeId = originalTransaction.TransactionTypeId,
                OriginalPaymentMethodId = originalTransaction.PaymentMethodId,
                OriginalReferenceNumber = originalTransaction.ReferenceNumber,
                PaidAmount = Math.Abs(originalTransaction.Amount),
                ProfileId = originalTransaction.ProfileId,
                AccountOrCardHolderName = null,
                MaskedCardInfo = BuildCardInformation(null, originalTransaction.CardBrand, originalTransaction.MaskedCardNumber),
                Email = null
            };
        }

        private async Task<RefundOriginalPaymentLookupResult?> GetOriginalPaymentInternalAsync(int originalTransactionId)
        {
            if (originalTransactionId <= 0)
            {
                return null;
            }

            var originalTransaction = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == originalTransactionId)
                .ConfigureAwait(false);

            if (originalTransaction == null)
            {
                return null;
            }

            return new RefundOriginalPaymentLookupResult
            {
                OriginalTransactionId = originalTransaction.Id,
                OriginalTransactionNo = originalTransaction.TransactionNo,
                OriginalTransactionTypeId = originalTransaction.TransactionTypeId,
                OriginalPaymentMethodId = originalTransaction.PaymentMethodId,
                OriginalReferenceNumber = originalTransaction.ReferenceNumber,
                PaidAmount = Math.Abs(originalTransaction.Amount),
                ProfileId = originalTransaction.ProfileId,
                AccountOrCardHolderName = null,
                MaskedCardInfo = BuildCardInformation(null, originalTransaction.CardBrand, originalTransaction.MaskedCardNumber),
                Email = null
            };
        }

        private async Task<RefundPendingCreationResult> CreatePendingRefundInternalAsync(RefundPendingCreationRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var normalizedApplicationNo = request.ApplicationNo.Trim();
            var normalizedOriginalTransactionNo = request.OriginalTransactionNo.Trim();
            var normalizedRefundScope = string.IsNullOrWhiteSpace(request.RefundScope) ? "Full" : request.RefundScope.Trim();
            var normalizedApplyForName = request.ApplyForName.Trim();
            var normalizedRefundReason = request.RefundReason.Trim();
            var normalizedCreatedBy = string.IsNullOrWhiteSpace(request.CreatedBy) ? "system" : request.CreatedBy.Trim();

            if (string.IsNullOrWhiteSpace(normalizedApplicationNo)
                || request.OriginalTransactionId <= 0
                || string.IsNullOrWhiteSpace(normalizedOriginalTransactionNo)
                || request.RefundAmount <= 0m
                || string.IsNullOrWhiteSpace(normalizedApplyForName)
                || string.IsNullOrWhiteSpace(normalizedRefundReason))
            {
                throw new BusinessException("INVALID_REFUND_REQUEST");
            }

            var existingRecord = await _dbContext.RefundPendingRecords
                .AsNoTracking()
                .Where(x => x.ApplicationNo == normalizedApplicationNo
                    && x.OriginalTransactionId == request.OriginalTransactionId
                    && x.RefundScope == normalizedRefundScope
                    && x.RefundAmount == request.RefundAmount)
                .OrderByDescending(x => x.CreatedOn)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync()
                .ConfigureAwait(false);

            if (existingRecord != null)
            {
                if (await EnsureRefundApplicationRecordAsync(existingRecord, request, normalizedCreatedBy, now: existingRecord.CreatedOn).ConfigureAwait(false))
                {
                    await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);
                }

                return MapPendingCreationResult(existingRecord, isCreated: false);
            }

            var now = DateTimeHelper.Now;
            
            //HC-02-YYYY-ZZZZZZZ (HC-code-year-7seq)
            //01Ticket, 02refund, 03Appeal
            // For inspection appeal-triggered refunds, use HC-03-{year}-{7-digit} format
            var refundNo = await GenerateInspectionRefundApplicationNumberAsync(now).ConfigureAwait(false);
    
            
            var pendingRecord = new RefundPendingRecord
            {
                RefundNo = refundNo,
                ApplicationNo = normalizedApplicationNo,
                OriginalTransactionId = request.OriginalTransactionId,
                OriginalTransactionNo = normalizedOriginalTransactionNo,
                OriginalTransactionTypeId = request.OriginalTransactionTypeId,
                OriginalPaymentMethodId = request.OriginalPaymentMethodId,
                OriginalReferenceNumber = string.IsNullOrWhiteSpace(request.OriginalReferenceNumber) ? null : request.OriginalReferenceNumber.Trim(),
                RefundAmount = request.RefundAmount,
                RefundScope = normalizedRefundScope,
                ApplyForName = normalizedApplyForName,
                ApplyForUserTypeId = request.ApplyForUserTypeId,
                AccountOrCardHolderName = string.IsNullOrWhiteSpace(request.AccountOrCardHolderName) ? null : request.AccountOrCardHolderName.Trim(),
                MaskedCardInfo = string.IsNullOrWhiteSpace(request.MaskedCardInfo) ? null : request.MaskedCardInfo.Trim(),
                Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
                RefundReason = normalizedRefundReason,
                IsPendingRefund = true,
                LastExecutionStatus = null,
                LatestFailureReason = null,
                CreatedOn = now,
                LastUpdatedOn = now,
                CreatedBy = normalizedCreatedBy,
                UpdatedBy = normalizedCreatedBy
            };

            await _dbContext.RefundPendingRecords.AddAsync(pendingRecord).ConfigureAwait(false);
            await EnsureRefundApplicationRecordAsync(pendingRecord, request, normalizedCreatedBy, now).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync().ConfigureAwait(false);

            return MapPendingCreationResult(pendingRecord, isCreated: true);
        }

        private async Task<bool> EnsureRefundApplicationRecordAsync(
            RefundPendingRecord pendingRecord,
            RefundPendingCreationRequest request,
            string normalizedCreatedBy,
            DateTime now)
        {
            var existingRefund = await _dbContext.Refunds
                .FirstOrDefaultAsync(x => x.ApplicationNumber == pendingRecord.RefundNo)
                .ConfigureAwait(false);

            if (existingRefund != null)
            {
                return false;
            }

            var originalTransaction = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == pendingRecord.OriginalTransactionId)
                .ConfigureAwait(false);

            var refund = new Refund
            {
                CategoryId = InspectionAppealRefundCategoryId,
                ReferenceNumber = string.IsNullOrWhiteSpace(request.OriginalReferenceNumber)
                    ? pendingRecord.ApplicationNo ?? pendingRecord.OriginalTransactionNo
                    : request.OriginalReferenceNumber.Trim(),
                ReferenceDepartmentId = request.ReferenceDepartmentId,
                Amount = pendingRecord.RefundAmount,
                ReasonId = request.ReasonId ?? DefaultRefundReasonId,
                AdditionalComments = string.IsNullOrWhiteSpace(request.RefundReason) ? null : request.RefundReason.Trim(),
                ApplicationNumber = pendingRecord.RefundNo,
                StatusId = request.StatusId ?? PendingRefundApplicationStatusId,
                UserId = !string.IsNullOrWhiteSpace(request.UserId)
                    ? request.UserId.Trim()
                    : normalizedCreatedBy,
                HandlerUserId = string.IsNullOrWhiteSpace(request.HandlerUserId) ? null : request.HandlerUserId.Trim(),
                ManangerUserId = string.IsNullOrWhiteSpace(request.ManangerUserId) ? null : request.ManangerUserId.Trim(),
                SLAEndTime = request.SlaEndTime,
                SourceTypeId = request.SourceTypeId,
                CreatedOn = now,
                UpdateOn = now,
                ProfileId = request.ProfileId ?? originalTransaction?.ProfileId,
            };

            await _dbContext.Refunds.AddAsync(refund).ConfigureAwait(false);

            return true;
        }

        private async Task<RefundExecutionValidationContext?> GetExecutionValidationContextInternalAsync(string refundNo)
        {
            var pendingRecord = await _dbContext.RefundPendingRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.RefundNo == refundNo);

            if (pendingRecord == null)
            {
                return null;
            }

            var originalTransaction = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == pendingRecord.OriginalTransactionId);

            var latestPaymentRecord = await _dbContext.MagnatiPaymentRecords
                .AsNoTracking()
                .Where(x => x.TransactionId == pendingRecord.OriginalTransactionId || x.TransactionNo == pendingRecord.OriginalTransactionNo)
                .OrderByDescending(x => x.IsFinalConfirmed)
                .ThenByDescending(x => x.FinalConfirmedAt)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            var completedRefundAmount = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .Where(x => x.TransactionTypeId == RefundTransactionTypeId
                    && x.StatusId == CompletedTransactionStatusId
                    && x.RelatedTransactionId == pendingRecord.OriginalTransactionId)
                .SumAsync(x => (decimal?)Math.Abs(x.Amount)) ?? 0m;

            var hasCompletedRefundTransactionForRefundNo = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .AnyAsync(x => x.TransactionTypeId == RefundTransactionTypeId
                    && x.StatusId == CompletedTransactionStatusId
                    && x.ReferenceNumber == refundNo);

            return new RefundExecutionValidationContext
            {
                RefundNo = pendingRecord.RefundNo,
                IsPendingRefund = pendingRecord.IsPendingRefund,
                RefundAmount = pendingRecord.RefundAmount,
                OriginalTransactionId = pendingRecord.OriginalTransactionId,
                OriginalTransactionNo = pendingRecord.OriginalTransactionNo,
                OriginalTransactionTypeId = pendingRecord.OriginalTransactionTypeId,
                OriginalPaymentMethodId = pendingRecord.OriginalPaymentMethodId,
                OriginalTransactionStatusId = originalTransaction?.StatusId,
                OriginalTransactionAmount = originalTransaction == null ? null : Math.Abs(originalTransaction.Amount),
                CompletedRefundAmount = completedRefundAmount,
                HasCompletedRefundTransactionForRefundNo = hasCompletedRefundTransactionForRefundNo,
                ProfileId = originalTransaction?.ProfileId,
                OriginalPaymentId = latestPaymentRecord?.PaymentId ?? originalTransaction?.PaymentId,
                OriginalTranId = latestPaymentRecord?.TranId ?? originalTransaction?.TranId,
                OriginalCorrelationId = originalTransaction?.CorrelationId,
                OriginalGatewayTransactionId = originalTransaction?.PaymentGatewayTransactionId,
                ExecutionCorrelationId = null
            };
        }

        private async Task<RefundExecutionValidationContext> ReserveExecutionInternalAsync(
            RefundExecutionValidationContext validationContext,
            RefundExecutionRequest request)
        {
            var pendingRecord = await _dbContext.RefundPendingRecords
                .FirstOrDefaultAsync(x => x.RefundNo == validationContext.RefundNo);

            if (pendingRecord == null)
            {
                throw new BusinessException(RefundErrorCodes.RefundNotFound);
            }

            if (!pendingRecord.IsPendingRefund)
            {
                throw new BusinessException(RefundErrorCodes.RefundAlreadyCompleted);
            }

            if (string.Equals(pendingRecord.LastExecutionStatus, "Processing", StringComparison.OrdinalIgnoreCase))
            {
                throw new BusinessException(RefundErrorCodes.RefundConcurrencyConflict);
            }

            if (request.ExpectedLastUpdatedOn.HasValue && IsConcurrencyConflict(pendingRecord.LastUpdatedOn, request.ExpectedLastUpdatedOn.Value))
            {
                throw new BusinessException(RefundErrorCodes.RefundConcurrencyConflict);
            }

            var hasCompletedRefundTransaction = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .AnyAsync(x => x.TransactionTypeId == RefundTransactionTypeId
                    && x.StatusId == CompletedTransactionStatusId
                    && x.ReferenceNumber == validationContext.RefundNo);

            if (hasCompletedRefundTransaction)
            {
                throw new BusinessException(RefundErrorCodes.RefundAlreadyCompleted);
            }

            try
            {
                var reservedCorrelationId = BuildExecutionCorrelationId(validationContext.RefundNo);
                pendingRecord.LastExecutionStatus = "Processing";
                pendingRecord.LastUpdatedOn = DateTimeHelper.Now;
                pendingRecord.UpdatedBy = !string.IsNullOrWhiteSpace(request.OperatorId) ? request.OperatorId : request.OperatorName;
                _dbContext.RefundPendingRecords.Update(pendingRecord);
                await _unitOfWork.SaveChangesAsync();

                validationContext.ExecutionCorrelationId = reservedCorrelationId;
                return validationContext;
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new BusinessException(RefundErrorCodes.RefundConcurrencyConflict);
            }
        }

        private async Task<RefundExecutionResult> PersistExecutionOutcomeInternalAsync(
            RefundExecutionValidationContext validationContext,
            RefundExecutionRequest request,
            RefundExecutionResult executionResult)
        {
            var pendingRecord = await _dbContext.RefundPendingRecords
                .FirstOrDefaultAsync(x => x.RefundNo == validationContext.RefundNo);

            if (pendingRecord == null)
            {
                throw new BusinessException(RefundErrorCodes.RefundNotFound);
            }

            int? completedRefundId = null;
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                var persistedRefundTransactionNo = string.IsNullOrWhiteSpace(executionResult.RefundTransactionNo)
                    ? GenerateLocalRefundTransactionNo(validationContext.RefundNo)
                    : executionResult.RefundTransactionNo!;

                executionResult.CorrelationId ??= request.CorrelationId ?? validationContext.ExecutionCorrelationId;

                var refundTransaction = await _dbContext.PaymentTransactions
                    .FirstOrDefaultAsync(x => x.TransactionTypeId == RefundTransactionTypeId
                        && x.ReferenceNumber == validationContext.RefundNo
                        && (x.TransactionNo == persistedRefundTransactionNo
                            || (!string.IsNullOrWhiteSpace(executionResult.CorrelationId) && x.CorrelationId == executionResult.CorrelationId)));

                var now = DateTimeHelper.Now;
                var isSuccess = executionResult.IsSuccess;
                var refundTransactionStatusId = isSuccess ? CompletedTransactionStatusId : FailedTransactionStatusId;
                var transactionDescription = isSuccess
                    ? executionResult.Message
                    : executionResult.FailureReason ?? executionResult.Message;

                if (refundTransaction == null)
                {
                    refundTransaction = new Transaction
                    {
                        TransactionNo = persistedRefundTransactionNo,
                        TransactionTypeId = RefundTransactionTypeId,
                        PaymentMethodId = validationContext.OriginalPaymentMethodId,
                        Amount = -Math.Abs(validationContext.RefundAmount),
                        StatusId = refundTransactionStatusId,
                        RelatedTransactionId = validationContext.OriginalTransactionId,
                        ReferenceNumber = validationContext.RefundNo,
                        Description = transactionDescription,
                        CreatedBy = !string.IsNullOrWhiteSpace(request.OperatorId)
                            ? request.OperatorId
                            : request.OperatorName ?? "System",
                        CreatedOn = now,
                        CompletedAt = now,
                        ProfileId = validationContext.ProfileId,
                        Discriminator = GetRefundTransactionDiscriminator(validationContext.OriginalPaymentMethodId),
                        PaymentGatewayTransactionId = executionResult.GatewayRefundId,
                        PaymentGatewayResponse = executionResult.FailureReason ?? executionResult.Message,
                        PaymentId = executionResult.GatewayRefundId ?? validationContext.OriginalPaymentId,
                        TranId = persistedRefundTransactionNo,
                        CorrelationId = executionResult.CorrelationId,
                        GatewayStatus = executionResult.TransactionStatus
                    };

                    await _dbContext.PaymentTransactions.AddAsync(refundTransaction);
                }
                else
                {
                    refundTransaction.StatusId = refundTransactionStatusId;
                    refundTransaction.Amount = -Math.Abs(validationContext.RefundAmount);
                    refundTransaction.RelatedTransactionId = validationContext.OriginalTransactionId;
                    refundTransaction.ReferenceNumber = validationContext.RefundNo;
                    refundTransaction.Description = transactionDescription;
                    refundTransaction.CompletedAt = now;
                    refundTransaction.ProfileId = validationContext.ProfileId;
                    refundTransaction.Discriminator = GetRefundTransactionDiscriminator(validationContext.OriginalPaymentMethodId);
                    refundTransaction.PaymentGatewayTransactionId = executionResult.GatewayRefundId;
                    refundTransaction.PaymentGatewayResponse = executionResult.FailureReason ?? executionResult.Message;
                    refundTransaction.PaymentId = executionResult.GatewayRefundId ?? validationContext.OriginalPaymentId;
                    refundTransaction.TranId = persistedRefundTransactionNo;
                    refundTransaction.CorrelationId = executionResult.CorrelationId;
                    refundTransaction.GatewayStatus = executionResult.TransactionStatus;
                }

                if (isSuccess)
                {
                    pendingRecord.IsPendingRefund = false;
                    pendingRecord.LastExecutionStatus = "Completed";
                    pendingRecord.LatestFailureReason = null;

                    var refundRecord = await _dbContext.Refunds
                        .FirstOrDefaultAsync(x => x.ApplicationNumber == validationContext.RefundNo);
                    if (refundRecord != null)
                    {
                        completedRefundId = refundRecord.Id;
                        var previousStatusId = refundRecord.StatusId;
                        refundRecord.StatusId = CompletedRefundApplicationStatusId;
                        refundRecord.UpdateOn = executionResult.LastUpdatedOn;
                        refundRecord.TransactionOn = executionResult.LastUpdatedOn;
                        refundRecord.TransactionNo = persistedRefundTransactionNo;
                        
                        await _dbContext.RefundStatusTrackings.AddAsync(new RefundStatusTracking
                        {
                            RefundId = refundRecord.Id,
                            FromStatusId = previousStatusId,
                            ToStatusId = CompletedRefundApplicationStatusId,
                            Content = "The refund process has been completed.",
                            CreatedBy = !string.IsNullOrWhiteSpace(request.OperatorId) ? request.OperatorId : request.OperatorName ?? "System",
                            CreatedOn = now
                        });
                    }
                }
                else
                {
                    pendingRecord.IsPendingRefund = true;
                    pendingRecord.LastExecutionStatus = "Failed";
                    pendingRecord.LatestFailureReason = executionResult.FailureReason ?? executionResult.Message;
                }

                pendingRecord.LastUpdatedOn = now;
                pendingRecord.UpdatedBy = !string.IsNullOrWhiteSpace(request.OperatorId) ? request.OperatorId : request.OperatorName;

                await _unitOfWork.SaveChangesAsync();

                if (!string.IsNullOrWhiteSpace(executionResult.CorrelationId))
                {
                    var gatewayLog = await _dbContext.MagnatiRefundRecords
                        .FirstOrDefaultAsync(x => x.RefundNo == validationContext.RefundNo && x.CorrelationId == executionResult.CorrelationId);

                    if (gatewayLog != null)
                    {
                        gatewayLog.RefundTransactionId = refundTransaction.Id;
                        gatewayLog.RefundTransactionNo = persistedRefundTransactionNo;
                        gatewayLog.UpdatedOn = now;
                        if (!isSuccess && string.IsNullOrWhiteSpace(gatewayLog.GatewayErrorText))
                        {
                            gatewayLog.GatewayErrorText = executionResult.FailureReason ?? executionResult.Message;
                        }
                        _dbContext.MagnatiRefundRecords.Update(gatewayLog);
                        await _unitOfWork.SaveChangesAsync();
                    }
                }

                await _unitOfWork.CommitAsync();
 
                executionResult.RefundTransactionNo = persistedRefundTransactionNo;
                executionResult.LastUpdatedOn = now;
                executionResult.BusinessStatus = isSuccess ? "RefundCompleted" : "RefundFailed";
                executionResult.TransactionStatus = isSuccess ? "Completed" : "Failed";

                return executionResult;
            }
            catch (DbUpdateConcurrencyException)
            {
                await _unitOfWork.RollbackAsync();
                throw new BusinessException(RefundErrorCodes.RefundConcurrencyConflict);
            }
            catch
            {
                await _unitOfWork.RollbackAsync();
                throw;
            }
        }

        private async Task WriteExecutionAuditLogInternalAsync(
            RefundExecutionValidationContext? validationContext,
            RefundExecutionRequest request,
            RefundExecutionResult? executionResult,
            string operationResult,
            string? failureReason)
        {
            try
            {
                var auditLog = new AdminRefundOperationLog
                {
                    RefundNo = validationContext?.RefundNo ?? request.RefundNo,
                    RefundTransactionNo = executionResult?.RefundTransactionNo,
                    OriginalTransactionId = validationContext?.OriginalTransactionId,
                    OriginalTransactionNo = executionResult?.OriginalTransactionNo ?? validationContext?.OriginalTransactionNo ?? string.Empty,
                    CorrelationId = executionResult?.CorrelationId ?? request.CorrelationId ?? validationContext?.ExecutionCorrelationId,
                    OperationType = "ExecuteRefund",
                    OperationResult = operationResult,
                    OperatorId = request.OperatorId,
                    OperatorName = request.OperatorName,
                    RequestPayload = JsonSerializer.Serialize(new
                    {
                        request.RefundNo,
                        request.OperatorId,
                        request.OperatorName,
                        request.ExpectedLastUpdatedOn,
                        request.CorrelationId
                    }, AuditJsonOptions),
                    ResponsePayload = executionResult == null
                        ? null
                        : JsonSerializer.Serialize(new
                        {
                            executionResult.IsSuccess,
                            executionResult.BusinessStatus,
                            executionResult.TransactionStatus,
                            executionResult.Message,
                            executionResult.FailureReason,
                            executionResult.RefundNo,
                            executionResult.OriginalTransactionNo,
                            executionResult.RefundTransactionNo,
                            executionResult.LastUpdatedOn,
                            executionResult.CanRetry,
                            executionResult.CorrelationId,
                            executionResult.GatewayRefundId,
                            executionResult.GatewayReference
                        }, AuditJsonOptions),
                    FailureReason = failureReason,
                    CreatedOn = DateTimeHelper.Now
                };

                await _dbContext.AdminRefundOperationLogs.AddAsync(auditLog);
                await _unitOfWork.SaveChangesAsync();
            }
            catch
            {
                // Audit failures must not block the refund execution response path.
            }
        }

        private static string GenerateLocalRefundTransactionNo(string refundNo)
        {
            return $"RFD-{refundNo}-{DateTimeHelper.Now:yyyyMMddHHmmssfff}";
        }
        
        private async Task<string> GenerateInspectionRefundApplicationNumberAsync(DateTime? now = null)
        {
            var timestamp = now ?? DateTimeHelper.Now;
            var prefix = $"HC-02-{timestamp.Year}";

            // Use a random 7-digit sequence (same HC-02-YYYY-ZZZZZZZ format) instead of a
            // monotonically increasing counter: sequential numbering risks duplicate numbers
            // under concurrency and is easily guessable by customers.
            while (true)
            {
                var sequence = Nanoid.Generate("0123456789", 7);
                var candidate = $"{prefix}-{sequence}";

                var exists = await _dbContext.Refunds
                    .AsNoTracking()
                    .AnyAsync(x => x.ApplicationNumber == candidate)
                    .ConfigureAwait(false);

                if (!exists)
                {
                    return candidate;
                }
            }
        }


        private static RefundPendingCreationResult MapPendingCreationResult(RefundPendingRecord record, bool isCreated)
        {
            return new RefundPendingCreationResult
            {
                IsCreated = isCreated,
                RefundNo = record.RefundNo,
                ApplicationNo = record.ApplicationNo ?? string.Empty,
                OriginalTransactionId = record.OriginalTransactionId,
                OriginalTransactionNo = record.OriginalTransactionNo,
                RefundAmount = record.RefundAmount,
                RefundScope = string.IsNullOrWhiteSpace(record.RefundScope) ? "Full" : record.RefundScope,
                CreatedOn = record.CreatedOn,
                LastUpdatedOn = record.LastUpdatedOn
            };
        }

        private static string? GetRefundTransactionDiscriminator(short paymentMethodId)
        {
            return paymentMethodId switch
            {
                CreditCardPaymentMethodId => CardPaymentTransactionDiscriminator,
                WalletPaymentMethodId => WalletPaymentTransactionDiscriminator,
                _ => "Transaction"
            };
        }

        private static bool IsConcurrencyConflict(DateTime actualLastUpdatedOn, DateTime expectedLastUpdatedOn)
        {
            // Optimistic-concurrency token comparison. The token round-trips through JSON/JS callers
            // that frequently drop sub-second precision (the DB LastUpdatedOn carries 7-digit ticks,
            // e.g. .9360096, while a client may send only whole seconds). Comparing at millisecond
            // tolerance made every such call fail with REFUND_CONCURRENCY_CONFLICT even though nobody
            // else mutated the record. Truncate both sides to whole seconds (in the same UTC frame)
            // before comparing so a second-precision client stays compatible; a genuine concurrent
            // update still changes the second and is detected.
            var actualUtc = actualLastUpdatedOn.Kind == DateTimeKind.Utc ? actualLastUpdatedOn : actualLastUpdatedOn.ToUniversalTime();
            var expectedUtc = expectedLastUpdatedOn.Kind == DateTimeKind.Utc ? expectedLastUpdatedOn : expectedLastUpdatedOn.ToUniversalTime();
            return TruncateToSecond(actualUtc) != TruncateToSecond(expectedUtc);
        }

        private static DateTime TruncateToSecond(DateTime value)
            => new(value.Ticks - (value.Ticks % TimeSpan.TicksPerSecond), value.Kind);

        private static string BuildExecutionCorrelationId(string refundNo)
        {
            return $"{refundNo}-{Guid.NewGuid():N}";
        }

        /// <summary>
        /// Translates the display status back into the columns it is derived from, so the filter and
        /// <see cref="GetRefundDisplayStatus"/> stay in sync. Separators and casing are ignored, so
        /// "Pending Refund", "pending_refund" and "PendingRefund" are all accepted. Unlike sorting,
        /// an unrecognized value matches nothing instead of falling back: silently returning the
        /// unfiltered page would hide a wrong parameter from the caller.
        /// </summary>
        private static IQueryable<RefundPendingRecord> ApplyStatusFilter(
            IQueryable<RefundPendingRecord> query,
            string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return query;
            }

            var normalizedStatus = new string(status.Where(char.IsLetter).ToArray()).ToLowerInvariant();

            return normalizedStatus switch
            {
                "pendingrefund" => query.Where(x => x.IsPendingRefund),
                "completed" => query.Where(x => !x.IsPendingRefund && x.LastExecutionStatus == CompletedExecutionStatus),
                // LastExecutionStatus is nullable and NULL reads as "Refunded" on the display side, so
                // the IS NULL branch is spelled out rather than left to <> null semantics.
                "refunded" => query.Where(x => !x.IsPendingRefund
                    && (x.LastExecutionStatus == null || x.LastExecutionStatus != CompletedExecutionStatus)),
                _ => query.Where(x => false)
            };
        }

        private static IQueryable<RefundPendingRecord> ApplyListSorting(
            IQueryable<RefundPendingRecord> query,
            string? sortBy,
            string? sortDirection)
        {
            var normalizedSortBy = sortBy?.Trim().ToLowerInvariant();
            var isAscending = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);

            return normalizedSortBy switch
            {
                "refundno" => isAscending
                    ? query.OrderBy(x => x.RefundNo).ThenBy(x => x.LastUpdatedOn)
                    : query.OrderByDescending(x => x.RefundNo).ThenByDescending(x => x.LastUpdatedOn),
                "originaltransactionno" => isAscending
                    ? query.OrderBy(x => x.OriginalTransactionNo).ThenBy(x => x.LastUpdatedOn)
                    : query.OrderByDescending(x => x.OriginalTransactionNo).ThenByDescending(x => x.LastUpdatedOn),
                "amount" => isAscending
                    ? query.OrderBy(x => x.RefundAmount).ThenBy(x => x.LastUpdatedOn)
                    : query.OrderByDescending(x => x.RefundAmount).ThenByDescending(x => x.LastUpdatedOn),
                "applyfor" => isAscending
                    ? query.OrderBy(x => x.ApplyForName).ThenBy(x => x.LastUpdatedOn)
                    : query.OrderByDescending(x => x.ApplyForName).ThenByDescending(x => x.LastUpdatedOn),
                _ => isAscending
                    ? query.OrderBy(x => x.LastUpdatedOn).ThenBy(x => x.RefundNo)
                    : query.OrderByDescending(x => x.LastUpdatedOn).ThenByDescending(x => x.RefundNo)
            };
        }

        private static RefundFailureReason? BuildFailureReason(
            RefundPendingRecord pendingRecord,
            MagnatiRefundRecord? latestFailedRefundRecord)
        {
            var message = latestFailedRefundRecord?.GatewayErrorText
                ?? latestFailedRefundRecord?.GatewayError
                ?? pendingRecord.LatestFailureReason;

            if (string.IsNullOrWhiteSpace(message) && string.IsNullOrWhiteSpace(pendingRecord.LastExecutionStatus))
            {
                return null;
            }

            return new RefundFailureReason
            {
                IsVisible = !string.IsNullOrWhiteSpace(message),
                Message = message ?? string.Empty,
                LastExecutionStatus = pendingRecord.LastExecutionStatus,
                LastUpdatedOn = latestFailedRefundRecord?.UpdatedOn ?? latestFailedRefundRecord?.CreatedOn ?? pendingRecord.LastUpdatedOn
            };
        }

        private static bool CanExecuteRefund(short paymentMethodId, short? originalTransactionStatusId, string? lastExecutionStatus)
        {
            if (string.Equals(lastExecutionStatus, "Processing", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (paymentMethodId != CreditCardPaymentMethodId)
            {
                return false;
            }

            return originalTransactionStatusId == null || originalTransactionStatusId == CompletedTransactionStatusId;
        }

        private static string? GetUnsupportedReason(short paymentMethodId, short? originalTransactionStatusId, string? lastExecutionStatus)
        {
            if (string.Equals(lastExecutionStatus, "Processing", StringComparison.OrdinalIgnoreCase))
            {
                return "Refund is currently being processed.";
            }

            if (paymentMethodId != CreditCardPaymentMethodId)
            {
                return "Wallet refund is not supported in the current release.";
            }

            if (originalTransactionStatusId.HasValue && originalTransactionStatusId != CompletedTransactionStatusId)
            {
                return "Original transaction status is not refundable.";
            }

            return null;
        }

        private static string BuildCardInformation(string? maskedCardInfo, string? cardBrand, string? maskedCardNumber)
        {
            if (!string.IsNullOrWhiteSpace(maskedCardInfo))
            {
                return maskedCardInfo;
            }

            if (!string.IsNullOrWhiteSpace(cardBrand) && !string.IsNullOrWhiteSpace(maskedCardNumber))
            {
                return $"{cardBrand} {maskedCardNumber}";
            }

            if (!string.IsNullOrWhiteSpace(maskedCardNumber))
            {
                return maskedCardNumber;
            }

            return "-";
        }

        private static string GetPaymentMethodDisplayName(short paymentMethodId)
        {
            return paymentMethodId switch
            {
                CreditCardPaymentMethodId => "Credit / Debit Card",
                WalletPaymentMethodId => "Wallet",
                _ => "Unknown"
            };
        }

        private static string GetTransactionStatusDisplayName(short? statusId)
        {
            return statusId switch
            {
                CompletedTransactionStatusId => "Completed",
                4 => "Failed",
                2 => "Processing",
                1 => "Pending",
                _ => string.Empty
            };
        }

        private static string GetTransactionTypeDisplayName(short transactionTypeId)
        {
            return transactionTypeId switch
            {
                ServicePaymentTransactionTypeId => "Service Payment",
                FinesTransactionTypeId => "Fines",
                RefundTransactionTypeId => "Refund",
                _ => "Unknown"
            };
        }

        private static string GetRefundDisplayStatus(bool isPendingRefund, string? lastExecutionStatus)
        {
            if (isPendingRefund)
            {
                return "Pending Refund";
            }

            return string.Equals(lastExecutionStatus, CompletedExecutionStatus, StringComparison.OrdinalIgnoreCase)
                ? "Completed"
                : "Refunded";
        }

        private static string GetApplyForIconKey(short? userTypeId)
        {
            return userTypeId switch
            {
                (short)UserTypeCode.Individual => "individual",
                (short)UserTypeCode.Commercial or (short)UserTypeIdEnum.Commercial => "commercial",
                (short)UserTypeCode.FreeZone or (short)UserTypeIdEnum.FreeZone => "free-zone",
                (short)UserTypeCode.TalentAgency => "talent-agency",
                (short)UserTypeCode.Government or (short)UserTypeIdEnum.Government => "government",
                (short)UserTypeCode.Embassy or (short)UserTypeIdEnum.Embassy => "embassy",
                (short)UserTypeCode.Consulate or (short)UserTypeIdEnum.Consulate => "consulate",
                (short)UserTypeCode.CulturalClubs or (short)UserTypeIdEnum.CulturalClubs => "cultural-clubs",
                _ => "default"
            };
        }
    }
}

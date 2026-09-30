using System;
using System.Collections.Generic;

namespace UMC.AdminPortal.Application.Dtos.Finance
{
    public class AdminPaymentTransactionListRequestDto
    {
        public string? Keyword { get; set; }
        public string? UserId { get; set; }
        public int? ProfileId { get; set; }
        public short? TransactionTypeId { get; set; }
        public short? PaymentMethodId { get; set; }
        public short? StatusId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string? SortBy { get; set; } = "CompletedAt";
        public string? SortDirection { get; set; } = "desc";
    }

    public class AdminPaymentTransactionListItemDto
    {
        public int Id { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public short TransactionTypeId { get; set; }
        public AdminFinanceValueObjectDto TransactionTypeObj { get; set; } = new();
        public short PaymentMethodId { get; set; }
        public AdminFinanceValueObjectDto PaymentMethodObj { get; set; } = new();
        public int StatusId { get; set; }
        public AdminFinanceValueObjectDto StatusObj { get; set; } = new();
        public string? ReferenceNumber { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "AED";
        public string? Description { get; set; }
        public decimal? BalanceBefore { get; set; }
        public decimal? BalanceAfter { get; set; }
        public string? ApplyFor { get; set; }
        public AdminFinanceProfileInfoDto? ApplyForObj { get; set; }
        public int? ProfileId { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime? UpdateOn { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    public class AdminPaymentTransactionListResponseDto
    {
        public List<AdminPaymentTransactionListItemDto> Items { get; set; } = new();
        public int PageIndex { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
    }

    public class AdminPaymentTransactionStatisticsDto
    {
        public int TotalPayments { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal ServiceApplicationPayments { get; set; }
        public decimal Fines { get; set; }
        public decimal Refunds { get; set; }
        public string Currency { get; set; } = "AED";
        public AdminPaymentsDataStatisticsDto PaymentsDataStatistics { get; set; } = new();
        public AdminRevenuesDataStatisticsDto RevenuesDataStatistics { get; set; } = new();
    }

    public class AdminPaymentsDataStatisticsDto
    {
        /// <summary>Completed payment count within the last 7 days window.</summary>
        public int Last7DaysTotal { get; set; }

        /// <summary>Last 7 days count minus the preceding 7 days count; drives the trend arrow.</summary>
        public int GrowthCount { get; set; }
    }

    public class AdminRevenuesDataStatisticsDto
    {
        /// <summary>Completed revenue amount within the last 7 days window.</summary>
        public decimal Last7DaysTotal { get; set; }

        /// <summary>Last 7 days amount minus the preceding 7 days amount; drives the trend arrow.</summary>
        public decimal RevenueAmount { get; set; }
    }

    public class AdminPaymentTransactionSummaryResponseDto
    {
        public decimal TotalSpending { get; set; }
        public decimal ServiceApplicationFees { get; set; }
        public decimal TotalFinesPaid { get; set; }
        public decimal TotalRefunds { get; set; }
        public decimal TotalRecharge { get; set; }
        public string Currency { get; set; } = "AED";
    }

    public class AdminPaymentMethodStatisticsDto
    {
        public decimal WalletTotal { get; set; }
        public decimal CardTotal { get; set; }
        public decimal FailedTotal { get; set; }
        public decimal FailedRefundTotal { get; set; }
        public string Currency { get; set; } = "AED";
    }

    public class AdminFinanceValueObjectDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
    }

    public class AdminFinanceProfileInfoDto
    {
        public int? ProfileId { get; set; }
        public int? UserTypeId { get; set; }
        public string? Name { get; set; }
        public string? NameEn { get; set; }
        public string? NameAr { get; set; }
        public string? AccountName { get; set; }
        public string? AccountEmail { get; set; }
    }

    public class AdminFinanceTransactionDetailDto
    {
        public AdminFinanceTransactionInfoDto Transaction { get; set; } = new();
        public List<AdminFinanceApplicationInfoDto> ApplicationItems { get; set; } = new();
        public AdminFinanceTransactionRefundInfoDto? Refund { get; set; }
        public AdminFinanceAccountInfoDto? AccountInfo { get; set; }
        public AdminFinanceRelatedViolationDto? RelatedViolation { get; set; }
    }

    public class AdminFinanceTransactionInfoDto
    {
        public int Id { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public int? RefundId { get; set; }
        public short TransactionTypeId { get; set; }
        public AdminFinanceValueObjectDto TransactionTypeObj { get; set; } = new();
        public short PaymentMethodId { get; set; }
        public AdminFinanceValueObjectDto PaymentMethodObj { get; set; } = new();
        public decimal Amount { get; set; }
        public int StatusId { get; set; }
        public AdminFinanceValueObjectDto StatusObj { get; set; } = new();
        public string? Description { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? UpdateOn { get; set; }
        public string? ReferenceNumber { get; set; }
        public AdminFinanceProfileInfoDto? ApplyForObj { get; set; }
        public decimal? BalanceBefore { get; set; }
        public decimal? BalanceAfter { get; set; }
        public string? MaskedCardNumber { get; set; }
        public string? CardBrand { get; set; }
    }

    public class AdminFinanceApplicationInfoDto
    {
        public int? ApplicationId { get; set; }
        public int? ApplicationDetailId { get; set; }
        public string? ApplicationNumber { get; set; }
        public string? ServiceName { get; set; }
        public string? ServiceNameEn { get; set; }
        public string? ServiceNameAr { get; set; }
        public int? ApplicationStatusId { get; set; }
        public AdminFinanceValueObjectDto? ApplicationStatusObj { get; set; }
        public string? ApplyFor { get; set; }
        public DateTime? CreatedOn { get; set; }
    }

    public class AdminFinanceTransactionRefundInfoDto
    {
        public int? Id { get; set; }
        public string? ApplicationNo { get; set; }
        public short? StatusId { get; set; }
        public AdminFinanceValueObjectDto StatusObj { get; set; } = new();
        public short? ReasonId { get; set; }
        public AdminFinanceValueObjectDto? ReasonObj { get; set; }
        public decimal? Amount { get; set; }
        public short? PaymentMethodId { get; set; }
        public AdminFinanceValueObjectDto? PaymentMethodObj { get; set; }
        public AdminFinanceProfileInfoDto? ApplyForObj { get; set; }
        public DateTime? UpdateOn { get; set; }
        public DateTime? CreatedOn { get; set; }

        /// <summary>"Full" or "Partial", taken from the refund pending record.</summary>
        public string? RefundScope { get; set; }

        /// <summary>Display name of the admin who executed this refund attempt.</summary>
        public string? ProcessedBy { get; set; }

        /// <summary>Account (email) of the admin who executed this refund attempt.</summary>
        public string? ProcessorAccount { get; set; }

        /// <summary>Card the refund is returned to, read back from the original payment.</summary>
        public string? MaskedCardNumber { get; set; }

        public string? CardBrand { get; set; }
    }

    /// <summary>
    /// Inspection violation behind a fine transaction, matched on
    /// <c>Transaction.ReferenceNumber == InspectionViolation.ViolationNo</c>.
    /// </summary>
    public class AdminFinanceRelatedViolationDto
    {
        public int ViolationId { get; set; }
        public string ViolationNo { get; set; } = string.Empty;
        public int ViolationTypeId { get; set; }
        public AdminFinanceValueObjectDto? ViolationTypeObj { get; set; }
        public DateTime ViolationTime { get; set; }
        /// <summary>Current fine amount. Reset by an approved appeal, so it can differ from the paid transaction amount.</summary>
        public decimal FineAmount { get; set; }
        public decimal? BeforeAppealAdjustedFineAmount { get; set; }
        public decimal? AfterAppealAdjustedFineAmount { get; set; }
        public string? InspectorUserId { get; set; }
        public string? InspectorName { get; set; }
        /// <summary>Violator display name (establishment or individual).</summary>
        public string? EntityName { get; set; }
    }

    public class AdminFinanceAccountInfoDto
    {
        public string? AccountName { get; set; }
        public string? AccountEmail { get; set; }
        public decimal? Balance { get; set; }
        public string? Currency { get; set; }
        public short? StatusId { get; set; }
        public AdminFinanceValueObjectDto? StatusObj { get; set; }
        public DateTime? UpdateOn { get; set; }
    }

    public class AdminFinanceServiceApplicationPaymentDto
    {
        public int Id { get; set; }
        public int ApplicationId { get; set; }
        public short ServiceId { get; set; }
        public decimal Amount { get; set; }
        public string? CurrencyCode { get; set; }
        public string FeeVersion { get; set; } = string.Empty;
        public string? FeeBreakdownJson { get; set; }
        public string? FeeWarningsJson { get; set; }
        public string? FreeDecisionJson { get; set; }
        public string? FeeQuoteRawResponseJson { get; set; }
        public string? PricingSource { get; set; }
        public string? ManualPricingType { get; set; }
        public string? UserTypeCode { get; set; }
        public int? PricingConfigurationId { get; set; }
        public string? PricingSnapshotJson { get; set; }
        public string? ReceiptWithHeaderUrl { get; set; }
        public string? PaymentReceiptWithHeaderUrl { get; set; }
        public short ChannelId { get; set; }
        public DateTime ExpiresAt { get; set; }
        public short Status { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime? UpdatedOn { get; set; }
    }

    public class AdminRechargeListRequestDto
    {
        public string? Keyword { get; set; }
        public short? PaymentMethodId { get; set; }
        public short? StatusId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string? SortBy { get; set; } = "CreatedOn";
        public string? SortDirection { get; set; } = "desc";
    }

    public class AdminRechargeListItemDto
    {
        public int Id { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public short TransactionTypeId { get; set; }
        public AdminFinanceValueObjectDto TransactionTypeObj { get; set; } = new();
        public short PaymentMethodId { get; set; }
        public AdminFinanceValueObjectDto PaymentMethodObj { get; set; } = new();
        public int StatusId { get; set; }
        public AdminFinanceValueObjectDto StatusObj { get; set; } = new();
        public string? ReferenceNumber { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal? BalanceBefore { get; set; }
        public decimal? BalanceAfter { get; set; }
        public string? Description { get; set; }
        public string? AccountName { get; set; }
        public string? AccountEmail { get; set; }
        public string Currency { get; set; } = "AED";
        public int? ProfileId { get; set; }
        public DateTime? CreatedTime { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    public class AdminRechargeListResponseDto
    {
        public List<AdminRechargeListItemDto> Items { get; set; } = new();
        public int PageIndex { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
    }

    public class AdminRechargeStatisticsDto
    {
        public int TotalRecharges { get; set; }
        public decimal TotalRechargeAmount { get; set; }
        public decimal Last7DaysRechangeAmount { get; set; }
        public decimal CompletedRecharges { get; set; }
        public decimal FailRecharges { get; set; }
        public int RechargeCount { get; set; }
        public decimal RechargeAmount { get; set; }
        public decimal WalletRechargeAmount { get; set; }
        public decimal CardRechargeAmount { get; set; }
        public string Currency { get; set; } = "AED";
    }

    public class AdminFinanceLookupItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}

namespace UMC.AdminPortal.Application.Dtos.Refunds
{
    public class RefundListRequestDto
    {
        public string? Search { get; set; }

        /// <summary>
        /// Display status to filter by: "Pending Refund", "Completed" or "Refunded" (the values
        /// returned in <see cref="RefundListItemDto.Status"/>). Separators and casing are ignored.
        /// Null or empty returns every status.
        /// </summary>
        public string? Status { get; set; }

        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string? SortBy { get; set; } = "LastUpdatedOn";
        public string? SortDirection { get; set; } = "desc";
    }

    public class RefundListItemDto
    {
        public string RefundNo { get; set; } = string.Empty;
        public string OriginalTransactionNo { get; set; } = string.Empty;
        public string Type { get; set; } = "Refund";
        public string RefundScope { get; set; } = "Full";
        public RefundApplyForDto ApplyFor { get; set; } = new();
        public string AccountOrCardHolder { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "AED";
        public string Status { get; set; } = "Pending Refund";
        public DateTime LastUpdatedOn { get; set; }
        public bool CanExecuteRefund { get; set; }
        public string? UnsupportedReason { get; set; }
    }

    public class RefundApplyForDto
    {
        public short UserTypeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string IconKey { get; set; } = string.Empty;
    }

    public class RefundListResponseDto
    {
        public List<RefundListItemDto> Items { get; set; } = new();
        public int PageIndex { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
    }

    public class RefundDetailDto
    {
        public string RefundNo { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending Refund";
        public string Type { get; set; } = "Refund";
        public DateTime LastUpdatedOn { get; set; }
        public RefundApplicationInformationDto ApplicationInformation { get; set; } = new();
        public RefundFailureReasonDto? FailureReason { get; set; }
        public RefundRelatedPaymentDto RelatedPaymentInformation { get; set; } = new();
        public bool CanExecuteRefund { get; set; }
        public string? UnsupportedReason { get; set; }

        // ── Overview identity fields ──
        public int? ProfileId { get; set; }
        public int? UserProfileId { get; set; }
        public string? UserId { get; set; }
        public int? UserTypeId { get; set; }
        public string? UserTypeCode { get; set; }
        public int? EstablishmentId { get; set; }
        public int? IndividualId { get; set; }
        public string? ApplyFor { get; set; }
        public string? ApllyFor { get; set; }
        public string? EstablishmentName { get; set; }
        public string? EstablishmentNameAr { get; set; }
        public string? LicenseNumber { get; set; }
        public int? ApplicationId { get; set; }
        public string? ApplicationNumber { get; set; }
    }

    public class RefundApplicationInformationDto
    {
        public string PaymentMethod { get; set; } = string.Empty;
        public string AccountOrCardHolder { get; set; } = string.Empty;
        public string? CardInformation { get; set; }
        public string? Email { get; set; }
        public string ApplyFor { get; set; } = string.Empty;
        public decimal AmountCharged { get; set; }
        public string Currency { get; set; } = "AED";
        public string RefundScope { get; set; } = "Full";
        public string RefundReason { get; set; } = string.Empty;
    }

    public class RefundFailureReasonDto
    {
        public bool IsVisible { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? LastExecutionStatus { get; set; }
        public DateTime? LastUpdatedOn { get; set; }
    }

    public class RefundRelatedPaymentDto
    {
        public string TransactionNo { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public DateTime? LastUpdatedOn { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public string? CardInformation { get; set; }
        public decimal AmountCharged { get; set; }
        public string Currency { get; set; } = "AED";
        public string ApplyFor { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class RefundStatisticsDto
    {
        public RefundAmountStatisticsDto TotalRefundAmount { get; set; } = new();
        public RefundCountStatisticsDto TotalRefundCount { get; set; } = new();
        public int PendingRefundCount { get; set; }
        public decimal PendingRefundAmount { get; set; }
        public string Currency { get; set; } = "AED";
    }

    public class RefundAmountStatisticsDto
    {
        public decimal WalletRefundAmount { get; set; }
        public decimal CardRefundAmount { get; set; }
        public decimal TotalRefundAmount { get; set; }
        public string Hint { get; set; } = "Only completed refund transactions are counted";
    }

    public class RefundCountStatisticsDto
    {
        public int WalletRefundCount { get; set; }
        public int CardRefundCount { get; set; }
        public int TotalRefundCount { get; set; }
        public string Hint { get; set; } = "Only completed refund transactions are counted";
    }

    public class ExecuteRefundRequestDto
    {
        public string RefundNo { get; set; } = string.Empty;
        public string OperatorId { get; set; } = string.Empty;
        public string OperatorName { get; set; } = string.Empty;
        public DateTime? ExpectedLastUpdatedOn { get; set; }
    }

    public class ExecuteRefundResponseDto
    {
        public bool IsSuccess { get; set; }
        public string BusinessStatus { get; set; } = string.Empty;
        public string TransactionStatus { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? FailureReason { get; set; }
        public string RefundNo { get; set; } = string.Empty;
        public string OriginalTransactionNo { get; set; } = string.Empty;
        public string? RefundTransactionNo { get; set; }
        public DateTime LastUpdatedOn { get; set; }
        public bool CanRetry { get; set; }
    }
}


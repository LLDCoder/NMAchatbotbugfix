namespace UMC.AdminPortal.Application.Dtos.License
{
    /// <summary>
    /// License detail DTO
    /// </summary>
    public class LicenseDetailDto
    {
        /// <summary>
        /// License ID
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Application Number
        /// </summary>
        public string ApplicationNumber { get; set; } = string.Empty;

        /// <summary>
        /// License Number (certificate number). Kept as the operational key.
        /// </summary>
        public string LicenseNumber { get; set; } = string.Empty;

        /// <summary>
        /// Number to render as the License Number: the media license number when the license owns a
        /// media-license shell, otherwise <see cref="LicenseNumber"/>. Matches the list column.
        /// </summary>
        public string ShowLicenseNumber { get; set; } = string.Empty;

        /// <summary>
        /// Media license number, null when the license has no media-license shell.
        /// </summary>
        public string? MediaLicenseNumber { get; set; }

        /// <summary>
        /// License Type (Service Name)
        /// </summary>
        public string LicenseType { get; set; } = string.Empty;

        /// <summary>
        /// License Type (Arabic)
        /// </summary>
        public string LicenseTypeAr { get; set; } = string.Empty;

        /// <summary>
        /// Issuance Date
        /// </summary>
        public DateTime? IssuanceDate { get; set; }

        /// <summary>
        /// Effective Date
        /// </summary>
        public DateTime? EffectiveDate { get; set; }

        /// <summary>
        /// Expiry Date
        /// </summary>
        public DateTime? ExpiryDate { get; set; }

        /// <summary>
        /// Days Remaining
        /// </summary>
        public int? DaysRemaining { get; set; }

        /// <summary>
        /// License Status
        /// </summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>
        /// Years of License
        /// </summary>
        public short? YearsOfLicense { get; set; }

        /// <summary>
        /// Certificate URL
        /// </summary>
        public string? CertificateUrl { get; set; }
        public string? CertificatePassword { get; set; }
        public string? DisabledReason { get; set; }
        public string? Remarks { get; set; }

        /// <summary>
        /// Certificate with Header URL
        /// </summary>
        public string? CertificateWithHeaderUrl { get; set; }

        /// <summary>
        /// Applicant/Holder Information
        /// </summary>
        public LicenseHolderDto? Holder { get; set; }

        /// <summary>
        /// Establishment Information (if applicable)
        /// </summary>
        public LicenseEstablishmentDto? Establishment { get; set; }

        /// <summary>
        /// Service Fees Information
        /// </summary>
        public List<LicenseServiceFeeDto>? ServiceFees { get; set; }

        /// <summary>
        /// Economic Activities
        /// </summary>
        public List<LicenseEconomicActivityDto>? EconomicActivities { get; set; }

        /// <summary>
        /// Profile ID from Application (for Establishment Overview)
        /// </summary>
        public int? ProfileId { get; set; }

        /// <summary>
        /// User Type ID
        /// </summary>
        public short? UserTypeId { get; set; }

        /// <summary>
        /// User Type Name (English)
        /// </summary>
        public string? UserTypeNameEn { get; set; }

        /// <summary>
        /// User Type Name (Arabic)
        /// </summary>
        public string? UserTypeNameAr { get; set; }

        /// <summary>
        /// User Type Code
        /// </summary>
        public string? UserTypeCode { get; set; }

        /// <summary>
        /// Historical Application Records
        /// </summary>
        public List<LicenseApplicationHistoryDto>? ApplicationHistory { get; set; }
    }

    /// <summary>
    /// License holder DTO
    /// </summary>
    public class LicenseHolderDto
    {
        /// <summary>
        /// Holder Type (Person/Establishment)
        /// </summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>
        /// Holder ID
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Name (English)
        /// </summary>
        public string NameEn { get; set; } = string.Empty;

        /// <summary>
        /// Name (Arabic)
        /// </summary>
        public string NameAr { get; set; } = string.Empty;

        /// <summary>
        /// Email
        /// </summary>
        public string? Email { get; set; }

        /// <summary>
        /// Mobile
        /// </summary>
        public string? Mobile { get; set; }

        /// <summary>
        /// Emirates ID (for Person)
        /// </summary>
        public string? EmiratesId { get; set; }

        /// <summary>
        /// Commercial License Number (for Establishment)
        /// </summary>
        public string? CommercialLicenseNumber { get; set; }
    }

    /// <summary>
    /// License establishment DTO
    /// </summary>
    public class LicenseEstablishmentDto
    {
        /// <summary>
        /// Establishment ID
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Establishment Name (English)
        /// </summary>
        public string NameEn { get; set; } = string.Empty;

        /// <summary>
        /// Establishment Name (Arabic)
        /// </summary>
        public string NameAr { get; set; } = string.Empty;

        /// <summary>
        /// Commercial License Number
        /// </summary>
        public string? CommercialLicenseNumber { get; set; }

        /// <summary>
        /// Emirate
        /// </summary>
        public string? Emirate { get; set; }

        /// <summary>
        /// Address
        /// </summary>
        public string? Address { get; set; }

        /// <summary>
        /// Warnings & Violations Count
        /// </summary>
        public int WarningsCount { get; set; }

        /// <summary>
        /// Unpaid Fines Count
        /// </summary>
        public int UnpaidFinesCount { get; set; }

        /// <summary>
        /// Documents Count
        /// </summary>
        public int DocumentsCount { get; set; }

        /// <summary>
        /// Partners Count
        /// </summary>
        public int PartnersCount { get; set; }
    }

    /// <summary>
    /// License service fee DTO
    /// </summary>
    public class LicenseServiceFeeDto
    {
        /// <summary>
        /// Fee Name (English)
        /// </summary>
        public string NameEn { get; set; } = string.Empty;

        /// <summary>
        /// Fee Name (Arabic)
        /// </summary>
        public string NameAr { get; set; } = string.Empty;

        /// <summary>
        /// Fee Amount
        /// </summary>
        public decimal Amount { get; set; }

        /// <summary>
        /// Fee Code
        /// </summary>
        public string? Code { get; set; }
    }

    /// <summary>
    /// License economic activity DTO
    /// </summary>
    public class LicenseEconomicActivityDto
    {
        /// <summary>
        /// Activity ID
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Activity Name (English)
        /// </summary>
        public string NameEn { get; set; } = string.Empty;

        /// <summary>
        /// Activity Name (Arabic)
        /// </summary>
        public string NameAr { get; set; } = string.Empty;

        /// <summary>
        /// Activity Code
        /// </summary>
        public string? Code { get; set; }
    }

    /// <summary>
    /// License application history DTO
    /// </summary>
    public class LicenseApplicationHistoryDto
    {
        /// <summary>
        /// Application Number
        /// </summary>
        public string ApplicationNumber { get; set; } = string.Empty;

        /// <summary>
        /// Service Name (English)
        /// </summary>
        public string ServiceName { get; set; } = string.Empty;

        /// <summary>
        /// Service Type
        /// </summary>
        public string? Type { get; set; }

        /// <summary>
        /// Submission Time (CreatedOn)
        /// </summary>
        public DateTime SubmissionTime { get; set; }
    }
}


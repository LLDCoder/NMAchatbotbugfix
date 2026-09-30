namespace UMC.AdminPortal.Application.Dtos.License
{
    /// <summary>
    /// License list response DTO
    /// </summary>
    public class LicenseListResponseDto
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
        /// License Number (certificate number). Kept as the operational key - other calls still match on it.
        /// </summary>
        public string LicenseNumber { get; set; } = string.Empty;

        /// <summary>
        /// Number to render in the License No. column: the media license number when the license owns a
        /// media-license shell, otherwise <see cref="LicenseNumber"/>. Display only.
        /// </summary>
        public string ShowLicenseNumber { get; set; } = string.Empty;

        /// <summary>
        /// Media license number printed on the issued license (Application.MediaLicenses.MediaLicenseNumber).
        /// Null for rows without a media-license shell, where <see cref="ShowLicenseNumber"/> falls back to
        /// the certificate number.
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
        /// Media activities the licence covers, in the request language, separated by ", " when the
        /// licence covers more than one. Empty for licenses without a media-license shell.
        /// </summary>
        public string MediaActivity { get; set; } = string.Empty;

        /// <summary>
        /// Title of the work the permit covers, taken from the submitted application form (book title,
        /// publication title, film title...). Joined with ", " when one application declares several
        /// works, empty when the service form has no title field.
        /// </summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Author name or publishing house taken from the submitted application form. Joined with ", "
        /// when the application declares several, empty when the service form has neither.
        /// </summary>
        public string AuthorOrPublishingHouse { get; set; } = string.Empty;

        /// <summary>
        /// Applicant Name
        /// </summary>
        public string Applicant { get; set; } = string.Empty;

        /// <summary>
        /// Applicant Type (Person/Establishment)
        /// </summary>
        public string ApplicantType { get; set; } = string.Empty;

        /// <summary>
        /// Issuance Time
        /// </summary>
        public DateTime? IssuanceTime { get; set; }

        /// <summary>
        /// Expiration Time
        /// </summary>
        public DateTime? ExpirationTime { get; set; }

        /// <summary>
        /// License Status (active, expired, cancelled, disabled)
        /// </summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>
        /// Days remaining until expiration
        /// </summary>
        public int? DaysRemaining { get; set; }

        /// <summary>
        /// Certificate URL
        /// </summary>
        public string? CertificateUrl { get; set; }
        public string? CertificatePassword { get; set; }
        public string? DisabledReason { get; set; }
        public string? Remarks { get; set; }
    }
}


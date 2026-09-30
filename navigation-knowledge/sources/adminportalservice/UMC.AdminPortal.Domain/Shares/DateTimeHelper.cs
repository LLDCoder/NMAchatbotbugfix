using System;
using UMC.Utils.Framework.Time;

namespace UMC.AdminPortal.Domain.Shares
{
    /// <summary>
    /// Provides the application's "current time", fixed to the project time zone
    /// (Asia/Dubai, UTC+4). Delegates to <see cref="UmcClock"/> so the whole
    /// solution shares a single time source. All code that needs the current time
    /// should use this helper instead of <see cref="DateTime.Now"/> /
    /// <see cref="DateTime.UtcNow"/>.
    /// </summary>
    public static class DateTimeHelper
    {
        /// <summary>UTC offset (in hours) used for the application's current time.</summary>
        public const int UtcOffsetHours = 4;

        /// <summary>Date-time format used for SignalR template variables.</summary>
        public const string TemplateDateTimeFormat = "dd/MM/yyyy HH:mm:ss";

        /// <summary>Current Dubai wall-clock time (Kind=Unspecified — the storage contract value).</summary>
        public static DateTime Now => UmcClock.Now;

        /// <summary>Current Dubai date (time component cleared).</summary>
        public static DateTime Today => UmcClock.Today;

        /// <summary>Current time as a <see cref="DateTimeOffset"/> carrying a +4:00 offset.</summary>
        public static DateTimeOffset OffsetNow => UmcClock.NowOffset;
    }
}

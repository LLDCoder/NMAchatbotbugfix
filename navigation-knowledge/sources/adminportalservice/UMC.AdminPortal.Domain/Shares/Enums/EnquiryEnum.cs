using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UMC.AdminPortal.Domain.Shares.Enums
{
    public class EnquiryEnum
    {
        public enum EnquiryStatus
        {
            UnderProcessing = 1,
            Resolved = 5,
            Completed = 6,
            Cancelled = 7
        }

        public enum EnquiryAdminStatus
        {
            Open = 1,
            PendingCustomer = 2,
            DepartmentProcessing = 3,
            DepartmentProcessed = 4,
            Resolved = 5,
            Completed = 6,
            Cancelled = 7
        }

        // Matches Lookup.TypeDictionary scope='InquiryConversationSource' (DB rows are for display text only).
        public enum EnquiryConversationSource : short
        {
            CustomerPortal = 1,
            CustomerHappness = 2,
            TransferNote = 3,
            InternalNode = 4,
            /// <summary>
            /// Department Process
            /// </summary>
            DepartmentProcessed = 5,
            /// <summary>
            /// Department Send back
            /// </summary>
            DepartmentSendback = 6,
            DepartmentAutomatic = 7
        }
    }

    public enum EnquiryTypeEnum : short
    {
        Inquiry = 1,
        Complaint = 2,
        Notice = 3,
        Suggestion = 4,
        Compliment = 5
    }

    public enum EnquiryIssueCategory : short
    {
        Business = 1,
        Technical = 2,
        Mixed = 3
    }

    public enum EnquiryPriorityEnum : short
    {
        Low = 3,
        Medium = 2,
        High = 1
    }

    public enum EnquiryProcessTypeEnum : short
    {
        Process = 1,
        SendBack = 2
    }
    // Named Code constants for Lookup.TypeDictionary scope='inquiry' (DB is source of truth for the full list;
    // add a const here only when business logic needs to branch on a specific type).
    public static class EnquiryTypeCodes
    {
        public const short Complaint = 2;
    }

    // Named Code constants for Lookup.TypeDictionary scope='inquiry source' (DB is source of truth for the full list;
    // add a const here only when business logic needs to branch on or default to a specific channel).
    public static class EnquirySourceCodes
    {
        public const short EServices = 5;
        public const short Dynamics365 = 6;
    }
}

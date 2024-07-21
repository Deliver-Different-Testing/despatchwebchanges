using System;

namespace DespatchWeb.EntityClasses
{
    public partial class UvwBookingToday
    {
        public DateTime? UcbkNextDue { get; set; }
        public int UcbkId { get; set; }
        public DateTime? UcbkTime { get; set; }
        public string? UcbkClientCode { get; set; }
        public string FromSuburb { get; set; } = null!;
        public string ToSuburb { get; set; } = null!;
        public string UcjtName { get; set; } = null!;
        public bool? UcbkDone { get; set; }
        public string? UcbkFromAddr { get; set; }
        public string? UcbkToAddr { get; set; }
        public string? UcbkJobNumber { get; set; }
        public string? UcbkContact { get; set; }
        public int? UcbkClientId { get; set; }
        public double? UcbkType { get; set; }
        public string? Code { get; set; }
    }
}
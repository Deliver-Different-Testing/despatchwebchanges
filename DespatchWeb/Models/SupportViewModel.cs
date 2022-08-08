using System;

namespace DespatchWeb.Models
{
    public class SupportViewModel
    {
        public DateTime? TimeStamp { get; set; }
        public string Courier { get; set; }
        public string Staff { get; set; }
        public string JobNumber { get; set; }
        public string Description { get; set; }
        public string Notes { get; set; }
        public int? RemainTime { get; set; }
        public double? EventType { get; set; }
        public string LockedBy { get; set; }
        public int? JobId { get; set; }
        public int? EventId { get; set; }
    }
}



using System;

namespace DespatchWeb.EntityClasses
{
    public partial class TucJobNationwide
    {
        public int UcnwId { get; set; }
        public int? UcnwJobId { get; set; }
        public string UcnwJobNumber { get; set; } = null!;
        public int UcnwClientId { get; set; }
        public int? UcnwPickUpAgentId { get; set; }
        public int? UcnwDeliveryAgentId { get; set; }
        public bool UcnwAirportOnly { get; set; }
        public int UcnwDestinationId { get; set; }
        public string? UcnwConNote { get; set; }
        public string? UcnwFlightNo { get; set; }
        public DateTime? UcnwEtd { get; set; }
        public DateTime? UcnwEta { get; set; }
        public string? UcnwNotes { get; set; }
        public int UcnwItb { get; set; }
        public int UcnwPickUpJobId { get; set; }
        public int UcnwDeliveryJobId { get; set; }
        public DateTime? UcnwSystemDate { get; set; }
        public int? JobBookingId { get; set; }
        public string? UcnwCpsignature { get; set; }

        public virtual TucJobBooking? JobBooking { get; set; }
    }
}
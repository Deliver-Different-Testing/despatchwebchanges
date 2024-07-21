using System;
using System.Collections.Generic;

namespace DespatchWeb.EntityClasses
{
    public partial class TucSuburb
    {
        public TucSuburb()
        {
            TucClients = new HashSet<TucClient>();
            TucStaffs = new HashSet<TucStaff>();
        }

        public int UcsuId { get; set; }
        public int UcsuArea { get; set; }
        public string UcsuName { get; set; } = null!;
        public int? UcsuRegion { get; set; }
        public int UcsuBaseRegion { get; set; }
        public int? UcsuKm { get; set; }
        public int? SiteId { get; set; }
        public int? DeliveryStandardId { get; set; }
        public int? SamedayRegion { get; set; }
        public string Smsname { get; set; } = null!;
        public int? Priority { get; set; }
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; } = null!;
        public string? Alias { get; set; }
        public string? OurRefCode { get; set; }
        public int? BaggageArea { get; set; }
        public decimal? FreightForwardAmount { get; set; }
        public decimal? Sdamount { get; set; }
        public string? City { get; set; }
        public int? AirportId { get; set; }
        public string? Gsssuburb { get; set; }
        public decimal? SdrawAmount { get; set; }
        public int? AirportKm { get; set; }
        public string? GoogleSuburbAlias { get; set; }
        public string PostCode { get; set; } = null!;
        public string? PrefixRunName { get; set; }
        public string? Gsscity { get; set; }

        public virtual ICollection<TucClient> TucClients { get; set; }
        public virtual ICollection<TucStaff> TucStaffs { get; set; }
    }
}
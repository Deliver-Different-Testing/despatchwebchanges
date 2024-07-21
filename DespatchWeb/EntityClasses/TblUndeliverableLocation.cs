using System;
using System.Collections.Generic;

namespace DespatchWeb.EntityClasses
{
    public partial class TblUndeliverableLocation
    {
        public TblUndeliverableLocation()
        {
            TucJobs = new HashSet<TucJob>();
        }

        public int UndeliverableLocationId { get; set; }
        public DateTime Created { get; set; }
        public string CreatedBy { get; set; } = null!;
        public DateTime LastModified { get; set; }
        public string LastModifiedBy { get; set; } = null!;
        public string? Notes { get; set; }
        public string Name { get; set; } = null!;
        public string Podname { get; set; } = null!;
        public int JobTypeId { get; set; }
        public string Message { get; set; } = null!;
        public string WebDeliveredTimeLabel { get; set; } = null!;

        public virtual TucJobType JobType { get; set; } = null!;
        public virtual ICollection<TucJob> TucJobs { get; set; }
    }
}
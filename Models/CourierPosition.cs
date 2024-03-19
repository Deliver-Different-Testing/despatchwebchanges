using System;

namespace DespatchWeb.Models
{
    public class CourierPosition
    {
        public decimal? Longitude { get; set; }
        public decimal? Latitude { get; set; }
        public string Time { get; set; }
        public string Status { get; set; }
        public int? JobID { get; set; }
        public bool GPSWasEstimated { get; set; }
        public string rawdata { get; set; }
        public string CourierName { get; set; }
        public string FirstName { get; set; }
        public int? RunOrder { get; set; }
        public int? JobStatus { get; set; }
        public string Number { get; set; }
    }
}

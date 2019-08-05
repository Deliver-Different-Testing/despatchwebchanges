using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Models
{
    public class AvailableCourierPosition
    {
        public int CourierID { get; set; }
        public int ChannelID { get; set; }
        public string VehicleType { get; set; }
        public string Code { get; set; }
        public string FleetCode { get; set; }
        public string ClearListAreaIDs { get; set; }
        public Nullable<decimal> Longitude { get; set; }
        public Nullable<decimal> Latitude { get; set; }


    }
}

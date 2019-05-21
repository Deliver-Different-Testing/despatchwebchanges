using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;


namespace DespatchWeb.Models
{

    public  class CourierLocation
    {
        [JsonProperty("Longitude")] public double Longitude { get; set; }

        [JsonProperty("Latitude")] public double Latitude { get; set; }

        [JsonProperty("Time")] public DateTime Time { get; set; }

        [JsonProperty("Status")] public string Status { get; set; }

        [JsonProperty("JobID")] public string JobId { get; set; }

        [JsonProperty("GPSWasEstimated")] public string GpsWasEstimated { get; set; }

        [JsonProperty("RawData")] public string RawData { get; set; }

        [JsonProperty("CourierName")] public string CourierName { get; set; }

        [JsonProperty("FirstName")] public string FirstName { get; set; }
    }
}


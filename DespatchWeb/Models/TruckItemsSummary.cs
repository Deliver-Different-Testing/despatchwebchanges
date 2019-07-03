using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


namespace DespatchWeb.Models
{
    public class TruckItemsSummary
    {
        [JsonProperty("quantity")]
        public int intQuantity { get; set; }

        [JsonProperty("weight")]
        public double intWeight { get; set; }

        public double TotalWeight { get; set; }

        [JsonProperty("pickUp")]
        public int intPU { get; set; }

        [JsonProperty("dropOff")]
        public int intDO { get; set; }

        [JsonProperty("overSize")]
        public double intOverSizeItems { get; set; }

        [JsonProperty("overWeight")]
        public int intOverWeightItems { get; set; }

        public int DGClass { get; set; }

    }
}

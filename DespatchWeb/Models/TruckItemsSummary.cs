using System.Text.Json.Serialization;


namespace DespatchWeb.Models
{
    public class TruckItemsSummary
    {
        [JsonPropertyName("quantity")]
        public int intQuantity { get; set; }

        [JsonPropertyName("weight")]
        public double intWeight { get; set; }

        public double TotalWeight { get; set; }

        [JsonPropertyName("pickUp")]
        public int intPU { get; set; }

        [JsonPropertyName("dropOff")]
        public int intDO { get; set; }

        [JsonPropertyName("overSize")]
        public double intOverSizeItems { get; set; }

        [JsonPropertyName("overWeight")]
        public int intOverWeightItems { get; set; }

        public int DGClass { get; set; }

    }
}

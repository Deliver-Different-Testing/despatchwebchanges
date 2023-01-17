using System.Text.Json.Serialization;

namespace DespatchWeb.Models
{
    public class UndeliverableLocation
    {
        [JsonPropertyName("id")] public int ID { get; set; }

        public string Text { get; set; }

        public int JobStatusId { get; set; }
    }
}

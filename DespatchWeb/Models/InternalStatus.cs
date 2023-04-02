using System.Text.Json.Serialization;

namespace DespatchWeb.Models
{
    public class InternalStatus
    {
        [JsonPropertyName("id")] public int ID { get; set; }

        public string Text { get; set; }

        public string DefaultSchedule { get; set; }

        public int? DefaultMins { get; set; }
    }
}

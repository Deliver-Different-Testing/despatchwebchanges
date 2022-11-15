using Newtonsoft.Json;

namespace DespatchWeb.Models
{
    public class UndeliverableLocation
    {
        [JsonProperty("id")] public int ID { get; set; }

        public string Text { get; set; }

        public int JobStatusId { get; set; }
    }
}

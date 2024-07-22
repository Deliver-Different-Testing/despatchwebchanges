using System.Text.Json.Serialization;

namespace DespatchWeb.Models
{
    public class ClientActiveViewModel
    {
        [JsonPropertyName("id")] public int ID { get; set; }

        [JsonPropertyName("text")] public string Text { get; set; }
    }
}

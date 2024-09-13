using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class ClientContactViewModel
{
    [JsonPropertyName("id")] public int ID { get; set; }

    [JsonPropertyName("label")] public string Text { get; set; }
}
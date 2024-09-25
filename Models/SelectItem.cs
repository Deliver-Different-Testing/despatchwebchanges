using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class SelectItem
{
    [JsonPropertyName("id")] public int Id { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }
}
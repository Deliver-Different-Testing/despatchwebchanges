using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class SuburbLookup
{
    [JsonPropertyName("id")] public int ID { get; set; }

    public string Text { get; set; }

    public string Alias { get; set; }
}
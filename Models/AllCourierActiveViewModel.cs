using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class AllCourierActiveViewModel
{
    [JsonPropertyName("id")] public int ID { get; set; }

    public string Text { get; set; }
}
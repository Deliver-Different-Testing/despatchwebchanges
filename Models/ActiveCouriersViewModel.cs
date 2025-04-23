using System;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class ActiveCouriersViewModel
{
    private string _label;
    private string _text;
    public int CourierId { get; set; }

    [JsonPropertyName("id")] public string Code { get; set; }

    public string Name { get; set; }

    public bool DangerousGoods { get; set; }

    public DateTime? DGLicenseExpiry { get; set; }

    public bool IsActive { get; set; }

    public string Label
    {
        get => $"{Code} {Name}";
        set => _label = value;
    }

    public string Text
    {
        get => $"{Code} {Name}";
        set => _text = value;
    }
}

#nullable enable
namespace DespatchWeb.Models.AutoMate;

public sealed class CspKnowledgeOptions
{
    public const string SectionName = "CspKnowledge";

    /// <summary>CSP's address. Empty derives it from the request host (despatch.X → dfrntcrm.X).</summary>
    public string? BaseUrl { get; set; }
}

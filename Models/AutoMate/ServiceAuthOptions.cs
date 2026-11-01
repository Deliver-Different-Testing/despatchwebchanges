#nullable enable
namespace DespatchWeb.Models.AutoMate;

public sealed class ServiceAuthOptions
{
    public const string SectionName = "ServiceAuth";

    public string ClientId { get; set; } = "despatchweb";
    public string AssertionPath { get; set; } = "/var/run/secrets/dfrnt/csp-token";

    /// <summary>Development only: stands in for the Kubernetes token when there is no cluster.</summary>
    public string? ClientSecret { get; set; }
}

#nullable enable
using System.Text.RegularExpressions;
using DespatchWeb.Models.AutoMate;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services.AutoMate;

/// <summary>
/// Where this tenant's CSP lives: the configured address, or else the sibling of the host the request
/// came in on (despatch.X → dfrntcrm.X), the same way Integration Manager's address is found.
/// </summary>
public sealed partial class CspBaseUrlResolver(
    IOptions<CspKnowledgeOptions> options,
    IHttpContextAccessor contextAccessor,
    IHostEnvironment environment)
{
    // The Host header is client-controlled and the service-account token is posted to the result, so only
    // our own tenant hostnames may be turned into a CSP address.
    [GeneratedRegex(@"^despatch(?<rest>\.[a-z0-9-]+(\.staging)?\.deliverdifferent\.com)$", RegexOptions.IgnoreCase)]
    private static partial Regex TenantHost();

    public string? Resolve()
    {
        if (!string.IsNullOrWhiteSpace(options.Value.BaseUrl))
        {
            return options.Value.BaseUrl.TrimEnd('/');
        }

        // Locally the host is despatch.local…, which has no CSP sibling: set CspKnowledge:BaseUrl instead.
        if (environment.IsDevelopment())
        {
            return null;
        }

        var host = contextAccessor.HttpContext?.Request.Host.Host;
        var match = host is null ? null : TenantHost().Match(host);
        return match is { Success: true } ? $"https://dfrntcrm{match.Groups["rest"].Value.ToLowerInvariant()}" : null;
    }
}

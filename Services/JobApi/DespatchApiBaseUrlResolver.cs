using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services.JobApi;

/// <summary>
/// Derives the api base URL from the inbound request host by replacing the leftmost
/// DNS label (<c>despatch</c>) with <c>api</c>. So
/// <c>despatch.otg.deliverdifferent.com</c> → <c>api.otg.deliverdifferent.com</c>.
/// Falls back to <c>JobApi:BaseUrl</c> config or the <c>WebAPIUrl</c> env var for
/// background workers and single-label hosts. Mirrors IM's DespatchApiBaseUrlResolver.
/// </summary>
public sealed class DespatchApiBaseUrlResolver(
    IHttpContextAccessor httpContextAccessor,
    IOptions<JobApiOptions> options) : IDespatchApiBaseUrlResolver
{
    public Uri Resolve()
    {
        var ctx = httpContextAccessor.HttpContext;
        if (ctx is not null)
        {
            var host = ctx.Request.Host.Host;
            if (!string.IsNullOrEmpty(host))
            {
                var firstDot = host.IndexOf('.');
                if (firstDot > 0)
                {
                    var apiHost = "api" + host[firstDot..];
                    return new Uri($"{ctx.Request.Scheme}://{apiHost}/");
                }
            }
        }

        var fallback = options.Value.BaseUrl;
        if (string.IsNullOrWhiteSpace(fallback))
        {
            fallback = Environment.GetEnvironmentVariable("WebAPIUrl");
        }

        if (!string.IsNullOrWhiteSpace(fallback))
        {
            return new Uri(fallback.TrimEnd('/') + "/");
        }

        throw new InvalidOperationException(
            "Cannot resolve Despatch API base URL: inbound request host has no parent domain "
            + "to derive 'api.{rest}' from, and neither JobApi:BaseUrl nor the WebAPIUrl env var is set.");
    }
}

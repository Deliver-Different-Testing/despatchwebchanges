using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Services;

/// <summary>
/// A synthetic IHttpContextAccessor that provides a manually-constructed HttpContext
/// with captured claims. Used in background DI scopes so that services like
/// TenantInfoService and DynamicDespatchDbContextFactory can read claims
/// without a real HTTP request in flight.
/// </summary>
public class BackgroundHttpContextAccessor(ClaimsPrincipal principal) : IHttpContextAccessor
{
    public HttpContext HttpContext { get; set; } = new DefaultHttpContext { User = principal };
}

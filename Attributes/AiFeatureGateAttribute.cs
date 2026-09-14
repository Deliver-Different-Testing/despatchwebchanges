using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Attributes;

/// <summary>
/// The deployment-wide kill switch for Auto-mate, set by <c>Anthropic:Enabled</c>.
///
/// Deployment-wide, not per-tenant: the tenant comes from a per-request JWT claim
/// (<c>CurrentTenantID</c>) while <see cref="AnthropicSettings"/> is bound once as a
/// singleton, so this one flag covers every tenant the process serves.
///
/// Applied at controller level so every action added later inherits it. This is an
/// operational brake, not authorisation — per-user and per-tenant spend is capped by
/// <see cref="Interfaces.IAiRateLimiter"/>. It is also the only server-side control:
/// the per-user Auto-mate toggles are preferences that shape the UI, and a client can
/// always choose to ignore its own preference.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AiFeatureGateAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var settings = context.HttpContext.RequestServices
            .GetRequiredService<IOptions<AnthropicSettings>>().Value;

        if (!settings.Enabled)
        {
            context.Result = new ObjectResult("Auto-mate is turned off for this tenant.")
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}

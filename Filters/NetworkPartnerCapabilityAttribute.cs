using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Serilog;

namespace DespatchWeb.Filters;

public enum NpCapability
{
    Dispatch,
    Restore,
    Void,
    SwapPod,
    EditPodDetails,
    QuickCreateJob,
    Split,
    SendToPartner,
    ChangePaidCourier,
    InterCourierCharge,
    Rerate
}

/// <summary>
/// Which dispatch functions a network partner may use at all, even on its own jobs (product decision
/// 2026-11-13). Staff are never restricted here; RequireScope separately stops anyone touching records
/// outside their scope.
/// </summary>
public static class NetworkPartnerCapabilities
{
    public static bool IsAllowed(NpCapability capability) => capability switch
    {
        NpCapability.Dispatch => true,
        NpCapability.Restore => true,
        NpCapability.Void => true,
        NpCapability.SwapPod => true,
        NpCapability.EditPodDetails => true,
        NpCapability.QuickCreateJob => true,
        NpCapability.Split => false,
        NpCapability.SendToPartner => false,
        NpCapability.ChangePaidCourier => false,
        NpCapability.InterCourierCharge => false,
        NpCapability.Rerate => false,
        _ => throw new ArgumentOutOfRangeException(nameof(capability))
    };
}

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class NetworkPartnerCapabilityAttribute(NpCapability capability) : Attribute, IAsyncActionFilter
{
    public NpCapability Capability { get; } = capability;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var scope = context.HttpContext.RequestServices.GetRequiredService<IScopeProvider>().Scope;
        if (scope?.IsNetworkPartner == true && !NetworkPartnerCapabilities.IsAllowed(Capability))
        {
            Log.Warning("NetworkPartnerCapability deny: {Capability} for {Method} {Path}",
                Capability, context.HttpContext.Request.Method, context.HttpContext.Request.Path);
            context.Result = new ObjectResult("Network partners can't use this action")
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        await next();
    }
}

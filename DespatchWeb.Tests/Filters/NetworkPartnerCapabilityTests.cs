using System.Reflection;
using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Filters;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace DespatchWeb.Tests.Filters;

/// <summary>
/// Which dispatch functions a network partner may use at all, even on its own jobs (product
/// decision 2026-11-13). Object scope is RequireScope's job; this is function-level.
/// </summary>
public class NetworkPartnerCapabilityTests
{
    [Theory]
    [InlineData(NpCapability.Dispatch, true)]
    [InlineData(NpCapability.Restore, true)]
    [InlineData(NpCapability.Void, true)]
    [InlineData(NpCapability.SwapPod, true)]
    [InlineData(NpCapability.EditPodDetails, true)]
    [InlineData(NpCapability.QuickCreateJob, true)]
    [InlineData(NpCapability.Split, false)]
    [InlineData(NpCapability.SendToPartner, false)]
    [InlineData(NpCapability.ChangePaidCourier, false)]
    [InlineData(NpCapability.InterCourierCharge, false)]
    [InlineData(NpCapability.Rerate, false)]
    public void Table_MatchesTheProductDecision(NpCapability capability, bool allowed)
    {
        Assert.Equal(allowed, NetworkPartnerCapabilities.IsAllowed(capability));
    }

    [Fact]
    public void Table_CoversEveryCapability()
    {
        foreach (var capability in Enum.GetValues<NpCapability>())
        {
            _ = NetworkPartnerCapabilities.IsAllowed(capability);
        }
    }

    public static TheoryData<string, NpCapability> Actions => new()
    {
        { nameof(JobController.Allocate), NpCapability.Dispatch },
        { nameof(JobController.ReAllocate), NpCapability.Dispatch },
        { nameof(JobController.ReSendSelected), NpCapability.Dispatch },
        { nameof(JobController.ReAssignSelected), NpCapability.Dispatch },
        { nameof(JobController.SetFirstJob), NpCapability.Dispatch },
        { nameof(JobController.ReSendAll), NpCapability.Dispatch },
        { nameof(JobController.RestoreJobs), NpCapability.Restore },
        { nameof(JobController.RestoreSplitJobs), NpCapability.Restore },
        { nameof(JobController.Void), NpCapability.Void },
        { nameof(JobController.VoidBulkJob), NpCapability.Void },
        { nameof(JobController.SwapPod), NpCapability.SwapPod },
        { nameof(JobController.UpdatePodDetails), NpCapability.EditPodDetails },
        { nameof(JobController.QuickCreateJob), NpCapability.QuickCreateJob },
        { nameof(JobController.SplitJob), NpCapability.Split },
        { nameof(JobController.UnSplitJob), NpCapability.Split },
        { nameof(JobController.SendToPartner), NpCapability.SendToPartner },
        { nameof(JobController.GetPartnerRateForJob), NpCapability.SendToPartner },
        { nameof(JobController.AcceptPartnerRate), NpCapability.SendToPartner },
        { nameof(JobController.RejectPartnerRate), NpCapability.SendToPartner },
        { nameof(JobController.ChangeArchivedJobCourier), NpCapability.ChangePaidCourier },
        { nameof(JobController.InterCourierCharge), NpCapability.InterCourierCharge },
        { nameof(JobController.RecalculateJobRate), NpCapability.Rerate },
        { nameof(JobController.RecalculateJobRates), NpCapability.Rerate },
        { nameof(JobController.ApplyRecalculatedJobRate), NpCapability.Rerate },
    };

    [Theory]
    [MemberData(nameof(Actions))]
    public void Action_DeclaresItsCapability(string action, NpCapability capability)
    {
        var attribute = typeof(JobController).GetMethod(action)!.GetCustomAttribute<NetworkPartnerCapabilityAttribute>();

        Assert.Equal(capability, attribute?.Capability);
    }

    private static async Task<ActionExecutingContext> RunAsync(ClientType clientType, NpCapability capability)
    {
        var scopeProvider = Substitute.For<IScopeProvider>();
        scopeProvider.Scope.Returns(new ScopeContext(ClientTypeId: (int)clientType, ClientId: null, NpAgentId: 77));
        var http = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection().AddSingleton(scopeProvider).BuildServiceProvider()
        };
        var actionContext = new ActionContext(http, new RouteData(), new ActionDescriptor());
        var context = new ActionExecutingContext(actionContext, [], new Dictionary<string, object>(), controller: null!);

        await new NetworkPartnerCapabilityAttribute(capability).OnActionExecutionAsync(context,
            () => Task.FromResult(new ActionExecutedContext(actionContext, [], controller: null!)));

        return context;
    }

    [Fact]
    public async Task Filter_RefusesADeniedCapabilityToANetworkPartner()
    {
        var context = await RunAsync(ClientType.NetworkPartner, NpCapability.Split);

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(context.Result).StatusCode);
    }

    [Fact]
    public async Task Filter_LetsANetworkPartnerUseAnAllowedCapability()
    {
        Assert.Null((await RunAsync(ClientType.NetworkPartner, NpCapability.Dispatch)).Result);
    }

    [Fact]
    public async Task Filter_NeverRefusesTenantStaff()
    {
        Assert.Null((await RunAsync(ClientType.Tenant, NpCapability.Split)).Result);
    }
}

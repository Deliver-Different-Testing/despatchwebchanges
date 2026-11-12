using DeliverDifferent.AgentAccess;
using DespatchWeb.Controllers;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace DespatchWeb.Tests.Security;

public class AgentEndpointWalkTests
{
    private static List<RouteEndpoint> Endpoints()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllersWithViews().AddApplicationPart(typeof(AgentExportController).Assembly);
        var app = builder.Build();
        app.UseRouting();
        app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
        app.MapControllers();
        return ((IEndpointRouteBuilder)app).DataSources.SelectMany(d => d.Endpoints).OfType<RouteEndpoint>().ToList();
    }

    [Fact]
    public void EveryAgentReachableEndpoint_IsGetOnly_AndNamesARealCapability() =>
        Assert.Empty(AgentEndpointAudit.Problems(Endpoints()));

    [Fact]
    public void TheAgentReachableRoutes_AreExactlyTheOnesWeOptedIn()
    {
        var reachable = Endpoints()
            .Where(e => AgentEndpointAudit.CapabilityOf(e) is not null)
            .Select(Route)
            .Distinct()
            .Order(StringComparer.Ordinal)
            .ToList();

        Assert.Equal(["/Agent/Export/{entity}", "/Agent/Read/dispatch-board", "/Agent/Read/driver-day", "/Agent/Read/job-evidence", "/Agent/Read/job-story", "/Agent/Read/jobs", "/Agent/Read/partner-inbox", "/Agent/Read/recurring-check", "/api/context"], reachable);
    }

    [Fact]
    public void TheExportRoute_NeedsTheExportCapability() =>
        Assert.Equal(AgentCapabilities.ExportJobs, CapabilityOf("/Agent/Export/{entity}"));

    [Fact]
    public void TheContextRoute_NeedsConnect() =>
        Assert.Equal(AgentCapabilities.Connect, CapabilityOf("/api/context"));

    [Fact]
    public void AUiRoute_IsNotAgentReachable() =>
        Assert.DoesNotContain(Endpoints(), e => AgentEndpointAudit.CapabilityOf(e) is not null
            && e.DisplayName!.Contains("JobController", StringComparison.Ordinal));

    private static string Route(RouteEndpoint e) => "/" + e.RoutePattern.RawText!.TrimStart('/');

    private static string? CapabilityOf(string pattern) =>
        Endpoints().Where(e => Route(e) == pattern).Select(AgentEndpointAudit.CapabilityOf).Distinct().Single();
}

using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services.AutoMate;
using DespatchWeb.Services.AutoMate.Tools;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate.Tools;

public class LookupToolsTests
{
    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly ICourierRepository _couriers = Substitute.For<ICourierRepository>();
    private readonly IClientRepository _clients = Substitute.For<IClientRepository>();

    private FindDriversTool Drivers(AutoMateAudience? audience = null) => new(_jobs, _couriers, audience ?? AutoMateTestEnv.Staff());

    private FindClientTool Clients(AutoMateAudience? audience = null) => new(_clients, audience ?? AutoMateTestEnv.Staff());

    private static JsonElement Input(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public void BothTools_AreStaffOnly()
    {
        Assert.True(Drivers().StaffOnly);
        Assert.True(Clients().StaffOnly);
    }

    [Fact]
    public async Task FindDrivers_NonStaff_IsRefused_WithoutLookingAnythingUp()
    {
        var result = await Drivers(AutoMateTestEnv.Customer()).ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Equal(ToolOutput.Error(ToolOutput.StaffOnlyMessage), result);
        await _couriers.DidNotReceive().GetPotentialCouriersAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task FindDrivers_RanksByRule_AndCapsAtFifteen()
    {
        _couriers.GetPotentialCouriersAsync(5).Returns(Enumerable.Range(1, 20)
            .Select(i => new PotentialCouriersViewModel { CourierId = i, Code = $"C{i}", FirstName = "Sam", RuleNumber = 21 - i, Reason = "nearby" })
            .ToList());

        var result = await Drivers().ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Contains("20 driver(s) qualify for job 5; showing the first 15.", result);
        Assert.Equal(15, result.Split('\n').Count(l => l.StartsWith("- driver id")));
        Assert.StartsWith("20 driver(s) qualify for job 5; showing the first 15.\n- driver id 20,", result);
    }

    [Fact]
    public async Task FindDrivers_NoCandidates_SaysSo()
    {
        _couriers.GetPotentialCouriersAsync(5).Returns(new List<PotentialCouriersViewModel>());

        var result = await Drivers().ExecuteAsync(Input("""{"job_id":5}"""), Ct);

        Assert.Equal("No drivers qualify for job 5 under the allocation rules.", result);
    }

    [Fact]
    public async Task FindDrivers_WithoutAReference_IsAnError()
    {
        var result = await Drivers().ExecuteAsync(Input("{}"), Ct);

        Assert.True(ToolOutput.IsError(result));
        await _couriers.DidNotReceive().GetPotentialCouriersAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task FindClient_NonStaff_IsRefused()
    {
        var result = await Clients(AutoMateTestEnv.Customer()).ExecuteAsync(Input("""{"name":"acme"}"""), Ct);

        Assert.Equal(ToolOutput.Error(ToolOutput.StaffOnlyMessage), result);
        await _clients.DidNotReceive().ActiveClientsAsync(Arg.Any<string>());
    }

    [Theory]
    [InlineData("""{"name":"a"}""")]
    [InlineData("""{"name":" a "}""")]
    [InlineData("""{"name":""}""")]
    [InlineData("{}")]
    [InlineData("""{"name":3}""")]
    public async Task FindClient_ShortOrMissingName_IsAnError_WithoutSearching(string json)
    {
        var result = await Clients().ExecuteAsync(Input(json), Ct);

        Assert.True(ToolOutput.IsError(result));
        await _clients.DidNotReceive().ActiveClientsAsync(Arg.Any<string>());
    }

    [Fact]
    public async Task FindClient_TwoCharacters_Searches_WithTheTrimmedName()
    {
        _clients.ActiveClientsAsync("ac").Returns(new List<Suggestion> { new() { Id = 7, Text = "ACME Ltd" } });

        var result = await Clients().ExecuteAsync(Input("""{"name":" ac "}"""), Ct);

        await _clients.Received(1).ActiveClientsAsync("ac");
        Assert.Equal("- client id 7: <user_text>ACME Ltd</user_text>\n", result);
    }

    [Fact]
    public async Task FindClient_NoMatch_SaysSo()
    {
        _clients.ActiveClientsAsync("zz").Returns(new List<Suggestion>());

        var result = await Clients().ExecuteAsync(Input("""{"name":"zz"}"""), Ct);

        Assert.Equal("No active client matches \"zz\".", result);
    }

    [Fact]
    public async Task FindClient_CapsAtTen_AndSaysHowManyMore()
    {
        _clients.ActiveClientsAsync("acme").Returns(Enumerable.Range(1, 13)
            .Select(i => new Suggestion { Id = i, Text = $"Acme {i}" }).ToList());

        var result = await Clients().ExecuteAsync(Input("""{"name":"acme"}"""), Ct);

        Assert.Equal(10, result.Split('\n').Count(l => l.StartsWith("- client id")));
        Assert.Contains("…and 3 more; narrow the search.", result);
    }

    [Fact]
    public async Task FindClient_FencesAndEscapesTheClientName()
    {
        _clients.ActiveClientsAsync("acme").Returns(new List<Suggestion> { new() { Id = 7, Text = "Acme <b>Ltd</b>" } });

        var result = await Clients().ExecuteAsync(Input("""{"name":"acme"}"""), Ct);

        Assert.Contains("<user_text>Acme &lt;b&gt;Ltd&lt;/b&gt;</user_text>", result);
        Assert.DoesNotContain("<b>", result);
    }
}

using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services.AgentRead;
using DespatchWeb.Tests.Helpers;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AgentRead;

public class AgentJobSearchScopeTests
{
    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly AgentJobSearchService _service;

    public AgentJobSearchScopeTests()
    {
        _jobs.PodSearchDownloadAsync(default!, default!, default!, default!, default, default, default!, default, default)
            .ReturnsForAnyArgs(Task.FromResult<IReadOnlyList<JobDownloadModel>>([]));
        _service = new AgentJobSearchService(_jobs, new FakeTenantClock(new DateTime(2026, 8, 27, 12, 0, 0)));
    }

    private (string Wild, string Job, DateTime From, DateTime To, JobWildcardColumns Columns) LastCall()
    {
        var args = _jobs.ReceivedCalls().Last().GetArguments();
        return ((string)args[2]!, (string)args[3]!, (DateTime)args[4]!, (DateTime)args[5]!, (JobWildcardColumns)args[8]!);
    }

    [Theory]
    [InlineData(JobWildcardColumns.None)]
    [InlineData(JobWildcardColumns.ContactDetails)]
    [InlineData(JobWildcardColumns.All)]
    public async Task TheCallersColumns_AreHandedToTheSearch(JobWildcardColumns columns)
    {
        await _service.SearchAsync(new JobSearchRequest(Query: "acme", Columns: columns));

        Assert.Equal(columns, LastCall().Columns);
    }

    [Fact]
    public void TheCapabilitiesHeld_DecideWhichClassesTheSearchMayLookInside()
    {
        Assert.Equal(JobWildcardColumns.None, AgentJobSearchService.ColumnsFor(new HashSet<string>()));
        Assert.Equal(JobWildcardColumns.None, AgentJobSearchService.ColumnsFor(new HashSet<string> { DeliverDifferent.AgentAccess.AgentCapabilities.SeeCosts }));
        Assert.Equal(JobWildcardColumns.ContactDetails | JobWildcardColumns.PodName, AgentJobSearchService.ColumnsFor(
            new HashSet<string> { DeliverDifferent.AgentAccess.AgentCapabilities.SeeContactDetails, DeliverDifferent.AgentAccess.AgentCapabilities.SeePod }));
        Assert.Equal(JobWildcardColumns.All, AgentJobSearchService.ColumnsFor(new HashSet<string>
        {
            DeliverDifferent.AgentAccess.AgentCapabilities.SeeContactDetails, DeliverDifferent.AgentAccess.AgentCapabilities.SeeNotes, DeliverDifferent.AgentAccess.AgentCapabilities.SeePod
        }));
    }

    [Fact]
    public async Task ByDefault_NoHiddenClassIsSearched()
    {
        await _service.SearchAsync(new JobSearchRequest(Query: "acme"));

        Assert.Equal(JobWildcardColumns.None, LastCall().Columns);
    }

    [Fact]
    public async Task LikeWildcardsInTheTerms_AreEscaped_SoPercentDoesNotMatchEverything()
    {
        await _service.SearchAsync(new JobSearchRequest(Query: "%", Job: "A_[1]"));
        var call = LastCall();
        Assert.Equal("[%]", call.Wild);
        Assert.Equal("A[_][[]1]", call.Job);

        await _service.SearchAsync(new JobSearchRequest(Reference: "#50%_off"));
        Assert.Equal("50[%][_]off", LastCall().Wild);
    }

    [Fact]
    public async Task OrderTerms_AreEscapedToo()
    {
        await _service.SearchAsync(new JobSearchRequest(OrderNumber: "10%2", OrderId: "9_9"));

        var wilds = _jobs.ReceivedCalls().Select(c => (string)c.GetArguments()[2]!).ToList();
        Assert.Contains("10[%]2", wilds);
        Assert.Contains("9[_]9", wilds);
    }

    [Fact]
    public async Task AnUnfilteredList_DefaultsTo31Days_AndCapsAt93()
    {
        await _service.SearchAsync(new JobSearchRequest());
        var call = LastCall();
        Assert.True((call.To - call.From).TotalDays <= 31);

        await _service.SearchAsync(new JobSearchRequest(From: new DateOnly(2026, 5, 27), To: new DateOnly(2026, 8, 28)));
        var ok = await Record.ExceptionAsync(() => _service.SearchAsync(new JobSearchRequest(From: new DateOnly(2026, 5, 26), To: new DateOnly(2026, 8, 28))));

        var e = Assert.IsType<AgentReadException>(ok);
        Assert.Contains("93", e.Message);
        Assert.Contains("q", e.Message);
    }

    [Theory]
    [InlineData("q")]
    [InlineData("job")]
    [InlineData("reference")]
    [InlineData("client_id")]
    [InlineData("courier_id")]
    public async Task AFilteredList_KeepsTheWideWindow(string filter)
    {
        var request = new JobSearchRequest(From: new DateOnly(2025, 8, 27), To: new DateOnly(2026, 8, 27),
            Query: filter == "q" ? "acme" : null, Job: filter == "job" ? "KT1" : null, Reference: filter == "reference" ? "R1" : null,
            ClientId: filter == "client_id" ? 5 : null, CourierId: filter == "courier_id" ? 6 : null);

        await _service.SearchAsync(request);

        Assert.Equal(new DateTime(2025, 8, 27), LastCall().From);
    }
}


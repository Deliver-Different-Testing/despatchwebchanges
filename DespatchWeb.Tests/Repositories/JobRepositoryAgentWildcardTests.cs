using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>The agent's free-text search only looks inside columns whose data class the caller holds.</summary>
public class JobRepositoryAgentWildcardTests : IAsyncDisposable
{
    private static readonly DateTime Day = new(2024, 1, 15);

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenant = Substitute.For<ITenantInfoService>();

    public JobRepositoryAgentWildcardTests()
    {
        _tenant.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenant.IsUsTenant().Returns(false);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private JobRepository Repository() => new(
        _db.CreateFactoryMock(), _tenant, new FakeTenantClock(TestDates.Now), Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(), Substitute.For<ICourierRepository>(), Substitute.For<ISuburbResolver>());

    private async Task Seed(params TucJob[] live)
    {
        await using var context = _db.CreateContext();
        context.TucJobs.AddRange(live);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucJob Job(int id, Action<TucJob> shape)
    {
        var job = new TucJob { UcjbId = id, UcjbNumber = $"JOB-{id:000}", UcjbDate = Day, UcjbTime = Day.AddHours(9), UcjbAmount = 1m };
        shape(job);
        return job;
    }

    private async Task<string[]> Search(string wild, JobWildcardColumns columns) =>
        [.. (await Repository().PodSearchDownloadAsync([], [], wild, string.Empty, new DateTime(2024, 1, 1), new DateTime(2024, 1, 31), [], null, columns))
            .Select(r => r.JobNumber)];

    [Theory]
    [InlineData("0215550142", JobWildcardColumns.ContactDetails)]
    [InlineData("hidden-note-text", JobWildcardColumns.Notes)]
    [InlineData("Pat Signer", JobWildcardColumns.PodName)]
    public async Task AColumnOfAClassTheCallerLacks_IsNotSearched_AndIsWithTheClass(string term, JobWildcardColumns needed)
    {
        await Seed(Job(1, j =>
        {
            j.UcjbContactPhone = "0215550142";
            j.ProofOfDeliveryEmail = "x@example.test";
            j.InternalNotes = "hidden-note-text";
            j.UcjbPodname = "Pat Signer";
        }));

        Assert.Empty(await Search(term, JobWildcardColumns.None));
        Assert.Empty(await Search(term, JobWildcardColumns.All & ~needed));
        Assert.Equal(["JOB-001"], await Search(term, needed));
        Assert.Equal(["JOB-001"], await Search(term, JobWildcardColumns.All));
    }

    [Fact]
    public async Task EmailAndNotesColumns_FollowTheirOwnClass()
    {
        await Seed(Job(1, j =>
        {
            j.ProofOfDeliveryEmail = "who@example.test";
            j.UcjbNotes = "left with neighbour";
            j.UcjbToSpecial = "ring twice";
        }));

        Assert.Empty(await Search("who@example", JobWildcardColumns.Notes | JobWildcardColumns.PodName));
        Assert.Equal(["JOB-001"], await Search("who@example", JobWildcardColumns.ContactDetails));
        Assert.Empty(await Search("neighbour", JobWildcardColumns.ContactDetails));
        Assert.Equal(["JOB-001"], await Search("neighbour", JobWildcardColumns.Notes));
        Assert.Empty(await Search("ring twice", JobWildcardColumns.None));
        Assert.Equal(["JOB-001"], await Search("ring twice", JobWildcardColumns.Notes));
    }

    [Fact]
    public async Task ReferencesNamesAddressesAndClientCode_AreAlwaysSearched()
    {
        await Seed(
            Job(1, j => j.UcjbOurRef = "ORDER-77123"),
            Job(2, j => j.UcjbContact = "Zelda Quimby"),
            Job(3, j => j.PickupAddressLine1 = "9 Quarry Road"),
            Job(4, j => j.UcjbClientCode = "ACMEZ"));

        Assert.Equal(["JOB-001"], await Search("77123", JobWildcardColumns.None));
        Assert.Equal(["JOB-002"], await Search("Quimby", JobWildcardColumns.None));
        Assert.Equal(["JOB-003"], await Search("Quarry", JobWildcardColumns.None));
        Assert.Equal(["JOB-004"], await Search("ACMEZ", JobWildcardColumns.None));
    }

    [Fact]
    public async Task ArchivedJobs_AreScopedTheSame()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 50, UcjbNumber = "ARC-050", UcjbDate = Day, UcjbTime = Day.AddHours(9), UcjbAmount = 1m,
                UcjbPodname = "Archived Signer", UcjbContactPhone = "0275550150", InternalNotes = "archived-secret"
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        foreach (var term in new[] { "Archived Signer", "0275550150", "archived-secret" })
        {
            Assert.Empty(await Search(term, JobWildcardColumns.None));
            Assert.Equal(["ARC-050"], await Search(term, JobWildcardColumns.All));
        }
    }
}

using System.Reflection;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Filters;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Write paths that go straight to unfiltered tables, procs or S3 by id: a network partner must not
/// be able to change another agent's records, and staff must be unaffected.
/// </summary>
public class NetworkPartnerWriteScopeTests : IAsyncDisposable
{
    private const int OwnAgentId = 77;
    private const int OtherAgentId = 88;
    private const int OwnJobId = 100;
    private const int OtherJobId = 200;

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _infoService = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public NetworkPartnerWriteScopeTests()
    {
        _infoService.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _infoService.GetStaffId().Returns(5);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private static ScopeContext NpScope() =>
        new(ClientTypeId: (int)ClientType.NetworkPartner, ClientId: null, NpAgentId: OwnAgentId);

    private static ScopeContext TenantScope() =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: null, NpAgentId: null);

    private DespatchContext CreateContext(ScopeContext scope)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope);
        return new DespatchContext(_db.Options, provider);
    }

    private IDbContextFactory<DespatchContext> ScopedFactory(ScopeContext scope)
    {
        var factory = Substitute.For<IDbContextFactory<DespatchContext>>();
        factory.CreateDbContext().Returns(_ => CreateContext(scope));
        factory.CreateDbContextAsync(Arg.Any<CancellationToken>()).Returns(_ => CreateContext(scope));
        return factory;
    }

    private async Task SeedJobsAsync()
    {
        await using var seed = _db.CreateContext();
        seed.TucJobs.AddRange(
            new TucJob { UcjbId = OwnJobId, UcjbNumber = "OWN", NpAgentId = OwnAgentId },
            new TucJob { UcjbId = OtherJobId, UcjbNumber = "OTHER", NpAgentId = OtherAgentId });
        seed.TblBulkJobs.AddRange(
            new TblBulkJob { BulkJobId = 1, JobNumber = "BULK-OWN", NpAgentId = OwnAgentId },
            new TblBulkJob { BulkJobId = 2, JobNumber = "BULK-OTHER", NpAgentId = OtherAgentId });
        seed.TucCouriers.AddRange(Courier(1, OwnAgentId), Courier(2, OtherAgentId));
        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucCourier Courier(int id, int agentId) => new()
    {
        UccrId = id, Code = $"C{id}", UccrName = $"N{id}", UccrSurname = "S", UccrEmail = "c@t.com", UccrMobile = "1",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
        NpAgentId = agentId
    };

    // ---- RequireScope filter ------------------------------------------------------

    private async Task<(ActionExecutingContext Context, bool NextCalled)> RunFilterAsync(
        ScopeContext scope, RequireScopeAttribute filter, Dictionary<string, object> arguments)
    {
        var services = new ServiceCollection().AddSingleton(ScopedFactory(scope)).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        var actionContext = new ActionContext(http, new RouteData(), new ActionDescriptor());
        var context = new ActionExecutingContext(actionContext, [], arguments, controller: null!);
        var nextCalled = false;

        await filter.OnActionExecutionAsync(context, () =>
        {
            nextCalled = true;
            return Task.FromResult(new ActionExecutedContext(actionContext, [], controller: null!));
        });

        return (context, nextCalled);
    }

    [Fact]
    public async Task RequireScope_Np_RefusesAnotherAgentsJobInAnIdList()
    {
        await SeedJobsAsync();
        var filter = new RequireScopeAttribute(ScopedRecord.Job, "data.JobIds");
        var request = new RestoreJobsRequest { JobIds = [OwnJobId, OtherJobId] };

        var (context, nextCalled) = await RunFilterAsync(NpScope(), filter, new() { ["data"] = request });

        Assert.Equal("Job not found. Refresh the list and try again.",
            Assert.IsType<NotFoundObjectResult>(context.Result).Value);
        Assert.False(nextCalled);
    }

    [Fact]
    public async Task RequireScope_Np_AllowsItsOwnRecords()
    {
        await SeedJobsAsync();

        var (jobs, jobsNext) = await RunFilterAsync(NpScope(),
            new RequireScopeAttribute(ScopedRecord.Job, "jobIds"), new() { ["jobIds"] = $"{OwnJobId}" });
        var (couriers, couriersNext) = await RunFilterAsync(NpScope(),
            new RequireScopeAttribute(ScopedRecord.Courier, "courierId"), new() { ["courierId"] = 1 });
        var (bulk, bulkNext) = await RunFilterAsync(NpScope(),
            new RequireScopeAttribute(ScopedRecord.BulkJob, "bulkJobId"), new() { ["bulkJobId"] = 1 });

        Assert.Null(jobs.Result);
        Assert.Null(couriers.Result);
        Assert.Null(bulk.Result);
        Assert.True(jobsNext && couriersNext && bulkNext);
    }

    [Theory]
    [InlineData(ScopedRecord.Job, "100,200")]
    [InlineData(ScopedRecord.Courier, 2)]
    [InlineData(ScopedRecord.BulkJob, 2)]
    public async Task RequireScope_Np_RefusesAnotherAgentsRecord(ScopedRecord record, object id)
    {
        await SeedJobsAsync();

        var (context, nextCalled) = await RunFilterAsync(NpScope(),
            new RequireScopeAttribute(record, "id"), new() { ["id"] = id });

        Assert.IsType<NotFoundObjectResult>(context.Result);
        Assert.False(nextCalled);
    }

    [Fact]
    public async Task RequireScope_Tenant_IsNeverRefused()
    {
        var (context, nextCalled) = await RunFilterAsync(TenantScope(),
            new RequireScopeAttribute(ScopedRecord.Job, "jobId"), new() { ["jobId"] = 999 });

        Assert.Null(context.Result);
        Assert.True(nextCalled);
    }

    [Fact]
    public void RequireScope_EveryPathNamesARealArgumentAndProperty()
    {
        // A misspelt path reads no ids and so silently checks nothing.
        var actions = typeof(JobController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) || typeof(Controller).IsAssignableFrom(t))
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            .SelectMany(m => m.GetCustomAttributes<RequireScopeAttribute>().SelectMany(a => a.IdPaths)
                .Select(p => (Method: m, Path: p)))
            .ToList();

        Assert.NotEmpty(actions);
        foreach (var (method, path) in actions)
        {
            var parts = path.Split('.');
            var type = method.GetParameters().SingleOrDefault(p => p.Name == parts[0])?.ParameterType;
            foreach (var property in parts.Skip(1))
            {
                type = type?.GetProperty(property)?.PropertyType;
            }

            Assert.True(type != null, $"{method.DeclaringType!.Name}.{method.Name}: '{path}' does not resolve");
        }
    }

    public static TheoryData<Type, string, ScopedRecord, string> ScopedEndpoints => new()
    {
        { typeof(JobController), nameof(JobController.UploadJobDeliveryPhotoOrSignature), ScopedRecord.Job, "jobId" },
        { typeof(JobController), nameof(JobController.DeleteJobDeliveryPhotoOrSignature), ScopedRecord.Job, "jobId" },
        { typeof(JobController), nameof(JobController.UploadFile), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.SendPodReport), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.Allocate), ScopedRecord.Job, "data.JobIds" },
        { typeof(JobController), nameof(JobController.Allocate), ScopedRecord.Courier, "data.CourierId" },
        { typeof(JobController), nameof(JobController.ReAllocate), ScopedRecord.Job, "data.JobIds" },
        { typeof(JobController), nameof(JobController.ReAllocate), ScopedRecord.Courier, "data.CourierId" },
        { typeof(JobController), nameof(JobController.ReSendSelected), ScopedRecord.Job, "jobIds" },
        { typeof(JobController), nameof(JobController.ReAssignSelected), ScopedRecord.Job, "jobIds" },
        { typeof(JobController), nameof(JobController.SetFirstJob), ScopedRecord.Job, "jobId" },
        { typeof(JobController), nameof(JobController.SetFirstJob), ScopedRecord.Courier, "courierId" },
        { typeof(JobController), nameof(JobController.ReSendAll), ScopedRecord.Courier, "courierId" },
        { typeof(JobController), nameof(JobController.Void), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.Void), ScopedRecord.JobOrBulkJob, "request.SelectedJobIds" },
        { typeof(JobController), nameof(JobController.RestoreSplitJobs), ScopedRecord.Job, "jobIds" },
        { typeof(JobController), nameof(JobController.VoidBulkJob), ScopedRecord.BulkJob, "request.BulkJobId" },
        { typeof(JobController), nameof(JobController.RecalculateJobRates), ScopedRecord.Job, "jobIds" },
        { typeof(JobController), nameof(JobController.VoidBulkJob), ScopedRecord.BulkJob, "request.SelectedJobIds" },
        { typeof(JobController), nameof(JobController.RestoreJobs), ScopedRecord.Job, "data.JobIds" },
        { typeof(JobController), nameof(JobController.GetRestorePodImpact), ScopedRecord.Job, "data.JobIds" },
        { typeof(JobController), nameof(JobController.SplitJob), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.UnSplitJob), ScopedRecord.Job, "jobId" },
        { typeof(JobController), nameof(JobController.QuickCreateJob), ScopedRecord.BookableClient, "request.ClientId" },
        { typeof(JobController), nameof(JobController.InterCourierCharge), ScopedRecord.Courier, "viewModel.FromCourierId" },
        { typeof(JobController), nameof(JobController.InterCourierCharge), ScopedRecord.Client, "viewModel.ClientId" },
        { typeof(JobController), nameof(JobController.UpdateBulkJobPackages), ScopedRecord.BulkJob, "request.BulkJobId" },
        { typeof(JobController), nameof(JobController.UpdateDeliveryAddress), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.UpdatePickupAddress), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.AddStopToJob), ScopedRecord.Job, "data.JobId" },
        { typeof(JobController), nameof(JobController.ApplyWebQtyUpdate), ScopedRecord.Job, "jobId" },
        { typeof(JobController), nameof(JobController.BulkUpdateReadStatus), ScopedRecord.Job, "data.JobIds" },
        { typeof(JobController), nameof(JobController.RepriceJobWithBaseAmount), ScopedRecord.Job, "data.JobId" },
        { typeof(JobController), nameof(JobController.SendToPartner), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.GetPartnerRateForJob), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.AcceptPartnerRate), ScopedRecord.Job, "request.JobId" },
        { typeof(JobController), nameof(JobController.RejectPartnerRate), ScopedRecord.Job, "request.JobId" },
        { typeof(AccessorialChargeController), nameof(AccessorialChargeController.Add), ScopedRecord.Job, "jobId" },
        { typeof(NationwideJobController), nameof(NationwideJobController.RestoreJob), ScopedRecord.Job, "request.JobId" },
        { typeof(NationwideJobController), nameof(NationwideJobController.AssignFlightToJob), ScopedRecord.Job, "request.JobId" },
        { typeof(CourierController), nameof(CourierController.UpdateAfterHoursCourierSchedule), ScopedRecord.Courier, "request.CourierId" },
        { typeof(CourierController), nameof(CourierController.CreateAfterHoursCourierSchedule), ScopedRecord.Courier, "request.CourierId" },
        { typeof(AiController), nameof(AiController.SummarizeJobNotes), ScopedRecord.Job, "jobId" },
        { typeof(AiController), nameof(AiController.SummarizeJobEvents), ScopedRecord.Job, "jobId" },
        { typeof(AiController), nameof(AiController.SummarizeJob), ScopedRecord.Job, "jobId" },
        { typeof(AiController), nameof(AiController.DraftPodEmail), ScopedRecord.Job, "jobId" },
        { typeof(AiController), nameof(AiController.DraftNote), ScopedRecord.Job, "request.JobId" },
        { typeof(AiController), nameof(AiController.ExtractBlockers), ScopedRecord.Job, "jobId" },
        { typeof(AiController), nameof(AiController.AnalyzePricing), ScopedRecord.Job, "jobId" },
    };

    [Theory]
    [MemberData(nameof(ScopedEndpoints))]
    public void Endpoint_ChecksTheIdsItActsOn(Type controller, string action, ScopedRecord record, string path)
    {
        var attributes = controller.GetMethods().Where(m => m.Name == action)
            .SelectMany(m => m.GetCustomAttributes<RequireScopeAttribute>());

        Assert.Contains(attributes, a => a.Record == record && a.IdPaths.Contains(path));
    }

    // ---- Repository write paths keyed by a child id -------------------------------

    [Fact]
    public async Task AccessorialCharges_Np_CannotUpdateOrDeleteAnotherAgentsCharge()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.AccessorialCharges.Add(new AccessorialCharge
            {
                AccessorialChargeId = 1, Name = "Tail lift", ChargeType = "Flat", Active = true
            });
            seed.JobAccessorialCharges.AddRange(
                new JobAccessorialCharge
                {
                    JobAccessorialChargeId = 1, JobId = OwnJobId, AccessorialChargeId = 1, AddedAtStage = "Booking"
                },
                new JobAccessorialCharge
                {
                    JobAccessorialChargeId = 2, JobId = OtherJobId, AccessorialChargeId = 1, AddedAtStage = "Booking"
                });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new AccessorialChargeRepository(SqliteTestDatabase.CreateFactoryMock(context));

        Assert.Null(await repository.GetAppliedChargeWithDetailsAsync(2));
        await repository.UpdateChargeAsync(2, 99m, null, null, null, null, 1, "changed", "np");
        await repository.DeleteChargeAsync(2);
        await repository.DeleteChargeAsync(1);

        await using var check = _db.CreateContext();
        var remaining = await check.JobAccessorialCharges.ToListAsync(TestContext.Current.CancellationToken);
        var other = Assert.Single(remaining);
        Assert.Equal(2, other.JobAccessorialChargeId);
        Assert.Null(other.Notes);
    }

    [Fact]
    public async Task Tasks_Np_CannotChangeATaskOnAnotherAgentsJob()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TucEvents.Add(new TucEvent { UcevId = 1, UcevJobId = OtherJobId });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new TaskRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService, _clock);

        await Assert.ThrowsAsync<ArgumentException>(() => repository.SetEventAsClosedAsync(1, true));
        await Assert.ThrowsAsync<ArgumentException>(() => repository.UnassignEventAsync(1));
    }

    [Fact]
    public async Task BulkNotes_Np_CannotWriteOrDeleteAnotherAgentsBulkNotes()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TblBulkJobNotes.Add(new TblBulkJobNote
            {
                NoteId = 1, BulkJobId = 2, NoteTypeId = 1, NoteText = "other", CreatedDate = TestDates.Now
            });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new NoteRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService, _clock);

        Assert.Null(await repository.GetBulkNoteByIdAsync(1));
        await Assert.ThrowsAsync<JobNotFoundException>(() =>
            repository.SaveBulkNoteAsync(new TucNoteViewModel { BulkJobId = 2, NoteText = "new", NoteTypeId = 1 },
                TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<JobNotFoundException>(() =>
            repository.SaveBulkNoteAsync(
                new TucNoteViewModel { NoteId = 1, BulkJobId = 1, NoteText = "hijack", NoteTypeId = 1 },
                TestContext.Current.CancellationToken));
        await repository.DeleteBulkNoteAsync(1, TestContext.Current.CancellationToken);

        await using var check = _db.CreateContext();
        var note = await check.TblBulkJobNotes.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("other", note.NoteText);
    }

    [Fact]
    public async Task AfterHoursSchedule_Np_CannotDeleteAnotherAgentsCourierSchedule()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TblAfterhoursCouriers.Add(new TblAfterhoursCourier
            {
                Id = 1, CourierId = 2, WeekDay = 1, StartTime = TestDates.Now, EndTime = TestDates.Now.AddHours(1)
            });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new CourierRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService, _clock,
            Substitute.For<IClearListEnvelopeService>(), new MemoryCache(new MemoryCacheOptions()));

        await repository.DeleteAfterHoursCourierScheduleAsync(1);

        await using var check = _db.CreateContext();
        Assert.Single(await check.TblAfterhoursCouriers.ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task RecoveryAgent_Np_CannotUpdateARecoveryOnAnotherAgentsJob()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.JobRecoveryAgents.Add(new JobRecoveryAgent { RecoveryId = 1, JobId = OtherJobId, AgentId = 1 });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new NationwideJobRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService,
            _clock, Substitute.For<IClearListEnvelopeService>(), Substitute.For<IInboundAgentLinkService>());

        await Assert.ThrowsAsync<JobNotFoundException>(() =>
            repository.UpdateRecoveryAgentAsync(new UpdateAgentRecoveryRequest
            {
                RecoveryId = 1, IsPrimaryRecoveryAgent = true
            }));
    }
}

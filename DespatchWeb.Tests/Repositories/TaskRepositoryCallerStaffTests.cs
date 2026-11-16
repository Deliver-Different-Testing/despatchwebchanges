using DespatchWeb.EntityClasses;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Closing a task and moving its due time write a tucEventAudit row keyed on the signed-in user's StaffID,
/// a foreign key to tucStaff. A login with no staff row gets a clear error instead of an FK 500.
/// </summary>
public class TaskRepositoryCallerStaffTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public TaskRepositoryCallerStaffTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
        _infoServiceMock.GetStaffId().Returns(99);
        _infoServiceMock.GetStaffIdOrNull().Returns(99);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private TaskRepository CreateRepository() => new(_contextFactoryMock, _infoServiceMock, _clock);

    private async Task SeedAsync(bool callerIsStaff)
    {
        await using var context = _db.CreateContext();
        if (callerIsStaff)
        {
            context.TucStaffs.Add(new TucStaff
            {
                UcstId = 99, UcstFirstName = "Signed", UcstLastName = "In", CreatedBy = "test", LastModifiedBy = "test"
            });
        }

        context.TucEvents.Add(new TucEvent
        {
            UcevId = 1, UcevJobId = 555, UcevDueTime = TestDates.Now, UcevClosed = false
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SetEventAsClosedAsync_CallerHasNoStaffRow_ThrowsClearError_AndChangesNothing()
    {
        await SeedAsync(callerIsStaff: false);

        var ex = await Assert.ThrowsAsync<TaskAssignmentException>(() => CreateRepository().SetEventAsClosedAsync(1, true));

        Assert.Equal(TaskAssignmentException.CallerNotStaff, ex.Message);
        await using var assertContext = _db.CreateContext();
        Assert.False((await assertContext.TucEvents.SingleAsync(TestContext.Current.CancellationToken)).UcevClosed);
        Assert.Empty(assertContext.TucEventAudits);
    }

    [Fact]
    public async Task UpdateEventDueTimeAsync_CallerHasNoStaffRow_ThrowsClearError_AndChangesNothing()
    {
        await SeedAsync(callerIsStaff: false);

        var ex = await Assert.ThrowsAsync<TaskAssignmentException>(
            () => CreateRepository().UpdateEventDueTimeAsync(1, new DateTimeOffset(TestDates.Now.AddHours(2))));

        Assert.Equal(TaskAssignmentException.CallerNotStaff, ex.Message);
        await using var assertContext = _db.CreateContext();
        Assert.Equal(TestDates.Now, (await assertContext.TucEvents.SingleAsync(TestContext.Current.CancellationToken)).UcevDueTime);
        Assert.Empty(assertContext.TucEventAudits);
    }

    [Fact]
    public async Task SetEventAsClosedAsync_CallerIsStaff_ClosesAndAudits()
    {
        await SeedAsync(callerIsStaff: true);

        await CreateRepository().SetEventAsClosedAsync(1, true);

        await using var assertContext = _db.CreateContext();
        Assert.True((await assertContext.TucEvents.SingleAsync(TestContext.Current.CancellationToken)).UcevClosed);
        Assert.Single(assertContext.TucEventAudits);
    }
}

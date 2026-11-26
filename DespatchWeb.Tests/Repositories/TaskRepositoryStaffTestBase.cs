using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public abstract class TaskRepositoryStaffTestBase : IAsyncDisposable
{
    protected readonly SqliteTestDatabase _db = new();
    protected readonly DespatchContext _context;
    protected readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    protected readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();
    protected readonly FakeTenantClock _clock = new(TestDates.Now);

    protected TaskRepositoryStaffTestBase()
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

    protected TaskRepository CreateRepository() => new(_contextFactoryMock, _infoServiceMock, _clock);
}

using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public abstract class JobRepositoryTestBase : IAsyncDisposable
{
    protected readonly SqliteTestDatabase _db = new();
    protected readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    protected readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    protected readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    protected readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    protected readonly FakeTenantClock _clock = new(TestDates.Now);

    protected JobRepositoryTestBase(int? staffId = null)
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        if (staffId is { } id)
        {
            _tenantInfoServiceMock.GetStaffId().Returns(id);
        }
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    protected DespatchContext CreateContext() => _db.CreateContext();

    protected JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );
}

using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for ClearListEnvelopeService - tests validation and basic behavior.
/// Note: Full integration tests with database would be needed to test the complex LINQ queries.
/// </summary>
public class ClearListEnvelopeServiceTests
{
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private ClearListEnvelopeService CreateService() => new(
        _contextFactoryMock.Object,
        _clock
    );

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public async Task GetClearListAreaEnvelopeAsync_InvalidClearListAreaId_ThrowsArgumentException(int invalidId)
    {
        // Arrange
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<ClearListEnvelopeViewModel>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Invalid clearListAreaId", ex.Message);
        return;

        // Act
        async Task<ClearListEnvelopeViewModel> Act() => await service.GetClearListAreaEnvelopeAsync(invalidId, Country.Nz);
    }

    [Fact]
    public async Task GetClearListAreaEnvelopeAsync_InvalidCountry_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();
        const Country invalidCountry = (Country)999;

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<ClearListEnvelopeViewModel>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Invalid country", ex.Message);
        return;

        // Act
        async Task<ClearListEnvelopeViewModel> Act() => await service.GetClearListAreaEnvelopeAsync(1, invalidCountry);
    }

    [Fact]
    public void Dispose_WhenCalled_DoesNotThrow()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        var exception = Record.Exception(() => service.Dispose());
        Assert.Null(exception);
    }

    [Fact]
    public void Dispose_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        var exception = Record.Exception(() =>
        {
            service.Dispose();
            service.Dispose();
        });
        Assert.Null(exception);
    }

}

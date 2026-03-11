using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Services;
using FluentAssertions;
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

    #region GetClearListAreaEnvelopeAsync Validation Tests

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public async Task GetClearListAreaEnvelopeAsync_InvalidClearListAreaId_ThrowsArgumentException(int invalidId)
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = async () => await service.GetClearListAreaEnvelopeAsync(invalidId, Country.Nz);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Invalid clearListAreaId*");
    }

    [Fact]
    public async Task GetClearListAreaEnvelopeAsync_InvalidCountry_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();
        var invalidCountry = (Country)999;

        // Act
        var act = async () => await service.GetClearListAreaEnvelopeAsync(1, invalidCountry);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Invalid country*");
    }

    #endregion

    #region Dispose Tests

    [Fact]
    public void Dispose_WhenCalled_DoesNotThrow()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = () => service.Dispose();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Dispose_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = () =>
        {
            service.Dispose();
            service.Dispose();
        };

        // Assert
        act.Should().NotThrow();
    }

    #endregion
}

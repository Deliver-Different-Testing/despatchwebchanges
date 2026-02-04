using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// Unit tests for CourierController - tests courier-related endpoints.
/// </summary>
public class CourierControllerTests
{
    #region Setup

    private readonly Mock<ICourierRepository> _courierRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<ITaskRepository> _taskRepositoryMock = new();

    private CourierController CreateController()
    {
        return new CourierController(
            _courierRepositoryMock.Object,
            _tenantInfoServiceMock.Object,
            _taskRepositoryMock.Object);
    }

    #endregion

    #region AllActiveSearch Tests

    [Fact]
    public async Task AllActiveSearch_ValidSearchTerm_ReturnsCouriers()
    {
        // Arrange
        const string searchTerm = "john";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (John Doe)" },
            new() { Id = 2, Text = "002 (Johnny Smith)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var couriers = jsonResult.Value as List<Suggestion>;
        couriers.Should().NotBeNull();
        couriers.Should().HaveCount(2);
    }

    [Fact]
    public async Task AllActiveSearch_DgOnlyTrue_PassesDgOnlyToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (DG Courier)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, true, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: true);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, true, false), Times.Once);
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task AllActiveSearch_LoggedInOnlyTrue_PassesLoggedInOnlyToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (Logged In Courier)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, false, true), Times.Once);
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task AllActiveSearch_BothDgOnlyAndLoggedInOnlyTrue_PassesBothToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (DG Logged In Courier)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, true, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: true, loggedInOnly: true);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, true, true), Times.Once);
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task AllActiveSearch_DefaultParameters_BothFlagsAreFalse()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>();

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm);

        // Assert - Verify default values are false
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, false, false), Times.Once);
    }

    [Fact]
    public async Task AllActiveSearch_LoggedInOnlyReturnsEmpty_ReturnsEmptyList()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>(); // Empty - no logged in couriers

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var couriers = jsonResult.Value as List<Suggestion>;
        couriers.Should().NotBeNull();
        couriers.Should().BeEmpty();
    }

    [Fact]
    public async Task AllActiveSearch_RepositoryThrowsException_Returns500()
    {
        // Arrange
        const string searchTerm = "test";

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AllActiveSearch_EmptySearchTerm_StillCallsRepository()
    {
        // Arrange
        const string searchTerm = "";
        var expectedCouriers = new List<Suggestion>();

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, false, false), Times.Once);
    }

    [Fact]
    public async Task AllActiveSearch_NullSearchTerm_StillCallsRepository()
    {
        // Arrange
        string? searchTerm = null;
        var expectedCouriers = new List<Suggestion>();

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm!, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm!);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm!, false, false), Times.Once);
    }

    #endregion

    #region Integration-like Tests

    [Fact]
    public async Task AllActiveSearch_MultipleCouriersReturned_ReturnsAllInCorrectOrder()
    {
        // Arrange
        const string searchTerm = "courier";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (Courier Alpha)" },
            new() { Id = 2, Text = "002 (Courier Beta)" },
            new() { Id = 3, Text = "003 (Courier Charlie)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var couriers = jsonResult.Value as List<Suggestion>;
        couriers.Should().HaveCount(3);
        couriers[0].Text.Should().Contain("Alpha");
        couriers[1].Text.Should().Contain("Beta");
        couriers[2].Text.Should().Contain("Charlie");
    }

    #endregion
}

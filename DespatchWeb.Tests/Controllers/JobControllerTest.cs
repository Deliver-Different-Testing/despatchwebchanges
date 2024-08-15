using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using NUnit.Framework;

namespace DespatchWeb.Tests.Controllers;

[TestFixture]
[TestOf(typeof(JobController))]
public class JobControllerTest
{
    [SetUp]
    public void SetUp()
    {
        _mockJobRepo = new Mock<IJobRepository>();
        _mockCourierRepo = new Mock<ICourierRepository>();
        _mockClientRepo = new Mock<IClientRepository>();
        _mockConfig = new Mock<IConfiguration>();

        _controller = new JobController(_mockJobRepo.Object, _mockCourierRepo.Object, _mockClientRepo.Object,
            _mockConfig.Object);
    }

    private Mock<IJobRepository> _mockJobRepo;
    private Mock<ICourierRepository> _mockCourierRepo;
    private Mock<IClientRepository> _mockClientRepo;
    private Mock<IConfiguration> _mockConfig;
    private JobController _controller;

    [Test]
    public async Task HasClientItemsAvailable_WhenCalled_ReturnsExpectedResult()
    {
        // Arrange
        const int clientId = 1;
        const int speedId = 1;
        const bool hasItems = true;

        _mockJobRepo.Setup(x => x.HasClientItemsAvailable(clientId, speedId)).Returns(Task.FromResult(hasItems));

        // Act
        var result = await _controller.HasClientItemsAvailable(clientId, speedId) as JsonResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(hasItems, Is.EqualTo(result.Value));
    }

    [Test]
    public async Task GetAllClientItems_WhenCalled_ReturnsExpectedResult()
    {
        // Arrange
        const int clientId = 1;
        const int speedId = 2;
        const int jobId = 3;

        var expectedClientItems = new List<ClientItemsViewModel>
        {
            new()
            {
                ItemId = 1, ClientId = clientId, Name = "Item 1", Description = "Description 1", PerItem = true,
                Rate = 1.23M, OnlyVan = false, Selected = false
            },
            new()
            {
                ItemId = 2, ClientId = clientId, Name = "Item 2", Description = "Description 2", PerItem = false,
                Rate = 2.34M, OnlyVan = true, Selected = true
            }
        };

        var pagedExpectedClientItems = new PagedList<ClientItemsViewModel>
        {
            Items = expectedClientItems,
            TotalCount = expectedClientItems.Count
        };

        _mockJobRepo
            .Setup(x => x.GetAllClientItemsBySpeed(clientId, speedId, jobId))
            .Returns(Task.FromResult(pagedExpectedClientItems));

        // Act
        var actionResult = await _controller.GetAllClientItems(clientId, speedId, jobId);
        var result = actionResult as JsonResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        var clientItems = result.Value as PagedList<ClientItemsViewModel>;
        Assert.That(pagedExpectedClientItems.TotalCount, Is.EqualTo(clientItems.TotalCount));
    }
}
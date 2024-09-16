using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Http;
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
    public async Task QuickCreateJob_WithInvalidRequest_ReturnsInternalServerError()
    {
        var request = new CreateJobRequest
        {
            /* Invalid request data */
        };

        var result = await _controller.QuickCreateJob(request) as ObjectResult;

        Assert.That(result, Is.Not.Null);
        Assert.That(result.StatusCode, Is.EqualTo(StatusCodes.Status500InternalServerError));
    }

    [Test]
    public async Task QuickCreateJob_WhenJobIdIsValid_ReturnsJsonResultWithJobId()
    {
        var validRequest = new CreateJobRequest
        {
            Job = new JobCreateViewModel
            {
                ClientId = 1,
                DeliverToContact = "John Doe",
                PodName = "PodName1",
                FromAddress = "123 Test Street",
                ToAddress = "456 Test Avenue",
                Date = DateTime.Now,
                FromContactName = "Jane Doe",
                RefA = "RefA1",
                RefB = "RefB1",
                DeliveryNotes = "Leave at front door",
                PickupNotes = "Pickup at back door",
                JobNotes = "This is a test job",
                Van = true,
                Truck = false,
                Pedal = false,
                Attention = false,
                VanOk = false,
                Reprice = false,
                Void = false,
                Done = false,
                Charge = 25.00m,
                FromSuburb = 10,
                FromLat = 35.6895m,
                FromLong = 139.6917m,
                ToSuburb = 20,
                ToLat = 34.0522m,
                ToLong = 118.2437m,
                SpeedId = 5
            },
            StaffId = 2,
            DespatcherName = "Despatcher1"
        };

        const int expectedJobId = 1;
        _mockJobRepo.Setup(jr => jr.QuickAddJobAsync(validRequest.Job, validRequest.StaffId.Value))
            .ReturnsAsync(expectedJobId);

        var result = await _controller.QuickCreateJob(validRequest) as JsonResult;

        Assert.That(result, Is.Not.Null);
        Assert.That(expectedJobId, Is.EqualTo(result.Value));
    }


    [Test]
    public async Task InterCourierCharge_WithNullViewModel_ReturnsInternalServerError()
    {
        InterCourierChargeViewModel viewModel = null;

        var result = await _controller.InterCourierCharge(viewModel) as ObjectResult;

        Assert.That(result, Is.Not.Null);
        Assert.That(result.StatusCode, Is.EqualTo(StatusCodes.Status500InternalServerError));
    }

    [Test]
    public async Task InterCourierCharge_WithValidViewModel_ReturnsOkResult()
    {
        var viewModel = new InterCourierChargeViewModel
        {
            FromCourierId = 1,
            ToCourierId = 2,
            Reference = "REF123",
            Zones = 3,
            Amount = 50.00m,
            StaffId = 4
        };
        var result = await _controller.InterCourierCharge(viewModel) as JsonResult;

        Assert.That(result, Is.Not.Null);
        Assert.That(result.Value, Is.EqualTo("OK"));
    }

    [Test]
    public async Task HasClientItemsAvailable_WhenCalled_ReturnsExpectedResult()
    {
        // Arrange
        const int clientId = 1;
        const int speedId = 1;
        const bool hasItems = true;

        _mockJobRepo.Setup(x => x.HasClientItemsAvailableAsync(clientId, speedId)).ReturnsAsync(hasItems);

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
            .Setup(x => x.GetAllClientItemsBySpeedAsync(clientId, speedId, jobId))
            .ReturnsAsync(pagedExpectedClientItems);

        // Act
        var actionResult = await _controller.GetAllClientItems(clientId, speedId, jobId);
        var result = actionResult as JsonResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        var clientItems = result.Value as PagedList<ClientItemsViewModel>;
        Assert.That(pagedExpectedClientItems.TotalCount, Is.EqualTo(clientItems.TotalCount));
    }
}
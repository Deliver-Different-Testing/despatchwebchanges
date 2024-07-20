using System;
using System.Threading.Tasks;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
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
    public void Setup()
    {
        // Arrange
        _jobRepoMock = new Mock<IJobRepository>();
        _courierRepoMock = new Mock<ICourierRepository>();
        _clientRepoMock = new Mock<IClientRepository>();
        _configMock = new Mock<IConfiguration>();

        _jobController = new JobController(
            _jobRepoMock.Object,
            _courierRepoMock.Object,
            _clientRepoMock.Object,
            _configMock.Object
        );
    }

    private Mock<IJobRepository> _jobRepoMock;
    private Mock<ICourierRepository> _courierRepoMock;
    private Mock<IClientRepository> _clientRepoMock;
    private Mock<IConfiguration> _configMock;
    private JobController _jobController;

    [Test]
    public async Task CreateJob_CallsQuickAddJob_Once()
    {
        // Arrange
        var testJob = new JobCreateViewModel
        {
            ClientId = 12345,
            DeliverToContact = "John Doe",
            FromAddress = "123 Queen St, Auckland, 1010, New Zealand",
            ToAddress = "456 George St, Dunedin, 9016, New Zealand",
            Date = DateTime.Now.AddDays(2),
            FromContactName = "Alice Smith",
            DeliveryNotes = "Leave by the back door if out.",
            PickupNotes = "Pickup from the reception.",
            Van = true,
            Truck = false,
            Pedal = false,
            Attention = false,
            VanOK = true,
            Reprice = false,
            Void = false,
            Done = false,
            Charge = 150.75m
        };

        // Act
        var result = await _jobController.CreateJob(testJob);

        // Assert
        _jobRepoMock.Verify(repo => repo.QuickAddJob(It.IsAny<TucJob>()), Times.Once);
        Assert.That(result, !Is.Null);
        var okResult = result as OkObjectResult;
        Assert.That(okResult?.StatusCode, Is.EqualTo(200));
    }
}

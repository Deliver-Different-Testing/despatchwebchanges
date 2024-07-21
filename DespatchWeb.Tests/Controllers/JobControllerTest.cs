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
        const int jacobStaffId = 385;
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

        var expectedTucJob = new TucJob
        {
            UcjbId = 1,
            UcjbClientId = testJob.ClientId,
            UcjbFromAddr = testJob.FromAddress,
            UcjbToAddr = testJob.ToAddress,
            PickupFromContact = testJob.FromContactName,
            UcjbDate = testJob.Date,
            UcjbVoid = testJob.Void,
            UcjbVan = testJob.Van,
            UcjbAttention = testJob.Attention,
            DeliverToContact = testJob.DeliverToContact,
            Truck = testJob.Truck,
            ClientNotes = testJob.DeliveryNotes,
            VanOk = testJob.VanOK,
            Reprice = testJob.Reprice,
            InternalNotes = testJob.PickupNotes,
            UcjbJobDone = testJob.Done,
            UcjbChargeType = (double)testJob.Charge,
        };

        _jobRepoMock.Setup(repo => repo.QuickAddJob(expectedTucJob, jacobStaffId)).Verifiable();

        // Act
        var result = await _jobController.QuickCreateJob(testJob, jacobStaffId);

        // Assert
        _jobRepoMock.Verify(
            repo => repo.QuickAddJob(It.Is<TucJob>(x => x.UcjbClientId == expectedTucJob.UcjbClientId), jacobStaffId),
            Times.Once); // Confirm that the right parameters passed
        Assert.That(result, Is.Not.Null);

        var jsonResult = result as JsonResult;
        Assert.That(jsonResult, Is.Not.Null);

        var jsonValue = jsonResult.Value as dynamic;
        Assert.That(jsonValue, Is.Not.Null);

        // Replace the 0 with the expected jobId value.
        Assert.That(jsonValue.jobId, Is.EqualTo(1));
    }
}

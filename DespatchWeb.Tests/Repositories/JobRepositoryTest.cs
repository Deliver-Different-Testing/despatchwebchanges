using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using MockQueryable.Moq;
using Moq;
using NUnit.Framework;

namespace DespatchWeb.Tests.Repositories;

[TestFixture]
[TestOf(typeof(JobRepository))]
public class JobRepositoryTest
{
    [SetUp]
    public void SetUp()
    {
        _mockContext = new Mock<DespatchContext>();
        _mockContext.Setup(c => c.TucClientItems).Returns(CreateClientItems()?.Object);
        _mockContext.Setup(c => c.TblClientAvailableSpeedItems).Returns(CreateAvailableSpeedItems()?.Object);
        _mockContext.Setup(c => c.TblClientAvailableSpeeds).Returns(CreateAvailableClientSpeeds()?.Object);
        _mockContext.Setup(c => c.TucJobs).Returns(CreateJobs()?.Object);

        _mockContext
            .Setup(context => context.Procedures.DESWEB_stpCreateInterCourierJobsAsync(
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<decimal?>(),
                It.IsAny<string>(),
                It.IsAny<int?>(),
                It.IsAny<OutputParameter<int>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _repository = new JobRepository(_mockContext.Object);
    }

    // Set Up Data
    private static Mock<DbSet<TucClientItem>> CreateClientItems()
    {
        var clientItems = new List<TucClientItem>
        {
            new()
            {
                ItemId = 1, ClientId = 1, Name = "Item1", Description = "Desc1", PerItem = true, Rate = 1.0M,
                OnlyVan = false
            },
            new()
            {
                ItemId = 2, ClientId = 1, Name = "Item2", Description = "Desc2", PerItem = true, Rate = 2.0M,
                OnlyVan = true
            }
        }.AsQueryable().BuildMockDbSet();

        return clientItems;
    }

    private static Mock<DbSet<TblClientAvailableSpeedItem>> CreateAvailableSpeedItems()
    {
        var availableSpeedItems = new List<TblClientAvailableSpeedItem>
        {
            new() { ClientAvailableSpeedId = 1, ClientItemId = 1, Active = true },
            new() { ClientAvailableSpeedId = 1, ClientItemId = 2, Active = true }
        }.AsQueryable().BuildMockDbSet();

        return availableSpeedItems;
    }

    private static Mock<DbSet<TblClientAvailableSpeed>> CreateAvailableClientSpeeds()
    {
        var availableSpeeds = new List<TblClientAvailableSpeed>
        {
            new() { Id = 1, ClientId = 1, SpeedId = 1 }
        }.AsQueryable().BuildMockDbSet();

        return availableSpeeds;
    }

    private static Mock<DbSet<TucJob>> CreateJobs()
    {
        var jobs = new List<TucJob>
        {
            new() { UcjbId = 1, ClientItemIds = "1,2", UcjbSize = 3 }
        }.AsQueryable().BuildMockDbSet();

        return jobs;
    }

    private Mock<DespatchContext> _mockContext;
    private IJobRepository _repository;

    [Test]
    public async Task Test_AddInterCourierCharge_Calls_Procedures_DSEWEB_Correctly()
    {
        // Arrange
        var viewModel = new InterCourierChargeViewModel
        {
            FromCourierId = 1,
            ToCourierId = 2,
            Amount = 100m,
            Reference = "test",
            StaffId = 1
        };

        await _repository.AddInterCourierChargeAsync(viewModel);
        _mockContext.Verify(c => c.Procedures.DESWEB_stpCreateInterCourierJobsAsync(
            viewModel.FromCourierId,
            viewModel.ToCourierId,
            viewModel.Amount,
            viewModel.Reference,
            viewModel.StaffId,
            It.IsAny<OutputParameter<int>>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task HasClientItemsAvailable_Should_Return_True_When_Items_Are_Available()
    {
        var result = await _repository.HasClientItemsAvailableAsync(1, 1);
        Assert.That(result, Is.True);
    }

    [Test]
    public async Task HasClientItemsAvailable_Should_Return_False_When_No_Items_Are_Available()
    {
        var result = await _repository.HasClientItemsAvailableAsync(2, 2);
        Assert.That(result, Is.Not.Null);
        Assert.That(result, Is.False);
    }

    [Test]
    public async Task GetAllClientItemsBySpeed_Should_Return_List_When_Items_Are_Available()
    {
        var result = await _repository.GetAllClientItemsBySpeedAsync(1, 1, 1);
        Assert.That(result, Is.Not.Null);
        Assert.That(result.TotalCount, Is.EqualTo(2));
        Assert.That(result.Items.Count, Is.EqualTo(2));

        var firstItem = result.Items[0];
        Assert.That(firstItem, Is.Not.Null);
        Assert.That(firstItem.Selected, Is.EqualTo(true));
        Assert.That(firstItem.Name, Is.EqualTo("Item1"));

        var secondItem = result.Items[1];
        Assert.That(secondItem, Is.Not.Null);
        Assert.That(secondItem.Selected, Is.EqualTo(true));
        Assert.That(secondItem.Name, Is.EqualTo("Item2"));
    }

    [Test]
    public async Task GetAllClientItemsBySpeed_Should_Return_Empty_List_When_No_Items_Are_Available()
    {
        var result = await _repository.GetAllClientItemsBySpeedAsync(2, 2, 2);
        Assert.That(result, Is.Not.Null);
        Assert.That(result.TotalCount, Is.EqualTo(0));
        Assert.That(result.Items.Count, Is.EqualTo(0));
    }
}
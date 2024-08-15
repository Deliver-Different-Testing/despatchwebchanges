using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
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

        var availableSpeedItems = new List<TblClientAvailableSpeedItem>
        {
            new() { ClientAvailableSpeedId = 1, ClientItemId = 1, Active = true },
            new() { ClientAvailableSpeedId = 1, ClientItemId = 2, Active = true }
        }.AsQueryable().BuildMockDbSet();

        var availableSpeeds = new List<TblClientAvailableSpeed>
        {
            new() { Id = 1, ClientId = 1, SpeedId = 1 }
        }.AsQueryable().BuildMockDbSet();

        var jobs = new List<TucJob>
        {
            new() { UcjbId = 1, ClientItemIds = "1,2", UcjbSize = 3 }
        }.AsQueryable().BuildMockDbSet();

        _mockContext = new Mock<DespatchContext>();
        _mockContext.Setup(c => c.TucClientItems).Returns(clientItems.Object);
        _mockContext.Setup(c => c.TblClientAvailableSpeedItems).Returns(availableSpeedItems.Object);
        _mockContext.Setup(c => c.TblClientAvailableSpeeds).Returns(availableSpeeds.Object);
        _mockContext.Setup(c => c.TucJobs).Returns(jobs.Object);

        _mockRepository = new JobRepository(_mockContext.Object);
    }

    private Mock<DespatchContext> _mockContext;
    private IJobRepository _mockRepository;

    [Test]
    public async Task HasClientItemsAvailable_Should_Return_True_When_Items_Are_Available()
    {
        var result = await _mockRepository.HasClientItemsAvailable(1, 1);
        Assert.That(result, Is.True);
    }

    [Test]
    public async Task HasClientItemsAvailable_Should_Return_False_When_No_Items_Are_Available()
    {
        var result = await _mockRepository.HasClientItemsAvailable(2, 2);
        Assert.That(result, Is.Not.Null);
        Assert.That(result, Is.False);
    }

    [Test]
    public async Task GetAllClientItemsBySpeed_Should_Return_List_When_Items_Are_Available()
    {
        var result = await _mockRepository.GetAllClientItemsBySpeed(1, 1, 1);
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
        var result = await _mockRepository.GetAllClientItemsBySpeed(2, 2, 2);
        Assert.That(result, Is.Not.Null);
        Assert.That(result.TotalCount, Is.EqualTo(0));
        Assert.That(result.Items.Count, Is.EqualTo(0));
    }
}

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
            new() { ItemId = 1, ClientId = 1 },
            new() { ItemId = 2, ClientId = 1 },
        }.AsQueryable().BuildMockDbSet();

        var availableSpeedItems = new List<TblClientAvailableSpeedItem>
        {
            new() { ClientAvailableSpeedId = 1, ClientItemId = 1, Active = true },
            new() { ClientAvailableSpeedId = 1, ClientItemId = 2, Active = true },
        }.AsQueryable().BuildMockDbSet();

        _mockContext = new Mock<DespatchContext>();
        _mockContext.Setup(c => c.TucClientItems).Returns(clientItems.Object);
        _mockContext.Setup(c => c.TblClientAvailableSpeedItems).Returns(availableSpeedItems.Object);

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
        Assert.That(result, Is.False);
    }
}

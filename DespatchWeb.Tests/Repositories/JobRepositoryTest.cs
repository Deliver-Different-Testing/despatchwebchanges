using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Repositories;
using Moq;
using NUnit.Framework;

namespace DespatchWeb.Tests.Repositories;

[TestFixture]
[TestOf(typeof(JobRepository))]
public class JobRepositoryTest
{
    [SetUp]
    public void Setup()
    {
        _contextMock = new Mock<DespatchContext>();
        _jobRepository = new JobRepository(_contextMock.Object);
    }

    private Mock<DespatchContext> _contextMock;
    private JobRepository _jobRepository;

    [Test] // This is a test case
    public async Task When_QuickAddJob_Called_Then_Job_Added_Successfully()
    {
        // Arrange
        var jobId = 123;
        const int staffId = 4;
        var jobNumber = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();
        var tucJob = new TucJob();

        _contextMock.Setup(x => x.Procedures.NET_stpJob_Insert_JobNumberAsync(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<OutputParameter<string>>(),
                It.IsAny<OutputParameter<int>>()))
            .ReturnsAsync(1)
            .Callback((int sId, int jId, OutputParameter<string> jNumber, OutputParameter<int> rValue) =>
            {
                jNumber.Value = "SomeNumber";
                rValue.Value = 1;
            });

        _contextMock.Setup(x => x.TucJobs.AddAsync(It.IsAny<TucJob>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _contextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        // Act
        await _jobRepository.QuickAddJob(tucJob, staffId);

        // Assert
        Assert.That(jobNumber.Value, Is.EqualTo(tucJob.UcjbNumber));
        _contextMock.Verify(
            x => x.Procedures.NET_stpJob_Insert_JobNumberAsync(It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<OutputParameter<string>>(), It.IsAny<OutputParameter<int>>()), Times.Once);
        _contextMock.Verify(x => x.TucJobs.AddAsync(It.IsAny<TucJob>(), It.IsAny<CancellationToken>()), Times.Once);
        _contextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
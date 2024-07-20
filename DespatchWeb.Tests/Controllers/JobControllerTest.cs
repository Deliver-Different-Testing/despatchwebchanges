using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
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
        _jobController = new JobController(_jobRepoMock.Object);
    }

    private Mock<IJobRepository> _jobRepoMock;
    private JobController _jobController;
}

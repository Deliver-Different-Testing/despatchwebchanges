using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

namespace DespatchWeb.Tests.Services;

public class ClientAccessValidatorServiceTests
{
    private readonly Mock<IClientRepository> _clientRepoMock;
    private readonly ClientAccessValidatorService _sut;

    public ClientAccessValidatorServiceTests()
    {
        _clientRepoMock = new Mock<IClientRepository>();
        _sut = new ClientAccessValidatorService(_clientRepoMock.Object);
    }

    [Fact]
    public async Task ValidateClientAccessAsync_ValidClientIds_ParsesCorrectly()
    {
        // Arrange
        const int contactId = 1;
        const string clientIds = "1,2,3";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([
                new Suggestion { Id = 1, Text = "Client 1" },
                new Suggestion { Id = 2, Text = "Client 2" },
                new Suggestion { Id = 3, Text = "Client 3" }
            ]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - Should not throw
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_MalformedInput_IgnoresInvalidAndParsesValid()
    {
        // Arrange - This is the security fix: malformed input should not cause exceptions
        const int contactId = 1;
        const string clientIds = "1,abc,3,xyz,5";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([
                new Suggestion { Id = 1, Text = "Client 1" },
                new Suggestion { Id = 3, Text = "Client 3" },
                new Suggestion { Id = 5, Text = "Client 5" }
            ]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - Should not throw, valid IDs (1, 3, 5) are parsed and validated
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_EmptyString_ReturnsEarly()
    {
        // Arrange
        const int contactId = 1;
        const string clientIds = "";

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - Should return early without calling repository
        await act.Should().NotThrowAsync();
        _clientRepoMock.Verify(x => x.ClientContactsAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task ValidateClientAccessAsync_NullString_ReturnsEarly()
    {
        // Arrange
        const int contactId = 1;
        string clientIds = null!;

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert
        await act.Should().NotThrowAsync();
        _clientRepoMock.Verify(x => x.ClientContactsAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task ValidateClientAccessAsync_WhitespaceInIds_TrimsCorrectly()
    {
        // Arrange
        var contactId = 1;
        var clientIds = " 1 , 2 , 3 ";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([
                new Suggestion { Id = 1, Text = "Client 1" },
                new Suggestion { Id = 2, Text = "Client 2" }
            ]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - Should parse trimmed values correctly
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_AllInvalidValues_ReturnsEarly()
    {
        // Arrange - When all values are non-numeric, should return early
        const int contactId = 1;
        const string clientIds = "abc,xyz,!!!";

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - Should return early (empty set after parsing)
        await act.Should().NotThrowAsync();
        // Repository is called but no exception since requestedClientIds is empty
    }

    [Fact]
    public async Task ValidateClientAccessAsync_UnauthorizedClient_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        const int contactId = 1;
        const string clientIds = "999"; // Client the contact doesn't have access to
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([
                new Suggestion { Id = 1, Text = "Client 1" },
                new Suggestion { Id = 2, Text = "Client 2" }
            ]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_PartialAccess_DoesNotThrow()
    {
        // Arrange - Contact has access to at least one of the requested clients
        const int contactId = 1;
        const string clientIds = "1,999"; // Has access to 1, not to 999
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([new Suggestion { Id = 1, Text = "Client 1" }]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - Has access to at least one, so should not throw
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_NullClientContacts_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        const int contactId = 1;
        const string clientIds = "1";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync((List<Suggestion>)null!);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_EmptyClientContacts_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        const int contactId = 1;
        const string clientIds = "1";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_NegativeNumbers_ParsesCorrectly()
    {
        // Arrange - Edge case: negative numbers should still parse
        const int contactId = 1;
        const string clientIds = "-1,2";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([new Suggestion { Id = -1, Text = "Client -1" }]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateClientAccessAsync_DuplicateIds_HandlesCorrectly()
    {
        // Arrange
        const int contactId = 1;
        const string clientIds = "1,1,1,2,2";
        _clientRepoMock.Setup(x => x.ClientContactsAsync(contactId))
            .ReturnsAsync([new Suggestion { Id = 1, Text = "Client 1" }]);

        // Act
        var act = () => _sut.ValidateClientAccessAsync(contactId, clientIds);

        // Assert - HashSet deduplicates, should still work
        await act.Should().NotThrowAsync();
    }
}

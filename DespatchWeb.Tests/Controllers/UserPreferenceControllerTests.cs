using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(UserPreferenceController))]
public class UserPreferenceControllerTests
{
    private readonly IUserPreferenceRepository _repository = Substitute.For<IUserPreferenceRepository>();

    private UserPreferenceController CreateController() => new(_repository);

    [Fact]
    public async Task Get_KnownKey_ReturnsTheStoredJson()
    {
        _repository.GetAsync(PreferenceKeys.AutoMate).Returns("""{"enabled":true}""");

        var result = await CreateController().Get(PreferenceKeys.AutoMate);

        var payload = Assert.IsType<PreferenceResponse>(Assert.IsType<JsonResult>(result).Value);
        Assert.Equal(PreferenceKeys.AutoMate, payload.Key);
        Assert.Equal("""{"enabled":true}""", payload.PreferenceJson);
    }

    [Fact]
    public async Task Get_NeverSaved_ReturnsNullJsonRatherThanAnEmptyObject()
    {
        _repository.GetAsync(PreferenceKeys.AutoMate).Returns((string)null);

        var result = await CreateController().Get(PreferenceKeys.AutoMate);

        var payload = Assert.IsType<PreferenceResponse>(Assert.IsType<JsonResult>(result).Value);
        Assert.Null(payload.PreferenceJson);
    }

    [Theory]
    [InlineData("SomethingElse")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Get_UnknownKey_IsRejectedWithoutTouchingTheStore(string key)
    {
        var result = await CreateController().Get(key);

        Assert.IsType<BadRequestObjectResult>(result);
        await _repository.DidNotReceiveWithAnyArgs().GetAsync(null!);
    }

    [Fact]
    public async Task Save_KnownKey_PersistsAndReturnsOk()
    {
        var result = await CreateController().Save(new SavePreferenceRequest
        {
            Key = PreferenceKeys.AutoMate,
            PreferenceJson = """{"enabled":false}"""
        });

        Assert.IsType<OkResult>(result);
        await _repository.Received(1).SaveAsync(PreferenceKeys.AutoMate, """{"enabled":false}""");
    }

    [Fact]
    public async Task Save_UnknownKey_IsRejectedWithoutTouchingTheStore()
    {
        var result = await CreateController().Save(new SavePreferenceRequest
        {
            Key = "Arbitrary",
            PreferenceJson = "{}"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        await _repository.DidNotReceiveWithAnyArgs().SaveAsync(null!, null!);
    }

    [Fact]
    public async Task Save_NullBody_IsRejected()
    {
        Assert.IsType<BadRequestObjectResult>(await CreateController().Save(null));
        await _repository.DidNotReceiveWithAnyArgs().SaveAsync(null!, null!);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Save_EmptyPayload_IsRejected(string json)
    {
        var result = await CreateController().Save(new SavePreferenceRequest
        {
            Key = PreferenceKeys.AutoMate,
            PreferenceJson = json
        });

        Assert.IsType<BadRequestObjectResult>(result);
        await _repository.DidNotReceiveWithAnyArgs().SaveAsync(null!, null!);
    }

    [Fact]
    public async Task Save_OversizedPayload_IsRejected()
    {
        // A settings blob is small. Anything this large is someone using the store
        // as per-user scratch space.
        var result = await CreateController().Save(new SavePreferenceRequest
        {
            Key = PreferenceKeys.AutoMate,
            PreferenceJson = new string('x', 8001)
        });

        Assert.IsType<BadRequestObjectResult>(result);
        await _repository.DidNotReceiveWithAnyArgs().SaveAsync(null!, null!);
    }

    [Fact]
    public async Task Save_RequestCarriesNoUserId_SoACallerCannotWriteAsSomeoneElse()
    {
        // The only fields on the wire are the key and the payload; StaffId comes from
        // the session inside the repository. Guarding the shape guards the boundary.
        var properties = typeof(SavePreferenceRequest).GetProperties().Select(p => p.Name).ToArray();

        Assert.Equal(["Key", "PreferenceJson"], properties.Order());
    }

    [Fact]
    public async Task Get_RepositoryThrows_Returns500()
    {
        _repository.GetAsync(PreferenceKeys.AutoMate).ThrowsAsync(new InvalidOperationException("boom"));

        var result = await CreateController().Get(PreferenceKeys.AutoMate);

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Save_RepositoryThrows_Returns500()
    {
        _repository.SaveAsync(Arg.Any<string>(), Arg.Any<string>())
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await CreateController().Save(new SavePreferenceRequest
        {
            Key = PreferenceKeys.AutoMate,
            PreferenceJson = "{}"
        });

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}

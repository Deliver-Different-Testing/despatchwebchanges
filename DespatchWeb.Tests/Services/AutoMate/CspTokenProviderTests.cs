using System.Net;
using System.Text;
using DespatchWeb.Models.AutoMate;
using DespatchWeb.Services.AutoMate;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate;

public sealed class CspTokenProviderTests : IDisposable
{
    private const string BaseUrl = "https://csp.example.com";
    private const string TokenUrl = "https://csp.example.com/api/v1/knowledge/token";

    private readonly string _assertionPath = Path.Combine(Path.GetTempPath(), $"csp-token-{Guid.NewGuid():N}");
    private readonly StubHandler _handler = new();
    private readonly ManualTimeProvider _time = new();
    private readonly IHttpClientFactory _factory = Substitute.For<IHttpClientFactory>();

    public CspTokenProviderTests()
    {
        File.WriteAllText(_assertionPath, "assertion-1\n");
        _handler.Responder = _ => Token("t1");
        _factory.CreateClient(CspTokenProvider.HttpClientName).Returns(_ => new HttpClient(_handler));
    }

    public void Dispose()
    {
        if (File.Exists(_assertionPath))
        {
            File.Delete(_assertionPath);
        }
    }

    private CspTokenProvider CreateSut(string? clientSecret = null, string environment = "Production", string? assertionPath = null) =>
        new(
            _factory,
            Options.Create(new ServiceAuthOptions { AssertionPath = assertionPath ?? _assertionPath, ClientSecret = clientSecret }),
            AutoMateTestEnv.Environment(environment),
            _time);

    private static HttpResponseMessage Token(string token, int expiresIn = 3600, string tokenType = "Bearer") =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(
                $$"""{"access_token":"{{token}}","token_type":"{{tokenType}}","expires_in":{{expiresIn}}}""",
                Encoding.UTF8, "application/json")
        };

    [Fact]
    public async Task Deployed_PostsTokenExchangeForm_WithNoAuthorizationHeader_AndNoScopeWithoutAProfile()
    {
        var token = await CreateSut().GetTokenAsync(BaseUrl + "/", null, TestContext.Current.CancellationToken);

        Assert.Equal("t1", token);
        var request = Assert.Single(_handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal(TokenUrl, request.Uri);
        Assert.Equal("application/x-www-form-urlencoded", request.ContentType);
        Assert.Null(request.Authorization);
        Assert.Equal(
        [
            "grant_type=urn:ietf:params:oauth:grant-type:token-exchange",
            "subject_token=assertion-1",
            "subject_token_type=urn:ietf:params:oauth:token-type:jwt",
            "audience=csp"
        ], request.Form);
    }

    [Fact]
    public async Task Deployed_WithAProfile_AddsTheProfileScope()
    {
        await CreateSut().GetTokenAsync(BaseUrl, "customer", TestContext.Current.CancellationToken);

        Assert.Equal(
        [
            "grant_type=urn:ietf:params:oauth:grant-type:token-exchange",
            "subject_token=assertion-1",
            "subject_token_type=urn:ietf:params:oauth:token-type:jwt",
            "audience=csp",
            "scope=profile:customer"
        ], Assert.Single(_handler.Requests).Form);
    }

    [Fact]
    public async Task Deployed_ReadsTheAssertionFileOnEveryExchange()
    {
        var sut = CreateSut();

        await sut.GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken);
        await File.WriteAllTextAsync(_assertionPath, "assertion-2", TestContext.Current.CancellationToken);
        sut.Invalidate(BaseUrl, null);
        await sut.GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken);

        Assert.Contains("subject_token=assertion-1", _handler.Requests[0].Form);
        Assert.Contains("subject_token=assertion-2", _handler.Requests[1].Form);
    }

    [Fact]
    public async Task Development_WithSecret_PostsClientCredentials_WithoutNeedingTheAssertionFile()
    {
        var sut = CreateSut("dev-secret", "Development", _assertionPath + ".missing");

        var token = await sut.GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken);

        Assert.Equal("t1", token);
        var request = Assert.Single(_handler.Requests);
        Assert.Null(request.Authorization);
        Assert.Equal(["grant_type=client_credentials", "client_id=despatchweb", "client_secret=dev-secret"], request.Form);
    }

    [Fact]
    public async Task Development_WithSecret_AndAProfile_AddsTheScope()
    {
        await CreateSut("dev-secret", "Development").GetTokenAsync(BaseUrl, "customer", TestContext.Current.CancellationToken);

        Assert.Equal(
            ["grant_type=client_credentials", "client_id=despatchweb", "client_secret=dev-secret", "scope=profile:customer"],
            Assert.Single(_handler.Requests).Form);
    }

    [Fact]
    public async Task Production_IgnoresTheDevSecret()
    {
        await CreateSut("dev-secret", "Production").GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken);

        var request = Assert.Single(_handler.Requests);
        Assert.Contains("subject_token=assertion-1", request.Form);
        Assert.DoesNotContain(request.Form, f => f.StartsWith("client_secret"));
    }

    [Fact]
    public async Task Development_WithoutASecret_UsesTheAssertionFile()
    {
        await CreateSut(null, "Development").GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken);

        Assert.Contains("subject_token=assertion-1", Assert.Single(_handler.Requests).Form);
    }

    [Theory]
    [InlineData("Production", null, true, "https://csp.example.com", true)]
    [InlineData("Production", null, false, "https://csp.example.com", false)]
    [InlineData("Production", "secret", false, "https://csp.example.com", false)]
    [InlineData("Development", "secret", false, "https://csp.example.com", true)]
    [InlineData("Development", null, false, "https://csp.example.com", false)]
    [InlineData("Production", null, true, null, false)]
    [InlineData("Production", null, true, "  ", false)]
    public void IsConfigured_NeedsAnAddressAndACredentialSource(
        string environment, string? secret, bool fileExists, string? baseUrl, bool expected)
    {
        var path = fileExists ? _assertionPath : _assertionPath + ".missing";

        Assert.Equal(expected, CreateSut(secret, environment, path).IsConfigured(baseUrl));
    }

    [Fact]
    public async Task ACachedToken_IsReused_UntilFiveMinutesBeforeExpiry()
    {
        _handler.Responder = _ => Token("t1", 3600);
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal("t1", await sut.GetTokenAsync(BaseUrl, null, ct));
        _time.Advance(TimeSpan.FromSeconds(3299));
        Assert.Equal("t1", await sut.GetTokenAsync(BaseUrl, null, ct));
        Assert.Single(_handler.Requests);

        _handler.Responder = _ => Token("t2", 3600);
        _time.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal("t2", await sut.GetTokenAsync(BaseUrl, null, ct));
        Assert.Equal(2, _handler.Requests.Count);
    }

    [Fact]
    public async Task EachExchange_CreatesAFreshClientFromTheFactory()
    {
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        await sut.GetTokenAsync(BaseUrl, null, ct);
        await sut.GetTokenAsync(BaseUrl, null, ct);
        _factory.Received(1).CreateClient(CspTokenProvider.HttpClientName);

        _time.Advance(TimeSpan.FromSeconds(3300));
        await sut.GetTokenAsync(BaseUrl, null, ct);
        _factory.Received(2).CreateClient(CspTokenProvider.HttpClientName);
    }

    [Fact]
    public async Task AShortLivedToken_RefreshesAtHalfItsLifetime()
    {
        _handler.Responder = _ => Token("t1", 600);
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        await sut.GetTokenAsync(BaseUrl, null, ct);
        _time.Advance(TimeSpan.FromSeconds(299));
        await sut.GetTokenAsync(BaseUrl, null, ct);
        Assert.Single(_handler.Requests);

        _time.Advance(TimeSpan.FromSeconds(1));
        await sut.GetTokenAsync(BaseUrl, null, ct);
        Assert.Equal(2, _handler.Requests.Count);
    }

    [Fact]
    public async Task Invalidate_ForcesAFreshExchange()
    {
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;
        await sut.GetTokenAsync(BaseUrl, null, ct);

        sut.Invalidate(BaseUrl + "/", null);
        await sut.GetTokenAsync(BaseUrl, null, ct);

        Assert.Equal(2, _handler.Requests.Count);
    }

    [Fact]
    public async Task EachProfile_HasItsOwnCacheEntry_AndInvalidatingOneLeavesTheOther()
    {
        _handler.Responder = request => Token(request.Content!.ReadAsStringAsync().Result.Contains("scope") ? "customer-token" : "base-token");
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal("base-token", await sut.GetTokenAsync(BaseUrl, null, ct));
        Assert.Equal("customer-token", await sut.GetTokenAsync(BaseUrl, "customer", ct));
        Assert.Equal("base-token", await sut.GetTokenAsync(BaseUrl, null, ct));
        Assert.Equal("customer-token", await sut.GetTokenAsync(BaseUrl, "customer", ct));
        Assert.Equal(2, _handler.Requests.Count);

        sut.Invalidate(BaseUrl, "customer");
        await sut.GetTokenAsync(BaseUrl, null, ct);
        await sut.GetTokenAsync(BaseUrl, "customer", ct);
        Assert.Equal(3, _handler.Requests.Count);
    }

    [Fact]
    public async Task EachBaseUrl_HasItsOwnCacheEntry()
    {
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        await sut.GetTokenAsync("https://one.example.com", null, ct);
        await sut.GetTokenAsync("https://two.example.com", null, ct);

        Assert.Equal(["https://one.example.com/api/v1/knowledge/token", "https://two.example.com/api/v1/knowledge/token"],
            _handler.Requests.Select(r => r.Uri));
    }

    [Fact]
    public async Task ConcurrentCallers_ShareASingleExchange()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _handler.AsyncResponder = async (_, _) =>
        {
            await release.Task;
            return Token("shared");
        };
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        var callers = Enumerable.Range(0, 8).Select(_ => Task.Run(() => sut.GetTokenAsync(BaseUrl, null, ct), ct)).ToArray();
        while (_handler.Requests.Count == 0)
        {
            await Task.Delay(5, ct);
        }

        await Task.Delay(50, ct);
        release.SetResult();
        var tokens = await Task.WhenAll(callers);

        Assert.All(tokens, t => Assert.Equal("shared", t));
        Assert.Single(_handler.Requests);
    }

    [Fact]
    public async Task ConcurrentCallersForDifferentProfiles_DoNotBlockEachOther()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _handler.AsyncResponder = async (_, _) =>
        {
            await release.Task;
            return Token("t");
        };
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        var a = sut.GetTokenAsync(BaseUrl, null, ct);
        var b = sut.GetTokenAsync(BaseUrl, "customer", ct);
        while (_handler.Requests.Count < 2)
        {
            await Task.Delay(5, ct);
        }

        release.SetResult();
        await Task.WhenAll(a, b);
        Assert.Equal(2, _handler.Requests.Count);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.BadRequest)]
    public async Task ANonSuccessResponse_ReturnsNull_AndIsNotCached(HttpStatusCode status)
    {
        _handler.Responder = _ => new HttpResponseMessage(status);
        var sut = CreateSut();
        var ct = TestContext.Current.CancellationToken;

        Assert.Null(await sut.GetTokenAsync(BaseUrl, null, ct));

        _handler.Responder = _ => Token("recovered");
        Assert.Equal("recovered", await sut.GetTokenAsync(BaseUrl, null, ct));
    }

    [Theory]
    [InlineData("""{"token_type":"Bearer","expires_in":3600}""")]
    [InlineData("""{"access_token":"","token_type":"Bearer","expires_in":3600}""")]
    [InlineData("""{"access_token":"t","token_type":"Bearer","expires_in":0}""")]
    [InlineData("""{"access_token":"t","token_type":"MAC","expires_in":3600}""")]
    [InlineData("not json")]
    public async Task AMalformedTokenResponse_ReturnsNull(string body)
    {
        _handler.Responder = _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        Assert.Null(await CreateSut().GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ABearerTokenType_IsMatchedCaseInsensitively()
    {
        _handler.Responder = _ => Token("t1", tokenType: "bearer");

        Assert.Equal("t1", await CreateSut().GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ATransportFailure_ReturnsNull()
    {
        _handler.Responder = _ => throw new HttpRequestException("connection refused");

        Assert.Null(await CreateSut().GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AMissingOrEmptyAssertionFile_ReturnsNull_WithoutCallingCsp(bool fileExistsButEmpty)
    {
        var path = _assertionPath + ".other";
        if (fileExistsButEmpty)
        {
            await File.WriteAllTextAsync(path, "  \n", TestContext.Current.CancellationToken);
        }

        try
        {
            Assert.Null(await CreateSut(assertionPath: path).GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken));
            Assert.Empty(_handler.Requests);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task CallerCancellation_Propagates_FromTheExchange()
    {
        _handler.AsyncResponder = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            return Token("never");
        };
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        var pending = CreateSut().GetTokenAsync(BaseUrl, null, cts.Token);
        while (_handler.Requests.Count == 0)
        {
            await Task.Delay(5, TestContext.Current.CancellationToken);
        }

        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
    }

    [Fact]
    public async Task CallerCancellation_Propagates_WhileWaitingBehindAnotherExchange()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _handler.AsyncResponder = async (_, _) =>
        {
            await release.Task;
            return Token("t");
        };
        var sut = CreateSut();
        var first = sut.GetTokenAsync(BaseUrl, null, TestContext.Current.CancellationToken);
        while (_handler.Requests.Count == 0)
        {
            await Task.Delay(5, TestContext.Current.CancellationToken);
        }

        using var cts = new CancellationTokenSource();
        var second = sut.GetTokenAsync(BaseUrl, null, cts.Token);
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => second);
        release.SetResult();
        Assert.Equal("t", await first);
    }
}

using System.Diagnostics;
using System.Net;
using System.Text;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.AutoMate;
using DespatchWeb.Services.AutoMate;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate;

public class CspKnowledgeClientTests
{
    private const string BaseUrl = "https://csp.example.com";
    private static readonly Guid ArticleId = Guid.Parse("11111111-2222-3333-4444-555555555555");
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(2);

    private readonly StubHandler _handler = new();
    private readonly ManualTimeProvider _time = new();
    private readonly CspKnowledgeCircuits _circuits;
    private CspKnowledgeCircuit _circuit => _circuits.For(null);
    private readonly IServiceTokenProvider _tokens = Substitute.For<IServiceTokenProvider>();

    public CspKnowledgeClientTests()
    {
        _circuits = new CspKnowledgeCircuits(_time);
        _tokens.IsConfigured(Arg.Any<string?>()).Returns(true);
        _tokens.GetTokenAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns("tok-1");
        _handler.Responder = _ => Json("[]");
    }

    private CspKnowledgeClient CreateSut(string? baseUrl = BaseUrl + "/", AutoMateAudience? audience = null) =>
        new(
            new HttpClient(_handler),
            new CspBaseUrlResolver(
                Options.Create(new CspKnowledgeOptions { BaseUrl = baseUrl }),
                Substitute.For<IHttpContextAccessor>(),
                AutoMateTestEnv.Environment("Production")),
            audience ?? AutoMateTestEnv.Staff(),
            _tokens,
            _circuits);

    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    [Fact]
    public async Task WhenTheTokenProviderIsNotConfigured_MakesNoCall()
    {
        _tokens.IsConfigured(Arg.Any<string?>()).Returns(false);
        var sut = CreateSut();

        var search = await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);
        var article = await sut.GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);

        Assert.False(sut.IsConfigured);
        Assert.Equal(CspKbStatus.Unavailable, search.Status);
        Assert.Equal(CspKbStatus.Unavailable, article.Status);
        Assert.Empty(_handler.Requests);
    }

    [Fact]
    public void IsConfigured_AsksTheProviderAboutTheResolvedAddress()
    {
        var sut = CreateSut();

        _ = sut.IsConfigured;

        _tokens.Received().IsConfigured(BaseUrl);
    }

    [Fact]
    public async Task SearchAsync_SendsBearerAndEncodedQuery_AndMapsHits()
    {
        _handler.Responder = _ => Json($$"""
            [{"articleId":"{{ArticleId}}","title":"Booking a job","snippet":"snip","layer":"Public","categoryName":"Jobs","isFaq":true,"score":1.5,"content":"Full text"}]
            """);

        var result = await CreateSut().SearchAsync("book & track?", 3, Budget, TestContext.Current.CancellationToken);

        var request = Assert.Single(_handler.Requests);
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal($"{BaseUrl}/api/v1/knowledge/search?q=book%20%26%20track%3F&limit=3", request.Uri);
        Assert.Equal("Bearer tok-1", request.Authorization);
        Assert.Equal(CspKbStatus.Ok, result.Status);
        var hit = Assert.Single(result.Hits);
        Assert.Equal(ArticleId, hit.ArticleId);
        Assert.Equal("Booking a job", hit.Title);
        Assert.Equal("snip", hit.Snippet);
        Assert.Equal("Jobs", hit.CategoryName);
        Assert.True(hit.IsFaq);
        Assert.Equal(1.5, hit.Score);
        Assert.Equal("Full text", hit.Content);
    }

    [Fact]
    public async Task SearchAsync_BlankQuery_IsOkWithNoHits_WithoutACall()
    {
        var result = await CreateSut().SearchAsync("   ", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Empty(result.Hits);
        Assert.Empty(_handler.Requests);
    }

    [Fact]
    public async Task SearchAsync_EmptyArray_IsOkWithNoHits_NotUnavailable()
    {
        var result = await CreateSut().SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Empty(result.Hits);
    }

    [Fact]
    public async Task GetArticleAsync_SendsBearer_AndMapsArticleWithFaqs()
    {
        _handler.Responder = _ => Json($$"""
            {"articleId":"{{ArticleId}}","title":"Booking a job","content":"Steps","faqs":[{"question":"Q?","answer":"A."}]}
            """);

        var result = await CreateSut().GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);

        var request = Assert.Single(_handler.Requests);
        Assert.Equal($"{BaseUrl}/api/v1/knowledge/articles/{ArticleId}", request.Uri);
        Assert.Equal("Bearer tok-1", request.Authorization);
        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Equal("Booking a job", result.Article!.Title);
        Assert.Equal("Steps", result.Article.Content);
        Assert.Equal("Q?", Assert.Single(result.Article.Faqs!).Question);
    }

    [Fact]
    public async Task GetArticleAsync_404_IsNotFound_AndDoesNotOpenTheCircuit()
    {
        _handler.Responder = _ => Json("{}", HttpStatusCode.NotFound);
        var sut = CreateSut();

        var result = await sut.GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.NotFound, result.Status);
        Assert.Null(result.Article);
        Assert.False(_circuit.IsOpen);
        await sut.GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);
        Assert.Equal(2, _handler.Requests.Count);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task Search_404_401_403_AreUnavailable_AndOpenTheCircuitPermanently(HttpStatusCode status)
    {
        _handler.Responder = _ => Json("{}", status);
        var sut = CreateSut();

        var result = await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
        Assert.Empty(result.Hits);
        Assert.True(_circuit.IsOpen);
        _time.Advance(CspKnowledgeCircuit.TransientBreak + TimeSpan.FromSeconds(1));
        Assert.True(_circuit.IsOpen);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadGateway)]
    public async Task Search_5xx_IsUnavailable_AndOpensTheCircuitOnlyAfterRepeatedFailures(HttpStatusCode status)
    {
        _handler.Responder = _ => Json("{}", status);
        var sut = CreateSut();

        for (var i = 0; i < CspKnowledgeCircuit.TransientFailureThreshold; i++)
        {
            Assert.False(_circuit.IsOpen);
            Assert.Equal(CspKbStatus.Unavailable, (await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken)).Status);
        }

        Assert.True(_circuit.IsOpen);
        _time.Advance(CspKnowledgeCircuit.TransientBreak + TimeSpan.FromSeconds(1));
        Assert.False(_circuit.IsOpen);
    }

    [Fact]
    public async Task GetArticle_5xx_IsUnavailable()
    {
        _handler.Responder = _ => Json("{}", HttpStatusCode.InternalServerError);

        var result = await CreateSut().GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
    }

    [Fact]
    public async Task BadJson_IsUnavailable()
    {
        _handler.Responder = _ => Json("not json");
        var sut = CreateSut();

        Assert.Equal(CspKbStatus.Unavailable, (await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken)).Status);
        Assert.Equal(CspKbStatus.Unavailable, (await sut.GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken)).Status);
    }

    [Fact]
    public async Task ATransportFailure_IsUnavailable_NotThrown()
    {
        _handler.Responder = _ => throw new HttpRequestException("connection refused");

        var result = await CreateSut().SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
    }

    [Fact]
    public async Task NoServiceToken_IsUnavailable_WithoutCallingCsp()
    {
        _tokens.GetTokenAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns((string?)null);

        var result = await CreateSut().SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
        Assert.Empty(_handler.Requests);
    }

    [Fact]
    public async Task A401_InvalidatesTheToken_AndRetriesOnceWithAFreshOne()
    {
        _tokens.GetTokenAsync(BaseUrl, null, Arg.Any<CancellationToken>()).Returns("old", "fresh");
        _handler.Responder = request => request.Headers.Authorization!.Parameter == "old"
            ? Json("{}", HttpStatusCode.Unauthorized)
            : Json("[]");

        var result = await CreateSut().SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Equal(["Bearer old", "Bearer fresh"], _handler.Requests.Select(r => r.Authorization));
        _tokens.Received(1).Invalidate(BaseUrl, null);
        Assert.False(_circuit.IsOpen);
    }

    [Fact]
    public async Task ASecond401_IsUnavailable_AndPermanent_WithNoThirdAttempt()
    {
        _handler.Responder = _ => Json("{}", HttpStatusCode.Unauthorized);
        var sut = CreateSut();

        var result = await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
        Assert.Equal(2, _handler.Requests.Count);
        _tokens.Received(1).Invalidate(BaseUrl, null);
        Assert.True(_circuit.IsOpen);

        await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);
        Assert.Equal(2, _handler.Requests.Count);
    }

    [Fact]
    public async Task A401_ThenNoFreshToken_IsUnavailable()
    {
        _tokens.GetTokenAsync(BaseUrl, null, Arg.Any<CancellationToken>()).Returns("old", (string?)null);
        _handler.Responder = _ => Json("{}", HttpStatusCode.Unauthorized);

        var result = await CreateSut().SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
        Assert.Single(_handler.Requests);
    }

    [Fact]
    public async Task AnOpenCircuit_MakesNoHttpCall_ForSearchOrArticle()
    {
        _circuit.RecordFailure("test", permanent: true);
        var sut = CreateSut();

        var search = await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);
        var article = await sut.GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, search.Status);
        Assert.Equal(CspKbStatus.Unavailable, article.Status);
        Assert.Empty(_handler.Requests);
        await _tokens.DidNotReceive().GetTokenAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ASuccess_ClosesTheCircuitAfterTheBreak()
    {
        _circuit.RecordFailure("test", permanent: true);
        _time.Advance(CspKnowledgeCircuit.PermanentBreak + TimeSpan.FromSeconds(1));

        var result = await CreateSut().SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.False(_circuit.IsOpen);
    }

    [Fact]
    public async Task ASlowCsp_IsCutOffAtTheBudget_AsUnavailable()
    {
        _handler.AsyncResponder = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            return Json("[]");
        };
        var clock = Stopwatch.StartNew();

        var result = await CreateSut().SearchAsync("q", 3, TimeSpan.FromMilliseconds(100), TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task ASlowTokenExchange_IsCutOffAtTheBudget_AsUnavailable()
    {
        _tokens.GetTokenAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(async call =>
            {
                await Task.Delay(Timeout.Infinite, call.Arg<CancellationToken>());
                return "never";
            });

        var result = await CreateSut().GetArticleAsync(ArticleId, TimeSpan.FromMilliseconds(100), TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Unavailable, result.Status);
        Assert.Empty(_handler.Requests);
    }

    [Fact]
    public async Task CallerCancellation_Propagates_NotSwallowedAsUnavailable()
    {
        _handler.AsyncResponder = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            return Json("[]");
        };
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        var pending = CreateSut().SearchAsync("q", 3, TimeSpan.FromSeconds(30), cts.Token);
        while (_handler.Requests.Count == 0)
        {
            await Task.Delay(5, TestContext.Current.CancellationToken);
        }

        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.False(_circuit.IsOpen);
    }

    [Fact]
    public async Task Staff_AskForTheBaseRegistration_NoProfile()
    {
        await CreateSut(audience: AutoMateTestEnv.Staff()).SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        await _tokens.Received(1).GetTokenAsync(BaseUrl, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NonStaff_AskForTheCustomerProfile_OnSearchAndArticle_AndOnRetry()
    {
        var sut = CreateSut(audience: AutoMateTestEnv.Customer());

        await sut.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);
        await sut.GetArticleAsync(ArticleId, Budget, TestContext.Current.CancellationToken);

        await _tokens.Received(2).GetTokenAsync(BaseUrl, "customer", Arg.Any<CancellationToken>());
        await _tokens.DidNotReceive().GetTokenAsync(Arg.Any<string>(), Arg.Is<string?>(p => p == null), Arg.Any<CancellationToken>());

        _handler.Responder = _ => Json("{}", HttpStatusCode.Unauthorized);
        var other = CreateSut(audience: AutoMateTestEnv.Customer());
        await other.SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);
        _tokens.Received(1).Invalidate(BaseUrl, "customer");
    }

    [Fact]
    public async Task APermanentFailureUnderTheCustomerProfile_DoesNotOpenTheStaffCircuit()
    {
        _handler.Responder = _ => Json("{}", HttpStatusCode.Forbidden);
        await CreateSut(audience: AutoMateTestEnv.Customer()).SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);
        Assert.True(_circuits.For("customer").IsOpen);
        Assert.False(_circuits.For(null).IsOpen);

        _handler.Responder = _ => Json("[]");
        var before = _handler.Requests.Count;
        var staff = await CreateSut(audience: AutoMateTestEnv.Staff()).SearchAsync("q", 3, Budget, TestContext.Current.CancellationToken);

        Assert.Equal(CspKbStatus.Ok, staff.Status);
        Assert.Equal(before + 1, _handler.Requests.Count);
    }
}

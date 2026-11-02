using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.AutoMate;
using DespatchWeb.Services.AutoMate;
using DespatchWeb.Services.AutoMate.Tools;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate.Tools;

public class KnowledgeBaseToolsTests
{
    private static readonly Guid ArticleId = Guid.Parse("11111111-2222-3333-4444-555555555555");

    private readonly ICspKnowledgeClient _client = Substitute.For<ICspKnowledgeClient>();
    private readonly KbTurnSources _sources = new();
    private readonly IOptions<AutoMateChatOptions> _options = Options.Create(new AutoMateChatOptions { KbToolTimeoutMs = 1234 });

    private SearchKnowledgeBaseTool Search() => new(_client, _sources, _options);

    private GetArticleTool Article() => new(_client, _sources, _options);

    private static JsonElement Input(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static CspKbHit Hit(Guid id, string title, string? content = "Body", bool isFaq = false) =>
        new(id, title, "snippet", "Public", null, isFaq, 1.0, content);

    [Fact]
    public void BothTools_AreKnowledgeBaseTools_AvailableToEveryAudience()
    {
        Assert.IsAssignableFrom<IKnowledgeBaseTool>(Search());
        Assert.IsAssignableFrom<IKnowledgeBaseTool>(Article());
        Assert.False(Search().StaffOnly);
        Assert.False(Article().StaffOnly);
        Assert.Equal("search_knowledge_base", Search().Definition.Name);
        Assert.Equal("get_article", Article().Definition.Name);
    }

    [Fact]
    public async Task Search_PassesTrimmedQuery_LimitAndConfiguredTimeout_AndRecordsSources()
    {
        _client.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbSearchResult(CspKbStatus.Ok, [Hit(ArticleId, "Booking <b>a</b> job", "Open Jobs.\nSecond paragraph.", isFaq: true)]));

        var result = await Search().ExecuteAsync(Input("""{"query":"  book a job "}"""), TestContext.Current.CancellationToken);

        await _client.Received(1).SearchAsync("book a job", 5, TimeSpan.FromMilliseconds(1234), Arg.Any<CancellationToken>());
        Assert.StartsWith("<kb-result>", result);
        Assert.Contains($"- [{ArticleId}] Booking  b a /b  job: Open Jobs.", result);
        Assert.DoesNotContain("Second paragraph", result);
        var seen = Assert.Single(_sources.Seen);
        Assert.Equal(new KbSource(ArticleId, "Booking <b>a</b> job", true), seen);
        Assert.False(ToolOutput.IsError(result));
    }

    [Fact]
    public async Task Search_NoHits_SaysSo_WithoutRecordingSources()
    {
        _client.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbSearchResult(CspKbStatus.Ok, []));

        var result = await Search().ExecuteAsync(Input("""{"query":"zzz"}"""), TestContext.Current.CancellationToken);

        Assert.Equal("No knowledge base articles matched.", result);
        Assert.Empty(_sources.Seen);
    }

    [Fact]
    public async Task Search_Unavailable_IsAnErrorResult_WithTheUnavailableMessage()
    {
        _client.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(CspKbSearchResult.Unavailable);

        var result = await Search().ExecuteAsync(Input("""{"query":"book"}"""), TestContext.Current.CancellationToken);

        Assert.True(ToolOutput.IsError(result));
        Assert.Equal(ToolOutput.Error(KbText.UnavailableMessage), result);
        Assert.Empty(_sources.Seen);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"query":"   "}""")]
    [InlineData("""{"query":5}""")]
    public async Task Search_MissingOrBadQuery_IsAnError_WithoutCallingCsp(string json)
    {
        var result = await Search().ExecuteAsync(Input(json), TestContext.Current.CancellationToken);

        Assert.True(ToolOutput.IsError(result));
        await _client.DidNotReceive().SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetArticle_ReturnsTitleContentAndFaqs_AndRecordsTheSource()
    {
        _client.GetArticleAsync(ArticleId, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbArticleResult(CspKbStatus.Ok,
                new CspKbArticle(ArticleId, "Booking a job", "Step 1. <script>x</script>", [new CspKbFaq("Why?", "Because.")])));

        var result = await Article().ExecuteAsync(Input($$"""{"article_id":"{{ArticleId}}"}"""), TestContext.Current.CancellationToken);

        await _client.Received(1).GetArticleAsync(ArticleId, TimeSpan.FromMilliseconds(1234), Arg.Any<CancellationToken>());
        Assert.Contains("Booking a job", result);
        Assert.Contains("Step 1.  script x /script", result);
        Assert.Contains("Q: Why?\nA: Because.", result);
        Assert.Equal(new KbSource(ArticleId, "Booking a job", false), Assert.Single(_sources.Seen));
    }

    [Fact]
    public async Task GetArticle_Unavailable_IsAnErrorResult_WithTheUnavailableMessage()
    {
        _client.GetArticleAsync(ArticleId, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(CspKbArticleResult.Unavailable);

        var result = await Article().ExecuteAsync(Input($$"""{"article_id":"{{ArticleId}}"}"""), TestContext.Current.CancellationToken);

        Assert.Equal(ToolOutput.Error(KbText.UnavailableMessage), result);
        Assert.Empty(_sources.Seen);
    }

    [Fact]
    public async Task GetArticle_NotFound_IsADistinctError()
    {
        _client.GetArticleAsync(ArticleId, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbArticleResult(CspKbStatus.NotFound, null));

        var result = await Article().ExecuteAsync(Input($$"""{"article_id":"{{ArticleId}}"}"""), TestContext.Current.CancellationToken);

        Assert.True(ToolOutput.IsError(result));
        Assert.NotEqual(ToolOutput.Error(KbText.UnavailableMessage), result);
        Assert.Contains("No knowledge base article has that id", result);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"article_id":"not-a-guid"}""")]
    [InlineData("""{"article_id":12}""")]
    public async Task GetArticle_BadId_IsAnError_WithoutCallingCsp(string json)
    {
        var result = await Article().ExecuteAsync(Input(json), TestContext.Current.CancellationToken);

        Assert.True(ToolOutput.IsError(result));
        await _client.DidNotReceive().GetArticleAsync(Arg.Any<Guid>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void KbTurnSources_DeduplicatesByArticleId()
    {
        var sources = new KbTurnSources();

        sources.Add(ArticleId, "First", false);
        sources.Add(ArticleId, "Second", true);

        Assert.Equal("First", Assert.Single(sources.Seen).Title);
    }
}

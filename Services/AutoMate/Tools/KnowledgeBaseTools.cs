#nullable enable
using System.Text;
using System.Text.Json;
using Anthropic.Models.Beta.Messages;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.AutoMate;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services.AutoMate.Tools;

public sealed class SearchKnowledgeBaseTool(
    ICspKnowledgeClient client, KbTurnSources sources, IOptions<AutoMateChatOptions> options) : IKnowledgeBaseTool
{
    private const int SearchLimit = 5;

    private static readonly BetaTool Tool = new()
    {
        Name = "search_knowledge_base",
        Description = "Search the DFRNT help knowledge base of articles and FAQs. Use it for how-to and product questions, or to look again with different words when the supplied knowledge-base block did not cover the question. Each result has its article id in square brackets; call get_article with that id to read a whole article.",
        InputSchema = new InputSchema
        {
            Properties = new Dictionary<string, JsonElement>
            {
                ["query"] = ToolSchema.Prop("string", "What to search for, in plain words")
            },
            Required = ["query"]
        }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => false;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        var args = new ToolArgs(input);
        var query = args.String("query");

        if (args.Error is not null || string.IsNullOrWhiteSpace(query))
        {
            return ToolOutput.Error(args.Error ?? "'query' is required and must be non-empty text.");
        }

        var result = await client.SearchAsync(query.Trim(), SearchLimit, TimeSpan.FromMilliseconds(options.Value.KbToolTimeoutMs), ct);
        if (result.Status == CspKbStatus.Unavailable)
        {
            return ToolOutput.Error(KbText.UnavailableMessage);
        }

        if (result.Hits.Count == 0)
        {
            return "No knowledge base articles matched.";
        }

        var sb = new StringBuilder("<kb-result>");
        foreach (var hit in result.Hits)
        {
            sources.Add(hit.ArticleId, hit.Title, hit.IsFaq);
            sb.Append("\n- [").Append(hit.ArticleId).Append("] ").Append(KbText.Clean(hit.Title)).Append(": ")
                .Append(KbText.Lead(hit.Content ?? hit.Snippet));
        }

        return sb.Append("\n</kb-result>").ToString();
    }
}

public sealed class GetArticleTool(
    ICspKnowledgeClient client, KbTurnSources sources, IOptions<AutoMateChatOptions> options) : IKnowledgeBaseTool
{
    private static readonly BetaTool Tool = new()
    {
        Name = "get_article",
        Description = "Read one knowledge base article in full, including its FAQs. Use it when the opening of an article in the knowledge-base block or in search results does not give the steps.",
        InputSchema = new InputSchema
        {
            Properties = new Dictionary<string, JsonElement>
            {
                ["article_id"] = ToolSchema.Prop("string", "The article GUID shown in square brackets")
            },
            Required = ["article_id"]
        }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => false;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        var args = new ToolArgs(input);
        var raw = args.String("article_id");

        if (args.Error is not null || !Guid.TryParse(raw, out var id))
        {
            return ToolOutput.Error(args.Error ?? "'article_id' is required and must be the GUID shown in square brackets.");
        }

        var result = await client.GetArticleAsync(id, TimeSpan.FromMilliseconds(options.Value.KbToolTimeoutMs), ct);
        if (result.Status == CspKbStatus.Unavailable)
        {
            return ToolOutput.Error(KbText.UnavailableMessage);
        }

        if (result.Article is not { } article)
        {
            return ToolOutput.Error("No knowledge base article has that id.");
        }

        sources.Add(id, article.Title, isFaq: false);

        var sb = new StringBuilder("<kb-result>\n")
            .Append(KbText.Clean(article.Title)).Append('\n').Append(KbText.Article(article.Content));
        foreach (var faq in article.Faqs ?? [])
        {
            sb.Append("\n\nQ: ").Append(KbText.Clean(faq.Question)).Append("\nA: ").Append(KbText.Clean(faq.Answer));
        }

        return sb.Append("\n</kb-result>").ToString();
    }
}

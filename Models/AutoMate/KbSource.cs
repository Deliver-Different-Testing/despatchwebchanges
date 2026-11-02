namespace DespatchWeb.Models.AutoMate;

public sealed record KbSource(Guid ArticleId, string Title, bool IsFaq);

/// <summary>Articles the knowledge-base tools showed the model during one chat turn.</summary>
public sealed class KbTurnSources
{
    private readonly List<KbSource> _seen = [];

    public IReadOnlyList<KbSource> Seen => _seen;

    public void Add(Guid articleId, string title, bool isFaq)
    {
        if (_seen.TrueForAll(s => s.ArticleId != articleId))
        {
            _seen.Add(new KbSource(articleId, title, isFaq));
        }
    }
}

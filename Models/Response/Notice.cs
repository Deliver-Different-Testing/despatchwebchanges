namespace DespatchWeb.Models.Response;

public sealed record Notice
{
    public string Title { get; init; }
    public string Code { get; init; }

    public string Severity { get; init; }
}

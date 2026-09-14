namespace DespatchWeb.Models.RequestModels;

/// <summary>One pasted booking request — an email, a phone-call note, a message thread.</summary>
public sealed class ExtractJobIntakeRequest
{
    public string Text { get; init; }
}

/// <summary>One line of dispatcher shorthand to turn into job-search criteria.</summary>
public sealed class ParseSearchQueryRequest
{
    public string Query { get; init; }
}

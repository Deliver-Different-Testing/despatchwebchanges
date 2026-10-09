namespace DespatchWeb.Models;

public sealed class MultiSuggestion : Suggestion
{
    public bool Selected { get; set; }
    public bool IsBulkJob { get; set; }
    public bool IsArchived { get; set; }
}

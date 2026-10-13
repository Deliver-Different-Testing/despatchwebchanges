namespace DespatchWeb.Models.Response;

public record PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; init; }
    public int Total { get; init; }
    public int Page { get; init; }
    public int Pages { get; init; }
}

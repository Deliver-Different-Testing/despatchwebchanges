namespace DespatchWeb.Models;

public readonly record struct CreateMinimalTucJobResponse
{
    public bool Success { get; init; }
    public int? JobId { get; init; }
    public string Message { get; init; }
}

namespace DespatchWeb.Models.Response;

public sealed record AwsBatchOperationResult
{
    public int TotalFiles { get; init; }
    public int SuccessfulFiles { get; init; }
    public int FailedFiles { get; init; }
    public bool IsSuccess => FailedFiles == 0;
    public IReadOnlyList<string> ErrorMessages { get; init; } = [];
}

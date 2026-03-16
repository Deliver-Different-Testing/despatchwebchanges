namespace DespatchWeb.Models.Response;

public sealed record AwsUploadResult
{
    public bool Success { get; init; }
    public string FileName { get; init; }
    public string S3Key { get; init; }
    public string ContentType { get; init; }
    public long Size { get; init; }
    public DateTime UploadDate { get; init; }
    public bool IsPod { get; init; }
    public string PodDescription { get; init; }
    public string ErrorMessage { get; init; }
}

public sealed record AwsFileDownloadResult
{
    public bool Success { get; init; }
    public byte[] FileBytes { get; init; }
    public string ContentType { get; init; }
    public string FileName { get; init; }
    public string ErrorMessage { get; init; }
}

public sealed record AwsBatchOperationResult
{
    public int TotalFiles { get; init; }
    public int SuccessfulFiles { get; init; }
    public int FailedFiles { get; init; }
    public bool IsSuccess => FailedFiles == 0;
    public IReadOnlyList<string> ErrorMessages { get; init; } = [];
}
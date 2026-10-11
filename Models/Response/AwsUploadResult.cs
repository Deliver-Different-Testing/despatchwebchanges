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

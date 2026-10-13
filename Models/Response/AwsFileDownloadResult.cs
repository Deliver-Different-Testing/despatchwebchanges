namespace DespatchWeb.Models.Response;

public sealed record AwsFileDownloadResult
{
    public bool Success { get; init; }
    public byte[] FileBytes { get; init; }
    public string ContentType { get; init; }
    public string FileName { get; init; }
    public string ErrorMessage { get; init; }
}

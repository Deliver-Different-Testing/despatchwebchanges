namespace DespatchWeb.Models;

public readonly record struct S3PhotoInfo
{
    public string S3Key { get; init; }
    public string FileName { get; init; }
    public string ContentType { get; init; }
    public string Data { get; init; } // Only populated for images
    public DateTime? LastModified { get; init; }
    public long? Size { get; init; }
}

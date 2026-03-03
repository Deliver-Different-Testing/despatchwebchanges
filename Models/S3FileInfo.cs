using System;

namespace DespatchWeb.Models;

public class S3FileInfo
{
    public string S3Key { get; init; }
    public string FileName { get; init; }
    public DateTime? LastModified { get; init; }
    public long? Size { get; init; }
}
using System;

namespace DespatchWeb.Models;

public class S3PhotoInfo
{
    public string S3Key { get; set; }
    public string FileName { get; set; }
    public string ContentType { get; set; }
    public string Data { get; set; } // Only populated for images
    public DateTime? LastModified { get; set; }
    public long? Size { get; set; }
    public bool IsImage => ContentType?.StartsWith("image/") == true;
}
using System;

namespace DespatchWeb.Models;

public class S3FileInfo
{
    public string S3Key { get; set; }
    public string FileName { get; set; }
    public DateTime LastModified { get; set; }
    public long Size { get; set; }
}
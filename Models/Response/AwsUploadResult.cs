using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class AwsUploadResult
{
    public bool Success { get; set; }
    public string FileName { get; set; }
    public string S3Key { get; set; }
    public string ContentType { get; set; }
    public long Size { get; set; }
    public DateTime UploadDate { get; set; }
    public bool IsPod { get; set; }
    public string PodDescription { get; set; }
    public string ErrorMessage { get; set; }
}

public class AwsFileDownloadResult
{
    public bool Success { get; set; }
    public byte[] FileBytes { get; set; }
    public string ContentType { get; set; }
    public string FileName { get; set; }
    public string ErrorMessage { get; set; }
}

public class AwsBatchOperationResult
{
    public int TotalFiles { get; set; }
    public int SuccessfulFiles { get; set; }
    public int FailedFiles { get; set; }
    public bool IsSuccess => FailedFiles == 0;
    public List<string> ErrorMessages { get; set; } = [];
}
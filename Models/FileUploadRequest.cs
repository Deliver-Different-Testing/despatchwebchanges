using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Models;

public sealed class FileUploadRequest
{
    [FromForm(Name = "jobId")] public int JobId { get; init; }

    [FromForm(Name = "file")] public IFormFile File { get; init; }
}
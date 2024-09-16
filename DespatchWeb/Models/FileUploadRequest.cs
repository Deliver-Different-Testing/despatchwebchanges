using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Models;

public class FileUploadRequest
{
    [FromForm(Name = "jobId")] public int JobId { get; set; }

    [FromForm(Name = "file")] public IFormFile File { get; set; }
}
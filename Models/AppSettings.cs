using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class AppSettings
{
    [Required]
    public string Domain { get; set; } = string.Empty;

    [Required]
    public string RedisConfig { get; set; } = string.Empty;

    public string PublicPath { get; set; } = string.Empty;

    [Required]
    public string HubUrl { get; set; } = string.Empty;

    public string S3BucketMars { get; set; } = string.Empty;
}

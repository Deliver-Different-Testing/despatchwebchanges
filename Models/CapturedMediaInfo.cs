namespace DespatchWeb.Models;

/// <summary>An S3 listing entry for a captured POD artefact: no bytes were read to produce it.</summary>
public sealed record CapturedMediaInfo(string Leg, string S3Key, long Size, DateTime? LastModified);

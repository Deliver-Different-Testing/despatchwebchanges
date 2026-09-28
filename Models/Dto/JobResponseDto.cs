namespace DespatchWeb.Models.Dto;

/// <summary>
/// Response from api POST /api/Jobs (BookPickupAsync). Mirrors
/// WebAPICore.Models.Response.NWJobResponse and tracks IntegrationManager's
/// JobResponseDto so DespatchWeb and IM consume the same contract. Job
/// identifiers live at the top level — there is no nested JobDetail.
/// </summary>
public sealed class JobResponseDto
{
    public int? JobId { get; set; }
    public string JobNumber { get; set; }
    public string TrackingUrl { get; set; }
    public string AlertPath { get; set; }
    public IReadOnlyList<ErrorInfoDto> Errors { get; set; }

    /// <summary>
    /// Set by the client when the api call fails outside the regular validation path
    /// (HTTP error, transport failure, deserialization issue).
    /// </summary>
    public ErrorDto Error { get; set; }
}

public sealed class ErrorInfoDto
{
    public string Property { get; set; }
    public string Message { get; set; }
}

public sealed class ErrorDto
{
    public string Message { get; set; }
}

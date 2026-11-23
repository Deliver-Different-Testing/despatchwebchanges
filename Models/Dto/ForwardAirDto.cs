#nullable enable
namespace DespatchWeb.Models.Dto;

public sealed class ForwardAirQuoteResponseDto
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public List<ForwardAirQuoteServiceDto> Services { get; init; } = [];
}

public sealed class ForwardAirQuoteServiceDto
{
    public string? ServiceCode { get; init; }
    public string? ServiceName { get; init; }
    public bool Guaranteed { get; init; }
    public string? OriginAirport { get; init; }
    public string? DestinationAirport { get; init; }
    public DateTime ShipDate { get; init; }
    public string? OriginTimeZone { get; init; }
    public DateTime? EstimatedArrival { get; init; }
    public string? DestinationTimeZone { get; init; }
    public decimal? QuotedTotal { get; init; }
    public string? QuoteId { get; init; }
}

public sealed class ForwardAirJobDto
{
    public int JobId { get; init; }
    public string? Status { get; init; }
    public string? ServiceLevel { get; init; }
    public string? AirbillNumber { get; init; }
    public string? OriginAirportCode { get; init; }
    public string? DestinationAirportCode { get; init; }
    public decimal? QuotedTotal { get; init; }
    public string? Remarks { get; init; }
    public string? LastStatusCode { get; init; }
    public string? LastStatusDescription { get; init; }
    public DateTime? LastStatusAtUtc { get; init; }
    public DateTime? EtaLocal { get; init; }
    public DateTime? DeliveryWindowFromLocal { get; init; }
    public DateTime? DeliveryWindowToLocal { get; init; }
    public bool DeliveryDocumentAvailable { get; init; }
    public string? LastError { get; init; }
    public DateTime? BookedAtUtc { get; init; }
}

public sealed record ForwardAirDocument(Stream Content, string ContentType, string? FileName);

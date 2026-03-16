namespace DespatchWeb.Models.Dto;

public sealed record WebhookEventDto
{
    public string EventCode { get; init; }
    public int? AdditionalParameter { get; init; }
}
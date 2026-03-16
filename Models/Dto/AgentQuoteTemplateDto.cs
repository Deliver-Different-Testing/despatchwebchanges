namespace DespatchWeb.Models.Dto;

public sealed class AgentQuoteTemplateDto
{
    public string DeliveryAddressLine5 { get; init; }
    public string JobNo { get; init; }
    public string ReferenceA { get; init; }
    public string ReferenceB { get; init; }
    public DateTime JobDate { get; init; }
    public string SuburbFrom { get; init; }
    public string ToAddress { get; init; }
    public string SuburbTo { get; init; }
    public string PodName { get; init; }
    public DateTime? CompletedTime { get; init; }
    public string CompletedTimeFormatted { get; set; }
}

using System;

namespace DespatchWeb.Models.Dto;

public class AgentQuoteTemplateDto
{
    public string DeliveryAddressLine5 { get; set; }
    public string JobNo { get; set; }
    public string ReferenceA { get; set; }
    public string ReferenceB { get; set; }
    public DateTime JobDate { get; set; }
    public string SuburbFrom { get; set; }
    public string ToAddress { get; set; }
    public string SuburbTo { get; set; }
    public string PodName { get; set; }
    public DateTime CompletedTime { get; set; }
}

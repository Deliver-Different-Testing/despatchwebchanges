namespace DespatchWeb.Models.Dto;

public class AgentDto
{
    public int AgentId { get; init; }
    public string AgentName { get; init; }
    public string AgentRanking { get; init; }
    public int? DistanceRateId { get; init; }
    public string AgentNotes { get; set; }
}

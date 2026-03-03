using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models.Dto;

public class MessageParticipant
{
    public int Id { get; init; }
    public OtherMessagePartyType Type { get; init; }
    public string Name { get; init; }
    public string Initials { get; init; }
    public string Status { get; init; }
}
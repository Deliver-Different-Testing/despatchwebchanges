using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models.Dto;

public class MessageParticipant
{
    public int Id { get; set; }
    public OtherMessagePartyType Type { get; set; }
    public string Name { get; set; }
    public string Initials { get; set; }
    public string Status { get; set; }
}
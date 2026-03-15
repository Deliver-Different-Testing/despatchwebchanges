using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models;

public class MessageContactOptionViewModel
{
    public Guid Id { get; init; }
    public int RecordId { get; init; }
    public string Name { get; init; }
    public OtherMessagePartyType OtherMessagePartyType { get; init; }
    public string Status { get; init; }
}
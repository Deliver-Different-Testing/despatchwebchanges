using System;
using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models;

public class MessageContactOptionViewModel
{
    public Guid Id { get; set; }
    public int RecordId { get; set; }
    public string Name { get; set; }
    public OtherMessagePartyType OtherMessagePartyType { get; set; }
    public string Status { get; set; }
}
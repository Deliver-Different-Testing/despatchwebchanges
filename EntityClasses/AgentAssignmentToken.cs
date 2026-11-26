#nullable disable
using System;

namespace DespatchWeb.EntityClasses;

public partial class AgentAssignmentToken
{
    public int AgentAssignmentTokenId { get; set; }

    public byte[] TokenHash { get; set; }

    public int JobId { get; set; }

    public int AgentId { get; set; }

    public DateTime CreatedUtc { get; set; }

    public DateTime ExpiresUtc { get; set; }

    public DateTime? RevokedUtc { get; set; }
}

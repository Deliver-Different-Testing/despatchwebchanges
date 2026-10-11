namespace DespatchWeb.Models.Dto;

public sealed record EventAuditDto
{
    public string ChangeType { get; init; }
    public string ColumnName { get; init; }
    public string StaffFirstName { get; init; }
    public string StaffLastName { get; init; }
    public DateTime ChangedAt { get; init; }
}

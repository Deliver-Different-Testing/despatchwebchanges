namespace DespatchWeb.Models;

public class ClientViewModel
{
    public string FirstName { get; init; }
    public string FullName { get; init; }
    public string Email { get; init; }
    public bool Active { get; init; }
    public bool Internal { get; init; }
    public int? StaffID { get; init; }
}
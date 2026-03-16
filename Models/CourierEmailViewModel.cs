namespace DespatchWeb.Models;

public sealed class CourierEmailViewModel
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string Name { get; init; }
    public string Email { get; init; }
    public string Phone { get; init; }
    public string Fleet { get; init; }
}
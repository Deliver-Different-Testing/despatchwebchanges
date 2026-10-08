namespace DespatchWeb.Models.Response;

public readonly record struct Summary
{
    public float Duration { get; init; }
    public float Length { get; init; }
}

namespace DespatchWeb.Models;

/// <summary>
/// A single saved dispatch layout for the current staff member and page.
/// LayoutJson is treated as an opaque blob (the client's per-layout payload).
/// </summary>
public sealed class DispatchLayoutDto
{
    public string Name { get; init; }

    public string LayoutJson { get; init; }

    public bool IsActive { get; init; }
}

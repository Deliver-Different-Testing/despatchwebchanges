using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IDispatchLayoutRepository
{
    /// <summary>
    /// Returns the current staff member's saved layouts for the given page.
    /// </summary>
    Task<IReadOnlyList<DispatchLayoutDto>> GetLayoutsAsync(string page);

    /// <summary>
    /// Replaces the current staff member's layouts for the given page: upserts
    /// each supplied layout (by name) and deletes any stored layout not present
    /// in the list. At most one layout is marked active.
    /// </summary>
    Task ReplaceLayoutsAsync(string page, IReadOnlyList<DispatchLayoutDto> layouts);
}

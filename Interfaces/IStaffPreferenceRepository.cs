#nullable enable
namespace DespatchWeb.Interfaces;

public interface IStaffPreferenceRepository
{
    /// <summary>
    /// Returns the current staff member's stored JSON for the given preference
    /// key, or null when nothing has been saved yet.
    /// </summary>
    Task<string?> GetPreferenceAsync(string key);

    /// <summary>
    /// Upserts the current staff member's JSON payload for the given
    /// preference key.
    /// </summary>
    Task SetPreferenceAsync(string key, string preferenceJson);

    /// <summary>
    /// Removes the current staff member's stored value for the given
    /// preference key, if any. Used to reset a preference back to whatever
    /// default applies when nothing is stored.
    /// </summary>
    Task DeletePreferenceAsync(string key);
}

namespace DespatchWeb.Interfaces;

/// <summary>
/// Per-staff preferences, keyed by name. The staff member is always the signed-in
/// one, resolved server-side from <see cref="ITenantInfoService.GetStaffId"/> — no
/// caller supplies a user id, so no caller can read or write someone else's.
/// </summary>
public interface IUserPreferenceRepository
{
    /// <summary>The stored JSON for this preference, or null when the user has never saved one.</summary>
    Task<string> GetAsync(string preferenceKey);

    /// <summary>Creates or replaces this user's row for the given key.</summary>
    Task SaveAsync(string preferenceKey, string preferenceJson);
}

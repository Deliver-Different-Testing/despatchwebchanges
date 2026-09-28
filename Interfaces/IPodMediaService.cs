#nullable enable

using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Resolves a job's POD media across its whole family, because the courier device writes signatures
/// and photos against the leg it completed rather than the parent the client holds.
/// </summary>
public interface IPodMediaService
{
    /// <param name="jobId">The job the caller asked about.</param>
    /// <param name="year">Fallback year for a leg that carries no timestamp of its own. 0 to skip.</param>
    /// <param name="month">Fallback month for a leg that carries no timestamp of its own.</param>
    Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryMediaAsync(int jobId, int year, int month);

    /// <inheritdoc cref="GetDeliveryMediaAsync"/>
    Task<IReadOnlyList<S3PhotoInfo>> GetPickupMediaAsync(int jobId, int year, int month);
}

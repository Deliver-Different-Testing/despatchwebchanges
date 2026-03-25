using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for creating jobs via the Excelerator flow.
/// Replaces the stored procedure DD_stpJob_InsertExcelerator with C# implementation.
/// </summary>
public interface ICreateJobService
{
    /// <summary>
    /// Creates a job by resolving input values, applying client defaults,
    /// validating data, and inserting the job via raw SQL.
    /// </summary>
    Task<CreateMinimalTucJobResponse> CreateJobAsync(
        CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Inserts a TucJob via raw SQL to bypass EF Core's PropagateResults which
    /// breaks on tucJob due to INSERT triggers producing extra result sets.
    /// Accepts an existing context so callers can participate in their own transaction.
    /// </summary>
    Task<int> InsertJobRawAsync(DespatchContext context, TucJob job, CancellationToken ct);
}
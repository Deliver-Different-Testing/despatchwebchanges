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
    /// validating data, and delegating to the appropriate insert path
    /// (normal or bulk schedule).
    /// </summary>
    Task<CreateMinimalTucJobResponse> CreateJobAsync(
        CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default);
}
namespace DespatchWeb.Interfaces;

public sealed record JobLabel(byte[] Pdf, string FileName);

public interface IJobLabelService
{
    /// <summary>
    /// Renders the delivery label for a job, or for a bulk row when <paramref name="isBulk"/> is set
    /// (its id is then a BulkJobId). A linehaul or flight job prints its DEL leg's label.
    /// </summary>
    /// <returns>The label, or null when the job doesn't exist or is outside the caller's scope.</returns>
    /// <exception cref="Exceptions.JobLabelException">The job has no label we can print here, or its DEL leg isn't found.</exception>
    Task<JobLabel?> GetLabelAsync(int jobId, bool isBulk, CancellationToken ct = default);
}

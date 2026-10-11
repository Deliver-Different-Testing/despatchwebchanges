using DespatchWeb.Helpers;

namespace DespatchWeb.Models.Response;

/// <summary>One row of the per-bucket tally the database groups into.</summary>
public sealed record JobListBucketTally(JobListBucket Bucket, int Count);

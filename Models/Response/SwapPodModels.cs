namespace DespatchWeb.Models.Response;

public sealed record SwapPodResult(int MovedPhotos, int FailedPhotos);

public sealed record SwapPodJob(int JobId, string Number, bool IsDone, DateTime? CompletedTime);

public sealed record SwapPodCandidate(
    int JobId,
    string Number,
    int? StatusId,
    string StatusName,
    string Customer,
    string FromSuburb,
    string ToSuburb,
    string Courier,
    DateTime Date,
    bool HasPod);

/// <summary>One delivery photo/signature copied to its new job-id key; the source is deleted only after the DB commit.</summary>
public sealed record DeliveryMediaCopy(string SourceKey, string CopyKey);

public sealed record DeliveryMediaCopyResult(IReadOnlyList<DeliveryMediaCopy> Copied, int Failed);

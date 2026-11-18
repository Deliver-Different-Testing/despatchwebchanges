using System.Text.RegularExpressions;

namespace DespatchWeb.Helpers;

/// <summary>
/// Reads the job id out of an S3 media key. Every job photo, signature, scanned document and attachment is stored as
/// <c>{Folder}/{yyyy}/{MM}/{jobId}-{stamp}</c> (legacy attachments are flat: <c>JobAttachments/{jobId}-{stamp}</c>, and
/// archived media sits under <c>RestoredArchive/</c> with the original key), so the last path segment starts with the job id.
/// The key is also the only thing the by-id media endpoints are given, so it is validated before the job id is trusted:
/// the folder must be one of ours, and the key must not carry a backslash (S3 keeps it literally, so the parsed id could
/// differ from the object's real owner), a <c>..</c> segment, an empty segment or a leading slash.
/// </summary>
public static partial class JobMediaKey
{
    private const string ArchivePrefix = "RestoredArchive";

    /// <summary>Every folder JobPhotoService writes to or reads from (see GetFoldersByPhotoType, GetUploadFolder, attachments).</summary>
    private static readonly HashSet<string> KnownFolders = new(StringComparer.Ordinal)
    {
        "DeliverySignatures", "DeliveryPhotos", "DeliveryScannedDocuments",
        "PickupScannedDocuments", "PickupPhotos", "PickupSignatures",
        "JobAttachments"
    };

    [GeneratedRegex(@"^(\d+)-", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
    private static partial Regex LeadingJobId();

    /// <summary>
    /// Structure only: a non-empty key with no backslash, no control characters, no leading slash and no empty or
    /// <c>.</c>/<c>..</c> segments. No genuine media key breaks these rules, so this is safe to enforce for every caller.
    /// </summary>
    public static bool IsStructurallySafe(string? key)
    {
        if (string.IsNullOrWhiteSpace(key) || key != key.Trim() || key.Contains('\\') || key.StartsWith('/'))
        {
            return false;
        }

        foreach (var c in key)
        {
            if (char.IsControl(c))
            {
                return false;
            }
        }

        foreach (var segment in key.Split('/'))
        {
            if (segment.Length == 0 || segment is "." or "..")
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>A structurally safe key under one of our media folders (optionally archived under <c>RestoredArchive/</c>).</summary>
    public static bool IsKnownLayout(string? key)
    {
        if (!IsStructurallySafe(key))
        {
            return false;
        }

        var segments = key!.Split('/');
        var folderIndex = segments[0] == ArchivePrefix ? 1 : 0;

        // A folder and at least the file name must follow the optional archive prefix.
        return segments.Length >= folderIndex + 2 && KnownFolders.Contains(segments[folderIndex]);
    }

    public static bool TryGetJobId(string? key, out int jobId)
    {
        jobId = 0;
        if (!IsKnownLayout(key))
        {
            return false;
        }

        var segment = key!.Split('/')[^1];
        var match = LeadingJobId().Match(segment);
        return match.Success && int.TryParse(match.Groups[1].Value, out jobId) && jobId > 0;
    }
}

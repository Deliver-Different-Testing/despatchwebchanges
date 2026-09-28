namespace DespatchWeb.Exceptions;

/// <summary>
/// The paid courier on an archived job can no longer be changed (already invoiced,
/// already settled, job/courier not found).
/// </summary>
/// <remarks>
/// Like <see cref="JobNotFoundException"/>, the messages on this type are written by us and
/// carry no exception text or schema detail, so the controller returns them verbatim instead
/// of the sanitised generic string.
/// </remarks>
public class ArchivedCourierChangeException(string message) : Exception(message);

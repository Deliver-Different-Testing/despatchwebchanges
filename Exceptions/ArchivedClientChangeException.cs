namespace DespatchWeb.Exceptions;

/// <summary>
/// An archived job can't be moved to another client (it has been invoiced).
/// </summary>
/// <remarks>
/// Like <see cref="ArchivedCourierChangeException"/>, the messages on this type are written by us and
/// carry no exception text or schema detail, so the controller returns them verbatim instead of the
/// sanitised generic string.
/// </remarks>
public class ArchivedClientChangeException(string message) : Exception(message);

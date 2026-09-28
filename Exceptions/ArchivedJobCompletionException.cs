namespace DespatchWeb.Exceptions;

/// <summary>
/// An edit would have un-completed an archived job.
/// </summary>
/// <remarks>
/// Restore only operates on live (tucJob) rows, so an archived job has no way back once its done
/// flag, status and completion time disagree. Like <see cref="JobNotFoundException"/>, the messages
/// on this type are written by us and carry no exception text or schema detail, so the controller
/// returns them verbatim instead of the sanitised generic string.
/// </remarks>
public class ArchivedJobCompletionException(string message) : Exception(message);

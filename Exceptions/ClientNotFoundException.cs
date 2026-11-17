namespace DespatchWeb.Exceptions;

/// <summary>
/// A client we were asked to assign to a job is not one the caller can see (it does not exist, or it belongs to a branch
/// outside a branch-limited user's scope).
/// </summary>
/// <remarks>The message is written by us and carries no exception text or schema names, so it can be shown verbatim.</remarks>
public class ClientNotFoundException(string message) : Exception(message);

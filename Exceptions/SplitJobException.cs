namespace DespatchWeb.Exceptions;

/// <summary>
/// A split that failed for a reason we recognise and have authored a message for.
/// </summary>
/// <remarks>
/// Every other exception is sanitised to a generic string before it leaves the controller
/// (<see cref="Helpers.ErrorMessageStringFormatter.Format"/>), which leaves staging and production
/// failures undiagnosable without server logs. Messages on this type are written by us and carry no
/// exception text, connection details, or schema names, so the controller returns them verbatim.
/// </remarks>
public class SplitJobException(string message) : Exception(message);

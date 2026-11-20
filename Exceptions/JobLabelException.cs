namespace DespatchWeb.Exceptions;

/// <summary>
/// A label that can't be printed for a reason we recognise and have authored a message for.
/// </summary>
/// <remarks>
/// Messages on this type carry no exception text or schema names, so the controller returns them
/// verbatim instead of the sanitised generic error.
/// </remarks>
public class JobLabelException(string message) : Exception(message);

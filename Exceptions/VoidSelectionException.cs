namespace DespatchWeb.Exceptions;

/// <summary>
/// A void whose selected jobs are not all part of the target job's booking.
/// </summary>
/// <remarks>
/// Messages on this type carry no exception text or schema names, so the controller returns them
/// verbatim instead of the sanitised generic error.
/// </remarks>
public class VoidSelectionException(string message) : Exception(message);

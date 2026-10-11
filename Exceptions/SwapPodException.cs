namespace DespatchWeb.Exceptions;

/// <summary>
/// A POD swap that was refused for a reason we recognise and have authored a message for.
/// </summary>
/// <remarks>
/// Messages on this type carry no exception text or schema names, so the controller returns them
/// verbatim instead of the sanitised generic error.
/// </remarks>
public class SwapPodException(string message) : Exception(message);

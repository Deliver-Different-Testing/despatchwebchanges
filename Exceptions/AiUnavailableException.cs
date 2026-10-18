namespace DespatchWeb.Exceptions;

/// <summary>The AI call timed out or was refused up front because the AI service is failing.</summary>
public sealed class AiUnavailableException(string message) : Exception(message);

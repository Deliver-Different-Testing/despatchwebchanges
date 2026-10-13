#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>One overlay document offered in the job export menu.</summary>
/// <param name="DocumentType">The document type key passed back to the render endpoint.</param>
/// <param name="DisplayName">Human-readable label for the menu item.</param>
/// <param name="Available">True when a template resolves for this job's client; false renders the item disabled.</param>
public sealed record OverlayDocument(string DocumentType, string DisplayName, bool Available);

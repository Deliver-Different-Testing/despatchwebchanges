using System.Runtime.CompilerServices;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Registers the PdfSharp licence for tests that build PDFs without going through Program.cs.
/// </summary>
internal static class PdfSharpLicenseInitializer
{
    [ModuleInitializer]
    internal static void Register() => PdfSharp.PdfSharpLicense.SetAgplLicense();
}

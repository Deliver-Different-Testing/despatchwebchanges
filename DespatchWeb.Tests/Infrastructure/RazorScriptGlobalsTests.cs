using System.Text.RegularExpressions;

namespace DespatchWeb.Tests.Infrastructure;

/// <summary>
/// Guards the contract between the Razor-rendered script globals in Index.cshtml and
/// the TypeScript declarations in wwwroot/types/global.d.ts.
///
/// The globals are the only channel carrying session context into AngularJS and React —
/// there is no settings endpoint or context provider. A boolean interpolated inside
/// quotes reaches the browser as the string "False", which is truthy, so every
/// <c>?? false</c> and every <c>if (flag)</c> downstream silently reads the wrong way.
/// </summary>
public class RazorScriptGlobalsTests
{
    private static readonly string SolutionRoot = FindSolutionRoot();

    private static readonly string[] IndexViewLines =
        File.ReadAllLines(Path.Combine(SolutionRoot, "Views", "Home", "Index.cshtml"));

    [Theory]
    [InlineData("ClientInternal")]
    [InlineData("IsNetworkPartner")]
    public void IndexView_EmitsBooleanGlobal_AsUnquotedJson(string globalName)
    {
        // Arrange
        var assignment = FindGlobalAssignment(globalName);

        // Act
        var value = assignment.Trim();

        // Assert — a quoted value makes the global the string "True"/"False" in the
        // browser. "False" is truthy, so the flag reads as enabled for every user.
        Assert.False(value.StartsWith('\'') || value.StartsWith('"'),
            $"'{globalName}' is a boolean but is emitted as a quoted string ({value}). " +
            "The browser receives \"False\", which is truthy, so every downstream check " +
            "silently passes. Emit it with @Json.Serialize(...) instead.");

        Assert.Contains("Json.Serialize", value, StringComparison.Ordinal);
    }

    [Fact]
    public void IndexView_StillEmitsStringGlobals_AsQuoted()
    {
        // The quoting itself is not the defect — these are genuinely strings and must
        // stay quoted, so the fix above must not be applied blanket-wise.
        foreach (var name in new[] { "ContactID", "FirstName", "FullName", "Dispatcher", "TimeZone" })
        {
            var value = FindGlobalAssignment(name).Trim();
            Assert.StartsWith("'", value, StringComparison.Ordinal);
        }
    }

    /// <summary>Returns the right-hand side of <c>var {name} = ...;</c> in the view.</summary>
    private static string FindGlobalAssignment(string globalName)
    {
        var pattern = new Regex($@"^\s*var\s+{Regex.Escape(globalName)}\s*=\s*(?<value>.+);\s*$");

        foreach (var line in IndexViewLines)
        {
            var match = pattern.Match(line);
            if (match.Success) return match.Groups["value"].Value;
        }

        throw new InvalidOperationException(
            $"Index.cshtml no longer declares the '{globalName}' script global. " +
            "If it was renamed or removed, update wwwroot/types/global.d.ts and this test together.");
    }

    private static string FindSolutionRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Dockerfile"))) dir = dir.Parent;

        return dir?.FullName ?? throw new InvalidOperationException(
            "Could not find solution root (directory containing Dockerfile)");
    }
}

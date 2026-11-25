using System.Globalization;

namespace DespatchWeb.Helpers;

/// <summary>
/// The job note written when a dispatcher edits a job's packages, naming each package for what it is
/// ("2 × Banana box 53 x 39 x 24 cm, 8 kg") so it isn't left to a stale booking note to describe them.
/// </summary>
public static class PackageChangeNote
{
    public const int MaxLength = 2000;

    /// <summary>One package line: <paramref name="Width"/> is the item row's Depth column.</summary>
    public readonly record struct Line(string? Name, double? Length, double? Width, double? Height, double? Weight,
        int Items);

    /// <summary>The note for a change from <paramref name="before"/> to <paramref name="after"/>, or null when the
    /// packages are the same (ignoring line order).</summary>
    public static string? Build(IEnumerable<Line> before, IEnumerable<Line> after, bool isUs)
    {
        var from = Describe(before, isUs);
        var to = Describe(after, isUs);
        if (SameGroups(from, to)) return null;

        var note = (from.Count, to.Count) switch
        {
            (0, _) => $"Packages updated to {Join(to)}",
            (_, 0) => $"Packages removed (were {Join(from)})",
            _ => $"Packages updated from {Join(from)} to {Join(to)}"
        };
        return note.Length <= MaxLength ? note : note[..(MaxLength - 1)] + "…";
    }

    private static string Join(List<(string Key, int Qty)> groups) =>
        string.Join("; ", groups.Select(g => $"{g.Qty} × {g.Key}"));

    private static bool SameGroups(List<(string Key, int Qty)> a, List<(string Key, int Qty)> b) =>
        a.Count == b.Count && !a.Select(g => (g.Key.ToUpperInvariant(), g.Qty))
            .Except(b.Select(g => (g.Key.ToUpperInvariant(), g.Qty))).Any();

    private static List<(string Key, int Qty)> Describe(IEnumerable<Line> lines, bool isUs)
    {
        var groups = new List<(string Key, int Qty)>();
        foreach (var line in lines)
        {
            var key = Describe(line, isUs);
            var index = groups.FindIndex(g => string.Equals(g.Key, key, StringComparison.OrdinalIgnoreCase));
            var qty = Math.Max(line.Items, 1);
            if (index < 0) groups.Add((key, qty));
            else groups[index] = (groups[index].Key, groups[index].Qty + qty);
        }

        return groups;
    }

    private static string Describe(Line line, bool isUs)
    {
        var name = string.IsNullOrWhiteSpace(line.Name) ? "Item" : string.Join(' ',
            line.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        var text = name;
        if ((line.Length ?? 0) > 0 || (line.Width ?? 0) > 0 || (line.Height ?? 0) > 0)
            text += $" {Num(line.Length)} x {Num(line.Width)} x {Num(line.Height)} {(isUs ? "in" : "cm")}";
        if ((line.Weight ?? 0) > 0)
            text += $", {Num(line.Weight)} {(isUs ? "lb" : "kg")}";
        return text;
    }

    private static string Num(double? value) => (value ?? 0).ToString("0.##", CultureInfo.InvariantCulture);
}

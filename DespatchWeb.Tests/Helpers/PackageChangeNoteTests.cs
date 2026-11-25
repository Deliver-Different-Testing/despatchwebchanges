using DespatchWeb.Helpers;
using Line = DespatchWeb.Helpers.PackageChangeNote.Line;

namespace DespatchWeb.Tests.Helpers;

public class PackageChangeNoteTests
{
    private static Line Box(string? name = "Banana box", double l = 53, double w = 39, double h = 24, double kg = 8,
        int items = 1) => new(name, l, w, h, kg, items);

    [Fact]
    public void Build_NamesOldAndNewPackagesWithTheirDimensions()
    {
        var note = PackageChangeNote.Build([Box("Pallet"), Box("Pallet")], [Box(), Box()], isUs: true);

        Assert.Equal(
            "Packages updated from 2 × Pallet 53 x 39 x 24 in, 8 lb to 2 × Banana box 53 x 39 x 24 in, 8 lb",
            note);
    }

    [Fact]
    public void Build_UsesMetricUnitsOutsideTheUs()
    {
        var note = PackageChangeNote.Build([], [Box(l: 40.5, kg: 12.25)], isUs: false);

        Assert.Equal("Packages updated to 1 × Banana box 40.5 x 39 x 24 cm, 12.25 kg", note);
    }

    [Fact]
    public void Build_SameLinesInAnotherOrder_IsNotAChange()
    {
        Assert.Null(PackageChangeNote.Build([Box("A"), Box("B")], [Box("B"), Box("A")], isUs: false));
    }

    [Fact]
    public void Build_GroupsIdenticalLinesAndCountsItemsPerLine()
    {
        var note = PackageChangeNote.Build([], [Box(items: 3), Box("Pallet", 120, 100, 90, 250), Box()], isUs: false);

        Assert.Equal(
            "Packages updated to 4 × Banana box 53 x 39 x 24 cm, 8 kg; 1 × Pallet 120 x 100 x 90 cm, 250 kg",
            note);
    }

    [Fact]
    public void Build_TreatsNameCaseAndSpacingAsTheSamePackage()
    {
        Assert.Null(PackageChangeNote.Build([Box(" banana BOX ")], [Box("Banana box")], isUs: false));
    }

    [Fact]
    public void Build_UnnamedLineWithoutDimensionsOrWeight_IsAnItem()
    {
        var note = PackageChangeNote.Build([], [new Line(null, 0, 0, 0, null, 2)], isUs: false);

        Assert.Equal("Packages updated to 2 × Item", note);
    }

    [Fact]
    public void Build_WeightWithoutDimensions_SkipsTheDimensions()
    {
        var note = PackageChangeNote.Build([], [new Line("Satchel", null, null, null, 2, 1)], isUs: false);

        Assert.Equal("Packages updated to 1 × Satchel, 2 kg", note);
    }

    [Fact]
    public void Build_AllPackagesRemoved_SaysWhatTheyWere()
    {
        Assert.Equal("Packages removed (were 1 × Banana box 53 x 39 x 24 cm, 8 kg)",
            PackageChangeNote.Build([Box()], [], isUs: false));
    }

    [Fact]
    public void Build_NothingBeforeOrAfter_IsNotAChange()
    {
        Assert.Null(PackageChangeNote.Build([], [], isUs: false));
    }

    [Fact]
    public void Build_VeryLongChange_IsCapped()
    {
        var many = Enumerable.Range(0, 400).Select(i => Box($"Box {i}")).ToList();

        var note = PackageChangeNote.Build([], many, isUs: false)!;

        Assert.True(note.Length <= PackageChangeNote.MaxLength);
        Assert.EndsWith("…", note);
    }
}

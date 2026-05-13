using static DespatchWeb.Helpers.AddressFormatter;

namespace DespatchWeb.Tests.Helpers;

public class AddressFormatterFormatWithCityStateZipTests
{
    [Fact]
    public void NullAddress_ReturnsEmptyString()
    {
        var result = FormatWithCityStateZip(null);

        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void AllEmptyLines_ReturnsEmptyString()
    {
        var address = new Address();

        var result = FormatWithCityStateZip(address);

        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void SingleLine_ReturnsLine()
    {
        var address = new Address(line1: "123 Main St");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St", result);
    }

    [Fact]
    public void MultipleLines_JoinsWithComma()
    {
        var address = new Address(line1: "123 Main St", line2: "Suite 100", line3: "Building A");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St, Suite 100, Building A", result);
    }

    [Fact]
    public void WithCityOnly_AppendsCityToLines()
    {
        var address = new Address(line1: "123 Main St", line6: "Denver");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St, Denver", result);
    }

    [Fact]
    public void WithCityAndState_FormatsCityCommaState()
    {
        var address = new Address(line1: "123 Main St", line6: "Denver", line7: "CO");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St, Denver, CO", result);
    }

    [Fact]
    public void WithCityStateAndZip_FormatsCityCommaStateSpaceZip()
    {
        var address = new Address(line1: "123 Main St", line6: "Denver", line7: "CO", line8: "80202");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St, Denver, CO 80202", result);
    }

    [Fact]
    public void LinesWithWhitespace_AreTrimmed()
    {
        var address = new Address(line1: "  123 Main St  ", line6: "  Denver  ", line7: "  CO  ", line8: "  80202  ");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St, Denver, CO 80202", result);
    }

    [Fact]
    public void SparseLines_SkipsEmptyLines()
    {
        var address = new Address(line2: "Suite 200", line4: "Floor 5");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("Suite 200, Floor 5", result);
    }

    [Fact]
    public void FullAddress_CombinesAllParts()
    {
        var address = new Address(
            line1: "123 Main St",
            line2: "Suite 100",
            line3: "Building A",
            line4: "Floor 3",
            line5: "Attn: John",
            line6: "Denver",
            line7: "CO",
            line8: "80202");

        var result = FormatWithCityStateZip(address);

        Assert.Equal("123 Main St, Suite 100, Building A, Floor 3, Attn: John, Denver, CO 80202", result);
    }
}

public class AddressFormatterGetSafeAddressTests
{
    private const string DefaultAddress = "N/A";

    [Fact]
    public void NullAddress_ReturnsDefault()
    {
        var result = GetSafeAddress(null, DefaultAddress);

        Assert.Equal(DefaultAddress, result);
    }

    [Fact]
    public void EmptyString_ReturnsDefault()
    {
        var result = GetSafeAddress("", DefaultAddress);

        Assert.Equal(DefaultAddress, result);
    }

    [Fact]
    public void ShortAddress_ReturnsAsIs()
    {
        var result = GetSafeAddress("123 Main St", DefaultAddress);

        Assert.Equal("123 Main St", result);
    }

    [Fact]
    public void Exactly150Characters_ReturnsAsIs()
    {
        var address = new string('A', 150);

        var result = GetSafeAddress(address, DefaultAddress);

        Assert.Equal(150, result.Length);
        Assert.Equal(address, result);
    }

    [Fact]
    public void Over150Characters_TruncatesTo150()
    {
        var address = new string('A', 200);

        var result = GetSafeAddress(address, DefaultAddress);

        Assert.Equal(150, result.Length);
    }
}

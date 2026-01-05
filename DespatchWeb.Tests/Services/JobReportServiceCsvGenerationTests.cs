using System.Globalization;
using FluentAssertions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for CSV formatting utilities used in JobReportService.
/// These tests verify the CSV escaping and formatting logic independently.
/// </summary>
public class CsvFormattingTests
{
    #region FormatCsvField Tests

    [Theory]
    [InlineData("Simple text", "Simple text")]
    [InlineData("Text, with comma", "\"Text, with comma\"")]
    [InlineData("Text with \"quotes\"", "\"Text with \"\"quotes\"\"\"")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void FormatCsvField_FormatsCorrectly(string? input, string expected)
    {
        // Test the CSV escaping logic
        var result = FormatCsvField(input);
        result.Should().Be(expected);
    }

    [Fact]
    public void FormatCsvField_WithNewline_EscapesCorrectly()
    {
        const string input = "Line1\nLine2";
        var result = FormatCsvField(input);
        result.Should().Be($"\"Line1\nLine2\"");
    }

    [Fact]
    public void FormatCsvField_WithCarriageReturn_EscapesCorrectly()
    {
        const string input = "Line1\rLine2";
        var result = FormatCsvField(input);
        result.Should().Be($"\"Line1\rLine2\"");
    }

    [Fact]
    public void FormatCsvField_WithMultipleSpecialChars_EscapesAll()
    {
        const string input = "Value, with \"quotes\" and\nnewlines";
        var result = FormatCsvField(input);
        result.Should().Be("\"Value, with \"\"quotes\"\" and\nnewlines\"");
    }

    [Fact]
    public void FormatCsvField_OnlySpaces_ReturnsUnquoted()
    {
        const string input = "   ";
        var result = FormatCsvField(input);
        result.Should().Be("   ", "spaces don't require quoting");
    }

    [Fact]
    public void FormatCsvField_LeadingTrailingSpaces_ReturnsUnquoted()
    {
        const string input = "  value  ";
        var result = FormatCsvField(input);
        result.Should().Be("  value  ", "leading/trailing spaces don't require quoting");
    }

    #endregion

    #region CSV Row Generation Tests

    [Fact]
    public void GenerateCsvRow_SimpleValues_JoinsWithComma()
    {
        var values = new[] { "A", "B", "C" };
        var result = string.Join(",", values.Select(FormatCsvField));
        result.Should().Be("A,B,C");
    }

    [Fact]
    public void GenerateCsvRow_WithSpecialValues_EscapesCorrectly()
    {
        var values = new[] { "Normal", "Has, comma", "Has \"quote\"" };
        var result = string.Join(",", values.Select(FormatCsvField));
        result.Should().Be("Normal,\"Has, comma\",\"Has \"\"quote\"\"\"");
    }

    [Fact]
    public void GenerateCsvRow_WithNullValues_TreatsAsEmpty()
    {
        var values = new[] { "A", null, "C" };
        var result = string.Join(",", values.Select(FormatCsvField));
        result.Should().Be("A,,C");
    }

    [Fact]
    public void GenerateCsvRow_AllEmpty_GeneratesCommaSeparators()
    {
        var values = new[] { "", "", "" };
        var result = string.Join(",", values.Select(FormatCsvField));
        result.Should().Be(",,");
    }

    #endregion

    #region Decimal Formatting Tests

    [Theory]
    [InlineData(100.00, "100")]
    [InlineData(100.50, "100.5")]
    [InlineData(100.123, "100.123")]
    [InlineData(0, "0")]
    [InlineData(-50.25, "-50.25")]
    public void DecimalFormatting_FormatsCorrectly(decimal value, string expected)
    {
        var result = value.ToString(CultureInfo.InvariantCulture);
        result.Should().Be(expected);
    }

    [Fact]
    public void NullableDecimalFormatting_Null_ReturnsEmpty()
    {
        decimal? value = null;
        var result = value?.ToString() ?? string.Empty;
        result.Should().Be(string.Empty);
    }

    #endregion

    #region Date Formatting Tests

    [Fact]
    public void DateTimeFormatting_StandardFormat_FormatsCorrectly()
    {
        var date = new DateTime(2024, 1, 15, 10, 30, 45);
        var result = date.ToString("yyyy-MM-dd HH:mm:ss");
        result.Should().Be("2024-01-15 10:30:45");
    }

    [Fact]
    public void NullableDateTimeFormatting_Null_ReturnsEmpty()
    {
        DateTime? date = null;
        var result = date?.ToString("yyyy-MM-dd HH:mm:ss") ?? string.Empty;
        result.Should().Be(string.Empty);
    }

    [Fact]
    public void DateTimeFormatting_Midnight_IncludesZeroTime()
    {
        var date = new DateTime(2024, 1, 15, 0, 0, 0);
        var result = date.ToString("yyyy-MM-dd HH:mm:ss");
        result.Should().Be("2024-01-15 00:00:00");
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Formats a value for CSV output, escaping special characters as needed.
    /// Matches the logic used in JobReportService.
    /// </summary>
    private static string FormatCsvField(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }

    #endregion
}

/// <summary>
/// Additional tests for validating file extension validation logic
/// used in the bulk price upload feature.
/// </summary>
public class FileExtensionValidationTests
{
    private static readonly string[] ValidExtensions = [".csv", ".xls", ".xlsx"];

    [Theory]
    [InlineData("test.csv", true)]
    [InlineData("test.CSV", true)]
    [InlineData("test.xls", true)]
    [InlineData("test.XLS", true)]
    [InlineData("test.xlsx", true)]
    [InlineData("test.XLSX", true)]
    [InlineData("file.with.dots.csv", true)]
    [InlineData("test.pdf", false)]
    [InlineData("test.txt", false)]
    [InlineData("test.doc", false)]
    [InlineData("test.json", false)]
    [InlineData("", false)]
    [InlineData("noextension", false)]
    public void IsValidExtension_ReturnsExpected(string fileName, bool expected)
    {
        var result = IsValidBulkPriceExtension(fileName);
        result.Should().Be(expected);
    }

    private static bool IsValidBulkPriceExtension(string fileName)
    {
        if (string.IsNullOrEmpty(fileName)) return false;
        var extension = Path.GetExtension(fileName);
        return ValidExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase);
    }
}

using System.Globalization;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for CSV formatting utilities used in JobReportService.
/// These tests verify the CSV escaping and formatting logic independently.
/// </summary>
public class CsvFormattingTests
{
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
        Assert.Equal(expected, result);
    }

    [Fact]
    public void FormatCsvField_WithNewline_EscapesCorrectly()
    {
        const string input = "Line1\nLine2";
        var result = FormatCsvField(input);
        Assert.Equal("\"Line1\nLine2\"", result);
    }

    [Fact]
    public void FormatCsvField_WithCarriageReturn_EscapesCorrectly()
    {
        const string input = "Line1\rLine2";
        var result = FormatCsvField(input);
        Assert.Equal("\"Line1\rLine2\"", result);
    }

    [Fact]
    public void FormatCsvField_WithMultipleSpecialChars_EscapesAll()
    {
        const string input = "Value, with \"quotes\" and\nnewlines";
        var result = FormatCsvField(input);
        Assert.Equal("\"Value, with \"\"quotes\"\" and\nnewlines\"", result);
    }

    [Fact]
    public void FormatCsvField_OnlySpaces_ReturnsUnquoted()
    {
        const string input = "   ";
        var result = FormatCsvField(input);
        Assert.Equal("   ", result);
    }

    [Fact]
    public void FormatCsvField_LeadingTrailingSpaces_ReturnsUnquoted()
    {
        const string input = "  value  ";
        var result = FormatCsvField(input);
        Assert.Equal("  value  ", result);
    }

    [Fact]
    public void GenerateCsvRow_SimpleValues_JoinsWithComma()
    {
        var values = new[] { "A", "B", "C" };
        var result = string.Join(",", values.Select(FormatCsvField));
        Assert.Equal("A,B,C", result);
    }

    [Fact]
    public void GenerateCsvRow_WithSpecialValues_EscapesCorrectly()
    {
        var values = new[] { "Normal", "Has, comma", "Has \"quote\"" };
        var result = string.Join(",", values.Select(FormatCsvField));
        Assert.Equal("Normal,\"Has, comma\",\"Has \"\"quote\"\"\"", result);
    }

    [Fact]
    public void GenerateCsvRow_WithNullValues_TreatsAsEmpty()
    {
        var values = new[] { "A", null, "C" };
        var result = string.Join(",", values.Select(FormatCsvField));
        Assert.Equal("A,,C", result);
    }

    [Fact]
    public void GenerateCsvRow_AllEmpty_GeneratesCommaSeparators()
    {
        var values = new[] { "", "", "" };
        var result = string.Join(",", values.Select(FormatCsvField));
        Assert.Equal(",,", result);
    }

    [Theory]
    [InlineData(100.00, "100")]
    [InlineData(100.50, "100.5")]
    [InlineData(100.123, "100.123")]
    [InlineData(0, "0")]
    [InlineData(-50.25, "-50.25")]
    public void DecimalFormatting_FormatsCorrectly(decimal value, string expected)
    {
        var result = value.ToString(CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void NullableDecimalFormatting_Null_ReturnsEmpty()
    {
        decimal? value = null;
        var result = value?.ToString() ?? string.Empty;
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void DateTimeFormatting_StandardFormat_FormatsCorrectly()
    {
        var date = new DateTime(2024, 1, 15, 10, 30, 45);
        var result = date.ToString("yyyy-MM-dd HH:mm:ss");
        Assert.Equal("2024-01-15 10:30:45", result);
    }

    [Fact]
    public void NullableDateTimeFormatting_Null_ReturnsEmpty()
    {
        DateTime? date = null;
        var result = date?.ToString("yyyy-MM-dd HH:mm:ss") ?? string.Empty;
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void DateTimeFormatting_Midnight_IncludesZeroTime()
    {
        var date = new DateTime(2024, 1, 15, 0, 0, 0);
        var result = date.ToString("yyyy-MM-dd HH:mm:ss");
        Assert.Equal("2024-01-15 00:00:00", result);
    }

    [Fact]
    public void DateFormatting_ClientJobsReportDateFormat_FormatsCorrectly()
    {
        // The client jobs report now uses dd-MMM-yy format for dates
        var date = new DateTime(2024, 1, 15);
        var result = date.ToString("dd-MMM-yy");
        Assert.Equal("15-Jan-24", result);
    }

    [Fact]
    public void TimeFormatting_ClientJobsReportBookedFormat_FormatsCorrectly()
    {
        // The client jobs report now uses HH:mm format for booked time
        var date = new DateTime(2024, 1, 15, 9, 30, 0);
        var result = date.ToString("HH:mm");
        Assert.Equal("09:30", result);
    }

    [Theory]
    [InlineData(2024, 1, 1, "01-Jan-24")]
    [InlineData(2024, 6, 15, "15-Jun-24")]
    [InlineData(2024, 12, 31, "31-Dec-24")]
    [InlineData(2025, 3, 5, "05-Mar-25")]
    public void DateFormatting_ClientJobsReportDateFormat_VariousDates(int year, int month, int day, string expected)
    {
        var date = new DateTime(year, month, day);
        var result = date.ToString("dd-MMM-yy");
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(0, 0, "00:00")]
    [InlineData(9, 30, "09:30")]
    [InlineData(14, 45, "14:45")]
    [InlineData(23, 59, "23:59")]
    public void TimeFormatting_ClientJobsReportBookedFormat_VariousTimes(int hour, int minute, string expected)
    {
        var date = new DateTime(2024, 1, 15, hour, minute, 0);
        var result = date.ToString("HH:mm");
        Assert.Equal(expected, result);
    }

    /// <summary>
    /// Formats a value for CSV output, escaping special characters as needed.
    /// Matches the logic used in JobReportService.
    /// </summary>
    private static string FormatCsvField(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
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
        Assert.Equal(expected, result);
    }

    private static bool IsValidBulkPriceExtension(string fileName)
    {
        if (string.IsNullOrEmpty(fileName))
        {
            return false;
        }

        var extension = Path.GetExtension(fileName);
        return ValidExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase);
    }
}
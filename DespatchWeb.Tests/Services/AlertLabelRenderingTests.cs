using System.Text;
using DeliverDifferentReporting.Documents;
using DeliverDifferentReporting.Models;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Renders through the real label renderer so the Linux CI image catches a renderer that only works on
/// Windows (DeliverDifferentReporting 2.0.56 drew Code128 with System.Drawing and threw in the container).
/// </summary>
public class AlertLabelRenderingTests
{
    [Fact]
    public void LabelWithBarcodes_RendersToPdf()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var data = new AlertLabelData
        {
            Pages =
            [
                [
                    new AlertLabelCell { CellType = 1, RowNumber = 1, ColumnNumber = 1, Value = "AB100DEL" },
                    new AlertLabelCell { CellType = 4, RowNumber = 2, ColumnNumber = 1, Value = "AB100DEL", RenderType = CellRenderType.Code128 },
                    new AlertLabelCell { CellType = 4, RowNumber = 2, ColumnNumber = 2, Value = "https://example.test/AB100", RenderType = CellRenderType.QrCode },
                ],
            ],
        };

        var pdf = new AlertLabelDocument(data).GeneratePdf();

        Assert.StartsWith("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
    }
}

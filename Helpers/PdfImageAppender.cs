#nullable enable
using PdfSharp;
using PdfSharp.Drawing;
using PdfSharp.Pdf.IO;
using Serilog;

namespace DespatchWeb.Helpers;

/// <summary>
/// Appends images (delivery photos / signatures) as extra pages onto an existing
/// PDF without rasterising the original, so a branded overlay POD keeps its
/// vector quality while gaining the S3 proof images.
/// </summary>
public static class PdfImageAppender
{
    private const double Margin = 36; // 0.5" at 72pt/inch

    /// <summary>
    /// Returns a new PDF with each image added as its own A4 page, scaled to fit
    /// within the margins while preserving aspect ratio. Returns the original
    /// bytes unchanged when there are no images, and falls back to the original
    /// document if it can't be opened for modification — a POD download is never
    /// broken by an unmergeable overlay or a single bad image.
    /// </summary>
    public static byte[] Append(byte[] pdfBytes, IReadOnlyList<byte[]> images)
    {
        if (images.Count == 0)
        {
            return pdfBytes;
        }

        try
        {
            using var input = new MemoryStream(pdfBytes);
            using var document = PdfReader.Open(input, PdfDocumentOpenMode.Modify);

            foreach (var imageBytes in images)
            {
                try
                {
                    // PdfSharp's core decoder handles JPEG and PNG, so normalise every image
                    // (GIF, HEIC, etc.) to one of those first via ImageMagick. A keyed signature
                    // must stay PNG — JPEG has no alpha to carry its cut-out background.
                    var pdfSafeBytes = ImageConversionHelper.ConvertForPdf(imageBytes);
                    using var imageStream = new MemoryStream(pdfSafeBytes);
                    using var image = XImage.FromStream(imageStream);

                    var page = document.AddPage();
                    page.Size = PageSize.A4;

                    using var gfx = XGraphics.FromPdfPage(page);

                    var maxWidth = page.Width.Point - 2 * Margin;
                    var maxHeight = page.Height.Point - 2 * Margin;
                    var scale = Math.Min(maxWidth / image.PixelWidth, maxHeight / image.PixelHeight);
                    if (scale > 1)
                    {
                        scale = 1; // never upscale a small image
                    }

                    var drawWidth = image.PixelWidth * scale;
                    var drawHeight = image.PixelHeight * scale;
                    var x = (page.Width.Point - drawWidth) / 2;
                    var y = (page.Height.Point - drawHeight) / 2;

                    gfx.DrawImage(image, x, y, drawWidth, drawHeight);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Skipping an image that could not be appended to the POD PDF");
                }
            }

            using var output = new MemoryStream();
            document.Save(output);
            return output.ToArray();
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not append delivery images to the POD PDF; returning the original document");
            return pdfBytes;
        }
    }
}

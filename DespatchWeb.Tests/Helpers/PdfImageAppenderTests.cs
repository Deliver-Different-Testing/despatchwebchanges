using DespatchWeb.Helpers;
using ImageMagick;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Tests for <see cref="PdfImageAppender"/>, which adds the S3 delivery photos and signature as
/// extra pages onto an overlay POD.
/// </summary>
public class PdfImageAppenderTests
{
    private static byte[] OnePagePdf()
    {
        using var doc = new PdfDocument();
        doc.AddPage();
        using var ms = new MemoryStream();
        doc.Save(ms);
        return ms.ToArray();
    }

    /// <summary>A keyed signature: ink on a transparent background, as PNG.</summary>
    private static byte[] TransparentSignaturePng()
    {
        using var img = new MagickImage(MagickColors.Transparent, 200, 100);
        using var stroke = new MagickImage(new MagickColor("#191970"), 4, 60);
        img.Composite(stroke, 100, 20, CompositeOperator.Over);
        img.Format = MagickFormat.Png;
        return img.ToByteArray();
    }

    private static List<PdfDictionary> ImageXObjects(byte[] pdf)
    {
        using var ms = new MemoryStream(pdf);
        using var doc = PdfReader.Open(ms, PdfDocumentOpenMode.Import);
        return doc.Internals.GetAllObjects()
            .OfType<PdfDictionary>()
            .Where(d => d.Elements.GetName("/Subtype") == "/Image")
            .ToList();
    }

    [Fact]
    public void Append_TransparentSignature_KeepsItsTransparency()
    {
        // Converting to JPEG here would flatten the keyed-out canvas to a solid block, undoing the
        // background removal. PDFsharp carries PNG alpha through as an /SMask on the embedded image.
        var result = PdfImageAppender.Append(OnePagePdf(), [TransparentSignaturePng()]);

        Assert.Contains(ImageXObjects(result), i => i.Elements.ContainsKey("/SMask"));
    }

    [Fact]
    public void Append_OpaquePhoto_StillAppendsAPage()
    {
        using var photo = new MagickImage(new MagickColor("#3366cc"), 300, 200);
        photo.Format = MagickFormat.Jpeg;

        var result = PdfImageAppender.Append(OnePagePdf(), [photo.ToByteArray()]);

        using var ms = new MemoryStream(result);
        using var doc = PdfReader.Open(ms, PdfDocumentOpenMode.Import);
        Assert.Equal(2, doc.PageCount);
    }

    [Fact]
    public void Append_NoImages_ReturnsOriginalUnchanged()
    {
        var pdf = OnePagePdf();

        Assert.Same(pdf, PdfImageAppender.Append(pdf, []));
    }
}

using DespatchWeb.Helpers;
using ImageMagick;

namespace DespatchWeb.Tests.Helpers;

public class ImageConversionHelperTests
{
    private static byte[] OpaquePng(uint width, uint height)
    {
        using var img = new MagickImage(new MagickColor("#3366cc"), width, height);
        img.Format = MagickFormat.Png;
        return img.ToByteArray();
    }

    private static byte[] TransparentPng()
    {
        using var img = new MagickImage(MagickColors.Transparent, 200, 100);
        using var stroke = new MagickImage(new MagickColor("#191970"), 4, 60);
        img.Composite(stroke, 100, 20, CompositeOperator.Over);
        img.Format = MagickFormat.Png;
        return img.ToByteArray();
    }

    [Fact]
    public void ConvertToJpeg_WideImage_ResizesTo1280KeepingAspectRatio()
    {
        using var result = new MagickImage(ImageConversionHelper.ConvertToJpeg(OpaquePng(2560, 1000)));

        Assert.Equal(MagickFormat.Jpeg, result.Format);
        Assert.Equal(1280u, result.Width);
        Assert.Equal(500u, result.Height);
        Assert.Equal(85u, result.Quality);
    }

    [Fact]
    public void ConvertToJpeg_SmallImage_KeepsDimensions()
    {
        using var result = new MagickImage(ImageConversionHelper.ConvertToJpeg(OpaquePng(300, 200)));

        Assert.Equal(MagickFormat.Jpeg, result.Format);
        Assert.Equal(300u, result.Width);
        Assert.Equal(200u, result.Height);
    }

    [Fact]
    public void ConvertToJpeg_TransparentImage_FlattensToJpeg()
    {
        using var result = new MagickImage(ImageConversionHelper.ConvertToJpeg(TransparentPng()));

        Assert.Equal(MagickFormat.Jpeg, result.Format);
        Assert.False(result.HasAlpha);
    }

    [Fact]
    public void ConvertForPdf_TransparentImage_ReturnsRgbaPng()
    {
        var bytes = ImageConversionHelper.ConvertForPdf(TransparentPng());
        using var result = new MagickImage(bytes);

        Assert.Equal(MagickFormat.Png, result.Format);
        Assert.True(result.HasAlpha);
        Assert.False(result.IsOpaque);
        Assert.Equal(6, bytes[25]); // PNG IHDR colour type 6 = truecolour + alpha; PdfSharp rejects palette PNGs
    }

    [Fact]
    public void ConvertForPdf_OpaqueImage_ReturnsJpeg()
    {
        using var result = new MagickImage(ImageConversionHelper.ConvertForPdf(OpaquePng(300, 200)));

        Assert.Equal(MagickFormat.Jpeg, result.Format);
        Assert.Equal(300u, result.Width);
    }

    [Fact]
    public void ConvertForPdf_WideTransparentImage_ResizesTo1280()
    {
        using var wide = new MagickImage(MagickColors.Transparent, 2000, 400);
        using var stroke = new MagickImage(new MagickColor("#191970"), 10, 200);
        wide.Composite(stroke, 500, 100, CompositeOperator.Over);
        wide.Format = MagickFormat.Png;

        using var result = new MagickImage(ImageConversionHelper.ConvertForPdf(wide.ToByteArray()));

        Assert.Equal(1280u, result.Width);
        Assert.Equal(256u, result.Height);
    }

    [Fact]
    public void ConvertToJpeg_NotAnImage_Throws()
    {
        Assert.ThrowsAny<MagickException>(() => ImageConversionHelper.ConvertToJpeg([1, 2, 3, 4]));
    }
}

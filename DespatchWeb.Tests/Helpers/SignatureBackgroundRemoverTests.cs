using DespatchWeb.Helpers;
using ImageMagick;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Tests for <see cref="SignatureBackgroundRemover"/>.
///
/// MarsAPI re-encodes every handset signature capture as JPEG before storing it
/// (its JobController.ExtractSignature), and JPEG has no alpha channel — so the signature pad's
/// canvas colour is baked into the pixels and stamps a visible grey box around the ink on the POD
/// report. These cover the keying, and the guards that stop it touching anything else: a POD
/// download must never be broken or degraded by an image this does not understand.
/// </summary>
public class SignatureBackgroundRemoverTests
{
    private const string Canvas = "#d3d3d3";
    private static readonly MagickColor Ink = new("#191970");

    // Middle of the vertical stroke drawn by SignatureJpeg.
    private const int InkX = 119;
    private const int InkY = 100;

    /// <summary>
    /// A signature as MarsAPI stores it: dark ink over an opaque flat canvas, JPEG-encoded, so the
    /// canvas colour is baked in with no alpha and carries JPEG noise around the strokes.
    /// </summary>
    private static byte[] SignatureJpeg(string canvas = Canvas)
    {
        using var img = new MagickImage(new MagickColor(canvas), 400, 200);

        // Two thin bars stand in for pen strokes: enough ink to be real content, little enough that
        // the canvas still dominates the histogram the way a real signature's does.
        using var down = new MagickImage(Ink, 4, 120);
        img.Composite(down, 118, 40, CompositeOperator.Over);
        using var across = new MagickImage(Ink, 200, 4);
        img.Composite(across, 60, 150, CompositeOperator.Over);

        img.Format = MagickFormat.Jpeg;
        img.Quality = 85;
        return img.ToByteArray();
    }

    private static int AlphaAt(IMagickImage<byte> image, int x, int y)
    {
        using var pixels = image.GetPixels();
        return pixels.GetPixel(x, y).ToColor()!.A;
    }

    [Fact]
    public void RemoveFlatBackground_SignatureOnFlatCanvas_MakesTheCanvasTransparent()
    {
        var result = SignatureBackgroundRemover.RemoveFlatBackground(SignatureJpeg());

        using var image = new MagickImage(result);
        Assert.True(image.HasAlpha, "the keyed signature should carry an alpha channel");
        Assert.Equal(0, AlphaAt(image, 2, 2));
    }

    [Fact]
    public void RemoveFlatBackground_SignatureOnFlatCanvas_LeavesTheInkOpaque()
    {
        var result = SignatureBackgroundRemover.RemoveFlatBackground(SignatureJpeg());

        using var image = new MagickImage(result);
        Assert.Equal(255, AlphaAt(image, InkX, InkY));
    }

    [Fact]
    public void RemoveFlatBackground_Photo_IsLeftUntouched()
    {
        // No tone dominates a photo, so the coverage guard bails rather than punching it full of holes.
        using var photo = new MagickImage(new MagickColor("#8899aa"), 400, 300);
        photo.AddNoise(NoiseType.Gaussian);
        photo.Format = MagickFormat.Jpeg;
        var bytes = photo.ToByteArray();

        var result = SignatureBackgroundRemover.RemoveFlatBackground(bytes);

        Assert.Equal(bytes, result);
    }

    [Fact]
    public void RemoveFlatBackground_DarkCanvas_IsLeftUntouched()
    {
        // Light ink on a dark canvas is an inverted capture; keying off luminance would erase the
        // wrong half of it.
        var bytes = SignatureJpeg(canvas: "#202020");

        var result = SignatureBackgroundRemover.RemoveFlatBackground(bytes);

        Assert.Equal(bytes, result);
    }

    [Fact]
    public void RemoveFlatBackground_AlreadyTransparent_IsLeftUntouched()
    {
        using var png = new MagickImage(MagickColors.Transparent, 120, 60);
        png.Format = MagickFormat.Png;
        var bytes = png.ToByteArray();

        var result = SignatureBackgroundRemover.RemoveFlatBackground(bytes);

        Assert.Equal(bytes, result);
    }

    [Fact]
    public void RemoveFlatBackground_UndecodableBytes_ReturnsThemUnchanged()
    {
        // A POD download must never fail over an image we cannot read — the caller stamps whatever
        // comes back, and the existing behaviour for junk bytes is to hand them straight on.
        var bytes = new byte[] { 9, 8, 7, 6 };

        var result = SignatureBackgroundRemover.RemoveFlatBackground(bytes);

        Assert.Equal(bytes, result);
    }
}

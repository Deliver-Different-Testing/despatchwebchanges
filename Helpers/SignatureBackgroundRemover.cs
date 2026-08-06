#nullable enable
using ImageMagick;

namespace DespatchWeb.Helpers;

/// <summary>
/// Keys a signature's flat pad canvas out to transparency so it doesn't stamp a visible box around
/// the ink on a POD report.
///
/// Signatures are drawn on an opaque pad canvas and MarsAPI re-encodes the capture as JPEG before
/// storing it (its JobController.ExtractSignature), so the canvas colour — light grey in practice —
/// is baked into the pixels with no alpha channel to strip.
///
/// Mirrors dfrntdrive_configurator's <c>ImageNormalizer.TryRemoveFlatBackground</c>, which does the
/// same job for the PDF Overlay renderer. Both use Magick.NET; keep the two in step.
/// </summary>
public static class SignatureBackgroundRemover
{
    // The background must be at least this bright for keying to run. A signature pad is always dark
    // ink on a light canvas; anything darker is real content (or an inverted capture).
    private const double MinBackgroundLuminance = 0.55;

    // The background level (± BackgroundLevelTolerance) must cover at least this share of the image.
    // A signature is >90% canvas; a delivery photo's most common tone is nowhere near this, so a
    // photo that reaches here by mistake is left alone rather than punched full of holes.
    private const double MinBackgroundCoverage = 0.5;

    // Half-width, in 0-255 levels, of the band merged into the background when measuring coverage.
    // JPEG smears a "flat" fill across a few adjacent levels, so the exact mode under-counts it.
    private const int BackgroundLevelTolerance = 3;

    // Pixels within this much of the background luminance become fully transparent. Wide enough to
    // swallow JPEG blocking/ringing noise on the canvas without eating ink.
    private const double BackgroundMargin = 0.06;

    // How much darker than the background a pixel must be to become fully opaque. Between the two
    // thresholds alpha ramps linearly, which is what keeps anti-aliased stroke edges smooth.
    private const double OpaqueContrast = 0.35;

    /// <summary>
    /// Returns <paramref name="imageBytes"/> as a PNG with the signature pad's flat background made
    /// transparent, or the bytes unchanged when they are not ink on a flat light canvas — a photo,
    /// an inverted capture, an image that already carries transparency, or bytes that can't be
    /// decoded at all. Never throws: a POD download must not fail over one odd image.
    /// </summary>
    public static byte[] RemoveFlatBackground(byte[] imageBytes)
    {
        try
        {
            using var image = new MagickImage(imageBytes);

            // Already keyed (a capture that kept its alpha) — re-deriving alpha from luminance would
            // throw away the transparency it already has.
            if (image.HasAlpha && !image.IsOpaque)
            {
                return imageBytes;
            }

            // The mask starts as the image's luminance and ends as the alpha channel we copy back.
            using var mask = image.Clone();
            mask.Alpha(AlphaOption.Off);
            mask.Grayscale(PixelIntensityMethod.Rec709Luminance);

            if (!TryMeasureFlatBackground(mask, out var background))
            {
                return imageBytes;
            }

            // Negate so ink (dark) becomes bright = opaque, then stretch the levels so the background
            // clips to fully transparent and ink clips to fully opaque. Matching a single colour
            // instead would leave JPEG speckle and jagged stroke edges.
            mask.Negate();

            var transparentAt = background - BackgroundMargin;
            var opaqueAt = Math.Max(0, transparentAt - OpaqueContrast);

            // Level() works on the negated mask, where brightness = 1 - luminance.
            mask.Level(new Percentage((1 - transparentAt) * 100), new Percentage((1 - opaqueAt) * 100));

            image.Alpha(AlphaOption.On);
            image.Composite(mask, CompositeOperator.CopyAlpha);

            // JPEG has no alpha channel — the cut-out has to be carried as PNG. Png32 (not Png)
            // forces 32-bit RGBA: plain Png lets Magick pick a palette encoding for a low-colour
            // signature, and PdfSharp rejects palette PNGs with "Unsupported image format".
            image.Format = MagickFormat.Png32;
            return image.ToByteArray();
        }
        catch (MagickException ex)
        {
            Serilog.Log.Warning(ex, "Could not key the background out of a signature image; using it as-is");
            return imageBytes;
        }
    }

    /// <summary>
    /// Measures the dominant background luminance (0-1) of a greyscale image, or returns false when
    /// the image does not look like content on a flat light background. The background is the
    /// histogram mode: on a signature the canvas is the overwhelming majority of pixels.
    /// </summary>
    private static bool TryMeasureFlatBackground(IMagickImage<byte> grayscale, out double luminance)
    {
        luminance = 0;

        var total = (double)grayscale.Width * grayscale.Height;
        if (total <= 0)
        {
            return false;
        }

        // Greyscale, Q8 → every histogram entry is one of 256 levels, read off any channel.
        var levels = new double[256];
        foreach (var entry in grayscale.Histogram())
        {
            levels[entry.Key.R] += entry.Value;
        }

        var mode = Array.IndexOf(levels, levels.Max());
        if (mode < 0)
        {
            return false;
        }

        var from = Math.Max(0, mode - BackgroundLevelTolerance);
        var to = Math.Min(levels.Length - 1, mode + BackgroundLevelTolerance);
        var coverage = 0.0;
        for (var i = from; i <= to; i++)
        {
            coverage += levels[i];
        }

        luminance = mode / 255.0;
        return luminance >= MinBackgroundLuminance && coverage / total >= MinBackgroundCoverage;
    }
}

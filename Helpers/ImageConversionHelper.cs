using ImageMagick;

namespace DespatchWeb.Helpers;

/// <summary>
/// Provides image format conversion for browser-incompatible formats like HEIC/HEIF.
/// </summary>
public static class ImageConversionHelper
{
    private const int MaxDisplayWidth = 1280;
    private const int JpegQuality = 85;

    /// <summary>
    /// Converts image bytes (any ImageMagick-supported format) to JPEG.
    /// Resizes to a max width of 1280px (maintaining aspect ratio) for display performance.
    /// </summary>
    public static byte[] ConvertToJpeg(byte[] imageBytes)
    {
        using var image = new MagickImage(imageBytes);

        if (image.Width > MaxDisplayWidth)
        {
            image.Resize(MaxDisplayWidth, 0);
        }

        image.Quality = JpegQuality;
        image.Format = MagickFormat.Jpeg;

        return image.ToByteArray();
    }

    /// <summary>
    /// Converts image bytes to a format PDFsharp can embed: PNG when the image carries transparency,
    /// otherwise JPEG. JPEG has no alpha channel, so flattening a keyed signature onto it would fill
    /// the cut-out with a solid block and undo the background removal.
    /// </summary>
    public static byte[] ConvertForPdf(byte[] imageBytes)
    {
        using var image = new MagickImage(imageBytes);

        if (image.Width > MaxDisplayWidth)
        {
            image.Resize(MaxDisplayWidth, 0);
        }

        if (image.HasAlpha && !image.IsOpaque)
        {
            // Png32 (not Png) forces 32-bit RGBA. Plain Png lets Magick pick a palette encoding for
            // a low-colour image, which PdfSharp rejects with "Unsupported image format".
            image.Format = MagickFormat.Png32;
            return image.ToByteArray();
        }

        image.Quality = JpegQuality;
        image.Format = MagickFormat.Jpeg;

        return image.ToByteArray();
    }
}

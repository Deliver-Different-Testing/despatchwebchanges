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

        if (image.Width > MaxDisplayWidth) image.Resize(MaxDisplayWidth, 0);

        image.Quality = JpegQuality;
        image.Format = MagickFormat.Jpeg;

        return image.ToByteArray();
    }
}

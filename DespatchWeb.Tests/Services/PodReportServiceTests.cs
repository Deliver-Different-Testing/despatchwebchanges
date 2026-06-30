using DespatchWeb.Models;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

file static class PodTestData
{
    public static S3PhotoInfo DeliveryPhoto(byte[] bytes, string fileName = "delivery.jpg") => new()
    {
        S3Key = $"DeliveryPhotos/{fileName}",
        FileName = fileName,
        Data = Convert.ToBase64String(bytes)
    };

    public static S3PhotoInfo SignaturePhoto(byte[] bytes, string fileName = "sig.png") => new()
    {
        S3Key = $"DeliverySignatures/{fileName}",
        FileName = fileName,
        Data = Convert.ToBase64String(bytes)
    };
}

/// <summary>
/// Tests for the internal static mapping methods in PodReportService.
/// </summary>
public class PodReportServiceTests
{
    [Fact]
    public void MapItems_NullParcels_ReturnsEmptyList()
    {
        var result = PodReportService.MapItems(null);

        Assert.Empty(result);
    }

    [Fact]
    public void MapItems_EmptyParcels_ReturnsEmptyList()
    {
        var result = PodReportService.MapItems([]);

        Assert.Empty(result);
    }

    [Fact]
    public void MapItems_ValidParcels_MapsFieldsCorrectly()
    {
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 42, Barcode = "BC-001", ItemName = "Widget" },
            new() { ItemId = 7, Barcode = "BC-002", ItemName = "Gadget" }
        };

        var result = PodReportService.MapItems(parcels);

        Assert.Equal(2, result.Count);
        Assert.Equal("42", result[0].ItemCode);
        Assert.Equal("BC-001", result[0].Barcode);
        Assert.Equal("Widget", result[0].Description);
        Assert.Equal("7", result[1].ItemCode);
        Assert.Equal("BC-002", result[1].Barcode);
        Assert.Equal("Gadget", result[1].Description);
    }

    [Fact]
    public void MapItems_NullItemId_MapsItemCodeAsNull()
    {
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = null, Barcode = "BC-003", ItemName = "Mystery" }
        };

        var result = PodReportService.MapItems(parcels);

        Assert.Single(result);
        Assert.Null(result[0].ItemCode);
    }

    [Fact]
    public void MapPhotoCategories_EmptyPhotos_ReturnsEmptyList()
    {
        var result = PodReportService.MapPhotoCategories([]);

        Assert.Empty(result);
    }

    [Fact]
    public void MapPhotoCategories_PhotosWithNoData_ReturnsEmptyList()
    {
        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "photos/1.jpg", Data = null, FileName = "1.jpg" },
            new() { S3Key = "photos/2.jpg", Data = "", FileName = "2.jpg" }
        };

        var result = PodReportService.MapPhotoCategories(photos);

        Assert.Empty(result);
    }

    [Fact]
    public void MapPhotoCategories_ValidPhotos_CreatesSingleDeliveryPhotosCategory()
    {
        var imageBytes = new byte[] { 1, 2, 3, 4 };
        var base64Data = Convert.ToBase64String(imageBytes);

        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "photos/delivery.jpg", Data = base64Data, FileName = "delivery.jpg" }
        };

        var result = PodReportService.MapPhotoCategories(photos);

        Assert.Single(result);
        Assert.Equal("Delivery Photos", result[0].Category);
        Assert.Single(result[0].Photos);
        Assert.Equal(imageBytes, result[0].Photos[0].ImageBytes);
        Assert.Equal("delivery.jpg", result[0].Photos[0].Caption);
    }

    [Fact]
    public void MapPhotoCategories_MultipleValidPhotos_AllIncludedInSingleCategory()
    {
        var bytes1 = Convert.ToBase64String(new byte[] { 10, 20 });
        var bytes2 = Convert.ToBase64String(new byte[] { 30, 40 });

        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "photos/a.jpg", Data = bytes1, FileName = "a.jpg" },
            new() { S3Key = "photos/b.jpg", Data = bytes2, FileName = "b.jpg" }
        };

        var result = PodReportService.MapPhotoCategories(photos);

        Assert.Single(result);
        Assert.Equal(2, result[0].Photos.Count);
    }

    [Fact]
    public void MapToPodData_NoSignaturePhoto_ReturnsNullSignatureImageWithoutThrowing()
    {
        var job = new JobViewModel { JobNo = "JOB-1" };
        var photos = new List<S3PhotoInfo>
        {
            PodTestData.DeliveryPhoto([1, 2, 3])
        };

        var result = PodReportService.MapToPodData(job, photos);

        Assert.Null(result.SignatureImage);
    }

    [Fact]
    public void MapToPodData_NoPhotosAtAll_ReturnsNullSignatureImageWithoutThrowing()
    {
        var job = new JobViewModel { JobNo = "JOB-2" };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Null(result.SignatureImage);
    }

    [Fact]
    public void MapToPodData_SignaturePhotoWithEmptyData_ReturnsNullSignatureImage()
    {
        var job = new JobViewModel { JobNo = "JOB-3" };
        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "DeliverySignatures/sig.png", FileName = "sig.png", Data = "" }
        };

        var result = PodReportService.MapToPodData(job, photos);

        Assert.Null(result.SignatureImage);
    }

    [Fact]
    public void MapToPodData_WithSignaturePhoto_DecodesSignatureBytes()
    {
        var signatureBytes = new byte[] { 9, 8, 7, 6 };
        var job = new JobViewModel { JobNo = "JOB-4" };
        var photos = new List<S3PhotoInfo>
        {
            PodTestData.SignaturePhoto(signatureBytes),
            PodTestData.DeliveryPhoto([1, 2, 3])
        };

        var result = PodReportService.MapToPodData(job, photos);

        Assert.Equal(signatureBytes, result.SignatureImage);
    }

    [Fact]
    public void MapToPodData_WithPodNotes_SetsPodNotes()
    {
        var job = new JobViewModel { JobNo = "JOB-5" };

        var result = PodReportService.MapToPodData(job, [], "Pickup at rear dock");

        Assert.Equal("Pickup at rear dock", result.PodNotes);
    }

    [Fact]
    public void MapToPodData_WithoutPodNotes_PodNotesIsNull()
    {
        var job = new JobViewModel { JobNo = "JOB-6" };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Null(result.PodNotes);
    }
}
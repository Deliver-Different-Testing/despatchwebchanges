using DeliverDifferentReporting.Models;
using DespatchWeb.Models;
using DespatchWeb.Services;
using ImageMagick;

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

    /// <summary>
    /// A signature as MarsAPI stores it: dark ink over an opaque flat canvas, JPEG-encoded, so the
    /// canvas colour is baked in with no alpha channel.
    /// </summary>
    public static byte[] SignatureJpeg()
    {
        using var img = new MagickImage(new MagickColor("#d3d3d3"), 400, 200);
        using var stroke = new MagickImage(new MagickColor("#191970"), 4, 120);
        img.Composite(stroke, 118, 40, CompositeOperator.Over);
        img.Format = MagickFormat.Jpeg;
        img.Quality = 85;
        return img.ToByteArray();
    }
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
    public void MapToPodData_SignatureOnFlatCanvas_KeysOutTheBackground()
    {
        // Signatures arrive as opaque JPEGs with the pad's canvas colour baked in, which QuestPDF
        // then draws as a visible grey box around the ink.
        var job = new JobViewModel { JobNo = "JOB-4" };
        var photos = new List<S3PhotoInfo> { PodTestData.SignaturePhoto(PodTestData.SignatureJpeg()) };

        var result = PodReportService.MapToPodData(job, photos);

        using var image = new MagickImage(result.SignatureImage!);
        Assert.True(image.HasAlpha);
        using var pixels = image.GetPixels();
        Assert.Equal(0, pixels.GetPixel(2, 2).ToColor()!.A);
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

    // ── Item count ──

    [Fact]
    public void MapToPodData_PalletQuantities_WinOverParcelRows()
    {
        var job = new JobViewModel
        {
            JobNo = "JOB-7",
            Items = 99,
            PalletInfo = [new PalletInfo { Quantity = 3 }, new PalletInfo { Quantity = 2 }],
            ParcelDimensions = [new ParcelDimensions(), new ParcelDimensions()]
        };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal(5, result.ItemCount);
    }

    [Fact]
    public void MapToPodData_NoPallets_CountsParcelRows()
    {
        var job = new JobViewModel
        {
            JobNo = "JOB-8",
            Items = 99,
            ParcelDimensions = [new ParcelDimensions(), new ParcelDimensions(), new ParcelDimensions()]
        };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal(3, result.ItemCount);
    }

    [Fact]
    public void MapToPodData_NoPalletsOrParcels_FallsBackToItemsCount()
    {
        var job = new JobViewModel { JobNo = "JOB-9", Items = 4 };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal(4, result.ItemCount);
    }

    [Fact]
    public void MapToPodData_NothingToCount_LeavesItemCountUnset()
    {
        var job = new JobViewModel { JobNo = "JOB-10" };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Null(result.ItemCount);
    }

    // ── Weight ──

    [Fact]
    public void MapToPodData_MapsJobWeight()
    {
        var job = new JobViewModel { JobNo = "JOB-11", Weight = 12.5 };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal(12.5, result.Weight);
    }

    [Fact]
    public void MapToPodData_NonUsTenant_WeighsInKilograms()
    {
        var job = new JobViewModel { JobNo = "JOB-12", Weight = 12.5 };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal("kg", result.WeightUnit);
    }

    [Fact]
    public void MapToPodData_UsTenant_WeighsInPounds()
    {
        var job = new JobViewModel { JobNo = "JOB-13", Weight = 12.5 };

        var result = PodReportService.MapToPodData(job, [], isUsTenant: true);

        Assert.Equal("lb", result.WeightUnit);
    }

    // ── Address top line (name/suburb + city) ──

    [Fact]
    public void MapToPodData_NzPickup_LeadsWithSuburbAndCity()
    {
        // The POD job projection never populates From, so the suburb comes off the address itself.
        var job = new JobViewModel
        {
            JobNo = "JOB-14",
            PickupAddress = new AddressViewModel { AddressLine5 = "Ellerslie", AddressLine6 = "Auckland" }
        };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal("Ellerslie, Auckland", result.PickupName);
    }

    [Fact]
    public void MapToPodData_NzDelivery_AppendsCityToTheDeliveryName()
    {
        var job = new JobViewModel
        {
            JobNo = "JOB-15",
            ToAddress = "Waikato Hospital",
            DeliveryAddress = new AddressViewModel { AddressLine5 = "Hamilton West", AddressLine6 = "Auckland" }
        };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal("Waikato Hospital, Auckland", result.DeliveryName);
    }

    [Fact]
    public void MapToPodData_UsTenant_TakesTheCityFromLineFive()
    {
        var job = new JobViewModel
        {
            JobNo = "JOB-16",
            ToAddress = "Contoso Depot",
            DeliveryAddress = new AddressViewModel { AddressLine5 = "Dallas", AddressLine6 = "TX" }
        };

        var result = PodReportService.MapToPodData(job, [], isUsTenant: true);

        Assert.Equal("Contoso Depot, Dallas", result.DeliveryName);
    }

    [Fact]
    public void MapToPodData_NoCity_LeavesTheNameAlone()
    {
        var job = new JobViewModel
        {
            JobNo = "JOB-17",
            ToAddress = "Contoso Depot",
            DeliveryAddress = new AddressViewModel { AddressLine4 = "Queen Street" }
        };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal("Contoso Depot", result.DeliveryName);
    }

    [Fact]
    public void MapToPodData_NameAlreadyEndsWithTheCity_DoesNotRepeatIt()
    {
        var job = new JobViewModel
        {
            JobNo = "JOB-18",
            ToAddress = "Waikato Hospital, Auckland",
            DeliveryAddress = new AddressViewModel { AddressLine6 = "Auckland" }
        };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Equal("Waikato Hospital, Auckland", result.DeliveryName);
    }

    [Fact]
    public void MapToPodData_NoAddressAtAll_LeavesTheTopLineUnset()
    {
        var job = new JobViewModel { JobNo = "JOB-19" };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Null(result.PickupName);
        Assert.Null(result.DeliveryName);
    }

    // ── Job history ──

    [Fact]
    public void MapToPodData_WithHistory_MapsEveryRowInOrder()
    {
        var job = new JobViewModel { JobNo = "JOB-20" };
        var history = new List<PodHistoryEntry>
        {
            new() { Status = "Booked", ActionTime = new DateTime(2026, 8, 11, 14, 5, 0) },
            new() { Status = "Delivered", ActionTime = new DateTime(2026, 8, 12, 9, 42, 0) }
        };

        var result = PodReportService.MapToPodData(job, [], history: history);

        Assert.Collection(result.History,
            first =>
            {
                Assert.Equal("Booked", first.Status);
                Assert.Equal(new DateTime(2026, 8, 11, 14, 5, 0), first.ActionTime);
            },
            second =>
            {
                Assert.Equal("Delivered", second.Status);
                Assert.Equal(new DateTime(2026, 8, 12, 9, 42, 0), second.ActionTime);
            });
    }

    [Fact]
    public void MapToPodData_WithoutHistory_LeavesTheHistoryEmpty()
    {
        var job = new JobViewModel { JobNo = "JOB-21" };

        var result = PodReportService.MapToPodData(job, []);

        Assert.Empty(result.History);
    }
}

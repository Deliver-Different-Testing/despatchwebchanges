using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// The courier device writes the signature and photos against the leg it completed, so a multi-leg
/// family's POD media never exists under the parent's id. The parent is the number the client
/// searches for and downloads a POD against, so resolving its media has to sweep the legs — while a
/// leg still resolves to itself alone.
/// </summary>
public class PodMediaServiceTests
{
    private const int ParentId = 200;
    private const int LhpLegId = 201;
    private const int DelLegId = 203;

    private static readonly DateTime Completed = new(2026, 8, 7, 8, 35, 0);
    private static readonly DateTime PickedUp = new(2026, 8, 6, 17, 43, 0);

    private readonly IJobQueryRepository _jobRepository = Substitute.For<IJobQueryRepository>();
    private readonly IJobPhotoService _jobPhotoService = Substitute.For<IJobPhotoService>();

    private PodMediaService CreateService() => new(_jobRepository, _jobPhotoService);

    [Fact]
    public async Task GetDeliveryMediaAsync_ParentWithNoMediaOfItsOwn_ReturnsTheDelLegsSignatureAndPhoto()
    {
        // The reported failure: POD-E4672MD.pdf rendered an empty signature box and no photos
        // because the images were written against E4672MDDEL.
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(DelLegId, "E4672MDDEL", completed: Completed));

        GivenDeliveryMedia(ParentId, 2026, 8);
        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId), Photo(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 2026, 8);

        Assert.Equal(
            ["DeliverySignatures/2026/08/203-DS.jpg", "DeliveryPhotos/2026/08/203-DeliveryPhoto-1.jpg"],
            media.Select(m => m.S3Key));
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_SignatureAndPhotoOnDifferentLegs_ReturnsBoth()
    {
        // The client's own evidence showed 26953623-DeliveryPhoto-1 and 26981620-DS — two different
        // job ids, so the two halves of a POD can genuinely live on separate legs.
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(202, "E4672MDLH1", completed: Completed),
            Leg(DelLegId, "E4672MDDEL", completed: Completed));

        GivenDeliveryMedia(ParentId, 2026, 8);
        GivenDeliveryMedia(202, 2026, 8, Photo(202));
        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 2026, 8);

        Assert.Contains(media, m => m.S3Key == "DeliverySignatures/2026/08/203-DS.jpg");
        Assert.Contains(media, m => m.S3Key == "DeliveryPhotos/2026/08/202-DeliveryPhoto-1.jpg");
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_DelLegSignature_IsOrderedAheadOfEveryOtherLegs()
    {
        // PodReportService takes the first signature it finds, so the final-mile signature has to
        // win over a linehaul handover scrawl.
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(LhpLegId, "E4672MDLHP", completed: Completed),
            Leg(DelLegId, "E4672MDDEL", completed: Completed));

        GivenDeliveryMedia(ParentId, 2026, 8);
        GivenDeliveryMedia(LhpLegId, 2026, 8, Signature(LhpLegId));
        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 2026, 8);

        Assert.Equal("DeliverySignatures/2026/08/203-DS.jpg", media[0].S3Key);
    }

    [Fact]
    public async Task GetPickupMediaAsync_LhpLegMedia_IsOrderedFirst()
    {
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(LhpLegId, "E4672MDLHP", pickedUp: PickedUp),
            Leg(DelLegId, "E4672MDDEL", completed: Completed));

        _jobPhotoService.GetPickupPhotosAsync(ParentId, 2026, 8).Returns([]);
        _jobPhotoService.GetPickupPhotosAsync(DelLegId, 2026, 8).Returns([PickupPhoto(DelLegId)]);
        _jobPhotoService.GetPickupPhotosAsync(LhpLegId, 2026, 8).Returns([PickupPhoto(LhpLegId)]);

        var media = await CreateService().GetPickupMediaAsync(ParentId, 2026, 8);

        Assert.Equal("PickupPhotos/2026/08/201-PickupPhoto-1.jpg", media[0].S3Key);
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_LegJob_LooksUpOnlyItself()
    {
        GivenFamily(Leg(DelLegId, "E4672MDDEL", isRequested: true, completed: Completed));
        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(DelLegId, 2026, 8);

        Assert.Single(media);
        await _jobPhotoService.Received(1).GetDeliveryPhotosAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<int>());
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_SameKeyFromTwoLegs_IsReturnedOnce()
    {
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(DelLegId, "E4672MDDEL", completed: Completed));

        GivenDeliveryMedia(ParentId, 2026, 8, Signature(DelLegId));
        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 2026, 8);

        Assert.Single(media);
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_EachLegIsSearchedInItsOwnCompletionMonth()
    {
        // A leg that completed in a different month keys its media under that month's folder.
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(DelLegId, "E4672MDDEL", completed: new DateTime(2026, 9, 2, 9, 0, 0)));

        GivenDeliveryMedia(ParentId, 2026, 8);
        GivenDeliveryMedia(DelLegId, 2026, 9, Signature(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 2026, 8);

        Assert.Single(media);
        await _jobPhotoService.Received(1).GetDeliveryPhotosAsync(DelLegId, 2026, 9);
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_LegWithNoCompletionTime_FallsBackToTheRequestedMonth()
    {
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true, completed: Completed),
            Leg(DelLegId, "E4672MDDEL"));

        GivenDeliveryMedia(ParentId, 2026, 8);
        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 2026, 8);

        Assert.Single(media);
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_NothingCompletedAndNoRequestedMonth_SkipsS3Entirely()
    {
        GivenFamily(Leg(ParentId, "E4672MD", isRequested: true));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 0, 0);

        Assert.Empty(media);
        await _jobPhotoService.DidNotReceiveWithAnyArgs().GetDeliveryPhotosAsync(0, 0, 0);
    }

    [Fact]
    public async Task GetDeliveryMediaAsync_ParentWithNoCompletionTimeOfItsOwn_StillFindsTheDelLegsMedia()
    {
        // A family whose parent roll-up never ran has no CompletedTime on the parent, which used to
        // short-circuit the whole lookup.
        GivenFamily(
            Leg(ParentId, "E4672MD", isRequested: true),
            Leg(DelLegId, "E4672MDDEL", completed: Completed));

        GivenDeliveryMedia(DelLegId, 2026, 8, Signature(DelLegId), Photo(DelLegId));

        var media = await CreateService().GetDeliveryMediaAsync(ParentId, 0, 0);

        Assert.Equal(2, media.Count);
    }

    private void GivenFamily(params PodMediaLeg[] legs) =>
        _jobRepository.GetPodMediaLegsAsync(legs.Single(l => l.IsRequestedJob).JobId).Returns(legs);

    private void GivenDeliveryMedia(int jobId, int year, int month, params S3PhotoInfo[] media) =>
        _jobPhotoService.GetDeliveryPhotosAsync(jobId, year, month).Returns(media);

    private static PodMediaLeg Leg(
        int jobId,
        string jobNumber,
        bool isRequested = false,
        DateTime? completed = null,
        DateTime? pickedUp = null) =>
        new()
        {
            JobId = jobId,
            JobNumber = jobNumber,
            IsRequestedJob = isRequested,
            CompletedTime = completed,
            PickUpTime = pickedUp
        };

    private static S3PhotoInfo Signature(int jobId) => new()
    {
        S3Key = $"DeliverySignatures/2026/08/{jobId}-DS.jpg",
        FileName = $"{jobId}-DS.jpg",
        ContentType = "image/jpeg",
        Data = "AAAA"
    };

    private static S3PhotoInfo Photo(int jobId) => new()
    {
        S3Key = $"DeliveryPhotos/2026/08/{jobId}-DeliveryPhoto-1.jpg",
        FileName = $"{jobId}-DeliveryPhoto-1.jpg",
        ContentType = "image/jpeg",
        Data = "BBBB"
    };

    private static S3PhotoInfo PickupPhoto(int jobId) => new()
    {
        S3Key = $"PickupPhotos/2026/08/{jobId}-PickupPhoto-1.jpg",
        FileName = $"{jobId}-PickupPhoto-1.jpg",
        ContentType = "image/jpeg",
        Data = "CCCC"
    };
}

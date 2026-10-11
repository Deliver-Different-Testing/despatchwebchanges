using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

public class SwapPodServiceTests
{
    private static readonly DateTime Completed = new(2026, 10, 9, 14, 0, 0);

    private readonly IJobQueryRepository _query = Substitute.For<IJobQueryRepository>();
    private readonly IJobCommandRepository _command = Substitute.For<IJobCommandRepository>();
    private readonly IJobPhotoService _photos = Substitute.For<IJobPhotoService>();

    private SwapPodService CreateService() => new(_query, _command, _photos);

    private void Jobs(bool aDone, bool bDone)
    {
        _query.GetSwapPodJobAsync("A").Returns(new SwapPodJob(1, "A", aDone, Completed));
        _query.GetSwapPodJobAsync("B").Returns(new SwapPodJob(2, "B", bDone, bDone ? Completed : null));
    }

    private void Photos(int jobId, params string[] keys) =>
        _photos.ListDeliveryMediaKeysAsync(jobId, 2026, 10).Returns(keys);

    private void CopyReturns(int from, int to, DeliveryMediaCopyResult result) =>
        _photos.CopyDeliveryMediaAsync(from, to, Arg.Any<IReadOnlyList<string>>(), Arg.Any<ISet<string>>())
            .Returns(result);

    [Fact]
    public async Task SwapAsync_OneSided_CopiesBeforeDbThenDeletesOriginalsAfter()
    {
        Jobs(aDone: true, bDone: false);
        Photos(1, "DeliveryPhotos/2026/10/1-x.jpg");
        CopyReturns(1, 2, new DeliveryMediaCopyResult(
            [new DeliveryMediaCopy("DeliveryPhotos/2026/10/1-x.jpg", "DeliveryPhotos/2026/10/2-x.jpg")], 0));
        _photos.DeleteFileAsync(Arg.Any<string>()).Returns(true);

        var result = await CreateService().SwapAsync("A", "B");

        Assert.Equal(new SwapPodResult(1, 0), result);
        Received.InOrder(() =>
        {
            _photos.CopyDeliveryMediaAsync(1, 2, Arg.Any<IReadOnlyList<string>>(), Arg.Any<ISet<string>>());
            _command.SwapPodStateAsync(1, 2);
            _photos.DeleteFileAsync("DeliveryPhotos/2026/10/1-x.jpg");
        });
        await _photos.DidNotReceive().DeleteFileAsync("DeliveryPhotos/2026/10/2-x.jpg");
    }

    [Fact]
    public async Task SwapAsync_TwoSided_CopiesBothDirections()
    {
        Jobs(aDone: true, bDone: true);
        Photos(1, "DeliveryPhotos/2026/10/1-x.jpg");
        Photos(2, "DeliveryPhotos/2026/10/2-y.jpg");
        CopyReturns(1, 2, new DeliveryMediaCopyResult([new DeliveryMediaCopy("s1", "c1")], 0));
        CopyReturns(2, 1, new DeliveryMediaCopyResult([new DeliveryMediaCopy("s2", "c2")], 0));
        _photos.DeleteFileAsync(Arg.Any<string>()).Returns(true);

        var result = await CreateService().SwapAsync("A", "B");

        Assert.Equal(new SwapPodResult(2, 0), result);
        await _photos.Received(1).DeleteFileAsync("s1");
        await _photos.Received(1).DeleteFileAsync("s2");
    }

    [Fact]
    public async Task SwapAsync_DbFails_DeletesCopiesKeepsOriginalsAndRethrows()
    {
        Jobs(aDone: true, bDone: false);
        Photos(1, "s1");
        CopyReturns(1, 2, new DeliveryMediaCopyResult([new DeliveryMediaCopy("s1", "c1")], 0));
        _command.SwapPodStateAsync(1, 2).ThrowsAsync(new InvalidOperationException("db"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateService().SwapAsync("A", "B"));

        await _photos.Received(1).DeleteFileAsync("c1");
        await _photos.DidNotReceive().DeleteFileAsync("s1");
    }

    [Fact]
    public async Task SwapAsync_CopyFailuresAndFailedDeletes_AreCountedAsFailed()
    {
        Jobs(aDone: true, bDone: false);
        Photos(1, "s1", "s2");
        CopyReturns(1, 2, new DeliveryMediaCopyResult([new DeliveryMediaCopy("s1", "c1")], 1));
        _photos.DeleteFileAsync("s1").Returns(false);

        var result = await CreateService().SwapAsync("A", "B");

        Assert.Equal(new SwapPodResult(0, 2), result);
    }

    [Fact]
    public async Task SwapAsync_NoMedia_SkipsS3Copy()
    {
        Jobs(aDone: true, bDone: false);
        Photos(1);

        var result = await CreateService().SwapAsync("A", "B");

        Assert.Equal(new SwapPodResult(0, 0), result);
        await _photos.DidNotReceiveWithAnyArgs()
            .CopyDeliveryMediaAsync(0, 0, null!, null!);
        await _command.Received(1).SwapPodStateAsync(1, 2);
    }

    [Fact]
    public async Task SwapAsync_IneligiblePairs_ThrowBeforeTouchingAnything()
    {
        _query.GetSwapPodJobAsync("A").Returns(new SwapPodJob(1, "A", true, Completed));
        _query.GetSwapPodJobAsync("SAME").Returns(new SwapPodJob(1, "A", true, Completed));
        _query.GetSwapPodJobAsync("NOTDONE").Returns(new SwapPodJob(3, "NOTDONE", false, null));
        var service = CreateService();

        await Assert.ThrowsAsync<SwapPodException>(() => service.SwapAsync("A", "MISSING"));
        await Assert.ThrowsAsync<SwapPodException>(() => service.SwapAsync("A", "SAME"));
        await Assert.ThrowsAsync<SwapPodException>(() => service.SwapAsync("NOTDONE", "A"));

        await _command.DidNotReceiveWithAnyArgs().SwapPodStateAsync(0, 0);
    }
}

using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface ISwapPodService
{
    /// <summary>
    /// Moves the POD (state and delivery media) from <paramref name="job1"/> to <paramref name="job2"/>;
    /// when both are already done the two PODs are exchanged.
    /// </summary>
    /// <exception cref="Exceptions.SwapPodException">The pair is not eligible for a swap.</exception>
    Task<SwapPodResult> SwapAsync(string job1, string job2);
}

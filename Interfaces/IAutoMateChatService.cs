using DespatchWeb.Models.AutoMate;

namespace DespatchWeb.Interfaces;

public interface IAutoMateChatService
{
    IAsyncEnumerable<AutoMateStreamEvent> ChatStreamAsync(AutoMateChatRequest request, CancellationToken ct);
}

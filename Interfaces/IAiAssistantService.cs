using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiAssistantService
{
    Task<AiChatResponse> ChatAsync(List<AiMessage> messages, CancellationToken ct = default);

    IAsyncEnumerable<string> StreamChatAsync(
        List<AiMessage> messages,
        [EnumeratorCancellation] CancellationToken ct = default);
}

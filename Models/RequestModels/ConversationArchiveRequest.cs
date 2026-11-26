using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models.RequestModels;

public sealed class ConversationArchiveRequest
{
    public List<ConversationKey> Conversations { get; init; } = [];
}

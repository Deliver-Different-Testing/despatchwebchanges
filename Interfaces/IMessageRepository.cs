using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IMessageRepository
{
    Task<int> GetUnreadMessageCountAsync();
    Task<IReadOnlyList<RecentMessageViewModel>> GetRecentListAsync();
    Task<IReadOnlyList<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId, int limit = 200);
    Task<IReadOnlyList<ChatMessageViewModel>> GetMessagesByStaffIdAsync(int otherStaffId, int currentStaffId, int limit = 200);
    Task SendMessageAsync(SendMessageRequest request);
    Task SendMultipleMessagesAsync(SendMultipleMessageRequest request);
    Task MarkMessagesAsReadAsync(int otherPartyId, OtherMessagePartyType otherPartyType);
    Task<IReadOnlyList<Suggestion>> GetSavedQuickResponsesAsync();
    Task<int> AddNewQuickResponseAsync(SaveQuickResponseRequest data);
    Task DeleteQuickResponseAsync(int responseId);
    Task<IReadOnlyList<MessageContactOptionViewModel>> GetNewMessageContactOptionsAsync(string searchTerm);
}

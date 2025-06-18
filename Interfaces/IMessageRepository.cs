using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IMessageRepository
{
    Task<List<RecentMessageViewModel>> GetRecentListAsync();
    Task<List<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId);
    Task<List<ChatMessageViewModel>> GetMessagesByStaffIdAsync(int otherStaffId, int currentStaffId);
    Task SendMessageAsync(SendMessageRequest request);
    Task MarkMessagesAsReadAsync(int otherPartyId, OtherMessagePartyType otherPartyType);
    Task<List<Suggestion>> GetSavedQuickResponsesAsync();
    Task<int> AddNewQuickResponseAsync(SaveQuickResponseRequest data);
    Task DeleteQuickResponseAsync(int responseId);
    Task<List<MessageContactOptionViewModel>> GetNewMessageContactOptionsAsync(string searchTerm);
}

using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IMessageRepository
{
    Task<List<RecentMessageViewModel>> GetRecentListAsync(int staffId);
    Task<List<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId);
    Task SendMessageToCouriersAsync(SendMessageRequest request);
}

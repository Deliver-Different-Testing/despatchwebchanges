using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IAddStopJobService
{
    Task<int> AddStopInsertJobAsync(AddStopRequest request);
    Task<int> AddStopInsertRecurringJobAsync(AddStopRequest request);
}

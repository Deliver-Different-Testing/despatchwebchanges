namespace DespatchWeb.Interfaces;

public interface IDispatchJobService
{
    Task DispatchJobsToCourierAsync(List<int> jobIds, int courierId);
}
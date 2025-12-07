using System.Collections.Generic;
using System.Threading.Tasks;

namespace DespatchWeb.Interfaces;

public interface IDispatchJobService
{
    Task DispatchJobsToCourierAsync(List<int> jobIds, int courierId);
}
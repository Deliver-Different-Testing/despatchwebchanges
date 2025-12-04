using System.Collections.Generic;
using System.Threading.Tasks;

namespace DespatchWeb.Interfaces;

public interface IDispatchJobService
{
    Task DispatchJobsToCourier(List<int> jobIds, int courierId);
}
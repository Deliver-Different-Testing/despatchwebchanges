using System.Threading.Tasks;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IAddStopJobService
{
    Task<int> AddStopInsertJobAsync(AddStopRequest request);
}

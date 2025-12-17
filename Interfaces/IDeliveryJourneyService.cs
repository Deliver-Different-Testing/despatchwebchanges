using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IDeliveryJourneyService
{
    Task<List<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId);
}

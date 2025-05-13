using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IRateJobService
{
    Task<decimal> RateJob(JobRatingDetailsDto jobDetails);
    Task RateJobUs(JobRatingDetailsDto jobDetails);
}

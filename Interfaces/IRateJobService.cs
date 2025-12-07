using System.Threading.Tasks;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IRateJobService
{
    Task RateJobNzAsync(JobRatingDetailsDtoNz jobDetails);
    Task RateJobUsAsync(JobRatingDetailsDto jobDetails);
    Task<decimal> GetJobRateNzAsync(JobRatingDetailsDtoNz jobDetails);
    Task<decimal> GetJobRateUsAsync(JobRatingDetailsDto jobDetails);
}

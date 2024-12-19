using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IRateJobService
{
    Task<JobRateResult> CalculateJobRateUs(JobRateRequest request);
}
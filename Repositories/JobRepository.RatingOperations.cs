using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    /// <summary>
    /// Retrieves job details required for US tenant rating calculations from the active jobs table.
    /// </summary>
    public async Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(int jobId)
    {
        var jobDetails = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobRatingUsMapping())
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(jobDetails);
        return jobDetails;
    }

    /// <summary>
    /// Retrieves job details required for NZ tenant rating calculations.
    /// Queries either active or archived jobs table based on the isArchived parameter.
    /// </summary>
    public async Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(int jobId, bool isArchived)
    {
        var jobDetails = isArchived
            ? await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(JobMappings.JobRatingNzArchiveMapping())
                .FirstOrDefaultAsync()
            : await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(JobMappings.JobRatingNzMapping())
                .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(jobDetails);
        return jobDetails;
    }

    /// <summary>
    /// Retrieves prebook job details required for US tenant rating calculations.
    /// </summary>
    public async Task<JobRatingDetailsDto> GetJobBookingDetailsForRatingAsync(int jobId)
    {
        var jobDetails = await Context.TucJobBookings
            .Where(j => j.UcbkId == jobId)
            .Select(JobMappings.JobBookingRatingUsMapping())
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(jobDetails);
        return jobDetails;
    }

    /// <summary>
    /// Retrieves prebook job details required for NZ tenant rating calculations.
    /// </summary>
    public async Task<JobRatingDetailsDtoNz> GetJobBookingDetailsForRatingNzAsync(int jobId)
    {
        var jobDetails = await Context.TucJobBookings
            .Where(j => j.UcbkId == jobId)
            .Select(JobMappings.JobBookingRatingNzMapping())
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(jobDetails);
        return jobDetails;
    }

    /// <summary>
    /// Rates a US tenant job by calling the rating stored procedure and saving the pricing breakdown.
    /// Skips update if the calculated price matches the previous rate.
    /// </summary>
    public async Task RateJobUsAsync(RateJobUsDto dto)
    {
        var (rate, description) = await CallRatingProcedureAsync(dto);

        if (dto.PreviousRate == rate)
        {
            Log.Information("Price is unchanged. Not updating job {Job}", dto.JobId);
            return;
        }

        Log.Information("Pricing breakdown is: {DescriptionValue}", description);

        if (dto.IsPrebook)
        {
            var effectiveJobBookingId = await Context.GetEffectiveJobBookingIdAsync(dto.JobId);
            var returnValue = new OutputParameter<int>();
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: null,
                prebookJobID: effectiveJobBookingId,
                pricingBreakdown: description,
                returnValue: returnValue
            );
        }
        else
        {
            var effectiveJobId = await Context.GetEffectiveJobIdAsync(dto.JobId);
            var returnValue = new OutputParameter<int>();
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: effectiveJobId,
                prebookJobID: null,
                pricingBreakdown: description,
                returnValue: returnValue
            );
        }

        var printableRate = rate ?? 0;
        await SaveNoteAsync(dto.JobId, $"Repriced from {dto.PreviousRate} to {printableRate}", true);
    }

    /// <summary>
    /// Updates the rate amount for an NZ urgent job in the appropriate table based on job type.
    /// </summary>
    public async Task UpdateUrgentJobRateAsync(int jobId, decimal rate, JobType jobType)
    {
        try
        {
            var previousRate = jobType switch
            {
                JobType.Active => await Context.TucJobs.Where(j => j.UcjbId == jobId)
                    .Select(j => j.UcjbAmount).FirstOrDefaultAsync(),
                JobType.Recurring => await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .Select(j => j.UcbkAmount).FirstOrDefaultAsync(),
                JobType.Archived => await Context.TucJobArchives.Where(j => j.UcjbId == jobId)
                    .Select(j => j.UcjbAmount).FirstOrDefaultAsync(),
                _ => null
            };

            if (previousRate.HasValue && previousRate.Value == rate)
            {
                Log.Information("Price is unchanged. Not updating job {JobId}", jobId);
                return;
            }

            var rowsUpdated = jobType switch
            {
                JobType.Active => await Context.TucJobs.Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setter => setter.SetProperty(x => x.UcjbAmount, rate)),
                JobType.Recurring => await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(setter => setter.SetProperty(x => x.UcbkAmount, rate)),
                JobType.Archived => await Context.TucJobArchives.Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setter => setter.SetProperty(x => x.UcjbAmount, rate)),
                _ => 0
            };

            if (rowsUpdated == 0) throw new KeyNotFoundException($"Job with ID {jobId} not found");

            var noteText = previousRate.HasValue
                ? $"Rate updated to {rate} from {previousRate.Value}"
                : $"Rate updated to {rate}";
            await SaveNoteAsync(jobId, noteText, true, JobType.Recurring == jobType);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateUrgentJobRateAsync)));
            throw;
        }
    }

    /// <summary>
    /// Calculates a US tenant job rate without persisting it to the database.
    /// Used for rate preview functionality.
    /// </summary>
    public async Task<decimal> GetJobRateUsAsync(RateJobUsDto dto)
    {
        var (rate, description) = await CallRatingProcedureAsync(dto);

        Log.Information("Calculated price: {Rate}. Pricing breakdown: {DescriptionValue}",
            rate ?? 0,
            description);

        return rate ?? 0;
    }

    /// <summary>
    /// Calls the rating stored procedure with the given parameters and returns the rate and description.
    /// </summary>
    private async Task<(decimal? rate, string description)> CallRatingProcedureAsync(RateJobUsDto dto)
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        bool isFromAirport, isToAirport;
        if (dto.PrecomputedIsFromAddressAirport.HasValue && dto.PrecomputedIsToAddressAirport.HasValue)
        {
            isFromAirport = dto.PrecomputedIsFromAddressAirport.Value;
            isToAirport = dto.PrecomputedIsToAddressAirport.Value;
        }
        else
        {
            // Run sequentially — both are tiny PK lookups and DbContext is not thread-safe
            isFromAirport = await Context.DoesAddressMatchAirportAsync(dto.JobId, true);
            isToAirport = await Context.DoesAddressMatchAirportAsync(dto.JobId, false);
        }

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientID: dto.ClientId,
            speedID: dto.Speed,
            fromZipCode: int.TryParse(dto.FromZip, out var fromZip) ? fromZip : null,
            fromState: null,
            fromLat: dto.FromLat,
            fromLong: dto.FromLong,
            toZipCode: int.TryParse(dto.ToZip, out var toZip) ? toZip : null,
            toState: null,
            toLat: dto.ToLat,
            toLong: dto.ToLong,
            totalDistance: dto.TotalMiles,
            fromMiles: dto.FromMiles,
            toMiles: dto.ToMiles,
            totalWeight: dto.Weight,
            quantity: dto.Quantity,
            cubic: dto.Cubic,
            totalPallets: dto.TotalPallets,
            extraStopOffs: dto.ExtraStopOffs,
            booked: dto.Booked,
            vehicleSizeID: dto.Size,
            dangerousGoods: dto.DangerousGoods,
            dryIceWeight: dto.DryIceWeight,
            waitTime: dto.WaitTime,
            fromAgentId: dto.FromAgentId,
            fromAirportId: dto.FromAirportId,
            toAgentId: dto.ToAgentId,
            toAirportId: dto.ToAirportId,
            isFromAddressAirport: isFromAirport,
            isToAddressAirport: isToAirport,
            dimensionsType: dto.CalculateDimsOncePerJob ? 1 : 0,
            description: description,
            rate: rate,
            returnValue: returnValue
        );

        return (rate.Value, description.Value);
    }
}

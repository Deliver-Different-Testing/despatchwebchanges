using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class AccessorialChargeRepository(IDbContextFactory<DespatchContext> contextFactory)
    : BaseRepository(contextFactory), IAccessorialChargeRepository
{
    private static readonly Expression<Func<JobAccessorialCharge, JobAccessorialChargeDto>> AppliedChargeProjection =
        jac => new JobAccessorialChargeDto
        {
            JobAccessorialChargeId = jac.JobAccessorialChargeId,
            JobId = jac.JobId,
            AccessorialChargeId = jac.AccessorialChargeId,
            Name = jac.AccessorialCharge.Name,
            ChargeType = jac.AccessorialCharge.ChargeType,
            UnitTypeId = jac.AccessorialCharge.UnitTypeId,
            UnitTypeName = jac.AccessorialCharge.UnitType != null ? jac.AccessorialCharge.UnitType.Name : null,
            BaseRate = jac.AccessorialCharge.BaseRate,
            RatePerUnit = jac.AccessorialCharge.RatePerUnit,
            PercentageRate = jac.AccessorialCharge.PercentageRate,
            FreeAllowance = jac.AccessorialCharge.FreeAllowance,
            FreeAllowanceUnitTypeName = jac.AccessorialCharge.FreeAllowanceUnitType != null
                ? jac.AccessorialCharge.FreeAllowanceUnitType.Name
                : null,
            MinimumQuantity = jac.AccessorialCharge.MinimumQuantity,
            MinimumCharge = jac.AccessorialCharge.MinimumCharge,
            MaximumCharge = jac.AccessorialCharge.MaximumCharge,
            InputValue = jac.InputValue,
            ItemCount = jac.ItemCount,
            CalculatedAmount = jac.CalculatedAmount,
            OverrideAmount = jac.OverrideAmount,
            CalculationOrder = jac.AccessorialCharge.CalculationOrder,
            Notes = jac.Notes,
            AddedAtStage = jac.AddedAtStage,
            CreatedBy = jac.CreatedBy,
            Created = jac.Created
        };

    public async Task<IReadOnlyList<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId) =>
        await Context.AccessorialChargeGroupMembers
            .Where(acgm => acgm.AccessorialChargeGroupId == accessorialChargeGroupId)
            .Select(acgm => acgm.AccessorialCharge)
            .Where(ac => ac.Active && ac.AvailableAtDispatch)
            .OrderBy(ac => ac.CalculationOrder)
            .Select(ac => new AccessorialChargeDto
            {
                AccessorialChargeId = ac.AccessorialChargeId,
                Name = ac.Name,
                Description = ac.Description,
                ChargeType = ac.ChargeType,
                UnitTypeId = ac.UnitTypeId,
                UnitTypeName = ac.UnitType != null ? ac.UnitType.Name : null,
                BaseRate = ac.BaseRate,
                RatePerUnit = ac.RatePerUnit,
                PercentageRate = ac.PercentageRate,
                MinimumCharge = ac.MinimumCharge,
                MaximumCharge = ac.MaximumCharge,
                MinimumQuantity = ac.MinimumQuantity,
                FreeAllowance = ac.FreeAllowance,
                FreeAllowanceUnitTypeId = ac.FreeAllowanceUnitTypeId,
                FreeAllowanceUnitTypeName = ac.FreeAllowanceUnitType != null
                    ? ac.FreeAllowanceUnitType.Name
                    : null,
                ConditionalNote = ac.ConditionalNote,
                CalculationOrder = ac.CalculationOrder,
                AlreadyApplied = ac.JobAccessorialCharges.Any(jac => jac.JobId == jobId)
            })
            .ToListAsync();

    public async Task<IReadOnlyList<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId) =>
        await Context.JobAccessorialCharges
            .Where(jac => jac.JobId == jobId)
            .OrderBy(jac => jac.Created)
            .Select(AppliedChargeProjection)
            .ToListAsync();

    public async Task AddChargeAsync(int jobId, JobAccessorialChargeCreateRequest request, string userName)
    {
        var newJobTotal = new OutputParameter<decimal?>();
        await Context.Procedures.sp_AddJobAccessorialAsync(
            jobId,
            request.AccessorialChargeId,
            request.InputValue,
            request.ItemCount,
            "dispatch",
            userName ?? "Unknown",
            request.Notes,
            newJobTotal);
    }

    public async Task<JobAccessorialChargeDto> GetAppliedChargeWithDetailsAsync(int jobAccessorialChargeId) =>
        await Context.JobAccessorialCharges
            .Where(jac => jac.JobAccessorialChargeId == jobAccessorialChargeId)
            .Select(AppliedChargeProjection)
            .FirstOrDefaultAsync();

    public async Task UpdateChargeAsync(int jobAccessorialChargeId, decimal calculatedAmount, decimal? overrideAmount,
        decimal? inputValue, int itemCount, string notes, string userName) =>
        await Context.JobAccessorialCharges
            .Where(jac => jac.JobAccessorialChargeId == jobAccessorialChargeId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(jac => jac.InputValue, inputValue)
                .SetProperty(jac => jac.ItemCount, itemCount)
                .SetProperty(jac => jac.Notes, notes)
                .SetProperty(jac => jac.CalculatedAmount, calculatedAmount)
                .SetProperty(jac => jac.OverrideAmount, overrideAmount)
                .SetProperty(jac => jac.LastModified, DateTime.UtcNow)
                .SetProperty(jac => jac.LastModifiedBy, userName ?? "Unknown"));

    public async Task DeleteChargeAsync(int jobAccessorialChargeId) =>
        await Context.JobAccessorialCharges
            .Where(jac => jac.JobAccessorialChargeId == jobAccessorialChargeId)
            .ExecuteDeleteAsync();

    public async Task<decimal> GetJobAmountAsync(int jobId) =>
        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.UcjbAmount ?? 0m)
            .FirstOrDefaultAsync();

    public async Task<IReadOnlyList<PortionJobInfoDto>> GetPortionJobsAsync(int parentJobId)
    {
        var labels = new[] { "Pickup", "Flight", "Delivery" };
        var children = await Context.TucJobs
            .Where(j => j.ParentId == parentJobId)
            .OrderBy(j => j.UcjbId)
            .Select(j => new { j.UcjbId, j.AccessorialChargeGroupId })
            .ToListAsync();

        return
        [
            .. children
                .Select((j, i) => new PortionJobInfoDto
                {
                    JobId = j.UcjbId,
                    Label = i < labels.Length ? labels[i] : $"Portion {i + 1}",
                    AccessorialChargeGroupId = j.AccessorialChargeGroupId
                })
        ];
    }
}
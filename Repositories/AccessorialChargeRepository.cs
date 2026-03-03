using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class AccessorialChargeRepository(IDbContextFactory<DespatchContext> contextFactory)
    : BaseRepository(contextFactory), IAccessorialChargeRepository
{
    private const string AvailableChargesQuery = """
        SELECT
            ac.AccessorialChargeId,
            ac.Name,
            ac.Description,
            ac.ChargeType,
            ac.UnitTypeId,
            ut.Name        AS UnitTypeName,
            ac.BaseRate,
            ac.RatePerUnit,
            ac.PercentageRate,
            ac.MinimumCharge,
            ac.MaximumCharge,
            ac.MinimumQuantity,
            ac.FreeAllowance,
            ac.FreeAllowanceUnitTypeId,
            faut.Name      AS FreeAllowanceUnitTypeName,
            ac.ConditionalNote,
            ac.CalculationOrder,
            CASE WHEN jac.JobAccessorialChargeId IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS AlreadyApplied
        FROM   AccessorialChargeGroupMembers acgm
        INNER JOIN AccessorialCharges ac ON acgm.AccessorialChargeId = ac.AccessorialChargeId
        LEFT  JOIN UnitTypes ut   ON ac.UnitTypeId              = ut.UnitTypeId
        LEFT  JOIN UnitTypes faut ON ac.FreeAllowanceUnitTypeId = faut.UnitTypeId
        LEFT  JOIN JobAccessorialCharges jac
               ON  jac.JobId              = @JobId
               AND jac.AccessorialChargeId = ac.AccessorialChargeId
        WHERE  acgm.AccessorialChargeGroupId = @AccessorialChargeGroupId
        AND    ac.Active               = 1
        AND    ac.AvailableAtDispatch   = 1
        ORDER BY ac.CalculationOrder
        """;

    private const string AppliedChargesQuery = """
        SELECT
            jac.JobAccessorialChargeId,
            jac.JobId,
            jac.AccessorialChargeId,
            ac.Name,
            ac.ChargeType,
            ac.UnitTypeId,
            ut.Name        AS UnitTypeName,
            ac.BaseRate,
            ac.RatePerUnit,
            ac.PercentageRate,
            ac.FreeAllowance,
            faut.Name      AS FreeAllowanceUnitTypeName,
            ac.MinimumQuantity,
            ac.MinimumCharge,
            ac.MaximumCharge,
            jac.InputValue,
            jac.ItemCount,
            jac.CalculatedAmount,
            jac.OverrideAmount,
            ac.CalculationOrder,
            jac.Notes,
            jac.AddedAtStage,
            jac.CreatedBy,
            jac.Created
        FROM   JobAccessorialCharges jac
        INNER JOIN AccessorialCharges ac ON jac.AccessorialChargeId = ac.AccessorialChargeId
        LEFT  JOIN UnitTypes ut   ON ac.UnitTypeId              = ut.UnitTypeId
        LEFT  JOIN UnitTypes faut ON ac.FreeAllowanceUnitTypeId = faut.UnitTypeId
        WHERE  jac.JobId = @JobId
        ORDER BY jac.Created
        """;

    private const string SingleAppliedChargeQuery = """
        SELECT
            jac.JobAccessorialChargeId,
            jac.JobId,
            jac.AccessorialChargeId,
            ac.Name,
            ac.ChargeType,
            ac.UnitTypeId,
            ut.Name        AS UnitTypeName,
            ac.BaseRate,
            ac.RatePerUnit,
            ac.PercentageRate,
            ac.FreeAllowance,
            faut.Name      AS FreeAllowanceUnitTypeName,
            ac.MinimumQuantity,
            ac.MinimumCharge,
            ac.MaximumCharge,
            jac.InputValue,
            jac.ItemCount,
            jac.CalculatedAmount,
            jac.OverrideAmount,
            ac.CalculationOrder,
            jac.Notes,
            jac.AddedAtStage,
            jac.CreatedBy,
            jac.Created
        FROM   JobAccessorialCharges jac
        INNER JOIN AccessorialCharges ac ON jac.AccessorialChargeId = ac.AccessorialChargeId
        LEFT  JOIN UnitTypes ut   ON ac.UnitTypeId              = ut.UnitTypeId
        LEFT  JOIN UnitTypes faut ON ac.FreeAllowanceUnitTypeId = faut.UnitTypeId
        WHERE  jac.JobAccessorialChargeId = @JobAccessorialChargeId
        """;

    public async Task<List<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        var results = await connection.QueryAsync<AccessorialChargeDto>(
            AvailableChargesQuery,
            new { AccessorialChargeGroupId = accessorialChargeGroupId, JobId = jobId });

        return results.ToList();
    }

    public async Task<List<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        var results = await connection.QueryAsync<JobAccessorialChargeDto>(
            AppliedChargesQuery,
            new { JobId = jobId });

        return results.ToList();
    }

    public async Task AddChargeAsync(int jobId, JobAccessorialChargeCreateRequest request, string userName)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        var parameters = new DynamicParameters();
        parameters.Add("@JobId", jobId);
        parameters.Add("@AccessorialChargeId", request.AccessorialChargeId);
        parameters.Add("@InputValue", request.InputValue, dbType: DbType.Decimal);
        parameters.Add("@ItemCount", request.ItemCount);
        parameters.Add("@AddedAtStage", "dispatch");
        parameters.Add("@UserName", userName ?? "Unknown");
        parameters.Add("@Notes", request.Notes, dbType: DbType.String);
        parameters.Add("@NewJobTotal", dbType: DbType.Decimal, direction: ParameterDirection.Output,
            precision: 10, scale: 2);

        await connection.ExecuteAsync(
            "EXEC sp_AddJobAccessorial @JobId, @AccessorialChargeId, @InputValue, @ItemCount, @AddedAtStage, @UserName, @Notes, @NewJobTotal OUTPUT",
            parameters);
    }

    public async Task<JobAccessorialChargeDto> GetAppliedChargeWithDetailsAsync(int jobAccessorialChargeId)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        return await connection.QueryFirstOrDefaultAsync<JobAccessorialChargeDto>(
            SingleAppliedChargeQuery,
            new { JobAccessorialChargeId = jobAccessorialChargeId });
    }

    public async Task UpdateChargeAsync(int jobAccessorialChargeId, decimal calculatedAmount, decimal? overrideAmount,
        decimal? inputValue, int itemCount, string notes, string userName)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        await connection.ExecuteAsync("""
            UPDATE JobAccessorialCharges
            SET    InputValue       = @InputValue,
                   ItemCount        = @ItemCount,
                   Notes            = @Notes,
                   CalculatedAmount = @CalculatedAmount,
                   OverrideAmount   = @OverrideAmount,
                   LastModified     = @LastModified,
                   LastModifiedBy   = @LastModifiedBy
            WHERE  JobAccessorialChargeId = @JobAccessorialChargeId
            """,
            new
            {
                JobAccessorialChargeId = jobAccessorialChargeId,
                InputValue = (object?)inputValue ?? DBNull.Value,
                ItemCount = itemCount,
                Notes = (object?)notes ?? DBNull.Value,
                CalculatedAmount = calculatedAmount,
                OverrideAmount = (object?)overrideAmount ?? DBNull.Value,
                LastModified = DateTime.UtcNow,
                LastModifiedBy = userName ?? "Unknown"
            });
    }

    public async Task DeleteChargeAsync(int jobAccessorialChargeId)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        await connection.ExecuteAsync(
            "DELETE FROM JobAccessorialCharges WHERE JobAccessorialChargeId = @JobAccessorialChargeId",
            new { JobAccessorialChargeId = jobAccessorialChargeId });
    }

    public async Task<decimal> GetJobAmountAsync(int jobId)
    {
        var connection = Context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        return await connection.ExecuteScalarAsync<decimal>(
            "SELECT ISNULL(ucjbAmount, 0) FROM tucJob WHERE ucjbID = @JobId",
            new { JobId = jobId });
    }
}

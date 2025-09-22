using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

public class FlightRateService(INationwideJobRepository repository, ITenantInfoService infoService) : IFlightRateService
{
    public async Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime)
    {
        var flightRateDto = await repository.GetFlightRateCalculationDtoAsync(jobId, carrierCode, extraStopOffs, bookTime);

        var rates = await CalculateFlightRatesAsync(flightRateDto);
        return rates.Count != 0 ? rates.First().Rate : 0;
    }

    private async Task<List<FlightRateDto>> CalculateFlightRatesAsync(FlightRateCalculationDto dto)
    {
        var bookTime = dto.BookTime ?? infoService.GetCurrentTenantTime();

        // Result collection
        var rates = new List<FlightRateDto>();

        // Check if the date of a requested job is on a holiday (holiday takes priority)
        var isHoliday = await repository.IsHolidayAsync(dto.ClientId, bookTime);

        // Check if the date or time of a requested job is after hours
        var isAfterHours = await repository.IsAfterHoursAsync(dto.ClientId, bookTime, isHoliday);

        // Get carrier ID
        var carrierId = await repository.GetFlightCarrierIdByCodeAsync(dto.CarrierCode);
        if (carrierId == null)
            return rates;

        // Get zone names
        var fromZoneName = await repository.GetZoneNameAsync(carrierId.Value, dto.FromState, dto.FromCity);
        var toZoneName = await repository.GetZoneNameAsync(carrierId.Value, dto.ToState, dto.ToCity);
        Log.Debug("FromZoneName: {FromZoneName}, ToZoneName: {ToZoneName}", fromZoneName, toZoneName);

        if (string.IsNullOrEmpty(fromZoneName) || string.IsNullOrEmpty(toZoneName))
            return rates;

        // Get flight rate
        Log.Debug("Finding AirFreightRateId");
        var airFreightRateId = await repository.GetAirFreightRateIdFromZoneComboAsync(carrierId.Value, fromZoneName, toZoneName);
       Log.Debug("AirFreightRateId: {AirFreightRateId}", airFreightRateId);
        if (airFreightRateId == null)
            return rates;

        // Get available rates
        var airFreightRates = await repository.GetAirFreightRatesAsync(airFreightRateId.Value);
        Log.Debug("Found {Count} rates for AirFreightRateId {AirFreightRateId}", airFreightRates.Count, airFreightRateId.Value);

        foreach (var afr in airFreightRates)
        {
            // Calculate flight base charge amountZ
            var flightBaseChargeAmount = afr.FlightBaseCharge ?? 0;

            // Calculate cargo surcharge amount
            decimal cargoSurchargeAmount = 0;
            if (afr.CargoSurchargeWeightBreakpoint.HasValue)
            {
                if (afr.CargoSurchargeWeightBreakpoint.Value >= dto.TotalWeight)
                    cargoSurchargeAmount = afr.CargoSurchargeBelowCharge ?? 0;
                else
                    cargoSurchargeAmount = (afr.CargoSurchargeAboveRate ?? 0) * dto.TotalWeight;
            }
            Log.Debug("CargoSurchargeAmount: {CargoSurchargeAmount}", cargoSurchargeAmount);

            // Weight break calculations
            decimal weightBreakRate = 0;
            var weightBreakGroup = await repository.GetByIdAsync<WeightBreakGroup>(afr.WeightBreakGroupId ?? 0);
            Log.Debug("WeightBreakGroup: {WeightBreakGroup}", weightBreakGroup);

            if (weightBreakGroup != null)
            {
                var weightForBreaks = weightBreakGroup.AverageWeight ? dto.TotalWeight / dto.Quantity : dto.TotalWeight;
                decimal weightBreakTotal = 0;

                // Get applicable weight break
                var weightBreakIds = new List<int?>
                {
                    weightBreakGroup.FirstWeightBreak,
                    weightBreakGroup.SecondWeightBreak,
                    weightBreakGroup.ThirdWeightBreak,
                    weightBreakGroup.FourthWeightBreak,
                    weightBreakGroup.FifthWeightBreak
                };

                foreach (var breakId in weightBreakIds.Where(id => id.HasValue))
                {
                    var weightBreak = await repository.GetByIdAsync<WeightBreak>(breakId.Value);

                    if (weightBreak == null ||
                        weightForBreaks < weightBreak.StartWeight ||
                        (weightBreak.EndWeight.HasValue && weightForBreaks >= weightBreak.EndWeight.Value)) continue;

                    weightBreakTotal = weightBreak.BaseCharge ?? 0;
                    if (weightBreak.ExtraWeightRate.HasValue && !weightBreak.EndWeight.HasValue)
                    {
                        weightBreakTotal += weightBreak.ExtraWeightRate.Value * (weightForBreaks - weightBreak.StartWeight);
                    }
                    break;
                }

                // If average weight turned on, multiply by quantity
                weightBreakRate = weightBreakGroup.AverageWeight ? weightBreakTotal * dto.Quantity : weightBreakTotal;
            }

            // Get extra item multiplier
            var extraItemMultiplier = await repository.GetExtraItemMultiplierByExtraChargeIdAsync(afr.ExtraChargeId ?? 0) ?? 0;

            // Calculate fuel surcharges
            var flightBaseChargeFuel = (afr.ApplyFlightBaseChargeFuel ?? false ?
                flightBaseChargeAmount * (1 + afr.AirFreightFuelSurcharge) :
                flightBaseChargeAmount) ?? 0;

            var cargoSurchargeFuel = (afr.ApplyCargoSurchargeFuel ?? false ?
                cargoSurchargeAmount * (1 + afr.AirFreightFuelSurcharge) :
                cargoSurchargeAmount) ?? 0;

            // Calculate total job amount
            var totalJobAmount = (flightBaseChargeAmount + flightBaseChargeFuel + weightBreakRate +
                                  cargoSurchargeAmount + cargoSurchargeFuel) *
                                 (1 + extraItemMultiplier * (dto.Quantity - 1));
            
            // Calculate extra rates
            var extraRates = await repository.CalculateExtraRatesAsync(new ExtraRateCalculationRequest
            {
                TotalWeight = dto.TotalWeight,
                Quantity = dto.Quantity,
                Cubic = dto.Cubic,
                TotalPallets = dto.TotalPallets,
                ExtraStopOffs = dto.ExtraStopOffs,
                VehicleSizeId = dto.VehicleSizeId,
                DangerousGoods = dto.DangerousGoods,
                DryIceWeight = dto.DryIceWeight,
                WaitTime = dto.WaitTime,
                ExtraChargeId = afr.ExtraChargeId,
                IsHoliday = isHoliday,
                IsAfterHours = isAfterHours,
                FuelSurcharge = afr.AirFreightFuelSurcharge ?? 0,
                FromZoneCongestionId = null,
                ToZoneCongestionId = null,
                Ppd = dto.Ppd
            });

            // Get job type information
            var jobType = await repository.GetJobTypeFlightRatingDtoAsync(afr.SpeedId ?? 0);

            if (jobType != null)
            {
                rates.Add(new FlightRateDto
                {
                    JobTypeId = jobType.JobTypeId,
                    Name = jobType.JobTypeName,
                    Speed = jobType.JobTypeName,
                    Description = jobType.Description,
                    Rate = totalJobAmount + extraRates.Amount,
                    SaleRate = totalJobAmount + extraRates.DriverPay,
                    Availability = "Available",
                    AvailabilityColour = "#00FF00",
                    BookDate = bookTime,
                    Duration = jobType.Mins,
                    FlightRate = totalJobAmount
                });
            }
        }

        return rates;
    }
}

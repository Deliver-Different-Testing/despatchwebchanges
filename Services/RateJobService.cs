using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Services;

public class RateJobService(
    IJobRepository jobRepository,
    ILogger<RateJobService> logger,
    IHttpClientFactory httpClientFactory)
    : IRateJobService
{
    private readonly HttpClient _httpClient = httpClientFactory.CreateClient("HereMaps");

    public async Task<JobRateResult> CalculateJobRateUs(JobRateRequest request)
    {
        var speed = await jobRepository.GetJobTypeById(request.SpeedId);
        var speedGrouping = await jobRepository.GetJobTypeGrouping(speed.GroupingId);

        var result = new JobRateResult
        {
            TotalMiles = 0,
            FromMiles = 0,
            ToMiles = 0
        };

        if (speedGrouping.GroupingName != "Flight")
        {
            result.TotalMiles = await CalculateRoadDistance(
                request.PickupLat,
                request.PickupLong,
                request.DeliveryLat,
                request.DeliveryLong);
        }
        else
        {
            // Get closest airports
            var closestFromAirports = await jobRepository.GetClosestAirports(
                request.PickupLat ?? 0,
                request.PickupLong ?? 0);
            var closestToAirports = await jobRepository.GetClosestAirports(
                request.DeliveryLat ?? 0,
                request.DeliveryLong ?? 0);

            result.FromAirport = closestFromAirports.First();
            result.ToAirport = closestToAirports.First();

            result.FromMiles = await CalculateRoadDistance(
                request.PickupLat,
                request.PickupLong,
                result.FromAirport.Latitude,
                result.FromAirport.Longitude);

            result.ToMiles = await CalculateRoadDistance(
                result.ToAirport.Latitude,
                result.ToAirport.Longitude,
                request.DeliveryLat,
                request.DeliveryLong);
        }

        return result;
    }

    public async Task<decimal> RateJob(JobRatingDetailsDto jobDetails)
    {
        try
        {
            var rate = await jobRepository.RateJobAsync(
                jobDetails.ClientId,
                jobDetails.FromId,
                jobDetails.ToId,
                jobDetails.SpeedId,
                jobDetails.IsPedal,
                jobDetails.IsVan,
                jobDetails.IsReturnJob,
                (int)jobDetails.Weight,
                jobDetails.SizeId,
                jobDetails.IncludeFuelSurcharge,
                jobDetails.IsDirect,
                jobDetails.AcceptedJobTypeId,
                jobDetails.OurRef,
                jobDetails.RefA,
                jobDetails.RefB,
                jobDetails.Quantity,
                jobDetails.BookedDate
            );

            return rate;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error calculating job rate for job ID {JobId}", jobDetails.JobId);
            throw new ApplicationException($"Failed to calculate job rate for job ID {jobDetails.JobId}", ex);
        }
    }

    // Keep the old method for backward compatibility

    public async Task RateJobUs(JobRatingDetailsDto jobDetails)
    {
        try
        {
            // Get distances and airport info
            var distanceResult = await CalculateJobRateUs(
                new JobRateRequest
                {
                    SpeedId = jobDetails.SpeedId,
                    PickupLat = jobDetails.PickupLat,
                    PickupLong = jobDetails.PickupLong,
                    DeliveryLat = jobDetails.DeliveryLat,
                    DeliveryLong = jobDetails.DeliveryLong,
                }
            );

            // Calculate final rate
            await jobRepository.RateJobUsAsync(
                jobDetails.JobId,
                jobDetails.ClientId,
                jobDetails.SpeedId,
                jobDetails.FromZip,
                jobDetails.ToZip,
                (decimal)distanceResult.TotalMiles, // Used for non-flight jobs
                (decimal)distanceResult.FromMiles, // Used for flight jobs
                (decimal)distanceResult.ToMiles, // Used for flight jobs
                (int)jobDetails.Weight,
                jobDetails.BookedDate,
                jobDetails.SizeId,
                jobDetails.DangerousGoods,
                jobDetails.TotalPallets,
                jobDetails.ExtraStopOffs,
                (int)jobDetails.DryIceWeight,
                jobDetails.WaitTime,
                distanceResult.FromAirport?.AgentId ?? jobDetails.FromAgentId,
                distanceResult.FromAirport?.AirportId ?? jobDetails.FromAirportId,
                distanceResult.ToAirport?.AgentId ?? jobDetails.ToAgentId,
                distanceResult.ToAirport?.AirportId ?? jobDetails.ToAirportId
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error calculating US job rate for job ID {JobId}", jobDetails.JobId);
            throw new ApplicationException($"Failed to calculate US job rate for job ID {jobDetails.JobId}", ex);
        }
    }
    
    private async Task<double> CalculateRoadDistance(decimal? fromLatitude, decimal? fromLongitude, decimal? toLatitude,
        decimal? toLongitude)
    {
        if (!AreValidCoordinates(fromLatitude, fromLongitude, toLatitude, toLongitude))
            return 0;

        var fromLatLng = $"{fromLatitude},{fromLongitude}";
        var toLatLng = $"{toLatitude},{toLongitude}";

        var routeResponse = await GetHereMapRoute(fromLatLng, toLatLng);
        return CalculateMilesFromRoute(routeResponse);
    }

    private static bool AreValidCoordinates(decimal? fromLat, decimal? fromLong, decimal? toLat, decimal? toLong) =>
        fromLat.HasValue && fromLat != 0 &&
        fromLong.HasValue && fromLong != 0 &&
        toLat.HasValue && toLat != 0 &&
        toLong.HasValue && toLong != 0;

    private async Task<HereMapRouteResponseV8> GetHereMapRoute(string fromLatLng, string toLatLng)
    {
        var queryParams = new Dictionary<string, string>
        {
            { "apiKey", Environment.GetEnvironmentVariable("HereMapsAPIKey") },
            { "origin", fromLatLng },
            { "destination", toLatLng },
            { "routingMode", "fast" },
            { "transportMode", "car" },
            { "departureTime", "any" },
            { "return", "summary" }
        };

        var queryString = string.Join("&", queryParams.Select(p =>
            $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

        try
        {
            var response = await _httpClient.GetAsync($"routes?{queryString}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<HereMapRouteResponseV8>();
            if (result == null)
                throw new ApplicationException("Failed to deserialize HERE Maps API response");

            return result;
        }
        catch (HttpRequestException ex)
        {
            throw new ApplicationException("HERE Maps API request failed", ex);
        }
        catch (Exception ex)
        {
            throw new ApplicationException("Failed to get route from HERE Maps API", ex);
        }
    }

    private static double CalculateMilesFromRoute(HereMapRouteResponseV8 routeResponse)
    {
        if (routeResponse?.Routes == null || routeResponse.Routes.Count == 0)
            return 0;

        var totalMeters = routeResponse.Routes[0].Sections
            .Where(s => s.Transport.Mode == "car")
            .Sum(s => s.Summary.Length);

        return Math.Round(totalMeters / 1609.344);
    }
}

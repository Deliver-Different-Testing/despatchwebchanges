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


    public async Task<decimal> RateJobAsync(JobRatingDetailsDto jobDetails)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobDetails);
            ArgumentNullException.ThrowIfNull(jobDetails.ClientId);
            ArgumentNullException.ThrowIfNull(jobDetails.FromId);
            ArgumentNullException.ThrowIfNull(jobDetails.ToId);
            ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
            ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
            ArgumentNullException.ThrowIfNull(jobDetails.SizeId);
            
            var rate = await jobRepository.RateJobAsync(
                jobDetails.ClientId.Value,
                jobDetails.FromId.Value,
                jobDetails.ToId.Value,
                jobDetails.SpeedId.Value,
                jobDetails.IsPedal,
                jobDetails.IsVan,
                jobDetails.IsReturnJob,
                jobDetails.Weight.HasValue ? (int)jobDetails.Weight.Value : 0,
                jobDetails.SizeId.Value,
                jobDetails.IncludeFuelSurcharge,
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

    public async Task RateJobUsAsync(JobRatingDetailsDto jobDetails)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobDetails);
            ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
            ArgumentNullException.ThrowIfNull(jobDetails.ClientId);
            ArgumentNullException.ThrowIfNull(jobDetails.SizeId);
            
            // Get distances and airport info
            var distanceResult = await CalculateJobRateUs(
                new JobRateRequest
                {
                    SpeedId = jobDetails.SpeedId.Value,
                    PickupLat = jobDetails.PickupLat,
                    PickupLong = jobDetails.PickupLong,
                    DeliveryLat = jobDetails.DeliveryLat,
                    DeliveryLong = jobDetails.DeliveryLong
                }
            );

            // Calculate final rate
            await jobRepository.RateJobUsAsync(new RateJobUsDto
            {
                JobId = jobDetails.JobId,
                ClientId = jobDetails.ClientId.Value,
                Speed = jobDetails.SpeedId.Value,
                FromZip = jobDetails.FromZip,
                ToZip = jobDetails.ToZip,
                TotalMiles = (decimal)distanceResult.TotalMiles, // Used for non-flight jobs
                FromMiles = (decimal)distanceResult.FromMiles, // Used for flight jobs
                ToMiles = (decimal)distanceResult.ToMiles, // Used for flight jobs
                Weight = jobDetails.Weight.HasValue ? (int)jobDetails.Weight : 0,
                Booked = jobDetails.BookedDate,
                Size = jobDetails.SizeId.Value,
                DangerousGoods = jobDetails.DangerousGoods,
                TotalPallets = jobDetails.TotalPallets,
                ExtraStopOffs = jobDetails.ExtraStopOffs,
                DryIceWeight = (int)jobDetails.DryIceWeight,
                WaitTime = jobDetails.WaitTime,
                FromAgentId = distanceResult.FromAirport?.AgentId ?? jobDetails.FromAgentId,
                FromAirportId = distanceResult.FromAirport?.AirportId ?? jobDetails.FromAirportId,
                ToAgentId = distanceResult.ToAirport?.AgentId ?? jobDetails.ToAgentId,
                ToAirportId = distanceResult.ToAirport?.AirportId ?? jobDetails.ToAirportId,
                Quantity = jobDetails.Quantity,
                Cubic = jobDetails.Cubic,
                IsPrebook = jobDetails.IsPrebook ?? false,
                CalculateDimsOncePerJob = jobDetails.CalculateDimsOncePerJob
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error calculating US job rate for job ID {JobId}", jobDetails.JobId);
            throw new ApplicationException($"Failed to calculate US job rate for job ID {jobDetails.JobId}", ex);
        }
    }

     private async Task<JobRateResult> CalculateJobRateUs(JobRateRequest request)
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

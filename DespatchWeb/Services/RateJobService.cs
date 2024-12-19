using System;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Config;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Options;
using RestSharp;

namespace DespatchWeb.Services;

public class RateJobService : IRateJobService
{
    private readonly HereMapsConfig _hereConfig;
    private readonly IJobRepository _jobRepository;
    private readonly RestClient _restClient;

    public RateJobService(
        IJobRepository jobRepository,
        IOptions<HereMapsConfig> hereConfig
    )
    {
        _jobRepository = jobRepository;
        _hereConfig = hereConfig.Value;
        _restClient = new RestClient("https://router.hereapi.com/v8/");
    }

    public async Task<JobRateResult> CalculateJobRateUs(JobRateRequest request)
    {
        var speed = await _jobRepository.GetJobTypeById(request.SpeedId);
        var speedGrouping = await _jobRepository.GetJobTypeGrouping(speed.GroupingId ?? 0);

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
            var closestFromAirports = await _jobRepository.GetClosestAirports(
                request.PickupLat ?? 0,
                request.PickupLong ?? 0);
            var closestToAirports = await _jobRepository.GetClosestAirports(
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
        {
            return 0;
        }

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
        var request = new RestRequest("routes")
            .AddQueryParameter("apiKey", _hereConfig.ApiKey)
            .AddQueryParameter("origin", fromLatLng)
            .AddQueryParameter("destination", toLatLng)
            .AddQueryParameter("routingMode", "fast")
            .AddQueryParameter("transportMode", "car")
            .AddQueryParameter("departureTime", "any")
            .AddQueryParameter("return", "summary");

        try
        {
            var response = await _restClient.ExecuteGetAsync<HereMapRouteResponseV8>(request);

            if (!response.IsSuccessful)
                throw new ApplicationException($"HERE Maps API request failed: {response.ErrorMessage}");

            return response.Data;
        }
        catch (Exception ex)
        {
            throw new ApplicationException("Failed to get route from HERE Maps API", ex);
        }
    }

    private static double CalculateMilesFromRoute(HereMapRouteResponseV8 routeResponse)
    {
        if (routeResponse?.Routes == null || !routeResponse.Routes.Any())
            return 0;

        var totalMeters = routeResponse.Routes[0].Sections
            .Where(s => s.Transport.Mode == "car")
            .Sum(s => s.Summary.Length);

        return Math.Round(totalMeters / 1609.344);
    }
}

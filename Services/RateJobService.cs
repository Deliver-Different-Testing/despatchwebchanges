using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Http;
using Serilog;

namespace DespatchWeb.Services;

public class RateJobService(
    IJobRepository jobRepository,
    HttpClient httpClient,
    ITenantInfoService infoService,
    IHttpContextAccessor contextAccessor)
    : IRateJobService
{
    private const string HereMapsApiBaseUrl = "https://router.hereapi.com/v8";

    public async Task<decimal> RateJobNzAsync(JobRatingDetailsDtoNz jobDetails)
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

            var rateResult = await RateUrgentJobAsync(jobDetails);
            return rateResult.Rate;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobNzAsync)));
            throw;
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
            var distanceResult = await CalculateJobRateUsAsync(
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
                CalculateDimsOncePerJob = jobDetails.CalculateDimsOncePerJob,
                PreviousRate = jobDetails.PreviousRate
            });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobUsAsync)));
            throw;
        }
    }

    private async Task<JobRateResult> CalculateJobRateUsAsync(JobRateRequest request)
    {
        var isUsCustomer = infoService.IsUsTenant();
        var speed = await jobRepository.GetJobTypeByIdAsync(request.SpeedId);
        var speedGrouping = speed.Grouping;

        var result = new JobRateResult
        {
            TotalMiles = 0,
            FromMiles = 0,
            ToMiles = 0
        };

        if (speedGrouping.GroupingId != (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight))
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
            var closestFromAirports = await jobRepository.GetClosestAirportsAsync(
                request.PickupLat ?? 0,
                request.PickupLong ?? 0);
            var closestToAirports = await jobRepository.GetClosestAirportsAsync(
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
            var response = await httpClient.GetAsync($"{HereMapsApiBaseUrl}/routes?{queryString}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<HereMapRouteResponseV8>();
            return result ?? throw new ApplicationException("Failed to deserialize HERE Maps API response");
        }
        catch (HttpRequestException ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobUsAsync)));
            throw new ApplicationException("HERE Maps API request failed", ex);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobUsAsync)));
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

    public async Task<ApiRerate> RateUrgentJobAsync(JobRatingDetailsDtoNz jobDetails)
    {
        try
        {
            // Map Job Object
            var jobObject = MapToUrgentRerateObject(jobDetails);

            // Generate DFRNT Api Token
            var connectionString =
                contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            ArgumentException.ThrowIfNullOrEmpty(connectionString);
            var tenantId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")
                ?.Value;
            ArgumentException.ThrowIfNullOrEmpty(tenantId);
            var timeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
            ArgumentException.ThrowIfNullOrEmpty(timeZone);
            var userName = contextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value;
            ArgumentException.ThrowIfNullOrEmpty(userName);

            var token = AuthenticationExtensions.CreateApiToken(userName,
                int.Parse(tenantId),
                connectionString,
                timeZone);

            var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

            // Call DFRNT API
            var baseUrl = Environment.GetEnvironmentVariable("WebAPIUrl");

            var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/rates/getRerateAmount");
            request.Headers.Add("Authorization", $"Bearer {requestToken}");
            request.Content = JsonContent.Create(jobObject);

            var response = await httpClient.SendAsync(request);
            var rawContent = await response.Content.ReadAsStringAsync();
            Log.Debug("Raw response: {RawContent}", rawContent);

            if (!response.IsSuccessStatusCode)
            {
                Log.Error("Request failed with status code {ResponseStatusCode}", response.StatusCode);
                Log.Error("Response content: {ReadAsStringAsync}", rawContent);
            }
            
            var rerateResponse = await response.Content.ReadFromJsonAsync<RerateApiResponse>();
            return rerateResponse.ApiRerate ?? throw new ApplicationException("Failed to get rate from DFRNT API");
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RateJobService), nameof(RateUrgentJobAsync)));
            throw;
        }
    }

    private static UrgentRerateObject MapToUrgentRerateObject(JobRatingDetailsDtoNz dto)
    {
        ArgumentNullException.ThrowIfNull(dto);

        return new UrgentRerateObject
        {
            SpeedId = dto.SpeedId ?? 0,
            SizeId = dto.SizeId ?? 0,
            From = new UrgentRerateAddressObject
            {
                CompanyName = dto.FromCompanyName,
                BuildingName = dto.FromBuildingName,
                StreetAddress = dto.FromStreetAddress,
                City = dto.FromCity,
                State = dto.FromState,
                Suburb = dto.FromSuburb,
                ZipCode = dto.FromZip ?? dto.FromPostCode,
                PostCode = dto.FromPostCode ?? dto.FromZip,
                CountryCode = dto.FromCountryCode,
                Latitude = dto.PickupLat,
                Longitude = dto.PickupLong
            },
            To = new UrgentRerateAddressObject
            {
                CompanyName = dto.ToCompanyName,
                BuildingName = dto.ToBuildingName,
                StreetAddress = dto.ToStreetAddress,
                City = dto.ToCity,
                State = dto.ToState,
                Suburb = dto.ToSuburb,
                ZipCode = dto.ToZip ?? dto.ToPostCode,
                PostCode = dto.ToPostCode ?? dto.ToZip,
                CountryCode = dto.ToCountryCode,
                Latitude = dto.DeliveryLat,
                Longitude = dto.DeliveryLong
            },
            Packages = MapPackages(dto.Packages),
            Weight = dto.Weight.HasValue ? (int)(dto.Weight ?? 0) : 0,
            Quantity = dto.Quantity,
            IsDangerousGoods = dto.DangerousGoods,
            IsPrebook = dto.IsPrebook,
            DateTime = dto.BookedDate,
            Van = dto.IsVan ? true : null,
            Bike = dto.IsPedal ? true : null,
            Truck = CreateTruckObject(dto),
            OurReference = dto.OurRef,
            ClientReferenceA = dto.RefA,
            ClientReferenceB = dto.RefB
        };
    }

    private static IEnumerable<UrgentPackageObject> MapPackages(List<PackageDetailsDto> packages)
    {
        if (packages == null || packages.Count == 0) return new List<UrgentPackageObject>();

        return packages.Select(p => new UrgentPackageObject
        {
            Name = p.Name,
            Length = p.Length,
            Width = p.Width,
            Height = p.Height,
            Cubic = p.Cubic,
            Kg = p.Kg,
            Type = p.Type,
            PackageCode = p.PackageCode,
            Units = p.Units
        });
    }

    private static UrgentTruckObject CreateTruckObject(JobRatingDetailsDtoNz dto)
    {
        if (dto.PickupTailLift.HasValue || dto.DropoffTailLift.HasValue || dto.PrivateRes.HasValue ||
            dto.HasDgDocuments.HasValue || !string.IsNullOrEmpty(dto.TruckStartTime) ||
            dto.TruckHours.HasValue || (!dto.IsPedal && !dto.IsVan))
        {
            return new UrgentTruckObject
            {
                PickupTailLift = dto.PickupTailLift,
                DropoffTailLift = dto.DropoffTailLift,
                PrivateRes = dto.PrivateRes,
                HasDgDocuments = dto.HasDgDocuments ?? (dto.DangerousGoods ? true : null),
                TruckStartTime = dto.TruckStartTime,
                TruckHours = dto.TruckHours ?? (dto.WaitTime > 0 ? dto.WaitTime : null)
            };
        }

        return null;
    }
}
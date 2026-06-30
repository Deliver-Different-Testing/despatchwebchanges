using System.Globalization;
using System.Security.Claims;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Serilog;

namespace DespatchWeb.Services.JobApi;

/// <summary>
/// DespatchWeb-side wrapper around <see cref="IDespatchApiClient"/>. Reads the per-tenant
/// SC-claim context off the inbound HttpContext, maps the user-facing <see cref="JobCreateViewModel"/>
/// to the api's <see cref="BookPickupDto"/>, then delegates to the low-level client. Throws on
/// api-side errors so callers (JobRepository.QuickAddJobAsync) keep their int-returning contract.
/// </summary>
public sealed class JobApiClient(
    IDespatchApiClient despatchApiClient,
    IHttpContextAccessor contextAccessor) : IJobApiClient
{
    public async Task<int> QuickCreateAsync(JobCreateViewModel request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var context = ResolveTenantContext(request.ClientId);
        var payload = MapToBookPickup(request, context.CountryCode);

        JobResponseDto response;
        try
        {
            response = await despatchApiClient.BookPickupAsync(
                context.TenantId,
                context.Connection,
                context.TimeZone,
                context.ClientId,
                context.ContactId,
                payload,
                cancellationToken);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobApiClient), nameof(QuickCreateAsync)));
            throw;
        }

        if (response.Error is { Message: var transportMsg } && !string.IsNullOrEmpty(transportMsg))
        {
            throw new InvalidOperationException($"Job API call failed: {Snippet(transportMsg)}");
        }

        if (response.Errors is not { Count: > 0 })
        {
            return response.JobId is > 0
                ? response.JobId.Value
                : throw new InvalidOperationException("Job API did not return a JobID");
        }

        var msg = string.Join("; ",
            response.Errors.Select(e => string.IsNullOrEmpty(e.Property) ? e.Message : $"{e.Property}: {e.Message}"));
        throw new InvalidOperationException($"Job API rejected request: {msg}");
    }

    private TenantApiContext ResolveTenantContext(int requestClientId)
    {
        var user = contextAccessor.HttpContext?.User;
        var connection = user?.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = user?.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var timeZone = user?.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var contactIdClaim = user?.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;
        var countryCode = user?.Claims.FirstOrDefault(x => x.Type == "CountryCode")?.Value;
        var userName = user?.FindFirst(ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(connection) ||
            string.IsNullOrEmpty(tenantId) ||
            string.IsNullOrEmpty(timeZone) ||
            string.IsNullOrEmpty(userName))
        {
            throw new InvalidOperationException(
                "Missing required user claims (Connection, CurrentTenantID, TimeZone, Name) to call the Job API.");
        }

        return new TenantApiContext(
            TenantId: int.Parse(tenantId),
            Connection: connection,
            TimeZone: timeZone,
            ClientId: requestClientId > 0 ? requestClientId : null,
            ContactId: string.IsNullOrEmpty(contactIdClaim) ? 0 : int.Parse(contactIdClaim),
            CountryCode: countryCode);
    }

    private static BookPickupDto MapToBookPickup(JobCreateViewModel request, string countryCode)
    {
        var isUs = string.Equals(countryCode, "US", StringComparison.OrdinalIgnoreCase);
        var pickupAddress = MapAddress(request.PickUpAddress, countryCode, isUs);
        var deliveryAddress = MapAddress(request.DeliveryAddress, countryCode, isUs);

        return new BookPickupDto
        {
            QuoteId = request.SpeedId.ToString(CultureInfo.InvariantCulture),
            SpeedId = request.SpeedId,
            Pickup = new PickupDto
            {
                Name = NonEmpty(request.PickUpAddress?.AddressLine1) ?? request.FromContactName ?? "Pickup",
                ContactPerson = NonEmpty(request.FromContactName) ?? "Pickup",
                From = pickupAddress,
                Notes = request.PickupNotes
            },
            Delivery = new DeliveryDto
            {
                Name = NonEmpty(request.DeliveryAddress?.AddressLine1) ?? request.DeliverToContact ?? "Delivery",
                ContactPerson = NonEmpty(request.DeliverToContact) ?? "Delivery",
                To = deliveryAddress,
                Notes = request.DeliveryNotes
            },
            Packages =
            [
                new PackageDto
                {
                    Name = "custom",
                    Cubic = 0,
                    Kg = request.WeightKg,
                    Lb = request.WeightLb,
                    Units = 1
                }
            ],
            DateTime = request.Date.DateTime,
            ClientReferenceA = request.RefA,
            ClientReferenceB = request.RefB,
            ClientNotes = request.JobNotes,
            FixedAmount = request.Charge,
            VehicleSizeId = request.VehicleId,
            OnHold = false,
            IsSignatureRequired = true
        };
    }

    /// <summary>
    /// Maps the 8-line <see cref="AddressViewModel"/> to the api's <see cref="AddressDto"/>.
    /// Line meaning is country-specific (matching the frontend create-job dialog):
    /// L1 company, L2 unit, L3 street number, L4 street name, then
    /// L5/L6/L7 = city/state/zip for US, suburb/city/postcode for NZ. L8 holds a free-form
    /// country name and is intentionally ignored — the ISO-2 <paramref name="countryCode"/>
    /// comes from the tenant claim, which is what the api validates against.
    /// </summary>
    private static AddressDto MapAddress(AddressViewModel address, string countryCode, bool isUs)
    {
        if (address is null)
        {
            return new AddressDto { City = string.Empty, CountryCode = countryCode };
        }

        return new AddressDto
        {
            CompanyName = address.AddressLine1,
            BuildingName = address.AddressLine2,
            StreetAddress = JoinStreet(address.AddressLine3, address.AddressLine4),
            Suburb = isUs ? null : NonEmpty(address.AddressLine5),
            City = (isUs ? NonEmpty(address.AddressLine5) : NonEmpty(address.AddressLine6)) ?? string.Empty,
            State = isUs ? NonEmpty(address.AddressLine6) : null,
            ZipCode = isUs ? NonEmpty(address.AddressLine7) : null,
            PostCode = isUs ? null : NonEmpty(address.AddressLine7),
            CountryCode = countryCode,
            Latitude = address.Latitude,
            Longitude = address.Longitude
        };
    }

    private static string JoinStreet(string number, string street)
    {
        var joined = string.Join(" ", new[] { number, street }.Where(p => !string.IsNullOrWhiteSpace(p)));
        return NonEmpty(joined);
    }

    private static string NonEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private static string Snippet(string body)
    {
        if (string.IsNullOrEmpty(body))
        {
            return string.Empty;
        }

        return body.Length > 200 ? body[..200] + "…" : body;
    }

    private sealed record TenantApiContext(
        int TenantId,
        string Connection,
        string TimeZone,
        int? ClientId,
        int ContactId,
        string CountryCode);
}
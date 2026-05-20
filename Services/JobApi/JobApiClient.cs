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
        var payload = MapToBookPickup(request);

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
            throw new InvalidOperationException($"Job API call failed: {Snippet(transportMsg)}");

        if (response.Errors is { Count: > 0 })
        {
            var msg = string.Join("; ",
                response.Errors.Select(e => string.IsNullOrEmpty(e.Property) ? e.Message : $"{e.Property}: {e.Message}"));
            throw new InvalidOperationException($"Job API rejected request: {msg}");
        }

        return response.JobId is > 0
            ? response.JobId.Value
            : throw new InvalidOperationException("Job API did not return a JobID");
    }

    private TenantApiContext ResolveTenantContext(int requestClientId)
    {
        var user = contextAccessor.HttpContext?.User;
        var connection = user?.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = user?.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var timeZone = user?.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var contactIdClaim = user?.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;
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
            ContactId: string.IsNullOrEmpty(contactIdClaim) ? 0 : int.Parse(contactIdClaim));
    }

    private static BookPickupDto MapToBookPickup(JobCreateViewModel request)
    {
        var pickupAddress = MapAddress(request.PickUpAddress);
        var deliveryAddress = MapAddress(request.DeliveryAddress);

        return new BookPickupDto
        {
            QuoteId = request.SpeedId.ToString(System.Globalization.CultureInfo.InvariantCulture),
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
                new PackageDto { Name = "custom", Cubic = 0, Kg = 0, Units = 1 }
            ],
            DateTime = request.Date.DateTime,
            ClientReferenceA = request.RefA,
            ClientReferenceB = request.RefB,
            ClientNotes = request.JobNotes,
            FixedAmount = request.Charge,
            OnHold = false,
            IsSignatureRequired = true
        };
    }

    private static AddressDto MapAddress(AddressViewModel address)
    {
        if (address is null)
            return new AddressDto { City = string.Empty };

        return new AddressDto
        {
            CompanyName = address.AddressLine1,
            BuildingName = address.AddressLine2,
            StreetAddress = address.AddressLine3,
            Suburb = address.AddressLine4,
            City = NonEmpty(address.AddressLine5) ?? NonEmpty(address.AddressLine4) ?? string.Empty,
            PostCode = address.AddressLine6,
            CountryCode = address.AddressLine8,
            Latitude = address.Latitude,
            Longitude = address.Longitude
        };
    }

    private static string NonEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private static string Snippet(string body)
    {
        if (string.IsNullOrEmpty(body)) return string.Empty;
        return body.Length > 200 ? body[..200] + "…" : body;
    }

    private sealed record TenantApiContext(int TenantId, string Connection, string TimeZone, int? ClientId, int ContactId);
}

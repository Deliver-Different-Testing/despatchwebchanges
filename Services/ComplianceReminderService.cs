using System.Globalization;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

public sealed class ComplianceReminderService(
    ICourierRepository courierRepository,
    IMessageRepository messageRepository) : IComplianceReminderService
{
    public const int MaxRecipients = 200;

    public async Task<ComplianceReminderResult> SendAsync(SendComplianceRemindersRequest request)
    {
        if (!request.HasExactlyOneTarget)
        {
            throw new InvalidListQueryException("Specify exactly one of courierIds or filter.");
        }

        if (!Enum.IsDefined(request.Channel))
        {
            throw new InvalidListQueryException("channel must be 1 (App) or 2 (Sms).");
        }

        var filter = request.Filter is null
            ? null
            : new CourierComplianceFilterRequest
            {
                SearchTerm = request.Filter.SearchTerm,
                Fleet = request.Filter.Fleet,
                Type = request.Filter.Type,
                Status = request.Filter.Status
            };

        var drivers = await courierRepository.GetComplianceAttentionAsync(request.CourierIds, filter);
        var due = drivers.Where(d => d.Items.Count > 0).ToList();
        var nothingDue = drivers.Count - due.Count;

        if (request.Preview)
        {
            return new ComplianceReminderResult(due.Count, 0, nothingDue, 0, [], MaxRecipients);
        }

        if (due.Count > MaxRecipients)
        {
            throw new InvalidListQueryException(
                $"That's {due.Count} drivers. Narrow the filters to {MaxRecipients} or fewer.");
        }

        var failures = new List<ComplianceReminderFailure>();
        if (request.CourierIds is { Count: > 0 })
        {
            var known = drivers.Select(d => d.CourierId).ToHashSet();
            failures.AddRange(request.CourierIds.Distinct().Where(id => !known.Contains(id))
                .Select(id => new ComplianceReminderFailure(id, string.Empty, "Not an active driver")));
        }

        var sent = 0;
        foreach (var driver in due)
        {
            try
            {
                await messageRepository.SendMessageAsync(new SendMessageRequest
                {
                    SendToCourierId = driver.CourierId,
                    Message = Compose(driver),
                    MessageType = (int)request.Channel
                });
                sent++;
            }
            catch (Exception e)
            {
                if (e is ArgumentException)
                {
                    Log.Warning(e, "Compliance reminder failed for courier {CourierId}", driver.CourierId);
                }
                else
                {
                    Log.Error(e, "Compliance reminder failed for courier {CourierId}", driver.CourierId);
                }

                failures.Add(new ComplianceReminderFailure(driver.CourierId, driver.Name, FailureReason(e)));
            }
        }

        return new ComplianceReminderResult(due.Count, sent, nothingDue, failures.Count, failures, MaxRecipients);
    }

    private static string FailureReason(Exception e) => e switch
    {
        ArgumentException a when a.Message.Contains("mobile number", StringComparison.OrdinalIgnoreCase) =>
            "No mobile number",
        ArgumentException a when a.Message.Contains("not found or inactive", StringComparison.OrdinalIgnoreCase) =>
            "Not an active driver",
        _ => "Couldn't send"
    };

    public static string Compose(DriverComplianceAttention driver)
    {
        var lines = driver.Items
            .OrderBy(i => i.Status switch { ComplianceStatus.Expired => 0, ComplianceStatus.ExpiringSoon => 1, _ => 2 })
            .ThenBy(i => i.Expiry)
            .Select(Describe);
        var name = string.IsNullOrWhiteSpace(driver.FirstName) ? "there" : driver.FirstName.Trim();
        return $"Hi {name}, these need renewing: {string.Join(" ", lines)} Please update the office.";
    }

    private static string Describe(ComplianceAttentionItem item)
    {
        if (!item.Expiry.HasValue)
        {
            return $"{item.TypeLabel}: no expiry date on file.";
        }

        var date = item.Expiry.Value.ToString("d MMM yyyy", CultureInfo.InvariantCulture);
        return item.Status == ComplianceStatus.Expired
            ? $"{item.TypeLabel} expired {date}."
            : $"{item.TypeLabel} expires {date} ({DaysPhrase(item.DaysUntilExpiry ?? 0)}).";
    }

    private static string DaysPhrase(int days) => days switch
    {
        0 => "today",
        1 => "1 day",
        _ => $"{days} days"
    };
}

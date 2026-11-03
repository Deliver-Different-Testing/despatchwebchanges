using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IComplianceReminderService
{
    Task<ComplianceReminderResult> SendAsync(SendComplianceRemindersRequest request);
}

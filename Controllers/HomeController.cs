using System;
using System.Diagnostics;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public partial class HomeController(
    IClientRepository clientRepository,
    IDfrntViewsRepository viewsRepository,
    IConnectionStringManager connectionStringManager) : Controller
{
    public async Task<IActionResult> Index()
    {
        try
        {
            var staffId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
            var contactId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;
            var connectionString = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
            var countryCode = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CountryCode")?.Value;
            var tenantTimeZone = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;

            var usa = Country.Us.GetDescription();

            var isUsTenantFlag = countryCode?.ToUpper().Equals(usa);

            if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId))
            {
                Log.Error("Connection string or tenant ID is missing.");
                return BadRequest(new { error = "Connection string or tenant ID is missing." });
            }

            Log.Debug("Found Identity for StaffID:{StaffId}", staffId);
            var credentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? "";
            if (string.IsNullOrEmpty(credentials))
            {
                throw new InvalidOperationException(
                    "Could not find a environment variable string named 'SQLCredentials'.");
            }

            await connectionStringManager.SetConnectionStringAsync($"{tenantId}-ClientManager-Connection",
                connectionString + credentials);

            var maskedConnectionString = MaskSensitiveInfo(connectionString + credentials);
            Log.Debug("Connection String Set: {MaskedConnectionString}", maskedConnectionString);

            var clientDetail = await clientRepository.ValidateClientAsync(Convert.ToInt32(contactId));
            ViewBag.FirstName = clientDetail.FirstName;
            ViewBag.FullName = clientDetail.FullName;
            ViewBag.Email = clientDetail.Email;
            ViewBag.ClientInternal = clientDetail.Internal;
            ViewBag.ContactID = clientDetail.StaffID ?? int.Parse(contactId);
            ViewBag.IsUsTenant = isUsTenantFlag ?? false;
            ViewBag.TimeZone = tenantTimeZone;

            return View();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting client details");
            return Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "https://deliverdifferent.com/");
        }
    }

    public async Task<IActionResult> GetPageViews(int userId, int pageId)
    {
        var page = (AppPage)pageId;
        var viewOptions = await viewsRepository.GetViewsByUserAndPageAsync(userId, page);
        return Json(viewOptions);
    }

    private static string MaskSensitiveInfo(string connectionString)
    {
        // Mask password
        var maskedString = PasswordRegex().Replace(connectionString, "$1=********");

        // Mask user id if present
        maskedString = UserIdRegex().Replace(maskedString, "$1=********");

        return maskedString;
    }

    public async Task<IActionResult> ActiveClients(string searchTerm)
    {
        var result = await clientRepository.ActiveClientsAsync(searchTerm);
        return Json(result);
    }

    public async Task<IActionResult> ClientContacts(int contactId)
    {
        var result = await clientRepository.ClientContactsAsync(contactId);
        return Json(result);
    }


    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });

    [GeneratedRegex("(Password|Pwd)=[^;]*", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex PasswordRegex();
    [GeneratedRegex("(User ID|Uid)=[^;]*", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex UserIdRegex();
}

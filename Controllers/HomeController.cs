#nullable enable
using System.Diagnostics;
using System.Text.RegularExpressions;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public partial class HomeController(
    IClientRepository clientRepository,
    IDfrntViewsRepository viewsRepository,
    ITenantInfoService infoService,
    IConnectionStringManager connectionStringManager,
    ISessionContextService sessionContextService) : Controller
{
    [Authorize]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public async Task<IActionResult> Index()
    {
        try
        {
            var staffId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
            var connectionString = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;

            if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId))
            {
                var hubUrl = Environment.GetEnvironmentVariable("HubUrl");

                Log.Error("Connection string or tenant ID is missing");
                return Redirect(hubUrl ?? "https://deliverdifferent.com/");
            }

            Log.Debug("Found Identity for StaffID:{StaffId}", staffId);
            var credentials = Environment.GetEnvironmentVariable("SQLCredentials");
            if (string.IsNullOrEmpty(credentials))
            {
                throw new InvalidOperationException(
                    "Could not find a environment variable string named 'SQLCredentials'.");
            }

            await connectionStringManager.SetConnectionStringAsync(TenantConnectionCache.Key(tenantId),
                connectionString + credentials);

            var maskedConnectionString = MaskSensitiveInfo(connectionString + credentials);
            Log.Debug("Connection String Set: {MaskedConnectionString}", maskedConnectionString);

            var context = await sessionContextService.BuildAsync(HttpContext.User);
            ViewBag.FirstName = context.FirstName;
            ViewBag.FullName = context.FullName;
            ViewBag.Email = context.Email;
            ViewBag.ClientInternal = context.ClientInternal;
            ViewBag.IsNetworkPartner = context.IsNetworkPartner;
            ViewBag.ContactID = context.ContactId;
            ViewBag.IsUsTenant = context.IsUsTenant;
            ViewBag.TimeZone = context.TimeZone;
            ViewBag.VisibleFeatures = context.VisibleFeatures;
            ViewBag.NpMapCenter = context.NpMapCenter;

            return View();
        }
        catch (Exception ex)
        {
            var message = ErrorMessageStringFormatter.Format(ex);
            Log.Error(ex, "Error occured in {FunctionName} : {Message}",  nameof(HomeController) + "/" + nameof(Index),message);
            return Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "https://deliverdifferent.com/");
        }
    }

    [Authorize]
    public async Task<IActionResult> GetPageViews(int pageId)
    {
        var page = (AppPage)pageId;
        var staffId = infoService.GetStaffId();
        var viewOptions = await viewsRepository.GetViewsByUserAndPageAsync(staffId, page);
        return Json(viewOptions);
    }

    private static string MaskSensitiveInfo(string connectionString)
    {
        var maskedString = PasswordRegex().Replace(connectionString, "$1=********");

        maskedString = UserIdRegex().Replace(maskedString, "$1=********");

        return maskedString;
    }

    [Authorize]
    public async Task<IActionResult> ActiveClients(string searchTerm)
    {
        var result = await clientRepository.ActiveClientsAsync(searchTerm);
        return Json(result);
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });

    [GeneratedRegex("(Password|Pwd)=[^;]*", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex PasswordRegex();
    [GeneratedRegex("(User ID|Uid)=[^;]*", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex UserIdRegex();
}

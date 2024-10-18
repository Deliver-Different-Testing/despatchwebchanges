using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using System;
using System.Diagnostics;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Controllers
{
    public class HomeController(IClientRepository clientRepository, IDfrntViewsRepository viewsRepository, IConnectionStringManager connectionStringManager) : Controller
    {

        public async Task<IActionResult> Index([FromQuery] string login)
        {

            try
            {
                var staffId = HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
                var contactId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;
                var connectionString = HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
                var tenantId = HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
                var countryCode =HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CountryCode")?.Value;
                var usa = Country.Us.GetDescription();
                
                var isUsTenantFlag = countryCode?.ToUpper().Equals(usa);

                if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId))
                {
                    Log.Error("Connection string or tenant ID is missing.");
                    return BadRequest(new { error ="Connection string or tenant ID is missing." });
                }
                
                Log.Debug($"Found Identity for StaffID:{staffId}");
                var credentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? "";
                if (string.IsNullOrEmpty(credentials))
                {
                    throw new InvalidOperationException(
                        "Could not find a environment variable string named 'SQLCredentials'.");
                }
                await connectionStringManager.SetConnectionStringAsync($"{tenantId}-ClientManager-Connection", connectionString+credentials);

                var maskedConnectionString = MaskSensitiveInfo(connectionString+credentials);
                Log.Debug($"Connection String Set: {maskedConnectionString}");               
                
                var clientDetail = await clientRepository.ValidateClientAsync(Convert.ToInt32(contactId));
                ViewBag.FirstName = clientDetail.FirstName;
                ViewBag.FullName = clientDetail.FullName;
                ViewBag.Email = clientDetail.Email;
                ViewBag.ClientInternal = clientDetail.Internal;
                ViewBag.ContactID = clientDetail.StaffID ?? int.Parse(contactId);
                ViewBag.IsUsTenant= isUsTenantFlag??false;

                return View();
            }
            catch (Exception ex)
            {
                Log.Error(ex.Message, ex);
                return Redirect(Environment.GetEnvironmentVariable("PublicPath"));
            }
        }

        public async Task<IActionResult> GetPageViews(int userId, int pageId)
        {
            var page = (AppPage)pageId;
            var viewOptions = await viewsRepository.GetViewsByUserAndPageAsync(userId, page);
            return Json(viewOptions);
        }
        
        private string MaskSensitiveInfo(string connectionString)
        {
            // Mask password
            var maskedString = Regex.Replace(connectionString, 
                @"(Password|Pwd)=[^;]*", "$1=********", 
                RegexOptions.IgnoreCase);

            // Mask user id if present
            maskedString = Regex.Replace(maskedString, 
                @"(User ID|Uid)=[^;]*", "$1=********", 
                RegexOptions.IgnoreCase);

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
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}

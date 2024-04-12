using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Controllers
{
    public class HomeController(ClientRepository clientRepository) : Controller
    {

        public async Task<IActionResult> Index([FromQuery] string login)
        {

            var cid = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;

            if (!string.IsNullOrEmpty(cid))
            {


                var clientDetail = await clientRepository.ValidateClientAsync(Convert.ToInt32(cid));
                ViewBag.FirstName = clientDetail.FirstName;
                ViewBag.FullName = clientDetail.FullName;
                ViewBag.Email = clientDetail.Email;
                ViewBag.ClientInternal = clientDetail.Internal;
                ViewBag.ContactID = clientDetail.StaffID ?? int.Parse(cid);

                

                return View();
            }
            else
            {
                return Redirect(Environment.GetEnvironmentVariable("PublicPath"));

            }

        }

        public async Task<IActionResult> ActiveClients(string searchTerm)
        {
            var result = await clientRepository.ActiveClients(searchTerm);
            return Json(result);
        }

        public async Task<IActionResult> ClientContacts(int contactId)
        {
            var result = await clientRepository.ClientContacts(contactId);
            return Json(result);
        }
        


        public IActionResult About()
        {
            ViewData["Message"] = "Your application description page.";
            var x = "test";


            return View();
        }

        public IActionResult Contact()
        {
            ViewData["Message"] = "Your contact page.";

            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}

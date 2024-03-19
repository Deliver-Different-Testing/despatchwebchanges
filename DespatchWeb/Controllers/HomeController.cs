using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using DespatchWeb.Models;
using System.Security.Cryptography;
using System.IO;
using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Hosting;
using System.Security.Claims;
using System.Web;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Controllers
{
    public class HomeController : Controller
    {
        private IConfiguration _configuration;
        private readonly ClientRepository _clientRepository;
        private readonly IWebHostEnvironment _hostingEnvironment;

        public HomeController(ClientRepository clientRepository, IConfiguration configuration, IWebHostEnvironment hostingEnvironment)
        {
            _clientRepository = clientRepository;
            _configuration = configuration;
            _hostingEnvironment = hostingEnvironment;
        }

        public async Task<IActionResult> Index([FromQuery] string login)
        {
            //var disp = await _clientRepository.ValidateDispatcherLogin(User.Identity.Name.Substring(User.Identity.Name.IndexOf('\\') + 1));
            //if (disp != null)
            //{
            //    ViewBag.FirstName = disp.FirstName;
            //    ViewBag.FullName = disp.FirstName + " " + disp.LastName;
            //    ViewBag.ContactID = disp.StaffID;
            //    ViewBag.ClientInternal = true;
            //    ViewBag.DispatcherName = User.Identity.Name.Substring(User.Identity.Name.IndexOf('\\') + 1);

            //    return View();
            //}

            //if (_hostingEnvironment.IsDevelopment())
            //{
            //    login = "WZKzmEeKz1c3/qetjbb48HcCr2UGhQ6wz8NRwSoxxOU="; //uclgf
            //    //login = "KssU6Ai9cGikcw/3nS0qFzBPGEwNg/QPCROLhnaoiq0="; //UCLGE
            //}
            //else
            //{
            //    login = WebUtility.UrlDecode(login);
            //}
            //if (!string.IsNullOrEmpty(login))
            //{
            //    var key = Convert.FromBase64String("8wzkFlOvNB8+7UgmX0bSyFPHxjLNjmaGhlUoSKkJ2Kc=");
            //    var iv = Convert.FromBase64String("iE1+VfQbXWBkCalh+iV85Q==");


            //    var loginString = DecryptStringFromBytes_Aes(Convert.FromBase64String(login), key, iv);

            //    if (loginString == null || loginString.LastIndexOf("|") <= 0) return Redirect(_configuration["PublicPath"]);


            //    var contactId = loginString.Substring(0, loginString.LastIndexOf("|"));

            //    if (string.IsNullOrEmpty(contactId)) return Redirect(_configuration["PublicPath"]);

            //    var clientDetail = await _clientRepository.ValidateClientAsync(Convert.ToInt32(contactId));
            //    ViewBag.FirstName = clientDetail.FirstName;
            //    ViewBag.FullName = clientDetail.FullName;
            //    ViewBag.Email = clientDetail.Email;
            //    ViewBag.ClientInternal = clientDetail.Internal;
            //    ViewBag.ContactID = clientDetail.StaffID ?? int.Parse(contactId);



            //    return View();
            //}
            //else
            //{
            //    //return Redirect(_configuration["PublicPath"]);
            //    return View();
            //}
            var cid = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;

            if (!string.IsNullOrEmpty(cid))
            {


                var clientDetail = await _clientRepository.ValidateClientAsync(Convert.ToInt32(cid));
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
            var result = await _clientRepository.ActiveClients(searchTerm);
            return Json(result);
        }

        public async Task<IActionResult> ClientContacts(int contactId)
        {
            var result = await _clientRepository.ClientContacts(contactId);
            return Json(result);
        }
        

        private string DecryptStringFromBytes_Aes(byte[] cipherText, byte[] Key, byte[] IV)
        {
            // Check arguments.
            if (cipherText == null || cipherText.Length <= 0)
                throw new ArgumentNullException("cipherText");
            if (Key == null || Key.Length <= 0)
                throw new ArgumentNullException("Key");
            if (IV == null || IV.Length <= 0)
                throw new ArgumentNullException("IV");

            // Declare the string used to hold
            // the decrypted text.
            string plaintext = null;

            // Create an Aes object
            // with the specified key and IV.
            using (var aesAlg = Aes.Create())
            {
                aesAlg.Key = Key;
                aesAlg.IV = IV;

                // Create a decrytor to perform the stream transform.
                ICryptoTransform decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);

                // Create the streams used for decryption.
                using (var msDecrypt = new MemoryStream(cipherText))
                {
                    using (var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read))
                    {
                        using (var srDecrypt = new StreamReader(csDecrypt))
                        {

                            // Read the decrypted bytes from the decrypting stream and place them in a string.
                            plaintext = srDecrypt.ReadToEnd();
                        }
                    }
                }

            }

            return plaintext;

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

using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Controllers;

public class HomeController : Controller
{
    private readonly IClientRepository _clientRepository;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _hostingEnvironment;

    public HomeController(IClientRepository clientRepository, IConfiguration configuration,
        IWebHostEnvironment hostingEnvironment)
    {
        _clientRepository = clientRepository;
        _configuration = configuration;
        _hostingEnvironment = hostingEnvironment;
    }

    public async Task<IActionResult> Index([FromQuery] string login)
    {
        var disp = await _clientRepository.ValidateDispatcherLoginAsync(
            User.Identity.Name[(User.Identity.Name.IndexOf('\\') + 1)..]);
        if (disp != null)
        {
            ViewBag.FirstName = disp.FirstName;
            ViewBag.FullName = disp.FirstName + " " + disp.LastName;
            ViewBag.ContactID = disp.StaffID;
            ViewBag.ClientInternal = true;
            ViewBag.DispatcherName = User.Identity.Name[(User.Identity.Name.IndexOf('\\') + 1)..];

            return View();
        }

        login = _hostingEnvironment.IsDevelopment()
            ? "WZKzmEeKz1c3/qetjbb48HcCr2UGhQ6wz8NRwSoxxOU="
            : //uclgf
            //login = "KssU6Ai9cGikcw/3nS0qFzBPGEwNg/QPCROLhnaoiq0="; //UCLGE
            WebUtility.UrlDecode(login);

        if (string.IsNullOrEmpty(login)) return Redirect(_configuration["PublicPath"]);
        var key = Convert.FromBase64String("8wzkFlOvNB8+7UgmX0bSyFPHxjLNjmaGhlUoSKkJ2Kc=");
        var iv = Convert.FromBase64String("iE1+VfQbXWBkCalh+iV85Q==");


        var loginString = DecryptStringFromBytes_Aes(Convert.FromBase64String(login), key, iv);

        if (loginString == null || loginString.LastIndexOf("|") <= 0) return Redirect(_configuration["PublicPath"]);


        var contactId = loginString[..loginString.LastIndexOf("|")];

        if (string.IsNullOrEmpty(contactId)) return Redirect(_configuration["PublicPath"]);

        var clientDetail = await _clientRepository.ValidateClientAsync(Convert.ToInt32(contactId));
        ViewBag.FirstName = clientDetail.FirstName;
        ViewBag.FullName = clientDetail.FullName;
        ViewBag.Email = clientDetail.Email;
        ViewBag.ClientInternal = clientDetail.Internal;
        ViewBag.ContactID = clientDetail.StaffID ?? int.Parse(contactId);

        return View();
    }

    public async Task<IActionResult> ActiveClients(string searchTerm)
    {
        var result = await _clientRepository.ActiveClientsAsync(searchTerm);
        return Json(result);
    }

    public async Task<IActionResult> ClientContacts(int contactId)
    {
        var result = await _clientRepository.ClientContactsAsync(contactId);
        return Json(result);
    }


    private static string DecryptStringFromBytes_Aes(byte[] cipherText, byte[] Key, byte[] IV)
    {
        // Check arguments.
        if (cipherText is not { Length: > 0 })
            throw new ArgumentNullException(nameof(cipherText));
        if (Key is not { Length: > 0 })
            throw new ArgumentNullException(nameof(Key));
        if (IV is not { Length: > 0 })
            throw new ArgumentNullException(nameof(IV));

        // Declare the string used to hold
        // the decrypted text.

        // Create an Aes object
        // with the specified key and IV.
        using var aesAlg = Aes.Create();
        aesAlg.Key = Key;
        aesAlg.IV = IV;

        // Create a decrytor to perform the stream transform.
        var decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);

        // Create the streams used for decryption.
        using var msDecrypt = new MemoryStream(cipherText);
        using var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read);
        using var srDecrypt = new StreamReader(csDecrypt);
        // Read the decrypted bytes from the decrypting stream and place them in a string.
        var plaintext = srDecrypt.ReadToEnd();

        return plaintext;
    }


    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
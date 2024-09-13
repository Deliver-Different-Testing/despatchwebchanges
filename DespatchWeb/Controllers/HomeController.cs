using System;
using System.Diagnostics;
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

    // Temp Login for testing
    public async Task<IActionResult> Index([FromQuery] string login)
    {
        var viewModel = await _clientRepository.TempLoginAsync();
        SetViewBagForDispatcher(viewModel, viewModel.FirstName);
        return View();
    }

    /*public async Task<IActionResult> Index([FromQuery] string login)
    {
        var dispatcherName = GetDispatcherName();
        var viewModel = await _clientRepository.ValidateDispatcherLoginAsync(dispatcherName);

        if (viewModel != null)
        {
            SetViewBagForDispatcher(viewModel, dispatcherName);
            return View();
        }

        login = DecodeAndValidateLogin(login);
        if (string.IsNullOrEmpty(login)) return Redirect(_configuration["PublicPath"]);

        var contactId = ExtractContactId(login);
        if (string.IsNullOrEmpty(contactId)) return Redirect(_configuration["PublicPath"]);

        var clientDetail = await _clientRepository.ValidateClientAsync(Convert.ToInt32(contactId));
        SetViewBagForClient(clientDetail, contactId);

        return View();
    }*/

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

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() => View(new ErrorViewModel
        { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });

    private string GetDispatcherName() => User.Identity?.Name?[(User.Identity.Name.IndexOf('\\') + 1)..];

    private void SetViewBagForDispatcher(DispatcherViewModel viewModel, string dispatcherName)
    {
        ViewBag.FirstName = viewModel.FirstName;
        ViewBag.FullName = $"{viewModel.FirstName} {viewModel.LastName}";
        ViewBag.ContactID = viewModel.StaffID;
        ViewBag.ClientInternal = true;
        ViewBag.DispatcherName = dispatcherName;
    }

    private string DecodeAndValidateLogin(string login)
    {
        if (_hostingEnvironment.IsDevelopment())
            return "WZKzmEeKz1c3/qetjbb48HcCr2UGhQ6wz8NRwSoxxOU=";

        login = WebUtility.UrlDecode(login);
        if (string.IsNullOrEmpty(login)) return null;

        var key = Convert.FromBase64String("8wzkFlOvNB8+7UgmX0bSyFPHxjLNjmaGhlUoSKkJ2Kc=");
        var iv = Convert.FromBase64String("iE1+VfQbXWBkCalh+iV85Q==");

        return DecryptStringFromBytes_Aes(Convert.FromBase64String(login), key, iv);
    }

    private static string ExtractContactId(string loginString)
    {
        return loginString != null && loginString.LastIndexOf("|", StringComparison.Ordinal) <= 0
            ? null
            : loginString?[..loginString.LastIndexOf("|", StringComparison.Ordinal)];
    }

    private void SetViewBagForClient(ClientViewModel clientDetail, string contactId)
    {
        ViewBag.FirstName = clientDetail?.FirstName;
        ViewBag.FullName = clientDetail?.FullName;
        ViewBag.Email = clientDetail?.Email;
        ViewBag.ClientInternal = clientDetail is { Internal: true };
        if (clientDetail != null) ViewBag.ContactID = clientDetail.StaffID ?? int.Parse(contactId);
    }

    private static string DecryptStringFromBytes_Aes(byte[] cipherText, byte[] Key, byte[] IV)
    {
        if (cipherText is not { Length: > 0 })
            throw new ArgumentNullException(nameof(cipherText));
        if (Key is not { Length: > 0 })
            throw new ArgumentNullException(nameof(Key));
        if (IV is not { Length: > 0 })
            throw new ArgumentNullException(nameof(IV));

        using var aesAlg = Aes.Create();
        aesAlg.Key = Key;
        aesAlg.IV = IV;

        using var decrypt = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);
        using var msDecrypt = new System.IO.MemoryStream(cipherText);
        using var csDecrypt = new CryptoStream(msDecrypt, decrypt, CryptoStreamMode.Read);
        using var srDecrypt = new System.IO.StreamReader(csDecrypt);

        return srDecrypt.ReadToEnd();
    }
}
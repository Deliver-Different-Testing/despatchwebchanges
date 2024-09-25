using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class ClearListZonesController : Controller
{
    private readonly IClearListZonesRepository _clearListZonesRepository;

    public ClearListZonesController(IClearListZonesRepository clearListZonesRepository)
    {
        _clearListZonesRepository = clearListZonesRepository;
    }

    public async Task<IActionResult> GetDespatchViews(int userId)
    {
        var viewOptions = await _clearListZonesRepository.GetDispatchViewsAsync(userId);
        return Json(viewOptions);
    }
}

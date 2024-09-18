using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class ClearListZonesController : Controller
{
    private readonly ClearListZonesRepository _clearListZonesRepository;

    public ClearListZonesController(ClearListZonesRepository clearListZonesRepository)
    {
        _clearListZonesRepository = clearListZonesRepository;
    }

    public async Task<IActionResult> GetDespatchViews(int userId)
    {
        var viewOptions = await _clearListZonesRepository.GetDispatchViewsAsync(userId);
        return Json(viewOptions);
    }
}

using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class ClearListZonesController(IClearListZonesRepository clearListZonesRepository) : Controller
{
    public async Task<IActionResult> GetDespatchViews(int userId)
    {
        var viewOptions = await clearListZonesRepository.GetDispatchViewsAsync(userId);
        return Json(viewOptions);
    }
}

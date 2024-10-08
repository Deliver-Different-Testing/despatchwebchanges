using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class DfrntViewsController(IDfrntViewsRepository repository) : Controller
{
    
    public async Task<IActionResult> GetPageViews(int userId, int pageId)
    {
        var page = (AppPage)pageId;
        var viewOptions = await repository.GetViewsByUserAndPageAsync(userId, page);
        return Json(viewOptions);
    }
}
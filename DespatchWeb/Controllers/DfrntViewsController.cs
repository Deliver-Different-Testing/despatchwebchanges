using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class DfrntViewsController : Controller
{
    private readonly IDfrntViewsRepository _repository;

    public DfrntViewsController(IDfrntViewsRepository repository)
    {
        _repository = repository;
    }

    public async Task<IActionResult> GetPageViews(int userId, int pageId)
    {
        var page = (AppPage)pageId;
        var viewOptions = await _repository.GetViewsByUserAndPageAsync(userId, page);
        return Json(viewOptions);
    }
}
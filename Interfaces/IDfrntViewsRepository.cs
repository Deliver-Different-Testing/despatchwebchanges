using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IDfrntViewsRepository
{
    Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page);

    Task<string> GetWhereClauseByDispatchView(int viewId);

    Task<List<ZoneGroup>> GetAllZoneGroupsAsync();

    Task<List<PageLayoutViewModel>> GetSavedLayoutsForUserAsync(AppPage page, int staffId);

    Task SaveUserLayoutAsync(PageLayoutRequest viewModel);
}
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IDfrntViewsRepository
{
    Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page);
    Task<string> GetWhereClauseByDispatchView(int viewId);
    Task<List<ZoneGroup>> GetAllZoneGroupsAsync();
}
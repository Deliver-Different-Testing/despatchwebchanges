using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IClearListZonesRepository
{
    Task<List<SelectItem>> GetDispatchViewsAsync(int userId);
    Task<string> GetWhereClauseByDispatchView(int despatchViewId);
    Task<List<ZoneGroup>> GetZoneGroupsAsync();
}
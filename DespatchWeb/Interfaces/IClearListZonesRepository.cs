using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Interfaces;

public interface IClearListZonesRepository
{
    Task<Dictionary<int, string>> GetDispatchViewsAsync(int userId);
    Task<string> GetWhereClauseByDispatchView(int despatchViewId);
    Task<List<ZoneGroup>> GetZoneGroupsAsync();
}
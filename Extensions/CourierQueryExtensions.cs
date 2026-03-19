using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Extensions;

public static class CourierQueryExtensions
{
    extension(IQueryable<TucCourier> query)
    {
        public IQueryable<TucCourier> WithSearchFilter(string searchPattern) =>
            query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern));
    }
}

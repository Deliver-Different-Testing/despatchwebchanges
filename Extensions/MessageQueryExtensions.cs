using System.Linq;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Extensions;

public static class MessageQueryExtensions
{
    extension(IQueryable<TucManualMessage> query)
    {
        public IQueryable<TucManualMessage> ForStaff(int staffId) =>
            query.Where(m => m.UcmmSendFromStaffId == staffId || m.UcmmSendToStaffId == staffId);

        public IQueryable<TucManualMessage> BetweenStaffAndCourier(int staffId, int courierId) =>
            query.Where(m =>
                (m.UcmmSendFromStaffId == staffId && m.UcmmSendToCourierId == courierId) ||
                (m.UcmmSendFromCourierId == courierId && m.UcmmSendToStaffId == staffId));

        public IQueryable<TucManualMessage> BetweenStaff(int staffId1,
            int staffId2) =>
            query.Where(m =>
                (m.UcmmSendFromStaffId == staffId1 && m.UcmmSendToStaffId == staffId2) ||
                (m.UcmmSendFromStaffId == staffId2 && m.UcmmSendToStaffId == staffId1));

        public IQueryable<TucManualMessage> IncludeParticipants() =>
            query
                .AsSplitQuery()
                .Include(m => m.UcmmSendFromCourier)
                .ThenInclude(c => c.CourierLogInOut)
                .Include(m => m.UcmmSendToCourier)
                .ThenInclude(c => c.CourierLogInOut)
                .Include(m => m.UcmmSendFromStaff)
                .Include(m => m.UcmmSendToStaff);
    }
}
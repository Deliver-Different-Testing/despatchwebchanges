using System.Linq;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Helpers;

public static class MessageQueryExtensions
{
    public static IQueryable<TucManualMessage> ForStaff(this IQueryable<TucManualMessage> query, int staffId) =>
        query.Where(m => m.UcmmSendFromStaffId == staffId || m.UcmmSendToStaffId == staffId);

    public static IQueryable<TucManualMessage> BetweenStaffAndCourier(this IQueryable<TucManualMessage> query,
        int staffId, int courierId) =>
        query.Where(m =>
            (m.UcmmSendFromStaffId == staffId && m.UcmmSendToCourierId == courierId) ||
            (m.UcmmSendFromCourierId == courierId && m.UcmmSendToStaffId == staffId));

    public static IQueryable<TucManualMessage> BetweenStaff(this IQueryable<TucManualMessage> query, int staffId1,
        int staffId2) =>
        query.Where(m =>
            (m.UcmmSendFromStaffId == staffId1 && m.UcmmSendToStaffId == staffId2) ||
            (m.UcmmSendFromStaffId == staffId2 && m.UcmmSendToStaffId == staffId1));

    public static IQueryable<TucManualMessage> UnreadForStaff(this IQueryable<TucManualMessage> query, int staffId) =>
        query.Where(m => m.UcmmSendToStaffId == staffId && !m.Read);

    public static IQueryable<TucManualMessage> IncludeParticipants(this IQueryable<TucManualMessage> query) =>
        query
            .Include(m => m.UcmmSendFromCourier)
            .ThenInclude(c => c.CourierLogInOut)
            .Include(m => m.UcmmSendToCourier)
            .ThenInclude(c => c.CourierLogInOut)
            .Include(m => m.UcmmSendFromStaff)
            .Include(m => m.UcmmSendToStaff);
}
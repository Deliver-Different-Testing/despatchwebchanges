using System.Linq;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Helpers;

 public static class MessageQueryExtensions
    {
        /// <summary>
        /// Filters messages where the specified staff member is either sender or recipient
        /// </summary>
        public static IQueryable<TucManualMessage> ForStaff(this IQueryable<TucManualMessage> query, int staffId)
        {
            return query.Where(m => m.UcmmSendFromStaffId == staffId || m.UcmmSendToStaffId == staffId);
        }

        /// <summary>
        /// Filters messages between a specific staff member and a courier
        /// </summary>
        public static IQueryable<TucManualMessage> BetweenStaffAndCourier(this IQueryable<TucManualMessage> query, int staffId, int courierId)
        {
            return query.Where(m => 
                (m.UcmmSendFromStaffId == staffId && m.UcmmSendToCourierId == courierId) ||
                (m.UcmmSendFromCourierId == courierId && m.UcmmSendToStaffId == staffId));
        }

        /// <summary>
        /// Filters messages between two staff members
        /// </summary>
        public static IQueryable<TucManualMessage> BetweenStaff(this IQueryable<TucManualMessage> query, int staffId1, int staffId2)
        {
            return query.Where(m => 
                (m.UcmmSendFromStaffId == staffId1 && m.UcmmSendToStaffId == staffId2) ||
                (m.UcmmSendFromStaffId == staffId2 && m.UcmmSendToStaffId == staffId1));
        }

        /// <summary>
        /// Filters unread messages to a specific staff member
        /// </summary>
        public static IQueryable<TucManualMessage> UnreadForStaff(this IQueryable<TucManualMessage> query, int staffId)
        {
            return query.Where(m => m.UcmmSendToStaffId == staffId && !m.Read);
        }

        /// <summary>
        /// Includes all related entities for message participants
        /// </summary>
        public static IQueryable<TucManualMessage> IncludeParticipants(this IQueryable<TucManualMessage> query)
        {
            return query
                .Include(m => m.UcmmSendFromCourier)
                    .ThenInclude(c => c.CourierLogInOut)
                .Include(m => m.UcmmSendToCourier)
                    .ThenInclude(c => c.CourierLogInOut)
                .Include(m => m.UcmmSendFromStaff)
                .Include(m => m.UcmmSendToStaff);
        }
    }

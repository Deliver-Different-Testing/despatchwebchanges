using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using System.Transactions;

namespace DespatchWeb.Controllers
{
    public static class DateExtension
    {
        public static DateTime ResetTimeToStartOfDay(this DateTime dateTime)
        {
            return new DateTime(
                dateTime.Year,
                dateTime.Month,
                dateTime.Day,
                0, 0, 0, 0);
        }
        public static DateTime ResetTimeToEndOfDay(this DateTime dateTime)
        {
            return new DateTime(
                dateTime.Year,
                dateTime.Month,
                dateTime.Day,
                23, 59, 59, 999);
        }

        public static async Task<List<T>> ToListWithNoLockAsync<T>(this IQueryable<T> query, CancellationToken cancellationToken = default, Expression<Func<T, bool>> expression = null)
        {
            List<T> result = default;
            using var scope = CreateTransaction();
            if (expression != null)
            {
                query = query.Where(expression);
            }
            result = await query.ToListAsync(cancellationToken);
            scope.Complete();
            return result;
        }

        public static async Task<int> CountWithNoLockAsync<T>(this IQueryable<T> query, CancellationToken cancellationToken = default, Expression<Func<T, bool>> expression = null)
        {
            int result = 0;
            using var scope = CreateTransaction();
            result = query.Count();
            scope.Complete();
            return result;
        }


        private static TransactionScope CreateTransaction()
        {
            return new TransactionScope(TransactionScopeOption.Required,
                new TransactionOptions()
                {
                    IsolationLevel = System.Transactions.IsolationLevel.ReadUncommitted
                },
                TransactionScopeAsyncFlowOption.Enabled);
        }
    }
}

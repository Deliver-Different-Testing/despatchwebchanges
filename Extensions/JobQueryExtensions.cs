using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Extensions;

public static class JobQueryExtensions
{
    extension(IQueryable<TucJob> query)
    {
        /// <summary>
        /// Moves the job's booked moment, writing only the column that changed (see <see cref="BookedDateTime"/>).
        /// Returns the rows matched, so an unchanged edit on an existing job still counts as handled.
        /// </summary>
        public async Task<int> UpdateBookedTimeAsync(DateTime booked, CancellationToken ct = default)
        {
            var current = await query.Select(j => new { j.UcjbDate, j.UcjbTime }).FirstOrDefaultAsync(ct);
            if (current is null)
            {
                return 0;
            }

            var (date, time) = BookedDateTime.Split(booked, current.UcjbDate, current.UcjbTime);
            if (date is null && time is null)
            {
                return 1;
            }

            return await query.ExecuteUpdateAsync(s =>
            {
                if (date.HasValue)
                {
                    s.SetProperty(j => j.UcjbDate, date.Value);
                }

                if (time.HasValue)
                {
                    s.SetProperty(j => j.UcjbTime, time.Value);
                }
            }, ct);
        }
    }
}

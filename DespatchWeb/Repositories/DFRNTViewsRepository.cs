using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Repositories;

public class DfrntViewsRepository : IDfrntViewsRepository
{
    private readonly DespatchContext _context;
    private readonly ILogger<DfrntViewsRepository> _logger;

    public DfrntViewsRepository(DespatchContext context, ILogger<DfrntViewsRepository> logger)
    {
        _context = context;
        _logger = logger;
        _logger.LogInformation("DfrntViewsRepository initialized");
    }

    public async Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page)
    {
        _logger.LogInformation("Getting views for user {UserId} and page {Page}", userId, page);
        try
        {
            var views = await _context.DfrntpageViews
                .Where(pv => pv.PageId == (int)page)
                .Select(dv => new SelectItem
                {
                    Id = dv.View.DespatchViewId,
                    Name = dv.View.Name
                })
                .AsNoTracking()
                .ToListAsync();

            _logger.LogInformation("Retrieved {Count} views for user {UserId} and page {Page}",
                views.Count, userId, page);
            return views;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving views for user {UserId} and page {Page}",
                userId, page);
            throw;
        }
    }
}
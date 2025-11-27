using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    public async Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
        OverviewJobsRequest parameters
    )
    {
        // Base query
        // Get just parent jobs to start with
        var query = Context.TucJobs.Where(j => j.ParentId == j.UcjbId || !j.ParentId.HasValue);

        // Apply a status group
        query = statusGroup switch
        {
            JobStatusGroup.Active => query.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            ),

            JobStatusGroup.Completed => query.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Completed.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            ),

            JobStatusGroup.Inactive => query.Where(j => j.UcjbVoid),

            _ => query
        };

        // Apply region filter if provided
        if (parameters.Regions.Count > 0)
            query = query.Where(j =>
                j.TblBulkJobs.Any(b => parameters.Regions.Contains(b.Region.BulkRegionId))
            );

        // Apply speed filter if provided
        if (parameters.Speeds.Count > 0)
            query = query.Where(j => parameters.Speeds.Contains(j.UcjbSpeedNavigation.UcjtId));
        
        // Apply courier filter if provided
        if (parameters.Couriers.Count > 0)
            query = query.Where(j => parameters.Couriers.Contains(j.UcjbCourier.UccrId));

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.ToLower().Trim();
            query = query.Where(j =>
                EF.Functions.Like(j.UcjbNumber.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.UcjbStatusNavigation.UcjsName.ToLower(), $"%{search}%")
                || j.TblBulkJobs.Any(b => EF.Functions.Like(b.Region.Name.ToLower(), $"%{search}%"))
                || EF.Functions.Like(j.PickupAddressLine5.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.PickupAddressLine6.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.DeliveryAddressLine5.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.DeliveryAddressLine6.ToLower(), $"%{search}%")
                || (
                    j.UcjbCourier != null
                    && (
                        EF.Functions.Like(j.UcjbCourier.UccrName.ToLower(), $"%{search}%")
                        || EF.Functions.Like(j.UcjbCourier.UccrSurname.ToLower(), $"%{search}%")
                    )
                )
            );
        }

        // Apply date range filter
        if (parameters.StartDate.HasValue)
            query = query.Where(j => j.UcjbDate >= parameters.StartDate);
        if (parameters.EndDate.HasValue)
            query = query.Where(j => j.UcjbDate <= parameters.EndDate);

        // Apply sorting
        query = ApplySorting(query, parameters.OrderBy, parameters.OrderDirection);

        // Get total count for pagination
        var total = await query.CountAsync();
        var pages = (int)Math.Ceiling(total / (double)parameters.Limit);

        var isUsCustomer = _infoService.IsUsTenant();

        // Apply pagination
        var jobs = await query
            .Skip((parameters.Page - 1) * parameters.Limit)
            .Take(parameters.Limit)
            .Select(j => new DeliveryJob
            {
                JobId = j.UcjbId,
                JobName = j.UcjbNumber,
                Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : "Unknown",
                Region =
                    j.TblBulkJobs.FirstOrDefault() != null
                        ? j.TblBulkJobs.FirstOrDefault().Region.Name
                        : null,
                Pickup = isUsCustomer
                    ? j.PickupAddressLine5 + ", " + j.PickupAddressLine6
                    : j.UcjbFromAddr,
                Delivery = isUsCustomer
                    ? j.DeliveryAddressLine5 + ", " + j.DeliveryAddressLine6
                    : j.UcjbToAddr,
                Driver =
                    j.UcjbCourier != null
                        ? j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                        : null,
                Completion = j.InverseParent.Count != 0
                    ? (int)
                    Math.Round(
                        (double)
                        j.InverseParent.Count(c =>
                            c.UcjbJobDone
                            || (
                                c.UcjbStatus.HasValue
                                && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                            )
                        )
                        / j.InverseParent.Count
                        * 100
                    )
                    : 0,
                ChildJobs = j
                    .InverseParent.Select(c => new ChildDeliveryJob
                    {
                        JobId = c.UcjbId,
                        JobName = c.UcjbNumber,
                        Status = c.UcjbStatusNavigation != null ? c.UcjbStatusNavigation.UcjsName : "Unknown",
                        Region =
                            c.TblBulkJobs.FirstOrDefault() != null
                                ? c.TblBulkJobs.FirstOrDefault().Region.Name
                                : null,
                        Pickup = c.PickupAddressLine5 + ", " + c.PickupAddressLine6,
                        Delivery = c.DeliveryAddressLine5 + ", " + c.DeliveryAddressLine6,
                        Driver =
                            c.UcjbCourier != null
                                ? c.UcjbCourier.UccrName + ", " + c.UcjbCourier.UccrSurname
                                : null,
                        Completion =
                            c.UcjbJobDone || c.UcjbStatus == (int)JobStatus.Completed ? 100 : 0
                    })
                    .ToList()
            })
            .AsNoTracking()
            .ToListAsync();

        return new PaginatedResponse<DeliveryJob>
        {
            Items = jobs,
            Total = total,
            Page = parameters.Page,
            Pages = pages
        };
    }

    private static IQueryable<TucJob> ApplySorting(
        IQueryable<TucJob> query,
        string orderBy,
        string orderDirection
    )
    {
        var isAscending = !orderDirection.Equals("desc", StringComparison.CurrentCultureIgnoreCase);

        query = orderBy?.ToLower() switch
        {
            "jobname" => isAscending
                ? query.OrderBy(j => j.UcjbNumber)
                : query.OrderByDescending(j => j.UcjbNumber),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatusNavigation.UcjsName)
                : query.OrderByDescending(j => j.UcjbStatusNavigation.UcjsName),

            "completion" => isAscending
                ? query.OrderBy(j =>
                    j.InverseParent.Count(c =>
                        c.UcjbJobDone
                        || (
                            c.UcjbStatus.HasValue
                            && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                        )
                    )
                    / (double)j.InverseParent.Count
                    * 100
                )
                : query.OrderByDescending(j =>
                    j.InverseParent.Count(c =>
                        c.UcjbJobDone
                        || (
                            c.UcjbStatus.HasValue
                            && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                        )
                    )
                    / (double)j.InverseParent.Count
                    * 100
                ),

            "pickup" => isAscending
                ? query.OrderBy(j => j.PickupAddressLine5)
                : query.OrderByDescending(j => j.PickupAddressLine5),

            "delivery" => isAscending
                ? query.OrderBy(j => j.DeliveryAddressLine5)
                : query.OrderByDescending(j => j.DeliveryAddressLine5),

            "driver" => isAscending
                ? query.OrderBy(j => j.UcjbCourier.UccrName)
                : query.OrderByDescending(j => j.UcjbCourier.UccrName),

            "region" => isAscending
                ? query.OrderBy(j => j.TblBulkJobs.FirstOrDefault().Region.Name)
                : query.OrderByDescending(j => j.TblBulkJobs.FirstOrDefault().Region.Name),

            _ => query.OrderBy(j => j.UcjbNumber) // Default sort
        };

        return query;
    }

    public async Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        var locations = await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Select(j => new OverviewDeliveryMapResponse
            {
                Center = new Coordinates { Lat = (decimal)39.8097343, Lng = (decimal)-98.5556199 },
                Zoom = 5,
                SelectedJobIndex = 0,
                Job = new OverviewJobLocation
                {
                    Id = j.UcjbId,
                    Pickup = new Coordinates
                    {
                        Lat = j.PickUpLatitude ?? 0,
                        Lng = j.PickUpLongitude ?? 0
                    },
                    Delivery = new Coordinates
                    {
                        Lat = j.DeliveryLatitude ?? 0,
                        Lng = j.DeliveryLongitude ?? 0
                    },
                    ChildJobs = j
                        .InverseParent.Select(c => new OverviewChildJobLocation
                        {
                            Id = c.UcjbId,
                            Pickup = new Coordinates
                            {
                                Lat = c.PickUpLatitude ?? 0,
                                Lng = c.PickUpLongitude ?? 0
                            },
                            Delivery = new Coordinates
                            {
                                Lat = c.DeliveryLatitude ?? 0,
                                Lng = c.DeliveryLongitude ?? 0
                            },
                            Flight =
                                j.UcjbSpeedNavigation.GroupingId == (isUsCustomer
                                    ? (int)SpeedGrouping.Flight
                                    : (int)UrgentSpeedGrouping.Flight)
                        })
                        .ToList()
                }
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return locations;
    }

    public async Task<IList<OpenJobResponse>> GetOpenJobsAsync(OpenJobsRequest parameters)
    {
        try
        {
            var now = _infoService.GetCurrentTenantTime();
            var tenantTimeZone = _infoService.GetTenantTimeZone();

            var query = Context.TucJobs.Where(j =>
                j.UcjbStatus != (int)JobStatus.Completed && j.UcjbStatus != (int)JobStatus.Rejected &&
                j.UcjbStatus != (int)JobStatus.Void
            );

            // Apply date range filter
            if (parameters.StartDate.HasValue)
                query = query.Where(j => j.UcjbDate.Date >= parameters.StartDate.Value.Date);
            if (parameters.EndDate.HasValue)
                query = query.Where(j => j.UcjbDate.Date <= parameters.EndDate.Value.Date);

            // Apply region filter if provided
            if (parameters.Regions.Count > 0)
                query = query.Where(j =>
                    j.TblBulkJobs.Any(b => parameters.Regions.Contains(b.Region.BulkRegionId))
                );

            // Apply speed filter if provided
            if (parameters.Speeds.Count > 0)
                query = query.Where(j => parameters.Speeds.Contains(j.UcjbSpeedNavigation.UcjtId));

            // Order
            query = query.OrderBy(j => j.PickUpTime.Value);

            // Query to DTO
            var jobDtos = await query
                .AsNoTracking()
                .Select(j => new OpenJobDto
                {
                    JobId = j.UcjbId,
                    Reference = j.UcjbNumber,
                    StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : "Unknown",
                    PickupTime = j.PickUpTime,
                    PickupFromContact = j.PickupFromContact,
                    PickupAddressLine1 = j.PickupAddressLine1,
                    PickupAddressLine2 = j.PickupAddressLine2,
                    PickupAddressLine3 = j.PickupAddressLine3,
                    PickupAddressLine4 = j.PickupAddressLine4,
                    PickupAddressLine5 = j.PickupAddressLine5,
                    PickupAddressLine6 = j.PickupAddressLine6,
                    PickupAddressLine7 = j.PickupAddressLine7,
                    PickupAddressLine8 = j.PickupAddressLine8,
                    PickupTimeZone = j.PickupTimeZone != null ? j.PickupTimeZone.Name : null,
                    DeliverToContact = j.DeliverToContact,
                    DeliveryAddressLine1 = j.DeliveryAddressLine1,
                    DeliveryAddressLine2 = j.DeliveryAddressLine2,
                    DeliveryAddressLine3 = j.DeliveryAddressLine3,
                    DeliveryAddressLine4 = j.DeliveryAddressLine4,
                    DeliveryAddressLine5 = j.DeliveryAddressLine5,
                    DeliveryAddressLine6 = j.DeliveryAddressLine6,
                    DeliveryAddressLine7 = j.DeliveryAddressLine7,
                    DeliveryAddressLine8 = j.DeliveryAddressLine8,
                    DeliveryTimeZone = j.DeliverByTimeZone != null ? j.DeliverByTimeZone.Name : null,
                    CourierName = j.UcjbCourier != null ? j.UcjbCourier.UccrName : null,
                    CourierSurname = j.UcjbCourier != null ? j.UcjbCourier.UccrSurname : null,
                    CourierCompletedJobs = j.UcjbCourier != null
                        ? j.UcjbCourier.TucJobUcjbCouriers
                            .Where(dj => dj.UcjbStatus == (int)JobStatus.Completed
                                         && dj.UcjbComplTime.HasValue
                                         && dj.UcjbComplTime.Value.Date == now.Date)
                            .Select(dj => dj.UcjbComplTime.Value)
                            .ToList()
                        : new List<DateTime>(),
                    CourierLastCompleted = j.UcjbCourier != null
                        ? j.UcjbCourier.TucJobUcjbCouriers
                            .Where(dj => dj.UcjbStatus == (int)JobStatus.Completed && dj.UcjbComplTime.HasValue)
                            .OrderByDescending(dj => dj.UcjbComplTime)
                            .Select(dj => dj.UcjbComplTime)
                            .FirstOrDefault()
                        : null,
                    Quantity = j.UcjbQty ?? 0,
                    PackageTypeName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
                    TotalDistance = j.TotalDistance ?? 0,
                    // Fields needed for delivery time calculation
                    DeliveryTime = j.DeliverByTime,
                    SpeedMinutes = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.Minutes : null
                })
                .ToListAsync();

            // Map DTOs to ViewModels
            var openJobs = jobDtos.Select(dto => MapToOpenJobResponse(dto, tenantTimeZone)).ToList();

            return openJobs;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting open jobs");
            throw;
        }
    }

    private static OpenJobResponse MapToOpenJobResponse(OpenJobDto dto, string tenantTimeZone)
    {
        return new OpenJobResponse
        {
            JobId = dto.JobId,
            Reference = dto.Reference,
            Status = dto.StatusName,
            PickupTime = dto.PickupTime.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(dto.PickupTime.Value, dto.PickupTimeZone ?? tenantTimeZone) 
                : null,
            PickupName = dto.PickupFromContact,
            PickupAddress = AddressFormatter.FormatWithCityStateZip(
                new AddressFormatter.Address(
                    dto.PickupAddressLine1,
                    dto.PickupAddressLine2,
                    dto.PickupAddressLine3,
                    dto.PickupAddressLine4,
                    dto.PickupAddressLine5,
                    dto.PickupAddressLine6,
                    dto.PickupAddressLine7,
                    dto.PickupAddressLine8
                )
            ),
            DeliveryTime = CalculateDeliveryTime(dto, tenantTimeZone),
            DeliveryName = dto.DeliverToContact,
            DeliveryAddress = AddressFormatter.FormatWithCityStateZip(
                new AddressFormatter.Address(
                    dto.DeliveryAddressLine1,
                    dto.DeliveryAddressLine2,
                    dto.DeliveryAddressLine3,
                    dto.DeliveryAddressLine4,
                    dto.DeliveryAddressLine5,
                    dto.DeliveryAddressLine6,
                    dto.DeliveryAddressLine7,
                    dto.DeliveryAddressLine8
                )
            ),
            DriverName = !string.IsNullOrEmpty(dto.CourierName)
                ? $"{dto.CourierName} {dto.CourierSurname}".Trim()
                : null,
            CompletedToday = dto.CourierCompletedJobs.Count,
            LastCompleted = dto.CourierLastCompleted.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(dto.CourierLastCompleted.Value, tenantTimeZone)
                : null,
            Quantity = dto.Quantity,
            PackageType = dto.PackageTypeName,
            Mileage = dto.TotalDistance
        };
    }

    private static DateTimeOffset? CalculateDeliveryTime(OpenJobDto dto, string tenantTimeZone)
    {
        if (dto.DeliveryTime.HasValue)
            return TimeZoneHelper.SetDateTimeWithTimeZone(dto.DeliveryTime.Value, dto.DeliveryTimeZone ?? tenantTimeZone);
        if (dto.PickupTime.HasValue && dto.SpeedMinutes.HasValue)
            return TimeZoneHelper.SetDateTimeWithTimeZone(dto.PickupTime.Value.AddMinutes(dto.SpeedMinutes.Value),
                dto.PickupTimeZone ?? tenantTimeZone);

        return dto.PickupTime.HasValue
            ? TimeZoneHelper.SetDateTimeWithTimeZone(dto.PickupTime.Value, dto.PickupTimeZone ?? tenantTimeZone)
            : null;
    }
}
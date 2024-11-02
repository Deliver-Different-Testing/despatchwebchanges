using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Serilog;
using Vehicle = DespatchWeb.Models.Vehicle;

namespace DespatchWeb.Repositories;

public class BaseJobRepository(IDbContextFactory<DespatchContext> contextFactory):BaseRepository(contextFactory)
{

    // Create
    public async Task<T> Add<T>(T entity) where T : class
    {
        var result = await Context.Set<T>().AddAsync(entity);
        await Context.SaveChangesAsync();
        return result.Entity;
    }

    // Read
    public async Task<T> Get<T>(int id) where T : class
    {
        return await Context.Set<T>().FindAsync(id);
    }

    // Update
    public async Task<T> Update<T>(T entity) where T : class
    {
        Context.Set<T>().Update(entity);
        await Context.SaveChangesAsync();
        return entity;
    }

    // Delete
    public async Task<T> Delete<T>(int id) where T : class
    {
        var entity = await Get<T>(id);
        if (entity == null) return entity;

        Context.Set<T>().Remove(entity);
        await Context.SaveChangesAsync();

        return entity;
    }

    // This function replaces the sql view "DESWEB_qryDespatch"
    public async Task<List<JobViewModel>> DespatchQry(AppPage page, string status,
        string order, string ascending, bool isInternal, string clientIds,
        List<string> viewFilters, NationwideWindowPanel? windowPane = null)
    {
        try
        {
            var query = Context.TucJobs
                .Where(j => !j.UcjbVoid
                            && (j.JobRelationshipType.DisplayDespatch == true || j.JobRelationshipTypeId == 10)
                            && (j.DisplayInDespatch == null || j.DisplayInDespatch == true));

            switch (page)
            {
                case AppPage.Dispatch:
                    query = ApplyDashboardFilters(query, isInternal, viewFilters, status, clientIds);
                    query = ApplyDashboardOrdering(query, order, ascending);
                    break;
                case AppPage.Domestic:
                    query = ApplyNationwideFilters(query, isInternal, viewFilters, status, windowPane.Value, clientIds);
                    query = ApplyNationwideOrdering(query, order, ascending);
                    break;
                default:
                    return new List<JobViewModel>();
            }

            // Grab the matching jobs
            var jobs = await query.Select(j => new JobViewModel
            {
                ClientId = j.UcjbClientId,
                Id = j.UcjbId,
                JobNo = j.UcjbNumber,
                Time = j.UcjbTime,
                RootParentId = j.RootParentId,
                Date = j.UcjbDate.ToString("MM/dd/yyyy"),
                Booked =
                    DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss")),
                DispatchTime = j.UcjbDispTime,
                CreatedDate = j.UcjbDate,
                ScheduleName = j.ScheduleName,

                PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime : null,
                DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime : null,

                // Courier
                Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
                CourierData = j.UcjbCourier != null
                    ? new CourierData
                    {
                        Courier = string.IsNullOrEmpty(j.UcjbCourier.Code)
                            ? string.Empty
                            : j.UcjbCourier.Code + " " + j.UcjbCourier.UccrName,
                        CourierId = j.UcjbCourierId
                    }
                    : null,
                AssignedCourier = j.UcjbCourier != null
                    ? new Suggestion
                    {
                        Id = j.UcjbCourier.UccrId,
                        Text = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                    }
                    : null,

                // Address information
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8,
                    Latitude = j.PickUpLatitude,
                    Longitude = j.PickUpLongitude,
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8,
                    Latitude = j.DeliveryLatitude,
                    Longitude = j.DeliveryLongitude,
                },

                // Airport information
                ToAirportId = j.ToAirportId,
                FromAirportId = j.FromAirportId,

                // Assigned flight information
                AssignedFlight = j.TucJobNationwides.Select(nj => new AssignedFlight
                {
                    ExpectedArrival = nj.UcnwEta,
                    ExpectedDeparture = nj.UcnwEtd,
                    FlightNumber = nj.UcnwFlightNo,
                    Notes = nj.UcnwNotes
                }).FirstOrDefault(),

                // Assigned agent
                AssignedAgent = j.Agent != null
                    ? new AgentViewModel
                    {
                        AgentId = j.Agent.UcagId,
                        AgentName = j.Agent.UcagName,
                        AgentRanking = j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : null
                    }
                    : null,

                // Notes
                ClientNotes = j.UcjbClient != null ? j.UcjbClient.UcclNotes : null,
                InternalNotes = j.UcjbNotes,

                // Suburb information
                From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : "Unknown",
                FromSuburbName = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
                FromPostCode = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.PostCode : null,
                FromAddress = j.UcjbFromAddr,
                To = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : "Unknown",
                ToSuburbName = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : null,
                ToPostCode = j.UcjbToNavigation != null ? j.UcjbToNavigation.PostCode : null,
                ToCity = j.UcjbToNavigation != null ? j.UcjbToNavigation.City : null,

                // Region information
                FromSuburbId = j.UcjbFromNavigation.UcsuId,
                ToSuburbId = j.UcjbToNavigation.UcsuId,

                // Delivery details
                PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
                Return = j.UcjbReturn,
                SaturdayDelivery = j.SaturdayDelivery,
                Remain = CalculateRemainTime(j, j.UcjbSpeedNavigation),
                CompletedTime = j.UcjbComplTime,


                // Location data
                PickUpLatitude = j.PickUpLatitude,
                PickUpLongitude = j.PickUpLongitude,
                DeliveryLatitude = j.DeliveryLatitude,
                DeliveryLongitude = j.DeliveryLongitude,

                // Client information
                Client = j.UcjbClientCode,
                ClientName = j.UcjbClient.UcclName,
                Phone = j.DeliverToPhone,
                PodName = j.UcjbPodname,
                PuTime = j.PickUpTime,

                // Job characteristics
                Weight = j.UcjbWeight,
                ToAddress = j.UcjbToAddr,
                JobType = (int)(j.UcjbType ?? 0),
                Direct = j.Direct,
                Van = j.UcjbVan,
                VanOk = j.VanOk,
                Truck = j.Truck,
                DgClass = j.Dgclass,
                DgDocumentation = j.Dgdocument,

                // Job status and details
                Done = j.UcjbJobDone,
                AlertLatePickup = j.UcjbClient.AlertLatePickUp,
                AlertLateDelivery = j.UcjbClient.AlertLateDelivery,
                Lp = j.UcjbLatePick,
                Ld = j.UcjbLateDel,
                Items = j.UcjbQty,

                PickupFrom = j.UcjbPickUpFrom,
                Notify = j.NotifiedJobType.UcjtName,
                FromContactName = j.PickupFromContact,
                FromContactNumber = j.PickupFromPhone,

                // Speed and job type information
                Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
                SpeedName = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.UcjtName : null,
                NotifiedName = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
                AcceptedName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
                SpeedId = j.UcjbSpeed,
                NotifiedJobTypeId = j.NotifiedJobTypeId,
                AcceptedJobTypeId = j.AcceptedJobTypeId,

                // References and amounts
                RefA = j.UcjbClientRefa,
                RefB = j.UcjbClientRefb,
                Charge = $"{j.UcjbAmount:C}",
                OurRef = j.UcjbOurRef,

                // Status
                StatusId = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsId : 0,
                Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
                StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
                InternalStatusId = j.InternalStatus,

                // Size
                Size = new Vehicle
                {
                    Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                    Label = j.UcjbVan ? "Van" :
                        j.UcjbSize == 1 ? "Bike" :
                        j.UcjbSize == 2 ? "Car" :
                        j.UcjbSize == 3 ? "Van" :
                        j.UcjbSize == 4 ? "Truck" :
                        j.UcjbSize == 5 ? "Scooter" :
                        "Car" // Default case
                },

                // Job items
                PalletInfo = j.TucJobItems.Select(i => new PalletInfo
                {
                    Id = i.JobId,
                    Quantity = i.Items,
                    ItemId = i.ItemId,
                    Weight = i.Weight,
                    Length = i.Length,
                    Depth = i.Depth,
                    Height = i.Height,
                    Pu = i.Pu,
                    Do = i.Do,
                    DgClass = i.Dgclass,
                    Notes = i.Notes
                }).ToList(),

                // Related jobs
                RelatedJobs = j.Parent.InverseParent.Select(p => new Size
                {
                    Id = p.UcjbId,
                    Label = p.UcjbNumber
                }).ToList()
            }).AsNoTracking().ToListAsync();

            return jobs;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occured getting jobs for dispatch page. Please see exception.");
            throw;
        }
    }

    private IQueryable<TucJob> ApplyDashboardFilters(
        IQueryable<TucJob> query,
        bool isInternal,
        List<string> viewFilters,
        string status,
        string clientIds)
    {
        switch (isInternal)
        {
            // Apply client filters for non-internal users
            case false when !string.IsNullOrEmpty(clientIds):
            {
                var clientIdList = clientIds.Split(',')
                    .Select(id => int.Parse(id.Trim()))
                    .ToList();
                query = query.Where(j => clientIdList.Contains((int)j.UcjbClientId));
                break;
            }
            // Apply internal view filters
            case true when viewFilters?.Any() == true:
            {
                // Combine all view filters with OR logic
                var parameter = Expression.Parameter(typeof(TucJob), "j");
                Expression combinedFilter = null;

                foreach (var filter in viewFilters)
                {
                    try
                    {
                        // Parse the filter string into an expression tree
                        var parser = new DynamicLinqParser<TucJob>();
                        var filterExpression = parser.ParseExpression(filter, parameter);

                        // Combine filters with OR logic
                        combinedFilter = combinedFilter == null
                            ? filterExpression
                            : Expression.OrElse(combinedFilter, filterExpression);
                    }
                    catch (Exception ex)
                    {
                        Log.Error(ex, "Error parsing view filter: {Filter}", filter);
                    }
                }

                // Apply the combined filter if any were successfully parsed
                if (combinedFilter != null)
                {
                    var lambda = Expression.Lambda<Func<TucJob, bool>>(combinedFilter, parameter);
                    query = query.Where(lambda);
                }

                break;
            }
        }

        // Apply status filters
        query = status?.ToLower() switch
        {
            "new" => query.Where(j => j.UcjbStatusNavigation != null && (j.UcjbCourierId == null ||
                                                                         j.UcjbStatusNavigation.UcjsCode == "D" ||
                                                                         j.UcjbStatusNavigation.UcjsCode == "N")),

            "nda" => query.Where(j => j.UcjbCourierId == null ||
                                      j.UcjbStatusNavigation.UcjsCode == "N" ||
                                      j.UcjbStatusNavigation.UcjsCode == "D" ||
                                      j.UcjbStatusNavigation.UcjsCode == "A" ||
                                      j.UcjbStatusNavigation.UcjsCode == "LP"),

            "active" => query.Where(j => !j.UcjbJobDone),

            "done" => query.Where(j => j.UcjbJobDone),

            "all" => query,

            _ => query
        };

        // Always exclude status 9
        return query.Where(j => j.UcjbStatus != 9);
    }


    private static IQueryable<TucJob> ApplyDashboardOrdering(IQueryable<TucJob> query, string order, string ascending)
    {
        if (string.IsNullOrEmpty(order))
            return query;

        var isAscending = ascending?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true;

        return order.ToLowerInvariant() switch
        {
            "remain" => isAscending
                ? query.OrderBy(j => j.UcjbDispTime)
                    .ThenBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbDispTime)
                    .ThenByDescending(j => j.UcjbTime),

            "to" => isAscending
                ? query.OrderBy(j => j.UcjbTo)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbFrom)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbTo)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbFrom)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "from" => isAscending
                ? query.OrderBy(j => j.UcjbFrom)
                    .ThenBy(j => j.UcjbTo)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbFrom)
                    .ThenByDescending(j => j.UcjbTo)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "client" => isAscending
                ? query.OrderBy(j => j.UcjbClientCode)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbClientCode)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "jobno" => isAscending
                ? query.OrderBy(j => j.UcjbNumber)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbNumber)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatus)
                : query.OrderByDescending(j => j.UcjbStatus),

            "speed" => isAscending
                ? query.OrderBy(j => j.UcjbSpeedNavigation.ShortName)
                : query.OrderByDescending(j => j.UcjbSpeedNavigation.ShortName),

            "notify" => isAscending
                ? query.OrderBy(j => j.NotifiedJobType.UcjtName)
                : query.OrderByDescending(j => j.NotifiedJobType.UcjtName),

            "lp" => isAscending
                ? query.OrderBy(j => j.UcjbLatePick)
                : query.OrderByDescending(j => j.UcjbLatePick),

            "ld" => isAscending
                ? query.OrderBy(j => j.UcjbLateDel)
                : query.OrderByDescending(j => j.UcjbLateDel),

            "time" => isAscending
                ? query.OrderBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbTime),
            _ => throw new ArgumentOutOfRangeException()
        };
    }

    private IQueryable<TucJob> ApplyNationwideFilters(
        IQueryable<TucJob> query,
        bool isInternal,
        List<string> viewFilters,
        string status,
        NationwideWindowPanel windowPane,
        string clientIds)
    {
        // Handle internal viewFilters
        if (isInternal && viewFilters != null && viewFilters.Any())
        {
            // Combine all view viewFilters with OR logic
            var parameter = Expression.Parameter(typeof(TucJob), "j");
            Expression combinedFilter = null;

            foreach (var filter in viewFilters)
            {
                try
                {
                    // Parse the filter string into an expression tree
                    var parser = new DynamicLinqParser<TucJob>();
                    var filterExpression = parser.ParseExpression(filter, parameter);

                    // Combine viewFilters with OR logic
                    combinedFilter = combinedFilter == null
                        ? filterExpression
                        : Expression.OrElse(combinedFilter, filterExpression);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Error parsing view filter: {Filter}", filter);
                }
            }

            // Apply the combined filter if any were successfully parsed
            if (combinedFilter != null)
            {
                var lambda = Expression.Lambda<Func<TucJob, bool>>(combinedFilter, parameter);
                query = query.Where(lambda);
            }
        }

        // Apply status viewFilters
        if (!string.IsNullOrEmpty(status))
        {
            query = status switch
            {
                "all" => windowPane == NationwideWindowPanel.Reprice
                    ? query.Where(j => j.Reprice == true || j.InternalStatus == (int)InternalJobStatus.Reprice)
                    : query.Where(j => !j.UcjbJobDone),

                "active" => windowPane switch
                {
                    NationwideWindowPanel.JobList =>
                        query.Where(j => !j.UcjbJobDone),

                    NationwideWindowPanel.Pod or NationwideWindowPanel.ActionRequired =>
                        query.Where(j => !j.UcjbJobDone && j.FollowupTime < DateTime.Now),

                    NationwideWindowPanel.Reprice =>
                        query.Where(j => j.Reprice == true || j.InternalStatus == (int)InternalJobStatus.Reprice),

                    _ => query
                },

                "done" => windowPane == NationwideWindowPanel.Reprice
                    ? query.Where(j => j.Reprice == true || j.InternalStatus == (int)InternalJobStatus.Reprice)
                    : query.Where(j => j.UcjbJobDone),

                _ => query
            };
        }

        // Apply window pane viewFilters
        query = windowPane switch
        {
            NationwideWindowPanel.JobList =>
                query.Where(j => j.InternalStatus == (int)InternalJobStatus.NewJobs ||
                                 (j.InternalStatus == null && j.UcjbStatus != 9)),

            NationwideWindowPanel.Pod =>
                query.Where(j => j.InternalStatus == (int)InternalJobStatus.AwaitingPod ||
                                 j.UcjbStatus == 9),

            NationwideWindowPanel.ActionRequired =>
                query.Where(j => j.InternalStatus == (int)InternalJobStatus.ActionRequired),

            NationwideWindowPanel.Reprice =>
                query.Where(j => j.InternalStatus == (int)InternalJobStatus.Reprice ||
                                 j.Reprice == true),

            _ => query
        };

        // Apply client viewFilters for non-internal users
        if (isInternal || string.IsNullOrEmpty(clientIds)) return query;

        var clientIdList = clientIds.Split(',')
            .Select(id => int.Parse(id.Trim()))
            .ToList();
        query = query.Where(j => clientIdList.Contains((int)j.UcjbClientId));

        // Only get child jobs
        query = query.Where(j => j.ParentId != null);

        return query;
    }


    private static IQueryable<TucJob> ApplyNationwideOrdering(IQueryable<TucJob> query, string order, string ascending)
    {
        if (string.IsNullOrEmpty(order))
            return query;

        var isAscending = ascending?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true;

        return order.ToLowerInvariant() switch
        {
            "courier" => isAscending
                ? query.OrderBy(j => j.UcjbCourier.Code).ThenBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbCourier.Code).ThenByDescending(j => j.UcjbTime),

            "remain" => isAscending
                ? query.OrderBy(j => j.FollowupTime)
                    .ThenBy(j => j.UcjbDispTime)
                    .ThenBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.FollowupTime)
                    .ThenByDescending(j => j.UcjbDispTime)
                    .ThenByDescending(j => j.UcjbTime),

            "to" => isAscending
                ? query.OrderBy(j => j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbFromNavigation.UcsuName)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbToNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbFromNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "from" => isAscending
                ? query.OrderBy(j => j.UcjbFromNavigation.UcsuName)
                    .ThenBy(j => j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbFromNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbToNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "client" => isAscending
                ? query.OrderBy(j => j.UcjbClient.UcclCode)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbClient.UcclCode)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "jobno" => isAscending
                ? query.OrderBy(j => j.UcjbNumber)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbNumber)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatus)
                : query.OrderByDescending(j => j.UcjbStatus),

            "speed" => isAscending
                ? query.OrderBy(j => j.UcjbSpeedNavigation.ShortName)
                : query.OrderByDescending(j => j.UcjbSpeedNavigation.ShortName),

            "notify" => isAscending
                ? query.OrderBy(j => j.NotifiedJobType.UcjtName)
                : query.OrderByDescending(j => j.NotifiedJobType.UcjtName),

            "lp" => isAscending
                ? query.OrderBy(j => j.UcjbLatePick)
                : query.OrderByDescending(j => j.UcjbLatePick),

            "ld" => isAscending
                ? query.OrderBy(j => j.UcjbLateDel)
                : query.OrderByDescending(j => j.UcjbLateDel),

            "time" => isAscending
                ? query.OrderBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "pod" => isAscending
                ? query.OrderBy(j => j.UcjbPodname)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.UcjbPodname)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            _ => isAscending
                ? query.OrderBy(j => j.FollowupTime)
                    .ThenBy(j => j.UcjbDispTime)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query.OrderByDescending(j => j.FollowupTime)
                    .ThenByDescending(j => j.UcjbDispTime)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code)
        };
    }

    public static int? CalculateRemainTime(TucJob job, TucJobType jobType)
    {
        if (job == null)
            return null;

        var now = DateTime.Now;
        var jobDateTime = CombineDateAndTime(job.UcjbDate, job.UcjbTime);

        // Handle Economy Delivery (Speed = 36)
        if (job.UcjbSpeed == 36)
        {
            var economyDeliveryDateTime = CombineDateAndTime(job.UcjbDate, job.DeliverByTime);
            return (int)(economyDeliveryDateTime - now).TotalMinutes;
        }

        // Handle Special Speeds (41,42,43,51,52) with Required Delivery Time
        if (job.UcjbSpeed != null && new[] { 41, 42, 43, 51, 52 }.Contains(job.UcjbSpeed.Value) &&
            job.RequiredDeliveryTime.HasValue)
        {
            var requiredDeliveryDateTime = CombineDateAndTime(job.UcjbDate, job.RequiredDeliveryTime.Value);
            return (int)(requiredDeliveryDateTime - now).TotalMinutes;
        }

        // Handle Standard Case
        var standardDeliveryDateTime = jobDateTime.AddMinutes(jobType.Minutes ?? 0);
        return (int)(standardDeliveryDateTime - now).TotalMinutes;
    }

    private static DateTime CombineDateAndTime(DateTime date, DateTime? time)
    {
        if (time is null) return date;

        // Else combine the dates
        return new DateTime(
            date.Year,
            date.Month,
            date.Day,
            time.Value.Hour,
            time.Value.Minute,
            time.Value.Second
        );
    }

    public async Task<JobViewModel> GetJobByIdAsync(int jobId)
    {
        try
        {
            var job = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => new JobViewModel
                {
                    ClientId = j.UcjbClientId,
                    Id = j.UcjbId,
                    JobNo = j.UcjbNumber,
                    Time = j.UcjbTime,
                    RootParentId = j.RootParentId,
                    Date = j.UcjbDate.ToString("MM/dd/yyyy"),
                    Booked = DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " +
                                            j.UcjbTime.Value.ToString("HH:mm:ss")),
                    DispatchTime = j.UcjbDispTime,
                    CreatedDate = j.UcjbDate,
                    ScheduleName = j.ScheduleName,

                    PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime : null,
                    DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime : null,

                    // Courier
                    Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
                    CourierData = j.UcjbCourier != null
                        ? new CourierData
                        {
                            Courier = string.IsNullOrEmpty(j.UcjbCourier.Code)
                                ? string.Empty
                                : j.UcjbCourier.Code + " " + j.UcjbCourier.UccrName,
                            CourierId = j.UcjbCourierId
                        }
                        : null,
                    AssignedCourier = j.UcjbCourier != null
                        ? new Suggestion
                        {
                            Id = j.UcjbCourier.UccrId,
                            Text = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                        }
                        : null,

                    // Address information
                    PickupAddress = new AddressViewModel
                    {
                        AddressLine1 = j.PickupAddressLine1,
                        AddressLine2 = j.PickupAddressLine2,
                        AddressLine3 = j.PickupAddressLine3,
                        AddressLine4 = j.PickupAddressLine4,
                        AddressLine5 = j.PickupAddressLine5,
                        AddressLine6 = j.PickupAddressLine6,
                        AddressLine7 = j.PickupAddressLine7,
                        AddressLine8 = j.PickupAddressLine8,
                        Latitude = j.PickUpLatitude,
                        Longitude = j.PickUpLongitude,
                    },
                    DeliveryAddress = new AddressViewModel
                    {
                        AddressLine1 = j.DeliveryAddressLine1,
                        AddressLine2 = j.DeliveryAddressLine2,
                        AddressLine3 = j.DeliveryAddressLine3,
                        AddressLine4 = j.DeliveryAddressLine4,
                        AddressLine5 = j.DeliveryAddressLine5,
                        AddressLine6 = j.DeliveryAddressLine6,
                        AddressLine7 = j.DeliveryAddressLine7,
                        AddressLine8 = j.DeliveryAddressLine8,
                        Latitude = j.DeliveryLatitude,
                        Longitude = j.DeliveryLongitude,
                    },

                    // Airport information
                    ToAirportId = j.ToAirportId,
                    FromAirportId = j.FromAirportId,

                    // Assigned flight information
                    AssignedFlight = j.TucJobNationwides.Select(nj => new AssignedFlight
                    {
                        ExpectedArrival = nj.UcnwEta,
                        ExpectedDeparture = nj.UcnwEtd,
                        FlightNumber = nj.UcnwFlightNo,
                        Notes = nj.UcnwNotes
                    }).FirstOrDefault(),

                    // Assigned agent
                    AssignedAgent = j.Agent != null
                        ? new AgentViewModel
                        {
                            AgentId = j.Agent.UcagId,
                            AgentName = j.Agent.UcagName,
                            AgentRanking = j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : null
                        }
                        : null,

                    // Notes
                    ClientNotes = j.UcjbClient != null ? j.UcjbClient.UcclNotes : null,
                    InternalNotes = j.UcjbNotes,

                    // Suburb information
                    From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : "Unknown",
                    FromSuburbName = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
                    FromPostCode = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.PostCode : null,
                    FromAddress = j.UcjbFromAddr,
                    To = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : "Unknown",
                    ToSuburbName = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : null,
                    ToPostCode = j.UcjbToNavigation != null ? j.UcjbToNavigation.PostCode : null,
                    ToCity = j.UcjbToNavigation != null ? j.UcjbToNavigation.City : null,

                    // Region information
                    FromSuburbId = j.UcjbFromNavigation.UcsuId,
                    ToSuburbId = j.UcjbToNavigation.UcsuId,

                    // Delivery details
                    PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
                    Return = j.UcjbReturn,
                    SaturdayDelivery = j.SaturdayDelivery,
                    Remain = CalculateRemainTime(j, j.UcjbSpeedNavigation),
                    CompletedTime = j.UcjbComplTime,

                    // Location data
                    PickUpLatitude = j.PickUpLatitude,
                    PickUpLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,

                    // Client information
                    Client = j.UcjbClientCode,
                    ClientName = j.UcjbClient.UcclName,
                    Phone = j.DeliverToPhone,
                    PodName = j.UcjbPodname,
                    PuTime = j.PickUpTime,

                    // Job characteristics
                    Weight = j.UcjbWeight,
                    ToAddress = j.UcjbToAddr,
                    JobType = (int)(j.UcjbType ?? 0),
                    Direct = j.Direct,
                    Van = j.UcjbVan,
                    VanOk = j.VanOk,
                    Truck = j.Truck,
                    DgClass = j.Dgclass,
                    DgDocumentation = j.Dgdocument,

                    // Job status and details
                    Done = j.UcjbJobDone,
                    AlertLatePickup = j.UcjbClient.AlertLatePickUp,
                    AlertLateDelivery = j.UcjbClient.AlertLateDelivery,
                    Lp = j.UcjbLatePick,
                    Ld = j.UcjbLateDel,
                    Items = j.UcjbQty,

                    PickupFrom = j.UcjbPickUpFrom,
                    Notify = j.NotifiedJobType.UcjtName,
                    FromContactName = j.PickupFromContact,
                    FromContactNumber = j.PickupFromPhone,

                    // Speed and job type information
                    Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
                    SpeedName = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.UcjtName : null,
                    NotifiedName = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
                    AcceptedName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
                    SpeedId = j.UcjbSpeed,
                    NotifiedJobTypeId = j.NotifiedJobTypeId,
                    AcceptedJobTypeId = j.AcceptedJobTypeId,

                    // References and amounts
                    RefA = j.UcjbClientRefa,
                    RefB = j.UcjbClientRefb,
                    Charge = $"{j.UcjbAmount:C}",
                    OurRef = j.UcjbOurRef,

                    // Status
                    StatusId = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsId : 0,
                    Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
                    StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
                    InternalStatusId = j.InternalStatus,

                    // Size
                    Size = new Vehicle
                    {
                        Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                        Label = j.UcjbVan ? "Van" :
                            j.UcjbSize == 1 ? "Bike" :
                            j.UcjbSize == 2 ? "Car" :
                            j.UcjbSize == 3 ? "Van" :
                            j.UcjbSize == 4 ? "Truck" :
                            j.UcjbSize == 5 ? "Scooter" :
                            "Car" // Default case
                    },

                    // Job items
                    PalletInfo = j.TucJobItems.Select(i => new PalletInfo
                    {
                        Id = i.JobId,
                        Quantity = i.Items,
                        ItemId = i.ItemId,
                        Weight = i.Weight,
                        Length = i.Length,
                        Depth = i.Depth,
                        Height = i.Height,
                        Pu = i.Pu,
                        Do = i.Do,
                        DgClass = i.Dgclass,
                        Notes = i.Notes
                    }).ToList(),

                    // Related jobs
                    RelatedJobs = j.Parent.InverseParent.Select(p => new Size
                    {
                        Id = p.UcjbId,
                        Label = p.UcjbNumber
                    }).ToList()
                })
                .AsNoTracking()
                .FirstOrDefaultAsync();

            return job;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }
}

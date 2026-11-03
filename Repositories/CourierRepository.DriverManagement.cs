using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using static DespatchWeb.Helpers.ListQuery;

namespace DespatchWeb.Repositories;

public partial class CourierRepository
{
    private static int PageOf(PaginatedRequest request) => Math.Max(1, request.Page);
    private static int PageSizeOf(PaginatedRequest request) => Math.Max(1, Math.Min(100, request.PageSize));

    // ------------------------------------------------------------------ driver details

    public async Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId) =>
        await Context.TucCouriers
            .Where(c => c.UccrId == courierId)
            .Select(c => new CourierDataDashboardViewModel
            {
                CourierId = c.UccrId,
                BasicInformation = new BasicInformation
                {
                    Code = c.Code,
                    FirstName = c.UccrName,
                    Surname = c.UccrSurname,
                    Email = c.UccrEmail,
                    Address = c.UccrAddress
                },
                ContactInformation = new ContactInformation
                {
                    Mobile = c.UccrMobile,
                    Home = c.PersonalMobile,
                    GstNumber = c.UccrGst,
                    IrdNumber = c.OpenForceNumber
                },
                VehicleInformation = new VehicleInformation
                {
                    Rego = c.VehiclePlateNnumber,
                    VehicleYear = c.UccrVehicleYear,
                    VehicleModel = c.UccrVehicleModel,
                    VehicleInsurance = c.UccrInsurance != null ? c.UccrInsurance.UcicName : "None"
                },
                Compliance = new Compliance
                {
                    DangerousGoods = c.UccrDangerousGoods == 1,
                    DangerousGoodsExpiry = c.DglicenseExpiry,
                    DriversLicenceExpiry = c.DriversLicenseExpiry,
                    WofExpiry = c.Wofexpiry,
                    RegistrationExpiry = c.RegistrationExpiry
                },
                BankingAndEmergency = new BankingAndEmergency
                {
                    EmergencyContact = !string.IsNullOrWhiteSpace(c.UccrKinName) ||
                                       !string.IsNullOrWhiteSpace(c.UccrKinTel),
                    EmergencyContactName = c.UccrKinName,
                    EmergencyContactPhone = c.UccrKinTel,
                    EmergencyContactRelationship = c.UccrKinRelationship,
                    Bank = c.UccrBankBranch,
                    SecurityCheck = c.UccrSecurityDate.HasValue,
                    SecurityCheckDate = c.UccrSecurityDate
                },
                AdditionalInformation = new AdditionalInformation
                {
                    ContactSignDate = c.UccrStartDate,
                    MobileInsurence = c.MobileInsurance,
                    Notes = c.UccrNotes
                }
            })
            .FirstOrDefaultAsync();

    // ------------------------------------------------------------------ compliance

    private static readonly IReadOnlyDictionary<string, Func<IQueryable<ComplianceItemRow>, bool, IOrderedQueryable<ComplianceItemRow>>>
        ComplianceSorts = BuildComplianceSorts();

    private static Dictionary<string, Func<IQueryable<ComplianceItemRow>, bool, IOrderedQueryable<ComplianceItemRow>>>
        BuildComplianceSorts()
    {
        var map = NewMap<ComplianceItemRow>();
        map["code"] = By<ComplianceItemRow, string>(r => r.Code);
        map["name"] = By<ComplianceItemRow, string>(r => r.Name);
        map["complianceType"] = By<ComplianceItemRow, string>(r => r.TypeKey);
        var expiry = By<ComplianceItemRow, DateTime?, string>(r => r.Expiry, r => r.Code);
        map["expiryDate"] = expiry;
        map["status"] = expiry;
        map["daysUntilExpiry"] = expiry;
        return map;
    }

    private static IQueryable<ComplianceItemRow> ComplianceItems(IQueryable<TucCourier> couriers,
        IEnumerable<string> types) =>
        types.Select(type => ComplianceBranch(couriers, type)).Aggregate((all, next) => all.Concat(next));

    private static IQueryable<ComplianceItemRow> ComplianceBranch(IQueryable<TucCourier> couriers, string type) =>
        type switch
        {
            CourierCompliance.DriversLicense => couriers.Select(c => new ComplianceItemRow
            {
                CourierId = c.UccrId, Code = c.Code, Name = c.UccrName + " " + c.UccrSurname, FirstName = c.UccrName,
                TypeKey = CourierCompliance.DriversLicense, Expiry = c.DriversLicenseExpiry
            }),
            CourierCompliance.DgEndorsement => couriers.Where(c => c.UccrDangerousGoods == 1).Select(c =>
                new ComplianceItemRow
                {
                    CourierId = c.UccrId, Code = c.Code, Name = c.UccrName + " " + c.UccrSurname,
                    FirstName = c.UccrName, TypeKey = CourierCompliance.DgEndorsement, Expiry = c.DglicenseExpiry
                }),
            CourierCompliance.Wof => couriers.Where(c => !string.IsNullOrWhiteSpace(c.VehiclePlateNnumber)).Select(c => new ComplianceItemRow
            {
                CourierId = c.UccrId, Code = c.Code, Name = c.UccrName + " " + c.UccrSurname, FirstName = c.UccrName,
                TypeKey = CourierCompliance.Wof, Expiry = c.Wofexpiry
            }),
            _ => couriers.Where(c => !string.IsNullOrWhiteSpace(c.VehiclePlateNnumber)).Select(c => new ComplianceItemRow
            {
                CourierId = c.UccrId, Code = c.Code, Name = c.UccrName + " " + c.UccrSurname, FirstName = c.UccrName,
                TypeKey = CourierCompliance.Registration, Expiry = c.RegistrationExpiry
            })
        };

    private readonly record struct ComplianceQuery(
        IQueryable<ComplianceItemRow> Scope,
        IQueryable<ComplianceItemRow> Filtered,
        IQueryable<ComplianceItemRow> Sorted);

    private ComplianceQuery BuildComplianceQuery(CourierComplianceFilterRequest request, DateTime today)
    {
        var type = NormaliseFilter(request.Type, "type", CourierCompliance.TypeKeys);
        var status = NormaliseFilter(request.Status, "status", CourierCompliance.StatusFilters);

        var couriers = Context.TucCouriers.Where(c => c.Active);
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            couriers = couriers.WithSearchFilter($"%{request.SearchTerm}%");
        }

        if (request.Fleet != 0)
        {
            couriers = couriers.Where(c => c.CourierFleetId == request.Fleet);
        }

        var scope = ComplianceItems(couriers, type.Length == 0 ? CourierCompliance.TypeKeys : [type]);
        var filtered = status.Length == 0 ? scope : scope.Where(CourierCompliance.ForStatusFilter(status, today));
        var sorted = Sort(filtered, request.OrderBy, request.SortDescending, "expiryDate", ComplianceSorts,
            r => r.Code + "|" + r.TypeKey);
        return new ComplianceQuery(scope, filtered, sorted);
    }

    private CourierComplianceViewModel ToComplianceViewModel(ComplianceItemRow row, DateTime today,
        string tenantTimezone) => new()
    {
        CourierId = row.CourierId,
        Code = row.Code,
        Name = row.Name,
        ComplianceType = CourierCompliance.TypeLabel(row.TypeKey),
        ComplianceTypeKey = row.TypeKey,
        ExpiryDate = row.Expiry.HasValue
            ? TimeZoneHelper.SetDateTimeWithTimeZone(row.Expiry.Value, tenantTimezone)
            : null,
        Status = CourierCompliance.StatusLabel(CourierCompliance.StatusOf(today, row.Expiry)),
        DaysUntilExpiry = CourierCompliance.DaysUntil(today, row.Expiry)
    };

    public async Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(
        CourierComplianceFilterRequest request)
    {
        var today = clock.TenantToday;
        var tenantTimezone = infoService.GetTenantTimeZone();
        var page = PageOf(request);
        var pageSize = PageSizeOf(request);
        var query = BuildComplianceQuery(request, today);

        var totalExpired = await query.Scope.CountAsync(CourierCompliance.IsStatus(ComplianceStatus.Expired, today));
        var totalExpiringSoon =
            await query.Scope.CountAsync(CourierCompliance.IsStatus(ComplianceStatus.ExpiringSoon, today));
        var totalValid = await query.Scope.CountAsync(CourierCompliance.IsStatus(ComplianceStatus.Valid, today));
        var totalNotSet = await query.Scope.CountAsync(CourierCompliance.IsStatus(ComplianceStatus.NotSet, today));
        var total = await query.Filtered.CountAsync();

        var rows = await query.Sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .TagWith("GetAllCourierCompliance - Paginated Items")
            .ToListAsync();

        return new CourierCompliancePaginatedResponse
        {
            Items = rows.Select(r => ToComplianceViewModel(r, today, tenantTimezone)).ToList(),
            Total = total,
            Page = page,
            Pages = (int)Math.Ceiling(total / (double)pageSize),
            TotalExpired = totalExpired,
            TotalExpiringSoon = totalExpiringSoon,
            TotalValid = totalValid,
            TotalNotSet = totalNotSet
        };
    }

    public async Task<IReadOnlyList<CourierComplianceViewModel>> GetCourierComplianceForExportAsync(
        CourierComplianceFilterRequest request)
    {
        var today = clock.TenantToday;
        var tenantTimezone = infoService.GetTenantTimeZone();

        var rows = await BuildComplianceQuery(request, today).Sorted
            .Take(MaxExportRows)
            .TagWith("GetCourierComplianceForExport")
            .ToListAsync();

        return [.. rows.Select(r => ToComplianceViewModel(r, today, tenantTimezone))];
    }

    public async Task<IReadOnlyList<DriverComplianceAttention>> GetComplianceAttentionAsync(
        IReadOnlyCollection<int> courierIds, CourierComplianceFilterRequest filter)
    {
        var today = clock.TenantToday;
        IReadOnlyCollection<string> types = CourierCompliance.TypeKeys;
        var itemPredicate = CourierCompliance.Attention(today);

        List<int> ids;
        if (courierIds is { Count: > 0 })
        {
            ids = [.. courierIds.Distinct()];
        }
        else
        {
            filter ??= new CourierComplianceFilterRequest();
            ids = await BuildComplianceQuery(filter, today).Filtered
                .Select(r => r.CourierId)
                .Distinct()
                .ToListAsync();

            var type = NormaliseFilter(filter.Type, "type", CourierCompliance.TypeKeys);
            if (type.Length > 0)
            {
                types = [type];
            }

            var status = NormaliseFilter(filter.Status, "status", CourierCompliance.StatusFilters);
            if (status is "expired" or "expiring" or "not_set" or "attention")
            {
                itemPredicate = CourierCompliance.ForStatusFilter(status, today);
            }
        }

        var drivers = Context.TucCouriers.Where(c => c.Active && ids.Contains(c.UccrId));
        var driverRows = await drivers.Select(c => new { c.UccrId, c.UccrName, c.UccrSurname }).ToListAsync();
        var attention = await ComplianceItems(drivers, types)
            .Where(itemPredicate)
            .TagWith("GetComplianceAttention")
            .ToListAsync();

        var byCourier = attention.ToLookup(r => r.CourierId);
        return
        [
            .. driverRows.Select(d => new DriverComplianceAttention
            {
                CourierId = d.UccrId,
                FirstName = d.UccrName,
                Name = (d.UccrName + " " + d.UccrSurname).Trim(),
                Items =
                [
                    .. byCourier[d.UccrId].Select(r => new ComplianceAttentionItem
                    {
                        TypeLabel = CourierCompliance.TypeLabel(r.TypeKey),
                        Expiry = r.Expiry,
                        DaysUntilExpiry = CourierCompliance.DaysUntil(today, r.Expiry),
                        Status = CourierCompliance.StatusOf(today, r.Expiry)
                    })
                ]
            })
        ];
    }

    // ------------------------------------------------------------------ after hours

    private sealed class AfterHoursGroupRow
    {
        public int CourierId { get; init; }
        public string CourierName { get; init; }
        public string CourierCode { get; init; }
        public DateTime StartTime { get; init; }
        public DateTime EndTime { get; init; }
        public int MinDay { get; init; }
        public int StartMinutes { get; init; }
        public int EndMinutes { get; init; }
        public List<int> Days { get; init; }
        public List<int> AfterHoursScheduleIds { get; init; }
    }

    private static readonly IReadOnlyDictionary<string, Func<IQueryable<AfterHoursGroupRow>, bool, IOrderedQueryable<AfterHoursGroupRow>>>
        AfterHoursSorts = BuildAfterHoursSorts();

    private static Dictionary<string, Func<IQueryable<AfterHoursGroupRow>, bool, IOrderedQueryable<AfterHoursGroupRow>>>
        BuildAfterHoursSorts()
    {
        var map = NewMap<AfterHoursGroupRow>();
        map["courierName"] = By<AfterHoursGroupRow, string>(r => r.CourierName);
        map["courierCode"] = By<AfterHoursGroupRow, string>(r => r.CourierCode);
        map["days"] = By<AfterHoursGroupRow, int>(r => r.MinDay);
        map["startTime"] = By<AfterHoursGroupRow, int>(r => r.StartMinutes);
        map["endTime"] = By<AfterHoursGroupRow, int>(r => r.EndMinutes);
        // Matches CalculateDuration: only the time of day counts, and an earlier end means the next day.
        map["duration"] = By<AfterHoursGroupRow, int>(r =>
            r.EndMinutes < r.StartMinutes ? r.EndMinutes + 1440 - r.StartMinutes : r.EndMinutes - r.StartMinutes);
        return map;
    }

    private IQueryable<TblAfterhoursCourier> FilteredAfterHours(CourierAfterHoursFilterRequest request)
    {
        var query = Context.TblAfterhoursCouriers
            .Where(c => c.Courier != null)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";

            query = query.Where(c =>
                EF.Functions.Like(c.Courier.UccrName, searchPattern) ||
                EF.Functions.Like(c.Courier.Code, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.Courier.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrEmail, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrVehicleModel, searchPattern)
            );
        }

        if (!string.IsNullOrWhiteSpace(request.Day)
            && !request.Day.Equals("all", StringComparison.CurrentCultureIgnoreCase))
        {
            var dayValue = GetDayOfWeekAsInt(request.Day);
            if (dayValue != 0)
            {
                query = query.Where(c => c.WeekDay == dayValue);
            }
        }

        return query;
    }

    private static IQueryable<AfterHoursGroupRow> GroupAfterHours(IQueryable<TblAfterhoursCourier> query) =>
        query
            .GroupBy(c => new
            {
                c.CourierId,
                CourierName = c.Courier.UccrName + " " + c.Courier.UccrSurname,
                c.Courier.Code,
                c.StartTime,
                c.EndTime
            })
            .Select(g => new AfterHoursGroupRow
            {
                CourierId = g.Key.CourierId,
                CourierName = g.Key.CourierName,
                CourierCode = g.Key.Code,
                StartTime = g.Key.StartTime,
                EndTime = g.Key.EndTime,
                MinDay = g.Min(x => x.WeekDay),
                StartMinutes = g.Key.StartTime.Hour * 60 + g.Key.StartTime.Minute,
                EndMinutes = g.Key.EndTime.Hour * 60 + g.Key.EndTime.Minute,
                Days = g.Select(x => x.WeekDay).ToList(),
                AfterHoursScheduleIds = g.Select(x => x.Id).ToList()
            });

    private static IQueryable<AfterHoursGroupRow> SortAfterHours(IQueryable<AfterHoursGroupRow> grouped,
        CourierAfterHoursFilterRequest request) =>
        Sort(grouped, request.OrderBy, request.SortDescending, "courierName", AfterHoursSorts, r => r.CourierId);

    private static AfterHoursCourierScheduleViewModel ToAfterHoursViewModel(AfterHoursGroupRow c,
        string tenantTimezone) => new()
    {
        AfterHoursScheduleId = c.AfterHoursScheduleIds.FirstOrDefault(),
        CourierId = c.CourierId,
        CourierName = c.CourierName,
        CourierCode = c.CourierCode,
        Days =
        [
            .. c.Days.Select(DayOfWeekHelper.SqlIntToDayName)
                .OrderBy(day =>
                    Array.IndexOf(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                        day))
        ],
        StartTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.StartTime, tenantTimezone),
        EndTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.EndTime, tenantTimezone),
        Duration = CalculateDuration(c.StartTime, c.EndTime)
    };

    public async Task<CourierAfterHoursPaginatedResponse> GetAfterHoursCourierScheduleAsync(
        CourierAfterHoursFilterRequest request)
    {
        var now = clock.TenantNow;
        var tenantTimezone = infoService.GetTenantTimeZone();
        var page = PageOf(request);
        var pageSize = PageSizeOf(request);

        var query = FilteredAfterHours(request);
        var grouped = GroupAfterHours(query);
        var sorted = SortAfterHours(grouped, request);

        var totalActiveDrivers = await query
            .Where(c => c.Courier != null &&
                        c.Courier.CourierLogInOut != null &&
                        (c.Courier.CourierLogInOut.LogOutTime == null || c.Courier.CourierLogInOut.LogOutTime > now))
            .Select(c => c.CourierId)
            .Distinct()
            .CountAsync();

        var totalCount = await grouped.CountAsync();

        var data = await sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new CourierAfterHoursPaginatedResponse
        {
            Items = data.Select(c => ToAfterHoursViewModel(c, tenantTimezone)).ToList(),
            Total = totalCount,
            Page = page,
            Pages = (int)Math.Ceiling(totalCount / (double)pageSize),
            TotalActiveDrivers = totalActiveDrivers
        };
    }

    public async Task<IReadOnlyList<AfterHoursCourierScheduleViewModel>> GetAfterHoursScheduleForExportAsync(
        CourierAfterHoursFilterRequest request)
    {
        var tenantTimezone = infoService.GetTenantTimeZone();
        var sorted = SortAfterHours(GroupAfterHours(FilteredAfterHours(request)), request);

        var data = await sorted
            .Take(MaxExportRows)
            .TagWith("GetAfterHoursScheduleForExport")
            .ToListAsync();

        return [.. data.Select(c => ToAfterHoursViewModel(c, tenantTimezone))];
    }

    // ------------------------------------------------------------------ today active

    private sealed class TodayActiveRow
    {
        public int CourierId { get; init; }
        public string Code { get; init; }
        public string Name { get; init; }
        public string Fleet { get; init; }
        public DateTime LogInTime { get; init; }
        public DateTime? LogOutTime { get; init; }
        public string Status { get; init; }
        public int Deliveries { get; init; }
        public int SessionMinutes { get; init; }
    }

    private static readonly string[] TodayActiveStatuses = ["active", "inactive"];

    private static IReadOnlyDictionary<string, Func<IQueryable<TodayActiveRow>, bool, IOrderedQueryable<TodayActiveRow>>>
        TodayActiveSorts { get; } = BuildTodayActiveSorts();

    private static Dictionary<string, Func<IQueryable<TodayActiveRow>, bool, IOrderedQueryable<TodayActiveRow>>>
        BuildTodayActiveSorts()
    {
        var map = NewMap<TodayActiveRow>();
        map["code"] = By<TodayActiveRow, string>(r => r.Code);
        map["name"] = By<TodayActiveRow, string>(r => r.Name);
        map["fleet"] = By<TodayActiveRow, string>(r => r.Fleet);
        map["loginTime"] = By<TodayActiveRow, DateTime>(r => r.LogInTime);
        map["logoutTime"] = By<TodayActiveRow, DateTime?>(r => r.LogOutTime);
        map["duration"] = By<TodayActiveRow, int>(r => r.SessionMinutes);
        map["deliveries"] = By<TodayActiveRow, int>(r => r.Deliveries);
        map["status"] = By<TodayActiveRow, string>(r => r.Status);
        return map;
    }

    private IQueryable<TucCourier> TodayActiveScope(TodayActiveDriversFilterRequest request, DateTime today)
    {
        var dayStart = today.Date;
        var dayEnd = dayStart.AddDays(1);
        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogInTime >= dayStart && c.CourierLogInOut.LogInTime < dayEnd);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            query = query.WithSearchFilter($"%{request.SearchTerm}%");
        }

        if (request.Fleet != 0)
        {
            query = query.Where(c => c.CourierFleetId == request.Fleet);
        }

        return query;
    }

    private IQueryable<TodayActiveRow> TodayActiveRows(IQueryable<TucCourier> scope, string status,
        TodayActiveDriversFilterRequest request, DateTime now, DateTime today)
    {
        var jobs = Context.TucJobs;
        var onDay = JobsOnDay(today);
        var filtered = status switch
        {
            "active" => scope.Where(c => c.CourierLogInOut.LogOutTime == null),
            "inactive" => scope.Where(c => c.CourierLogInOut.LogOutTime != null),
            _ => scope
        };

        var rows = filtered.Select(c => new TodayActiveRow
        {
            CourierId = c.UccrId,
            Code = c.Code,
            Name = c.UccrName + " " + c.UccrSurname,
            Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available",
            LogInTime = c.CourierLogInOut.LogInTime,
            LogOutTime = c.CourierLogInOut.LogOutTime,
            Status = c.CourierLogInOut.LogOutTime == null ? "Active" : "Inactive",
            Deliveries = jobs.Where(onDay).Count(j => j.UcjbCourierId == c.UccrId),
            SessionMinutes = EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime ?? now)
        });

        return Sort(rows, request.OrderBy, request.SortDescending, "name", TodayActiveSorts, r => r.CourierId);
    }

    private TodayActiveDriversViewModel ToTodayActiveViewModel(TodayActiveRow c, DateTime now, string tenantTimeZone) =>
        new()
        {
            CourierId = c.CourierId,
            Code = c.Code,
            Name = c.Name,
            Fleet = c.Fleet,
            LoginTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.LogInTime, tenantTimeZone),
            LogoutTime = c.LogOutTime.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(c.LogOutTime.Value, tenantTimeZone)
                : null,
            Duration = CourierActiveDuration(c.LogInTime, c.LogOutTime ?? now),
            Deliveries = c.Deliveries,
            Status = c.Status
        };

    public async Task<TodayActiveDriversPaginatedResponse> GetTodayActiveDriversAsync(
        TodayActiveDriversFilterRequest request)
    {
        var now = clock.TenantNow;
        var today = clock.TenantToday;
        var tenantTimeZone = infoService.GetTenantTimeZone();
        var page = PageOf(request);
        var pageSize = PageSizeOf(request);

        var status = NormaliseFilter(request.Status, "status", TodayActiveStatuses);
        var scope = TodayActiveScope(request, today);
        var rows = TodayActiveRows(scope, status, request, now, today);

        var totalCount = await rows.CountAsync();

        // Headline stats describe everyone who logged in today within the search/fleet scope, not the status tab.
        var totalDriversActiveToday = await scope.Select(c => c.UccrId).Distinct().CountAsync();
        var totalActiveDrivers = await scope.CountAsync(c => c.CourierLogInOut.LogOutTime == null);
        var averageSessionTime = await scope
            .Select(c => (double?)EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime ?? now))
            .AverageAsync() ?? 0.0;

        var pageRows = await rows
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .TagWith("GetTodayActiveDrivers - Paginated Rows")
            .ToListAsync();

        return new TodayActiveDriversPaginatedResponse
        {
            Items = pageRows.Select(c => ToTodayActiveViewModel(c, now, tenantTimeZone)).ToList(),
            Total = totalCount,
            Page = page,
            Pages = (int)Math.Ceiling(totalCount / (double)pageSize),
            TotalActiveDrivers = totalActiveDrivers,
            TotalDriversActiveToday = totalDriversActiveToday,
            AverageSessionTime = averageSessionTime
        };
    }

    public async Task<IReadOnlyList<TodayActiveDriversViewModel>> GetTodayActiveDriversForExportAsync(
        TodayActiveDriversFilterRequest request)
    {
        var now = clock.TenantNow;
        var today = clock.TenantToday;
        var tenantTimeZone = infoService.GetTenantTimeZone();

        var status = NormaliseFilter(request.Status, "status", TodayActiveStatuses);
        var rows = await TodayActiveRows(TodayActiveScope(request, today), status, request, now, today)
            .Take(MaxExportRows)
            .TagWith("GetTodayActiveDriversForExport")
            .ToListAsync();

        return [.. rows.Select(c => ToTodayActiveViewModel(c, now, tenantTimeZone))];
    }

    // ------------------------------------------------------------------ earnings

    private sealed class EarningsRow
    {
        public int CourierId { get; init; }
        public string Name { get; init; }
        public int MinutesLogged { get; init; }
        public int Deliveries { get; init; }
        public decimal Earnings { get; init; }
    }

    private static readonly IReadOnlyDictionary<string, Func<IQueryable<EarningsRow>, bool, IOrderedQueryable<EarningsRow>>>
        EarningsSorts = BuildEarningsSorts();

    private static Dictionary<string, Func<IQueryable<EarningsRow>, bool, IOrderedQueryable<EarningsRow>>>
        BuildEarningsSorts()
    {
        var map = NewMap<EarningsRow>();
        map["name"] = By<EarningsRow, string>(r => r.Name);
        map["minutesLogged"] = By<EarningsRow, int>(r => r.MinutesLogged);
        map["deliveries"] = By<EarningsRow, int>(r => r.Deliveries);
        map["earnings"] = By<EarningsRow, double>(r => (double)r.Earnings);
        map["hourlyRate"] = By<EarningsRow, double>(r =>
            r.MinutesLogged > 0 && r.Earnings > 0 ? (double)r.Earnings * 60.0 / r.MinutesLogged : 0.0);
        return map;
    }

    private static Expression<Func<TucJob, bool>> JobsOnDay(DateTime day)
    {
        var start = day.Date;
        var end = start.AddDays(1);
        return j => j.UcjbDate >= start && j.UcjbDate < end;
    }

    private IQueryable<TucCourier> EarningsScope(PaginatedRequest request, DateTime now)
    {
        var dayStart = now.Date;
        var dayEnd = dayStart.AddDays(1);
        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogInTime >= dayStart && c.CourierLogInOut.LogInTime < dayEnd);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            query = query.WithSearchFilter($"%{request.SearchTerm}%");
        }

        return query;
    }

    private IQueryable<EarningsRow> EarningsRows(IQueryable<TucCourier> scope, PaginatedRequest request,
        DateTime now)
    {
        var jobs = Context.TucJobs;
        var onDay = JobsOnDay(now);

        var rows = scope.Select(c => new EarningsRow
        {
            CourierId = c.UccrId,
            Name = c.UccrName + " " + c.UccrSurname,
            MinutesLogged = EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime ?? now),
            Deliveries = jobs.Where(onDay).Count(j => j.UcjbCourierId == c.UccrId),
            Earnings = jobs.Where(onDay).Where(j => j.UcjbCourierId == c.UccrId)
                .Sum(j => j.CourierPayment) ?? 0m
        });

        return Sort(rows, request.OrderBy, request.SortDescending, "name", EarningsSorts, r => r.CourierId);
    }

    private static CourierDailyEarningsViewModel ToEarningsViewModel(EarningsRow r) => new()
    {
        CourierId = r.CourierId,
        Name = r.Name,
        MinutesLogged = r.MinutesLogged,
        Deliveries = r.Deliveries,
        Earnings = r.Earnings,
        HourlyRate = r.MinutesLogged > 0 && r.Earnings > 0 ? r.Earnings / (r.MinutesLogged / 60.0m) : 0
    };

    public async Task<CourierDailyEarningsPaginatedResponse> GetCourierDailyEarningsAsync(PaginatedRequest request)
    {
        var now = clock.TenantNow;
        var page = PageOf(request);
        var pageSize = PageSizeOf(request);

        var scope = EarningsScope(request, now);
        var rows = EarningsRows(scope, request, now);

        var totalCount = await scope.CountAsync();

        // Totals use the table's own scope and job-date predicate so the cards always add up to the rows.
        var scopeIds = scope.Select(c => c.UccrId);
        var jobTotals = await Context.TucJobs
            .Where(JobsOnDay(now))
            .Where(j => j.UcjbCourierId.HasValue && scopeIds.Contains(j.UcjbCourierId.Value))
            .GroupBy(_ => 1)
            .Select(g => new { Deliveries = g.Count(), Earnings = g.Sum(j => j.CourierPayment) ?? 0m })
            .TagWith("GetCourierDailyEarnings - Scope Totals")
            .FirstOrDefaultAsync();

        var totalMinutes = await scope.SumAsync(c => (double)EF.Functions.DateDiffMinute(
            c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? now));

        var totalEarnings = jobTotals?.Earnings ?? 0m;
        var averageHourlyRate = totalMinutes > 0 ? totalEarnings / (decimal)(totalMinutes / 60.0) : 0;

        var pageRows = await rows
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .TagWith("GetCourierDailyEarnings - Paginated Rows")
            .ToListAsync();

        return new CourierDailyEarningsPaginatedResponse
        {
            Items = pageRows.Select(ToEarningsViewModel).ToList(),
            Page = page,
            Pages = (int)Math.Ceiling(totalCount / (double)pageSize),
            Total = totalCount,
            TotalEarningsToday = totalEarnings,
            AverageHourlyRate = averageHourlyRate,
            TotalActiveDrivers = totalCount,
            TotalDeliveriesToday = jobTotals?.Deliveries ?? 0
        };
    }

    public async Task<IReadOnlyList<CourierDailyEarningsViewModel>> GetCourierDailyEarningsForExportAsync(
        PaginatedRequest request)
    {
        var now = clock.TenantNow;

        var rows = await EarningsRows(EarningsScope(request, now), request, now)
            .Take(MaxExportRows)
            .TagWith("GetCourierDailyEarningsForExport")
            .ToListAsync();

        return [.. rows.Select(ToEarningsViewModel)];
    }
}

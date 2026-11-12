#nullable enable annotations
using System.Diagnostics;
using System.Linq.Expressions;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interceptors;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;

namespace DespatchWeb.EntityClasses;

public partial class DespatchContext
{
    private readonly IScopeProvider? _scopeProvider;

    private ScopeContext CurrentScope =>
        _scopeProvider?.Scope ?? ScopeContext.BackgroundContext;

    public bool CurrentBypassFilters =>
        CurrentScope.BypassFilters
        || CurrentScope.IsDfAdmin
        || ((CurrentScope.IsTenant || CurrentScope.IsInternal) && !CurrentScope.IsBranchScoped);

    public int? CurrentNpAgentId => CurrentScope.NpAgentId;
    public bool CurrentIsNetworkPartner => CurrentScope.IsNetworkPartner;
    public bool CurrentIsCustomerScoped => CurrentScope.IsCustomerScoped;
    public int? CurrentClientId => CurrentScope.ClientId;
    public bool CurrentIsBranchScoped => CurrentScope.IsBranchScoped;
    public int[] CurrentBranchIds => CurrentScope.BranchIds?.ToArray() ?? [];
    public bool CurrentDefaultBranchInScope => CurrentScope.DefaultBranchInScope;
    public int[] CurrentBranchSiteIds => CurrentScope.BranchSiteIds?.ToArray() ?? [];

    /// <summary>Client filter key that job-rooted queries drop, so a visible job still loads its client.</summary>
    public const string BranchClientsFilter = "BranchClients";

    /// <summary>Courier filter key that job-rooted queries drop, so a visible job still loads its couriers.</summary>
    public const string BranchCouriersFilter = "BranchCouriers";

    private const string ScopeFilter = "Scope";

    public DespatchContext(DbContextOptions<DespatchContext> options, IScopeProvider scopeProvider)
        : this(options)
    {
        _scopeProvider = scopeProvider;
    }

    private static readonly Func<DespatchContext, int, Task<bool>> IsLiveJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs.Any(j => j.UcjbId == jobId));


    private static readonly Func<DespatchContext, int, Task<bool>> IsLivePartnerJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs.Any(j => j.UcjbId == jobId && j.PartnerJobGuid.HasValue));

    private static readonly Func<DespatchContext, int, Task<bool>> IsArchivedPartnerJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives.Any(j => j.UcjbId == jobId && j.PartnerJobGuid.HasValue));

    private static readonly Func<DespatchContext, int, string, Task<bool>> IsOutboundPartnerJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId, string localTenantId) =>
            context.TucJobs.Any(j => j.UcjbId == jobId
                                     && j.PartnerPairing != null
                                     && j.PartnerPairing.OwnerTenantId == localTenantId));

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId ?? j.UcjbId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveArchiveJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId ?? j.UcjbId)
                .FirstOrDefault());

    // A leg released from bulk before its parent keeps the parent's tblBulkJob id in ParentId, so the
    // parent only counts when it is a row in the same table; otherwise the job is its own owner.
    private static readonly Func<DespatchContext, int, Task<int?>> GetEffectiveExistingJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => (int?)(j.ParentId != null && context.TucJobs.Any(p => p.UcjbId == j.ParentId)
                    ? j.ParentId.Value
                    : j.UcjbId))
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<int?>> GetEffectiveExistingArchiveJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(j => (int?)(j.ParentId != null && context.TucJobArchives.Any(p => p.UcjbId == j.ParentId)
                    ? j.ParentId.Value
                    : j.UcjbId))
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveBulkJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int bulkJobId) =>
            context.TblBulkJobs
                .Where(j => j.BulkJobId == bulkJobId)
                .Select(j => j.BulkParentId ?? j.BulkJobId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveJobBookingIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobBookingId) =>
            context.TucJobBookings
                .Where(j => j.UcbkId == jobBookingId)
                .Select(j => j.BookingParentId ?? j.UcbkId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<bool>> IsJobArchivedCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives.Any(j => j.UcjbId == jobId));

    private static readonly Func<DespatchContext, int, Task<int?>> GetJobParentIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, Task<int?>> GetEconomySpeedIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TucJobTypes
                .Where(s => s.UcjtName == "Economy")
                .Select(s => (int?)s.UcjtId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, Task<DateTime?>> GetEcoDeliveryTimeCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TblEcoSettings
                .Select(x => x.EconomyDeliveryTime)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, bool, Task<bool>> DoesAddressMatchAirportComplied =
        EF.CompileAsyncQuery((DespatchContext context, int jobId, bool isPickupAddress) =>
            context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Any(j => context.TblAirports
                    .Any(a => a.AddressLine2 == (isPickupAddress ? j.PickupAddressLine2 : j.DeliveryAddressLine2))));

    private static readonly Func<DespatchContext, DateTime, IAsyncEnumerable<ActiveCourierDto>>
        GetActiveCouriersCompiled = EF.CompileAsyncQuery((DespatchContext context, DateTime today) =>
            context.TucCouriers
                .Where(c => c.Active &&
                            (c.SendJobsViaSms ||
                             c.SendAlertSms ||
                             (c.CourierLogInOut != null &&
                              c.CourierLogInOut.LogInTime.Date == today.Date &&
                              c.CourierLogInOut.LogOutTime == null)))
                .OrderBy(c => c.Code)
                .Select(c => new ActiveCourierDto
                {
                    CourierId = c.UccrId,
                    Code = c.Code,
                    Name = c.UccrName + " " + c.UccrSurname,
                    DangerousGoods = c.UccrDangerousGoods == 1,
                    DgLicenseExpiry = c.DglicenseExpiry,
                    VehicleType = c.UccrVehicle,
                    JobCount = 0
                }));

    private static readonly Func<DespatchContext, NoteType, Task<bool>> ConfirmNoteTypeExistsCompiled =
        EF.CompileAsyncQuery((DespatchContext context, NoteType noteType) =>
            context.TucNoteTypes.Any(n => n.NoteTypeId == (int)noteType));

    private static readonly Func<DespatchContext, int, DateTime, Task<ActiveCouriersViewModel>> GetCourierByIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int courierId, DateTime now) =>
            context.TucCouriers
                .Where(c => c.UccrId == courierId)
                .Select(c => new ActiveCouriersViewModel
                {
                    Code = c.Code,
                    Name = c.UccrName,
                    CourierId = c.UccrId,
                    DangerousGoods = c.UccrDangerousGoods == 1,
                    DGLicenseExpiry = c.DglicenseExpiry,
                    VehicleType = c.UccrVehicle,
                    IsActive = c.Active == true && (
                        c.SendJobsViaSms == true ||
                        c.SendAlertSms == true ||
                        (c.SendJobsViaSms == false &&
                         c.CourierLogInOut != null &&
                         c.CourierLogInOut.LogInTime.Date == now.Date &&
                         c.CourierLogInOut.LogOutTime == null)
                    )
                })
                .FirstOrDefault());


    private static readonly Func<DespatchContext, IAsyncEnumerable<Suggestion>> GetAllVehicleSizesCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.VehicleSizes
                .OrderBy(v => v.VehicleName)
                .Select(v => new Suggestion { Id = v.VehicleSizeId, Text = v.VehicleName }));

    private static readonly Func<DespatchContext, IAsyncEnumerable<Suggestion>> GetAllRegionsCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TblBulkRegions
                .OrderBy(r => r.Name)
                .Select(r => new Suggestion { Id = r.BulkRegionId, Text = r.Name }));

    private static readonly Func<DespatchContext, IAsyncEnumerable<Suggestion>> GetAllSpeedsCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TucJobTypes
                .OrderBy(r => r.UcjtName)
                .Select(r => new Suggestion { Id = r.UcjtId, Text = r.UcjtName }));

    private static readonly Func<DespatchContext, int, IAsyncEnumerable<TucNoteViewModel>>
        GetActiveNotesByJobIdCompiled =
            EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
                context.TucNotes
                    .Where(n => n.JobId == jobId)
                    .OrderByDescending(n => n.CreatedDate)
                    .Select(NoteMappings.ActiveNoteMap));

    private static readonly Func<DespatchContext, int, Task<int>> GetUnreadMessageCountCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int staffId) =>
            context.TucManualMessages
                .Count(m => m.UcmmSendToStaffId == staffId && !m.Read)
        );

    private static readonly Func<DespatchContext, int, Task<TucNoteViewModel>> GetActiveNoteByIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int noteId) =>
            context.TucNotes
                .Where(x => x.NoteId == noteId)
                .Select(NoteMappings.ActiveNoteMap)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, string, Task<bool>> JobNumberExistsAsyncCompiled =
        EF.CompileAsyncQuery((DespatchContext context, string jobNumber) =>
            context.TucJobs.Any(j => j.UcjbNumber == jobNumber));

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.AddInterceptors(BranchJobContextInterceptor.Instance);

#if DEBUG
        if (Debugger.IsAttached)
        {
            optionsBuilder.LogTo(Console.WriteLine,
                    [DbLoggerCategory.Database.Command.Name],
                    LogLevel.Information)
                .EnableSensitiveDataLogging();
        }
#endif
    }

    public async Task<bool> JobNumberExistsAsync(string jobNumber) =>
        await JobNumberExistsAsyncCompiled(this, jobNumber);

    public async Task<TucNoteViewModel> GetActiveNotesByNoteIdAsync(int noteId) =>
        await GetActiveNoteByIdCompiled(this, noteId);

    public async Task<IReadOnlyList<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId) =>
        await GetActiveNotesByJobIdCompiled(this, jobId).ToListAsync();

    public async Task<int> GetUnreadMessageCountAsync(int staffId, DespatchContext? context) =>
        await GetUnreadMessageCountCompiled(context ?? this, staffId);

    public async Task<IReadOnlyList<Suggestion>> GetAllVehicleSizesAsync() =>
        await GetAllVehicleSizesCompiled(this).ToListAsync();

    public async Task<IReadOnlyList<Suggestion>> GetAllRegionsAsync() =>
        await GetAllRegionsCompiled(this).ToListAsync();

    public async Task<IReadOnlyList<Suggestion>> GetAllSpeedsAsync() => await GetAllSpeedsCompiled(this).ToListAsync();

    public async Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId, DateTime tenantTime) =>
        await GetCourierByIdCompiled(this, courierId, tenantTime);

    public async Task<IReadOnlyList<ActiveCourierDto>> GetActiveCouriersAsync(DateTime today) =>
        await GetActiveCouriersCompiled(this, today).ToListAsync();

    public async Task<bool> ConfirmNoteTypeExistsAsync(NoteType noteType) =>
        await ConfirmNoteTypeExistsCompiled(this, noteType);

    public async Task<int> GetEffectiveJobIdAsync(int jobId) => await GetEffectiveJobIdCompiled(this, jobId);

    public async Task<int> GetEffectiveArchiveJobIdAsync(int jobId) =>
        await GetEffectiveArchiveJobIdCompiled(this, jobId);

    public async Task<int?> GetEffectiveExistingJobIdAsync(int jobId) =>
        await GetEffectiveExistingJobIdCompiled(this, jobId);

    public async Task<int?> GetEffectiveExistingArchiveJobIdAsync(int jobId) =>
        await GetEffectiveExistingArchiveJobIdCompiled(this, jobId);

    public async Task<int> GetEffectiveBulkJobIdAsync(int bulkJobId) =>
        await GetEffectiveBulkJobIdCompiled(this, bulkJobId);

    public async Task<int> GetEffectiveJobBookingIdAsync(int jobBookingId) =>
        await GetEffectiveJobBookingIdCompiled(this, jobBookingId);

    public async Task<bool> IsJobArchivedAsync(int jobId) => await IsJobArchivedCompiled(this, jobId);
    public async Task<int?> GetJobParentIdAsync(int jobId) => await GetJobParentIdCompiled(this, jobId);
    public async Task<int?> GetEconomySpeedIdAsync() => await GetEconomySpeedIdCompiled(this);
    public async Task<DateTime?> GetEcoDeliveryTimeAsync() => await GetEcoDeliveryTimeCompiled(this);

    public async Task<bool> DoesAddressMatchAirportAsync(int jobId, bool isPickupAddress) =>
        await DoesAddressMatchAirportComplied(this, jobId, isPickupAddress);

    public async Task<bool> IsLiveJobAsync(int jobId) => await IsLiveJobCompiled(this, jobId);

    public async Task<bool> IsPartnerJobAsync(int jobId) =>
        await IsLivePartnerJobCompiled(this, jobId)
        || await IsArchivedPartnerJobCompiled(this, jobId);

    public async Task<bool> IsOutboundPartnerJobAsync(int jobId, string? localTenantId) =>
        !string.IsNullOrEmpty(localTenantId)
        && await IsOutboundPartnerJobCompiled(this, jobId, localTenantId);

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TucJobBooking>(entity =>
        {
            entity.HasOne(d => d.Route)
                .WithMany()
                .HasForeignKey(d => d.RouteId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(WithBranchJobArm<TucJobBooking, BranchFamilyJobBooking>(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.UcbkClientId == CurrentClientId),
                new BranchJobShape<TucJobBooking>(j => j.UcbkId, j => j.BookingParentId, j => j.BookingRootParentId)));
        });

        modelBuilder.Entity<TblJob>(entity =>
        {
            entity.HasOne(d => d.Client)
                .WithMany()
                .HasForeignKey(d => d.ClientId);

            entity.HasOne(d => d.StatusNavigation)
                .WithMany()
                .HasForeignKey(d => d.Status);

            entity.HasOne(d => d.Agent)
                .WithMany()
                .HasForeignKey(d => d.AgentId);

            entity.HasOne(d => d.Invoice)
                .WithMany()
                .HasForeignKey(d => d.InvoiceNo);

            entity.HasOne(d => d.LoggedInContact)
                .WithMany()
                .HasForeignKey(d => d.LoggedInContactId);

            entity.HasOne(d => d.Courier)
                .WithMany()
                .HasForeignKey(d => d.CourierId);

            entity.HasOne(d => d.FromSuburb)
                .WithMany()
                .HasForeignKey(d => d.FromSuburbId);

            entity.HasOne(d => d.ToSuburb)
                .WithMany()
                .HasForeignKey(d => d.ToSuburbId);
        });

        modelBuilder.Entity<TucJob>(entity =>
        {
            entity.HasOne(d => d.Parent)
                .WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.LoggedInContact)
                .WithMany()
                .HasForeignKey(d => d.LoggedInContactId)
                .HasPrincipalKey(cc => cc.UcctId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<TblBulkJob>()
                .WithMany()
                .HasForeignKey(d => d.BulkParentId)
                .HasPrincipalKey(b => b.BulkJobId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.AddressDetail)
                .WithOne()
                .HasForeignKey<TucJobAddressDeatil>(ad => ad.JobId)
                .HasPrincipalKey<TucJob>(j => j.UcjbId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.NpAgent)
                .WithMany()
                .HasForeignKey(d => d.NpAgentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(WithBranchJobArm<TucJob, BranchFamilyJob>(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.UcjbClientId == CurrentClientId),
                new BranchJobShape<TucJob>(j => j.UcjbId, j => j.ParentId, j => j.RootParentId)));
        });

        modelBuilder.Entity<TblBulkJob>(entity =>
        {
            entity.HasOne(d => d.Parent)
                .WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.LoggedInContact)
                .WithMany()
                .HasForeignKey(d => d.LoggedInContactId)
                .HasPrincipalKey(cc => cc.UcctId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(WithBranchJobArm<TblBulkJob, BranchFamilyBulkJob>(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.ClientId == CurrentClientId),
                new BranchJobShape<TblBulkJob>(j => j.BulkJobId, j => j.BulkParentId, _ => null)));
        });

        modelBuilder.Entity<TblBulkRunSchedule>(entity =>
        {
            entity.HasOne(d => d.RegionNavigation)
                .WithMany()
                .HasForeignKey(d => d.Region);
        });

        // SQLite (tests) can't parse a schema-qualified function call in a column default, and
        // EnsureCreated skips views, so the tblBulkRunSchedule view becomes a table there.
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite")
        {
            modelBuilder.Entity<TucEvent>()
                .Property(e => e.UcevDueTime)
                .HasDefaultValueSql("(getdate())", "DF_tucEvent_ucevDueTime");

            modelBuilder.Entity<TblBulkRunSchedule>().ToTable("tblBulkRunSchedule");
        }

        modelBuilder.Entity<TucJobArchive>(entity =>
        {
            entity.HasOne(d => d.NpAgent)
                .WithMany()
                .HasForeignKey(d => d.NpAgentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UcjbClient)
                .WithMany()
                .HasForeignKey(d => d.UcjbClientId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Contact)
                .WithMany()
                .HasForeignKey(d => d.ContactId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.InternalStatusNavigation)
                .WithMany()
                .HasForeignKey(d => d.InternalStatus)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UndeliverableLocation)
                .WithMany()
                .HasForeignKey(d => d.UndeliverableLocationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.NotifiedJobType)
                .WithMany()
                .HasForeignKey(d => d.NotifiedJobTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.SpeedNavigation)
                .WithMany()
                .HasForeignKey(d => d.UcjbSpeed)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.DeliverToLeave)
                .WithMany()
                .HasForeignKey(d => d.DeliverToLeaveId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Parent)
                .WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Nationwide)
                .WithOne()
                .HasForeignKey<TucJobNationwide>(d => d.UcnwJobId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(d => d.PricingBreakdowns)
                .WithOne()
                .HasForeignKey(p => p.JobId)
                .HasPrincipalKey(j => j.UcjbId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(d => d.NoteArchives)
                .WithOne()
                .HasForeignKey(n => n.JobBookingId)
                .HasPrincipalKey(j => j.UcjbId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.LoggedInContact)
                .WithMany()
                .HasForeignKey(d => d.LoggedInContactId)
                .HasPrincipalKey(cc => cc.UcctId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.InvoiceProcess)
                .WithMany()
                .HasForeignKey(d => d.InvoiceProcessId)
                .HasPrincipalKey(cc => cc.UcipId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Invoice)
                .WithMany()
                .HasForeignKey(d => d.UcjbInvoiceNo)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.AcceptedJobType)
                .WithMany()
                .HasForeignKey(d => d.AcceptedJobTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.DesiredJobType)
                .WithMany()
                .HasForeignKey(d => d.DesiredJobTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UcjbCourier)
                .WithMany()
                .HasForeignKey(d => d.UcjbCourierId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UcjbStatusNavigation)
                .WithMany()
                .HasForeignKey(d => d.UcjbStatus)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UcjbFromNavigation)
                .WithMany()
                .HasForeignKey(d => d.UcjbFrom)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UcjbToNavigation)
                .WithMany()
                .HasForeignKey(d => d.UcjbTo)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Source)
                .WithMany()
                .HasForeignKey(d => d.SourceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.ClosestCourier)
                .WithMany()
                .HasForeignKey(d => d.ClosestCourierId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.JobRelationshipType)
                .WithMany()
                .HasForeignKey(d => d.JobRelationshipTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.AddressDetail)
                .WithOne()
                .HasForeignKey<TucJobAddressDeatil>(ad => ad.JobId)
                .HasPrincipalKey<TucJobArchive>(j => j.UcjbId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(d => d.TucJobItemsArchiveJobs)
                .WithOne(i => i.Job)
                .HasForeignKey(i => i.JobId)
                .HasPrincipalKey(j => j.UcjbId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.UcjbDisp)
                .WithMany()
                .HasForeignKey(d => d.UcjbDispId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(WithBranchJobArm<TucJobArchive, BranchFamilyJobArchive>(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.UcjbClientId == CurrentClientId),
                new BranchJobShape<TucJobArchive>(j => j.UcjbId, j => j.ParentId, j => j.RootParentId)));
        });

        MapBranchFamily<BranchFamilyJob>(modelBuilder, "tucJob", "ucjbID", "ParentID", "RootParentID",
            "ucjbClientID", "ucjbCourierID", "ucjbFrom", "ucjbTo");
        MapBranchFamily<BranchFamilyJobArchive>(modelBuilder, "tucJobArchive", "ucjbID", "ParentID", "RootParentID",
            "ucjbClientID", "ucjbCourierID", "ucjbFrom", "ucjbTo");
        MapBranchFamily<BranchFamilyJobBooking>(modelBuilder, "tucJobBooking", "ucbkID", "BookingParentID",
            "BookingRootParentID", "ucbkClientID", "CourierID");
        MapBranchFamily<BranchFamilyBulkJob>(modelBuilder, "tblBulkJob", "BulkJobID", "BulkParentID", null,
            "ClientID", "CourierID");

        // Client and courier lists for a branch-limited user. Both are named so a job-rooted
        // query can drop them (BranchJobContextInterceptor): a visible job shows its client
        // and couriers even when they belong to another branch.
        modelBuilder.Entity<TucClient>().HasQueryFilter(BranchClientsFilter, Inline<TucClient>(c =>
            !CurrentIsBranchScoped || ClientInUserBranches(c)));

        modelBuilder.Entity<TucCourier>()
            .HasQueryFilter(ScopeFilter, c =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && c.NpAgentId == CurrentNpAgentId)
                || CurrentIsBranchScoped)
            .HasQueryFilter(BranchCouriersFilter, Inline<TucCourier>(c =>
                !CurrentIsBranchScoped || CourierInUserBranches(c)));

        // Notes follow their job (or prebook); a note on neither is not branch data.
        modelBuilder.Entity<TucNote>().HasQueryFilter(n =>
            CurrentBypassFilters
            || (CurrentIsNetworkPartner && CurrentNpAgentId != null && n.NpAgentId == CurrentNpAgentId)
            || (CurrentIsBranchScoped
                && (n.JobId != null
                    ? Set<TucJob>().Any(j => j.UcjbId == n.JobId)
                    : n.JobBookingId == null || Set<TucJobBooking>().Any(b => b.UcbkId == n.JobBookingId))));

        modelBuilder.Entity<TucNoteArchive>(entity =>
        {
            entity.HasOne<TucNoteType>()
                .WithMany()
                .HasForeignKey(n => n.NoteTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<TucStaff>()
                .WithMany()
                .HasForeignKey(n => n.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<TucStaff>()
                .WithMany()
                .HasForeignKey(n => n.UpdatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(n =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && n.NpAgentId == CurrentNpAgentId)
                || (CurrentIsBranchScoped
                    && (n.JobId != null
                        ? Set<TucJobArchive>().Any(j => j.UcjbId == n.JobId)
                        : n.JobBookingId == null || Set<TucJobBooking>().Any(b => b.UcbkId == n.JobBookingId))));
        });

        modelBuilder.Entity<JobDeliveryJourneyArchive>(entity =>
        {
            entity.HasOne(d => d.Courier).WithMany()
                .HasForeignKey(d => d.CourierId);

            entity.HasOne(d => d.Flight).WithMany()
                .HasForeignKey(d => d.FlightId);

            entity.HasOne(d => d.Job).WithMany()
                .HasForeignKey(d => d.JobId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.NewAgent).WithMany()
                .HasForeignKey(d => d.NewAgentId);

            entity.HasOne(d => d.NewCourier).WithMany()
                .HasForeignKey(d => d.NewCourierId);

            entity.HasOne(d => d.NewInternalStatus).WithMany()
                .HasForeignKey(d => d.NewInternalStatusId);

            entity.HasOne(d => d.NewJobStatus).WithMany()
                .HasForeignKey(d => d.NewJobStatusId);

            entity.HasOne(d => d.OldAgent).WithMany()
                .HasForeignKey(d => d.OldAgentId);

            entity.HasOne(d => d.OldCourier).WithMany()
                .HasForeignKey(d => d.OldCourierId);

            entity.HasOne(d => d.OldInternalStatus).WithMany()
                .HasForeignKey(d => d.OldInternalStatusId);

            entity.HasOne(d => d.OldJobStatus).WithMany()
                .HasForeignKey(d => d.OldJobStatusId);

            entity.HasOne(d => d.Staff).WithMany()
                .HasForeignKey(d => d.StaffId);
        });
    }

    /// <summary>
    /// Branches spec section 4.1 (12 Nov): a branch-limited user sees a whole job family
    /// (parent, every leg, the pickup leg) when ANY member's client branch, courier home
    /// branch, or pickup / delivery suburb site is one of theirs. The family is every row of
    /// the same table sharing the root <c>RootParentId ?? ParentId ?? id</c>. The one place
    /// the rule lives; <typeparamref name="TFamily"/> is that table's filter-free view.
    /// </summary>
    private Expression<Func<T, bool>> BranchJobVisible<T, TFamily>(BranchJobShape<T> shape)
        where T : class where TFamily : class =>
        new BranchRuleInliner(this, shape.Id, shape.ParentId, shape.RootParentId).Inline<T>(row =>
            CurrentIsBranchScoped
            && Set<TFamily>().Any(m =>
                (FamilyId(m) == FamilyRoot(row)
                 || FamilyParentId(m) == FamilyRoot(row)
                 || FamilyRootParentId(m) == FamilyRoot(row))
                && (Set<TucClient>().Any(c => c.UcclId == FamilyClientId(m) && ClientInUserBranches(c))
                    || Set<TucCourier>().Any(r => r.UccrId == FamilyCourierId(m) && CourierInUserBranches(r))
                    || (FamilyHasAddresses(m)
                        && Set<TucSuburb>().Any(s =>
                            (s.UcsuId == FamilyFromSuburbId(m) || s.UcsuId == FamilyToSuburbId(m))
                            && s.SiteId != null
                            && CurrentBranchSiteIds.Contains(s.SiteId.Value))))));

    /// <summary>Clients in the user's branches, plus the house accounts every staff member shares.</summary>
    private Expression<Func<TucClient, bool>> ClientInUserBranchesRule => c =>
        (c.BranchId != null && CurrentBranchIds.Contains(c.BranchId.Value))
        || c.ClientTypeId == (int)ClientType.Tenant
        || c.ClientTypeId == (int)ClientType.Internal
        || c.ClientTypeId == (int)ClientType.DfrntAdmin
        || c.UcclId == CurrentClientId;

    /// <summary>Couriers whose home branch is one of the user's; no home branch = the default branch (D1).</summary>
    private Expression<Func<TucCourier, bool>> CourierInUserBranchesRule => r =>
        (r.BranchId != null && CurrentBranchIds.Contains(r.BranchId.Value))
        || (r.BranchId == null && CurrentDefaultBranchInScope);

    private Expression<Func<T, bool>> WithBranchJobArm<T, TFamily>(
        Expression<Func<T, bool>> existing, BranchJobShape<T> shape)
        where T : class where TFamily : class
    {
        var rule = BranchJobVisible<T, TFamily>(shape);
        var branchArm = ReplacingExpressionVisitor.Replace(rule.Parameters[0], existing.Parameters[0], rule.Body);
        return Expression.Lambda<Func<T, bool>>(Expression.OrElse(existing.Body, branchArm), existing.Parameters);
    }

    private Expression<Func<T, bool>> Inline<T>(Expression<Func<T, bool>> filter) =>
        new BranchRuleInliner(this, null, null, null).Inline(filter);

    private static void MapBranchFamily<TFamily>(ModelBuilder modelBuilder, string table, string id,
        string parentId, string? rootParentId, string clientId, string courierId,
        string? fromSuburbId = null, string? toSuburbId = null) where TFamily : class
    {
        // ToView keeps EnsureCreated (SQLite tests) from creating a second table; it reads the real one.
        var entity = modelBuilder.Entity<TFamily>();
        entity.HasNoKey().ToView(table);
        entity.Property<int>("Id").HasColumnName(id);
        entity.Property<int?>("ParentId").HasColumnName(parentId);
        entity.Property<int?>("ClientId").HasColumnName(clientId);
        entity.Property<int?>("CourierId").HasColumnName(courierId);
        if (rootParentId != null) entity.Property<int?>("RootParentId").HasColumnName(rootParentId);
        if (fromSuburbId != null) entity.Property<int?>("FromSuburbId").HasColumnName(fromSuburbId);
        if (toSuburbId != null) entity.Property<int?>("ToSuburbId").HasColumnName(toSuburbId);
    }

    // Markers, expanded by BranchRuleInliner before EF sees the filter. Never executed.
    private static bool ClientInUserBranches(TucClient client) => throw new UnreachableException();
    private static bool CourierInUserBranches(TucCourier courier) => throw new UnreachableException();
    private static int FamilyRoot<T>(T row) => throw new UnreachableException();
    private static int FamilyId<T>(T member) => throw new UnreachableException();
    private static int? FamilyParentId<T>(T member) => throw new UnreachableException();
    private static int? FamilyRootParentId<T>(T member) => throw new UnreachableException();
    private static int? FamilyClientId<T>(T member) => throw new UnreachableException();
    private static int? FamilyCourierId<T>(T member) => throw new UnreachableException();
    private static bool FamilyHasAddresses<T>(T member) => throw new UnreachableException();
    private static int? FamilyFromSuburbId<T>(T member) => throw new UnreachableException();
    private static int? FamilyToSuburbId<T>(T member) => throw new UnreachableException();

    /// <summary>How a job table names the columns that locate a row's family root.</summary>
    private sealed record BranchJobShape<T>(
        Expression<Func<T, int>> Id,
        Expression<Func<T, int?>> ParentId,
        Expression<Func<T, int?>> RootParentId);

    private sealed class BranchRuleInliner(
        DespatchContext context,
        LambdaExpression? rowId,
        LambdaExpression? rowParentId,
        LambdaExpression? rowRootParentId) : ExpressionVisitor
    {
        public Expression<Func<T, bool>> Inline<T>(Expression<Func<T, bool>> template) =>
            (Expression<Func<T, bool>>)Visit(template);

        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.DeclaringType != typeof(DespatchContext) || !node.Method.IsStatic)
            {
                return base.VisitMethodCall(node);
            }

            var arg = node.Arguments.Count == 1 ? Visit(node.Arguments[0]) : null;
            return node.Method.Name switch
            {
                nameof(ClientInUserBranches) => Apply(context.ClientInUserBranchesRule, arg!),
                nameof(CourierInUserBranches) => Apply(context.CourierInUserBranchesRule, arg!),
                nameof(FamilyRoot) => Expression.Coalesce(
                    Apply(rowRootParentId!, arg!),
                    Expression.Coalesce(Apply(rowParentId!, arg!), Apply(rowId!, arg!))),
                nameof(FamilyId) => Member(arg!, "Id", typeof(int)),
                nameof(FamilyParentId) => Member(arg!, "ParentId", typeof(int?)),
                nameof(FamilyRootParentId) => Member(arg!, "RootParentId", typeof(int?)),
                nameof(FamilyClientId) => Member(arg!, "ClientId", typeof(int?)),
                nameof(FamilyCourierId) => Member(arg!, "CourierId", typeof(int?)),
                nameof(FamilyHasAddresses) => Expression.Constant(arg!.Type.GetProperty("ToSuburbId") != null),
                nameof(FamilyFromSuburbId) => Member(arg!, "FromSuburbId", typeof(int?)),
                nameof(FamilyToSuburbId) => Member(arg!, "ToSuburbId", typeof(int?)),
                _ => base.VisitMethodCall(node)
            };
        }

        private static Expression Member(Expression member, string name, Type type) =>
            member.Type.GetProperty(name) != null
                ? Expression.Property(member, name)
                : Expression.Constant(null, type);

        private Expression Apply(LambdaExpression lambda, Expression argument) =>
            Visit(ReplacingExpressionVisitor.Replace(lambda.Parameters[0], argument, lambda.Body));
    }
}

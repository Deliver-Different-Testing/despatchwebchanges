using System.Diagnostics;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.EntityClasses;

public partial class DespatchContext
{
    // Per-request data-scope context resolved by IScopeProvider from Hub
    // claims. When null (options-only ctor — scaffolding, design-time, tests
    // not exercising scope) every Current* property below short-circuits so
    // global filters pass every row.
    private readonly IScopeProvider _scopeProvider;

    private Models.ScopeContext CurrentScope =>
        _scopeProvider?.Scope ?? Models.ScopeContext.BackgroundContext;

    /// <summary>
    /// True when no row filter applies — background worker, scaffolding,
    /// design-time, DfrntAdmin (5), or Tenant (4). Exposed for EF query
    /// filter expressions.
    /// </summary>
    public bool CurrentBypassFilters =>
        CurrentScope.BypassFilters
        || CurrentScope.IsDfAdmin
        || CurrentScope.IsTenant;

    /// <summary>NP scope value used by the NetworkPartner predicate branch.</summary>
    public int? CurrentNpAgentId => CurrentScope.NpAgentId;

    /// <summary>True when ClientTypeId == 3 (NetworkPartner).</summary>
    public bool CurrentIsNetworkPartner => CurrentScope.IsNetworkPartner;

    /// <summary>True for ClientTypeId NULL / 1 / 2 — Customer scope branch.</summary>
    public bool CurrentIsCustomerScoped => CurrentScope.IsCustomerScoped;

    /// <summary>Customer/Internal scope value (tucClient.UcclId).</summary>
    public int? CurrentClientId => CurrentScope.ClientId;

    public DespatchContext(DbContextOptions<DespatchContext> options, IScopeProvider scopeProvider)
        : this(options)
    {
        _scopeProvider = scopeProvider;
    }

    // Compiled queries
    private static readonly Func<DespatchContext, int, Task<bool>> IsLiveJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs.Any(j => j.UcjbId == jobId));
    
    
    private static readonly Func<DespatchContext, int, Task<bool>> IsLivePartnerJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs.Any(j => j.UcjbId == jobId && j.PartnerJobGuid.HasValue));

    private static readonly Func<DespatchContext, int, Task<bool>> IsArchivedPartnerJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives.Any(j => j.UcjbId == jobId && j.PartnerJobGuid.HasValue));

    // "Outbound" = this tenant sent the job to a partner. The discriminator is
    // PartnerPairing.OwnerTenantId — outbound jobs are tied to a pairing this
    // tenant owns; inbound mirrors are tied to a pairing whose owner is the
    // originating partner. A null/empty localTenantId resolves to "cannot tell"
    // at the caller (see IsOutboundPartnerJobAsync) and returns false.
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
                .AsNoTracking()
                .Where(x => x.NoteId == noteId)
                .Select(NoteMappings.ActiveNoteMap)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, string, Task<bool>> JobNumberExistsAsyncCompiled =
        EF.CompileAsyncQuery((DespatchContext context, string jobNumber) =>
            context.TucJobs.AsNoTracking().Any(j => j.UcjbNumber == jobNumber));

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
#if DEBUG
        // Only enable detailed SQL logging when debugger is attached in DEBUG builds
        // This prevents sensitive query data from leaking to console in production
        if (Debugger.IsAttached)
        {
            optionsBuilder.LogTo(Console.WriteLine,
                    [DbLoggerCategory.Database.Command.Name],
                    LogLevel.Information)
                .EnableSensitiveDataLogging();
        }
#endif
    }

    // Access compiled queries
    public async Task<bool> JobNumberExistsAsync(string jobNumber) =>
        await JobNumberExistsAsyncCompiled(this, jobNumber);

    public async Task<TucNoteViewModel> GetActiveNotesByNoteIdAsync(int noteId) =>
        await GetActiveNoteByIdCompiled(this, noteId);

    public async Task<IReadOnlyList<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId) =>
        await GetActiveNotesByJobIdCompiled(this, jobId).ToListAsync();

    public async Task<int> GetUnreadMessageCountAsync(int staffId, DespatchContext context = null) =>
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

            // Spec branch: NP filters by NpAgentId (deny if missing); Customer/Internal/NULL
            // filter by UcbkClientId (deny if missing); Tenant/DfrntAdmin/background bypass.
            entity.HasQueryFilter(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.UcbkClientId == CurrentClientId));
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

        // Tuc Job
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

            entity.HasQueryFilter(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.UcjbClientId == CurrentClientId));
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

            entity.HasQueryFilter(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.ClientId == CurrentClientId));
        });

        // Tuc Job Archive 
        modelBuilder.Entity<TucJobArchive>(entity =>
        {
            // Configure foreign key relationships
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

            entity.HasQueryFilter(j =>
                CurrentBypassFilters
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && j.NpAgentId == CurrentNpAgentId)
                || (CurrentIsCustomerScoped && CurrentClientId != null && j.UcjbClientId == CurrentClientId));
        });

        // TucCourier — NP-scoped table per spec §2. No customer-side column, so
        // Customer-scoped users see no rows by default (DespatchWeb is not a
        // customer-facing surface; this is the safe default).
        modelBuilder.Entity<TucCourier>().HasQueryFilter(c =>
            CurrentBypassFilters
            || (CurrentIsNetworkPartner && CurrentNpAgentId != null && c.NpAgentId == CurrentNpAgentId));

        // TucNote / TucNoteArchive — NP-scoped notes only. Customers don't see notes in DespatchWeb.
        modelBuilder.Entity<TucNote>().HasQueryFilter(n =>
            CurrentBypassFilters
            || (CurrentIsNetworkPartner && CurrentNpAgentId != null && n.NpAgentId == CurrentNpAgentId));

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
                || (CurrentIsNetworkPartner && CurrentNpAgentId != null && n.NpAgentId == CurrentNpAgentId));
        });

        // JobDeliveryJourneyArchive - navigation properties to match JobDeliveryJourney
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
}
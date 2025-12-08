using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.EntityClasses;

public partial class DespatchContext
{
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (Debugger.IsAttached)
        {
            optionsBuilder.LogTo(Console.WriteLine,
                    [DbLoggerCategory.Database.Command.Name],
                    LogLevel.Information)
                .EnableSensitiveDataLogging();
        }
    }

    // Compiled queries
    private static readonly Func<DespatchContext, int, Task<bool>> IsLiveJobCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs.Any(j => j.UcjbId == jobId));

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId ?? j.UcjbId)
                .FirstOrDefault());
    
    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveArchiveJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives
                .AsNoTracking()
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId ?? j.UcjbId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveBulkJobIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int bulkJobId) =>
            context.TblBulkJobs
                .AsNoTracking()
                .Where(j => j.BulkJobId == bulkJobId)
                .Select(j => j.BulkParentId ?? j.BulkJobId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<int>> GetEffectiveJobBookingIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobBookingId) =>
            context.TucJobBookings
                .AsNoTracking()
                .Where(j => j.UcbkId == jobBookingId)
                .Select(j => j.ParentId ?? j.UcbkId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, int, Task<bool>> IsJobArchivedCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int jobId) =>
            context.TucJobArchives.Any(j => j.UcjbId == jobId));

    private static readonly Func<DespatchContext, Task<int?>> GetEconomySpeedIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TucJobTypes
                .AsNoTracking()
                .Where(s => s.UcjtName == "Economy")
                .Select(s => (int?)s.UcjtId)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, Task<DateTime?>> GetEcoDeliveryTimeCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TblEcoSettings
                .AsNoTracking()
                .Select(x => x.EconomyDeliveryTime)
                .FirstOrDefault());

    private static readonly Func<DespatchContext, DateTime, IAsyncEnumerable<ActiveCourierDto>>
        GetActiveCouriersCompiled = EF.CompileAsyncQuery((DespatchContext context, DateTime today) =>
            context.TucCouriers
                .AsNoTracking()
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
                    JobCount = 0
                }));

    private static readonly Func<DespatchContext, NoteType, Task<bool>> ConfirmNoteTypeExistsCompiled =
        EF.CompileAsyncQuery((DespatchContext context, NoteType noteType) =>
            context.TucNoteTypes.Any(n => n.NoteTypeId == (int)noteType));
    
    private static readonly Func<DespatchContext, int, DateTime, Task<ActiveCouriersViewModel>> GetCourierByIdCompiled =
        EF.CompileAsyncQuery((DespatchContext context, int courierId, DateTime now) =>
            context.TucCouriers
                .AsNoTracking()
                .Where(c => c.UccrId == courierId)
                .Select(c => new ActiveCouriersViewModel
                {
                    Code = c.Code,
                    Name = c.UccrName,
                    CourierId = c.UccrId,
                    DangerousGoods = c.UccrDangerousGoods == 1,
                    DGLicenseExpiry = c.DglicenseExpiry,
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
    
    
    private static readonly Func<DespatchContext, Task<List<Suggestion>>> GetAllVehicleSizesCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.VehicleSizes
                .AsNoTracking()
                .OrderBy(v => v.VehicleName)
                .Select(v => new Suggestion { Id = v.VehicleSizeId, Text = v.VehicleName })
                .ToList());

    private static readonly Func<DespatchContext, Task<List<Suggestion>>> GetAllRegionsCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TblBulkRegions
                .AsNoTracking()
                .OrderBy(r => r.Name)
                .Select(r => new Suggestion { Id = r.BulkRegionId, Text = r.Name })
                .ToList());

    private static readonly Func<DespatchContext, Task<List<Suggestion>>> GetAllSpeedsCompiled =
        EF.CompileAsyncQuery((DespatchContext context) =>
            context.TucJobTypes
                .AsNoTracking()
                .OrderBy(r => r.UcjtName)
                .Select(r => new Suggestion { Id = r.UcjtId, Text = r.UcjtName })
                .ToList());

    // Access compiled queries
    public async Task<List<Suggestion>> GetAllVehicleSizesAsync() => await GetAllVehicleSizesCompiled(this);
    public async Task<List<Suggestion>> GetAllRegionsAsync() => await GetAllRegionsCompiled(this);
    public async Task<List<Suggestion>> GetAllSpeedsAsync() => await GetAllSpeedsCompiled(this);
    
    public async Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId, DateTime tenantTime) => await GetCourierByIdCompiled(this, courierId, tenantTime);
    
    public async Task<List<ActiveCourierDto>> GetActiveCouriersAsync(DateTime today) =>
        await GetActiveCouriersCompiled(this, today).ToListAsync();

    public async Task<bool> ConfirmNoteTypeExistsAsync(NoteType noteType) =>
        await ConfirmNoteTypeExistsCompiled(this, noteType);

    public async Task<int> GetEffectiveJobIdAsync(int jobId) => await GetEffectiveJobIdCompiled(this, jobId);
    public async Task<int> GetEffectiveArchiveJobIdAsync(int jobId) => await GetEffectiveArchiveJobIdCompiled(this, jobId);
    public async Task<int> GetEffectiveBulkJobIdAsync(int bulkJobId) => await GetEffectiveBulkJobIdCompiled(this, bulkJobId);

    public async Task<int> GetEffectiveJobBookingIdAsync(int jobBookingId) =>
        await GetEffectiveJobBookingIdCompiled(this, jobBookingId);

    public async Task<bool> IsJobArchivedAsync(int jobId) => await IsJobArchivedCompiled(this, jobId);
    public async Task<int?> GetEconomySpeedIdAsync() => await GetEconomySpeedIdCompiled(this);
    public async Task<DateTime?> GetEcoDeliveryTimeAsync() => await GetEcoDeliveryTimeCompiled(this);

    public async Task<bool> IsLiveJobAsync(int jobId) => await IsLiveJobCompiled(this, jobId);

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
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
        });

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
        });
    }
}
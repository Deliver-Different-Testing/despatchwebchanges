using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
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

    // Access compiled queries
    public async Task<int> GetEffectiveJobId(int jobId) => await GetEffectiveJobIdCompiled(this, jobId);
    public async Task<int> GetEffectiveBulkJobId(int bulkJobId) => await GetEffectiveBulkJobIdCompiled(this, bulkJobId);

    public async Task<int> GetEffectiveJobBookingId(int jobBookingId) =>
        await GetEffectiveJobBookingIdCompiled(this, jobBookingId);

    public async Task<bool> IsJobArchived(int jobId) => await IsJobArchivedCompiled(this, jobId);
    public async Task<int?> GetEconomySpeedId() => await GetEconomySpeedIdCompiled(this);
    public async Task<DateTime?> GetEcoDeliveryTime() => await GetEcoDeliveryTimeCompiled(this);

    public async Task<bool> IsLiveJob(int jobId) => await IsLiveJobCompiled(this, jobId);

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
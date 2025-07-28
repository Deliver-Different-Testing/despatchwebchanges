using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.EntityClasses;

public partial class DespatchContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // Tuc Job
        modelBuilder.Entity<TucJob>(entity =>
        {
            entity.HasOne(d => d.Parent).WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
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

            // Self-referencing relationship
            entity.HasOne(d => d.Parent)
                .WithMany(p => p.InverseParent)
                .HasForeignKey(d => d.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            // Nationwide relationship (adjust based on your actual relationship)
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
        
        modelBuilder.Entity<TblAirport>(entity =>
        {
            entity.HasOne(d => d.TimeZoneNavigation)
                .WithMany()
                .HasForeignKey(d => d.Timezone)
                .HasPrincipalKey(tz => tz.Code)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
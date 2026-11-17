using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.EntityClasses;

public partial class DespatchContext
{
    public virtual DbSet<TblBranch> TblBranches { get; set; }

    private static void ConfigureBranches(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TblBranch>(entity =>
        {
            entity.ToTable("tblBranch");
            entity.HasKey(e => e.BranchId);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(10);
        });
    }
}

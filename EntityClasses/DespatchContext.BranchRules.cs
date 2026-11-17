using System.Linq.Expressions;
using DespatchWeb.Enums;
using DespatchWeb.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;

namespace DespatchWeb.EntityClasses;

// Branches programme (B2): branch visibility for tenant staff who hold a BranchIds claim. A third scope state next to
// bypass, network partner and customer (see ScopeContext.IsBranchScoped). Staff with no branches take the bypass exactly
// as before. The rule (master spec 4.1, decided 12 Nov):
//   * a client is visible if its branch is theirs (NULL = the default branch), or it is a house account every staff
//     member shares (tenant / internal / DF Admin client) or their own client;
//   * a courier is visible if its home branch is theirs (NULL = the default branch);
//   * a job is visible if ANY leg of its family has a client in their branches, a courier in their branches, or a pickup
//     or delivery suburb whose site belongs to one of their branches, and then the whole family is visible;
//   * notes follow their job.
// A visible job still loads its client and the couriers on its legs even when they belong to another branch, so the
// client and courier list filters are named and BranchJobContextInterceptor drops them for queries rooted at a job.
public partial class DespatchContext
{
    public bool CurrentIsBranchScoped => CurrentScope.IsBranchScoped;
    public int[] CurrentBranchIds => CurrentScope.BranchIds?.ToArray() ?? [];
    public bool CurrentDefaultBranchInScope => CurrentScope.DefaultBranchInScope;
    public int[] CurrentBranchSiteIds => CurrentScope.BranchSiteIds?.ToArray() ?? [];

    /// <summary>The system courier split parents are parked on, ignored by the courier arm (0 = none; courier ids start at 1).</summary>
    public int CurrentParentJobCourierId => CurrentScope.ParentJobCourierId ?? 0;

    /// <summary>Client list filter key; queries rooted at a job drop it so a visible job shows its client.</summary>
    public const string BranchClientsFilter = "BranchClients";

    /// <summary>Courier list filter key; queries rooted at a job drop it so a visible job shows its couriers.</summary>
    public const string BranchCouriersFilter = "BranchCouriers";

    private const string ScopeFilter = "Scope";

    // ---- the family views: filter-free, read-only windows on the four job tables ----
    // A job filter cannot query its own filtered table, and IgnoreQueryFilters is not allowed inside a filter, so the
    // family lookup reads these keyless views of the real tables (ToView, so test databases do not create a second table).

    public sealed class BranchFamilyJob
    {
        public int Id { get; set; }
        public int? ParentId { get; set; }
        public int? RootParentId { get; set; }
        public int? ClientId { get; set; }
        public int? CourierId { get; set; }
        public int? FromSuburbId { get; set; }
        public int? ToSuburbId { get; set; }
    }

    public sealed class BranchFamilyJobArchive
    {
        public int Id { get; set; }
        public int? ParentId { get; set; }
        public int? RootParentId { get; set; }
        public int? ClientId { get; set; }
        public int? CourierId { get; set; }
        public int? FromSuburbId { get; set; }
        public int? ToSuburbId { get; set; }
    }

    // tucJobBooking carries two pairs of family columns (ParentID/RootParentID and BookingParentID/BookingRootParentID) and the
    // stored data does not say which one a prebook family uses, so both pairs are read and matched, as BulkJobFamily does for bulk.
    public sealed class BranchFamilyJobBooking
    {
        public int Id { get; set; }
        public int? ParentId { get; set; }
        public int? RootParentId { get; set; }
        public int? BookingParentId { get; set; }
        public int? BookingRootParentId { get; set; }
        public int? ClientId { get; set; }
        public int? CourierId { get; set; }

        // ucbkFrom / ucbkTo hold the pickup and delivery suburb id as a float in tucJobBooking.
        public double? FromSuburbId { get; set; }
        public double? ToSuburbId { get; set; }
    }

    // tblBulkJob carries both ParentID and BulkParentID (see Helpers/BulkJobFamily); both are read and matched.
    public sealed class BranchFamilyBulkJob
    {
        public int Id { get; set; }
        public int? ParentId { get; set; }
        public int? BulkParentId { get; set; }
        public int? ClientId { get; set; }
        public int? CourierId { get; set; }
    }

    private static void ConfigureBranchFamilies(ModelBuilder modelBuilder)
    {
        MapFamily<BranchFamilyJob>(modelBuilder, "tucJob", "ucjbID", "ParentID", "RootParentID", "ucjbClientID", "ucjbCourierID", "ucjbFrom", "ucjbTo");
        MapFamily<BranchFamilyJobArchive>(modelBuilder, "tucJobArchive", "ucjbID", "ParentID", "RootParentID", "ucjbClientID", "ucjbCourierID", "ucjbFrom", "ucjbTo");
        MapFamily<BranchFamilyJobBooking>(modelBuilder, "tucJobBooking", "ucbkID", "ParentID", "RootParentID", "ucbkClientID", "CourierID");
        modelBuilder.Entity<BranchFamilyJobBooking>().Property<int?>("BookingParentId").HasColumnName("BookingParentID");
        modelBuilder.Entity<BranchFamilyJobBooking>().Property<int?>("BookingRootParentId").HasColumnName("BookingRootParentID");
        modelBuilder.Entity<BranchFamilyJobBooking>().Property<double?>("FromSuburbId").HasColumnName("ucbkFrom");
        modelBuilder.Entity<BranchFamilyJobBooking>().Property<double?>("ToSuburbId").HasColumnName("ucbkTo");
        MapFamily<BranchFamilyBulkJob>(modelBuilder, "tblBulkJob", "BulkJobID", "ParentID", null, "ClientID", "CourierID");
        modelBuilder.Entity<BranchFamilyBulkJob>().Property<int?>("BulkParentId").HasColumnName("BulkParentID");
    }

    private static void MapFamily<T>(ModelBuilder modelBuilder, string table, string id, string parentId, string? rootParentId,
        string clientId, string courierId, string? fromSuburbId = null, string? toSuburbId = null) where T : class
    {
        var entity = modelBuilder.Entity<T>();
        entity.HasNoKey().ToView(table);
        entity.Property<int>("Id").HasColumnName(id);
        entity.Property<int?>("ParentId").HasColumnName(parentId);
        entity.Property<int?>("ClientId").HasColumnName(clientId);
        entity.Property<int?>("CourierId").HasColumnName(courierId);
        if (rootParentId != null) entity.Property<int?>("RootParentId").HasColumnName(rootParentId);
        if (fromSuburbId != null) entity.Property<int?>("FromSuburbId").HasColumnName(fromSuburbId);
        if (toSuburbId != null) entity.Property<int?>("ToSuburbId").HasColumnName(toSuburbId);
    }

    // ---- the four job arms. Written out per table on purpose: same shape, easy to read, each covered by tests ----
    // family root = RootParentId ?? ParentId ?? id; a member is the root itself or any row pointing at it.

    private Expression<Func<TucJob, bool>> JobBranchArm() => j =>
        CurrentIsBranchScoped
        && Set<BranchFamilyJob>().Any(m =>
            (m.Id == (j.RootParentId ?? j.ParentId ?? j.UcjbId)
             || m.ParentId == (j.RootParentId ?? j.ParentId ?? j.UcjbId)
             || m.RootParentId == (j.RootParentId ?? j.ParentId ?? j.UcjbId))
            && (Set<TucClient>().Any(c => c.UcclId == m.ClientId && ClientVisibleToBranch(c))
                || Set<TucCourier>().Any(r => r.UccrId == m.CourierId && m.CourierId != CurrentParentJobCourierId && CourierVisibleToBranch(r))
                || Set<TucSuburb>().Any(s => (s.UcsuId == m.FromSuburbId || s.UcsuId == m.ToSuburbId)
                                             && s.SiteId != null && CurrentBranchSiteIds.Contains(s.SiteId.Value))));

    private Expression<Func<TucJobArchive, bool>> JobArchiveBranchArm() => j =>
        CurrentIsBranchScoped
        && Set<BranchFamilyJobArchive>().Any(m =>
            (m.Id == (j.RootParentId ?? j.ParentId ?? j.UcjbId)
             || m.ParentId == (j.RootParentId ?? j.ParentId ?? j.UcjbId)
             || m.RootParentId == (j.RootParentId ?? j.ParentId ?? j.UcjbId))
            && (Set<TucClient>().Any(c => c.UcclId == m.ClientId && ClientVisibleToBranch(c))
                || Set<TucCourier>().Any(r => r.UccrId == m.CourierId && m.CourierId != CurrentParentJobCourierId && CourierVisibleToBranch(r))
                || Set<TucSuburb>().Any(s => (s.UcsuId == m.FromSuburbId || s.UcsuId == m.ToSuburbId)
                                             && s.SiteId != null && CurrentBranchSiteIds.Contains(s.SiteId.Value))));

    private Expression<Func<TucJobBooking, bool>> JobBookingBranchArm() => j =>
        CurrentIsBranchScoped
        && Set<BranchFamilyJobBooking>().Any(m =>
            (m.Id == (j.BookingRootParentId ?? j.BookingParentId ?? j.RootParentId ?? j.ParentId ?? j.UcbkId)
             || m.BookingParentId == (j.BookingRootParentId ?? j.BookingParentId ?? j.RootParentId ?? j.ParentId ?? j.UcbkId)
             || m.BookingRootParentId == (j.BookingRootParentId ?? j.BookingParentId ?? j.RootParentId ?? j.ParentId ?? j.UcbkId)
             || m.ParentId == (j.BookingRootParentId ?? j.BookingParentId ?? j.RootParentId ?? j.ParentId ?? j.UcbkId)
             || m.RootParentId == (j.BookingRootParentId ?? j.BookingParentId ?? j.RootParentId ?? j.ParentId ?? j.UcbkId))
            && (Set<TucClient>().Any(c => c.UcclId == m.ClientId && ClientVisibleToBranch(c))
                || Set<TucCourier>().Any(r => r.UccrId == m.CourierId && m.CourierId != CurrentParentJobCourierId && CourierVisibleToBranch(r))
                || Set<TucSuburb>().Any(s => ((double)s.UcsuId == m.FromSuburbId || (double)s.UcsuId == m.ToSuburbId)
                                             && s.SiteId != null && CurrentBranchSiteIds.Contains(s.SiteId.Value))));

    private Expression<Func<TblBulkJob, bool>> BulkJobBranchArm() => j =>
        CurrentIsBranchScoped
        && Set<BranchFamilyBulkJob>().Any(m =>
            (m.Id == (j.BulkParentId ?? j.ParentId ?? j.BulkJobId)
             || m.ParentId == (j.BulkParentId ?? j.ParentId ?? j.BulkJobId)
             || m.BulkParentId == (j.BulkParentId ?? j.ParentId ?? j.BulkJobId))
            && (Set<TucClient>().Any(c => c.UcclId == m.ClientId && ClientVisibleToBranch(c))
                || Set<TucCourier>().Any(r => r.UccrId == m.CourierId && m.CourierId != CurrentParentJobCourierId && CourierVisibleToBranch(r))));

    // ---- client and courier rules: ONE definition, used by the job arms and the client and courier list filters ----
    // The job arms call the two marker methods; BranchRuleInliner replaces each call with the rule below before EF sees it.

    private static bool ClientVisibleToBranch(TucClient client) => throw new InvalidOperationException("Expanded by BranchRuleInliner");
    private static bool CourierVisibleToBranch(TucCourier courier) => throw new InvalidOperationException("Expanded by BranchRuleInliner");

    private Expression<Func<TucClient, bool>> ClientBranchRule => c =>
        (c.BranchId != null && CurrentBranchIds.Contains(c.BranchId.Value))
        || (c.BranchId == null && CurrentDefaultBranchInScope)
        || c.ClientTypeId == (int)ClientType.Tenant
        || c.ClientTypeId == (int)ClientType.Internal
        || c.ClientTypeId == (int)ClientType.DfrntAdmin
        || c.UcclId == CurrentClientId;

    private Expression<Func<TucCourier, bool>> CourierBranchRule => r =>
        (r.BranchId != null && CurrentBranchIds.Contains(r.BranchId.Value))
        || (r.BranchId == null && CurrentDefaultBranchInScope);

    private sealed class BranchRuleInliner(DespatchContext context) : ExpressionVisitor
    {
        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.DeclaringType == typeof(DespatchContext) && node.Method.IsStatic)
            {
                if (node.Method.Name == nameof(ClientVisibleToBranch)) return Expand(context.ClientBranchRule, node.Arguments[0]);
                if (node.Method.Name == nameof(CourierVisibleToBranch)) return Expand(context.CourierBranchRule, node.Arguments[0]);
            }

            return base.VisitMethodCall(node);
        }

        private Expression Expand(LambdaExpression rule, Expression argument) =>
            Visit(ReplacingExpressionVisitor.Replace(rule.Parameters[0], Visit(argument), rule.Body));
    }

    private Expression<Func<T, bool>> Expanded<T>(Expression<Func<T, bool>> filter) =>
        (Expression<Func<T, bool>>)new BranchRuleInliner(this).Visit(filter);

    // ---- entities with no scope today: branch limited users follow the already filtered job, client and courier sets ----
    // Users who are not branch limited are untouched (the first arm), so network partners and customers behave exactly as
    // before. The views (tblJob, tblClient, tblCourier) are matched by id against the filtered tuc tables rather than by
    // their own columns, so this does not depend on the views having been refreshed after the BranchId migration.
    private void ConfigureBranchOnlyFilters(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TblJob>().HasQueryFilter(v =>
            !CurrentIsBranchScoped
            || Set<TucJob>().Any(j => j.UcjbId == v.JobId)
            || Set<TucJobArchive>().Any(j => j.UcjbId == v.JobId));

        modelBuilder.Entity<TblClient>().HasQueryFilter(BranchClientsFilter, v =>
            !CurrentIsBranchScoped || Set<TucClient>().Any(c => c.UcclId == v.ClientId));

        modelBuilder.Entity<TblCourier>().HasQueryFilter(BranchCouriersFilter, v =>
            !CurrentIsBranchScoped || Set<TucCourier>().Any(r => r.UccrId == v.CourierId));

        modelBuilder.Entity<TblAfterhoursCourier>().HasQueryFilter(BranchCouriersFilter, a =>
            !CurrentIsBranchScoped || Set<TucCourier>().Any(r => r.UccrId == a.CourierId));

        // Events follow their job, else their client, else their courier; an event about none of them is not branch data.
        modelBuilder.Entity<TucEvent>().HasQueryFilter(e =>
            !CurrentIsBranchScoped
            || (e.UcevJobId != null
                ? Set<TucJob>().Any(j => j.UcjbId == e.UcevJobId) || Set<TucJobArchive>().Any(j => j.UcjbId == e.UcevJobId)
                : e.UcevClientId != null
                    ? Set<TucClient>().Any(c => c.UcclId == e.UcevClientId)
                    : e.UcevCourierId == null || Set<TucCourier>().Any(r => r.UccrId == e.UcevCourierId)));
    }

    /// <summary>The existing arms (bypass, network partner, customer) OR the branch arm.</summary>
    private static Expression<Func<T, bool>> OrBranch<T>(Expression<Func<T, bool>> existing, Expression<Func<T, bool>> branchArm)
    {
        var arm = ReplacingExpressionVisitor.Replace(branchArm.Parameters[0], existing.Parameters[0], branchArm.Body);
        return Expression.Lambda<Func<T, bool>>(Expression.OrElse(existing.Body, arm), existing.Parameters);
    }
}

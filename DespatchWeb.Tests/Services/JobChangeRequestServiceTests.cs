using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// End-to-end coverage for the job-change-request service against an in-memory SQLite db.
/// The partner client and tenant-info service are stubbed; everything else runs real
/// against the same scaffolded DespatchContext that production uses.
/// </summary>
public class JobChangeRequestServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DbContextOptions<DespatchContext> _options;
    private readonly IJobChangeRequestPartnerClient _partnerClient = Substitute.For<IJobChangeRequestPartnerClient>();
    private readonly ISendToPartnerService _sendToPartner = Substitute.For<ISendToPartnerService>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();
    private readonly JobChangePolicyService _policy = new();

    public JobChangeRequestServiceTests()
    {
        // SQLite + EF rowversion mismatch: the scaffold marks UjcrRowVersion as
        // NOT NULL + IsRowVersion(). SQL Server's rowversion column autofills;
        // SQLite has no equivalent, so EF skips the property on INSERT and the
        // NOT NULL constraint blows up. TestDespatchContext below downgrades the
        // property to ValueGeneratedNever, then the interceptor fills it pre-save.
        _options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_db.Connection)
            .AddSqliteDateDiffTranslation()
            .AddInterceptors(new RowVersionFillerInterceptor())
            .Options;

        _tenantInfo.GetStaffId().Returns(99);

        _partnerClient
            .ForwardCreateAsync(Arg.Any<int>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>(),
                Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new PartnerForwardResult { Success = true });
        _partnerClient
            .ForwardDecisionAsync(Arg.Any<int>(), Arg.Any<Guid>(), Arg.Any<string>(),
                Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new PartnerForwardResult { Success = true });
        _partnerClient
            .ForwardAppliedAsync(Arg.Any<int>(), Arg.Any<Guid>(), Arg.Any<decimal?>(), Arg.Any<CancellationToken>())
            .Returns(new PartnerForwardResult { Success = true });

        // Default: no rate-card hit. Tests that exercise the commercial refresh path
        // re-stub this to return a concrete RateCardRate.
        _sendToPartner
            .GetRateForJobAsync(Arg.Any<int>(), Arg.Any<int>())
            .Returns(new PartnerRateForJobResponse { Source = "none" });
    }

    private JobChangeRequestService CreateService() =>
        new(CreateFactory(), _policy, _partnerClient, _sendToPartner, _tenantInfo);

    private IDbContextFactory<DespatchContext> CreateFactory()
    {
        var mock = Substitute.For<IDbContextFactory<DespatchContext>>();
        mock.CreateDbContext().Returns(_ => new TestDespatchContext(_options));
        mock.CreateDbContextAsync(Arg.Any<CancellationToken>()).Returns(_ => new TestDespatchContext(_options));
        return mock;
    }

    private DespatchContext CreateContext() => new TestDespatchContext(_options);

    /// <summary>
    /// SQLite-friendly DespatchContext override: tweaks <c>UjcrRowVersion</c>'s value
    /// generation so EF includes it on INSERT (paired with the interceptor that fills
    /// the byte[]). Production code still uses the unmodified <see cref="DespatchContext"/>
    /// against SQL Server, which autofills the rowversion column.
    /// </summary>
    private sealed class TestDespatchContext(DbContextOptions<DespatchContext> options) : DespatchContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<TucJobChangeRequest>()
                .Property(e => e.UjcrRowVersion)
                .ValueGeneratedNever();
        }
    }

    /// <summary>
    /// Pre-save hook that gives every Added entity's rowversion property a non-null
    /// byte[] when it would otherwise be inserted as NULL. SQLite-only concern; on
    /// SQL Server EF skips the column entirely and the server's rowversion type fills it.
    /// </summary>
    private sealed class RowVersionFillerInterceptor : SaveChangesInterceptor
    {
        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData,
            InterceptionResult<int> result)
        {
            FillEmptyRowVersions(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            FillEmptyRowVersions(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private static void FillEmptyRowVersions(DbContext? context)
        {
            if (context is null) return;
            foreach (var entry in context.ChangeTracker.Entries())
            {
                if (entry.State != EntityState.Added) continue;
                foreach (PropertyEntry prop in entry.Properties)
                {
                    if (prop.Metadata.IsConcurrencyToken
                        && prop.Metadata.ClrType == typeof(byte[])
                        && prop.CurrentValue is null)
                        prop.CurrentValue = new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 };
                }
            }
        }
    }

    [Fact]
    public async Task CreateLocalAsync_returns_error_when_job_not_found()
    {
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 999_999,
            FieldName = nameof(JobChangeField.Quantity)
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("not found", result.Message);
    }

    [Fact]
    public async Task CreateLocalAsync_returns_error_when_job_is_not_partner_job()
    {
        await SeedJobAsync(unsetPartnerJobGuid: true);
        await SeedPairingAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity)
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("inter-tenant", result.Message);
    }

    [Fact]
    public async Task CreateLocalAsync_returns_error_for_unknown_field()
    {
        await SeedJobAsync();
        await SeedPairingAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = "NotARealField"
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("Unknown field", result.Message);
    }

    [Fact]
    public async Task CreateLocalAsync_auto_field_applies_immediately_and_closes_event()
    {
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Notes),
            RequestedValue = "Please leave at reception"
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(result.Request);
        Assert.Equal("Applied", result.Request!.Status);
        Assert.Equal("Auto", result.Request.ApprovalMode);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal("Please leave at reception", job.UcjbNotes);

        var ev = ctx.TucEvents.Single(e => e.UcevId == result.Request.TucEventId);
        Assert.True(ev.UcevClosed);
    }

    [Fact]
    public async Task CreateLocalAsync_manual_field_opens_event_and_forwards_to_peer()
    {
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5",
            Reason = "client added a package"
        }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("Pending", result.Request!.Status);
        Assert.Equal("Manual", result.Request.ApprovalMode);
        Assert.Equal("PartnerTenant", result.Request.ApprovalPartyType);

        await using var ctx = CreateContext();
        var ev = ctx.TucEvents.Single(e => e.UcevId == result.Request.TucEventId);
        Assert.False(ev.UcevClosed);

        await _partnerClient.Received(1).ForwardCreateAsync(
            Arg.Any<int>(),
            Arg.Any<Guid>(),
            result.Request.SourceRequestUuid,
            "Quantity",
            Arg.Any<string?>(),
            "5",
            "client added a package",
            "Manual",
            Arg.Any<bool>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateLocalAsync_rejects_duplicate_pending_request_for_same_field()
    {
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var first = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5"
        }, CancellationToken.None);
        Assert.True(first.Success);

        var second = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "7"
        }, CancellationToken.None);

        Assert.False(second.Success);
        Assert.Contains("pending request", second.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApproveAsync_applies_field_change_and_closes_event()
    {
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "7"
        }, CancellationToken.None);
        Assert.True(pending.Success);

        var approved = await service.ApproveAsync(pending.Request!.Id,
            new ApproveJobChangeRequestRequest { RequestId = pending.Request.Id }, CancellationToken.None);

        Assert.True(approved.Success);
        Assert.Equal("Applied", approved.Request!.Status);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal((short)7, job.UcjbQty);

        var ev = ctx.TucEvents.Single(e => e.UcevId == pending.Request.TucEventId);
        Assert.True(ev.UcevClosed);

        await _partnerClient.Received(1).ForwardDecisionAsync(
            Arg.Any<int>(), pending.Request.SourceRequestUuid, "Approved",
            Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RejectAsync_marks_rejected_and_does_not_change_job()
    {
        await SeedJobAsync(initialQty: 3);
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "9"
        }, CancellationToken.None);

        var rejected = await service.RejectAsync(pending.Request!.Id,
            new RejectJobChangeRequestRequest { RequestId = pending.Request.Id, Reason = "not authorised" },
            CancellationToken.None);

        Assert.True(rejected.Success);
        Assert.Equal("Rejected", rejected.Request!.Status);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal((short)3, job.UcjbQty);
    }

    [Fact]
    public async Task RecordPeerCreateAsync_is_idempotent_on_source_uuid()
    {
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();
        var sourceUuid = Guid.NewGuid();
        var payload = new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = sourceUuid,
            FieldName = nameof(JobChangeField.Speed),
            RequestedValue = "42",
            ApprovalMode = "Manual"
        };

        var first = await service.RecordPeerCreateAsync(payload, CancellationToken.None);
        var second = await service.RecordPeerCreateAsync(payload, CancellationToken.None);

        Assert.True(first.Success);
        Assert.True(second.Success);
        Assert.Equal(first.Request!.Id, second.Request!.Id);

        await using var ctx = CreateContext();
        Assert.Single(ctx.TucJobChangeRequests.Where(r => r.UjcrSourceRequestUuid == sourceUuid));
    }

    [Fact]
    public async Task RecordPeerAppliedAsync_writes_new_commercial_amount_to_tucJob()
    {
        await SeedJobAsync(initialAgreedRate: 100m);
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();
        var sourceUuid = Guid.NewGuid();
        var payload = new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = sourceUuid,
            FieldName = nameof(JobChangeField.PartnerAgreedRate),
            RequestedValue = "150.00",
            ApprovalMode = "Manual",
            RequiresCommercialRefresh = true
        };
        await service.RecordPeerCreateAsync(payload, CancellationToken.None);

        var before = DateTime.UtcNow;
        var applied = await service.RecordPeerAppliedAsync(sourceUuid,
            new PeerInboundChangeAppliedPayload { NewCommercialAmount = 150m }, CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.True(applied.Success);
        Assert.Equal("Applied", applied.Request!.Status);
        Assert.NotNull(applied.Request.AppliedAt);
        Assert.InRange(applied.Request.AppliedAt!.Value, before.AddSeconds(-1), after.AddSeconds(1));

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal(150m, job.PartnerAgreedRate);

        var row = ctx.TucJobChangeRequests.Single(r => r.UjcrSourceRequestUuid == sourceUuid);
        Assert.NotNull(row.UjcrAppliedAtUtc);
        Assert.Null(row.UjcrRespondedAtUtc);
    }

    [Fact]
    public async Task CreateLocalAsync_errors_when_multiple_active_pairings_and_no_pairingId_provided()
    {
        // Pre-fix: silently picked the first Active pairing — non-deterministic in
        // multi-pairing tenants. New behaviour: refuse and ask the caller to disambiguate.
        await SeedJobAsync();
        await SeedPairingAsync(partnerTenantId: "200");
        await SeedPairingAsync(partnerTenantId: "300");
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5"
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("Multiple active partner pairings", result.Message);
    }

    [Fact]
    public async Task CreateLocalAsync_uses_explicit_pairingId_when_provided()
    {
        await SeedJobAsync();
        var firstId = await SeedPairingAsync(partnerTenantId: "200");
        var secondId = await SeedPairingAsync(partnerTenantId: "300");
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5",
            PairingId = secondId
        }, CancellationToken.None);

        Assert.True(result.Success, result.Message);
        Assert.Equal(secondId, result.Request!.PairingId);
        Assert.NotEqual(firstId, result.Request.PairingId);
    }

    [Fact]
    public async Task CreateLocalAsync_rejects_inactive_explicit_pairing()
    {
        await SeedJobAsync();
        var revokedId = await SeedPairingAsync(status: "Revoked");
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5",
            PairingId = revokedId
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("not active", result.Message);
    }

    [Fact]
    public async Task ApproveAsync_records_old_rate_from_before_update_for_rate_changes()
    {
        // Pre-fix: oldRate was captured AFTER ApplyFieldChangeAsync overwrote the column,
        // so old/new always ended up identical. This test would fail under the old code.
        await SeedJobAsync(initialAgreedRate: 100m);
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.PartnerAgreedRate),
            RequestedValue = "175.50"
        }, CancellationToken.None);
        Assert.True(pending.Success, pending.Message);

        var approved = await service.ApproveAsync(pending.Request!.Id,
            new ApproveJobChangeRequestRequest { RequestId = pending.Request.Id }, CancellationToken.None);

        Assert.True(approved.Success, approved.Message);
        Assert.Equal(100m, approved.Request!.OldCommercialAmount);
        Assert.Equal(175.50m, approved.Request.NewCommercialAmount);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal(175.50m, job.PartnerAgreedRate);
    }

    [Fact]
    public async Task RecordPeerAppliedAsync_captures_old_rate_before_overwriting_job_column()
    {
        await SeedJobAsync(initialAgreedRate: 100m);
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();
        var sourceUuid = Guid.NewGuid();
        await service.RecordPeerCreateAsync(new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = sourceUuid,
            FieldName = nameof(JobChangeField.PartnerAgreedRate),
            RequestedValue = "150.00",
            ApprovalMode = "Manual",
            RequiresCommercialRefresh = true
        }, CancellationToken.None);

        var applied = await service.RecordPeerAppliedAsync(sourceUuid,
            new PeerInboundChangeAppliedPayload { NewCommercialAmount = 150m }, CancellationToken.None);

        Assert.True(applied.Success);
        Assert.Equal(100m, applied.Request!.OldCommercialAmount);
        Assert.Equal(150m, applied.Request.NewCommercialAmount);
    }

    [Fact]
    public async Task ApproveAsync_returns_failure_when_row_was_modified_concurrently()
    {
        // Old code: did the rowversion compare in C# against the just-loaded row, so a
        // concurrent writer between FirstOrDefaultAsync and SaveChangesAsync would be
        // silently overwritten. Now EF carries the supplied rowversion as OriginalValues
        // and the DB enforces the check at UPDATE time.
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5"
        }, CancellationToken.None);
        Assert.True(pending.Success);

        var staleRowVersion = new byte[] { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

        var approved = await service.ApproveAsync(pending.Request!.Id,
            new ApproveJobChangeRequestRequest { RequestId = pending.Request.Id, RowVersion = staleRowVersion },
            CancellationToken.None);

        Assert.False(approved.Success);
        Assert.Contains("modified", approved.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ListForJobAsync_caps_result_count()
    {
        // Hand-write 150 rows and confirm only the 100 most recent come back. Prevents
        // pathological jobs from returning thousands of historical requests to the UI.
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();

        await using (var ctx = CreateContext())
        {
            for (var i = 0; i < 150; i++)
                ctx.TucJobChangeRequests.Add(new TucJobChangeRequest
                {
                    UjcrJobId = 1,
                    UjcrSourceRequestUuid = Guid.NewGuid(),
                    UjcrOrigin = "Local",
                    UjcrRequestingPartyType = "OwnerTenant",
                    UjcrApprovalPartyType = "PartnerTenant",
                    UjcrFieldName = $"Notes-{i}",
                    UjcrStatus = "Applied",
                    UjcrApprovalMode = "Auto",
                    UjcrRequestedAtUtc = DateTime.UtcNow.AddMinutes(-i)
                });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var service = CreateService();
        var rows = await service.ListForJobAsync(1, CancellationToken.None);

        Assert.Equal(100, rows.Count);
    }

    [Theory]
    [InlineData(nameof(JobChangeField.ProgressNote), "Progress")]
    [InlineData(nameof(JobChangeField.PodNote), "POD")]
    public async Task CreateLocalAsync_progress_and_pod_notes_append_to_existing_notes(string fieldName, string label)
    {
        await SeedJobAsync(); // existing notes "original notes"
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = fieldName,
            RequestedValue = "at reception"
        }, CancellationToken.None);

        Assert.True(result.Success, result.Message);
        Assert.Equal("Applied", result.Request!.Status);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal($"original notes\n[{label}] at reception", job.UcjbNotes);
    }

    [Fact]
    public async Task CreateLocalAsync_progress_note_writes_to_empty_notes_without_leading_newline()
    {
        await SeedJobAsync(initialNotes: null);
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.ProgressNote),
            RequestedValue = "first note"
        }, CancellationToken.None);

        Assert.True(result.Success, result.Message);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal("[Progress] first note", job.UcjbNotes);
    }

    [Fact]
    public async Task ApproveAsync_rejects_row_whose_field_name_is_not_a_known_enum_value()
    {
        // Peer-create writes payload.FieldName verbatim. If the originator ships a
        // newer field-set than this version knows, the local approve must refuse
        // rather than silently mark the row Applied without touching the job.
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var pairing = await GetSinglePairingIdAsync();

        await using (var ctx = CreateContext())
        {
            ctx.TucJobChangeRequests.Add(new TucJobChangeRequest
            {
                UjcrJobId = 1,
                UjcrPairingId = pairing,
                UjcrSourceRequestUuid = Guid.NewGuid(),
                UjcrOrigin = "Peer",
                UjcrRequestingPartyType = "PartnerTenant",
                UjcrApprovalPartyType = "OwnerTenant",
                UjcrFieldName = "PickupAddress", // dropped from v1 enum
                UjcrRequestedValue = "12 Newland Rd",
                UjcrStatus = "Pending",
                UjcrApprovalMode = "Manual",
                UjcrRequestedAtUtc = DateTime.UtcNow
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        int rowId;
        await using (var ctx = CreateContext())
            rowId = ctx.TucJobChangeRequests.Single().UjcrId;

        var service = CreateService();
        var result = await service.ApproveAsync(rowId,
            new ApproveJobChangeRequestRequest { RequestId = rowId }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("not supported", result.Message);

        await using var verify = CreateContext();
        Assert.Equal("Pending", verify.TucJobChangeRequests.Single(r => r.UjcrId == rowId).UjcrStatus);
    }

    [Fact]
    public async Task ApproveAsync_refreshes_commercial_amount_via_rate_for_job_for_non_rate_field()
    {
        // Quantity is flagged RequiresCommercialRefresh=true by the policy. On approval
        // the service should re-rate the job through ISendToPartnerService and write the
        // refreshed amount to both tucJob.PartnerAgreedRate and the request row.
        await SeedJobAsync(initialAgreedRate: 100m);
        var pairingId = await SeedPairingAsync();
        await SeedEventTypesAsync();

        _sendToPartner
            .GetRateForJobAsync(pairingId, 1)
            .Returns(new PartnerRateForJobResponse { RateCardRate = 137.50m, Source = "rate-card" });

        var service = CreateService();
        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "9"
        }, CancellationToken.None);
        Assert.True(pending.Success);

        var approved = await service.ApproveAsync(pending.Request!.Id,
            new ApproveJobChangeRequestRequest { RequestId = pending.Request.Id }, CancellationToken.None);

        Assert.True(approved.Success, approved.Message);
        Assert.Equal(100m, approved.Request!.OldCommercialAmount);
        Assert.Equal(137.50m, approved.Request.NewCommercialAmount);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal(137.50m, job.PartnerAgreedRate);
        Assert.Equal((short)9, job.UcjbQty);

        // Refreshed amount must travel to the peer so the mirror job stays consistent.
        await _partnerClient.Received(1).ForwardAppliedAsync(
            pairingId, pending.Request.SourceRequestUuid, 137.50m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApproveAsync_skips_commercial_refresh_when_rate_endpoint_returns_no_rate()
    {
        // If the IM rate-for-job endpoint can't price the job (Source="none"), keep the
        // old PartnerAgreedRate in place rather than nulling it out. The decision still
        // applies; only the price stays stable.
        await SeedJobAsync(initialAgreedRate: 100m);
        await SeedPairingAsync();
        await SeedEventTypesAsync();

        // _sendToPartner default stub already returns Source="none" / RateCardRate=null.

        var service = CreateService();
        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "9"
        }, CancellationToken.None);

        var approved = await service.ApproveAsync(pending.Request!.Id,
            new ApproveJobChangeRequestRequest { RequestId = pending.Request.Id }, CancellationToken.None);

        Assert.True(approved.Success);
        Assert.Null(approved.Request!.NewCommercialAmount);

        await using var ctx = CreateContext();
        Assert.Equal(100m, ctx.TucJobs.Single(j => j.UcjbId == 1).PartnerAgreedRate);
    }

    [Fact]
    public async Task ApproveAsync_does_not_call_rate_for_job_when_field_is_partner_agreed_rate()
    {
        // Rate changes carry their own amount in the request — re-rating against the
        // rate card would override what the dispatcher and counterparty already agreed.
        await SeedJobAsync(initialAgreedRate: 100m);
        await SeedPairingAsync();
        await SeedEventTypesAsync();

        var service = CreateService();
        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.PartnerAgreedRate),
            RequestedValue = "200"
        }, CancellationToken.None);

        await service.ApproveAsync(pending.Request!.Id,
            new ApproveJobChangeRequestRequest { RequestId = pending.Request.Id }, CancellationToken.None);

        await _sendToPartner.DidNotReceive().GetRateForJobAsync(Arg.Any<int>(), Arg.Any<int>());

        await using var ctx = CreateContext();
        Assert.Equal(200m, ctx.TucJobs.Single(j => j.UcjbId == 1).PartnerAgreedRate);
    }

    [Fact]
    public async Task RecordPeerAppliedAsync_applies_field_change_and_writes_amount_for_quantity_change()
    {
        // Originator-side: peer signals "applied" for a Quantity change with a refreshed
        // commercial amount. Both the field and the price must land on the local job.
        await SeedJobAsync(initialQty: 3, initialAgreedRate: 100m);
        await SeedPairingAsync();
        await SeedEventTypesAsync();

        var service = CreateService();
        var sourceUuid = Guid.NewGuid();
        await service.RecordPeerCreateAsync(new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = sourceUuid,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "9",
            ApprovalMode = "Manual",
            RequiresCommercialRefresh = true
        }, CancellationToken.None);

        var applied = await service.RecordPeerAppliedAsync(sourceUuid,
            new PeerInboundChangeAppliedPayload { NewCommercialAmount = 137.50m }, CancellationToken.None);

        Assert.True(applied.Success, applied.Message);
        Assert.Equal("Applied", applied.Request!.Status);
        Assert.Equal(100m, applied.Request.OldCommercialAmount);
        Assert.Equal(137.50m, applied.Request.NewCommercialAmount);

        await using var ctx = CreateContext();
        var job = ctx.TucJobs.Single(j => j.UcjbId == 1);
        Assert.Equal((short)9, job.UcjbQty);
        Assert.Equal(137.50m, job.PartnerAgreedRate);
    }

    [Fact]
    public async Task CancelAsync_marks_row_cancelled_and_notifies_peer()
    {
        await SeedJobAsync();
        var pairingId = await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "9"
        }, CancellationToken.None);

        var cancelled = await service.CancelAsync(pending.Request!.Id,
            new CancelJobChangeRequestRequest { RequestId = pending.Request.Id, Reason = "no longer needed" },
            CancellationToken.None);

        Assert.True(cancelled.Success, cancelled.Message);
        Assert.Equal("Cancelled", cancelled.Request!.Status);

        await using var ctx = CreateContext();
        var ev = ctx.TucEvents.Single(e => e.UcevId == pending.Request.TucEventId);
        Assert.True(ev.UcevClosed);

        await _partnerClient.Received(1).ForwardDecisionAsync(
            pairingId, pending.Request.SourceRequestUuid, "Cancelled",
            Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CancelAsync_refuses_to_cancel_a_peer_originated_row()
    {
        // Only the originator can retract. A row with Origin=Peer must be rejected via
        // RejectAsync, never cancelled — Cancelled means "the requester took it back."
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var peer = await service.RecordPeerCreateAsync(new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = Guid.NewGuid(),
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5",
            ApprovalMode = "Manual"
        }, CancellationToken.None);

        var attempted = await service.CancelAsync(peer.Request!.Id,
            new CancelJobChangeRequestRequest { RequestId = peer.Request.Id }, CancellationToken.None);

        Assert.False(attempted.Success);
        Assert.Contains("originator", attempted.Message);
    }

    [Fact]
    public async Task RecordPeerDecisionAsync_handles_cancelled_outcome_from_peer()
    {
        // The peer-side row gets marked Cancelled when the originator retracts upstream.
        await SeedJobAsync();
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        var sourceUuid = Guid.NewGuid();
        await service.RecordPeerCreateAsync(new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = sourceUuid,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5",
            ApprovalMode = "Manual"
        }, CancellationToken.None);

        var result = await service.RecordPeerDecisionAsync(sourceUuid,
            new PeerInboundChangeDecisionPayload { Outcome = "Cancelled" }, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("Cancelled", result.Request!.Status);
    }

    [Fact]
    public async Task RecordPeerAppliedAsync_short_circuits_if_row_is_cancelled()
    {
        // Late Applied event after originator cancelled: must not silently re-mutate
        // the local tucJob. Idempotent return, no field change.
        await SeedJobAsync(initialQty: 3);
        await SeedPairingAsync();
        await SeedEventTypesAsync();
        var service = CreateService();

        // Local-originated, cancelled.
        var pending = await service.CreateLocalAsync(new CreateJobChangeRequestRequest
        {
            JobId = 1,
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "9"
        }, CancellationToken.None);
        await service.CancelAsync(pending.Request!.Id,
            new CancelJobChangeRequestRequest { RequestId = pending.Request.Id }, CancellationToken.None);

        // Late peer-applied arrives — must short-circuit.
        var applied = await service.RecordPeerAppliedAsync(pending.Request.SourceRequestUuid,
            new PeerInboundChangeAppliedPayload { NewCommercialAmount = 137.50m }, CancellationToken.None);

        Assert.True(applied.Success);
        Assert.Equal("Cancelled", applied.Request!.Status);

        await using var ctx = CreateContext();
        Assert.Equal((short)3, ctx.TucJobs.Single(j => j.UcjbId == 1).UcjbQty);
    }

    [Fact]
    public async Task RecordPeerCreateAsync_resolves_pairing_by_partner_tenant_id()
    {
        // Multi-active pairings + PartnerTenantId hint → unique match. Without the hint
        // the same setup would error with "Multiple active partner pairings exist".
        await SeedJobAsync();
        var firstId = await SeedPairingAsync(partnerTenantId: "200");
        var secondId = await SeedPairingAsync(partnerTenantId: "300");
        await SeedEventTypesAsync();
        var service = CreateService();

        var result = await service.RecordPeerCreateAsync(new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = (await GetPartnerJobGuidAsync(1))!.Value,
            SourceRequestUuid = Guid.NewGuid(),
            FieldName = nameof(JobChangeField.Quantity),
            RequestedValue = "5",
            ApprovalMode = "Manual",
            PartnerTenantId = "300"
        }, CancellationToken.None);

        Assert.True(result.Success, result.Message);
        Assert.Equal(secondId, result.Request!.PairingId);
        Assert.NotEqual(firstId, result.Request.PairingId);
    }

    private async Task<int> GetSinglePairingIdAsync()
    {
        await using var ctx = CreateContext();
        return ctx.IntMgrPartnerPairings.Single().Id;
    }

    private async Task SeedJobAsync(short initialQty = 3, decimal? initialAgreedRate = null,
        bool unsetPartnerJobGuid = false, string? initialNotes = "original notes")
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(new TucJob
        {
            UcjbId = 1,
            UcjbDate = DateTime.UtcNow,
            UcjbStatus = (int)JobStatus.Dispatched,
            UcjbQty = initialQty,
            UcjbNotes = initialNotes,
            PartnerJobGuid = unsetPartnerJobGuid ? null : Guid.NewGuid(),
            PartnerAgreedRate = initialAgreedRate
        });
        await ctx.SaveChangesAsync();
    }

    private async Task<int> SeedPairingAsync(string partnerTenantId = "200", string status = "Active")
    {
        await using var ctx = CreateContext();
        var pairing = new IntMgrPartnerPairing
        {
            PartnerTenantId = partnerTenantId,
            PartnerTenantName = $"Peer {partnerTenantId}",
            PartnerBaseUrl = $"https://peer-{partnerTenantId}.example.com",
            Status = status,
            OwnerTenantId = "100",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        ctx.IntMgrPartnerPairings.Add(pairing);
        await ctx.SaveChangesAsync();
        return pairing.Id;
    }

    private async Task SeedEventTypesAsync()
    {
        await using var ctx = CreateContext();
        foreach (var name in new[]
                 {
                     "Partner Change Request", "Partner Change Approved",
                     "Partner Change Rejected", "Partner Change Applied"
                 })
            ctx.TucEventTypes.Add(new TucEventType { UcetGroup = "PT", UcetName = name });
        await ctx.SaveChangesAsync();
    }

    private async Task<Guid?> GetPartnerJobGuidAsync(int jobId)
    {
        await using var ctx = CreateContext();
        return ctx.TucJobs.Where(j => j.UcjbId == jobId).Select(j => j.PartnerJobGuid).Single();
    }

    public async ValueTask DisposeAsync() => await _db.DisposeAsync();
}

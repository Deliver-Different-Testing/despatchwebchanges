#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Serilog;

namespace DespatchWeb.Services;

public interface IAccessKeyService
{
    Task<bool> HasAsync(string key);
}

/// <summary>
/// Hub Access Control verbs (<c>dbo.RolePermission</c>). Same rules as the configurator's RolePermissionResolver and
/// Accounts' AccessKeyService, minus the tree cascade: verb keys are FAIL CLOSED, so only the role's own explicit row
/// counts. DF Admin (ClientTypeId 5) bypasses. The predicate lives in three repos against the same tables: a change
/// here belongs in the other two.
/// </summary>
public sealed class AccessKeyService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    IMemoryCache cache) : IAccessKeyService
{
    private const int DfAdminClientTypeId = 5;

    private sealed class RpRow
    {
        public int ContactRoleId { get; set; }
        public int? ClientId { get; set; }
        public byte? AccessLevel { get; set; }
        public bool Allowed { get; set; }
    }

    public async Task<bool> HasAsync(string key)
    {
        var contactId = infoService.GetContactId();
        if (contactId <= 0)
        {
            return false;
        }

        // Short cache so the dispatch board's refresh does not re-resolve roles every few seconds.
        var cacheKey = $"{infoService.GetCurrentTenantId()}:accesskey:{contactId}:{key}";
        return await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
            try
            {
                return await ResolveAsync(contactId, key);
            }
            catch (Exception ex)
            {
                // Fail closed.
                Log.Warning(ex, "Access key {Key} could not be resolved for contact {ContactId}", key, contactId);
                return false;
            }
        });
    }

    private async Task<bool> ResolveAsync(int contactId, string key)
    {
        if (infoService.GetClientTypeId() == DfAdminClientTypeId)
        {
            return true;
        }

        await using var ctx = await contextFactory.CreateDbContextAsync();

        var contact = await ctx.Database.SqlQuery<ContactRow>($@"
            SELECT ucctClientID AS ClientId, ContactRoleID AS ContactRoleId
            FROM dbo.tucClientContact WHERE ucctID = {contactId}").FirstOrDefaultAsync();
        if (contact is null)
        {
            return false;
        }

        var roleIds = await ctx.Database.SqlQuery<int>($@"
            SELECT cr.ContactRoleId AS Value
            FROM dbo.tblContactContactRole cr
            JOIN dbo.tblContactRole r ON r.ContactRoleID = cr.ContactRoleId AND r.IsActive = 1
            WHERE cr.ClientContactId = {contactId}").ToListAsync();

        // Transitional fallback: the contact's single primary role.
        if (roleIds.Count == 0 && contact.ContactRoleId is > 0)
        {
            roleIds = await ctx.Database.SqlQuery<int>($@"
                SELECT r.ContactRoleID AS Value FROM dbo.tblContactRole r
                WHERE r.ContactRoleID = {contact.ContactRoleId} AND r.IsActive = 1").ToListAsync();
        }

        if (roleIds.Count == 0)
        {
            return false;
        }

        var rows = await ctx.Database.SqlQuery<RpRow>($@"
            SELECT ContactRoleId, ClientId, AccessLevel, Allowed
            FROM dbo.RolePermission
            WHERE PermissionKey = {key}
              AND (ClientId IS NULL OR ClientId = {contact.ClientId})").ToListAsync();

        // Per role the client override wins over the global default; most permissive role wins.
        return roleIds.Any(roleId =>
        {
            var mine = rows.Where(r => r.ContactRoleId == roleId).ToList();
            var row = mine.FirstOrDefault(r => r.ClientId != null) ?? mine.FirstOrDefault(r => r.ClientId == null);
            return row != null && (row.AccessLevel ?? (row.Allowed ? (byte)1 : (byte)0)) >= 1;
        });
    }

    private sealed class ContactRow
    {
        public int? ClientId { get; set; }
        public int? ContactRoleId { get; set; }
    }
}

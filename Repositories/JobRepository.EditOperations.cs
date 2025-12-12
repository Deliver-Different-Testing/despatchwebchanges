using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    private async Task UpdateTucJobAsync(int jobId, JobProperty property, string value)
    {
        // Try to use ExecuteUpdateAsync for simple single-field updates (no entity loading required)
        if (await TryExecuteDirectUpdateAsync(jobId, property, value))
            return;

        // Fall back to entity-based updates for complex cases requiring includes or business logic
        await UpdateTucJobWithEntityAsync(jobId, property, value);
    }

    /// <summary>
    /// Attempts to update a job using ExecuteUpdateAsync for better performance.
    /// Returns true if the update was handled, false if it needs an entity-based approach.
    /// </summary>
    private async Task<bool> TryExecuteDirectUpdateAsync(int jobId, JobProperty property, string value)
    {
        var baseQuery = Context.TucJobs.Where(j => j.UcjbId == jobId);
        int rowsAffected;

        switch (property)
        {
            case JobProperty.Time:
                var time = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbTime, time));
                break;

            case JobProperty.Date:
                var date = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbDate, date));
                break;

            case JobProperty.Items:
                var qty = short.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbQty, qty));
                break;

            case JobProperty.Pedal:
                var pedal = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbCbd, pedal));
                break;

            case JobProperty.Attention:
                var attention = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbAttention, attention));
                break;

            case JobProperty.Reprice:
                var reprice = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Reprice, reprice));
                break;

            case JobProperty.RefA:
                var refA = value[..Math.Min(value.Length, 20)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbClientRefa, refA));
                break;

            case JobProperty.RefB:
                var refB = value[..Math.Min(value.Length, 15)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbClientRefb, refB));
                break;

            case JobProperty.OurRef:
                var ourRef = value[..Math.Min(value.Length, 20)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbOurRef, ourRef));
                break;

            case JobProperty.FromContactName:
                var fromContact = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromContact, fromContact));
                break;

            case JobProperty.ToContactName:
                var toContact = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, toContact));
                break;

            case JobProperty.FromContactPhone:
                var fromPhone = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromPhone, fromPhone));
                break;

            case JobProperty.ToContactPhone:
                var toPhone = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToPhone, toPhone));
                break;

            case JobProperty.CompletedTime:
                var complTime = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbComplTime, complTime));
                break;

            case JobProperty.DGClass:
                var dgClass = int.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgclass, dgClass));
                break;

            case JobProperty.DGDocumentation:
                var dgDoc = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgdocument, dgDoc));
                break;

            case JobProperty.TrackingMethod:
                var trackingMethod = int.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethod));
                break;

            case JobProperty.Direct:
                var direct = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Direct, direct));
                break;

            case JobProperty.TrackingMobile:
                var trackingMobile = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMobile, trackingMobile));
                break;

            case JobProperty.TrackingEmail:
                var trackingEmail = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingEmail, trackingEmail));
                break;

            case JobProperty.PODName:
            case JobProperty.PodName:
                var podName = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbPodname, podName));
                break;

            case JobProperty.AcceptedJobTypeID:
                var acceptedJobType = short.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.AcceptedJobTypeId, acceptedJobType));
                break;

            case JobProperty.Locked:
                var locked = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbLocked, locked));
                break;

            case JobProperty.PuTime:
                var puTime = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickUpTime, puTime));
                break;

            case JobProperty.DeliverBy:
                var deliverBy = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverByTime, deliverBy));
                break;

            case JobProperty.BookedTime:
                var bookedTime = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbDate, bookedTime));
                break;

            case JobProperty.FollowupTime:
                var followupTime = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.FollowupTime, followupTime));
                break;

            case JobProperty.Barcode:
                var barcode = value[..Math.Min(value.Length, 20)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Barcode, barcode));
                break;

            case JobProperty.DeliverToLeaveID:
                var leaveId = int.Parse(value);
                var privateBusiness = leaveId == 1 ? (int?)null : 1;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.DeliverToLeaveId, leaveId)
                    .SetProperty(j => j.DeliverToPrivateBusiness, privateBusiness));
                break;

            case JobProperty.Amount:
                var amount = decimal.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.UcjbAmount, amount)
                    .SetProperty(j => j.RatedManually, true));
                break;

            case JobProperty.ClientCode:
                var clientCode = value[..Math.Min(value.Length, 5)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbClientCode, clientCode));
                break;

            default:
                // Property requires entity-based update
                return false;
        }

        if (rowsAffected == 0)
            throw new ArgumentException($"Job with ID {jobId} not found", nameof(jobId));

        Log.Debug("ExecuteUpdateAsync: Updated {Property} for job {JobId}", property, jobId);
        return true;
    }

    /// <summary>
    /// Updates a job using entity tracking for complex cases requiring includes,
    /// related entity updates, or business logic.
    /// </summary>
    private async Task UpdateTucJobWithEntityAsync(int jobId, JobProperty property, string value)
    {
        var query = Context.TucJobs.Where(j => j.UcjbId == jobId);
        query = AddRequiredIncludes(query, property);

        var job = await query.FirstOrDefaultAsync();
        ArgumentNullException.ThrowIfNull(job);

        // Internal Status handled separately
        if (property == JobProperty.InternalStatusID)
        {
            await UpdateJobInternalStatusAsync(job, value);
            return;
        }

        // Update the correct field prop - complex cases only
        switch (property)
        {
            case JobProperty.ConNote:
                if (job.ParentId != null) job.Parent.Connote = value;
                else job.Connote = value;
                break;
            case JobProperty.AirportOnly:
                var airportOnly = bool.Parse(value);
                job.TucJobNationwides.First().UcnwAirportOnly = airportOnly;
                break;
            case JobProperty.Size:
                UpdateJobSize(value, job);
                break;
            case JobProperty.Void:
                var voidJob = bool.Parse(value);
                if (voidJob) throw new ApplicationException("Voiding a job is not allowed here");
                job.UcjbVoid = false;
                break;
            case JobProperty.SpeedID:
                job.UcjbSpeed = short.Parse(value);
                break;
            case JobProperty.Weight:
                if (!double.TryParse(value?.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var weight))
                    throw new ArgumentException($"Invalid weight value: '{value}'");

                if (job.Parent != null)
                {
                    job.Parent.UcjbWeight = weight;
                    if (job.Parent.InverseParent.Count != 0)
                        foreach (var siblingJob in job.Parent.InverseParent)
                            siblingJob.UcjbWeight = weight;
                }
                else
                {
                    job.UcjbWeight = weight;
                    if (job.InverseParent != null && job.InverseParent.Count != 0)
                        foreach (var childJob in job.InverseParent)
                            childJob.UcjbWeight = weight;
                }

                break;
            case JobProperty.ClientID:
                var newClientId = int.Parse(value);
                var clientCode =  await Context.TucClients
                    .Where(c => c.UcclId == newClientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();
                
                job.UcjbClientId = newClientId;
                job.UcjbClientCode = clientCode;
                break;
            case JobProperty.ContactID:
                var contactId = int.Parse(value);
                job.ContactId = contactId;
                job.UcjbContact = job.Contact?.UserName;
                break;
            case JobProperty.Status:
                var newStatus = int.Parse(value);
                job.UcjbStatus = newStatus;

                if (newStatus == (int)JobStatus.PickedUp)
                    job.PickUpTime = _infoService.GetCurrentTimeFromTimeZone(job.PickupTimeZone);

                break;
            case JobProperty.UndeliverableLocationID:
                job.UndeliverableLocationId = int.Parse(value);
                job.UcjbStatus = (int)JobStatus.Undeliverable;
                job.UcjbJobDone = true;
                job.UcjbComplTime = _infoService.GetCurrentTenantTime();
                job.UcjbPodname =
                    job.UndeliverableLocation != null
                        ? job.UndeliverableLocation.Podname
                        : string.Empty;
                break;
            case JobProperty.Delivered:
                var delivered = bool.Parse(value);
                job.UcjbJobDone = delivered;
                if (delivered)
                {
                    job.UcjbStatus = (int)JobStatus.Completed;
                    job.UcjbComplTime = _infoService.GetCurrentTenantTime();
                }

                break;
            case JobProperty.NotifiedJobTypeID:
                var notifiedJobTypeId = short.Parse(value);
                job.NotifiedJobTypeId = notifiedJobTypeId;

                if (
                    notifiedJobTypeId > job.NotifiedJobTypeId
                    && job.ContactId != null
                    && job.NotifiedJobType.UcjtName == "Email"
                    && job.Contact?.HasEmail == true
                    && !string.IsNullOrEmpty(job.Contact.UcctEmail)
                )
                {
                    job.SpeedChangeNotificationHasBeenSent = false;
                    job.WhenSpeedChangeNotificationSent = null;
                }
                else
                {
                    job.SpeedChangeNotificationHasBeenSent = true;
                }

                break;
            case JobProperty.TailLiftPu:
                if (job.TucJobItemJobs == null) throw new NullReferenceException("TucJobItemJobs is null");
                foreach (var item in job.TucJobItemJobs) item.Pu = bool.Parse(value);
                break;
            case JobProperty.TailLiftDo:
                if (job.TucJobItemJobs == null) throw new NullReferenceException("TucJobItemJobs is null");
                foreach (var item in job.TucJobItemJobs) item.Do = bool.Parse(value);
                break;
            case JobProperty.DeliverToPrivateRes:
                if (job.TucJobItemJobs == null) throw new NullReferenceException("TucJobItemJobs is null");
                foreach (var item in job.TucJobItemJobs) item.PrivateRes = bool.Parse(value);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        var entries = Context.ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified)
            .ToList();

        var logMessages = new List<string> { $"Entities to be updated: {entries.Count}" };

        foreach (var entry in entries)
        {
            logMessages.Add($"Entity: {entry.Entity.GetType().Name}");
            logMessages.AddRange(
                entry.Properties
                    .Where(p => p.IsModified)
                    .Select(p => $"  {p.Metadata.Name}: {p.OriginalValue} -> {p.CurrentValue}")
            );
        }

        Log.Debug("{ChangeTrackerInfo}", string.Join(", ", logMessages));

        var changeCount = await Context.SaveChangesAsync();
        Log.Debug("Changes saved: {ChangeCount}", changeCount);

        // Add additional notes for undeliverable location
        if (property == JobProperty.UndeliverableLocationID && job.UndeliverableLocation?.Message != null)
            await JobUpdateAddNoteAsync(jobId, true, job.UndeliverableLocation.Message);
    }

    private async Task UpdateTucJobArchiveAsync(int jobId, JobProperty property, string value)
    {
        var query = Context.TucJobArchives.Where(j => j.UcjbId == jobId);
        query = AddRequiredArchiveIncludes(query, property);

        var archive = await query.FirstOrDefaultAsync();
        ArgumentNullException.ThrowIfNull(archive);

        // Update the correct field prop
        switch (property)
        {
            case JobProperty.ConNote:
                archive.Connote = value;
                break;
            case JobProperty.AirportOnly:
                var airportOnly = bool.Parse(value);
                archive.Nationwide.UcnwAirportOnly = airportOnly;
                break;
            case JobProperty.Time:
                archive.UcjbTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Date:
                archive.UcjbDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Size:
                UpdateArchiveJobSize(value, archive);
                break;
            case JobProperty.Items:
                archive.UcjbQty = short.Parse(value);
                break;
            case JobProperty.Void:
                var voidJob = bool.Parse(value);
                if (voidJob) throw new ApplicationException("Voiding a job is not allowed here");
                archive.UcjbVoid = false;
                break;
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID when !archive.UcjbJobDone:
                archive.UcjbSpeed = short.Parse(value);
                break;
            case JobProperty.Weight:
                var weight = double.Parse(value);
                if (archive.ParentId != null)
                {
                    archive.Parent.UcjbWeight = weight;
                    if (archive.InverseParent.Count != 0)
                        foreach (var siblingJob in archive.InverseParent)
                            siblingJob.UcjbWeight = weight;
                }
                else
                {
                    archive.UcjbWeight = weight;
                    if (archive.InverseParent.Count != 0)
                        foreach (var childJob in archive.InverseParent)
                            childJob.UcjbWeight = weight;
                }

                break;
            case JobProperty.ClientID:
                var archiveClientId = int.Parse(value);
                var clientCode = await Context.TucClients
                    .Where(c => c.UcclId == archiveClientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();
                
                archive.UcjbClientId = archiveClientId;
                archive.UcjbClientCode = clientCode;
                break;
            case JobProperty.ClientCode:
                archive.UcjbClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case JobProperty.ContactID:
                var contactId = int.Parse(value);
                archive.ContactId = contactId;
                archive.UcjbContact = archive.Contact.UserName;
                break;
            case JobProperty.Pedal:
                archive.UcjbCbd = bool.Parse(value);
                break;
            case JobProperty.Attention:
                archive.UcjbAttention = bool.Parse(value);
                break;
            case JobProperty.Reprice:
                archive.Reprice = bool.Parse(value);
                break;
            case JobProperty.Truck:
                archive.Truck = bool.Parse(value);
                archive.UcjbVan = false; // Set van to false when truck is selected
                break;
            case JobProperty.Van:
                archive.UcjbVan = bool.Parse(value);
                archive.Truck = false; // Set truck to false when a van is selected
                break;
            case JobProperty.VanOK:
                archive.VanOk = bool.Parse(value);
                break;
            case JobProperty.InternalStatusID:
                var internalStatusId = int.Parse(value);
                archive.InternalStatus = internalStatusId;

                // Handle followup time
                if (
                    !new[]
                    {
                        (int)InternalJobStatus.NewJobs,
                        (int)InternalJobStatus.Reprice
                    }.Contains(internalStatusId)
                )
                    archive.FollowupTime = _infoService.GetCurrentTenantTime().AddMinutes(
                        archive.InternalStatusNavigation.DefaultMinutes ?? 0
                    );
                else
                    archive.FollowupTime = null;

                archive.UcjbStatus = internalStatusId switch
                {
                    // Handle status changes
                    (int)InternalJobStatus.AwaitingPod when archive.UcjbStatus != (int)JobStatus.AwaitingPod =>
                        (int)JobStatus.AwaitingPod,
                    (int)InternalJobStatus.NewJobs when archive.UcjbStatus != (int)JobStatus.Dispatched =>
                        (int)JobStatus.Dispatched,
                    (int)InternalJobStatus.Reprice when archive.UcjbStatus != (int)JobStatus.Completed => (int)JobStatus
                        .Completed,
                    _ => archive.UcjbStatus
                };
                break;
            case JobProperty.Status:
                archive.UcjbStatus = int.Parse(value);
                break;
            case JobProperty.RefA:
                archive.UcjbClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.RefB:
                archive.UcjbClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case JobProperty.OurRef:
                archive.UcjbOurRef = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.FromContactName:
                archive.PickUpFromContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactName:
                archive.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.FromContactPhone:
                archive.PickUpFromPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactPhone:
                archive.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.DeliverToLeaveID:
                var leaveId = int.Parse(value);
                archive.DeliverToLeaveId = leaveId;
                archive.DeliverToPrivateBusiness = leaveId == 1 ? null : 1;
                break;
            case JobProperty.UndeliverableLocationID:
                archive.UndeliverableLocationId = int.Parse(value);
                archive.UcjbStatus = (int)JobStatus.Undeliverable;
                archive.UcjbJobDone = true;
                archive.UcjbComplTime = _infoService.GetCurrentTenantTime();
                archive.UcjbPodname =
                    archive.UndeliverableLocation != null
                        ? archive.UndeliverableLocation.Podname
                        : string.Empty;
                break;
            case JobProperty.Delivered:
                var delivered = bool.Parse(value);
                archive.UcjbJobDone = delivered;
                if (delivered)
                {
                    archive.UcjbStatus = (int)JobStatus.Completed;
                    archive.UcjbComplTime = _infoService.GetCurrentTenantTime();
                }

                break;
            case JobProperty.CompletedTime:
                archive.UcjbComplTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DGClass:
                archive.Dgclass = int.Parse(value);
                break;
            case JobProperty.DGDocumentation:
                var dgDoc = bool.Parse(value);
                archive.Dgdocument = dgDoc;
                break;
            case JobProperty.TrackingMethod:
                var trackingMethodId = int.Parse(value);
                archive.TrackingMethod = trackingMethodId;
                break;
            case JobProperty.Direct:
                archive.Direct = bool.Parse(value);
                break;
            case JobProperty.TrackingMobile:
                archive.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.TrackingEmail:
                archive.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.PODName:
            case JobProperty.PodName:
                archive.UcjbPodname = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.Amount:
                archive.UcjbAmount = decimal.Parse(value);
                break;
            case JobProperty.NotifiedJobTypeID:
                var notifiedJobTypeId = short.Parse(value);
                archive.NotifiedJobTypeId = notifiedJobTypeId;

                if (
                    notifiedJobTypeId > archive.NotifiedJobTypeId
                    && archive.ContactId != null
                    && archive.NotifiedJobType.UcjtName == "Email"
                    && archive.Contact?.HasEmail == true
                    && !string.IsNullOrEmpty(archive.Contact.UcctEmail)
                )
                {
                    archive.SpeedChangeNotificationHasBeenSent = false;
                    archive.WhenSpeedChangeNotificationSent = null;
                }
                else
                {
                    archive.SpeedChangeNotificationHasBeenSent = true;
                }

                break;
            case JobProperty.AcceptedJobTypeID:
                archive.AcceptedJobTypeId = short.Parse(value);
                break;
            case JobProperty.Locked:
                archive.UcjbLocked = int.Parse(value);
                break;
            case JobProperty.PuTime:
                archive.PickUpTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DeliverBy:
                archive.DeliverByTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.BookedTime:
                archive.UcjbDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Barcode:
                archive.Barcode = value[..Math.Min(value.Length, 20)];
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        // Add additional notes for undeliverable location
        if (property == JobProperty.UndeliverableLocationID && archive.UndeliverableLocation?.Message != null)
            await JobUpdateAddNoteAsync(jobId, false, archive.UndeliverableLocation.Message);

        await Context.SaveChangesAsync();
    }

    public async Task UpdateBulkJobAsync(
        int bulkJobId,
        JobProperty property,
        string value)
    {
        var query = Context.TblBulkJobs.Where(j => j.BulkJobId == bulkJobId);
        query = AddRequiredBulkJobIncludes(query, property);

        var bulkJob = await query.FirstOrDefaultAsync();
        ArgumentNullException.ThrowIfNull(bulkJob);

        switch (property)
        {
            case JobProperty.Time:
                bulkJob.BookTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Date:
                bulkJob.BookDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Size:
                bulkJob.Size = short.Parse(value);
                break;
            case JobProperty.Items:
                bulkJob.Qty = short.Parse(value);
                break;
            case JobProperty.SpeedID:
                bulkJob.Speed = int.Parse(value);
                break;
            case JobProperty.Weight:
                bulkJob.Weight = decimal.Parse(value);
                break;
            case JobProperty.ClientID:
                var bulkClientId = int.Parse(value);
                bulkJob.ClientId = bulkClientId;
                bulkJob.ClientCode = await Context.TucClients
                    .Where(c => c.UcclId == bulkClientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();
                break;
            case JobProperty.ClientCode:
                bulkJob.ClientCode = value[..Math.Min(value.Length, 5)];
                bulkJob.Client.UcclCode = value[..Math.Min(value.Length, 50)];
                break;
            case JobProperty.RefA:
                bulkJob.ClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.RefB:
                bulkJob.ClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case JobProperty.OurRef:
                bulkJob.OurRef = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.FromContactName:
                bulkJob.Contact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactName:
                bulkJob.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactPhone:
                bulkJob.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.DeliverToLeaveID:
                var leaveId = int.Parse(value);
                bulkJob.DeliverToLeaveId = leaveId;
                bulkJob.DeliverToPrivateBusiness = leaveId == 1 ? null : false;
                break;
            case JobProperty.TrackingMethod:
                var trackingMethodId = int.Parse(value);
                bulkJob.TrackingMethod = trackingMethodId;
                break;
            case JobProperty.TrackingMobile:
                bulkJob.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.TrackingEmail:
                bulkJob.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.Amount:
                bulkJob.Amount = decimal.Parse(value);
                break;
            case JobProperty.Void:
                bulkJob.Void = bool.Parse(value);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        await Context.SaveChangesAsync();
    }

    private async Task JobUpdateAddNoteAsync(int jobId, bool isLiveJob, string updateNote)
    {
        var staffId = _infoService.GetStaffId();
        var currentDate = _infoService.GetCurrentTenantTime();

        var newNote = new TucNote
        {
            CreatedBy = staffId,
            CreatedDate = currentDate,
            JobId = isLiveJob ? jobId : null,
            JobBookingId = !isLiveJob ? jobId : null,
            NoteText = updateNote,
            NoteTypeId = (int)NoteType.InternalNote,
            IsImportant = false
        };

        await Context.AddAsync(newNote);
    }

    private async Task UpdateJobInternalStatusAsync(TucJob job, string value)
    {
        var newInternalStatusId = int.Parse(value);
        job.InternalStatus = newInternalStatusId;

        // Handle followup time
        if (!new[]
            {
                (int)InternalJobStatus.NewJobs,
                (int)InternalJobStatus.Reprice
            }.Contains(newInternalStatusId))
        {
            // Safely handle DefaultMinutes when InternalStatusNavigation is null
            var defaultMinutes = job.InternalStatusNavigation?.DefaultMinutes ?? 0;
            job.FollowupTime = _infoService.GetCurrentTenantTime().AddMinutes(defaultMinutes);
        }
        else
        {
            job.FollowupTime = null;
        }

        job.UcjbStatus = newInternalStatusId switch
        {
            // Handle status changes
            (int)InternalJobStatus.AwaitingPod when job.UcjbStatus != (int)JobStatus.AwaitingPod => (int)JobStatus
                .AwaitingPod,
            (int)InternalJobStatus.NewJobs when job.UcjbStatus != (int)JobStatus.Dispatched =>
                (int)JobStatus.Dispatched,
            (int)InternalJobStatus.Reprice when job.UcjbStatus != (int)JobStatus.Completed => (int)JobStatus.Completed,
            _ => job.UcjbStatus
        };

        await Context.SaveChangesAsync();
    }

    private static void UpdateJobSize(string value, TucJob job)
    {
        var sizeId = int.Parse(value);
        job.UcjbSize = sizeId;

        switch (sizeId)
        {
            case (int)VehicleType.Truck or (int)UrgentVehicleType.Truck:
                job.Truck = true;
                job.UcjbVan = false;
                break;
            case (int)VehicleType.Van or (int)UrgentVehicleType.Van:
                job.UcjbVan = true;
                job.Truck = false;
                break;
        }
    }
    
    private static void UpdateArchiveJobSize(string value, TucJobArchive job)
    {
        var sizeId = int.Parse(value);
        job.UcjbSize = sizeId;

        switch (sizeId)
        {
            case (int)VehicleType.Truck or (int)UrgentVehicleType.Truck:
                job.Truck = true;
                break;
            case (int)VehicleType.Van or (int)UrgentVehicleType.Van:
                job.UcjbVan = true;
                break;
        }
    }   
    
    private static IQueryable<TucJob> AddRequiredIncludes(IQueryable<TucJob> query, JobProperty property)
    {
        query = query
            .Include(j => j.UcjbStatusNavigation)
            .Include(j => j.PickupTimeZone);

        return property switch
        {
            JobProperty.ConNote => query.Include(j => j.Parent),
            JobProperty.AirportOnly => query.Include(j => j.TucJobNationwides),
            JobProperty.Weight => query.Include(j => j.Parent)
                .ThenInclude(p => p.InverseParent)
                .Include(j => j.InverseParent),
            JobProperty.ClientID => query.Include(j => j.UcjbClient),
            JobProperty.ContactID => query.Include(j => j.Contact),
            JobProperty.DeliverToLeaveID => query.Include(j => j.DeliverToLeave),
            JobProperty.UndeliverableLocationID => query.Include(j => j.UndeliverableLocation),
            JobProperty.NotifiedJobTypeID => query.Include(j => j.NotifiedJobType).Include(j => j.Contact),
            JobProperty.TailLiftPu or JobProperty.TailLiftDo or JobProperty.DeliverToPrivateRes => query.Include(j =>
                j.TucJobItemJobs),
            _ => query
        };
    }

    private static IQueryable<TucJobArchive> AddRequiredArchiveIncludes(IQueryable<TucJobArchive> query,
        JobProperty property)
    {
        return property switch
        {
            JobProperty.AirportOnly => query.Include(j => j.Nationwide),
            JobProperty.Weight => query.Include(j => j.Parent).Include(j => j.InverseParent),
            JobProperty.ClientID => query.Include(j => j.UcjbClient),
            JobProperty.ContactID => query.Include(j => j.Contact),
            JobProperty.InternalStatusID => query.Include(j => j.InternalStatusNavigation),
            JobProperty.DeliverToLeaveID => query.Include(j => j.DeliverToLeave),
            JobProperty.UndeliverableLocationID => query.Include(j => j.UndeliverableLocation),
            JobProperty.NotifiedJobTypeID => query.Include(j => j.NotifiedJobType).Include(j => j.Contact),
            _ => query
        };
    }
    
    private static IQueryable<TblBulkJob> AddRequiredBulkJobIncludes(
        IQueryable<TblBulkJob> query,
        JobProperty property)
    {
        return property switch
        {
            JobProperty.ClientID or JobProperty.ClientCode => query.Include(j => j.Client),
            JobProperty.SpeedID => query.Include(j => j.SpeedNavigation),
            JobProperty.DeliverToLeaveID => query.Include(j => j.DeliverToLeave),
            _ => query
        };
    }
}
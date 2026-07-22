using System.Globalization;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    /// <summary>
    /// Updates a single property on a bulk job record.
    /// Uses ExecuteUpdateAsync for simple field updates, falls back to entity tracking for complex cases.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to update.</param>
    /// <param name="property">The property to update.</param>
    /// <param name="value">The new value for the property.</param>
    public async Task UpdateBulkJobAsync(
        int bulkJobId,
        JobProperty property,
        string value)
    {
        // Try to use ExecuteUpdateAsync for simple single-field updates (no entity loading required)
        if (await TryExecuteDirectBulkUpdateAsync(bulkJobId, property, value))
        {
            return;
        }

        // Fall back to entity-based updates for complex cases requiring includes or business logic
        await UpdateBulkJobWithEntityAsync(bulkJobId, property, value);
    }

    private async Task UpdateTucJobAsync(int jobId, JobProperty property, string value)
    {
        // Try to use ExecuteUpdateAsync for simple single-field updates (no entity loading required)
        if (await TryExecuteDirectUpdateAsync(jobId, property, value))
        {
            return;
        }

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

        // For date-field edits we capture the pre-update state so the log line shows
        // what was overwritten. Cheap single-row read, only when diagnostics are useful.
        if (IsDateProperty(property))
        {
            var before = await baseQuery
                .Select(j => new
                {
                    j.UcjbVoid,
                    j.JobRelationshipTypeId,
                    j.ParentId,
                    j.RootParentId,
                    j.UcjbDate,
                    j.UcjbTime,
                    j.PickUpTime,
                    j.DeliverByTime,
                    j.PickupArrivalTime,
                    j.DeliveryArrivalTime,
                    j.UcjbComplTime,
                    j.FollowupTime
                })
                .FirstOrDefaultAsync();

            Log.Information(
                "Edit-date snapshot before: job {JobId}, property {Property}, newValue {Value}, "
                + "void={IsVoid}, relType={RelType}, parentId={ParentId}, rootParentId={RootParentId}, "
                + "ucjbDate={UcjbDate}, ucjbTime={UcjbTime}, puTime={PuTime}, deliverBy={DeliverBy}, "
                + "puArrival={PuArrival}, doArrival={DoArrival}, complTime={ComplTime}, followup={Followup}",
                jobId, property, value,
                before?.UcjbVoid, before?.JobRelationshipTypeId, before?.ParentId, before?.RootParentId,
                before?.UcjbDate, before?.UcjbTime, before?.PickUpTime, before?.DeliverByTime,
                before?.PickupArrivalTime, before?.DeliveryArrivalTime, before?.UcjbComplTime, before?.FollowupTime);
        }

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
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromContact, fromContact));
                break;

            case JobProperty.ToContactName:
                var toContact = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, toContact));
                break;

            case JobProperty.FromContactPhone:
                var fromPhone = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromPhone, fromPhone));
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
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethod));
                break;

            case JobProperty.Direct:
                var direct = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Direct, direct));
                break;

            case JobProperty.TrackingMobile:
                var trackingMobile = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMobile, trackingMobile));
                break;

            case JobProperty.TrackingEmail:
                var trackingEmail = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingEmail, trackingEmail));
                break;

            case JobProperty.PODName:
            case JobProperty.PodName:
                var podName = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbPodname, podName));
                break;

            case JobProperty.AcceptedJobTypeID:
                var acceptedJobType = short.Parse(value);
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.AcceptedJobTypeId, acceptedJobType));
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
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.UcjbDate, bookedTime)
                    .SetProperty(j => j.UcjbTime, bookedTime));
                break;

            case JobProperty.PickupArrivalTime:
                var pickupArrival = DateTimeOffset.Parse(value).DateTime;
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupArrivalTime, pickupArrival));
                break;

            case JobProperty.DeliveryArrivalTime:
                var deliveryArrival = DateTimeOffset.Parse(value).DateTime;
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliveryArrivalTime, deliveryArrival));
                break;

            case JobProperty.FollowupTime:
                var followupTime = DateTimeOffset.Parse(value).DateTime;
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.FollowupTime, followupTime));
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
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbClientCode, clientCode));
                break;

            case JobProperty.Truck:
                var truck = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.Truck, truck)
                    .SetProperty(j => j.UcjbVan, false));
                break;

            case JobProperty.Van:
                var van = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.UcjbVan, van)
                    .SetProperty(j => j.Truck, false));
                break;

            case JobProperty.VanOK:
                var vanOk = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.VanOk, vanOk));
                break;

            default:
                // Property requires entity-based update
                return false;
        }

        if (rowsAffected == 0)
        {
            throw new ArgumentException($"Job with ID {jobId} not found", nameof(jobId));
        }

        if (IsDateProperty(property))
        {
            Log.Information(
                "Edit-date direct write: job {JobId}, property {Property}, value {Value}, rowsAffected {RowsAffected}",
                jobId, property, value, rowsAffected);
        }
        else
        {
            Log.Debug("ExecuteUpdateAsync: Updated {Property} for job {JobId}", property, jobId);
        }

        return true;
    }

    /// <summary>
    /// Properties that represent a date/time edit. Used to enable extra diagnostic
    /// logging on the date-edit flow without polluting logs for every field.
    /// </summary>
    private static bool IsDateProperty(JobProperty property) =>
        property is JobProperty.Date
            or JobProperty.Time
            or JobProperty.BookedTime
            or JobProperty.PuTime
            or JobProperty.DeliverBy
            or JobProperty.PickupArrivalTime
            or JobProperty.DeliveryArrivalTime
            or JobProperty.CompletedTime
            or JobProperty.FollowupTime;

    /// <summary>
    /// Updates a job using entity tracking for complex cases requiring includes,
    /// related entity updates, or business logic.
    /// </summary>
    private async Task UpdateTucJobWithEntityAsync(int jobId, JobProperty property, string value)
    {
        var query = Context.TucJobs.AsTracking().Where(j => j.UcjbId == jobId);
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
                if (job.ParentId != null)
                {
                    job.Parent.Connote = value;
                }
                else
                {
                    job.Connote = value;
                }

                break;
            case JobProperty.AirportOnly:
                var airportOnly = bool.Parse(value);
                job.TucJobNationwides.First().UcnwAirportOnly = airportOnly;
                break;
            case JobProperty.Size:
                UpdateJobSize(value, job, _infoService.IsUsTenant());
                break;
            case JobProperty.Void:
                var voidJob = bool.Parse(value);
                if (voidJob)
                {
                    throw new ApplicationException("Voiding a job is not allowed here");
                }

                job.UcjbVoid = false;
                break;
            case JobProperty.SpeedID:
                job.UcjbSpeed = short.Parse(value);
                break;
            case JobProperty.Weight:
                if (!double.TryParse(value?.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var weight))
                {
                    throw new ArgumentException($"Invalid weight value: '{value}'", nameof(value));
                }

                if (job.Parent != null)
                {
                    job.Parent.UcjbWeight = weight;
                    if (job.Parent.InverseParent.Count != 0)
                    {
                        foreach (var siblingJob in job.Parent.InverseParent)
                        {
                            siblingJob.UcjbWeight = weight;
                        }
                    }
                }
                else
                {
                    job.UcjbWeight = weight;
                    if (job.InverseParent != null && job.InverseParent.Count != 0)
                    {
                        foreach (var childJob in job.InverseParent)
                        {
                            childJob.UcjbWeight = weight;
                        }
                    }
                }

                break;
            case JobProperty.ClientID:
                var newClientId = int.Parse(value);
                var clientCode = await Context.TucClients
                    .Where(c => c.UcclId == newClientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();

                job.UcjbClientId = newClientId;
                job.UcjbClientCode = clientCode;

                // If this is a parent job, update all child jobs to the same client
                if (job.InverseParent != null && job.InverseParent.Count != 0)
                {
                    foreach (var childJob in job.InverseParent)
                    {
                        childJob.UcjbClientId = newClientId;
                        childJob.UcjbClientCode = clientCode;
                    }
                }

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
                {
                    job.PickUpTime = _infoService.GetCurrentTimeFromTimeZone(job.PickupTimeZone);
                }

                break;
            case JobProperty.UndeliverableLocationID:
                job.UndeliverableLocationId = int.Parse(value);
                job.UcjbStatus = (int)JobStatus.Undeliverable;
                job.UcjbJobDone = true;
                job.UcjbComplTime = _infoService.GetCurrentTimeFromTimeZone(job.DeliverByTimeZone);
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
                    job.UcjbComplTime = _infoService.GetCurrentTimeFromTimeZone(job.DeliverByTimeZone);
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
                if (job.TucJobItemJobs == null)
                {
                    throw new NullReferenceException("TucJobItemJobs is null");
                }

                foreach (var item in job.TucJobItemJobs)
                {
                    item.Pu = bool.Parse(value);
                }

                break;
            case JobProperty.TailLiftDo:
                if (job.TucJobItemJobs == null)
                {
                    throw new NullReferenceException("TucJobItemJobs is null");
                }

                foreach (var item in job.TucJobItemJobs)
                {
                    item.Do = bool.Parse(value);
                }

                break;
            case JobProperty.DeliverToPrivateRes:
                if (job.TucJobItemJobs == null)
                {
                    throw new NullReferenceException("TucJobItemJobs is null");
                }

                foreach (var item in job.TucJobItemJobs)
                {
                    item.PrivateRes = bool.Parse(value);
                }

                break;
            case JobProperty.Time:
            case JobProperty.Date:
            case JobProperty.Items:
            case JobProperty.AcceptedJobTypeID:
            case JobProperty.ClientCode:
            case JobProperty.Pedal:
            case JobProperty.Attention:
            case JobProperty.Reprice:
            case JobProperty.Truck:
            case JobProperty.Van:
            case JobProperty.VanOK:
            case JobProperty.InternalStatusID:
            case JobProperty.RefA:
            case JobProperty.RefB:
            case JobProperty.OurRef:
            case JobProperty.FromContactName:
            case JobProperty.ToContactName:
            case JobProperty.FromContactPhone:
            case JobProperty.ToContactPhone:
            case JobProperty.DeliverToLeaveID:
            case JobProperty.CompletedTime:
            case JobProperty.DGClass:
            case JobProperty.DGDocumentation:
            case JobProperty.TrackingMethod:
            case JobProperty.Direct:
            case JobProperty.TrackingMobile:
            case JobProperty.TrackingEmail:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.Amount:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.DeliverBy:
            case JobProperty.BookedTime:
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.CustomJobName:
            case JobProperty.Barcode:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.RecurringMode:
            case JobProperty.SavedFlightNumber:
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
        {
            await JobUpdateAddNoteAsync(jobId, true, job.UndeliverableLocation.Message);
        }
    }

    private async Task UpdateTucJobArchiveAsync(int jobId, JobProperty property, string value)
    {
        var query = Context.TucJobArchives.AsTracking().Where(j => j.UcjbId == jobId);
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
                UpdateArchiveJobSize(value, archive, _infoService.IsUsTenant());
                break;
            case JobProperty.Items:
                archive.UcjbQty = short.Parse(value);
                break;
            case JobProperty.Void:
                var voidJob = bool.Parse(value);
                if (voidJob)
                {
                    throw new ApplicationException("Voiding a job is not allowed here");
                }

                archive.UcjbVoid = false;
                break;
            case JobProperty.SpeedID:
                archive.UcjbSpeed = short.Parse(value);
                break;
            case JobProperty.Weight:
                var weight = double.Parse(value);
                if (archive.ParentId != null)
                {
                    archive.Parent.UcjbWeight = weight;
                    if (archive.InverseParent.Count != 0)
                    {
                        foreach (var siblingJob in archive.InverseParent)
                        {
                            siblingJob.UcjbWeight = weight;
                        }
                    }
                }
                else
                {
                    archive.UcjbWeight = weight;
                    if (archive.InverseParent.Count != 0)
                    {
                        foreach (var childJob in archive.InverseParent)
                        {
                            childJob.UcjbWeight = weight;
                        }
                    }
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
                var isTruck = bool.Parse(value);
                archive.Truck = isTruck;
                if (isTruck)
                {
                    archive.UcjbVan = false; // Set van to false when truck is selected
                }

                break;
            case JobProperty.Van:
                var isVan = bool.Parse(value);
                archive.UcjbVan = isVan;
                if (isVan)
                {
                    archive.Truck = false; // Set truck to false when a van is selected
                }

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
                {
                    archive.FollowupTime = _clock.TenantNow.AddMinutes(
                        archive.InternalStatusNavigation.DefaultMinutes ?? 0
                    );
                }
                else
                {
                    archive.FollowupTime = null;
                }

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
                archive.UcjbComplTime = _infoService.GetCurrentTimeFromTimeZone(archive.DeliverByTimeZone);
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
                    archive.UcjbComplTime = _infoService.GetCurrentTimeFromTimeZone(archive.DeliverByTimeZone);
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
                archive.UcjbLocked = bool.Parse(value) ? 1 : 0;
                break;
            case JobProperty.PuTime:
                archive.PickUpTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DeliverBy:
                archive.DeliverByTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.BookedTime:
                var archivedBookedTime = DateTimeOffset.Parse(value).DateTime;
                archive.UcjbDate = archivedBookedTime;
                archive.UcjbTime = archivedBookedTime;
                break;
            case JobProperty.PickupArrivalTime:
                archive.PickupArrivalTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DeliveryArrivalTime:
                archive.DeliveryArrivalTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Barcode:
                archive.Barcode = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.CustomJobName:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.RecurringMode:
            case JobProperty.SavedFlightNumber:
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        // Add additional notes for undeliverable location
        if (property == JobProperty.UndeliverableLocationID && archive.UndeliverableLocation?.Message != null)
        {
            await JobUpdateAddNoteAsync(jobId, false, archive.UndeliverableLocation.Message);
        }

        await Context.SaveChangesAsync();
    }

    private async Task<bool> TryExecuteDirectBulkUpdateAsync(int bulkJobId, JobProperty property, string value)
    {
        var baseQuery = Context.TblBulkJobs.Where(j => j.BulkJobId == bulkJobId);
        int rowsAffected;

        switch (property)
        {
            case JobProperty.Time:
                var time = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.BookTime, time));
                break;

            case JobProperty.Date:
                var date = DateTimeOffset.Parse(value).DateTime;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.BookDate, date));
                break;

            case JobProperty.Size:
                var size = short.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Size, size));
                break;

            case JobProperty.Items:
                var qty = short.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Qty, qty));
                break;

            case JobProperty.SpeedID:
                var speed = int.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Speed, speed));
                break;

            case JobProperty.Weight:
                var weight = decimal.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Weight, weight));
                break;

            case JobProperty.ClientID:
                var clientId = int.Parse(value);
                var clientCode = await Context.TucClients
                    .Where(c => c.UcclId == clientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.ClientId, clientId)
                    .SetProperty(j => j.ClientCode, clientCode));
                break;

            case JobProperty.RefA:
                var refA = value[..Math.Min(value.Length, 20)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.ClientRefa, refA));
                break;

            case JobProperty.RefB:
                var refB = value[..Math.Min(value.Length, 15)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.ClientRefb, refB));
                break;

            case JobProperty.OurRef:
                var ourRef = value[..Math.Min(value.Length, 20)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.OurRef, ourRef));
                break;

            case JobProperty.FromContactName:
                var fromContact = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Contact, fromContact));
                break;

            case JobProperty.ToContactName:
                var toContact = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, toContact));
                break;

            case JobProperty.ToContactPhone:
                var toPhone = value[..Math.Min(value.Length, 100)];
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToPhone, toPhone));
                break;

            case JobProperty.DeliverToLeaveID:
                var leaveId = int.Parse(value);
                var privateBusiness = leaveId == 1 ? (bool?)null : false;
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.DeliverToLeaveId, leaveId)
                    .SetProperty(j => j.DeliverToPrivateBusiness, privateBusiness));
                break;

            case JobProperty.TrackingMethod:
                var trackingMethod = int.Parse(value);
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethod));
                break;

            case JobProperty.TrackingMobile:
                var trackingMobile = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMobile, trackingMobile));
                break;

            case JobProperty.TrackingEmail:
                var trackingEmail = value[..Math.Min(value.Length, 100)];
                rowsAffected =
                    await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingEmail, trackingEmail));
                break;

            case JobProperty.Amount:
                var amount = decimal.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Amount, amount));
                break;

            case JobProperty.Void:
                var voidJob = bool.Parse(value);
                rowsAffected = await baseQuery.ExecuteUpdateAsync(s => s.SetProperty(j => j.Void, voidJob));
                break;

            case JobProperty.ConNote:
            case JobProperty.AirportOnly:
            case JobProperty.AcceptedJobTypeID:
            case JobProperty.ClientCode:
            case JobProperty.ContactID:
            case JobProperty.Pedal:
            case JobProperty.Attention:
            case JobProperty.Reprice:
            case JobProperty.Truck:
            case JobProperty.Van:
            case JobProperty.VanOK:
            case JobProperty.InternalStatusID:
            case JobProperty.Status:
            case JobProperty.FromContactPhone:
            case JobProperty.UndeliverableLocationID:
            case JobProperty.Delivered:
            case JobProperty.CompletedTime:
            case JobProperty.DGClass:
            case JobProperty.DGDocumentation:
            case JobProperty.Direct:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.NotifiedJobTypeID:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.DeliverBy:
            case JobProperty.BookedTime:
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.CustomJobName:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.Barcode:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.RecurringMode:
            case JobProperty.SavedFlightNumber:
            default:
                // Property requires entity-based update
                return false;
        }

        if (rowsAffected == 0)
        {
            throw new ArgumentException($"Bulk job with ID {bulkJobId} not found", nameof(bulkJobId));
        }

        Log.Debug("ExecuteUpdateAsync: Updated {Property} for bulk job {BulkJobId}", property, bulkJobId);
        return true;
    }

    private async Task UpdateBulkJobWithEntityAsync(int bulkJobId, JobProperty property, string value)
    {
        var query = Context.TblBulkJobs.AsTracking().Where(j => j.BulkJobId == bulkJobId);
        query = AddRequiredBulkJobIncludes(query, property);

        var bulkJob = await query.FirstOrDefaultAsync();
        ArgumentNullException.ThrowIfNull(bulkJob);

        switch (property)
        {
            case JobProperty.ClientCode:
                bulkJob.ClientCode = value[..Math.Min(value.Length, 5)];
                bulkJob.Client.UcclCode = value[..Math.Min(value.Length, 50)];
                break;
            case JobProperty.ConNote:
            case JobProperty.AirportOnly:
            case JobProperty.Time:
            case JobProperty.Date:
            case JobProperty.Size:
            case JobProperty.Items:
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID:
            case JobProperty.Weight:
            case JobProperty.ClientID:
            case JobProperty.ContactID:
            case JobProperty.Pedal:
            case JobProperty.Attention:
            case JobProperty.Reprice:
            case JobProperty.Truck:
            case JobProperty.Van:
            case JobProperty.VanOK:
            case JobProperty.InternalStatusID:
            case JobProperty.Status:
            case JobProperty.RefA:
            case JobProperty.RefB:
            case JobProperty.OurRef:
            case JobProperty.FromContactName:
            case JobProperty.ToContactName:
            case JobProperty.FromContactPhone:
            case JobProperty.ToContactPhone:
            case JobProperty.DeliverToLeaveID:
            case JobProperty.UndeliverableLocationID:
            case JobProperty.Delivered:
            case JobProperty.CompletedTime:
            case JobProperty.DGClass:
            case JobProperty.DGDocumentation:
            case JobProperty.TrackingMethod:
            case JobProperty.Direct:
            case JobProperty.Void:
            case JobProperty.TrackingMobile:
            case JobProperty.TrackingEmail:
            case JobProperty.PODName:
            case JobProperty.PodName:
            case JobProperty.Amount:
            case JobProperty.NotifiedJobTypeID:
            case JobProperty.Locked:
            case JobProperty.PuTime:
            case JobProperty.DeliverBy:
            case JobProperty.BookedTime:
            case JobProperty.FollowupTime:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.Active:
            case JobProperty.CustomJobName:
            case JobProperty.TailLiftPu:
            case JobProperty.TailLiftDo:
            case JobProperty.DeliverToPrivateRes:
            case JobProperty.Barcode:
            case JobProperty.CourierId:
            case JobProperty.InactiveBy:
            case JobProperty.PickupArrivalTime:
            case JobProperty.DeliveryArrivalTime:
            case JobProperty.RouteId:
            case JobProperty.AgentId:
            case JobProperty.NpAgentId:
            case JobProperty.RecurringMode:
            case JobProperty.SavedFlightNumber:
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
    }

    private async Task JobUpdateAddNoteAsync(int jobId, bool isLiveJob, string updateNote)
    {
        var staffId = _infoService.GetStaffId();
        var currentDate = _clock.TenantNow;

        var newNote = new TucNote
        {
            CreatedBy = staffId,
            CreatedDate = currentDate,
            UpdatedBy = staffId,
            UpdatedDate = currentDate,
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
            job.FollowupTime = _clock.TenantNow.AddMinutes(defaultMinutes);
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

    private static void UpdateJobSize(string value, TucJob job, bool isUsTenant)
    {
        var sizeId = int.Parse(value);

        if (job.Parent != null)
        {
            ApplySize(job.Parent, sizeId, isUsTenant);
            foreach (var sibling in job.Parent.InverseParent)
            {
                ApplySize(sibling, sizeId, isUsTenant);
            }
        }
        else
        {
            ApplySize(job, sizeId, isUsTenant);
            if (job.InverseParent == null)
            {
                return;
            }

            foreach (var child in job.InverseParent)
            {
                ApplySize(child, sizeId, isUsTenant);
            }
        }
    }

    // VehicleSize IDs are tenant-local and the standard vs Urgent enums collide
    // (e.g. id 2 is Truck on standard, Car on Urgent), so the tenant decides
    // which enum to interpret the id against. Non-Van / non-Truck sizes leave
    // the legacy flags untouched.
    private static void ApplySize(TucJob job, int sizeId, bool isUsTenant)
    {
        job.UcjbSize = sizeId;

        var truckId = isUsTenant ? (int)VehicleType.Truck : (int)UrgentVehicleType.Truck;
        var vanId = isUsTenant ? (int)VehicleType.Van : (int)UrgentVehicleType.Van;

        if (sizeId == truckId)
        {
            job.Truck = true;
            job.UcjbVan = false;
        }
        else if (sizeId == vanId)
        {
            job.UcjbVan = true;
            job.Truck = false;
        }
    }

    private static void UpdateArchiveJobSize(string value, TucJobArchive job, bool isUsTenant)
    {
        var sizeId = int.Parse(value);
        job.UcjbSize = sizeId;

        var truckId = isUsTenant ? (int)VehicleType.Truck : (int)UrgentVehicleType.Truck;
        var vanId = isUsTenant ? (int)VehicleType.Van : (int)UrgentVehicleType.Van;

        if (sizeId == truckId)
        {
            job.Truck = true;
        }
        else if (sizeId == vanId)
        {
            job.UcjbVan = true;
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
            JobProperty.Size => query.Include(j => j.Parent)
                .ThenInclude(p => p.InverseParent)
                .Include(j => j.InverseParent),
            JobProperty.ClientID => query.Include(j => j.UcjbClient).Include(j => j.InverseParent),
            JobProperty.ContactID => query.Include(j => j.Contact),
            JobProperty.DeliverToLeaveID => query.Include(j => j.DeliverToLeave),
            JobProperty.Delivered => query.Include(j => j.DeliverByTimeZone),
            JobProperty.UndeliverableLocationID => query
                .Include(j => j.UndeliverableLocation)
                .Include(j => j.DeliverByTimeZone),
            JobProperty.NotifiedJobTypeID => query.Include(j => j.NotifiedJobType).Include(j => j.Contact),
            JobProperty.TailLiftPu or JobProperty.TailLiftDo or JobProperty.DeliverToPrivateRes => query.Include(j =>
                j.TucJobItemJobs),
            _ => query
        };
    }

    private static IQueryable<TucJobArchive> AddRequiredArchiveIncludes(IQueryable<TucJobArchive> query,
        JobProperty property) =>
        property switch
        {
            JobProperty.AirportOnly => query.Include(j => j.Nationwide),
            JobProperty.Weight => query.Include(j => j.Parent).Include(j => j.InverseParent),
            JobProperty.ClientID => query.Include(j => j.UcjbClient),
            JobProperty.ContactID => query.Include(j => j.Contact),
            JobProperty.InternalStatusID => query.Include(j => j.InternalStatusNavigation),
            JobProperty.DeliverToLeaveID => query.Include(j => j.DeliverToLeave),
            JobProperty.Delivered => query.Include(j => j.DeliverByTimeZone),
            JobProperty.UndeliverableLocationID => query
                .Include(j => j.UndeliverableLocation)
                .Include(j => j.DeliverByTimeZone),
            JobProperty.NotifiedJobTypeID => query.Include(j => j.NotifiedJobType).Include(j => j.Contact),
            _ => query
        };

    private static IQueryable<TblBulkJob> AddRequiredBulkJobIncludes(
        IQueryable<TblBulkJob> query,
        JobProperty property) =>
        property switch
        {
            JobProperty.ClientID or JobProperty.ClientCode => query.Include(j => j.Client),
            JobProperty.SpeedID => query.Include(j => j.SpeedNavigation),
            JobProperty.DeliverToLeaveID => query.Include(j => j.DeliverToLeave),
            _ => query
        };
}
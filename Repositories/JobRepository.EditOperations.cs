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
        var isUsCustomer = _infoService.IsUsTenant();
        
        var job = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Include(j => j.TucJobNationwides)
            .Include(j => j.UcjbClient)
            .Include(j => j.Contact)
            .Include(j => j.InternalStatusNavigation)
            .Include(j => j.UndeliverableLocation)
            .Include(j => j.InverseParent)
            .Include(j => j.Parent)
            .ThenInclude(j => j.InverseParent)
            .Include(j => j.NotifiedJobType)
            .Include(j => j.UcjbSpeedNavigation)
            .Include(j => j.DeliverToLeave)
            .Include(j => j.UcjbStatusNavigation)
            .Include(j => j.PickupTimeZone).Include(tucJob => tucJob.TucJobItemJobs)
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(job);

        // Internal Status handled separately 
        if (property == JobProperty.InternalStatusID)
        {
            await UpdateJobInternalStatusAsync(job, value);
            return;
        }

        // Update the correct field prop
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
            case JobProperty.Time:
                job.UcjbTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Date:
                job.UcjbDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.Size:
                UpdateJobSize(value, job, isUsCustomer);
                break;
            case JobProperty.Items:
                job.UcjbQty = short.Parse(value);
                break;
            case JobProperty.Void: 
                var voidJob = bool.Parse(value);
                if(voidJob) throw new ApplicationException("Voiding a job is not allowed here");
                job.UcjbVoid = false;
                break;
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID when !job.UcjbJobDone:
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
                job.UcjbClientId = int.Parse(value);
                job.UcjbClientCode = job.UcjbClient.UcclCode;
                break;
            case JobProperty.ClientCode:
                job.UcjbClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case JobProperty.ContactID:
                var contactId = int.Parse(value);
                job.ContactId = contactId;
                job.UcjbContact = job.Contact?.UserName;
                break;
            case JobProperty.Pedal:
                job.UcjbCbd = bool.Parse(value);
                break;
            case JobProperty.Attention:
                job.UcjbAttention = bool.Parse(value);
                break;
            case JobProperty.Reprice:
                job.Reprice = bool.Parse(value);
                break;
            case JobProperty.Truck:
                job.Truck = bool.Parse(value);
                job.UcjbVan = false; // Set van to false when truck is selected
                break;
            case JobProperty.Van:
                job.UcjbVan = bool.Parse(value);
                job.Truck = false; // Set truck to false when a van is selected
                break;
            case JobProperty.VanOK:
                job.VanOk = bool.Parse(value);
                break;
            case JobProperty.Status:
                var newStatus = int.Parse(value);
                job.UcjbStatus = newStatus;

                if (newStatus == (int)JobStatus.PickedUp)
                {
                    job.PickUpTime = _infoService.GetCurrentTimeFromTimeZone(job.PickupTimeZone);
                }

                break;
            case JobProperty.RefA:
                job.UcjbClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.RefB:
                job.UcjbClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case JobProperty.OurRef:
                job.UcjbOurRef = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.FromContactName:
                job.PickupFromContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactName:
                job.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.FromContactPhone:
                job.PickupFromPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactPhone:
                job.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.DeliverToLeaveID:
                var leaveId = int.Parse(value);
                job.DeliverToLeaveId = leaveId;
                job.DeliverToPrivateBusiness = leaveId == 1 ? null : 1;
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
            case JobProperty.CompletedTime:
                job.UcjbComplTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DGClass:
                job.Dgclass = int.Parse(value);
                break;
            case JobProperty.DGDocumentation:
                var dgDoc = bool.Parse(value);
                job.Dgdocument = dgDoc;
                break;
            case JobProperty.TrackingMethod:
                var trackingMethodId = int.Parse(value);
                job.TrackingMethod = trackingMethodId;
                break;
            case JobProperty.Direct:
                job.Direct = bool.Parse(value);
                break;
            case JobProperty.TrackingMobile:
                job.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.TrackingEmail:
                job.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.PODName:
            case JobProperty.PodName:
                job.UcjbPodname = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.Amount:
                job.UcjbAmount = decimal.Parse(value);
                job.RatedManually = true;
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
            case JobProperty.AcceptedJobTypeID:
                job.AcceptedJobTypeId = short.Parse(value);
                break;
            case JobProperty.Locked:
                job.UcjbLocked = bool.Parse(value);
                break;
            case JobProperty.PuTime:
                job.PickUpTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DeliverBy:
                job.DeliverByTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.BookedTime:
                job.UcjbDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.FollowupTime:
                job.FollowupTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.TailLiftPu:
                if(job.TucJobItemJobs == null) throw new NullReferenceException("TucJobItemJobs is null");
                foreach (var item in job.TucJobItemJobs) item.Pu = bool.Parse(value);
                break;
            case JobProperty.TailLiftDo:
                if(job.TucJobItemJobs == null) throw new NullReferenceException("TucJobItemJobs is null");
                foreach (var item in job.TucJobItemJobs) item.Do = bool.Parse(value);
                break; 
            case JobProperty.DeliverToPrivateRes:
                if(job.TucJobItemJobs == null) throw new NullReferenceException("TucJobItemJobs is null");
                foreach (var item in job.TucJobItemJobs) item.PrivateRes = bool.Parse(value);
                break;
            case JobProperty.Barcode:
                job.Barcode = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.DeliverToContact:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.InActiveDate:
            case JobProperty.FirstDue:
            case JobProperty.LastDone:
            case JobProperty.NextDue:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            case JobProperty.InternalStatusID:
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
        var archive = await Context.TucJobArchives
            .Include(j => j.UcjbClient)
            .Include(j => j.Contact)
            .Include(j => j.InternalStatusNavigation)
            .Include(j => j.UndeliverableLocation)
            .Include(j => j.NotifiedJobType)
            .Include(j => j.SpeedNavigation)
            .Include(j => j.DeliverToLeave)
            .Include(j => j.Parent)
            .Include(j => j.InverseParent)
            .Include(j => j.Nationwide)
            .Where(j => j.UcjbId == jobId)
            .FirstOrDefaultAsync();

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
                archive.UcjbSize = short.Parse(value);
                break;
            case JobProperty.Items:
                archive.UcjbQty = short.Parse(value);
                break;
            case JobProperty.Void: 
                var voidJob = bool.Parse(value);
                if(voidJob) throw new ApplicationException("Voiding a job is not allowed here");
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
                archive.UcjbClientId = int.Parse(value);
                archive.UcjbClientCode = archive.UcjbClient.UcclCode;
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
                    (int)InternalJobStatus.AwaitingPod when archive.UcjbStatus != (int)JobStatus.AwaitingPod => (int)JobStatus.AwaitingPod,
                    (int)InternalJobStatus.NewJobs when archive.UcjbStatus != (int)JobStatus.Dispatched => (int)JobStatus.Dispatched,
                    (int)InternalJobStatus.Reprice when archive.UcjbStatus != (int)JobStatus.Completed => (int)JobStatus.Completed,
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
            case JobProperty.FollowupTime:
            case JobProperty.DeliverToContact:
            case JobProperty.StopDate:
            case JobProperty.RestartDate:
            case JobProperty.InActiveDate:
            case JobProperty.FirstDue:
            case JobProperty.LastDone:
            case JobProperty.NextDue:
            case JobProperty.DaysOfWeek:
            case JobProperty.Frequency:
            case JobProperty.HolidayDelivery:
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        // Add additional notes for undeliverable location
        if (property == JobProperty.UndeliverableLocationID && archive.UndeliverableLocation?.Message != null)
            await JobUpdateAddNoteAsync(jobId, false, archive.UndeliverableLocation.Message);

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

    private static void UpdateJobSize(string value, TucJob job, bool isUsCustomer)
    {
        var sizeId = int.Parse(value);
        job.UcjbSize = sizeId;

        if (isUsCustomer && sizeId == (int)VehicleType.Truck || sizeId == (int)UrgentVehicleType.Truck) job.Truck = true;
    }
}
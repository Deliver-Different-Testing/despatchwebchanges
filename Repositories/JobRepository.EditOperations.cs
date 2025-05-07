using System;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    public async Task UpdateDeliverByTime(int jobId, DateTime deliverByTime, int timeZoneId)
    {
        var job = await Context.TucJobs.FindAsync(jobId);
        ArgumentNullException.ThrowIfNull(job);

        var timeZoneInfo = await GetTimeZoneInfoByIdAsync(timeZoneId);

        job.DeliverByTime = TimeZoneInfo.ConvertTimeFromUtc(deliverByTime, timeZoneInfo);
        job.DeliverByTimeZoneId = timeZoneId;

        await Context.SaveChangesAsync();
    }


    public async Task UpdatePickUpTime(int jobId, DateTime pickUpTime, int timeZoneId)
    {
        var job = await Context.TucJobs.FindAsync(jobId);
        ArgumentNullException.ThrowIfNull(job);

        var timeZoneInfo = await GetTimeZoneInfoByIdAsync(timeZoneId);

        job.PickUpTime = TimeZoneInfo.ConvertTimeFromUtc(pickUpTime, timeZoneInfo);
        job.DeliverByTimeZoneId = timeZoneId;
        await Context.SaveChangesAsync();
    }

    private async Task UpdateTucJob(int jobId, JobProperty property, string value)
    {
        var job = await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
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
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(job);

        var updateNote = string.Empty;

        // Update the correct field prop
        switch (property)
        {
            case JobProperty.ConNote:
                if (job.ParentId != null)
                    job.Parent.Connote = value;
                else
                    job.Connote = value;
                break;
            case JobProperty.AirportOnly:
                var airportOnly = bool.Parse(value);
                job.TucJobNationwides.First().UcnwAirportOnly = airportOnly;
                updateNote = $"Changed AirportOnly to {(airportOnly ? "Yes" : "No")}";
                break;
            case JobProperty.Time:
                job.UcjbTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.Date:
                job.UcjbDate = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.Size:
                job.UcjbSize = int.Parse(value);
                updateNote = $"Changed Size to {job.UcjbSize}";
                break;
            case JobProperty.Items:
                job.UcjbQty = short.Parse(value);
                break;
            case JobProperty.SpeedID:
                job.UcjbSpeed = short.Parse(value);
                updateNote = $"Changed Speed to {job.UcjbSpeedNavigation?.UcjtName}";
                break;
            case JobProperty.AcceptedJobTypeID when !job.UcjbJobDone:
                job.UcjbSpeed = short.Parse(value);
                break;
            case JobProperty.Weight:
                var weight = short.Parse(value);

                // Update parent job if it exists
                if (job.ParentId != null)
                {
                    job.Parent.UcjbWeight = weight;

                    // Update all other child jobs of the parent
                    if (job.Parent.InverseParent.Count != 0)
                    {
                        foreach (var siblingJob in job.Parent.InverseParent)
                            siblingJob.UcjbWeight = weight;
                    }
                }
                // If no parent, update this job and its children
                else
                {
                    // Update current job
                    job.UcjbWeight = weight;

                    // Update child jobs
                    if (job.InverseParent != null && job.InverseParent.Count != 0)
                    {
                        foreach (var childJob in job.InverseParent)
                            childJob.UcjbWeight = weight;
                    }
                }

                break;
            case JobProperty.ClientID:
                job.UcjbClientId = int.Parse(value);
                job.UcjbClientCode = job.UcjbClient.UcclCode;
                updateNote = $"Changed Client to {job.UcjbClient?.UcclCode}";
                break;
            case JobProperty.ClientCode:
                job.UcjbClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case JobProperty.ContactID:
                var contactId = int.Parse(value);
                job.ContactId = contactId;
                job.UcjbContact = job.Contact?.UserName;
                updateNote = $"Changed Contact to {job.Contact?.UserName}";
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
                job.Truck = false; // Set truck to false when van is selected
                break;
            case JobProperty.VanOK:
                job.VanOk = bool.Parse(value);
                break;
            case JobProperty.InternalStatusID:
                var internalStatusId = int.Parse(value);
                job.InternalStatus = internalStatusId;

                // Handle followup time
                if (!new[]
                    {
                        (int)InternalJobStatus.NewJobs,
                        (int)InternalJobStatus.Reprice
                    }.Contains(internalStatusId))
                {
                    // Safely handle DefaultMinutes when InternalStatusNavigation is null
                    var defaultMinutes = job.InternalStatusNavigation?.DefaultMinutes ?? 0;
                    job.FollowupTime = _infoService.GetCurrentTenantTime().AddMinutes(defaultMinutes);
                }
                else
                {
                    job.FollowupTime = null;
                }

                job.UcjbStatus = internalStatusId switch
                {
                    // Handle status changes
                    3 when job.UcjbStatus != 9 => 9,
                    1 when job.UcjbStatus != 1 => 1,
                    4 when job.UcjbStatus != 6 => 6,
                    _ => job.UcjbStatus
                };

                // Safely handle TcisName when InternalStatusNavigation is null
                updateNote = job.InternalStatusNavigation != null
                    ? $"Changed Job Follow Up to {job.InternalStatusNavigation.TcisName}"
                    : $"Changed Job Follow Up to status {internalStatusId}";
                break;
            case JobProperty.Status:
                job.UcjbStatus = int.Parse(value);
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
                updateNote = $"Changed Leave Parcel to {job.DeliverToLeave?.Name}";
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
                updateNote = $"Changed Undeliverable Location to {job.UndeliverableLocation?.Name}";
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
                job.UcjbComplTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.DGClass:
                job.Dgclass = int.Parse(value);
                break;
            case JobProperty.DGDocumentation:
                var dgDoc = bool.Parse(value);
                job.Dgdocument = dgDoc;
                updateNote = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                break;
            case JobProperty.TrackingMethod:
                var trackingMethodId = int.Parse(value);
                job.TrackingMethod = trackingMethodId;
                updateNote = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
                break;
            case JobProperty.Direct:
                job.Direct = bool.Parse(value);
                break;
            case JobProperty.Void:
                job.UcjbVoid = bool.Parse(value);
                updateNote = "Job marked as void";
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
                job.PickUpTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.DeliverBy:
                job.DeliverByTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.BookedTime:
                job.UcjbDate = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.FollowupTime:
                job.FollowupTime = _infoService.ConvertUtcToTenantTime(value);
                updateNote = $"Followup Time updated to {job.FollowupTime:dd/MM/yyyy HH:mm}";
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        if (!string.IsNullOrEmpty(updateNote))
            await SaveNoteAsync(jobId, updateNote);

        // Add additional notes for undeliverable location
        if (property == JobProperty.UndeliverableLocationID && job.UndeliverableLocation?.Message != null)
            await SaveNoteAsync(jobId, job.UndeliverableLocation.Message);

        Context.TucJobs.Update(job);
        await Context.SaveChangesAsync();
    }

    private async Task UpdateTucJobArchive(int jobId, JobProperty property, string value)
    {
        var archive = await Context
            .TucJobArchives.Join(
                Context.TucClients,
                job => job.UcjbClientId,
                client => client.UcclId,
                (job, client) => new { job, client }
            )
            .Join(
                Context.TucClientContacts,
                j => j.job.ContactId,
                contact => contact.UcctId,
                (j, contact) =>
                    new
                    {
                        j.job,
                        j.client,
                        contact
                    }
            )
            .Join(
                Context.TucJobInternalStatuses,
                j => j.job.InternalStatus,
                status => status.Tcis,
                (j, status) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        status
                    }
            )
            .Join(
                Context.TblUndeliverableLocations,
                j => j.job.UndeliverableLocationId,
                loc => loc.UndeliverableLocationId,
                (j, loc) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        loc
                    }
            )
            .Join(
                Context.TucJobTypes,
                j => j.job.NotifiedJobTypeId,
                type => type.UcjtId,
                (j, type) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        type
                    }
            )
            .Join(
                Context.TucJobTypes,
                j => j.job.UcjbSpeed,
                speed => speed.UcjtId,
                (j, speed) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        speed
                    }
            )
            .Join(
                Context.TblJobLeaveNotHomes,
                j => j.job.DeliverToLeaveId,
                leave => leave.LeaveNotHomeId,
                (j, leave) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        j.speed,
                        leave
                    }
            )
            .GroupJoin(
                Context.TucJobArchives,
                j => j.job.ParentId,
                parent => parent.UcjbId,
                (j, parent) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        j.speed,
                        j.leave,
                        parent
                    }
            )
            .Select(j => new
            {
                j.job,
                j.client,
                j.contact,
                j.status,
                j.loc,
                j.type,
                j.speed,
                j.leave,
                parent = j.parent.FirstOrDefault(),
                parentId = j.parent.Select(p => p.UcjbId).FirstOrDefault()
            })
            .GroupJoin(
                Context.TucJobArchives,
                j => j.parentId == 0 ? j.job.UcjbId : j.parentId,
                child => child.ParentId,
                (j, children) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        j.speed,
                        j.leave,
                        j.parent,
                        children
                    }
            )
            .GroupJoin(
                Context.TucJobNationwides,
                j => j.job.UcjbId,
                nationwide => nationwide.UcnwJobId,
                (j, nationwide) =>
                    new
                    {
                        Job = j.job,
                        UcjbClient = j.client,
                        Contact = j.contact,
                        InternalStatusNavigation = j.status,
                        UndeliverableLocation = j.loc,
                        NotifiedJobType = j.type,
                        SpeedNavigation = j.speed,
                        DeliverToLeave = j.leave,
                        Parent = j.parent,
                        InverseParent = j.children,
                        Nationwide = nationwide.FirstOrDefault()
                    }
            )
            .Where(j => j.Job.UcjbId == jobId)
            .FirstOrDefaultAsync();

        if (archive == null)
            throw new ArgumentException("Job not found");

        var updateNote = string.Empty;

        // Update the correct field prop
        switch (property)
        {
            case JobProperty.ConNote:
                archive.Job.Connote = value;
                break;
            case JobProperty.AirportOnly:
                var airportOnly = bool.Parse(value);
                archive.Nationwide.UcnwAirportOnly = airportOnly;
                updateNote = $"Changed AirportOnly to {(airportOnly ? "Yes" : "No")}";
                break;
            case JobProperty.Time:
                archive.Job.UcjbTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.Date:
                archive.Job.UcjbDate = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.Size:
                archive.Job.UcjbSize = short.Parse(value);
                break;
            case JobProperty.Items:
                archive.Job.UcjbQty = short.Parse(value);
                break;
            case JobProperty.SpeedID:
                archive.Job.UcjbSpeed = short.Parse(value);
                updateNote = $"Changed Speed to {archive.SpeedNavigation?.UcjtName}";
                break;
            case JobProperty.AcceptedJobTypeID when !archive.Job.UcjbJobDone:
                archive.Job.UcjbSpeed = short.Parse(value);
                break;
            case JobProperty.Weight:
                var weight = float.Parse(value);
                if (archive.Job.ParentId != null)
                {
                    archive.Parent.UcjbWeight = weight;

                    // Update all sibling jobs (including current job)
                    if (archive.InverseParent.Any())
                    {
                        foreach (var siblingJob in archive.InverseParent)
                        {
                            siblingJob.UcjbWeight = weight;
                        }
                    }
                }
                else
                {
                    // This is a parent job, update it and all its children
                    archive.Job.UcjbWeight = weight;
                    if (archive.InverseParent.Any())
                    {
                        foreach (var childJob in archive.InverseParent)
                        {
                            childJob.UcjbWeight = weight;
                        }
                    }
                }

                break;
            case JobProperty.ClientID:
                archive.Job.UcjbClientId = int.Parse(value);
                archive.Job.UcjbClientCode = archive.UcjbClient.UcclCode;
                updateNote = $"Changed Client to {archive.UcjbClient?.UcclCode}";
                break;
            case JobProperty.ClientCode:
                archive.Job.UcjbClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case JobProperty.ContactID:
                var contactId = int.Parse(value);
                archive.Job.ContactId = contactId;
                archive.Job.UcjbContact = archive.Contact.UserName;
                break;
            case JobProperty.Pedal:
                archive.Job.UcjbCbd = bool.Parse(value);
                break;
            case JobProperty.Attention:
                archive.Job.UcjbAttention = bool.Parse(value);
                break;
            case JobProperty.Reprice:
                archive.Job.Reprice = bool.Parse(value);
                break;
            case JobProperty.Truck:
                archive.Job.Truck = bool.Parse(value);
                archive.Job.UcjbVan = false; // Set van to false when truck is selected
                break;
            case JobProperty.Van:
                archive.Job.UcjbVan = bool.Parse(value);
                archive.Job.Truck = false; // Set truck to false when van is selected
                break;
            case JobProperty.VanOK:
                archive.Job.VanOk = bool.Parse(value);
                break;
            case JobProperty.InternalStatusID:
                var internalStatusId = int.Parse(value);
                archive.Job.InternalStatus = internalStatusId;

                // Handle followup time
                if (
                    !new[]
                    {
                        (int)InternalJobStatus.NewJobs,
                        (int)InternalJobStatus.Reprice
                    }.Contains(internalStatusId)
                )
                    archive.Job.FollowupTime = _infoService.GetCurrentTenantTime().AddMinutes(
                        archive.InternalStatusNavigation.DefaultMinutes ?? 0
                    );
                else
                    archive.Job.FollowupTime = null;

                archive.Job.UcjbStatus = internalStatusId switch
                {
                    // Handle status changes
                    3 when archive.Job.UcjbStatus != 9 => 9,
                    1 when archive.Job.UcjbStatus != 1 => 1,
                    4 when archive.Job.UcjbStatus != 6 => 6,
                    _ => archive.Job.UcjbStatus
                };
                updateNote =
                    $"Changed Job Follow Up to {archive.InternalStatusNavigation.TcisName}";
                break;
            case JobProperty.Status:
                archive.Job.UcjbStatus = int.Parse(value);
                break;
            case JobProperty.RefA:
                archive.Job.UcjbClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.RefB:
                archive.Job.UcjbClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case JobProperty.OurRef:
                archive.Job.UcjbOurRef = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.FromContactName:
                archive.Job.PickUpFromContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactName:
                archive.Job.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.FromContactPhone:
                archive.Job.PickUpFromPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactPhone:
                archive.Job.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.DeliverToLeaveID:
                var leaveId = int.Parse(value);
                archive.Job.DeliverToLeaveId = leaveId;
                archive.Job.DeliverToPrivateBusiness = leaveId == 1 ? null : 1;
                updateNote = $"Changed Leave Parcel to {archive.DeliverToLeave?.Name}";
                break;
            case JobProperty.UndeliverableLocationID:
                archive.Job.UndeliverableLocationId = int.Parse(value);
                archive.Job.UcjbStatus = (int)JobStatus.Undeliverable;
                archive.Job.UcjbJobDone = true;
                archive.Job.UcjbComplTime = _infoService.GetCurrentTenantTime();
                archive.Job.UcjbPodname =
                    archive.UndeliverableLocation != null
                        ? archive.UndeliverableLocation.Podname
                        : string.Empty;
                updateNote =
                    $"Changed Undeliverable Location to {archive.UndeliverableLocation?.Name}";
                break;
            case JobProperty.Delivered:
                var delivered = bool.Parse(value);
                archive.Job.UcjbJobDone = delivered;
                if (delivered)
                {
                    archive.Job.UcjbStatus = 6;
                    archive.Job.UcjbComplTime = _infoService.GetCurrentTenantTime();
                }

                break;
            case JobProperty.CompletedTime:
                archive.Job.UcjbComplTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.DGClass:
                archive.Job.Dgclass = int.Parse(value);
                break;
            case JobProperty.DGDocumentation:
                var dgDoc = bool.Parse(value);
                archive.Job.Dgdocument = dgDoc;
                updateNote = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                break;
            case JobProperty.TrackingMethod:
                var trackingMethodId = int.Parse(value);
                archive.Job.TrackingMethod = trackingMethodId;
                updateNote = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
                break;
            case JobProperty.Direct:
                archive.Job.Direct = bool.Parse(value);
                break;
            case JobProperty.Void:
                archive.Job.UcjbVoid = bool.Parse(value);
                break;
            case JobProperty.TrackingMobile:
                archive.Job.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.TrackingEmail:
                archive.Job.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.PODName:
            case JobProperty.PodName:
                archive.Job.UcjbPodname = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.Amount:
                archive.Job.UcjbAmount = decimal.Parse(value);
                break;
            case JobProperty.NotifiedJobTypeID:
                var notifiedJobTypeId = short.Parse(value);
                archive.Job.NotifiedJobTypeId = notifiedJobTypeId;

                if (
                    notifiedJobTypeId > archive.Job.NotifiedJobTypeId
                    && archive.Job.ContactId != null
                    && archive.NotifiedJobType.UcjtName == "Email"
                    && archive.Contact?.HasEmail == true
                    && !string.IsNullOrEmpty(archive.Contact.UcctEmail)
                )
                {
                    archive.Job.SpeedChangeNotificationHasBeenSent = false;
                    archive.Job.WhenSpeedChangeNotificationSent = null;
                }
                else
                {
                    archive.Job.SpeedChangeNotificationHasBeenSent = true;
                }

                break;
            case JobProperty.AcceptedJobTypeID:
                archive.Job.AcceptedJobTypeId = short.Parse(value);
                break;
            case JobProperty.Locked:
                archive.Job.UcjbLocked = int.Parse(value);
                break;
            case JobProperty.PuTime:
                archive.Job.PickUpTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.DeliverBy:
                archive.Job.DeliverByTime = _infoService.ConvertUtcToTenantTime(value);
                break;
            case JobProperty.BookedTime:
                archive.Job.UcjbDate = _infoService.ConvertUtcToTenantTime(value);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        if (!string.IsNullOrEmpty(updateNote)) await SaveNoteAsync(jobId, updateNote);

        // Add additional notes for undeliverable location
        if (property == JobProperty.UndeliverableLocationID && archive.UndeliverableLocation?.Message != null)
            await SaveNoteAsync(jobId, archive.UndeliverableLocation.Message);

        Context.Update(archive.Job);
        await Context.SaveChangesAsync();
    }
}

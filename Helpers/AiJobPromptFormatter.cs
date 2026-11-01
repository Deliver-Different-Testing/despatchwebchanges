using System.Globalization;
using System.Text;
using DespatchWeb.Models;
using DespatchWeb.Models.Ai;

namespace DespatchWeb.Helpers;

/// <summary>Renders job data into the prompt text shared by the Auto-mate briefings and chat tools.</summary>
public static class AiJobPromptFormatter
{
    private const int MaxNotesInPrompt = 25;
    private const int MaxEventsInPrompt = 25;

    public static void AppendSignalLines(StringBuilder sb, JobSignals signals)
    {
        if (signals.Items.Count == 0)
        {
            sb.AppendLine("SIGNAL [OK]: no problem signals detected");
            sb.AppendLine();
            return;
        }
        foreach (var line in signals.Lines)
        {
            sb.AppendLine(line);
        }
        sb.AppendLine();
    }

    public static void AppendNotes(StringBuilder sb, IReadOnlyList<TucNoteViewModel> notes)
    {
        if (notes is not { Count: > 0 })
        {
            return;
        }

        sb.AppendLine($"--- Notes ({notes.Count}{(notes.Count > MaxNotesInPrompt ? ", most recent first" : "")}) ---");
        var ordered = notes.OrderByDescending(n => n.CreatedDate).Take(MaxNotesInPrompt).ToList();
        foreach (var note in ordered.OrderBy(n => n.CreatedDate))
        {
            var sanitized = AiDataSanitizer.SanitizeUntrusted(note.NoteText ?? string.Empty);
            var important = note.IsImportant ? " IMPORTANT" : string.Empty;
            sb.AppendLine($"[{note.CreatedDate:yyyy-MM-dd HH:mm}] ({note.NoteTypeName}{important}) by {note.CreatedByName}: {sanitized}");
        }
        if (notes.Count > MaxNotesInPrompt)
        {
            sb.AppendLine($"... ({notes.Count - MaxNotesInPrompt} older notes omitted)");
        }
        sb.AppendLine();
    }

    public static void AppendEvents(StringBuilder sb, IReadOnlyList<TaskViewModel> events)
    {
        if (events is not { Count: > 0 })
        {
            return;
        }

        sb.AppendLine($"--- Events / tasks ({events.Count}) ---");
        var ordered = events.OrderByDescending(e => e.DueDate).Take(MaxEventsInPrompt).ToList();
        foreach (var evt in ordered.OrderBy(e => e.DueDate))
        {
            var status = evt.Closed ? "CLOSED" : "OPEN";
            var sanitized = AiDataSanitizer.SanitizeUntrusted(evt.Description ?? evt.Title ?? string.Empty);
            sb.AppendLine($"[{evt.DueDate:yyyy-MM-dd HH:mm}] {evt.EventType} - {sanitized} [{status}]");
        }
        if (events.Count > MaxEventsInPrompt)
        {
            sb.AppendLine($"... ({events.Count - MaxEventsInPrompt} older events omitted)");
        }
        sb.AppendLine();
    }

    public static void AppendJobDetails(StringBuilder sb, JobViewModel job)
    {
        sb.AppendLine("--- Job details ---");
        sb.AppendLine($"Job No: {job.JobNo}");
        sb.AppendLine($"Status: {job.Status ?? job.StatusName ?? "?"}");
        if (!string.IsNullOrWhiteSpace(job.SpeedName))
        {
            sb.AppendLine($"Speed: {job.SpeedName}");
        }

        if (!string.IsNullOrWhiteSpace(job.ClientName))
        {
            sb.AppendLine($"Client: {job.ClientName}");
        }
        else if (!string.IsNullOrWhiteSpace(job.Client))
        {
            sb.AppendLine($"Client: {job.Client}");
        }

        if (!string.IsNullOrWhiteSpace(job.Courier))
        {
            sb.AppendLine($"Courier: {job.Courier}");
        }
        else if (!string.IsNullOrWhiteSpace(job.AssignedCourier?.Text))
        {
            sb.AppendLine($"Courier: {job.AssignedCourier.Text}");
        }

        if (!string.IsNullOrWhiteSpace(job.PartnerTenantName))
        {
            sb.AppendLine($"Partner tenant: {job.PartnerTenantName}");
        }

        // Booleans of interest
        var flags = new List<string>();
        if (job.Done == true)
        {
            flags.Add("done");
        }

        if (job.Void == true)
        {
            flags.Add("void");
        }

        if (job.IsArchived)
        {
            flags.Add("archived");
        }

        if (job.Reprice == true)
        {
            flags.Add("reprice");
        }

        if (job.Locked == true)
        {
            flags.Add("locked");
        }

        if (job.Attention == true)
        {
            flags.Add("attention");
        }

        if (job.IsBulkJob)
        {
            flags.Add("bulk");
        }

        if (job.PreBook == true)
        {
            flags.Add("recurring");
        }

        if (job.IsPartnerJob)
        {
            flags.Add("partner");
        }

        if (job.Direct == true)
        {
            flags.Add("direct");
        }

        if (job.Truck == true)
        {
            flags.Add("truck");
        }

        if (job.Van)
        {
            flags.Add("van");
        }

        if (job.TailLiftPu)
        {
            flags.Add("tail-lift PU");
        }

        if (job.TailLiftDo)
        {
            flags.Add("tail-lift DO");
        }

        if (job.DeliverToPrivateRes)
        {
            flags.Add("private residence");
        }

        if (flags.Count > 0)
        {
            sb.AppendLine("Flags: " + string.Join(", ", flags));
        }

        // Addresses
        var fromAddr = AiDataSanitizer.Sanitize(job.PickupAddress?.FullAddress ?? job.From ?? "");
        var toAddr = AiDataSanitizer.Sanitize(job.DeliveryAddress?.FullAddress ?? job.ToAddress ?? "");
        if (!string.IsNullOrWhiteSpace(fromAddr))
        {
            sb.AppendLine($"From: {fromAddr}");
        }

        if (!string.IsNullOrWhiteSpace(toAddr))
        {
            sb.AppendLine($"To:   {toAddr}");
        }

        if (!string.IsNullOrWhiteSpace(job.PickUpTimeZone?.Text))
        {
            sb.AppendLine($"Pickup TZ: {job.PickUpTimeZone.Text}");
        }

        if (!string.IsNullOrWhiteSpace(job.DeliveryTimeZone?.Text))
        {
            sb.AppendLine($"Delivery TZ: {job.DeliveryTimeZone.Text}");
        }

        if (job.Distance > 0)
        {
            sb.AppendLine($"Distance: {job.Distance:N1}");
        }

        // Contacts (sanitised)
        if (!string.IsNullOrWhiteSpace(job.FromContactName))
        {
            sb.AppendLine($"PU contact: {job.FromContactName}");
        }

        if (!string.IsNullOrWhiteSpace(job.FromContactNumber))
        {
            sb.AppendLine($"PU phone: {AiDataSanitizer.Sanitize(job.FromContactNumber)}");
        }

        if (!string.IsNullOrWhiteSpace(job.DeliverToContact))
        {
            sb.AppendLine($"DO contact: {job.DeliverToContact}");
        }

        if (!string.IsNullOrWhiteSpace(job.ToContactPhone))
        {
            sb.AppendLine($"DO phone: {AiDataSanitizer.Sanitize(job.ToContactPhone)}");
        }

        // Schedule
        if (job.Booked.HasValue)
        {
            sb.AppendLine($"Booked:        {job.Booked:yyyy-MM-dd HH:mm}");
        }

        if (job.CreatedDate.HasValue)
        {
            sb.AppendLine($"Created:       {job.CreatedDate:yyyy-MM-dd HH:mm}");
        }

        if (job.DispatchTime.HasValue)
        {
            sb.AppendLine($"Dispatched:    {job.DispatchTime:yyyy-MM-dd HH:mm}");
        }

        if (job.PuTime.HasValue)
        {
            sb.AppendLine($"PU scheduled:  {job.PuTime:yyyy-MM-dd HH:mm}");
        }

        if (job.PickupArrivalTime.HasValue)
        {
            sb.AppendLine($"PU arrived:    {job.PickupArrivalTime:yyyy-MM-dd HH:mm}");
        }

        if (job.DeliverByTime.HasValue)
        {
            sb.AppendLine($"Deliver by:    {job.DeliverByTime:yyyy-MM-dd HH:mm}");
        }

        if (job.DeliveryArrivalTime.HasValue)
        {
            sb.AppendLine($"DO arrived:    {job.DeliveryArrivalTime:yyyy-MM-dd HH:mm}");
        }

        if (job.CompletedTime.HasValue)
        {
            sb.AppendLine($"Completed:     {job.CompletedTime:yyyy-MM-dd HH:mm}");
        }

        if (job.FollowupTime.HasValue)
        {
            sb.AppendLine($"Follow-up:     {job.FollowupTime:yyyy-MM-dd HH:mm}");
        }

        // Parcel
        if (job.Size?.Text is { Length: > 0 } size)
        {
            sb.AppendLine($"Size: {size}");
        }

        if (job.Weight is > 0)
        {
            sb.AppendLine($"Weight: {job.Weight}");
        }

        if (job.Items > 0)
        {
            sb.AppendLine($"Items: {job.Items}");
        }

        if (job.ParcelDimensions is { Count: > 0 } pd)
        {
            sb.AppendLine($"Parcel dimension rows: {pd.Count}");
        }

        if (job.DgClass is > 0)
        {
            sb.AppendLine($"DG class: {job.DgClass}");
        }

        if (job.DgDocumentation == true)
        {
            sb.AppendLine("DG documentation: yes");
        }

        if (!string.IsNullOrWhiteSpace(job.SigNotRequired))
        {
            sb.AppendLine($"Leave/sig: {job.SigNotRequired}");
        }

        if (!string.IsNullOrWhiteSpace(job.Barcode))
        {
            sb.AppendLine($"Barcode: {job.Barcode}");
        }

        // Pallets
        if (job.PalletInfo is { Count: > 0 } pallets)
        {
            var totalQty = pallets.Sum(p => p.Quantity);
            var totalWeight = pallets.Sum(p => p.Weight);
            sb.AppendLine($"Pallets: {pallets.Count} row(s), total qty {totalQty}, total weight {totalWeight.ToString("N1", CultureInfo.InvariantCulture)}");
        }

        // References / pricing
        if (!string.IsNullOrWhiteSpace(job.RefA))
        {
            sb.AppendLine($"Ref A: {job.RefA}");
        }

        if (!string.IsNullOrWhiteSpace(job.RefB))
        {
            sb.AppendLine($"Ref B: {job.RefB}");
        }

        if (!string.IsNullOrWhiteSpace(job.OurRef))
        {
            sb.AppendLine($"Our Ref: {job.OurRef}");
        }

        if (!string.IsNullOrWhiteSpace(job.ConNote))
        {
            sb.AppendLine($"Con Note: {job.ConNote}");
        }

        if (!string.IsNullOrWhiteSpace(job.CustomJobName))
        {
            sb.AppendLine($"Custom name: {job.CustomJobName}");
        }

        if (job.Charge.HasValue)
        {
            sb.AppendLine($"Charge: {job.Charge.Value.ToString("N2", CultureInfo.InvariantCulture)}");
        }

        // Flight
        if (job.IsFlightAssigned && job.AssignedFlight != null)
        {
            sb.AppendLine($"Flight: {job.AssignedFlight.FlightNumber}");
            if (job.AssignedFlight.ExpectedDeparture.HasValue)
            {
                sb.AppendLine($"  expected departure: {job.AssignedFlight.ExpectedDeparture:yyyy-MM-dd HH:mm}");
            }

            if (job.AssignedFlight.ExpectedArrival.HasValue)
            {
                sb.AppendLine($"  expected arrival:   {job.AssignedFlight.ExpectedArrival:yyyy-MM-dd HH:mm}");
            }

            if (job.AssignedFlight.FlightSegments?.Count > 0)
            {
                sb.AppendLine($"  segments: {job.AssignedFlight.FlightSegments.Count}");
            }
        }

        // Agent
        if (job.IsAgentAssigned && job.AssignedAgent != null)
        {
            sb.AppendLine($"Agent: {job.AssignedAgent.AgentName}");
        }

        sb.AppendLine();
    }
}

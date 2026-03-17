// Replace the existing SplitJob action in JobController.cs (~line 1084) with:

[HttpPost]
public async Task<IActionResult> SplitJob([FromBody] SplitJobRequest request)
{
    try
    {
        var staffInfo = await infoService.GetStaffInfoAsync();
        await splitJobService.SplitJobAsync(
            request.JobId,
            staffInfo.Text,
            request.MeetingPointAddress,
            request.CourierIdForLegB);
        return Ok();
    }
    catch (Exception e)
    {
        Log.Error(e, "{Message}", ErrorMessageStringFormatter.Format(e));
        return StatusCode(500, ErrorMessageStringFormatter.Format(e));
    }
}

namespace DespatchWeb.Models.Dto;

public sealed record ManualMessageDto
{
    public int MessageId { get; init; }
    public string Subject { get; init; }
    public DateTime UcmmDate { get; init; }
    public string UcmmMessage { get; init; }
    public int? UcmmSendToCourierId { get; init; }
    public int? UcmmSendToStaffId { get; init; }
    public string SendToEmailAddress { get; init; }
    public string SendToMobile { get; init; }
    public DateTime? TimeRead { get; init; }
    
    // Send To Courier
    public string SendToCourierName { get; init; }
    public string SendToCourierSurname { get; init; }
    
    // Send To Staff
    public string SendToStaffFirstName { get; init; }
    public string SendToStaffLastName { get; init; }
    
    // Send From Courier
    public string SendFromCourierName { get; init; }
    public string SendFromCourierSurname { get; init; }
    
    // Send From Staff
    public string SendFromStaffFirstName { get; init; }
    public string SendFromStaffLastName { get; init; }
}

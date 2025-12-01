using System;

namespace DespatchWeb.Models.Dto;

public class ManualMessageDto
{
    public int MessageId { get; set; }
    public string Subject { get; set; }
    public DateTime UcmmDate { get; set; }
    public string UcmmMessage { get; set; }
    public int? UcmmSendToCourierId { get; set; }
    public int? UcmmSendToStaffId { get; set; }
    public string SendToEmailAddress { get; set; }
    public string SendToMobile { get; set; }
    public DateTime? TimeRead { get; set; }
    
    // Send To Courier
    public string SendToCourierName { get; set; }
    public string SendToCourierSurname { get; set; }
    
    // Send To Staff
    public string SendToStaffFirstName { get; set; }
    public string SendToStaffLastName { get; set; }
    
    // Send From Courier
    public string SendFromCourierName { get; set; }
    public string SendFromCourierSurname { get; set; }
    
    // Send From Staff
    public string SendFromStaffFirstName { get; set; }
    public string SendFromStaffLastName { get; set; }
}

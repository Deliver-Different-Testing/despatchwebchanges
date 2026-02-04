using System;

namespace DespatchWeb.Models.Dto;

public class DisplayOrderDto
{
    public int CourierId { get; set; }
    public int? Status { get; set; }
    public DateTime? OrderTime { get; set; }
}

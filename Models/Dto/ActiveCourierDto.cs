using System;

namespace DespatchWeb.Models.Dto;

public class ActiveCourierDto
{
    public int CourierId { get; set; }
    public string Code { get; set; }
    public string Name { get; set; }
    public bool DangerousGoods { get; set; }
    public DateTime? DgLicenseExpiry { get; set; }
    public int JobCount { get; set; }
}

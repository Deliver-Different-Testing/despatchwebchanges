#nullable disable
using System;
using System.Collections.Generic;

namespace DespatchWeb.EntityClasses;

// Minimal mappings of the Accounts-owned courier adjustment tables. DespatchWeb only
// inserts these for inter-courier charges; invoice/settlement columns are left to Accounts.

public class DeductionType
{
    public int Id { get; set; }
    public string Name { get; set; }
    public bool IsActive { get; set; }
}

public class ExtraPaymentType
{
    public int Id { get; set; }
    public string Name { get; set; }
    public bool IsActive { get; set; }
}

public class CourierDeduction
{
    public long Id { get; set; }
    public DateTime Created { get; set; }
    public int CourierId { get; set; }
    public string Reference { get; set; }
    public DateTime Date { get; set; }
    public virtual ICollection<CourierDeductionLine> CourierDeductionLines { get; set; } = new List<CourierDeductionLine>();
}

public class CourierDeductionLine
{
    public long Id { get; set; }
    public DateTime Created { get; set; }
    public long DeductionId { get; set; }
    public int DeductionTypeId { get; set; }
    public string Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}

public class CourierExtraPayment
{
    public long Id { get; set; }
    public DateTime Created { get; set; }
    public int CourierId { get; set; }
    public string Reference { get; set; }
    public DateTime Date { get; set; }
    public virtual ICollection<CourierExtraPaymentLine> CourierExtraPaymentLines { get; set; } = new List<CourierExtraPaymentLine>();
}

public class CourierExtraPaymentLine
{
    public long Id { get; set; }
    public DateTime Created { get; set; }
    public long CourierExtraPaymentId { get; set; }
    public int ExtraPaymentTypeId { get; set; }
    public string Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}

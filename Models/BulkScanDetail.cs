using System;

namespace DespatchWeb.Models;

public class BulkScanDetail
{
    public int BulkScanId { get; set; }
    public DateTime ScanDateTime { get; set; }
    public string ScanDetail { get; set; }
    public string Courier { get; set; }
}

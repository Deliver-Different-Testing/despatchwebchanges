namespace DespatchWeb.EntityClasses
{
    public partial class TucJobStatus
    {
        public int UcjsId { get; set; }
        public string? UcjsReplyCode { get; set; }
        public string UcjsName { get; set; } = null!;
        public string? UcjsCode { get; set; }
    }
}
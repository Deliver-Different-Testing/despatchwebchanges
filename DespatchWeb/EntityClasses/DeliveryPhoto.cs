namespace DespatchWeb.EntityClasses
{
    public partial class DeliveryPhoto
    {
        public int DeliveryPhotoId { get; set; }
        public int JobId { get; set; }
        public byte[] Photo { get; set; } = null!;
    }
}
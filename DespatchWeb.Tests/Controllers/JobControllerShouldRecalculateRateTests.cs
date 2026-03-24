using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using Xunit;

namespace DespatchWeb.Tests.Controllers
{
    public class JobControllerShouldRecalculateRateTests
    {
        [Theory]
        [InlineData(JobProperty.AirportOnly)]
        [InlineData(JobProperty.Date)]
        [InlineData(JobProperty.Size)]
        [InlineData(JobProperty.Items)]
        [InlineData(JobProperty.SpeedID)]
        [InlineData(JobProperty.AcceptedJobTypeID)]
        [InlineData(JobProperty.Weight)]
        [InlineData(JobProperty.ClientID)]
        [InlineData(JobProperty.Pedal)]
        [InlineData(JobProperty.Reprice)]
        [InlineData(JobProperty.Truck)]
        [InlineData(JobProperty.Van)]
        [InlineData(JobProperty.DGClass)]
        [InlineData(JobProperty.DGDocumentation)]
        [InlineData(JobProperty.Direct)]
        [InlineData(JobProperty.BookedTime)]
        [InlineData(JobProperty.TailLiftPu)]
        [InlineData(JobProperty.TailLiftDo)]
        [InlineData(JobProperty.DeliverToPrivateRes)]
        public void ShouldRecalculateRate_RateAffectingProperty_ReturnsTrue(JobProperty property)
        {
            Assert.True(JobController.ShouldRecalculateRate(property));
        }

        [Theory]
        [InlineData(JobProperty.ConNote)]
        [InlineData(JobProperty.Time)]
        [InlineData(JobProperty.ClientCode)]
        [InlineData(JobProperty.ContactID)]
        [InlineData(JobProperty.Attention)]
        [InlineData(JobProperty.VanOK)]
        [InlineData(JobProperty.InternalStatusID)]
        [InlineData(JobProperty.Status)]
        [InlineData(JobProperty.RefA)]
        [InlineData(JobProperty.RefB)]
        [InlineData(JobProperty.OurRef)]
        [InlineData(JobProperty.Void)]
        [InlineData(JobProperty.Barcode)]
        [InlineData(JobProperty.CourierId)]
        public void ShouldRecalculateRate_NonRateAffectingProperty_ReturnsFalse(JobProperty property)
        {
            Assert.False(JobController.ShouldRecalculateRate(property));
        }
    }
}

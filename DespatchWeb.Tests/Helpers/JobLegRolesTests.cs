using DespatchWeb.Helpers;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Leg roles exist only as a job-number suffix convention, so this parser is the single place that
/// convention is interpreted in C#. It decides when a family is finished, so a mis-read suffix would
/// complete a movement before its final-mile delivery ran.
/// </summary>
[TestSubject(typeof(JobLegRoles))]
public class JobLegRolesTests
{
    [Theory]
    [InlineData("KT2103CRTLHP", JobLegRole.LinehaulPickup)]
    [InlineData("kt2103crtlhp", JobLegRole.LinehaulPickup)]
    [InlineData("KT2103CRTDEL", JobLegRole.FinalMileDelivery)]
    [InlineData("KT2103CRTLH1", JobLegRole.Linehaul)]
    [InlineData("KT2103CRTLH12", JobLegRole.Linehaul)]
    [InlineData("KT2103CRT", JobLegRole.None)]
    [InlineData("", JobLegRole.None)]
    [InlineData(null, JobLegRole.None)]
    public void FromJobNumber_ReadsTheSuffixConvention(string jobNumber, JobLegRole expected)
    {
        Assert.Equal(expected, JobLegRoles.FromJobNumber(jobNumber));
    }

    [Theory]
    [InlineData("KT2103CRTLH", JobLegRole.None)]
    [InlineData("KT2103CRT1", JobLegRole.None)]
    [InlineData("LH1", JobLegRole.None)]
    public void FromJobNumber_DoesNotMistakeANearMissForALinehaulSegment(string jobNumber, JobLegRole expected)
    {
        // "LH" with no number is not a segment, and a bare number is not one either. "LH1" on its own
        // has no parent prefix, so there is nothing for it to be a leg of.
        Assert.Equal(expected, JobLegRoles.FromJobNumber(jobNumber));
    }

    [Fact]
    public void IsLinehaul_CoversThePickupAndTheSegmentsButNotTheFinalMile()
    {
        Assert.True(JobLegRoles.IsLinehaul("KT2103CRTLHP"));
        Assert.True(JobLegRoles.IsLinehaul("KT2103CRTLH2"));
        Assert.False(JobLegRoles.IsLinehaul("KT2103CRTDEL"));
        Assert.False(JobLegRoles.IsLinehaul("KT2103CRT"));
    }
}

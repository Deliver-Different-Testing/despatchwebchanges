using DespatchWeb.Services;

namespace DespatchWeb.Models.Dto;

internal class ParentSplitJobInfoDto
{
    public int? JobRelationshipTypeId { get; set; }
    public int? RootParentId { get; set; }
    public bool UcjbVoid { get; set; }
    public SplitJobService.ParentPricing Pricing { get; set; }
}

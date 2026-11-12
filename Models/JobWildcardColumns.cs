namespace DespatchWeb.Models;

/// <summary>
/// Which data classes the free-text job search may look inside. References, job number, names, addresses and client
/// code are always searched; these gate the columns whose values an agent may not be allowed to see.
/// </summary>
[Flags]
public enum JobWildcardColumns
{
    None = 0,
    ContactDetails = 1,
    Notes = 2,
    PodName = 4,
    All = ContactDetails | Notes | PodName
}

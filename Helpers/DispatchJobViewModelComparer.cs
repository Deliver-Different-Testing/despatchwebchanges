using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public sealed class DispatchJobViewModelComparer : IEqualityComparer<DispatchJobViewModel>
{
    public bool Equals(DispatchJobViewModel x, DispatchJobViewModel y)
    {
        if (x == null || y == null)
        {
            return false;
        }

        return x.Id == y.Id;
    }

    public int GetHashCode(DispatchJobViewModel obj) => obj.Id.GetHashCode();
}
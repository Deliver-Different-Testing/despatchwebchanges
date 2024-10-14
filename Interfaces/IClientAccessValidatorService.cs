using System.Threading.Tasks;

namespace DespatchWeb.Interfaces;

public interface IClientAccessValidatorService
{
    Task ValidateClientAccess(int contactId, string clientIds);
}
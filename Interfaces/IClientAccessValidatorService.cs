namespace DespatchWeb.Interfaces;

public interface IClientAccessValidatorService
{
    Task ValidateClientAccessAsync(int contactId, string clientIds);
}
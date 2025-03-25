using System;

namespace DespatchWeb.Interfaces;

public interface ITenantTimeService
{
    DateTime GetCurrentTenantTime();
}

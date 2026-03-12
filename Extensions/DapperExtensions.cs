using System.Data.Common;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Extensions;

public static class DapperExtensions
{
    public static DbConnection GetDapperConnection(this DespatchContext context)
        => context.Database.GetDbConnection();
}

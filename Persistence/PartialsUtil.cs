using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace DespatchWeb
{
    public partial class DespatchWebDataContext : DbContext
    {
        public DespatchWebDataContext(DbContextOptions<DespatchWebDataContext> options)
            : base(options)
        {
            //optionsBuilder.UseSqlServer(coonectionString, builder => builder.UseRowNumberForPaging());
        }
    }
}

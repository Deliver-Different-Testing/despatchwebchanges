using System;
using System.Threading;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb
{
    public class DbContextWrapper(IDbContextFactory<DespatchContext> contextFactory) : IDisposable
    {
        private readonly AsyncLocal<DespatchContext> _context = new AsyncLocal<DespatchContext>();

        public DespatchContext GetContext()
        {
            if (_context.Value == null)
            {
                _context.Value = contextFactory.CreateDbContext();
            }
            return _context.Value;
        }

        public void Dispose()
        {
            if (_context.Value != null)
            {
                _context.Value.Dispose();
                _context.Value = null;
            }
        }
    }
}

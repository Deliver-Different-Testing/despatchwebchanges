using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers
{
    public class JobController : Controller
    {
        private JobRepository _jobRepo;

        public JobController(JobRepository jobRepository)
        {
            _jobRepo = jobRepository;

        }
        public IActionResult Index(string status, string area, string order, string asc)
        {
            var result =  _jobRepo.JobList(status, area, order, asc);
            return Json(result);
        }

        public IActionResult Current(int courierId, bool done)
        {
            var result = _jobRepo.CurrentJobList(courierId, done);
            return Json(result);
        }
    }
}
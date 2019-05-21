using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers
{
    public class CourierController : Controller
    {
        private CourierRepository _courierRepo;

        public CourierController(CourierRepository courierRepository)
        {
            _courierRepo = courierRepository;

        }
        public IActionResult Index()
        {
            var result = _courierRepo.ClearLists();
            return Json(result);
        }

        public IActionResult Active()
        {
            var result = _courierRepo.ActiveCouriers();
            return Json(result);
        }

        public IActionResult Location(string code)
        {
            var result = _courierRepo.Location(code);
            return Json(result);
        }
    }
}
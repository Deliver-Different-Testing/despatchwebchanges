using System;
using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class TaskViewModel
{
    public int Id { get; set; }

    public string Title { get; set; }

    public string Description { get; set; }

    public DateTime DueDate { get; set; }

    public bool Closed { get; set; }

    public string Priority { get; set; }

    public string Assignee { get; set; }

    public string EventType { get; set; }

    public int JobId { get; set; }

    public string Icon { get; set; }

    public bool IsOverdue { get; set; }
}

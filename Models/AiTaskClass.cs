namespace DespatchWeb.Models;

/// <summary>
/// Which class of work an AI request belongs to. Drafting output is always read and
/// edited by a human before it leaves the system, so it runs on the cheapest fast
/// model. Judgment output drives money (accessorial charges, change-request approval),
/// safety (dangerous goods, access hazards) and severity ranking, where a wrong answer
/// costs far more than the token difference between tiers.
/// </summary>
public enum AiTaskClass
{
    Drafting,
    Judgment
}

namespace DespatchWeb.Enums;

// Scope picker for the "Insert to live" Manual-mode operator action.
// Ordinals are wire-format (used by the React modal's radio group) — do
// not renumber.
public enum InsertToLiveScope : byte
{
    // Selected booking's parent + every child (resolves up from any row
    // in the family). Standalone bookings (no parent / no children) are
    // handled by this same path — they resolve to a family of one — so
    // this is the only single-booking scope.
    Group = 1,

    // Every eligible Manual recurring booking on the selected row's
    // RouteId for the chosen date, materialised as full parent/child
    // sets (no partial fragments).
    Route = 2
}

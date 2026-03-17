# Invoice Builder — Updates & Bug Fixes

**Prepared for:** Garry Fraser
**Date:** 17 March 2026
**Repo:** `Deliver-Different-Testing/Accounts` (master branch)
**Commits:** `c62f896`, `c2fd0e5`, `b702bd6`

---

## Summary

Three categories of changes: bug fixes, UX improvements, and missing fields. All changes are in `ClientApp/src/pages/InvoiceBuilderPage/`.

---

## 1. Bug Fix — Multi-Field Columns Not Saving

**Problem:** When a user adds multiple fields to a single detail column (stacked fields), only the first field persists after save. On reload, extra fields are lost.

**Root Cause:** The `fieldIds` array property on `DetailColumn` was stripped from both the save DTO and the API load mapper.

**Files Changed:**
- `InvoiceBuilderPage.tsx`

**Fix (Save DTO — `buildV2Dto`):**
```typescript
// BEFORE — fieldIds missing from serialisation
detailColumns: tpl.detailColumns.map(c => ({
  fieldId: c.fieldId, label: c.label, format: c.format, 
  align: c.align, width: c.width, showLabel: c.showLabel,
})),

// AFTER — fieldIds included
detailColumns: tpl.detailColumns.map(c => ({
  fieldId: c.fieldId, fieldIds: c.fieldIds, label: c.label, 
  format: c.format, align: c.align, width: c.width, showLabel: c.showLabel,
})),
```

**Fix (Load from API — `mapApiToTemplate`):**
```typescript
// BEFORE
detailColumns: (api.detailColumns || []).map((c: any) => ({
  fieldId: c.fieldId || '', label: c.label || '', format: c.format || 'text',
  align: c.align || 'left', width: c.width || 25, showLabel: c.showLabel,
})),

// AFTER — fieldIds mapped back
detailColumns: (api.detailColumns || []).map((c: any) => ({
  fieldId: c.fieldId || '', fieldIds: c.fieldIds || undefined, 
  label: c.label || '', format: c.format || 'text',
  align: c.align || 'left', width: c.width || 25, showLabel: c.showLabel,
})),
```

**Backend Note:** The API model (`InvoiceTemplateDto` or equivalent) must accept and return `fieldIds: string[]` on the detail column object. If the backend strips unknown properties, add `FieldIds` to the C# model:

```csharp
public class DetailColumnDto
{
    public string FieldId { get; set; }
    public List<string> FieldIds { get; set; }  // <-- ADD THIS
    public string Label { get; set; }
    public string Format { get; set; }
    public string Align { get; set; }
    public int Width { get; set; }
    public bool? ShowLabel { get; set; }
}
```

---

## 2. Bug Fix — Save Button Has No Loading Indicator

**Problem:** Clicking "Save Template" gives no visual feedback. Users click multiple times.

**Root Cause:** `loading` state was set via `setLoading(true/false)` but destructured as `[, setLoading]` — the value was never read.

**Files Changed:**
- `InvoiceBuilderPage.tsx`
- `InvoiceBuilderPage.module.css`

**Fix (TSX):**
```typescript
// BEFORE
const [, setLoading] = useState(false)

// AFTER
const [loading, setLoading] = useState(false)
```

**Save button update:**
```tsx
<button onClick={handleSave} disabled={loading} 
  className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}>
  {loading 
    ? <><span className={styles.spinner} /> Saving...</> 
    : saved 
      ? <><Check size={14} /> Saved!</> 
      : <><Save size={14} /> Save Template</>}
</button>
```

**CSS additions:**
```css
.saveBtn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 3. UX — Drag-to-Resize Fields in Header Blocks

**Problem:** Fields inside header blocks (company, invoice, client, etc.) are locked to full container width. Users can't place a label and data field side-by-side. A width dropdown existed but was not discoverable.

**Solution:** Replaced the width dropdown with a drag handle on the right edge of each field. Dragging resizes the field width with snapping to common values (25%, 33%, 50%, 66%, 75%, 100%).

**Files Changed:**
- `components/StackedFieldRow.tsx`
- `InvoiceBuilderPage.module.css`

**How it works:**
1. Each field in a header block shows a drag handle (⋮) on hover at its right edge
2. Drag to resize — snaps to nearest common width within 4% tolerance
3. A width badge (e.g. "50%") appears on hover when field is not 100%
4. Two fields at 50% width sit side-by-side on the same row (parent uses `flex-wrap: wrap`)

**Key code (StackedFieldRow.tsx):**
```typescript
const handleResizeStart = useCallback((e: React.MouseEvent) => {
  e.preventDefault(); e.stopPropagation()
  const parentEl = rowRef.current?.parentElement
  if (!parentEl) return
  const parentWidth = parentEl.getBoundingClientRect().width
  const startX = e.clientX
  const startPct = field.widthPercent || 100

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX
    const dPct = (dx / parentWidth) * 100
    const newPct = Math.round(Math.max(20, Math.min(100, startPct + dPct)))
    // Snap to common values
    const snapped = [25, 33, 50, 66, 75, 100].reduce(
      (prev, v) => Math.abs(v - newPct) < 4 ? v : prev, newPct
    )
    onUpdate({ widthPercent: snapped })
  }
  const onUp = () => { 
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp) 
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}, [field.widthPercent, onUpdate])
```

**CSS additions:**
```css
.fieldResizeHandle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 5;
}

.stackedRow:hover .fieldResizeHandle { opacity: 0.5; }
.fieldResizeHandle:hover { opacity: 1 !important; background: rgba(59,199,244,0.15); }

.fieldWidthBadge {
  position: absolute;
  top: -6px;
  right: 8px;
  font-size: 9px;
  background: var(--color-primary);
  color: #fff;
  padding: 0 4px;
  border-radius: 3px;
  line-height: 14px;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.stackedRow:hover .fieldWidthBadge { opacity: 0.8; }
```

---

## 4. UX — Detail Column Editing Controls

**Problem:** Detail table columns (job/line items section) have no way to change format or alignment. Header block fields have full controls but detail columns don't.

**Solution:** Click any column header to select it and reveal inline controls for format and alignment.

**Files Changed:**
- `InvoiceBuilderPage.tsx`
- `InvoiceBuilderPage.module.css`

**New state:**
```typescript
const [selectedColIdx, setSelectedColIdx] = useState<number | null>(null)
```

**New helper:**
```typescript
const updateColumn = (colIdx: number, updates: Partial<typeof template.detailColumns[0]>) => {
  setTemplate(prev => ({ 
    ...prev, 
    detailColumns: prev.detailColumns.map((c, i) => i === colIdx ? { ...c, ...updates } : c) 
  }))
}
```

**Column header gets click handler + selected state + controls panel:**
- Format selector: Text / $ / # / Date
- Alignment toggle: left / center / right
- Selected column highlighted with accent outline

**CSS additions:**
```css
.detailThSelected {
  outline: 2px solid var(--color-accent, #3bc7f4);
  outline-offset: -2px;
}

.colControls {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.2);
  flex-wrap: wrap;
}
```

---

## 5. Builder Hint Banner

Added a subtle info banner above the detail table in builder mode:

```
💡 Click column headers to edit format & alignment. Resize fields in 
header blocks by dragging their right edge to place labels side-by-side.
```

```css
.builderHint {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: rgba(59,199,244,0.08);
  border: 1px solid rgba(59,199,244,0.2);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 8px;
}
```

---

## 6. Missing Fields (Already in constants.ts)

The following fields exist in `constants.ts` but may not be on staging yet. Confirm they appear in the Field Chooser after deploying:

| Field ID | Label | DB Source | Format |
|----------|-------|-----------|--------|
| `ppd_amount` | PPD Amount | `tucJob.PPDAmount` | currency |
| `raw_amount` | Raw Amount | `tucJob.RawAmount` | currency |
| `waiting_time_pickup` | Waiting at Pickup | dwell/waiting time tables | number |
| `waiting_time_delivery` | Waiting at Delivery | dwell/waiting time tables | number |
| `run_name` | Run/Schedule Name | `tucJob.ucjbRunName` | text |
| `accessorial_names` | Accessorial Names | GROUP_CONCAT of charges | text |
| `accessorial_amounts` | Accessorial Amounts | `JobAccessorialCharges.CalculatedAmount` | currency |
| `accessorial_total` | Accessorial Total | SUM(JobAccessorialCharges) | currency |

---

## Build Note

There are pre-existing TypeScript errors in the repo that prevent clean build:
- `FieldChooser.tsx`: unused imports (`FieldGroup`, `HeaderBlock`)
- `app.service.ts` line 1013: duplicate property name in object literal

These need fixing before the next deploy. The Invoice Builder changes themselves are structurally correct.

---

## Checklist for Garry

- [ ] Pull latest from `Deliver-Different-Testing/Accounts` master
- [ ] Fix pre-existing TS errors (unused imports in FieldChooser, duplicate prop in app.service)
- [ ] Confirm backend `DetailColumnDto` includes `FieldIds` property (or JSON is pass-through)
- [ ] Build and deploy to GitHub Pages
- [ ] Test: create template with stacked fields in a column → save → reload → verify fields persist
- [ ] Test: save button shows spinner during save
- [ ] Test: resize field in header block by dragging right edge
- [ ] Test: click detail column header → format/alignment controls appear
- [ ] Test: missing fields (PPD Amount, Raw Amount, etc.) visible in Field Chooser

# Release Notes - Feature/Bug-Fixes Branch

## Task Dashboard Enhancements

### Customizable Grid Layout
- Added drag-and-drop widget rearrangement for the task dashboard
- Widgets can now be resized using handles on the bottom (height), right (width), and corner (both)
- Layout is locked by default to prevent accidental changes

### Saved Layout Management
- Users can save custom layouts with custom names via the Layouts menu in the app bar
- Switch between saved layouts from the app bar dropdown
- Delete custom layouts (Default layout cannot be deleted)
- Layout preferences are persisted per user in localStorage

### Layout Controls
- Added layout controls in the dashboard header showing current layout name
- Lock/unlock toggle button for custom layouts (unlock to enable editing)
- Reset button to restore widget positions to default

### Default Layout
- List view: Filters and Tasks stacked on the left column, Delivery Journey on the right
- Calendar view: Calendar on the left, Delivery Journey on the right
- Small screens: All widgets stack vertically for better mobile experience

---

## Flight Agent Improvements

### Info Dialogs Migration
- Moved flight info dialogs to React-only implementation in FlightAgentDataTable
- Improved performance and consistency with the rest of the React UI

### Flight Legs UI Improvements
- Enhanced flight legs dropdown user interface
- Added tooltips to airline filter options for better clarity

---

## Date Filter Enhancement

### Today Option
- Added "Today" option to the date filter menu for quick filtering

---

## Address Dialog Fix

### Postal Code Input
- Reduced postal code input width in address dialog for better layout

---

## Backend Changes

### Code Quality
- Refactored job mappings to use inline navigation properties
- Removed unused note management dialog references
- Minor cleanups and code organization improvements
- Fixed TypeScript compilation errors in frontend

### Database Query Optimization
- Added AsSplitQuery to repository queries for better performance

---

## Bug Fixes

### Task Dashboard
- Fixed AngularJS injection error for `dispatchJobService` when loading task dashboard
- Fixed layout thrashing/jumping issue by debouncing width changes
- Fixed grid compaction that was incorrectly stacking widgets vertically
- Fixed resize handles to properly allow both width and height changes

---

## Testing Plan

### Task Dashboard Layout Management

#### Layout Saving
- [ ] Navigate to Task Dashboard
- [ ] Click the Layouts dropdown in the app bar
- [ ] Click "Add Layout" and enter a custom name
- [ ] Verify the dialog closes and the new layout is created
- [ ] Verify the new layout appears in the Layouts dropdown

#### Layout Switching
- [ ] Create multiple custom layouts with different configurations
- [ ] Switch between layouts using the dropdown
- [ ] Verify each layout restores its saved widget positions and sizes
- [ ] Verify "Default" layout is always available

#### Layout Deletion
- [ ] Select a custom layout
- [ ] Delete the layout from the dropdown menu
- [ ] Verify the layout is removed from the list
- [ ] Verify "Default" layout cannot be deleted

#### Widget Drag and Drop
- [ ] Unlock a custom layout using the lock button in the header
- [ ] Drag a widget by its header to a new position
- [ ] Verify the widget stays in the new position after releasing
- [ ] Verify other widgets do not unexpectedly move or stack

#### Widget Resizing
- [ ] Unlock a custom layout
- [ ] Resize a widget using the bottom edge (height)
- [ ] Resize a widget using the right edge (width)
- [ ] Resize a widget using the corner handle (both dimensions)
- [ ] Verify minimum size constraints are respected

#### Layout Persistence
- [ ] Create and configure a custom layout
- [ ] Refresh the page
- [ ] Verify the layout selection and positions persist
- [ ] Close and reopen the browser
- [ ] Verify layouts are still available (localStorage)

#### Layout Lock/Unlock
- [ ] Verify "Default" layout is always locked
- [ ] Verify custom layouts show lock/unlock button
- [ ] Toggle lock state and verify drag/resize is disabled when locked
- [ ] Verify lock state persists after page refresh

#### Reset Layout
- [ ] Modify widget positions in an unlocked layout
- [ ] Click the Reset button
- [ ] Verify widgets return to default positions

### Flight Agent

#### Info Dialogs
- [ ] Click on a flight row to open the info dialog
- [ ] Verify all flight information displays correctly
- [ ] Verify dialog closes properly

#### Flight Legs Dropdown
- [ ] Expand a flight with multiple legs
- [ ] Verify legs display correctly with improved UI
- [ ] Verify airline filter tooltips appear on hover

### Date Filter

#### Today Option
- [ ] Open the date filter menu
- [ ] Verify "Today" option is available
- [ ] Select "Today" and verify the filter applies correctly

### Responsive Behavior

#### Small Screens
- [ ] Resize browser to mobile width (<768px)
- [ ] Verify widgets stack vertically
- [ ] Verify all widgets remain accessible and functional

---

## Technical Details

### Dependencies
- Uses react-grid-layout v2.x with proper API (`dragConfig`, `resizeConfig`, `compactor`)
- Layout state flows from React to AngularJS for app bar integration
/**
 * Tests for the icon → color tone map. The tones drive the timeline marker
 * color, so a regression here would silently turn all events grey.
 */

import {getEventColorTone, getEventIcon} from './eventIcons';

describe('getEventColorTone', () => {
    it('maps money / completion icons to success', () => {
        expect(getEventColorTone('attach_money')).toBe('success');
        expect(getEventColorTone('payments')).toBe('success');
        expect(getEventColorTone('paid')).toBe('success');
        expect(getEventColorTone('account_balance_wallet')).toBe('success');
        expect(getEventColorTone('check_circle')).toBe('success');
        expect(getEventColorTone('draw')).toBe('success');
    });

    it('maps destructive icons to error', () => {
        expect(getEventColorTone('cancel')).toBe('error');
        expect(getEventColorTone('warning')).toBe('error');
        expect(getEventColorTone('report_problem')).toBe('error');
        expect(getEventColorTone('lock')).toBe('error');
    });

    it('maps time / scheduling icons to warning', () => {
        expect(getEventColorTone('schedule')).toBe('warning');
        expect(getEventColorTone('event')).toBe('warning');
        expect(getEventColorTone('calendar_month')).toBe('warning');
        expect(getEventColorTone('notifications')).toBe('warning');
        expect(getEventColorTone('undo')).toBe('warning');
    });

    it('maps dispatch operations (assignments, status changes, movement) to info', () => {
        expect(getEventColorTone('local_shipping')).toBe('info');
        expect(getEventColorTone('support_agent')).toBe('info');
        expect(getEventColorTone('flight')).toBe('info');
        expect(getEventColorTone('airport_shuttle')).toBe('info');
        expect(getEventColorTone('directions_car')).toBe('info');
        expect(getEventColorTone('swap_horiz')).toBe('info');
        expect(getEventColorTone('published_with_changes')).toBe('info');
        expect(getEventColorTone('route')).toBe('info');
        expect(getEventColorTone('person')).toBe('info');
    });

    it('falls back to secondary for unknown / generic-edit / note / reference icons', () => {
        // Generic edits and notes default to gray so they do not compete
        // visually with the meaningful color categories above.
        expect(getEventColorTone('edit_note')).toBe('secondary');
        expect(getEventColorTone('update')).toBe('secondary');
        expect(getEventColorTone('task')).toBe('secondary');
        expect(getEventColorTone('sticky_note_2')).toBe('secondary');
        expect(getEventColorTone('sms')).toBe('secondary');
        expect(getEventColorTone('notes')).toBe('secondary');
        expect(getEventColorTone('tag')).toBe('secondary');
        expect(getEventColorTone('location_on')).toBe('secondary');
        expect(getEventColorTone('pin_drop')).toBe('secondary');
        expect(getEventColorTone('not_a_real_icon')).toBe('secondary');
        expect(getEventColorTone(undefined)).toBe('secondary');
        expect(getEventColorTone(null)).toBe('secondary');
    });
});

describe('getEventIcon', () => {
    it('returns the mapped component for known icon names', () => {
        // Smoke-check that the lookup returns *something* (a function/component)
        // for a representative known name and falls back for unknowns.
        expect(typeof getEventIcon('local_shipping')).toBe('object');
        expect(typeof getEventIcon('unknown_icon')).toBe('object');
        expect(typeof getEventIcon(undefined)).toBe('object');
    });
});

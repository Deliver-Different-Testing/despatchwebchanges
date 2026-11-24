import dayjs from 'dayjs';
import {matchModeLabel, searchNoticeEmptyState} from './jobSearchNotice';
import type {JobSearchNotice} from '../../types/dispatchJob';

const notice = (overrides: Partial<JobSearchNotice>): JobSearchNotice => ({
    jobTerm: 'E3739',
    matchMode: null,
    outsideWindowCount: null,
    outsideWindowRange: null,
    totalIsCapped: false,
    searchTooBroad: false,
    ...overrides,
});

const range = {from: dayjs('2023-06-01'), to: dayjs('2024-03-09')};

describe('searchNoticeEmptyState', () => {
    it('says nothing without a notice or when there is nothing to explain', () => {
        expect(searchNoticeEmptyState(null)).toBeUndefined();
        expect(searchNoticeEmptyState(notice({outsideWindowCount: 0}))).toBeUndefined();
    });

    it('explains a too-broad search without offering an action', () => {
        const state = searchNoticeEmptyState(notice({searchTooBroad: true}), vi.fn());
        expect(state?.title).toBe('Search too broad');
        expect(state?.onAction).toBeUndefined();
    });

    it('counts matches outside the window and widens to exactly their span', () => {
        const onWiden = vi.fn();
        const state = searchNoticeEmptyState(notice({outsideWindowCount: 1, outsideWindowRange: range}), onWiden);

        expect(state?.title).toBe('No jobs in these dates');
        expect(state?.message).toBe('1 job starts with E3739 outside the dates you searched.');
        expect(state?.actionText).toBe('Include those dates');
        state?.onAction?.();
        expect(onWiden).toHaveBeenCalledWith(range);
    });

    it('asks for more of the number, with no action, when the matches are over the cap', () => {
        const state = searchNoticeEmptyState(notice({jobTerm: 'E3', outsideWindowCount: 51}), vi.fn());
        expect(state?.message).toBe('Over 50 jobs start with E3 on other dates. Type more of the job number.');
        expect(state?.onAction).toBeUndefined();
    });

    it('drops the action without a span or without a way to widen', () => {
        expect(searchNoticeEmptyState(notice({outsideWindowCount: 2}), vi.fn())?.actionText).toBeUndefined();
        expect(searchNoticeEmptyState(notice({outsideWindowCount: 2, outsideWindowRange: range}))?.actionText).toBeUndefined();
    });
});

describe('matchModeLabel', () => {
    it.each([
        ['exact', 'Job number E3739 from any date, and numbers starting with it'],
        ['prefix', 'Job numbers starting with E3739'],
        ['contains', null],
        [null, null],
    ] as const)('%s → %s', (matchMode, expected) => {
        expect(matchModeLabel(notice({matchMode}))).toBe(expected);
    });

    it('needs the term the result was searched with', () => {
        expect(matchModeLabel(notice({matchMode: 'exact', jobTerm: null}))).toBeNull();
    });
});

import {pluralise} from './pluralise';

describe('pluralise', () => {
    it('uses the singular for 1 and the plural otherwise, with an optional irregular plural', () => {
        expect(pluralise(1, 'job')).toBe('job');
        expect(pluralise(0, 'job')).toBe('jobs');
        expect(pluralise(2, 'job')).toBe('jobs');
        expect(pluralise(2, 'duplicate')).toBe('duplicates');
        expect(pluralise(2, 'person', 'people')).toBe('people');
    });
});

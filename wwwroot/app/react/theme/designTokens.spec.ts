import {aiColors, aiAccentColor} from './designTokens';

describe('designTokens', () => {
    it('exposes the AI accent as a light/main/dark ramp', () => {
        expect(aiColors.main).toBe('#7c4dff');
        expect(aiColors.light).toBeDefined();
        expect(aiColors.dark).toBeDefined();
    });

    it('keeps aiAccentColor as the ramp main for existing call sites', () => {
        expect(aiAccentColor).toBe(aiColors.main);
    });
});

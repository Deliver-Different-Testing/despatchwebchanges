import {renderHook} from '@testing-library/react';
import {useResetLayout} from './useResetLayout';

describe('useResetLayout', () => {
    it('confirms with the layout name, resets only when confirmed, defaulting the name to Default', () => {
        const reset = jest.fn();
        const confirm = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
        const {result, rerender} = renderHook(
            ({name}: {name?: string}) => useResetLayout({currentLayoutName: name, resetCurrentLayout: reset, confirm}),
            {initialProps: {name: 'Mine'} as {name?: string}},
        );

        result.current.resetLayout();
        expect(confirm).toHaveBeenCalledWith(
            'Reset "Mine" to the default arrangement? Panel sizes, order and visibility will be restored.',
        );
        expect(reset).not.toHaveBeenCalled();

        result.current.resetLayout();
        expect(reset).toHaveBeenCalledTimes(1);

        rerender({name: undefined});
        result.current.resetLayout();
        expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('Reset "Default"'));
    });
});

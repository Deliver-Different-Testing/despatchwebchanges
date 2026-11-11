import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {setupUser} from '../../../test/utils/setupUser';
import {SettingRadioGroup, SettingRow} from './SettingsControls';

describe('SettingRadioGroup', () => {
    it('does not nest a paragraph inside Mantine\'s description paragraph', () => {
        const {container} = renderWithMantine(
            <SettingRadioGroup
                title="Courier info"
                description="Choose what to show"
                value="a"
                options={[{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]}
                onChange={() => undefined}
            />,
        );

        expect(container.querySelector('p p')).toBeNull();
    });
});

describe('SettingRow', () => {
    const renderRow = (disabled = false) => {
        const onToggle = vi.fn();
        const {container} = renderWithMantine(
            <SettingRow title="Hide button" description="Explains it" checked={false} disabled={disabled} onToggle={onToggle}/>,
        );
        const track = container.querySelector('.mantine-Switch-track') as HTMLElement;
        return {onToggle, track};
    };

    it('toggles exactly once whether the track, the card text or the switch input is clicked', async () => {
        const user = setupUser();
        const {onToggle, track} = renderRow();

        await user.click(track);
        expect(onToggle).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('Explains it'));
        expect(onToggle).toHaveBeenCalledTimes(2);

        await user.click(screen.getByRole('switch', {name: 'Hide button'}));
        expect(onToggle).toHaveBeenCalledTimes(3);
    });

    it('ignores clicks anywhere when disabled', async () => {
        const user = setupUser();
        const {onToggle, track} = renderRow(true);

        await user.click(track);
        await user.click(screen.getByText('Explains it'));

        expect(onToggle).not.toHaveBeenCalled();
    });
});

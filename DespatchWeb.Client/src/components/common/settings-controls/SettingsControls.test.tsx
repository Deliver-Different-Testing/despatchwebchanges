import React from 'react';
import {renderWithMantine} from '../../../test/utils';
import {SettingRadioGroup} from './SettingsControls';

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

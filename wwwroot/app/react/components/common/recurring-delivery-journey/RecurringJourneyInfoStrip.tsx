/**
 * Info strip at the top of the Recurring Log timeline explaining how to
 * interact with it.
 */

import React from 'react';
import {Alert, Text} from '@mantine/core';

export const RecurringJourneyInfoStrip: React.FC = () => (
    <Alert color="blue" variant="light" mx={16} mt={16} py={4}>
        <Text fz="sm">
            One entry per day the recurring schedule has run. Click a parent or child to open it in Job Search.
        </Text>
    </Alert>
);

export default RecurringJourneyInfoStrip;

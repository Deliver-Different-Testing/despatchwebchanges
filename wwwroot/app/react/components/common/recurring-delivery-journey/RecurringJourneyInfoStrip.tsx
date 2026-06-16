/**
 * Info strip at the top of the Recurring Log timeline explaining how to
 * interact with it.
 */

import React from 'react';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

export const RecurringJourneyInfoStrip: React.FC = () => (
    <Alert severity="info" variant="standard" sx={{mx: 2, mt: 2, py: 0.5}}>
        <Typography variant="body2">
            One entry per day the recurring schedule has run. Click a parent or child to open it in Job Search.
        </Typography>
    </Alert>
);

export default RecurringJourneyInfoStrip;

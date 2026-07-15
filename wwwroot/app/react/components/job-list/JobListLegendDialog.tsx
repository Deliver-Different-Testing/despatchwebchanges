/**
 * Job List Legend Dialog
 *
 * Explains the markers shown in the job list's first (priority) column. Each row
 * shows exactly one marker — the highest-priority one that applies — so the
 * sections are ordered to mirror that precedence (job type → attention →
 * status). Opened from the info button in the priority column header.
 *
 * All labels, descriptions and glyphs come from `./jobListIndicators`, the same
 * source the table renders from, so the legend can never drift from reality.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import {DialogShell, DialogHeader, sectionPaperSx, sectionLabelSx} from '../dialogs/shared';
import type {IndicatorDef} from './jobListIndicators';
import {FLIGHT_INDICATORS, INDICATORS, renderLegendMarker} from './jobListIndicators';

const MarkerGutter: React.FC<{children: React.ReactNode}> = ({children}) => (
    <Box sx={{width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25}}>
        {children}
    </Box>
);

const LegendRow: React.FC<{def: IndicatorDef}> = ({def}) => (
    <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5}}>
        <MarkerGutter>{renderLegendMarker(def.marker)}</MarkerGutter>
        <Box>
            <Typography variant="body2" sx={{fontWeight: 600}}>{def.label}</Typography>
            <Typography variant="caption" sx={{color: 'text.secondary', display: 'block'}}>{def.description}</Typography>
        </Box>
    </Box>
);

// Flight is the one indicator with several variants; collapse the legs into a
// single row rather than repeating "Flight …" four times.
const FlightLegendRow: React.FC = () => {
    const legs = [FLIGHT_INDICATORS.pickup, FLIGHT_INDICATORS.job, FLIGHT_INDICATORS.delivery];
    return (
        <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5}}>
            <MarkerGutter>{renderLegendMarker(FLIGHT_INDICATORS.job.marker)}</MarkerGutter>
            <Box>
                <Typography variant="body2" sx={{fontWeight: 600}}>Flight</Typography>
                <Typography variant="caption" sx={{color: 'text.secondary', display: 'block', mb: 0.75}}>
                    Air freight job — the icon shows which leg this is:
                </Typography>
                <Box sx={{display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5}}>
                    {legs.map((leg) => (
                        <Box key={leg.label} sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            {renderLegendMarker(leg.marker)}
                            <Typography variant="caption" sx={{color: 'text.secondary'}}>{leg.description}</Typography>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

const LegendSection: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
    <Box>
        <Typography variant="body2" sx={sectionLabelSx}>{title}</Typography>
        <Paper elevation={0} sx={{...sectionPaperSx, display: 'flex', flexDirection: 'column', gap: 1.5}}>
            {children}
        </Paper>
    </Box>
);

export interface JobListLegendDialogProps {
    open: boolean;
    onClose: () => void;
}

export const JobListLegendDialog: React.FC<JobListLegendDialogProps> = ({open, onClose}) => (
    <DialogShell open={open} onClose={onClose}>
        <DialogHeader
            icon={<InfoOutlinedIcon/>}
            title="Column legend"
            subtitle="What the dots and icons mean"
            onClose={onClose}
        />
        <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
            <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                <Alert severity="info">
                    Each job shows a single marker here — the highest-priority one that applies.
                </Alert>
                <LegendSection title="Job type">
                    <FlightLegendRow/>
                    <LegendRow def={INDICATORS.chilled}/>
                    <LegendRow def={INDICATORS.multiPart}/>
                    <LegendRow def={INDICATORS.partner}/>
                </LegendSection>
                <LegendSection title="Needs attention">
                    <LegendRow def={INDICATORS.latePickup}/>
                    <LegendRow def={INDICATORS.lateDelivery}/>
                </LegendSection>
                <LegendSection title="Status">
                    <LegendRow def={INDICATORS.urgent}/>
                    <LegendRow def={INDICATORS.inTransit}/>
                    <LegendRow def={INDICATORS.done}/>
                    <LegendRow def={INDICATORS.active}/>
                </LegendSection>
                <LegendSection title="Context">
                    <LegendRow def={INDICATORS.related}/>
                </LegendSection>
            </Box>
        </DialogContent>
        <DialogActions
            sx={(theme) => ({
                px: 3,
                py: 2,
                bgcolor: 'background.paper',
                borderTop: `1px solid ${theme.palette.divider}`,
                gap: 1,
            })}
        >
            <Button onClick={onClose} variant="contained" color="primary" sx={{minWidth: 100, minHeight: 44}}>
                Close
            </Button>
        </DialogActions>
    </DialogShell>
);

export default JobListLegendDialog;

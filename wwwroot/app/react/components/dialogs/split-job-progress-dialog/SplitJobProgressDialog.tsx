/**
 * SplitJobProgressDialog
 *
 * The non-dismissable progress dialog shown while a job is being split. Follows
 * the dialog design language (CLAUDE.md) — solid brand header + `background.default`
 * content with a white section Paper — but uses a *bespoke* header without a close
 * button, since a progress dialog has no cancel path.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import {DialogShell, sectionPaperSx} from '../shared';
import {headerChromeSx, headerChipSx} from '../shared/styles';

export interface SplitJobProgressDialogProps {
    open: boolean;
    jobNo: string;
}

export const SplitJobProgressDialog: React.FC<SplitJobProgressDialogProps> = ({open, jobNo}) => (
    <DialogShell open={open} onClose={() => {}}>
        <Box sx={(theme) => headerChromeSx(theme)}>
            <Box sx={(theme) => headerChipSx(theme)}>
                <CallSplitIcon/>
            </Box>
            <Box sx={{flex: 1}}>
                <Typography variant="h6" sx={{fontWeight: 600}}>
                    Splitting Job
                </Typography>
                <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                    Job {jobNo}
                </Typography>
            </Box>
        </Box>
        <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
            <Box sx={{p: 3}}>
                <Paper elevation={0} sx={sectionPaperSx}>
                    <LinearProgress sx={{mb: 2}}/>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        Splitting job {jobNo} — this may take a moment.
                    </Typography>
                </Paper>
            </Box>
        </DialogContent>
    </DialogShell>
);

export default SplitJobProgressDialog;

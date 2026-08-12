/**
 * SplitJobProgressDialog
 *
 * The non-dismissable progress dialog shown while a job is being split. Follows
 * the dialog design language — solid brand header + a content area with a white
 * section Paper — but uses a *bespoke* header without a close button, since a
 * progress dialog has no cancel path.
 */
import React from 'react';
import {Box, Paper, Progress, Text, ThemeIcon} from '@mantine/core';
import {Split} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell,
    dialogContentBg,
    headerChipProps,
    headerChromeStyle,
    sectionPaperProps,
} from '../shared/mantine';

export interface SplitJobProgressDialogProps {
    open: boolean;
    jobNo: string;
}

export const SplitJobProgressDialog: React.FC<SplitJobProgressDialogProps> = ({open, jobNo}) => (
    <DialogShell
        opened={open}
        onClose={() => {}}
        label="Splitting Job"
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
    >
        <Box style={headerChromeStyle()}>
            <ThemeIcon {...headerChipProps()}>
                <Icon lucide={Split}/>
            </ThemeIcon>
            <Box style={{flex: 1}}>
                <Text component="h2" size="lg" fw={600}>
                    Splitting Job
                </Text>
                <Text size="sm" mt={2} style={{opacity: 0.85}}>
                    Job {jobNo}
                </Text>
            </Box>
        </Box>
        <Box p="lg" style={{backgroundColor: dialogContentBg}}>
            <Paper {...sectionPaperProps}>
                <Progress.Root size="sm" mb="md">
                    <Progress.Section value={100} animated aria-label="Splitting job"/>
                </Progress.Root>
                <Text size="sm" c="dimmed">
                    Splitting job {jobNo} — this may take a moment.
                </Text>
            </Paper>
        </Box>
    </DialogShell>
);

export default SplitJobProgressDialog;

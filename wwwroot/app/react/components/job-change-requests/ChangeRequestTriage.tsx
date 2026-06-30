/**
 * ChangeRequestTriage - advisory Auto-Mate recommendation for a pending job
 * change request. The approver triggers it on demand; the result is a
 * SUGGESTION only — the Approve/Reject buttons remain the human's decision.
 */

import React, {useState} from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {useAiDraft} from '../../hooks/useAiDraft';
import {AiDraftButton} from '../common/ai-draft-button/AiDraftButton';
import {ChangeRequestTriageResponse, triageChangeRequest} from '../../services/aiAssistantApi';

interface ChangeRequestTriageProps {
    requestId: number;
    jobId: number;
}

type Severity = 'success' | 'error' | 'info';

function actionSeverity(action: string): Severity {
    if (action === 'approve') return 'success';
    if (action === 'reject') return 'error';
    return 'info';
}

export const ChangeRequestTriage: React.FC<ChangeRequestTriageProps> = ({requestId, jobId}) => {
    const {runDraft, isDrafting} = useAiDraft();
    const [result, setResult] = useState<ChangeRequestTriageResponse | null>(null);

    const handleClick = async () => {
        const r = await runDraft((signal) => triageChangeRequest(requestId, jobId, {signal}));
        if (r) setResult(r);
    };

    return (
        <Box sx={{flexBasis: '100%', width: '100%'}}>
            <AiDraftButton onClick={handleClick} isDrafting={isDrafting} label="Auto-Mate recommendation" />
            {result && (
                <Alert severity={actionSeverity(result.recommendedAction)} sx={{mt: 1}}>
                    <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                            <Chip
                                size="small"
                                color={actionSeverity(result.recommendedAction)}
                                label={`AI: ${result.recommendedAction.toUpperCase()}`}
                            />
                            <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                {Math.round(result.confidence * 100)}% confidence · suggestion only
                            </Typography>
                        </Stack>
                        <Typography variant="body2">{result.rationale}</Typography>
                        {result.riskFactors.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{flexWrap: 'wrap', rowGap: 0.5}}>
                                {result.riskFactors.map((rf, i) => (
                                    <Chip key={`${rf}-${i}`} size="small" variant="outlined" label={rf} />
                                ))}
                            </Stack>
                        )}
                    </Stack>
                </Alert>
            )}
        </Box>
    );
};

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type {Components} from 'react-markdown';

interface AiMarkdownRendererProps {
    content: string;
}

const components: Components = {
    h1: ({children}) => (
        <Typography variant="subtitle2" sx={{fontWeight: 600, color: 'text.primary', mt: 1.5, mb: 0.5}}>
            {children}
        </Typography>
    ),
    h2: ({children}) => (
        <Typography variant="subtitle2" sx={{fontWeight: 600, color: 'text.primary', mt: 1.5, mb: 0.5}}>
            {children}
        </Typography>
    ),
    h3: ({children}) => (
        <Typography variant="subtitle2" sx={{fontWeight: 600, color: 'text.primary', mt: 1, mb: 0.5}}>
            {children}
        </Typography>
    ),
    p: ({children}) => (
        <Typography variant="body2" sx={{color: 'text.secondary', lineHeight: 1.7, mb: 1}}>
            {children}
        </Typography>
    ),
    strong: ({children}) => (
        <Box component="span" sx={{fontWeight: 600, color: 'text.primary'}}>
            {children}
        </Box>
    ),
    ul: ({children}) => (
        <Box component="ul" sx={{pl: 2.5, my: 0.5, '& li': {mb: 0.25}}}>
            {children}
        </Box>
    ),
    ol: ({children}) => (
        <Box component="ol" sx={{pl: 2.5, my: 0.5, '& li': {mb: 0.25}}}>
            {children}
        </Box>
    ),
    li: ({children}) => (
        <Typography component="li" variant="body2" sx={{color: 'text.secondary', lineHeight: 1.7}}>
            {children}
        </Typography>
    ),
    hr: () => <Divider sx={{my: 1.5}} />,
    code: ({children}) => (
        <Box
            component="code"
            sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'action.hover',
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
            }}
        >
            {children}
        </Box>
    ),
};

export const AiMarkdownRenderer: React.FC<AiMarkdownRendererProps> = ({content}) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
    </ReactMarkdown>
);

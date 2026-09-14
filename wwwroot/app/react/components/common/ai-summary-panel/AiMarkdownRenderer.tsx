import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Box, Divider, Text} from '@mantine/core';
import type {Components} from 'react-markdown';
import classes from './AiMarkdownRenderer.module.css';

interface AiMarkdownRendererProps {
    content: string;
}

const Heading = ({children, mt}: {children: React.ReactNode; mt: number}) => (
    <Text fz="sm" fw={600} mt={mt} mb={4}>
        {children}
    </Text>
);

const components: Components = {
    h1: ({children}) => <Heading mt={12}>{children}</Heading>,
    h2: ({children}) => <Heading mt={12}>{children}</Heading>,
    h3: ({children}) => <Heading mt={8}>{children}</Heading>,
    p: ({children}) => (
        <Text fz="sm" c="dimmed" mb={8} style={{lineHeight: 1.7}}>
            {children}
        </Text>
    ),
    strong: ({children}) => (
        <Text component="span" fw={600}>
            {children}
        </Text>
    ),
    ul: ({children}) => (
        <Box component="ul" className={classes.list}>
            {children}
        </Box>
    ),
    ol: ({children}) => (
        <Box component="ol" className={classes.list}>
            {children}
        </Box>
    ),
    li: ({children}) => (
        <Text component="li" fz="sm" c="dimmed" style={{lineHeight: 1.7}}>
            {children}
        </Text>
    ),
    hr: () => <Divider my={12} />,
    code: ({children}) => (
        <Box
            component="code"
            px={6}
            py={2}
            ff="monospace"
            style={{
                borderRadius: 'var(--mantine-radius-sm)',
                backgroundColor: 'var(--mantine-color-gray-1)',
                fontSize: '0.8125rem',
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

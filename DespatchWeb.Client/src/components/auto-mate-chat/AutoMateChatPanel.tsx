import {FileText as FileTextIcon, X as CloseIcon, Send as SendIcon} from 'lucide-react';
import React, {lazy, Suspense, useMemo} from 'react';
import {useSearchParams} from 'react-router';
import {ActionIcon, Badge, Box, Group, Paper, Text, Transition} from '@mantine/core';
import {
    AssistantRuntimeProvider,
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useAuiState,
    useLocalRuntime,
} from '@assistant-ui/react';
import type {Options as ReactMarkdownOptions} from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {useAutoMateChat} from './autoMateChatContext';
import {createChatAdapter} from './chatAdapter';
import {CHAT_MARKDOWN_COMPONENTS} from './chatMarkdown';
import {AutoMateLogo} from '../common/auto-mate-logo/AutoMateLogo';
import {useNavigation} from '../../routes/NavigationContext';
import {getPageContext, getSuggestedPrompts} from '../../constants/autoMatePrompts';
import type {KbSource} from '../../types/autoMateChat';
import styles from './AutoMateChat.module.css';

const ReactMarkdown = lazy(() => import('react-markdown')) as React.FC<ReactMarkdownOptions>;
const REMARK_PLUGINS = [remarkGfm];

const PANEL_WIDTH = 420;
export const AUTO_MATE_CHAT_PANEL_Z_INDEX = 300;

function MarkdownText({text}: {text: string}) {
    return (
        <div className={styles.markdown}>
            <Suspense fallback={<Text size="sm">{text}</Text>}>
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={CHAT_MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
            </Suspense>
        </div>
    );
}

function UserMessage() {
    return (
        <MessagePrimitive.Root className={`${styles.msg} ${styles.msgUser}`}>
            <MessagePrimitive.Parts/>
        </MessagePrimitive.Root>
    );
}

function SourceBadges() {
    const sources = useAuiState((s) => s.message.metadata.custom.sources) as KbSource[] | undefined;
    if (!sources?.length) return null;

    return (
        <Group gap={6} mt={6} role="list" aria-label="Sources">
            {sources.map((source) => (
                <Badge
                    key={source.articleId}
                    role="listitem"
                    variant="outline"
                    color="gray"
                    size="sm"
                    tt="none"
                    leftSection={<FileTextIcon size={12}/>}
                >
                    {source.title}
                </Badge>
            ))}
        </Group>
    );
}

/** Shown from the moment a question is sent until the answer's text streams, and again during later tool calls. */
function ChatStatus() {
    const label = useAuiState((s) => {
        if (s.message.status?.type !== 'running') return null;
        const status = s.message.metadata.custom.status as string | undefined;
        const hasText = s.message.parts.some((p) => p.type === 'text' && p.text.length > 0);
        return status ?? (hasText ? null : 'Thinking…');
    });
    if (!label) return null;

    return (
        <Group gap={6} mt={4} role="status" aria-live="polite">
            <AutoMateLogo size={14} animated/>
            <Text size="xs" c="dimmed">{label}</Text>
        </Group>
    );
}

function AssistantMessage() {
    return (
        <MessagePrimitive.Root className={`${styles.msg} ${styles.msgAssistant}`}>
            <MessagePrimitive.Parts components={{Text: MarkdownText}}/>
            <ChatStatus/>
            <SourceBadges/>
        </MessagePrimitive.Root>
    );
}

function ChatHeaderLogo() {
    const isRunning = useAuiState((s) => s.thread.isRunning);
    return <AutoMateLogo size={22} animated={isRunning}/>;
}

export const AutoMateChatPanel: React.FC = () => {
    const {isOpen, chatEnabled, close} = useAutoMateChat();
    const {currentState} = useNavigation();
    const [searchParams] = useSearchParams();
    const rawJobId = searchParams.get('jobId');
    const jobId = rawJobId && Number.isFinite(Number(rawJobId)) ? Number(rawJobId) : undefined;

    // useLocalRuntime creates the runtime once and re-applies the adapter on every
    // render, so rebuilding the adapter when the page changes updates the page
    // context without resetting the conversation.
    const adapter = useMemo(
        () => createChatAdapter(() => getPageContext(currentState, jobId)),
        [currentState, jobId],
    );
    const runtime = useLocalRuntime(adapter);
    const suggestions = useMemo(() => getSuggestedPrompts(currentState, jobId), [currentState, jobId]);

    if (!chatEnabled) return null;

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <Transition mounted={isOpen} transition="slide-up" duration={200}>
                {(transitionStyles) => (
                    <Paper
                        shadow="xl"
                        radius="lg"
                        withBorder
                        style={{
                            ...transitionStyles,
                            position: 'fixed',
                            bottom: 24,
                            right: 24,
                            width: `min(calc(100% - 48px), ${PANEL_WIDTH}px)`,
                            height: 520,
                            maxHeight: 'calc(100vh - 48px)',
                            zIndex: AUTO_MATE_CHAT_PANEL_Z_INDEX,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        <Group
                            gap="xs"
                            px="md"
                            py="sm"
                            wrap="nowrap"
                            style={{
                                borderBottom: '1px solid var(--mantine-color-default-border)',
                                backgroundColor: 'var(--mantine-primary-color-light)',
                            }}
                        >
                            <ChatHeaderLogo/>
                            <Text fw={700} size="sm" style={{flex: 1}}>
                                Auto-mate assistant
                            </Text>
                            <ActionIcon variant="subtle" color="gray" onClick={close} aria-label="Close assistant">
                                <CloseIcon size={18}/>
                            </ActionIcon>
                        </Group>

                        <Box style={{flex: 1, minHeight: 0}}>
                            <ThreadPrimitive.Root className={styles.root}>
                                <ThreadPrimitive.Viewport className={styles.viewport} autoScroll>
                                    <ThreadPrimitive.Empty>
                                        <div className={styles.suggestions}>
                                            {suggestions.map((p) => (
                                                <ThreadPrimitive.Suggestion
                                                    key={p.prompt}
                                                    className={styles.suggestion}
                                                    prompt={p.prompt}
                                                    send
                                                >
                                                    {p.label}
                                                </ThreadPrimitive.Suggestion>
                                            ))}
                                        </div>
                                    </ThreadPrimitive.Empty>

                                    <ThreadPrimitive.Messages>
                                        {({message}) => (message.role === 'user' ? <UserMessage/> : <AssistantMessage/>)}
                                    </ThreadPrimitive.Messages>
                                </ThreadPrimitive.Viewport>

                                <ComposerPrimitive.Root className={styles.composer}>
                                    <ComposerPrimitive.Input
                                        className={styles.input}
                                        placeholder="Ask Auto-mate…"
                                        rows={1}
                                    />
                                    <ComposerPrimitive.Send className={styles.send} aria-label="Send message">
                                        <SendIcon size={16}/>
                                    </ComposerPrimitive.Send>
                                </ComposerPrimitive.Root>
                            </ThreadPrimitive.Root>
                        </Box>
                    </Paper>
                )}
            </Transition>
        </AssistantRuntimeProvider>
    );
};

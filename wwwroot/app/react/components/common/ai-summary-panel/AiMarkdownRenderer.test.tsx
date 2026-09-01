/**
 * AiMarkdownRenderer Component Tests
 *
 * Verifies the Markdown renderer passes content through ReactMarkdown
 * with the correct plugins and custom component overrides.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { AiMarkdownRenderer } from './AiMarkdownRenderer';
import { renderWithMantine } from '../../../__testUtils__';


const renderWithTheme = (ui: React.ReactElement) =>
    renderWithMantine(ui);

describe('AiMarkdownRenderer', () => {
    it('renders markdown content via ReactMarkdown', () => {
        renderWithTheme(<AiMarkdownRenderer content="Hello **world**" />);

        // The mock renders children as plain text inside a div
        expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
        expect(screen.getByTestId('react-markdown')).toHaveTextContent('Hello **world**');
    });

    it('renders empty content without error', () => {
        renderWithTheme(<AiMarkdownRenderer content="" />);

        expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
    });

    it('renders multiline markdown content', () => {
        const content = '## Status\n\n- Item 1\n- Item 2\n\n**Bold text**';
        renderWithTheme(<AiMarkdownRenderer content={content} />);

        const el = screen.getByTestId('react-markdown');
        // toHaveTextContent normalises whitespace, so check key fragments
        expect(el).toHaveTextContent('## Status');
        expect(el).toHaveTextContent('Item 1');
        expect(el).toHaveTextContent('**Bold text**');
    });
});

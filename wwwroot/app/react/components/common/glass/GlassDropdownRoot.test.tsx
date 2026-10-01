import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { dfrntTheme, dfrntCssVariablesResolver } from '../../../theme/dfrntMantineTheme';
import glassClasses from '../../../theme/glass.module.css';
import { GlassDropdownRoot, LENS_MOUNT_DELAY_MS } from './GlassDropdownRoot';

const mockUseGlassStrategy = jest.fn();
jest.mock('../../../theme/glass.module.css', () => ({ __esModule: true, default: { glass: 'glass', panel: 'panel' } }));
jest.mock('../../../hooks/useGlassStrategy', () => ({ useGlassStrategy: () => mockUseGlassStrategy() }));
jest.mock('./lens/SvgBackdropLens', () => ({ SvgBackdropLens: () => <span data-testid="svg-lens" /> }));

function renderRoot(props: Partial<React.ComponentProps<typeof GlassDropdownRoot>> = {}) {
  const ref = createRef<HTMLDivElement>();
  const utils = render(
    <MantineProvider theme={dfrntTheme} forceColorScheme="light" cssVariablesResolver={dfrntCssVariablesResolver}>
      <GlassDropdownRoot ref={ref} className={glassClasses.glass} role="menu" {...props}>
        <button type="button">item</button>
      </GlassDropdownRoot>
    </MantineProvider>,
  );
  return { ...utils, ref };
}

function settle() {
  act(() => {
    jest.advanceTimersByTime(LENS_MOUNT_DELAY_MS);
  });
}

describe('GlassDropdownRoot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.setItem('dd-liquid-glass', 'on');
  });
  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('strips the glass classes while Liquid Glass is off (the default)', () => {
    localStorage.removeItem('dd-liquid-glass');
    mockUseGlassStrategy.mockReturnValue('svg');
    renderRoot({ className: `${glassClasses.glass} ${glassClasses.panel} keep` });
    settle();

    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('keep');
    expect(menu).not.toHaveClass('glass');
    expect(menu).not.toHaveClass('panel');
    expect(screen.queryByTestId('svg-lens')).not.toBeInTheDocument();
  });

  it('defers the lens until the open animation has settled, showing plain CSS glass meanwhile', () => {
    mockUseGlassStrategy.mockReturnValue('svg');
    renderRoot();

    expect(screen.getByRole('menu')).not.toHaveAttribute('data-liquid-glass');
    expect(screen.queryByTestId('svg-lens')).not.toBeInTheDocument();
    settle();
    expect(screen.getByRole('menu')).toHaveAttribute('data-liquid-glass', 'svg');
    expect(screen.getByTestId('svg-lens')).toBeInTheDocument();
  });

  it('adds the liquid-glass marker and renders content when the class is present and the browser supports it', () => {
    mockUseGlassStrategy.mockReturnValue('svg');
    const { ref } = renderRoot();
    settle();

    const dropdown = screen.getByRole('menu');
    expect(dropdown).toHaveAttribute('data-liquid-glass');
    expect(ref.current).toBe(dropdown);
    expect(screen.getByRole('button', { name: 'item' })).toBeInTheDocument();
  });

  it('renders the live SVG lens on Chromium', () => {
    mockUseGlassStrategy.mockReturnValue('svg');
    renderRoot();
    settle();

    expect(screen.getByRole('menu')).toHaveAttribute('data-liquid-glass', 'svg');
    expect(screen.getByTestId('svg-lens')).toBeInTheDocument();
  });

  it('does not add the marker when the browser cannot render the effect, even with the glass class', () => {
    mockUseGlassStrategy.mockReturnValue('css');
    renderRoot();

    expect(screen.getByRole('menu')).not.toHaveAttribute('data-liquid-glass');
  });

  it('does not add the marker for dropdowns without the glass class (e.g. Select/Autocomplete combobox)', () => {
    mockUseGlassStrategy.mockReturnValue('svg');
    renderRoot({ className: 'some-other-dropdown-class' });

    expect(screen.getByRole('menu')).not.toHaveAttribute('data-liquid-glass');
  });

  it('keeps the ref pointing at the real DOM node regardless of which branch renders', () => {
    mockUseGlassStrategy.mockReturnValue('css');
    const { ref } = renderRoot();

    expect(ref.current).toBe(screen.getByRole('menu'));
  });
});

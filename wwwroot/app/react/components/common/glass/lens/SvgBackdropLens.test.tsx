import { render } from '@testing-library/react';
import { SvgBackdropLens } from './SvgBackdropLens';

jest.mock('../glassLayer.module.css', () => ({ __esModule: true, default: { layer: 'layer', svgDefs: 'defs', backdrop: 'backdrop' } }));

function renderLens() {
  const host = document.createElement('div');
  host.getBoundingClientRect = () => ({ width: 120, height: 80 }) as DOMRect;
  document.body.appendChild(host);
  return render(<SvgBackdropLens hostRef={{ current: host }} />);
}

describe('SvgBackdropLens', () => {
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData: jest.fn() } as never);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    (globalThis as { ImageData?: unknown }).ImageData ??= class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  });
  afterEach(() => jest.restoreAllMocks());

  it('refracts the backdrop with a single displacement pass, to keep the CPU-rasterised filter cheap', () => {
    const { container } = renderLens();

    expect(container.querySelectorAll('feDisplacementMap')).toHaveLength(1);
  });
});

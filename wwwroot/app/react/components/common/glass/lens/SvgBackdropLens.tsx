import { useId, useMemo, type RefObject } from 'react';
import classes from '../glassLayer.module.css';
import { renderDisplacementMap, type DisplacementMap } from './displacementMap';
import { LENS_OPTICS, lensBezel } from './lensConfig';
import { useHostGeometry } from './useHostGeometry';

interface SvgBackdropLensProps {
  hostRef: RefObject<HTMLElement | null>;
}

function mapToDataUrl(map: DisplacementMap): string {
  const canvas = document.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
  return canvas.toDataURL();
}

/**
 * Chromium lens: `backdrop-filter: url(#filter)` bends the live page behind the host with an
 * feDisplacementMap driven by the refraction map. One pass only: Chromium rasterises backdrop
 * SVG filters on the CPU, and the old per-channel aberration (3 displacements + blends) tripled that.
 * The host's own CSS backdrop-filter must be off (see `.glass[data-liquid-glass='svg']`), or it
 * becomes the backdrop root and this layer would only see the host.
 */
export function SvgBackdropLens({ hostRef }: SvgBackdropLensProps) {
  const geometry = useHostGeometry(hostRef);
  const filterId = `glass-${useId().replace(/:/g, '')}`;

  const lens = useMemo(() => {
    if (!geometry) return null;
    const map = renderDisplacementMap({
      width: geometry.width,
      height: geometry.height,
      radius: geometry.radius,
      bezel: lensBezel(geometry),
      optics: LENS_OPTICS,
    });
    return { map, url: mapToDataUrl(map) };
  }, [geometry]);

  if (!geometry || !lens?.url) return null;

  const scale = lens.map.max * 2;

  return (
    <span aria-hidden className={classes.layer}>
      <svg className={classes.svgDefs} width="0" height="0" focusable="false">
        <filter
          id={filterId}
          x="0"
          y="0"
          width={geometry.width}
          height={geometry.height}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={lens.url}
            x="0"
            y="0"
            width={geometry.width}
            height={geometry.height}
            preserveAspectRatio="none"
            result="map"
          />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span className={classes.backdrop} style={{ backdropFilter: `url(#${filterId}) blur(2px) saturate(1.6)` }} />
    </span>
  );
}

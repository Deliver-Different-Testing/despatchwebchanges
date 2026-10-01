import { useEffect, useState, type RefObject } from 'react';

export interface HostGeometry {
  width: number;
  height: number;
  /** Top-left corner radius in px. */
  radius: number;
}

/** Tracks the host element's rounded size; `null` until it has been laid out. */
export function useHostGeometry(hostRef: RefObject<HTMLElement | null>): HostGeometry | null {
  const [geometry, setGeometry] = useState<HostGeometry | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width === 0 || height === 0) return;
      const radius = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0;
      setGeometry((previous) =>
        previous && previous.width === width && previous.height === height && previous.radius === radius
          ? previous
          : { width, height, radius },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);

  return geometry;
}

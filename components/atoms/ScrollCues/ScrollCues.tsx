import React, { useRef, useEffect, useState } from 'react';

/**
 * ScrollCues – a wrapper that adds subtle edge‑fade gradients when its children overflow
 * horizontally. It uses a ResizeObserver to detect overflow changes and toggles the
 * visibility of left/right gradient elements. The component is accessible: it has a
 * `role="region"` and `aria-label` that can be passed via props.
 */
export default function ScrollCues({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateOverflow = () => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft + clientWidth < scrollWidth);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateOverflow();
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    el.addEventListener('scroll', updateOverflow);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateOverflow);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef} {...rest}>
      {showLeft && (
        <span className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white via-white/80 to-transparent" />
      )}
      {showRight && (
        <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent" />
      )}
      <div className="overflow-x-auto hide-scrollbar" style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

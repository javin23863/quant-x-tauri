import { useState, useEffect, useRef, useCallback } from 'react';

interface FactoryLayoutProps {
  topPane?: React.ReactNode;
  bottomPane?: React.ReactNode;
}

export default function FactoryLayout({ topPane, bottomPane }: FactoryLayoutProps) {
  const [topHeight, setTopHeight] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newTopHeight = ((e.clientY - rect.top) / rect.height) * 100;
      setTopHeight(Math.max(20, Math.min(80, newTopHeight)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return (
    <div className="factory-layout" ref={containerRef}>
      <div className="factory-top-pane-wrapper" style={{ height: `${topHeight}%` }}>
        {topPane}
      </div>

      <div
        className={`factory-divider ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="factory-divider-track">
          <div className="factory-divider-handle">
            <div className="factory-divider-grip"></div>
          </div>
        </div>
      </div>

      <div className="factory-bottom-pane-wrapper" style={{ height: `${100 - topHeight}%` }}>
        {bottomPane}
      </div>
    </div>
  );
}
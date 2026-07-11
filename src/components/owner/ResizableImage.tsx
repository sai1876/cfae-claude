import React, { useState, useRef, useEffect } from 'react';

interface ResizableImageProps {
  initialScale: number;
  onScaleChange: (newScale: number) => void;
  children: React.ReactNode;
  isActive?: boolean;
}

export default function ResizableImage({ initialScale, onScaleChange, children, isActive = true }: ResizableImageProps) {
  const [scale, setScale] = useState(initialScale || 1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ y: 0 });
  const [startScale, setStartScale] = useState(1.0);
  const [isSelected, setIsSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScale(initialScale || 1.0);
  }, [initialScale]);

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setStartPos({ y: e.clientY });
    setStartScale(scale);
    
    // Capture pointer so dragging works even if cursor leaves the handle
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    
    // Calculate difference in Y (dragging up makes it bigger, dragging down makes it smaller)
    const diffY = startPos.y - e.clientY;
    
    // Sensitivity multiplier
    const sensitivity = 0.01;
    let newScale = startScale + (diffY * sensitivity);
    
    // Clamp scale between 0.5 and 3.0
    newScale = Math.max(0.5, Math.min(newScale, 3.0));
    
    setScale(newScale);
    onScaleChange(newScale);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative group w-full h-full flex items-center justify-center transition-all ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#120803] rounded-md' : ''}`}
      onClick={(e) => {
        if (!isActive) return;
        e.stopPropagation();
        setIsSelected(true);
      }}
      style={{ touchAction: 'none' }} // Prevent scrolling while interacting
    >
      {/* The wrapped image with applied scale */}
      <div 
        className="relative w-full h-full flex items-center justify-center pointer-events-none"
        style={{ transform: `scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.1s' }}
      >
        {children}
      </div>

      {/* Resize Handle (PPT style corner dot) */}
      {isSelected && isActive && (
        <div
          className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-cyan-500 rounded-full cursor-ns-resize shadow-md flex items-center justify-center z-50 hover:scale-110 active:scale-95 transition-transform"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="Drag up/down to scale image"
        >
          <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full pointer-events-none" />
        </div>
      )}
      
      {/* Scale tooltip helper */}
      {isDragging && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap border border-white/10">
          Scale: {scale.toFixed(2)}x
        </div>
      )}
    </div>
  );
}

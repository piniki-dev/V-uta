import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rect' | 'circle' | 'text';
}

export default function Skeleton({ className = '', width, height, variant = 'rect' }: SkeletonProps) {
  const baseStyles = "bg-[var(--bg-tertiary)] relative overflow-hidden";
  const variantStyles = {
    rect: "rounded-2xl",
    circle: "rounded-full",
    text: "rounded-md h-4",
  };

  return (
    <div 
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    >
      <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent shadow-[inset_-20px_0_20px_rgba(255,255,255,0.02)]" />
      <style>{`
        .skeleton-shimmer {
          animation: shimmer 1.5s linear infinite;
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

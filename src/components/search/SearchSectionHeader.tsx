'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  iconColorClass: string;
  glowClass?: string;
}

export default function SearchSectionHeader({ children, iconColorClass, glowClass = 'shadow-[0_0_20px_var(--accent-glow)]' }: Props) {
  return (
    <motion.div 
      className="flex items-center gap-4 mb-10"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
    >
      <div className={`w-2 h-10 ${iconColorClass} rounded-full ${glowClass}`} />
      <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-4 glow-text-subtle">
        {children}
      </h2>
    </motion.div>
  );
}

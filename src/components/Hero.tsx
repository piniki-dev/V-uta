'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface HeroProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  image?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  centered?: boolean;
  containerClass?: string;
}

export default function Hero({
  title,
  description,
  icon,
  image,
  badge,
  actions,
  centered = false,
  containerClass = '',
}: HeroProps) {
  return (
    <motion.section
      className="relative overflow-hidden border-b border-[var(--border)] py-12 md:py-16 mesh-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/5 to-[var(--bg-primary)]/10 pointer-events-none" />

      <div className={`container relative z-10 w-full px-6 ${containerClass}`}>
        <div className={`flex flex-col ${centered ? 'items-center text-center' : 'md:flex-row items-center md:items-end gap-10 md:text-left text-center'}`}>

          {/* アイコン・画像エリア */}
          {(icon || image) && !centered && (
            <motion.div
              className="relative group/artwork shrink-0"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div className="absolute inset-0 bg-[var(--accent)]/20 rounded-3xl blur-2xl opacity-0 group-hover/artwork:opacity-100 transition-opacity duration-700" />

              <div className="w-32 h-32 md:w-44 md:h-44 bg-gradient-to-br from-[#ff4e8e] to-[#8e4eff] rounded-3xl flex items-center justify-center text-white shadow-2xl relative z-10 overflow-hidden ring-4 ring-white/10 group-hover/artwork:scale-105 transition-transform duration-500">
                {image ? (
                  <Image
                    src={image}
                    alt={typeof title === 'string' ? title : 'Hero Image'}
                    width={176}
                    height={176}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/artwork:scale-110"
                  />
                ) : (
                  <div className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                    {icon}
                  </div>
                )}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/artwork:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          )}

          <div className="flex-1 flex flex-col items-center md:items-start w-full">
            {badge && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-[var(--bg-tertiary)] text-[var(--accent)] px-4 py-1.5 rounded-full border border-[var(--border)] shadow-sm">
                  {badge}
                </span>
              </motion.div>
            )}

            <motion.h1
              className={`font-black mb-4 tracking-tight text-[var(--text-primary)] glow-text drop-shadow-sm ${centered ? 'text-3xl md:text-6xl' : 'text-3xl md:text-5xl'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {title}
            </motion.h1>

            {description && (
              <motion.div
                className="text-[var(--text-secondary)] text-lg md:text-xl mb-6 max-w-2xl font-medium leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {description}
              </motion.div>
            )}

            {actions && (
              <motion.div
                className={`flex flex-wrap gap-4 ${centered ? 'justify-center' : 'md:justify-start justify-center'} items-center`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {actions}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

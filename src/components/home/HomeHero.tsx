'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';

export default function HomeHero() {
  const { T } = useLocale();

  return (
    <motion.section 
      className="relative overflow-hidden border-b border-[var(--border)] py-24 md:py-32 mb-12 mesh-bg"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      viewport={{ once: true }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/5 to-[var(--bg-primary)]/20 pointer-events-none" />
      
      <div className="container relative z-10 w-full px-6 flex flex-col items-center text-center">
        <motion.h1 
          className="text-4xl md:text-8xl font-black mb-8 tracking-tighter leading-[1.05]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="block text-[var(--text-primary)] opacity-90">{T('home.heroTitle1')}</span>
          <span className="hero__accent glow-text block mt-2">{T('home.heroTitle2')}</span>
        </motion.h1>
        
        <motion.p 
          className="text-[var(--text-secondary)] text-lg md:text-2xl mb-12 max-w-3xl font-medium leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {T('home.heroSub1')}
          <br className="hidden md:block" />
          {T('home.heroSub2')}
        </motion.p>
        
        <motion.div 
          className="flex flex-wrap justify-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <Link 
            href="/songs/new" 
            className="group relative px-10 py-5 bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] text-white font-black rounded-3xl shadow-2xl shadow-[var(--accent)]/30 transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2 text-lg">
              {T('home.registerBtn')}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          </Link>
          
          <Link 
            href="/search" 
            className="px-10 py-5 bg-[var(--bg-secondary)]/50 backdrop-blur-md border border-[var(--border)] text-[var(--text-primary)] font-black rounded-3xl hover:bg-[var(--bg-hover)] transition-all hover:scale-105 active:scale-95"
          >
            {T('search.title')}
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

'use client';

import { useSidebar } from './SidebarContext';
import { ReactNode } from 'react';

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();

  return (
    <div className={`layout-content ${isOpen ? 'sidebar-open' : ''}`}>
      {children}
      <style jsx>{`
        .layout-content {
          flex: 1;
          width: 100%;
          transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          min-width: 0;
        }

        @media (min-width: 769px) {
          .layout-content.sidebar-open {
            padding-left: var(--sidebar-width);
          }
        }
      `}</style>
    </div>
  );
}

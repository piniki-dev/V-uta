import React, { useId } from 'react';
import Script from 'next/script';

interface JsonLdProps {
  data: Record<string, unknown>;
  id?: string;
}

export default function JsonLd({ data, id }: JsonLdProps) {
  const defaultId = useId();
  
  return (
    <Script
      id={id || defaultId}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      strategy="afterInteractive"
    />
  );
}

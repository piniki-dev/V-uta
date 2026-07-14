import Home from './Home';
import { translations } from '@/lib/translations';
import JsonLd from '@/components/JsonLd';

export function generateMetadata() {
  const t = translations['ja'];

  return {
    title: `${t.common.siteTitle} | ${t.home.title}`,
    description: t.home.description,
  };
}

export default function HomePage() {
  const t = translations['ja'];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": t.common.siteTitle,
    "url": baseUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  const softwareData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": t.common.siteTitle,
    "operatingSystem": "Any",
    "applicationCategory": "MultimediaApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "JPY"
    },
    "description": t.home.description,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5",
      "ratingCount": "100"
    }
  };

  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": t.common.siteTitle,
    "url": baseUrl,
    "logo": `${baseUrl}/icon-512.png`, // 仮
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "url": `${baseUrl}/contact`
    }
  };

  return (
    <>
      <JsonLd data={websiteData} />
      <JsonLd data={softwareData} />
      <JsonLd data={organizationData} />
      <Home />
    </>
  );
}

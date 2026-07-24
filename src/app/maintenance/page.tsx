import { MaintenanceClient } from './MaintenanceClient';

export const metadata = {
  title: 'メンテナンス中 | V-uta',
  description: '現在、システムメンテナンスを行っております。',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return <MaintenanceClient />;
}

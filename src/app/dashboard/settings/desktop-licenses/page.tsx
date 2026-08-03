import React from 'react';
import Link from 'next/link';
import { getDesktopLicenses } from '@/lib/actions/licenses';
import ConnectedDevicesClient from './ConnectedDevicesClient';
import { ArrowLeft } from 'lucide-react';

export default async function ConnectedDevicesPage() {
  const { licenses } = await getDesktopLicenses();
  return (
    <div className="max-w-7xl mx-auto px-0 md:px-4 pt-2 pb-8 md:py-8">
      <Link
        href="/dashboard/settings?tab=farm"
        className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-emerald-400 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Connected <span className="text-emerald-400">Devices</span>
        </h1>
        <p className="text-white/70 mt-2">
          Every desktop or mobile device linked to this farm. Devices
          automatically receive access when your farm subscription is active.
        </p>
      </div>
      <ConnectedDevicesClient licenses={licenses} />
    </div>
  );
}

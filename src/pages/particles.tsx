'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const ParticlesJS = dynamic(() => import('./particles.js'), { ssr: false });

export default function ParticlesPage() {
  return null; // This page doesn't render anything visible
}

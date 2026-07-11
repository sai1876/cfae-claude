'use client';

import React, { Suspense } from 'react';
import AuthWorkspace from '@/components/auth/AuthWorkspace';

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060403] text-[#f7dec4] flex items-center justify-center font-mono text-xs uppercase tracking-widest">
        Loading Auth Workspace...
      </div>
    }>
      <AuthWorkspace defaultTab="signup" />
    </Suspense>
  );
}

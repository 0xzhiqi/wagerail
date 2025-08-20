"use client";

import { SessionProvider } from "next-auth/react";
import { ThirdwebProvider } from "thirdweb/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThirdwebProvider>
        {children}
      </ThirdwebProvider>
    </SessionProvider>
  );
}
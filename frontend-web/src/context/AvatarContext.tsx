import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";

interface AvatarContextType {
  avatarBuster: number;
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser();
  const [avatarBuster, setAvatarBuster] = useState(0);
  const prevAvatarRef = useRef<string | null>(null);

  // Track avatar URL changes - force cache bust when it changes
  useEffect(() => {
    if (currentUser?.avatarUrl && currentUser.avatarUrl !== prevAvatarRef.current) {
      console.log("🎨 Avatar URL changed - cache busting...");
      prevAvatarRef.current = currentUser.avatarUrl;
      setAvatarBuster(prev => prev + 1);
    }
  }, [currentUser?.avatarUrl]);

  return (
    <AvatarContext.Provider value={{ avatarBuster }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatarBuster() {
  const context = useContext(AvatarContext);
  if (context === undefined) {
    throw new Error("useAvatarBuster must be used within AvatarProvider");
  }
  return context.avatarBuster;
}

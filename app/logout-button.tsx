"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Cerrar sesión"
      className={
        compact
          ? "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white"
          : "mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white"
      }
    >
      <LogOut size={18} strokeWidth={1.8} />
      <span className={compact ? "hidden 2xl:inline" : ""}>Cerrar sesión</span>
    </button>
  );
}

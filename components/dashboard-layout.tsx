"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, Sun, Moon, LayoutDashboard, Loader2, ChevronRight, Bus } from "lucide-react";
import { supabase } from "@/lib/supabase"; 
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react"
import { NotificationsBell } from "@/components/notifications-bell";

const getDashboardPath = (role: string): string => {
    switch (role.toLowerCase()) {
        case 'propietario':
        case 'admin':
            return "/dashboard/propietario";
        case 'tutor':
            return "/dashboard/tutor";
        case 'asistente':
            return "/dashboard/asistente";
        default:
            return "/";
    }
};

export interface MenuItem {
  title: string;
  icon: LucideIcon;
  href: string;
  description?: string;
  color?: string;
  bgColor?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  menuItems: MenuItem[]
}

export function DashboardLayout({ children, title, menuItems }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Lógica de Tema ---
  useEffect(() => {
    const theme = localStorage.getItem("app-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (theme === "dark" || (!theme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  
  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    if (newIsDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem("app-theme", "dark");
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem("app-theme", "light");
    }
  }

  // --- Lógica de Autenticación ---
  useEffect(() => {
    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                router.push("/login");
                return;
            }
            
            const userMetadata = session.user.user_metadata;
            const rol = userMetadata?.rol?.toLowerCase();
            
            if (rol !== 'propietario' && rol !== 'admin') {
                router.push(getDashboardPath(rol || '')); 
                return;
            }

            setUser({
                name: userMetadata?.nombre || "Administrador",
                role: "Propietario"
            });

        } catch (error) {
            console.error("Error al verificar sesión:", error);
            router.push("/login");
        } finally {
            setLoading(false);
        }
    };

    checkAuth();
  }, [router]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("rememberedUser");
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-violet-400 animate-spin" />
            <Bus className="absolute inset-0 m-auto h-7 w-7 text-violet-300" />
          </div>
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase">Cargando...</p>
        </div>
      </div>
    );
  }
  
  if (!user) return null;

  const mainDashboardPath = getDashboardPath('propietario');
  const isSubPage = pathname !== mainDashboardPath;

  // Iniciales del usuario
  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground">

      {/* ============================================ */}
      {/* HEADER PREMIUM                               */}
      {/* ============================================ */}
      <header className="sticky top-0 z-40 w-full">
        {/* Fondo glassmorphism */}
        <div className="relative border-b border-white/10 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            
            {/* ---- Izquierda: Hamburger + Logo + Título ---- */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="group relative flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 transition-all hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:scale-105 active:scale-95"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Logo + Nombre */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 shadow-md shadow-violet-500/30">
                  <Bus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none">{title}</h1>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-0.5 hidden md:block">
                    Recorrido Escolar
                  </p>
                </div>
              </div>
            </div>

            {/* ---- Derecha: Acciones ---- */}
            <div className="flex items-center gap-1.5 md:gap-2">
              
              {/* Campana de Notificaciones */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <NotificationsBell />
              </div>

              {/* Tema */}
              <button
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
                title={isDarkMode ? "Modo claro" : "Modo oscuro"}
              >
                {isDarkMode 
                  ? <Sun className="h-4 w-4 text-amber-400" /> 
                  : <Moon className="h-4 w-4" />
                }
              </button>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />

              {/* Avatar + Cerrar sesión */}
              <div className="flex items-center gap-2">
                {/* Avatar */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white text-[10px] font-bold">
                    {initials}
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{user.name}</span>
                </div>

                {/* Botón Cerrar Sesión */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 shadow-md shadow-violet-500/25 transition-all hover:scale-105 active:scale-95 hover:shadow-violet-500/40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Salir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================ */}
      {/* SIDEBAR PREMIUM (Drawer desde izquierda)     */}
      {/* ============================================ */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Overlay oscuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-72 z-50 flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)',
              }}
            >
              {/* Decoración de fondo */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-700/15 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

              {/* Header del Sidebar */}
              <div className="relative flex items-center justify-between px-5 py-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
                    <Bus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm leading-none">Recorrido</p>
                    <p className="text-violet-300 text-[10px] mt-0.5">Sistema Escolar</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Perfil de usuario */}
              <div className="relative px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 text-white text-sm font-bold shadow-lg shadow-violet-900/50 shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold leading-none truncate">{user.name}</p>
                    <p className="text-violet-300 text-[11px] mt-0.5">{user.role}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-400">Activo</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de menú */}
              <div className="relative flex-1 overflow-y-auto py-3 px-3 space-y-1">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 mb-2">Módulos</p>
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.25 }}
                    >
                      <Link href={item.href} onClick={() => setSidebarOpen(false)}>
                        <div className={`
                          group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200
                          ${isActive 
                            ? 'bg-white/15 border border-white/20 shadow-md' 
                            : 'hover:bg-white/8 border border-transparent hover:border-white/10'
                          }
                        `}>
                          {/* Indicador activo */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-violet-300" />
                          )}

                          {/* Icono */}
                          <div className={`
                            flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-all duration-200
                            ${isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'}
                          `}>
                            <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-violet-300 group-hover:text-white'}`} />
                          </div>

                          {/* Texto */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-none truncate ${isActive ? 'text-white' : 'text-violet-100 group-hover:text-white'}`}>
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-[10px] text-violet-400 group-hover:text-violet-300 mt-0.5 truncate transition-colors">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Flecha */}
                          <ChevronRight className={`h-3 w-3 shrink-0 transition-all duration-200 ${isActive ? 'text-white opacity-100' : 'text-violet-400 opacity-0 group-hover:opacity-100'}`} />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer del sidebar */}
              <div className="relative px-4 py-4 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/30 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      
      {/* ============================================ */}
      {/* CONTENIDO PRINCIPAL                          */}
      {/* ============================================ */}
      <main className="flex-1 p-4 md:p-6">
        {isSubPage && (
          <div className="mb-6">
            <button
              onClick={() => router.push(mainDashboardPath)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-violet-50 dark:group-hover:bg-violet-900/30 transition-colors">
                <LayoutDashboard className="h-3.5 w-3.5" />
              </div>
              Volver al Panel Principal
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
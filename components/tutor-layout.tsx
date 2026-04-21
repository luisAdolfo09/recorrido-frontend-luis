"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, Sun, Moon, Users, BarChart2, DollarSign, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { NotificationsBell } from "@/components/notifications-bell"

interface TutorLayoutProps {
  children: React.ReactNode
  title: string
}

export function TutorLayout({ children, title }: TutorLayoutProps) {
  const router = useRouter()
  const { toast } = useToast()
  
  const [pathname, setPathname] = useState("")
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPathname(window.location.pathname)
    }
  }, [])

  // --- Tema persistente ---
  useEffect(() => {
    const theme = localStorage.getItem("app-theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    if (theme === "dark" || (!theme && prefersDark)) {
      document.documentElement.classList.add("dark")
      setIsDarkMode(true)
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode
    setIsDarkMode(newIsDarkMode)
    if (newIsDarkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("app-theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("app-theme", "light")
    }
  }

  // --- Lógica de Autenticación ---
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push("/login")
          return
        }

        const userMetadata = session.user.user_metadata;
        const rol = userMetadata?.rol?.toLowerCase();
        
        if (rol !== 'tutor' && rol !== 'propietario' && rol !== 'padre') {
          router.push("/login")
          return
        }

        setUser({
          name: userMetadata?.nombre || "Tutor Familiar",
          role: rol === 'propietario' ? 'Administrador' : 'Tutor Familiar',
        })
        
      } catch (error) {
        console.error("Error auth:", error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [toast, router]) 

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem("rememberedUser")
    router.push("/login") 
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1b5680] dark:text-sky-400" />
          <p className="text-sm text-muted-foreground font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const navItems = [
    { title: "Resumen", icon: Users, href: "/dashboard/tutor" },
    { title: "Asistencias", icon: BarChart2, href: "/dashboard/tutor/asistencias" },
    { title: "Pagos", icon: DollarSign, href: "/dashboard/tutor/pagos" },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="bg-white/90 dark:bg-card/95 border-b border-border/60 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          
          {/* Izquierda: Título */}
          <div>
            <h1 className="text-lg font-bold text-[#151355] dark:text-slate-100 leading-none">{title}</h1>
            <p className="text-xs text-[#1b5680]/60 dark:text-sky-400/60 mt-0.5 font-medium">{user?.name}</p>
          </div>

          {/* Derecha: Acciones */}
          <div className="flex items-center gap-1.5 md:gap-2">
            
            <div className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted dark:hover:bg-accent transition-colors">
              <NotificationsBell />
            </div>

            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl 
                         text-[#1b5680]/70 dark:text-sky-300/70 
                         hover:bg-muted dark:hover:bg-accent 
                         transition-all hover:scale-105 active:scale-95"
              title={isDarkMode ? "Modo claro" : "Modo oscuro"}
            >
              {isDarkMode 
                ? <Sun className="h-4 w-4 text-amber-400" /> 
                : <Moon className="h-4 w-4 text-[#1b5680]" />
              }
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white 
                         btn-primary-gradient shadow-md shadow-blue-900/20 
                         transition-all hover:scale-105 active:scale-95 hover:opacity-90"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 pb-24">{children}</main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-card/95 border-t border-border/60 backdrop-blur-xl z-50 flex justify-around items-center pb-safe shadow-lg">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.title}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all ${
                isActive 
                  ? "text-[#151355] dark:text-sky-400 scale-105 font-semibold" 
                  : "text-muted-foreground hover:text-[#1b5680] dark:hover:text-sky-300"
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? "drop-shadow-sm" : ""}`} />
              <span className="text-[10px]">{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
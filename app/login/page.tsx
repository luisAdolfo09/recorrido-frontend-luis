"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bus, AlertCircle, Loader2, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("rememberedUser");
    if (savedUser) {
      setIdentifier(savedUser);
      setRemember(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://recorrido-backend-u2dd.onrender.com";
      
      // PASO 1: Buscar usuario en backend (Lookup)
      const lookupRes = await fetch(`${apiUrl}/users/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier }),
      });

      if (!lookupRes.ok) {
        if (lookupRes.status === 429) {
            throw new Error("Has realizado demasiadas solicitudes. Por favor espera 1 minuto antes de intentar de nuevo.");
        }
        const errorBody = await lookupRes.json().catch(() => ({}));
        throw new Error(errorBody.message || "Usuario no encontrado en el sistema.");
      }

      const { email: realEmail, rol: rawRole, estatus } = await lookupRes.json();
      const realRole = rawRole ? rawRole.toLowerCase().trim() : "";
      
      // PASO 2: Login en Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: realEmail,
        password: password,
      });

      if (error) throw error;

      // Sincronización de rol si es necesario
      if (data.user && data.user.user_metadata?.rol !== realRole) {
          await supabase.auth.updateUser({ data: { rol: realRole } });
          await supabase.auth.refreshSession();
      }

      if (remember) {
        localStorage.setItem("rememberedUser", identifier);
      } else {
        localStorage.removeItem("rememberedUser");
      }

      // ✅ PRIMER ACCESO: usuario tiene contraseña temporal → redirigir a cambio obligatorio
      if (estatus === "INVITADO") {
        toast({ title: "¡Bienvenido!", description: "Por seguridad, crea tu contraseña definitiva." });
        router.push("/primer-acceso");
        return;
      }

      toast({ title: "Bienvenido", description: "Accediendo al sistema..." });

      // Redirección según rol
      switch (realRole) {
        case 'propietario':
        case 'admin':
          router.push("/dashboard/propietario");
          break;
        case 'tutor':
        case 'padre':
          router.push("/dashboard/tutor"); 
          break;
        case 'asistente':
        case 'chofer':
          router.push("/dashboard/asistente");
          break;
        default:
           setError(`Tu usuario tiene rol "${realRole}" y no tiene panel asignado.`);
           await supabase.auth.signOut();
      }

    } catch (err: any) {
      console.error("Error login:", err);
      setError(err.message || "Error de conexión.");

      if (err.message?.includes("Invalid login credentials")) {
         setError("Contraseña incorrecta.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1a2a6c 0%, #1d4280 45%, #1b5680 100%)",
      }}
    >
      {/* Decoración de fondo — círculos difusos */}
      <div className="absolute top-0 -right-20 w-80 h-80 rounded-full bg-sky-400/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-blue-800/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/2 blur-3xl pointer-events-none" />

      {/* Card principal */}
      <div className="relative w-full max-w-md">
        {/* Glassmorphism card */}
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
          
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            {/* Logo */}
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl btn-primary-gradient flex items-center justify-center shadow-xl shadow-blue-900/40 border border-white/20">
              <Bus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Recorrido Escolar
            </h1>
            <p className="text-sky-200/70 text-sm mt-1.5 font-light">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {/* Formulario */}
          <div className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Campo Usuario */}
              <div className="space-y-1.5">
                <label htmlFor="identifier" className="text-xs font-semibold text-sky-200/80 uppercase tracking-wider">
                  Usuario o Teléfono
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-300/50" />
                  <input
                    id="identifier"
                    type="text"
                    placeholder="Ej: juan.perez"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all"
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-sky-200/80 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-300/50" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all"
                  />
                </div>
              </div>

              {/* Recordarme */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only peer"
                  />
                  <label
                    htmlFor="remember"
                    className="w-4 h-4 rounded border border-white/30 bg-white/10 flex items-center justify-center cursor-pointer 
                               peer-checked:bg-sky-500 peer-checked:border-sky-500 transition-all"
                  >
                    {remember && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </label>
                </div>
                <label htmlFor="remember" className="text-xs text-sky-200/70 cursor-pointer select-none font-medium">
                  Recordarme en este dispositivo
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/15 border border-red-400/30 text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botón Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white
                           bg-gradient-to-r from-sky-500 to-blue-600
                           hover:from-sky-400 hover:to-blue-500
                           shadow-lg shadow-blue-900/40
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition-all hover:scale-[1.02] active:scale-[0.98]
                           flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </button>
            </form>

            {/* Recuperar contraseña */}
            <div className="mt-6 text-center">
              <a
                href="/recuperar-contrasena"
                className="text-xs text-sky-300/70 hover:text-sky-200 transition-colors font-medium"
              >
                ¿Olvidaste tu contraseña? <span className="underline underline-offset-2">Recupérala aquí</span>
              </a>
            </div>
          </div>
        </div>

        {/* Tagline debajo */}
        <p className="text-center text-white/25 text-xs mt-5 font-light tracking-wide">
          Sistema de Gestión · Recorrido Escolar
        </p>
      </div>
    </div>
  );
}
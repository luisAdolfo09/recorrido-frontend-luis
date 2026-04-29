"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AlertCircle, Loader2, Lock, User, Eye, EyeOff, ShieldAlert, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Bus } from "lucide-react";

// ─── Constantes de protección anti brute-force ───────────────────────────────
const MAX_ATTEMPTS = 3;        // Intentos permitidos antes del bloqueo
const LOCKOUT_SECONDS = 60;    // Duración del bloqueo en segundos
const STORAGE_KEY = "login_lockout"; // Clave en localStorage

interface LockoutData {
  attempts: number;
  lockedUntil: number | null; // timestamp ms o null si no bloqueado
}

function getLockout(): LockoutData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { attempts: 0, lockedUntil: null };
}

function saveLockout(data: LockoutData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearLockout() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────

function LoginContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Estado de bloqueo
  const [lockoutRemaining, setLockoutRemaining] = useState(0); // segundos restantes
  const [failedAttempts, setFailedAttempts] = useState(0);

  // ── Inicializar desde localStorage ──────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem("rememberedUser");
    if (savedUser) {
      setIdentifier(savedUser);
      setRemember(true);
    }
    // Verificar si hay bloqueo activo
    const lockout = getLockout();
    setFailedAttempts(lockout.attempts);
    if (lockout.lockedUntil) {
      const remaining = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
      if (remaining > 0) setLockoutRemaining(remaining);
      else {
        // El bloqueo ya expiró, resetear intentos
        clearLockout();
      }
    }
  }, []);

  // ── Toast de éxito al llegar desde cambio de contraseña ──────────────────────
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("passwordChanged") === "1") {
      toast({
        title: "¡Contraseña creada con éxito!",
        description: "Ahora inicia sesión con tu nueva contraseña.",
      });
      // Limpiar el parámetro de la URL sin recargar
      window.history.replaceState({}, "", "/login");
    }
  }, [searchParams, toast]);

  // ── Contador regresivo del bloqueo ──────────────────────────────────────────
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          clearLockout();
          setFailedAttempts(0);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  // ── Registrar intento fallido ────────────────────────────────────────────────
  const registerFailedAttempt = useCallback(() => {
    const lockout = getLockout();
    const newAttempts = lockout.attempts + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
      saveLockout({ attempts: newAttempts, lockedUntil });
      setFailedAttempts(newAttempts);
      setLockoutRemaining(LOCKOUT_SECONDS);
      setError(
        `Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por ${LOCKOUT_SECONDS} segundos.`
      );
    } else {
      saveLockout({ attempts: newAttempts, lockedUntil: null });
      setFailedAttempts(newAttempts);
    }
  }, []);

  // ── Handler de login ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Verificar bloqueo activo
    const lockout = getLockout();
    if (lockout.lockedUntil && lockout.lockedUntil > Date.now()) {
      const remaining = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
      setLockoutRemaining(remaining);
      setError(`Acceso bloqueado. Espera ${remaining} segundos para intentar de nuevo.`);
      return;
    }

    setLoading(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://recorrido-backend-u2dd.onrender.com";

      // PASO 1: Buscar usuario en backend (Lookup)
      const lookupRes = await fetch(`${apiUrl}/users/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier }),
      });

      if (!lookupRes.ok) {
        if (lookupRes.status === 429) {
          throw new Error(
            "Has realizado demasiadas solicitudes. Por favor espera 1 minuto antes de intentar de nuevo."
          );
        }
        const errorBody = await lookupRes.json().catch(() => ({}));
        registerFailedAttempt();
        throw new Error(
          errorBody.message || "Usuario no encontrado en el sistema."
        );
      }

      const { email: realEmail, rol: rawRole, estatus } = await lookupRes.json();
      const realRole = rawRole ? rawRole.toLowerCase().trim() : "";

      // PASO 2: Login en Supabase
      const { data, error: supaError } = await supabase.auth.signInWithPassword({
        email: realEmail,
        password: password,
      });

      if (supaError) {
        // Contraseña incorrecta → registrar intento fallido
        registerFailedAttempt();
        throw supaError;
      }

      // Login exitoso → limpiar contador de intentos
      clearLockout();
      setFailedAttempts(0);

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

      // ✅ PRIMER ACCESO: usuario tiene contraseña temporal → redirigir
      if (estatus === "INVITADO") {
        toast({
          title: "¡Bienvenido!",
          description: "Por seguridad, crea tu contraseña definitiva.",
        });
        router.push("/primer-acceso");
        return;
      }

      toast({ title: "Bienvenido", description: "Accediendo al sistema..." });

      // Redirección según rol
      switch (realRole) {
        case "propietario":
        case "admin":
          router.push("/dashboard/propietario");
          break;
        case "tutor":
        case "padre":
          router.push("/dashboard/tutor");
          break;
        case "asistente":
        case "chofer":
          router.push("/dashboard/asistente");
          break;
        default:
          setError(`Tu usuario tiene rol "${realRole}" y no tiene panel asignado.`);
          await supabase.auth.signOut();
      }
    } catch (err: any) {
      console.error("Error login:", err);
      if (err.message?.includes("Invalid login credentials")) {
        setError("Contraseña incorrecta. Verifica e inténtalo de nuevo.");
      } else {
        setError(err.message || "Error de conexión.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockoutRemaining > 0;
  const attemptsLeft = MAX_ATTEMPTS - failedAttempts;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #1a2a6c 0%, #1d4280 45%, #1b5680 100%)",
      }}
    >
      {/* Decoración de fondo */}
      <div className="absolute top-0 -right-20 w-80 h-80 rounded-full bg-sky-400/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-blue-800/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/2 blur-3xl pointer-events-none" />

      {/* Card principal */}
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
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

            {/* Alerta de bloqueo activo */}
            {isLocked && (
              <div className="mb-4 flex flex-col items-center gap-2 p-4 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-sm text-center">
                <ShieldAlert className="h-8 w-8 text-red-300" />
                <p className="font-bold text-base text-red-100">Acceso Bloqueado Temporalmente</p>
                <p className="text-red-200/80">
                  Por seguridad, tu cuenta fue bloqueada después de {MAX_ATTEMPTS} intentos fallidos.
                </p>
                <div className="flex items-center gap-2 mt-1 bg-red-500/30 px-4 py-2 rounded-lg">
                  <Clock className="h-4 w-4 text-red-200 animate-pulse" />
                  <span className="font-mono font-bold text-lg text-red-100">
                    {lockoutRemaining}s
                  </span>
                  <span className="text-red-200/70 text-xs">para desbloquear</span>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">

              {/* Campo Usuario */}
              <div className="space-y-1.5">
                <label
                  htmlFor="identifier"
                  className="text-xs font-semibold text-sky-200/80 uppercase tracking-wider"
                >
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
                    disabled={loading || isLocked}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all"
                  />
                </div>
              </div>

              {/* Campo Contraseña con botón mostrar/ocultar */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-sky-200/80 uppercase tracking-wider"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-300/50" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || isLocked}
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all"
                  />
                  {/* Botón mostrar / ocultar contraseña */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading || isLocked}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-300/50 hover:text-sky-200 transition-colors disabled:opacity-40"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
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
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </label>
                </div>
                <label
                  htmlFor="remember"
                  className="text-xs text-sky-200/70 cursor-pointer select-none font-medium"
                >
                  Recordarme en este dispositivo
                </label>
              </div>

              {/* Advertencia de intentos restantes (sin bloqueo aún) */}
              {failedAttempts > 0 && !isLocked && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" />
                  <span>
                    Contraseña incorrecta.{" "}
                    <strong>
                      {attemptsLeft > 0
                        ? `Te queda${attemptsLeft === 1 ? "" : "n"} ${attemptsLeft} intento${attemptsLeft === 1 ? "" : "s"}.`
                        : ""}
                    </strong>{" "}
                    Después de {MAX_ATTEMPTS} intentos fallidos tu acceso será bloqueado por {LOCKOUT_SECONDS} segundos.
                  </span>
                </div>
              )}

              {/* Error general */}
              {error && !isLocked && failedAttempts === 0 && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/15 border border-red-400/30 text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Error sin intentos fallidos rastreados (p.ej. usuario no encontrado) */}
              {error && failedAttempts > 0 && !isLocked && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/15 border border-red-400/30 text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Botón Submit */}
              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full py-3 rounded-xl text-sm font-bold text-white
                           bg-gradient-to-r from-sky-500 to-blue-600
                           hover:from-sky-400 hover:to-blue-500
                           shadow-lg shadow-blue-900/40
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition-all hover:scale-[1.02] active:scale-[0.98]
                           flex items-center justify-center gap-2"
              >
                {isLocked ? (
                  <>
                    <Clock className="h-4 w-4 animate-pulse" />
                    Bloqueado ({lockoutRemaining}s)
                  </>
                ) : loading ? (
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
                ¿Olvidaste tu contraseña?{" "}
                <span className="underline underline-offset-2">
                  Recupérala aquí
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-white/25 text-xs mt-5 font-light tracking-wide">
          Sistema de Gestión · Recorrido Escolar
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
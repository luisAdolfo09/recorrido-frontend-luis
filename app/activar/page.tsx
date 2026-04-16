/**
 * Página de Activación de Cuenta / Restablecer Contraseña
 *
 * Diseño profesional:
 * - NO usa window.history.replaceState (rompe browsers embebidos de WhatsApp)
 * - Valida el token contra el backend AL CARGAR, antes de mostrar el formulario
 * - Muestra el nombre y usuario al que pertenece el enlace
 * - Funciona en cualquier browser, incluyendo el in-app de WhatsApp
 */
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  Lock,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  ArrowRight,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://recorrido-backend-u2dd.onrender.com";

// ─── Vista de carga ───────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-sm">Verificando enlace…</p>
    </div>
  );
}

// ─── Vista de error ───────────────────────────────────────────────────────────
function ErrorView({ mensaje }: { mensaje: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md text-center border-red-200 bg-red-50 shadow-lg">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-800">
            Enlace inválido o caducado
          </h2>
          <p className="text-red-700/80 text-sm leading-relaxed">{mensaje}</p>
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => (window.location.href = "/login")}
          >
            Ir al inicio de sesión <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Vista de éxito ───────────────────────────────────────────────────────────
function SuccessView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
      <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-green-800">¡Cuenta Activada!</h2>
        <p className="text-green-700 text-sm">
          Tu contraseña ha sido guardada correctamente.
        </p>
        <p className="text-green-600 text-sm font-medium">
          Redirigiendo al login…
        </p>
        <Loader2 className="h-5 w-5 animate-spin text-green-600 mx-auto" />
      </div>
    </div>
  );
}

// ─── Contenido principal (necesita useSearchParams, va dentro de Suspense) ────
function ActivarContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // Estados de la pantalla
  const [step, setStep] = useState<"validando" | "form" | "exito" | "error">(
    "validando"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [userInfo, setUserInfo] = useState<{
    nombre: string;
    username: string;
  } | null>(null);

  // Campos del formulario
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ── Paso 1: Validar token contra el backend al cargar ──────────────────────
  useEffect(() => {
    if (!token) {
      setErrorMsg(
        "No se encontró el código de activación. Abre el enlace completo que recibiste por WhatsApp."
      );
      setStep("error");
      return;
    }

    let cancelled = false;

    fetch(`${API_URL}/users/token-info/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.valido) {
          setUserInfo({ nombre: data.nombre, username: data.username });
          setStep("form");
        } else {
          setErrorMsg(
            "Este enlace ya fue utilizado o ha caducado. Solicita uno nuevo a tu administrador."
          );
          setStep("error");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg(
            "No se pudo verificar el enlace. Revisa tu conexión a internet e intenta de nuevo."
          );
          setStep("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── Paso 2: Guardar contraseña ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/activar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || "Error desconocido";
        setFormError(msg);
        return;
      }

      setStep("exito");
      // Redirigir al login después de 2.5 s
      setTimeout(() => {
        window.location.href = "/login";
      }, 2500);
    } catch {
      setFormError("No se pudo conectar con el servidor. Revisa tu internet.");
    } finally {
      setSaving(false);
    }
  };

  // ── Renderizado según paso ─────────────────────────────────────────────────
  if (step === "validando") return <LoadingView />;
  if (step === "error") return <ErrorView mensaje={errorMsg} />;
  if (step === "exito") return <SuccessView />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary animate-in fade-in duration-300">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Crear Contraseña</CardTitle>
          <CardDescription>
            Bienvenido,{" "}
            <span className="font-semibold text-foreground">
              {userInfo?.nombre}
            </span>
            . Establece tu contraseña para acceder al sistema.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Info del usuario */}
          {userInfo?.username && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <User className="h-4 w-4 text-primary shrink-0" />
              <div className="text-sm">
                <p className="text-muted-foreground">Tu usuario de acceso:</p>
                <p className="font-mono font-semibold text-primary">
                  {userInfo.username}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contraseña */}
            <div className="space-y-1">
              <Label htmlFor="pass">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="pass"
                  type={showPass ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirmar Contraseña</Label>
              <Input
                id="confirm"
                type={showPass ? "text" : "password"}
                placeholder="Repite tu contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="h-11"
                autoComplete="new-password"
              />
            </div>

            {/* Error de formulario */}
            {formError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar y Acceder al Sistema"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Export principal con Suspense ────────────────────────────────────────────
export default function ActivarPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <ActivarContent />
    </Suspense>
  );
}
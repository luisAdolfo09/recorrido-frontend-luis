"use client";

/**
 * Página de Primer Acceso / Cambio de Contraseña Obligatorio
 *
 * Se muestra cuando el usuario inicia sesión con una contraseña temporal
 * enviada por el administrador por WhatsApp. El estatus es "INVITADO".
 *
 * Flujo:
 * 1. Usuario recibe por WhatsApp: usuario + contraseña temporal
 * 2. Entra al login con esas credenciales → el sistema detecta estatus INVITADO
 * 3. Lo redirige aquí automáticamente
 * 4. Crea su contraseña definitiva → estatus pasa a ACTIVO
 * 5. Lo redirige a su dashboard según su rol
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export default function PrimerAccesoPage() {
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<{ nombre?: string; rol?: string } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Verificar que hay sesión activa
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
      setUserInfo({
        nombre: data.session.user.user_metadata?.nombre,
        rol: data.session.user.user_metadata?.rol,
      });
      setLoadingSession(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://recorrido-backend-u2dd.onrender.com";

      const res = await fetch(`${apiUrl}/users/completar-primer-acceso`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          nuevaPassword: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || "Error desconocido";
        setError(msg);
        return;
      }

      setDone(true);

      // ⚠️ IMPORTANTE: La Admin API de Supabase invalida todos los tokens
      // cuando cambia la contraseña. Debemos renovar la sesión.
      await supabase.auth.signOut();
      
      const { data: nuevaSesion, error: loginError } = await supabase.auth.signInWithPassword({
        email: session.user.email,   // El email ya lo tenemos de la sesión anterior
        password: password,           // La nueva contraseña que el usuario acaba de crear
      });

      const rol = (
        nuevaSesion?.user?.user_metadata?.rol ||
        userInfo?.rol ||
        ""
      ).toLowerCase();

      const destino =
        rol === "propietario" || rol === "admin"
          ? "/dashboard/propietario"
          : rol === "tutor" || rol === "padre"
          ? "/dashboard/tutor"
          : "/dashboard/asistente";

      // Si el re-login falla por alguna razón, mandamos al login normal
      if (loginError) {
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      setTimeout(() => router.push(destino), 2000);
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu internet.");
    } finally {
      setSaving(false);
    }
  };

  // ── Vista de carga de sesión ─────────────────────────────────────────────
  if (loadingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground text-sm">Verificando sesión…</p>
      </div>
    );
  }

  // ── Vista de éxito ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-400">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-800">¡Listo!</h2>
          <p className="text-green-700">
            Tu contraseña fue guardada. Accediendo al sistema…
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-green-500 mx-auto" />
        </div>
      </div>
    );
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary animate-in fade-in duration-300">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Crea tu Contraseña</CardTitle>
          <CardDescription className="text-pretty leading-relaxed">
            {userInfo?.nombre ? (
              <>
                Bienvenido,{" "}
                <span className="font-semibold text-foreground">
                  {userInfo.nombre}
                </span>
                . Para proteger tu cuenta, establece una contraseña personal que
                solo tú conozcas.
              </>
            ) : (
              "Para proteger tu cuenta, establece una contraseña personal que solo tú conozcas."
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Aviso de seguridad */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <span>
              Estás usando una <strong>contraseña temporal</strong>. Por
              seguridad, debes crear una contraseña propia antes de continuar.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nueva contraseña */}
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
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
                "Guardar y Entrar al Sistema"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

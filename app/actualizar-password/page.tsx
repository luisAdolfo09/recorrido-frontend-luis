"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

export default function ActualizarPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    // 1. Intentamos obtener la sesión actual inmediatamente
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setVerificando(false);
      }
    });

    // 2. Escuchamos cambios (Importante para cuando Supabase procesa el link mágico)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || session) {
        setSession(session);
        setVerificando(false);
      }
    });

    // 3. Timeout de seguridad: Si en 3 segundos no hay sesión, redirigir al login
    const timer = setTimeout(() => {
      if (!session) {
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session) {
            setVerificando(false);
          }
        });
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast({ title: "¡Éxito!", description: "Contraseña actualizada correctamente." });

      // Cerrar sesión y redirigir al login (hard redirect)
      // Esto garantiza que el usuario entre con su nueva contraseña y
      // evita errores de sesión con token inválido.
      await supabase.auth.signOut();
      window.location.href = "/login?passwordChanged=1";

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error al actualizar",
        description: error.message || "Inténtalo de nuevo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Verificando enlace seguro...</h2>
          <p className="text-gray-500 mt-2">Estamos validando tu acceso.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center p-6">
          <div className="mb-4 text-red-500 flex justify-center">
            <Lock className="h-12 w-12" />
          </div>
          <h2 className="text-xl font-bold mb-2">Enlace no válido o expirado</h2>
          <p className="text-gray-600 mb-6">
            No pudimos detectar una sesión activa. Es posible que el enlace ya haya sido usado o haya caducado.
          </p>
          <Button onClick={() => router.push("/login")} variant="outline">
            Volver al inicio de sesión
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center border-b bg-white/50">
          <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Establecer Contraseña</CardTitle>
          <CardDescription>
            Hola{" "}
            <span className="font-bold text-blue-700">
              {session.user?.user_metadata?.nombre || "Usuario"}
            </span>
            .<br />Crea tu contraseña definitiva para activar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                "Guardar y Continuar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { AlertCircle, Loader2, ArrowLeft, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RecuperarContrasenaPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://recorrido-backend-u2dd.onrender.com";
      
      const res = await fetch(`${apiUrl}/users/solicitar-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier }),
      });

      if (!res.ok) {
        throw new Error("Hubo un problema al procesar la solicitud.");
      }

      setSuccess(true);
      toast({ 
        title: "Solicitud procesada", 
        description: "Comunícate con administración para recibir tu enlace." 
      });

    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "No se pudo conectar con el servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center p-8 border-green-200 bg-green-50 shadow-lg animate-in fade-in zoom-in duration-300">
           <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="h-8 w-8 text-green-600" />
           </div>
           <h2 className="text-xl font-bold text-green-800 mb-2">¡Enlace listo para enviarse!</h2>
           <p className="text-green-700/80 mb-6 text-sm leading-relaxed">
              El administrador del sistema ya puede enviarte un enlace seguro por WhatsApp para que restablezcas tu contraseña. 
              <br/><br/>
              <b>Por favor, avísale al administrador que solicitaste un cambio.</b>
           </p>
           <Button 
              onClick={() => router.push("/login")} 
              className="w-full bg-green-600 hover:bg-green-700 text-white"
           >
              Volver al inicio <ArrowLeft className="ml-2 h-4 w-4" />
           </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-secondary/80">
        <CardHeader className="space-y-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-fit -ml-2 text-muted-foreground mb-2"
            onClick={() => router.push("/login")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-secondary" />
          </div>
          <CardTitle className="text-2xl font-bold text-balance">
            Recuperar Contraseña
          </CardTitle>
          <CardDescription className="text-pretty">
            Ingresa tu usuario o número de teléfono registrado. Prepararemos un enlace seguro de recuperación que tu administrador te enviará por WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRecuperar} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier">Usuario o Teléfono</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Ej: mario.gomez o 55512345"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                </>
              ) : (
                "Solicitar enlace de recuperación"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

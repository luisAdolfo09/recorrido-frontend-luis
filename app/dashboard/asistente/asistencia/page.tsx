"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
// 👇 Asegúrate de que la ruta al layout sea correcta
import { AsistenteLayout } from "@/components/asistente-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase"; 
import { 
  CheckCircle2, 
  Loader2, 
  User, 
  Search, 
  XCircle, 
  Check
} from "lucide-react";

type AlumnoAsistencia = {
  id: string;
  nombre: string;
  grado: string;
  tutor: string;
};

export default function RegistrarAsistenciaPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [alumnos, setAlumnos] = useState<AlumnoAsistencia[]>([]);
  const [ausentes, setAusentes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // 🛡️ REF PARA EVITAR DOBLE TOAST EN MODO DEV
  const toastShownRef = useRef(false);

  // 1. Cargar datos y validar estado
  useEffect(() => {
    const init = async () => {
      // No seteamos loading(true) aquí porque ya inicia en true
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Sesión no válida o expirada.");

        const headers = {
             'Authorization': `Bearer ${token}`,
             'Content-Type': 'application/json'
        };

        // --- PASO A: VALIDACIÓN DE SEGURIDAD ---
        const resResumen = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/asistencia/resumen-hoy`, { headers });
        
        if (resResumen.ok) {
            const dataResumen = await resResumen.json();
            
            // SI YA SE REGISTRÓ:
            if (dataResumen.asistenciaRegistrada) {
                if (!toastShownRef.current) {
                    toastShownRef.current = true; // Marcamos que ya avisamos
                    toast({ 
                        title: "¡Tarea completada!", 
                        description: "La asistencia de hoy ya fue registrada.",
                        variant: "default",
                        duration: 4000
                    });
                    router.push("/dashboard/asistente"); 
                }
                // ⚠️ IMPORTANTE: NO ponemos setLoading(false) aquí.
                // Dejamos que el spinner siga girando hasta que el router cambie de página.
                return; 
            }
        }

        // --- PASO B: CARGAR LISTA (Solo si no se ha registrado) ---
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/asistencia/alumnos-del-dia`, { headers });
        
        if (!response.ok) {
           // Si el backend responde error, ahí sí permitimos mostrar la UI (o error)
           throw new Error("Error al cargar la lista.");
        }
        
        const data: AlumnoAsistencia[] = await response.json();
        
        if (data.length === 0) {
             if (!toastShownRef.current) {
                toast({ title: "Sin alumnos", description: "No hay alumnos asignados para hoy.", variant: "default" });
             }
        }

        setAlumnos(data);
        setLoading(false); // Solo quitamos el loading si ÉXITO y NO redirigimos

      } catch (err: any) {
        // Si hay error real (red, etc), mostramos el error y quitamos loading
        console.error(err);
        toast({ title: "Aviso", description: "No se pudo verificar el estado de la asistencia." });
        setLoading(false);
      }
    };

    init();
  }, [toast, router]);

  // 2. Filtrar alumnos por búsqueda
  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.tutor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [alumnos, searchTerm]);

  // 3. Toggle Ausente/Presente
  const toggleAusente = (id: string) => {
    setAusentes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 4. Abrir confirmación
  const handlePreGuardar = () => {
    setIsConfirmOpen(true);
  };

  // 5. Enviar datos al backend
  const handleConfirmGuardar = async () => {
    setIsConfirmOpen(false);
    setSending(true);

    const registros = alumnos.map(alumno => ({
      alumnoId: alumno.id,
      fecha: new Date().toISOString().split("T")[0],
      estado: ausentes.includes(alumno.id) ? 'ausente' : 'presente',
    }));

    const payload = { registros };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sesión no válida.");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/asistencia/registrar-lote`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "No se pudo guardar.");
      }

      const presentes = alumnos.length - ausentes.length;
      
      // Evitar doble toast al salir
      toastShownRef.current = true; 
      
      toast({
        title: "Asistencia guardada",
        description: `Asistieron ${presentes} de ${alumnos.length} alumnos.`,
      });
      router.push("/dashboard/asistente");

    } catch (err: any) {
      toast({ title: "Error al guardar", description: (err as Error).message, variant: "destructive" });
      setSending(false);
    }
  };
  
  if (loading) {
    return (
      <AsistenteLayout title="Registrar Asistencia">
        <div className="flex flex-col justify-center items-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-lg animate-pulse">Verificando ruta del día...</p>
        </div>
      </AsistenteLayout>
    );
  }

  return (
    <AsistenteLayout title="Registrar Asistencia">
      <div className="space-y-4 relative">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Lista de Asistencia</CardTitle>
            <CardDescription>
              Toca el botón de cada alumno para cambiar su estado.
            </CardDescription>
            
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar alumno o tutor..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {filteredAlumnos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron alumnos con ese nombre.
              </div>
            )}

            {filteredAlumnos.map((a) => {
              const isAusente = ausentes.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border rounded-lg gap-3 transition-colors ${
                    isAusente ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3 w-full sm:w-auto">
                    <div className={`mt-1 p-2 rounded-full ${isAusente ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-primary/10 text-primary'}`}>
                        <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={`font-medium text-base ${isAusente ? 'text-red-700 dark:text-red-400' : ''}`}>
                        {a.nombre}
                      </p>
                      <p className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:gap-2">
                        <span>{a.grado}</span>
                        <span className="hidden sm:inline text-muted-foreground/50">•</span>
                        <span>Tutor: {a.tutor}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    variant={isAusente ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleAusente(a.id)}
                    disabled={sending}
                    className={`w-full sm:w-32 justify-between ${!isAusente && "text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/30 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-300"}`}
                  >
                    {isAusente ? (
                      <>
                        <span>Ausente</span>
                        <XCircle className="h-4 w-4 ml-2" />
                      </>
                    ) : (
                      <>
                        <span>Presente</span>
                        <Check className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })}

            <div className="pt-6 border-t mt-4 pb-10 sm:pb-0">
              <Button onClick={handlePreGuardar} disabled={sending || loading || alumnos.length === 0} className="w-full sm:w-auto h-12 text-lg">
                {sending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                {sending ? "Guardando..." : "Finalizar y Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl animate-in slide-in-from-bottom-10 duration-300 mb-20 sm:mb-0">
            <CardHeader>
              <CardTitle>¿Confirmar Asistencia?</CardTitle>
              <CardDescription>
                Estás a punto de guardar el registro del día.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-md text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Total Alumnos:</span>
                  <span className="font-medium">{alumnos.length}</span>
                </div>
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Presentes:</span>
                  <span className="font-bold">{alumnos.length - ausentes.length}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>Ausentes:</span>
                  <span className="font-bold">{ausentes.length}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                ¿Estás seguro de que la lista está completa?
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsConfirmOpen(false)}>
                  Revisar
                </Button>
                <Button className="flex-1" onClick={handleConfirmGuardar}>
                  Sí, Guardar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AsistenteLayout>
  );
}
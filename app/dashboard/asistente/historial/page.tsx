"use client";

import { useState, useEffect } from "react"
import { AsistenteLayout } from "@/components/asistente-layout"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, ChevronsUpDown, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase" // <--- IMPORTANTE

// --- Tipos para el backend ---
type RegistroHistorial = {
  id: string;
  alumnoNombre: string;
  presente: boolean;
};

type DiaHistorial = {
  fecha: string;
  registros: RegistroHistorial[];
};

// --- Función helper para generar meses ---
const generarMeses = () => {
  const meses = [];
  const fechaActual = new Date();
  for (let i = 0; i < 6; i++) {
    const fecha = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - i, 1);
    const valor = fecha.toISOString().slice(0, 7); // "YYYY-MM"
    const etiqueta = fecha.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    meses.push({ valor, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) });
  }
  return meses;
};

export default function HistorialPage() {
  const { toast } = useToast();
  const mesesDisponibles = generarMeses();
  
  const [selectedMonth, setSelectedMonth] = useState(mesesDisponibles[0].valor); // "YYYY-MM"
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [asistenciasPorDia, setAsistenciasPorDia] = useState<Record<string, RegistroHistorial[]>>({});

  // --- 1. Cargar historial cuando el mes cambie ---
  useEffect(() => {
    const fetchHistorial = async () => {
      setLoading(true);
      setAsistenciasPorDia({}); // Limpia los datos anteriores
      try {
        // A. OBTENER TOKEN
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // B. ENVIAR TOKEN EN HEADERS
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/asistencia/historial?mes=${selectedMonth}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("No se pudo cargar el historial");

        const data: DiaHistorial[] = await response.json();
        
        // Agrupar por día (el backend ya podría darlo así)
        const agrupado = data.reduce((acc, dia) => {
          acc[dia.fecha] = dia.registros;
          return acc;
        }, {} as Record<string, RegistroHistorial[]>);

        setAsistenciasPorDia(agrupado);

      } catch (err: any) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchHistorial();
  }, [selectedMonth, toast]);

  const diasDelMes = Object.keys(asistenciasPorDia).sort();
  const toggleDay = (dia: string) => setOpenDay(openDay === dia ? null : dia);

  return (
    <AsistenteLayout title="Historial de Asistencia">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Consultar Historial</CardTitle>
            <CardDescription>
              Selecciona un mes para ver el registro de asistencias.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* --- 2. Select dinámico --- */}
            <Select
              onValueChange={setSelectedMonth}
              defaultValue={selectedMonth}
            >
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Selecciona un mes" />
              </SelectTrigger>
              <SelectContent>
                {mesesDisponibles.map(mes => (
                  <SelectItem key={mes.valor} value={mes.valor}>
                    {mes.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* --- 3. Renderizado de datos --- */}
            <div className="space-y-3">
              {loading && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loading && diasDelMes.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay registros para el mes seleccionado.
                </p>
              )}

              {!loading && diasDelMes.length > 0 && (
                diasDelMes.map((dia) => {
                  const registros = asistenciasPorDia[dia];
                  const presentes = registros.filter((r) => r.presente).length;
                  const ausentes = registros.length - presentes;
                  const ausentesNombres = registros
                    .filter((r) => !r.presente)
                    .map((r) => r.alumnoNombre);

                  return (
                    <div
                      key={dia}
                      className="border rounded-lg p-4 bg-card shadow-sm"
                    >
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="font-semibold capitalize">
                          {new Date(dia + "T00:00:00").toLocaleDateString(
                            "es-MX",
                            { weekday: "long", day: "numeric", month: "long" }
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" /> {presentes}{" "}
                            Presentes
                          </div>
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" /> {ausentes} Ausentes
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-9 p-0"
                            onClick={() => toggleDay(dia)}
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {openDay === dia && (
                        <div className="mt-4 pt-3 border-t">
                          <p className="text-sm font-semibold mb-1">
                            Alumnos ausentes:
                          </p>
                          {ausentes > 0 ? (
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                              {ausentesNombres.map((nombre) => (
                                <li key={nombre}>{nombre}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Asistencia perfecta.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AsistenteLayout>
  )
}
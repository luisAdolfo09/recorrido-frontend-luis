"use client"

import { useState, useEffect } from "react"
import { TutorLayout } from "@/components/tutor-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button" // <-- FALTABA ESTA IMPORTACIÓN
import { Loader2, AlertCircle, PiggyBank, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"

type Pago = {
  id: string;
  mes: string;
  monto: number;
  estado: 'pagado' | 'pendiente';
  alumno: { 
    nombre: string; 
    precio: number; 
  };
}

export default function PagosTutorPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagos, setPagos] = useState<Pago[]>([])

  useEffect(() => {
    const fetchPagos = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error("Sesión no válida.")

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tutor/pagos`, { headers })

        // Manejo de tablas vacías
        if (!response.ok) {
          if (response.status === 404 || response.status === 204) {
            setPagos([])
            return
          }
          
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Error al cargar pagos (${response.status})`)
        }

        const data = await response.json()
        setPagos(data)
      } catch (err: any) {
        console.error("Error al cargar pagos del tutor:", err)
        setError(err.message)
        toast({ title: "Error", description: err.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchPagos()
  }, [toast])

  // --- Lógica de Agrupación ---
  const pagosAgrupados = pagos.reduce((acc, pago) => {
    const mes = pago.mes
    if (!acc[mes]) {
      const todosPagosDelMes = pagos.filter(p => p.mes === mes);
      const algunPendiente = todosPagosDelMes.some(p => p.estado === 'pendiente');
      const montoPagadoTotal = todosPagosDelMes.reduce((sum, p) => sum + Number(p.monto), 0);
      
      const alumnosUnicos = new Map();
      todosPagosDelMes.forEach(p => {
        if (p.alumno) alumnosUnicos.set(p.alumno.nombre, p.alumno.precio || 0);
      });
      
      let montoEsperadoTotal = 0;
      alumnosUnicos.forEach((precio) => montoEsperadoTotal += Number(precio));

      let estadoFinal = 'pagado';
      const esDiciembre = mes.toLowerCase().includes('diciembre');
      
      if (todosPagosDelMes.some(p => p.estado === 'pendiente')) {
          estadoFinal = 'pendiente';
      }
      if (montoPagadoTotal < montoEsperadoTotal) {
          estadoFinal = 'pendiente';
      }

      acc[mes] = {
        mes: mes,
        montoPagado: montoPagadoTotal,
        montoEsperado: montoEsperadoTotal,
        estado: estadoFinal,
        alumnos: Array.from(alumnosUnicos.keys()),
        esDiciembre: esDiciembre
      }
    }
    return acc
  }, {} as Record<string, { 
      mes: string; 
      montoPagado: number; 
      montoEsperado: number; 
      estado: string; 
      alumnos: string[]; 
      esDiciembre: boolean 
  }>)

  // --- LÓGICA DE ORDENAMIENTO ---
  const mesesOrden: Record<string, number> = {
    "enero": 0, "febrero": 1, "marzo": 2, "abril": 3, "mayo": 4, "junio": 5,
    "julio": 6, "agosto": 7, "septiembre": 8, "octubre": 9, "noviembre": 10, "diciembre": 11
  };

  const parseMesValor = (mesStr: string) => {
    const partes = mesStr.trim().split(" ");
    if (partes.length < 2) return 0;

    const nombreMes = partes[0].toLowerCase();
    const anio = parseInt(partes[1]);
    const indiceMes = mesesOrden[nombreMes] ?? 0;

    return (anio * 100) + indiceMes;
  }

  const pagosConsolidados = Object.values(pagosAgrupados).sort((a, b) => {
      return parseMesValor(b.mes) - parseMesValor(a.mes);
  });

  // --- MANEJO DE ESTADOS DE CARGA/ERROR ---
  if (loading) {
    return (
      <TutorLayout title="Historial de Pagos">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-3 text-muted-foreground">Cargando pagos...</p>
        </div>
      </TutorLayout>
    )
  }

  if (error && pagos.length === 0) {
    return (
      <TutorLayout title="Historial de Pagos">
        <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar datos</h3>
          <p className="text-muted-foreground max-w-md">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Intentar de nuevo
          </Button>
        </div>
      </TutorLayout>
    )
  }

  return (
    <TutorLayout title="Historial de Pagos">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pagos de la Familia</CardTitle>
            <CardDescription>Registro de pagos consolidados por mes.</CardDescription>
          </CardHeader>
          <CardContent>
            
            {/* --- MENSAJE DE TABLA VACÍA --- */}
            {pagosConsolidados.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-12 w-12 opacity-20" />
                  <p>No hay registros de pago aún.</p>
                  <p className="text-sm">Los pagos aparecerán aquí una vez que se realicen.</p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Alumnos</TableHead>
                    <TableHead>Mes</TableHead>
                    <TableHead>Detalle Pago</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosConsolidados.length > 0 ? (
                    pagosConsolidados.map((pago) => {
                      const porcentaje = pago.montoEsperado > 0 
                        ? Math.min(100, (pago.montoPagado / pago.montoEsperado) * 100) 
                        : 0;

                      return (
                        <TableRow key={pago.mes}>
                          <TableCell className="font-medium align-top">
                            <div className="flex flex-col">
                              {pago.alumnos.map((nombre, i) => (
                                <span key={i} className="text-xs md:text-sm">{nombre}</span>
                              ))}
                            </div>
                          </TableCell>
                          
                          <TableCell className="whitespace-nowrap align-top pt-4">{pago.mes}</TableCell>
                          
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-base">
                                C$ {pago.montoPagado.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                              </span>
                              
                              {pago.esDiciembre && pago.estado === 'pendiente' && (
                                <div className="w-32">
                                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                    <span>Abonado</span>
                                    <span>Meta: C$ {pago.montoEsperado.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                  <Progress value={porcentaje} className="h-2" />
                                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                    Resta: C$ {(pago.montoEsperado - pago.montoPagado).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right align-top pt-4">
                            {pago.estado === "pagado" ? (
                              <Badge variant="default">Pagado</Badge>
                            ) : (
                              pago.esDiciembre ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">
                                  <PiggyBank className="w-3 h-3 mr-1" /> Abonando
                                </Badge>
                              ) : (
                                <Badge variant="destructive">Pendiente</Badge>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="h-8 w-8 opacity-20" />
                          <p>No hay registros de pago aún.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>
      </div>
    </TutorLayout>
  )
}
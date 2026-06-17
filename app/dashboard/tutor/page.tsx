"use client"

import { useState, useEffect } from "react"
import { TutorLayout } from "@/components/tutor-layout" // Asegúrate de que la ruta sea correcta
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Megaphone, DollarSign, Loader2, Bus, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

export default function TutorDashboard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
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

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tutor/resumen`, { headers })

        if (!response.ok) {
          if (response.status === 404 || response.status === 204) {
            setData({ hijos: [], avisos: [], pagos: { estado: 'al_dia', montoPendiente: 0 } })
            return
          }
          
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Error al cargar datos (${response.status})`)
        }

        const json = await response.json()
        setData(json)
      } catch (err: any) {
        console.error("Error al cargar resumen del tutor:", err)
        setError(err.message)
        toast({ title: "Error", description: err.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [toast])

  if (loading) {
    return (
      <TutorLayout title="Inicio">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </TutorLayout>
    )
  }

  if (error && data?.hijos?.length === 0) {
    return (
      <TutorLayout title="Inicio">
        <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">No se pudieron cargar tus datos</h3>
          <p className="text-muted-foreground max-w-md">{error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Recargar
          </Button>
        </div>
      </TutorLayout>
    )
  }

  if (!data || data.hijos.length === 0) {
    return (
      <TutorLayout title="Inicio">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle>Sin Alumnos Vinculados</CardTitle>
            <CardDescription>
              Tu cuenta aún no está asociada a ningún estudiante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Por favor, contacta al administrador de Recorrido Escolar para que te vinculen con tus hijos.</p>
            <Link href="/dashboard/tutor/avisos">
              <Button size="sm" variant="outline" className="mt-4">Ver Comunicados (Avisos)</Button>
            </Link>
          </CardContent>
        </Card>
      </TutorLayout>
    )
  }

  return (
    <TutorLayout title="Inicio">
      <div className="space-y-6 pb-20">
        
        {/* --- HEADER CON ENLACE A AVISOS (Megáfono) --- */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Resumen Familiar</h1>
          <Link href="/dashboard/tutor/avisos" title="Ver Avisos Generales">
            <Button variant="ghost" size="icon" className="relative text-blue-600 hover:text-blue-700 hover:bg-blue-50">
              <Megaphone className="h-6 w-6" />
              {data.avisos && data.avisos.length > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-bounce">
                  {data.avisos.length}
                </span>
              )}
            </Button>
          </Link>
        </div>

        {/* --- TARJETAS DE HIJOS --- */}
        {data.hijos.map((hijo: any) => (
          <Card key={hijo.id} className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20">
              <div className="flex justify-between items-start">
                  <div>
                      <CardDescription>Estado de hoy</CardDescription>
                      <CardTitle className="text-2xl">{hijo.nombre}</CardTitle>
                  </div>
                  <Badge variant="outline">{hijo.grado}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                
                {/* FOTO DE LA UNIDAD */}
                <div className="h-24 w-full sm:w-32 rounded-md overflow-hidden border bg-gray-50 shrink-0 relative">
                  {hijo.vehiculoFotoUrl ? (
                    <img src={hijo.vehiculoFotoUrl} alt="Bus" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                      <Bus className="h-8 w-8 opacity-20 mb-1" />
                      <span className="text-[10px]">Sin foto</span>
                    </div>
                  )}
                  {/* Placa sobrepuesta */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 truncate px-1">
                      {hijo.vehiculoPlaca || "S/P"}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-1 w-full">
                  {hijo.estadoHoy === 'presente' && (
                    <>
                      <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full shrink-0">
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-green-700 dark:text-green-400">A bordo</p>
                        <p className="text-sm text-muted-foreground">
                          Registrado: {hijo.horaRecogida ? new Date(hijo.horaRecogida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </p>
                      </div>
                    </>
                  )}
                  {hijo.estadoHoy === 'ausente' && (
                    <>
                      <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full shrink-0">
                        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-red-700 dark:text-red-400">Ausente</p>
                        <p className="text-sm text-muted-foreground">No asiste hoy.</p>
                      </div>
                    </>
                  )}
                  {hijo.estadoHoy === 'pendiente' && (
                    <>
                      <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-full shrink-0">
                        <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-300" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-yellow-700 dark:text-yellow-300">Esperando</p>
                        <p className="text-sm text-muted-foreground">Sin registro aún.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* --- TARJETA DE PAGOS --- */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-1 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Estado de Cuenta</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mt-2">
                <div>
                  <p className="text-2xl font-bold">C$ {data.pagos?.montoPendiente || 0}</p>
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                </div>
                {data.pagos?.estado === 'al_dia' ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">Al día</Badge>
                ) : (
                    <Badge variant="destructive">Pendiente</Badge>
                )}
              </div>
              <div className="mt-4">
                <Link href="/dashboard/tutor/pagos">
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    Ver Historial <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TutorLayout>
  )
}
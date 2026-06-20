"use client"

import { useState, useEffect } from "react"
import { TutorLayout } from "@/components/tutor-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, AlertCircle, AlertTriangle, CalendarCheck, TrendingUp, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- TIPOS ---
type RegistroAsistencia = {
  id: string;
  fecha: string;
  estado: 'presente' | 'ausente';
  fechaCreacion: string;
}

type HijoConAsistencias = {
  id: string;
  nombre: string;
  grado: string;
  registros: RegistroAsistencia[];
}

export default function AsistenciasTutorPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hijosData, setHijosData] = useState<HijoConAsistencias[]>([])

  useEffect(() => {
    const fetchAsistencias = async () => {
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

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tutor/asistencias`, { headers })

        // Manejo de tablas vacías
        if (!response.ok) {
          if (response.status === 404 || response.status === 204) {
            setHijosData([])
            return
          }
          
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Error al cargar asistencias (${response.status})`)
        }

        const data = await response.json()
        setHijosData(data)

      } catch (err: any) {
        console.error("Error al cargar asistencias del tutor:", err)
        setError(err.message)
        toast({ title: "Error", description: err.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchAsistencias()
  }, [toast])

  // --- MANEJO DE ESTADOS DE CARGA/ERROR ---
  if (loading) {
    return (
      <TutorLayout title="Registro de Asistencias">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-3 text-muted-foreground">Cargando asistencias...</p>
        </div>
      </TutorLayout>
    )
  }

  if (error && hijosData.length === 0) {
    return (
      <TutorLayout title="Registro de Asistencias">
        <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
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

  // Si no hay hijos (o datos vacíos)
  if (hijosData.length === 0) {
    return (
      <TutorLayout title="Registro de Asistencias">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle>Sin Alumnos Vinculados</CardTitle>
            <CardDescription>
              Tu cuenta aún no está asociada a ningún estudiante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Por favor, contacta al administrador de Recorrido Escolar para que te vinculen con tus hijos.</p>
          </CardContent>
        </Card>
      </TutorLayout>
    )
  }

  // Seleccionar el primer hijo por defecto
  const defaultTab = hijosData[0].id

  // Paleta de colores de avatar por hijo (hasta 4 hijos)
  const avatarColors = [
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
  ]

  return (
    <TutorLayout title="Registro de Asistencias">
      <div className="space-y-6">
        <Card className="overflow-hidden border shadow-sm py-0 card-rise">
          <CardHeader className="btn-primary-gradient px-6 pt-5 pb-4 gap-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <CalendarCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">Asistencia por Alumno</CardTitle>
                <CardDescription className="text-blue-100/85">
                  Selecciona un hijo para ver su historial de asistencia.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Tabs defaultValue={defaultTab} className="w-full">
              
              {/* ── Pestañas de hijos con avatar, nombre y porcentaje ── */}
              <TabsList className="w-full rounded-none border-b bg-muted/30 h-auto p-0 gap-0 justify-start overflow-x-auto">
                {hijosData.map((hijo, idx) => {
                  const presentes = hijo.registros.filter(r => r.estado === 'presente').length
                  const total = hijo.registros.length
                  const pct = total > 0 ? Math.round((presentes / total) * 100) : null
                  const colorClass = avatarColors[idx % avatarColors.length]

                  return (
                    <TabsTrigger
                      key={hijo.id}
                      value={hijo.id}
                      className="
                        group relative flex flex-col items-center gap-1.5 px-8 py-4 min-w-[150px]
                        text-muted-foreground rounded-none border-b-[3px] border-transparent
                        transition-all duration-200
                        data-[state=active]:text-foreground
                        data-[state=active]:font-semibold
                        data-[state=active]:border-b-primary
                        data-[state=active]:bg-primary/10
                        dark:data-[state=active]:bg-primary/25
                        hover:bg-accent/40 hover:text-foreground
                      "
                    >
                      {/* Avatar con inicial del hijo */}
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-base shadow-md ring-2 ring-background transition-all opacity-60 grayscale-[35%] group-data-[state=active]:opacity-100 group-data-[state=active]:grayscale-0 group-data-[state=active]:scale-110 group-data-[state=active]:ring-primary group-data-[state=active]:shadow-lg`}>
                        {hijo.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm">{hijo.nombre.split(' ')[0]}</span>
                      {pct !== null && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          pct >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                          pct >= 75 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        }`}>
                          {pct}% asistencia
                        </span>
                      )}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {/* ── Contenido de cada hijo ── */}
              {hijosData.map((hijo, idx) => {
                const presentes = hijo.registros.filter(r => r.estado === 'presente').length
                const ausentes = hijo.registros.filter(r => r.estado === 'ausente').length
                const total = hijo.registros.length

                return (
                  <TabsContent key={hijo.id} value={hijo.id} className="m-0">

                    {/* Barra de estadísticas del hijo seleccionado */}
                    {total > 0 && (
                      <div className="grid grid-cols-3 gap-px bg-border">
                        {/* Días — azul de marca. Modo claro: sky-100 / Modo azul: sky-500 translúcido */}
                        <div className="flex flex-col items-center py-5 bg-sky-100 dark:bg-sky-500/15">
                          <span className="text-3xl font-bold text-sky-700 dark:text-sky-300">{total}</span>
                          <span className="text-xs font-medium text-sky-700/70 dark:text-sky-300/70 mt-1">Días registrados</span>
                        </div>
                        {/* Presencias — verde */}
                        <div className="flex flex-col items-center py-5 bg-emerald-100 dark:bg-emerald-500/15">
                          <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{presentes}</span>
                          <span className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80 mt-1">Presencias</span>
                        </div>
                        {/* Ausencias — rojo */}
                        <div className="flex flex-col items-center py-5 bg-red-100 dark:bg-red-500/15">
                          <span className="text-3xl font-bold text-red-700 dark:text-red-300">{ausentes}</span>
                          <span className="text-xs font-medium text-red-700/80 dark:text-red-300/80 mt-1">Ausencias</span>
                        </div>
                      </div>
                    )}

                    {/* Lista de registros con diferenciación visual por color */}
                    <div className="p-4 space-y-2.5 bg-muted/20">
                      {hijo.registros && hijo.registros.length > 0 ? (
                        hijo.registros.map((asistencia) => {
                          const esPresente = asistencia.estado === 'presente'
                          return (
                            <div
                              key={asistencia.id}
                              className={`
                                flex items-center justify-between p-3.5 rounded-xl border bg-card
                                transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md
                                ${esPresente
                                  ? 'border-l-4 border-l-emerald-500 border-emerald-200/70 dark:border-emerald-500/20'
                                  : 'border-l-4 border-l-red-500 border-red-200/70 dark:border-red-500/20'
                                }
                              `}
                            >
                              <div className="flex items-center gap-3">
                                {/* Ícono con fondo semitransparente */}
                                <div className={`p-2 rounded-lg ${esPresente ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-red-100 dark:bg-red-500/15'}`}>
                                  {esPresente
                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  }
                                </div>

                                <div>
                                  <p className="font-semibold text-sm capitalize text-foreground">
                                    {new Date(asistencia.fecha + "T00:00:00").toLocaleDateString("es-MX", {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "long",
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Registrado a las {new Date(asistencia.fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>

                              {/* Badge con color según estado */}
                              <Badge
                                className={`text-xs font-semibold px-3 py-1 rounded-full border-0 ${
                                  esPresente
                                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                    : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                }`}
                              >
                                {esPresente ? '✓ Presente' : '✕ Ausente'}
                              </Badge>
                            </div>
                          )
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <div className="p-4 rounded-full bg-muted mb-3">
                            <AlertCircle className="h-8 w-8 opacity-50" />
                          </div>
                          <p className="text-sm font-medium text-foreground">Sin registros para {hijo.nombre}</p>
                          <p className="text-xs mt-1 text-muted-foreground">Los registros aparecerán cuando el asistente tome asistencia.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </TutorLayout>
  )
}
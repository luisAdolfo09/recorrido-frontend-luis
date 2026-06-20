"use client"

import { useState, useEffect } from "react"
import { TutorLayout } from "@/components/tutor-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

type Aviso = {
  id: string;
  titulo: string;
  contenido: string; 
  destinatario: 'todos' | 'tutores' | 'personal'; 
  fechaCreacion: string; 
};

export default function AvisosTutorPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchAvisos = async () => {
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

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/avisos/para-tutor`, { headers })

        // Manejo de tablas vacías
        if (!response.ok) {
          if (response.status === 404 || response.status === 204) {
            setAvisos([])
            return
          }
          
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Error al cargar avisos (${response.status})`)
        }

        const data: Aviso[] = await response.json()
        setAvisos(data)
      } catch (err: any) {
        console.error("Error al cargar avisos del tutor:", err)
        setError(err.message)
        toast({ title: "Error", description: err.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchAvisos()
  }, [toast])

  // --- MANEJO DE ESTADOS DE CARGA/ERROR ---
  if (loading) {
    return (
      <TutorLayout title="Avisos y Comunicados">
        <div className="space-y-6">
          <Link href="/dashboard/tutor">
            <Button variant="ghost" size="sm" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Inicio
            </Button>
          </Link>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-3 text-muted-foreground">Cargando avisos...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TutorLayout>
    )
  }

  if (error && avisos.length === 0) {
    return (
      <TutorLayout title="Avisos y Comunicados">
        <div className="space-y-6">
          <Link href="/dashboard/tutor">
            <Button variant="ghost" size="sm" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Inicio
            </Button>
          </Link>

          <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar datos</h3>
            <p className="text-muted-foreground max-w-md">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Intentar de nuevo
            </Button>
          </div>
        </div>
      </TutorLayout>
    )
  }

  return (
    <TutorLayout title="Avisos y Comunicados">
      <div className="space-y-6">
        {/* Botón Volver */}
        <Link href="/dashboard/tutor">
          <Button variant="ghost" size="sm" className="pl-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Inicio
          </Button>
        </Link>

        {/* Estado Vacío */}
        {avisos.length === 0 && !loading && (
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="text-center py-10 text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="h-12 w-12 opacity-20" />
                  <p>No hay avisos recientes.</p>
                  <p className="text-sm">Los avisos aparecerán aquí cuando el administrador los publique.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Avisos */}
        {avisos.length > 0 && (
          <div className="grid gap-4">
            {avisos.map((aviso) => (
              <Card key={aviso.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{aviso.titulo}</CardTitle>
                      <CardDescription className="mt-1">
                        {new Date(aviso.fechaCreacion).toLocaleDateString("es-NI", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      Para: {aviso.destinatario?.toUpperCase() || "TODOS"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-line">
                    {aviso.contenido}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TutorLayout>
  )
}
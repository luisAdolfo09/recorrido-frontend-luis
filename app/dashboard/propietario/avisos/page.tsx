"use client"

import { useState, useEffect } from "react"
// Importamos RequestInit para tipar la opción de fetch
import type { RequestInit } from "next/dist/server/web/spec-extension/request"
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge" // <--- ¡IMPORTACIÓN FALTANTE!
import { 
    Plus, 
    Users, 
    DollarSign, 
    Bus, 
    UserCog, 
    Bell, 
    BarChart3, 
    TrendingDown,
    Loader2,
    Pencil,
    Trash2,
    AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase" // <--- Importamos Supabase

// --- TIPO ACTUALIZADO ---
export type Aviso = {
    id: string;
    titulo: string;
    contenido: string; 
    destinatario: 'todos' | 'tutores' | 'personal'; 
    fechaCreacion: string; 
};

// --- DEFINICIÓN DEL MENÚ (Sin cambios) ---
const menuItems: MenuItem[] = [
    { title: "Gestionar Alumnos", description: "Ver y administrar estudiantes", icon: Users, href: "/dashboard/propietario/alumnos", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
    { title: "Gestionar Pagos", description: "Ver historial y registrar pagos", icon: DollarSign, href: "/dashboard/propietario/pagos", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20" },
    { title: "Gestionar Gastos", description: "Control de combustible, salarios, etc.", icon: TrendingDown, href: "/dashboard/propietario/gastos", color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-900/20" },
    { title: "Gestionar Personal", description: "Administrar empleados y choferes", icon: Users, href: "/dashboard/propietario/personal", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-900/20" },
    { title: "Gestionar Vehículos", description: "Administrar flota de vehículos", icon: Bus, href: "/dashboard/propietario/vehiculos", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-900/20" },
    { title: "Gestionar Usuarios", description: "Administrar accesos al sistema", icon: UserCog, href: "/dashboard/propietario/usuarios", color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-900/20" },
    { title: "Enviar Avisos", description: "Comunicados a tutores y personal", icon: Bell, href: "/dashboard/propietario/avisos", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/20" },
    { title: "Generar Reportes", description: "Estadísticas y análisis", icon: BarChart3, href: "/dashboard/propietario/reportes", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20" },
];

export default function AvisosPage() {
    const [avisos, setAvisos] = useState<Aviso[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast();

    // --- Cargar Avisos desde la API ---
    const fetchAvisos = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida o expirada.");

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/avisos`, { headers });
            
            // --- CORRECCIÓN CRÍTICA PARA MANEJAR TABLA VACÍA ---
            if (!response.ok) {
                if (response.status === 404 || response.status === 204) {
                    setAvisos([]); // Lista vacía
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error del servidor (${response.status})`);
                }
            } else {
                const data: Aviso[] = await response.json();
                setAvisos(data);
            }

        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Error al cargar avisos",
                description: (err as Error).message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAvisos();
    }, [toast]);


    // --- Lógica para Eliminar ---
    const handleEliminarAviso = async (id: string) => {
        const aviso = avisos.find(a => a.id === id);
        if (!aviso) return;

        // Confirmación (Usamos window.confirm por simplicidad)
        const confirmMessage = `¿Estás seguro de ELIMINAR PERMANENTEMENTE el aviso "${aviso.titulo}"? Esta acción no se puede deshacer.`;
        if (!window.confirm(confirmMessage)) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            const requestOptions: RequestInit = {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }, // Enviamos el Token
            };

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/avisos/${id}`, 
                requestOptions
            );

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || "No se pudo eliminar el aviso.");
            }
            
            // Recargar datos
            fetchAvisos();

            toast({
                title: "Acción completada",
                description: `Aviso "${aviso.titulo}" eliminado permanentemente.`,
            });

        } catch (err: any) {
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        }
    }

    // --- MANEJO DE ESTADOS DE CARGA/ERROR ---
    if (loading) {
        return (
            <DashboardLayout title="Gestión de Avisos" menuItems={menuItems}>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="ml-3 text-muted-foreground">Cargando avisos...</p>
                </div>
            </DashboardLayout>
        );
    }
    
    // Si hay error y no hay datos que mostrar
    if (error && avisos.length === 0) {
        return (
            <DashboardLayout title="Gestión de Avisos" menuItems={menuItems}>
                <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar datos iniciales</h3>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <Button className="mt-4" onClick={fetchAvisos}>
                        Intentar de nuevo
                    </Button>
                </div>
            </DashboardLayout>
        );
    }


    return (
        <DashboardLayout title="Gestión de Avisos" menuItems={menuItems}>
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Link href="/dashboard/propietario/avisos/nuevo">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Aviso
                        </Button>
                    </Link>
                </div>

                {/* --- MENSAJE DE TABLA VACÍA --- */}
                {avisos.length === 0 && !loading && (
                    <Card className="mt-6 border-l-4 border-l-yellow-500">
                        <CardHeader>
                            <CardTitle>No hay avisos para mostrar</CardTitle>
                            <CardDescription>
                                Crea un comunicado para tutores o personal de ruta.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/propietario/avisos/nuevo">
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" /> Crear Primer Aviso
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {/* --- LISTA DE AVISOS --- */}
                {!loading && avisos.length > 0 && (
                    <div className="grid gap-4">
                        {avisos.map((aviso) => (
                            <Card key={aviso.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        {/* Lado Izquierdo: Título y Fecha */}
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

                                        {/* Lado Derecho: Destinatario y Botones de Acción */}
                                        <div className="flex flex-col items-end gap-2">
                                            {/* Uso de Badge que requería la importación */}
                                            <Badge variant="outline" className="text-xs uppercase">
                                                {aviso.destinatario?.toUpperCase() || "TODOS"}
                                            </Badge>
                                            
                                            {/* Botones de Acción */}
                                            <div className="flex gap-1">
                                                <Link href={`/dashboard/propietario/avisos/${aviso.id}`}>
                                                    <Button variant="ghost" size="icon" title="Editar">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    title="Eliminar"
                                                    onClick={() => handleEliminarAviso(aviso.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
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
        </DashboardLayout>
    )
}
"use client"

import { useState, useMemo, useEffect } from "react"
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
    Plus, 
    Search, 
    Users, 
    DollarSign, 
    Bus, 
    UserCog, 
    Bell, 
    BarChart3, 
    TrendingDown, 
    Pencil, 
    Trash2, 
    Wrench,
    CheckCircle,
    Loader2,
    AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- DEFINICIÓN DEL TIPO VEHÍCULO (CORREGIDO) ---
export type Vehiculo = {
    id: string;
    nombre: string;
    placa: string;
    marca: string;
    modelo: string;
    anio: number;
    capacidad: number;
    estado: "activo" | "en mantenimiento" | "eliminado";
};

// --- Menú (El mismo de siempre) ---
const menuItems: MenuItem[] = [
    { title: "Gestionar Alumnos", description: "Ver y administrar estudiantes", icon: Users, href: "/dashboard/propietario/alumnos", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
    { title: "Gestionar Pagos", description: "Ver historial y registrar pagos", icon: DollarSign, href: "/dashboard/propietario/pagos", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20" },
    { title: "Gestionar Gastos", description: "Control de combustible, salarios, etc.", icon: TrendingDown, href: "/dashboard/propietario/gastos", color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-900/20" },
    { title: "Gestionar Personal", description: "Administrar empleados y choferes", icon: Users, href: "/dashboard/propietario/personal", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-900/20" },
    { title: "Gestionar Vehículos", description: "Administrar flota de vehículos", icon: Bus, href: "/dashboard/propietario/vehiculos", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-900/20" },
    { title: "Gestionar Usuarios", description: "Administrar accesos al sistema", icon: UserCog, href: "/dashboard/propietario/usuarios", color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-900/20" },
    { title: "Enviar Avisos", description: "Comunicados a tutores y personal", icon: Bell, href: "/dashboard/propietario/avisos", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/20" },
    { title: "Generar Reportes", description: "Estadísticas y análisis", icon: BarChart3, href: "/dashboard/propietario/reportes", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20" },
]

export default function VehiculosPage() {
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [estadoFilter, setEstadoFilter] = useState("activo");
    const { toast } = useToast()

    // --- Cargar Vehículos desde la API ---
    const fetchVehiculos = async () => {
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

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos?estado=${estadoFilter}`, { headers });

            // Manejo de tablas vacías
            if (!response.ok) {
                if (response.status === 404 || response.status === 204) {
                    setVehiculos([]);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error del servidor (${response.status})`);
                }
            } else {
                const data: Vehiculo[] = await response.json();
                setVehiculos(data);
            }
        } catch (err: any) {
            setError(err.message);
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehiculos();
    }, [toast, estadoFilter]);

    // --- Filtrar por Búsqueda ---
    const filteredVehiculos = useMemo(() => {
        return vehiculos.filter(
            (v) =>
                v.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (v.marca && v.marca.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [vehiculos, searchTerm]);

    // --- Cálculos ---
    const totalVehiculos = vehiculos.length;
    const totalCapacidad = vehiculos.reduce((sum, v) => sum + (v.capacidad || 0), 0);

    // --- Lógica de Acciones (Conectada a la API) ---
    const cambiarEstadoVehiculo = async (id: string, nuevoEstado: "activo" | "en mantenimiento" | "eliminado") => {
        const vehiculo = vehiculos.find(v => v.id === id);
        if (!vehiculo) return;

        let confirmMessage = `¿Estás seguro de mover "${vehiculo.nombre}" a ${nuevoEstado}?`;
        if (nuevoEstado === 'eliminado') {
            confirmMessage = `¿Estás seguro de ELIMINAR PERMANENTEMENTE a "${vehiculo.nombre}"? Esta acción no se puede deshacer.`
        }
        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            const method = nuevoEstado === 'eliminado' ? 'DELETE' : 'PATCH';

            const requestOptions: RequestInit = {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` }
            };

            if (nuevoEstado !== 'eliminado') {
                requestOptions.headers = { ...requestOptions.headers, 'Content-Type': 'application/json' };
                requestOptions.body = JSON.stringify({ estado: nuevoEstado });
            }
            
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/vehiculos/${id}`, 
                requestOptions
            );

            if (!response.ok) {
                if (method === 'DELETE') {
                    const errData = await response.json();
                    if (errData.message && errData.message.includes('violates foreign key constraint')) {
                        throw new Error("No se puede eliminar: El vehículo tiene alumnos, personal o gastos asignados.");
                    } else {
                        throw new Error(errData.message || "No se pudo eliminar el vehículo.");
                    }
                }
                throw new Error("No se pudo actualizar el estado del vehículo");
            }
            
            setVehiculos(prev => prev.filter(v => v.id !== id));

            let mensaje = "";
            if (nuevoEstado === "eliminado") mensaje = "Vehículo eliminado correctamente";
            if (nuevoEstado === "activo") mensaje = "Vehículo activado correctamente";
            if (nuevoEstado === "en mantenimiento") mensaje = "Vehículo marcado en mantenimiento";

            toast({
                title: "Acción completada",
                description: `${mensaje}: ${vehiculo?.nombre}`,
            });

        } catch (err: any) {
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        }
    }

    // --- MANEJO DE ESTADOS DE CARGA/ERROR ---
    if (loading) {
        return (
            <DashboardLayout title="Gestión de Vehículos" menuItems={menuItems}>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="ml-3 text-muted-foreground">Cargando vehículos...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error && vehiculos.length === 0) {
        return (
            <DashboardLayout title="Gestión de Vehículos" menuItems={menuItems}>
                <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar datos</h3>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <Button className="mt-4" onClick={fetchVehiculos}>
                        Intentar de nuevo
                    </Button>
                </div>
            </DashboardLayout>
        );
    }
    
    return (
        <DashboardLayout title="Gestión de Vehículos" menuItems={menuItems}>
            <div className="space-y-6">

                {/* --- TARJETAS (ESTILO ORIGINAL) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">
                                Total Vehículos ({estadoFilter === 'activo' ? 'Activos' : 'En Mantenimiento'})
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold">{totalVehiculos}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Capacidad Total (Asientos)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold text-blue-600">{totalCapacidad}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* --- BOTÓN Y BUSCADOR (ESTILO ORIGINAL) --- */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, placa, marca..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-full"
                            />
                        </div>
                        <Select onValueChange={setEstadoFilter} value={estadoFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="en mantenimiento">En Mantenimiento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Link href="/dashboard/propietario/vehiculos/nuevo" className="w-full sm:w-auto">
                        <Button className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Registrar Vehículo
                        </Button>
                    </Link>
                </div>

                {/* --- MENSAJE DE TABLA VACÍA --- */}
                {vehiculos.length === 0 && !loading && (
                    <Card className="mt-6 border-l-4 border-l-orange-500">
                        <CardHeader>
                            <CardTitle>No hay vehículos registrados</CardTitle>
                            <CardDescription>
                                Comienza registrando tu primer vehículo para gestionar la flota.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/propietario/vehiculos/nuevo">
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" /> Registrar Primer Vehículo
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {/* --- TABLA (SOLO SI HAY DATOS) --- */}
                {vehiculos.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Flota de Vehículos ({estadoFilter === 'activo' ? 'Activos' : 'En Mantenimiento'})</CardTitle>
                            <CardDescription>Lista de todos los vehículos de la empresa.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Placa</TableHead>
                                            <TableHead>Marca / Modelo</TableHead>
                                            <TableHead>Año</TableHead>
                                            <TableHead>Capacidad</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredVehiculos.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24">
                                                    No se encontraron vehículos que coincidan con los filtros.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredVehiculos.map((v) => (
                                                <TableRow key={v.id}>
                                                    <TableCell className="font-medium whitespace-nowrap">{v.nombre}</TableCell>
                                                    <TableCell className="whitespace-nowrap">{v.placa}</TableCell>
                                                    <TableCell className="whitespace-nowrap">{v.marca || "N/A"} / {v.modelo || "N/A"}</TableCell>
                                                    <TableCell>{v.anio || "N/A"}</TableCell>
                                                    <TableCell>{v.capacidad || "N/A"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Link href={`/dashboard/propietario/vehiculos/${v.id}`}>
                                                                <Button variant="ghost" size="icon" title="Editar">
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                            
                                                            {v.estado === "activo" && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon"
                                                                    title="Poner en Mantenimiento"
                                                                    onClick={() => cambiarEstadoVehiculo(v.id, "en mantenimiento")}
                                                                >
                                                                    <Wrench className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {v.estado === "en mantenimiento" && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon"
                                                                    title="Activar"
                                                                    onClick={() => cambiarEstadoVehiculo(v.id, "activo")}
                                                                >
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                title="Eliminar Permanentemente"
                                                                onClick={() => cambiarEstadoVehiculo(v.id, "eliminado")}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    )
}
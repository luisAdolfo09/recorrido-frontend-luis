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
    Pencil, 
    Trash2, 
    Eye, 
    EyeOff,
    Users, 
    DollarSign, 
    Bus, 
    UserCog, 
    Bell, 
    BarChart3, 
    TrendingDown,
    Loader2,
    AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- TIPO PERSONAL (Coincide con la Entidad del Backend) ---
export type Personal = {
    id: string;
    nombre: string;
    puesto: string;      
    contacto: string; 
    salario: number;
    fechaContratacion: string; 
    estado: "activo" | "inactivo" | "eliminado";
    vehiculoId: string | null;
    vehiculo?: {
        id: string;
        nombre: string;
    }
};

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

const formatCurrency = (num: number) => {
    return (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PersonalPage() {
    const [personal, setPersonal] = useState<Personal[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [estadoFilter, setEstadoFilter] = useState("activo"); 
    const { toast } = useToast()

    // --- Cargar Personal ---
    const fetchPersonal = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            const response = await fetch(`${apiUrl}/personal?estado=${estadoFilter}`, { headers });

            if (!response.ok) {
                if (response.status === 404 || response.status === 204) {
                    setPersonal([]);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error del servidor (${response.status})`);
                }
            } else {
                const data: Personal[] = await response.json();
                setPersonal(data);
            }
        } catch (err: any) {
            setError(err.message);
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchPersonal();
    }, [estadoFilter]); 


    // --- Filtrado ---
    const filteredPersonal = useMemo(() => {
        return personal.filter(
            (p) =>
                p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.vehiculo && p.vehiculo.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [personal, searchTerm]);

    const totalPersonal = personal.length;
    const totalSalarios = personal.reduce((sum, p) => sum + (Number(p.salario) || 0), 0);

    // --- Acciones (Desactivar/Eliminar) ---
    const cambiarEstadoPersonal = async (id: string, nuevoEstado: "activo" | "inactivo" | "eliminado") => {
        const empleado = personal.find(p => p.id === id);
        if (!empleado) return;

        const confirmMessage = nuevoEstado === 'eliminado' 
            ? `¿Estás seguro de ELIMINAR permanentemente a ${empleado.nombre}?`
            : `¿Estás seguro de ${nuevoEstado === 'inactivo' ? 'DESACTIVAR' : 'ACTIVAR'} a ${empleado.nombre}?`;
            
        if (!window.confirm(confirmMessage)) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            const method = nuevoEstado === 'eliminado' ? 'DELETE' : 'PATCH';
            const options: any = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
            
            if (nuevoEstado !== 'eliminado') {
                options.body = JSON.stringify({ estado: nuevoEstado });
            }

            const response = await fetch(`${apiUrl}/personal/${id}`, options);
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || "No se pudo completar la acción");
            }
            
            if (nuevoEstado === 'eliminado') {
                setPersonal(prev => prev.filter(p => p.id !== id));
            } else {
                // Si cambiamos estado y hay filtro, recargamos para que la lista sea consistente
                if (estadoFilter !== 'todos' && estadoFilter !== nuevoEstado) {
                    setPersonal(prev => prev.filter(p => p.id !== id));
                } else {
                    fetchPersonal(); 
                }
            }

            toast({ title: "Acción completada", description: `Empleado ${nuevoEstado}.` });

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    }
    
    if (loading) return (
        <DashboardLayout title="Gestión de Personal" menuItems={menuItems}>
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout title="Gestión de Personal" menuItems={menuItems}>
            <div className="space-y-6">

                {/* Resumen */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="card-accent card-rise">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Total Personal ({estadoFilter})</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold">{totalPersonal}</div>
                        </CardContent>
                    </Card>
                    <Card className="card-accent card-rise">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Total Salarios (Mensual)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold text-green-600">C${formatCurrency(totalSalarios)}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros y Botón */}
                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o puesto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-full"
                            />
                        </div>
                        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="inactivo">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* BOTÓN QUE LLEVA A LA PESTAÑA DE NUEVO PERSONAL */}
                    <Link href="/dashboard/propietario/personal/nuevo">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" /> Registrar Personal
                        </Button>
                    </Link>
                </div>

                {/* Tabla */}
                {personal.length === 0 && !loading ? (
                    <div className="text-center py-10 text-muted-foreground border rounded-md bg-gray-50 dark:bg-slate-900">
                        No hay personal registrado con este filtro.
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Puesto</TableHead>
                                            <TableHead>Contacto</TableHead>
                                            <TableHead>Salario</TableHead>
                                            <TableHead>Vehículo</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPersonal.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-medium">{p.nombre}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">{p.puesto}</Badge>
                                                </TableCell>
                                                <TableCell>{p.contacto || "N/A"}</TableCell>
                                                <TableCell>C${formatCurrency(p.salario)}</TableCell>
                                                <TableCell>{p.vehiculo?.nombre || "Sin asignar"}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/dashboard/propietario/personal/${p.id}`}>
                                                            <Button variant="ghost" size="icon" title="Editar">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </Link>

                                                        {p.estado === 'activo' ? (
                                                            <Button variant="ghost" size="icon" title="Desactivar" onClick={() => cambiarEstadoPersonal(p.id, "inactivo")}>
                                                                <EyeOff className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" title="Activar" onClick={() => cambiarEstadoPersonal(p.id, "activo")}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => cambiarEstadoPersonal(p.id, "eliminado")}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
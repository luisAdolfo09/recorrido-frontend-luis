"use client"

import { useState, useMemo, useEffect, Fragment } from "react"
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
    Trash2, 
    Users, 
    DollarSign, 
    Bus, 
    UserCog, 
    Bell, 
    BarChart3, 
    TrendingDown, 
    List, 
    LayoutGrid, 
    Loader2,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    // 👇 FIX: Agregar Check
    Check
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- DEFINICIÓN DE TIPOS ---
export type Pago = {
    id: string;
    alumnoId: string;
    alumnoNombre: string; 
    monto: number;
    mes: string;
    fecha: string; 
    estado: "pagado" | "pendiente";
};

export type Alumno = {
    id: string;
    nombre: string;
    tutor: string;
    grado: string;
    precio?: number;
    activo: boolean; 
};

// --- MENÚ ---
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

// --- CONSTANTES ---
const ANIO_ESCOLAR = new Date().getFullYear().toString(); 
const MES_DICIEMBRE = `Diciembre ${ANIO_ESCOLAR}`; 
const MESES_CUADERNO = [
    "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
].map(mes => `${mes} ${ANIO_ESCOLAR}`);

const MESES_FILTRO = ["Todos", ...MESES_CUADERNO];

const GRADO_ORDER = [
    "1° Preescolar", "2° Preescolar", "3° Preescolar",
    "1° Primaria", "2° Primaria", "3° Primaria",
    "4° Primaria", "5° Primaria", "6° Primaria"
];

const formatCurrency = (num: number) => {
    return (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PagosPage() {
    const [pagos, setPagos] = useState<Pago[]>([]) 
    const [alumnos, setAlumnos] = useState<Alumno[]>([]) 
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()
    
    const [searchTerm, setSearchTerm] = useState("")
    const [cardMonthFilter, setCardMonthFilter] = useState("Todos");
    const [viewMode, setViewMode] = useState<'lista' | 'cuaderno'>('lista');
    
    const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // --- CARGAR DATOS ---
    const fetchDatos = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida o expirada.");

            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            
            const [pagosRes, alumnosRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/pagos`, { headers }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/alumnos`, { headers })
            ]);

            if (!pagosRes.ok) {
                if (pagosRes.status !== 404 && pagosRes.status !== 204) {
                    const errorData = await pagosRes.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error al cargar pagos (${pagosRes.status})`);
                }
                setPagos([]);
            } else {
                setPagos(await pagosRes.json());
            }
            
            if (!alumnosRes.ok) {
                 if (alumnosRes.status !== 404 && alumnosRes.status !== 204) {
                    const errorData = await alumnosRes.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error al cargar alumnos (${alumnosRes.status})`);
                }
                setAlumnos([]);
            } else {
                const alumnosData: Alumno[] = await alumnosRes.json();
                const alumnosNormalizados = alumnosData
                    .filter(a => a.activo)
                    .map(a => ({
                        ...a,
                        tutor: (a as any).tutorUser?.nombre || a.tutor || "Sin Tutor"
                    }));
                setAlumnos(alumnosNormalizados);
            }
            
        } catch (err: any) {
            setError(err.message);
            toast({ title: "Error al cargar datos", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => { fetchDatos(); }, [toast]);

    // --- FILTRADO GLOBAL ---
    const filteredPagosBase = useMemo(() => {
        let pagosFiltrados = [...pagos];
        if (cardMonthFilter !== "Todos") {
            pagosFiltrados = pagosFiltrados.filter(p => p.mes === cardMonthFilter);
        }
        if (searchTerm) {
            pagosFiltrados = pagosFiltrados.filter(p =>
                p.alumnoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.mes.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return pagosFiltrados;
    }, [pagos, searchTerm, cardMonthFilter]);

    // --- AGRUPACIÓN PARA VISTA DE LISTA (FAMILIAS) ---
    const pagosAgrupadosPorFamilia = useMemo(() => {
        const grupos = new Map<string, { tutor: string, total: number, pagos: Pago[], pendiente: number }>();

        filteredPagosBase.forEach(pago => {
            const alumno = alumnos.find(a => a.id === pago.alumnoId);
            const tutorNombre = alumno?.tutor || "Tutor Desconocido";

            if (searchTerm && !tutorNombre.toLowerCase().includes(searchTerm.toLowerCase()) && !pago.alumnoNombre.toLowerCase().includes(searchTerm.toLowerCase())) {
                 return;
            }

            if (!grupos.has(tutorNombre)) {
                grupos.set(tutorNombre, { tutor: tutorNombre, total: 0, pagos: [], pendiente: 0 });
            }

            const grupo = grupos.get(tutorNombre)!;
            grupo.pagos.push(pago);
            grupo.total += Number(pago.monto);
        });

        // --- CÁLCULO DE PENDIENTES ---
        for (const grupo of grupos.values()) {
             const alumnosFamilia = alumnos.filter(a => a.tutor === grupo.tutor);
             let totalEsperado = 0;

             if (cardMonthFilter === "Todos") {
                 totalEsperado = alumnosFamilia.reduce((sum, a) => sum + (Number(a.precio) || 0) * 11, 0);
             } else {
                 totalEsperado = alumnosFamilia.reduce((sum, a) => sum + (Number(a.precio) || 0), 0);
             }

             const deuda = totalEsperado - grupo.total;
             grupo.pendiente = deuda > 0 ? deuda : 0;
        }

        // Ordenar alfabéticamente por tutor
        return Array.from(grupos.values()).sort((a, b) => a.tutor.localeCompare(b.tutor));
    }, [filteredPagosBase, alumnos, searchTerm, cardMonthFilter]);


    // --- LÓGICA DE CUADERNO ---
    const cuadernoData = useMemo(() => {
        const pagosMap = new Map<string, Map<string, { fechaSimple: string | null, abonos: { fecha: string, monto: number }[], totalAbonado: number }>>();

        for (const pago of pagos) {
            if (pago.estado !== 'pagado' || !pago.fecha) continue;
            if (!pagosMap.has(pago.alumnoId)) pagosMap.set(pago.alumnoId, new Map());
            
            const fechaParts = pago.fecha.split('-'); 
            const fechaFormateada = `${fechaParts[2]}/${fechaParts[1]}`; 

            if (!pagosMap.get(pago.alumnoId)!.has(pago.mes)) {
                pagosMap.get(pago.alumnoId)!.set(pago.mes, { fechaSimple: null, abonos: [], totalAbonado: 0 });
            }
            const mesData = pagosMap.get(pago.alumnoId)!.get(pago.mes)!;
            const montoNumerico = Number(pago.monto) || 0; 

            if (pago.mes === MES_DICIEMBRE) {
                mesData.abonos.push({ fecha: fechaFormateada, monto: montoNumerico });
                mesData.totalAbonado += montoNumerico;
            } else {
                mesData.fechaSimple = fechaFormateada;
            }
        }

        let data = alumnos.map(alumno => {
            const pagosDelAlumno = pagosMap.get(alumno.id) || new Map();
            return {
                ...alumno, 
                meses: MESES_CUADERNO.map(mes => {
                    const mesData = pagosDelAlumno.get(mes) || { fechaSimple: null, abonos: [], totalAbonado: 0 };
                    const precio = Number(alumno.precio) || 0; 
                    let esDiciembrePagado = false;
                    if (mes === MES_DICIEMBRE) {
                        esDiciembrePagado = mesData.totalAbonado >= (precio - 0.01);
                    }
                    return { mes, ...mesData, esDiciembrePagado };
                })
            };
        });

        data = data.filter(a => a.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const grouped = data.reduce((acc, alumno) => {
            const grado = alumno.grado || "Sin Grado"; 
            if (!acc[grado]) acc[grado] = [];
            acc[grado].push(alumno);
            return acc;
        }, {} as Record<string, typeof data>); 

        const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
            const indexA = GRADO_ORDER.indexOf(a);
            const indexB = GRADO_ORDER.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return { grouped, sortedGroupKeys }; 
    }, [alumnos, pagos, searchTerm]); 

    // --- CÁLCULOS DE TARJETAS ---
    const totalPagado = useMemo(() => 
        filteredPagosBase
            .filter((p) => p.estado === "pagado")
            .reduce((sum, p) => sum + (Number(p.monto) || 0), 0),
    [filteredPagosBase]);
    
    const totalPendiente = useMemo(() => {
        const totalTeoricoAnual = alumnos.reduce((sum, alumno) => sum + (Number(alumno.precio) || 0) * 11, 0);
        const totalPagadoAnual = pagos
            .filter(p => p.estado === 'pagado' && p.mes.includes(ANIO_ESCOLAR)) 
            .reduce((sum, p) => sum + (Number(p.monto) || 0), 0);

        if (cardMonthFilter !== "Todos") {
            const totalTeoricoDelMes = alumnos.reduce((sum, alumno) => sum + (Number(alumno.precio) || 0), 0);
            const totalPagadoEseMes = pagos
                .filter(p => p.mes === cardMonthFilter && p.estado === 'pagado')
                .reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
            const saldo = totalTeoricoDelMes - totalPagadoEseMes;
            return saldo < 0 ? 0 : saldo;
        }
        const saldoAnual = totalTeoricoAnual - totalPagadoAnual;
        return saldoAnual < 0 ? 0 : saldoAnual;
    }, [pagos, alumnos, cardMonthFilter, ANIO_ESCOLAR]);
    
    const totalRegistros = useMemo(() => filteredPagosBase.length, [filteredPagosBase]);

    // --- ELIMINAR PAGO DE FAMILIA (LOTE) ---
    const handleDeleteGroup = async (pagosIds: string[], mes: string, tutor: string) => {
        if (!window.confirm(`¿Estás seguro de ELIMINAR el pago de ${mes} para la familia ${tutor}? Esta acción borrará los registros de todos los hijos.`)) {
            return;
        }
        
        setIsDeleting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            // Borramos uno por uno
            const deletePromises = pagosIds.map(id => 
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/pagos/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                })
            );

            await Promise.all(deletePromises);
            
            // Actualizamos estado local quitando todos los IDs borrados
            setPagos(prev => prev.filter((p) => !pagosIds.includes(p.id)));
            toast({ title: "Pago Familiar Eliminado", description: `Se eliminaron los registros de ${mes}.` });

        } catch (err: any) {
            toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleGroup = (tutorName: string) => {
        const newSet = new Set(expandedFamilies);
        if (newSet.has(tutorName)) newSet.delete(tutorName);
        else newSet.add(tutorName);
        setExpandedFamilies(newSet);
    };

    if (loading) return (
        <DashboardLayout title="Gestión de Pagos" menuItems={menuItems}>
            <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        </DashboardLayout>
    );

    if (error && pagos.length === 0 && alumnos.length === 0) return (
        <DashboardLayout title="Gestión de Pagos" menuItems={menuItems}>
            <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 rounded-lg border border-red-100">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-red-700 mb-2">Error al cargar datos</h3>
                <p className="text-muted-foreground max-w-md">{error}</p>
                <Button className="mt-4" onClick={fetchDatos}>Intentar de nuevo</Button>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout title="Gestión de Pagos" menuItems={menuItems}>
            <div className="space-y-6">
                
                <div className="flex justify-end">
                    <Select onValueChange={setCardMonthFilter} value={cardMonthFilter}>
                        <SelectTrigger className="w-full md:w-[240px]">
                            <SelectValue placeholder="Filtrar totales por mes" />
                        </SelectTrigger>
                        <SelectContent>
                            {MESES_FILTRO.map(mes => (
                                <SelectItem key={mes} value={mes}>
                                    {mes === "Todos" ? "Totales (Todo el Año)" : mes}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Card className="flex flex-col justify-between">
                        <CardHeader className="pb-2"><CardDescription className="text-sm font-medium">Total Pagado</CardDescription></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-green-600">C${totalPagado.toLocaleString()}</div></CardContent>
                    </Card>
                    <Card className="flex flex-col justify-between">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-sm font-medium">{cardMonthFilter === "Todos" ? "Total Pendiente (Anual)" : `Pendiente (${cardMonthFilter.split(" ")[0]})`}</CardDescription> 
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold text-orange-600">C${totalPendiente.toLocaleString()}</div></CardContent>
                    </Card>
                    <Card className="flex flex-col justify-between sm:col-span-2 md:col-span-1">
                        <CardHeader className="pb-2"><CardDescription className="text-sm font-medium">Total Registros</CardDescription></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{totalRegistros}</div></CardContent>
                    </Card>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar familia o alumno..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-full"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            onClick={() => setViewMode(viewMode === 'lista' ? 'cuaderno' : 'lista')}
                            className="w-full sm:w-auto"
                        >
                            {viewMode === 'lista' ? <LayoutGrid className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                            {viewMode === 'lista' ? 'Ver Resumen' : 'Ver Historial'}
                        </Button>
                        
                        <Link href="/dashboard/propietario/pagos/nuevo" className="w-full sm:w-auto">
                            <Button className="w-full">
                                <Plus className="h-4 w-4 mr-2" /> Registrar Pago
                            </Button>
                        </Link>
                    </div>
                </div>

                <Card>
                    {viewMode === 'lista' ? (
                        <>
                            <CardHeader>
                                <CardTitle>Historial de Transacciones</CardTitle>
                                <CardDescription>Pagos agrupados por Familia y Mes.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="hidden md:flex justify-between items-center p-3 font-semibold text-sm text-muted-foreground bg-muted/50 rounded-t-lg">
                                    <div className="w-[30%] pl-2">Familia / Tutor</div>
                                    <div className="w-[20%] text-center">Total Pagado</div>
                                    <div className="w-[20%] text-center">Total Pendiente</div>
                                    <div className="w-[30%] text-right pr-4">Acciones</div>
                                </div>

                                {pagosAgrupadosPorFamilia.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No hay pagos registrados.</div>
                                ) : (
                                    pagosAgrupadosPorFamilia.map(grupo => {
                                        const isExpanded = expandedFamilies.has(grupo.tutor);
                                        
                                        // Agrupar internamente por MES
                                        const pagosPorMes = new Map<string, { ids: string[], monto: number, fecha: string, alumnos: string[] }>();
                                        
                                        grupo.pagos.forEach(p => {
                                            if (!pagosPorMes.has(p.mes)) {
                                                pagosPorMes.set(p.mes, { ids: [], monto: 0, fecha: p.fecha, alumnos: [] });
                                            }
                                            const data = pagosPorMes.get(p.mes)!;
                                            data.ids.push(p.id);
                                            data.monto += Number(p.monto);
                                            data.alumnos.push(p.alumnoNombre);
                                        });

                                        return (
                                            <div key={grupo.tutor} className="border rounded-lg overflow-hidden transition-colors hover:bg-muted/20">
                                                <div 
                                                    className="flex flex-col md:flex-row justify-between items-center p-4 cursor-pointer gap-4"
                                                    onClick={() => toggleGroup(grupo.tutor)}
                                                >
                                                    {/* Col 1: Tutor */}
                                                    <div className="w-full md:w-[30%] flex items-center gap-2">
                                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground"/> : <ChevronDown className="h-4 w-4 text-muted-foreground"/>}
                                                        <span className="font-medium text-lg">{grupo.tutor}</span>
                                                    </div>

                                                    {/* Col 2: Total Pagado */}
                                                    <div className="w-full md:w-[20%] text-left md:text-center">
                                                        <span className="font-bold text-green-600">C$ {formatCurrency(grupo.total)}</span>
                                                    </div>

                                                    {/* Col 3: Total Pendiente (NUEVA) */}
                                                    <div className="w-full md:w-[20%] text-left md:text-center">
                                                        {grupo.pendiente > 0 ? (
                                                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-400">
                                                                C$ {formatCurrency(grupo.pendiente)}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400">
                                                                <Check className="h-3 w-3 mr-1" /> Al día
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {/* Col 4: Acciones */}
                                                    <div className="w-full md:w-[30%] text-left md:text-right">
                                                        <Badge variant="outline">{grupo.pagos.length} pagos</Badge>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="bg-muted/30 border-t p-4">
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Mes / Concepto</TableHead>
                                                                        <TableHead>Monto Familiar</TableHead>
                                                                        <TableHead>Detalle Alumnos</TableHead>
                                                                        <TableHead>Fecha</TableHead>
                                                                        <TableHead className="text-right">Acciones</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {Array.from(pagosPorMes.entries()).map(([mes, data]) => (
                                                                        <TableRow key={mes} className="bg-background">
                                                                            <TableCell className="font-medium">{mes}</TableCell>
                                                                            <TableCell className="font-bold text-green-600">C$ {formatCurrency(data.monto)}</TableCell>
                                                                            <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate" title={data.alumnos.join(', ')}>
                                                                                {data.alumnos.length} alumnos ({data.alumnos.slice(0, 2).join(', ')}{data.alumnos.length > 2 ? '...' : ''})
                                                                            </TableCell>
                                                                            <TableCell>{data.fecha ? new Date(data.fecha + 'T00:00:00').toLocaleDateString('es-NI') : "-"}</TableCell>
                                                                            <TableCell className="text-right">
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="icon" 
                                                                                    disabled={isDeleting}
                                                                                    onClick={() => handleDeleteGroup(data.ids, mes, grupo.tutor)}
                                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                                    title="Eliminar pago familiar"
                                                                                >
                                                                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                            </CardContent>
                        </>
                    ) : (
                        <>
                            <CardHeader>
                                <CardTitle>Resumen Anual (Vista Cuaderno)</CardTitle>
                                <CardDescription>Fechas de pago registradas por alumno para el año {ANIO_ESCOLAR}.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {alumnos.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No hay alumnos activos para mostrar el resumen anual.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[1200px] md:min-w-[1400px]"> 
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[160px] min-w-[160px] md:w-[200px] md:min-w-[200px]">Alumno</TableHead>
                                                    <TableHead className="w-[100px] min-w-[100px] md:w-[120px] md:min-w-[120px]">Mensualidad</TableHead>
                                                    {MESES_CUADERNO.map(mes => (
                                                        <TableHead key={mes} className="text-center w-[100px]">{mes.split(" ")[0]}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>{
                                                cuadernoData.sortedGroupKeys.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={13} className="text-center text-muted-foreground">No se encontraron alumnos.</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    cuadernoData.sortedGroupKeys.map(grado => (
                                                        <Fragment key={grado}>
                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                <TableCell colSpan={13} className="bg-muted/50 font-semibold text-sm">{grado}</TableCell>
                                                            </TableRow>
                                                            {cuadernoData.grouped[grado].map((alumno) => (
                                                                <TableRow key={alumno.id}>
                                                                    <TableCell className="font-medium w-[160px] min-w-[160px] md:w-[200px] md:min-w-[200px]">{alumno.nombre}</TableCell>
                                                                    <TableCell className="font-medium w-[100px] min-w-[100px] md:w-[120px] md:min-w-[120px]">C$ {formatCurrency(Number(alumno.precio) || 0)}</TableCell>
                                                                    {alumno.meses.map((mesData) => (
                                                                        <TableCell key={mesData.mes} className="text-center align-top">
                                                                            {mesData.mes === MES_DICIEMBRE ? (
                                                                                mesData.abonos.length > 0 ? (
                                                                                    <div className="flex flex-col gap-1 items-center">
                                                                                        {mesData.abonos.map((abono: { fecha: string; monto: number }, idx: number) => (
                                                                                            <Badge key={idx} variant={mesData.esDiciembrePagado ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                                                                                                {abono.fecha} - C${formatCurrency(abono.monto)}
                                                                                            </Badge>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : <span className="text-muted-foreground">-</span>
                                                                            ) : (
                                                                                mesData.fechaSimple ? <Badge variant="default">{mesData.fechaSimple}</Badge> : <span className="text-muted-foreground">-</span>
                                                                            )}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </Fragment>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>
        </DashboardLayout>
    )
}
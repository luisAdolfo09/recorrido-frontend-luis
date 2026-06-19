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
    AlertTriangle,
    FileSpreadsheet,
    FileText
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase" // <--- Importamos Supabase
import { ReportPDF, exportExcel, REPORT_COLORS, fmtMoney, type RGB } from "@/lib/report-utils"

// --- TIPO GASTO (ACTUALIZADO) ---
export type Gasto = {
    id: string;
    descripcion: string;
    categoria: string;
    monto: number;
    fecha: string; 
    estado: "activo" | "inactivo" | "eliminado";
    vehiculoId: string | null;
    vehiculo?: { 
        id: string;
        nombre: string;
    }
    personalId: string | null;
    personal?: {
        id: string;
        nombre: string;
    }
};

// --- TIPO VEHÍCULO (PARA EL FILTRO) ---
type Vehiculo = {
    id: string;
    nombre: string;
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

// Helper de formato de moneda
const formatCurrency = (num: number) => {
    return (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- CONSTANTES PARA FILTROS ---
const CATEGORIAS_FILTRO = ["combustible", "mantenimiento", "salarios", "otros"];
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function GastosPage() {
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [estadoFilter, setEstadoFilter] = useState("activo"); 
    const [categoriaFilter, setCategoriaFilter] = useState("combustible");
    const [vehiculoFilter, setVehiculoFilter] = useState("todos");
    const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
    const { toast } = useToast()

    // --- Cargar Gastos y Vehículos ---
    const fetchDatos = async () => {
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
            
            const [gastosRes, vehiculosRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/gastos?estado=${estadoFilter}`, { headers }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos?estado=activo`, { headers })
            ]);
            
            // 1. Manejo de Gastos (CRÍTICO)
            if (!gastosRes.ok) {
                if (gastosRes.status === 404 || gastosRes.status === 204) {
                    setGastos([]);
                } else {
                    const errorData = await gastosRes.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error al cargar gastos (${gastosRes.status})`);
                }
            } else {
                setGastos(await gastosRes.json());
            }

            // 2. Manejo de Vehículos
            if (!vehiculosRes.ok) {
                 if (vehiculosRes.status === 404 || vehiculosRes.status === 204) {
                    setVehiculos([]);
                } else {
                    const errorData = await vehiculosRes.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error al cargar vehículos (${vehiculosRes.status})`);
                }
            } else {
                 setVehiculos(await vehiculosRes.json());
            }
            
        } catch (err: any) {
            setError(err.message);
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchDatos();
    }, [toast, estadoFilter]); 

    // --- Filtrar por Búsqueda (para la tabla) ---
    const filteredGastos = useMemo(() => {
        let filtrados = gastos.filter(
            (gasto) =>
                gasto.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                gasto.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (gasto.vehiculo && gasto.vehiculo.nombre.toLowerCase().includes(searchTerm.toLowerCase())) || 
                (gasto.personal && gasto.personal.nombre.toLowerCase().includes(searchTerm.toLowerCase())) 
        );
        
        // Aplicar filtros de tarjetas a la tabla (aunque las tarjetas usen un filtro distinto)
        if (categoriaFilter && categoriaFilter !== 'todos') {
             filtrados = filtrados.filter(g => g.categoria === categoriaFilter);
        }
        if (vehiculoFilter && vehiculoFilter !== 'todos') {
             filtrados = filtrados.filter(g => g.vehiculoId === vehiculoFilter);
        }
        
        return filtrados;

    }, [gastos, searchTerm, categoriaFilter, vehiculoFilter]);

    // --- Cálculos para Tarjetas ---
    const totalGastado = gastos.reduce((sum, g) => sum + (g.monto || 0), 0)
    
    const hoy = new Date()
    const mesActual = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0")
    const gastoDelMes = gastos
        .filter((g) => g.fecha.startsWith(mesActual))
        .reduce((sum, g) => sum + (g.monto || 0), 0)

    const gastoPorCategoria = useMemo(() => {
        const gastosFiltrados = gastos.filter(g => g.categoria === categoriaFilter);
        return gastosFiltrados.reduce((sum, g) => sum + (g.monto || 0), 0);
    }, [gastos, categoriaFilter]);

    const gastoCategoriaTitle = useMemo(() => {
        return `Total - ${capitalizar(categoriaFilter)}`;
    }, [categoriaFilter]);

    const gastoPorVehiculo = useMemo(() => {
        let gastosFiltrados = gastos;
        if (vehiculoFilter !== "todos") {
            gastosFiltrados = gastosFiltrados.filter(g => g.vehiculoId === vehiculoFilter);
        } else {
            gastosFiltrados = gastosFiltrados.filter(g => !!g.vehiculoId);
        }
        return gastosFiltrados.reduce((sum, g) => sum + (g.monto || 0), 0);
    }, [gastos, vehiculoFilter]);

    const gastoVehiculoTitle = useMemo(() => {
        if (vehiculoFilter === "todos") {
            return "Gasto Total (Vehículos)";
        }
        const vehiculo = vehiculos.find(v => v.id === vehiculoFilter);
        return `Gasto - ${vehiculo?.nombre || 'Vehículo'}`;
    }, [vehiculoFilter, vehiculos]);
    // --- FIN CÁLCULOS ---


    const getBadgeVariant = (categoria: string) => {
        switch (categoria) {
            case "combustible": return "destructive"
            case "mantenimiento": return "secondary"
            case "salarios": return "outline"
            default: return "default"
        }
    }

    const cambiarEstadoGasto = async (id: string, nuevoEstado: "activo" | "inactivo" | "eliminado") => {
        const gasto = gastos.find(g => g.id === id);
        if (!gasto) return;

        if (!window.confirm(`¿Estás seguro de mover el gasto "${gasto.descripcion}" a ${nuevoEstado}? Esta acción es permanente.`)) return;

        try {
             const { data: { session } } = await supabase.auth.getSession();
             const token = session?.access_token;
             if (!token) throw new Error("Sesión no válida.");

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gastos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, // Envío de Token
                body: JSON.stringify({ estado: nuevoEstado }), 
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || "No se pudo actualizar el estado del gasto");
            }
            
            fetchDatos(); 

            let mensaje = "";
            if (nuevoEstado === "eliminado") mensaje = "Gasto eliminado correctamente";
            if (nuevoEstado === "inactivo") mensaje = "Gasto desactivado correctamente";
            if (nuevoEstado === "activo") mensaje = "Gasto activado correctamente";

            toast({
                title: "Estado actualizado",
                description: `${mensaje}: ${gasto?.descripcion}`,
            });

        } catch (err: any) {
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        }
    }

    // --- HELPERS DE AGRUPACIÓN PARA REPORTES ---
    const COLOR_CATEGORIA: Record<string, RGB> = {
        combustible: REPORT_COLORS.red,
        mantenimiento: REPORT_COLORS.orange,
        salarios: REPORT_COLORS.indigo,
        otros: REPORT_COLORS.slate,
    };

    const construirDatosReporte = () => {
        const periodoLabel = `Gastos ${estadoFilter === 'activo' ? 'activos' : 'inactivos'}`;

        // KPIs
        const categoriasDistintas = new Set(gastos.map(g => g.categoria));
        const vehiculosConGasto = new Set(gastos.filter(g => g.vehiculoId).map(g => g.vehiculoId));

        // Por categoría
        const catMap = new Map<string, { count: number; monto: number }>();
        gastos.forEach(g => {
            const prev = catMap.get(g.categoria) || { count: 0, monto: 0 };
            catMap.set(g.categoria, { count: prev.count + 1, monto: prev.monto + (g.monto || 0) });
        });
        const porCategoria = Array.from(catMap.entries())
            .map(([categoria, v]) => ({ categoria, ...v }))
            .sort((a, b) => b.monto - a.monto);

        // Por mes (YYYY-MM)
        const mesMap = new Map<string, { count: number; monto: number }>();
        gastos.forEach(g => {
            const key = (g.fecha || "").substring(0, 7);
            if (!key) return;
            const prev = mesMap.get(key) || { count: 0, monto: 0 };
            mesMap.set(key, { count: prev.count + 1, monto: prev.monto + (g.monto || 0) });
        });
        const porMes = Array.from(mesMap.entries())
            .map(([key, v]) => ({
                key,
                legible: capitalizar(new Date(key + "-01T00:00:00").toLocaleDateString("es-NI", { month: "long", year: "numeric" })),
                ...v,
            }))
            .sort((a, b) => a.key.localeCompare(b.key));

        // Por vehículo
        const vehMap = new Map<string, { count: number; monto: number }>();
        gastos.filter(g => g.vehiculoId).forEach(g => {
            const nombre = g.vehiculo?.nombre || "Sin asignar";
            const prev = vehMap.get(nombre) || { count: 0, monto: 0 };
            vehMap.set(nombre, { count: prev.count + 1, monto: prev.monto + (g.monto || 0) });
        });
        const porVehiculo = Array.from(vehMap.entries())
            .map(([nombre, v]) => ({ nombre, ...v }))
            .sort((a, b) => b.monto - a.monto);

        // Por personal
        const persMap = new Map<string, { count: number; monto: number }>();
        gastos.filter(g => g.personalId).forEach(g => {
            const nombre = g.personal?.nombre || "Sin asignar";
            const prev = persMap.get(nombre) || { count: 0, monto: 0 };
            persMap.set(nombre, { count: prev.count + 1, monto: prev.monto + (g.monto || 0) });
        });
        const porPersonal = Array.from(persMap.entries())
            .map(([nombre, v]) => ({ nombre, ...v }))
            .sort((a, b) => b.monto - a.monto);

        return {
            periodoLabel,
            categoriasDistintas,
            vehiculosConGasto,
            porCategoria,
            porMes,
            porVehiculo,
            porPersonal,
        };
    };

    const handleExportarPDF = async () => {
        setExporting('pdf');
        try {
            const d = construirDatosReporte();

            const pdf = new ReportPDF({
                titulo: "REPORTE DE GASTOS",
                subtitulo: "Gestión de Gastos Operativos",
                periodoLabel: d.periodoLabel,
                accent: REPORT_COLORS.red,
            });

            // 1. KPIs
            pdf.kpis([
                { label: "Gasto Total", value: "C$ " + fmtMoney(totalGastado), color: REPORT_COLORS.red },
                { label: "Gasto del Mes", value: "C$ " + fmtMoney(gastoDelMes), color: REPORT_COLORS.orange },
                { label: "Nº Registros", value: String(gastos.length), color: REPORT_COLORS.blue },
                { label: "Categorías", value: String(d.categoriasDistintas.size), color: REPORT_COLORS.purple },
                { label: "Vehículos con Gasto", value: String(d.vehiculosConGasto.size), color: REPORT_COLORS.indigo },
            ]);

            // 2. Gastos por Categoría
            pdf.sectionTitle("Gastos por Categoría");
            pdf.stackedBar(
                d.porCategoria.map(c => ({
                    label: capitalizar(c.categoria),
                    value: c.monto,
                    color: COLOR_CATEGORIA[c.categoria] || REPORT_COLORS.slate,
                })),
                "Distribución por categoría"
            );
            const totalCatMonto = d.porCategoria.reduce((s, c) => s + c.monto, 0);
            const totalCatCount = d.porCategoria.reduce((s, c) => s + c.count, 0);
            pdf.table(
                ["Categoría", "Nº", "Monto (C$)", "%"],
                [
                    ...d.porCategoria.map(c => [
                        capitalizar(c.categoria),
                        c.count,
                        fmtMoney(c.monto),
                        (totalCatMonto > 0 ? (c.monto / totalCatMonto * 100) : 0).toFixed(1) + "%",
                    ]),
                    ["TOTAL", totalCatCount, fmtMoney(totalCatMonto), "100.0%"],
                ],
                { align: ["left", "center", "right", "right"] }
            );

            // 3. Gastos por Mes
            pdf.sectionTitle("Gastos por Mes");
            pdf.table(
                ["Mes", "Nº", "Monto (C$)"],
                d.porMes.map(m => [m.legible, m.count, fmtMoney(m.monto)]),
                { align: ["left", "center", "right"] }
            );

            // 4. Gastos por Vehículo (omitir si no hay)
            if (d.porVehiculo.length > 0) {
                pdf.sectionTitle("Gastos por Vehículo", undefined, REPORT_COLORS.orange);
                pdf.table(
                    ["Vehículo", "Nº", "Monto (C$)"],
                    d.porVehiculo.map(v => [v.nombre, v.count, fmtMoney(v.monto)]),
                    { align: ["left", "center", "right"] }
                );
            }

            // 5. Salarios por Personal (omitir si no hay)
            if (d.porPersonal.length > 0) {
                pdf.sectionTitle("Salarios por Personal", undefined, REPORT_COLORS.indigo);
                pdf.table(
                    ["Personal", "Nº", "Monto (C$)"],
                    d.porPersonal.map(p => [p.nombre, p.count, fmtMoney(p.monto)]),
                    { align: ["left", "center", "right"] }
                );
            }

            // 6. Detalle de Gastos
            pdf.sectionTitle("Detalle de Gastos");
            pdf.table(
                ["Descripción", "Categoría", "Vehículo", "Personal", "Monto (C$)", "Fecha"],
                gastos.map(g => [
                    g.descripcion,
                    capitalizar(g.categoria),
                    g.vehiculo?.nombre || "-",
                    g.personal?.nombre || "-",
                    fmtMoney(g.monto || 0),
                    g.fecha ? new Date(g.fecha + "T00:00:00").toLocaleDateString("es-NI") : "-",
                ]),
                {
                    colWidths: [46, 26, 28, 28, 26, 28],
                    align: ["left", "left", "left", "left", "right", "center"],
                }
            );

            // 7. Nota
            pdf.note([
                "Reporte de gastos generado automáticamente.",
                "Incluye únicamente los gastos en estado: " + estadoFilter + ".",
            ]);

            // 8. Guardar
            pdf.save("Reporte_Gastos");

            toast({ title: "Exportación exitosa", description: "El reporte PDF se generó correctamente." });
        } catch (err: any) {
            toast({ title: "Error al exportar PDF", description: (err as Error).message, variant: "destructive" });
        } finally {
            setExporting(null);
        }
    };

    const handleExportarExcel = async () => {
        setExporting('excel');
        try {
            const d = construirDatosReporte();
            const totalCatMonto = d.porCategoria.reduce((s, c) => s + c.monto, 0);
            const totalCatCount = d.porCategoria.reduce((s, c) => s + c.count, 0);

            const resumen: (string | number)[][] = [
                ["KPI", "Valor"],
                ["Gasto Total (C$)", fmtMoney(totalGastado)],
                ["Gasto del Mes (C$)", fmtMoney(gastoDelMes)],
                ["Nº Registros", gastos.length],
                ["Categorías", d.categoriasDistintas.size],
                ["Vehículos con Gasto", d.vehiculosConGasto.size],
                ["Periodo", d.periodoLabel],
            ];

            const porCategoria: (string | number)[][] = [
                ["Categoría", "Nº", "Monto (C$)", "%"],
                ...d.porCategoria.map(c => [
                    capitalizar(c.categoria),
                    c.count,
                    fmtMoney(c.monto),
                    (totalCatMonto > 0 ? (c.monto / totalCatMonto * 100) : 0).toFixed(1) + "%",
                ]),
                ["TOTAL", totalCatCount, fmtMoney(totalCatMonto), "100.0%"],
            ];

            const porMes: (string | number)[][] = [
                ["Mes", "Periodo", "Nº", "Monto (C$)"],
                ...d.porMes.map(m => [m.legible, m.key, m.count, fmtMoney(m.monto)]),
            ];

            const porVehiculo: (string | number)[][] = [
                ["Vehículo", "Nº", "Monto (C$)"],
                ...d.porVehiculo.map(v => [v.nombre, v.count, fmtMoney(v.monto)]),
            ];

            const porPersonal: (string | number)[][] = [
                ["Personal", "Nº", "Monto (C$)"],
                ...d.porPersonal.map(p => [p.nombre, p.count, fmtMoney(p.monto)]),
            ];

            const detalle: (string | number)[][] = [
                ["Descripción", "Categoría", "Vehículo", "Personal", "Monto", "Fecha", "Estado"],
                ...gastos.map(g => [
                    g.descripcion,
                    capitalizar(g.categoria),
                    g.vehiculo?.nombre || "Sin asignar",
                    g.personal?.nombre || "Sin asignar",
                    fmtMoney(g.monto || 0),
                    g.fecha ? new Date(g.fecha + "T00:00:00").toLocaleDateString("es-NI") : "-",
                    capitalizar(g.estado),
                ]),
            ];

            exportExcel("Reporte_Gastos", [
                { name: "Resumen", aoa: resumen, cols: [26, 22] },
                { name: "Por Categoría", aoa: porCategoria, cols: [22, 8, 18, 10] },
                { name: "Por Mes", aoa: porMes, cols: [24, 12, 8, 18] },
                { name: "Por Vehículo", aoa: porVehiculo, cols: [28, 8, 18] },
                { name: "Por Personal", aoa: porPersonal, cols: [28, 8, 18] },
                { name: "Detalle", aoa: detalle, cols: [34, 18, 22, 22, 14, 14, 12] },
            ]);

            toast({ title: "Exportación exitosa", description: "El reporte Excel se generó correctamente." });
        } catch (err: any) {
            toast({ title: "Error al exportar Excel", description: (err as Error).message, variant: "destructive" });
        } finally {
            setExporting(null);
        }
    };

    // --- MANEJO DE ESTADOS DE CARGA/ERROR ---
    if (loading) {
        return (
            <DashboardLayout title="Gestión de Gastos" menuItems={menuItems}>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="ml-3 text-muted-foreground">Cargando datos de gastos...</p>
                </div>
            </DashboardLayout>
        );
    }
    
    // Si hay error y no hay datos que mostrar
    if (error && gastos.length === 0) {
        return (
            <DashboardLayout title="Gestión de Gastos" menuItems={menuItems}>
                <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar datos iniciales</h3>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <Button className="mt-4" onClick={fetchDatos}>
                        Intentar de nuevo
                    </Button>
                </div>
            </DashboardLayout>
        );
    }


    // --- RENDERIZADO PRINCIPAL ---
    return (
        <DashboardLayout title="Gestión de Gastos" menuItems={menuItems}>
            <div className="space-y-6">

                {/* --- TARJETAS (AHORA 4 COLUMNAS) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-red-600">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">
                                Gasto Total ({estadoFilter === 'activo' ? 'Activos' : 'Inactivos'})
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold text-red-600">C${formatCurrency(totalGastado)}</div>
                        </CardContent>
                    </Card>
                    
                    <Card className="border-l-4 border-l-orange-500">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Gasto de este Mes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold text-orange-600">C${formatCurrency(gastoDelMes)}</div>
                        </CardContent>
                    </Card>
                    
                    {/* --- TARJETA DINÁMICA DE GASTO POR CATEGORÍA --- */}
                    <Card className="border-l-4 border-l-blue-600">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">{gastoCategoriaTitle}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold text-blue-600">C${formatCurrency(gastoPorCategoria)}</div>
                        </CardContent>
                    </Card>

                    {/* --- TARJETA DINÁMICA DE GASTO POR VEHÍCULO --- */}
                    <Card className="border-l-4 border-l-purple-600">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">{gastoVehiculoTitle}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl md:text-2xl font-bold text-purple-600">C${formatCurrency(gastoPorVehiculo)}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por descripción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-full"
                            />
                        </div>
                        <Select onValueChange={setEstadoFilter} value={estadoFilter}>
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="inactivo">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* --- FILTRO DE CATEGORÍA --- */}
                        <Select onValueChange={setCategoriaFilter} value={categoriaFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Gasto por categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIAS_FILTRO.map(c => (
                                    <SelectItem key={c} value={c}>{capitalizar(c)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* --- FILTRO DE VEHÍCULO --- */}
                        <Select onValueChange={setVehiculoFilter} value={vehiculoFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Gasto por vehículo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Total (Solo Vehículos)</SelectItem>
                                {vehiculos.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleExportarExcel}
                            disabled={exporting !== null}
                        >
                            {exporting === 'excel' ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                            )}
                            Excel
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleExportarPDF}
                            disabled={exporting !== null}
                        >
                            {exporting === 'pdf' ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4 mr-2" />
                            )}
                            PDF
                        </Button>
                        <Link href="/dashboard/propietario/gastos/nuevo" className="w-full sm:w-auto">
                            <Button className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Registrar Gasto
                            </Button>
                        </Link>
                    </div>
                </div>


                {/* --- MENSAJE DE TABLA VACÍA --- */}
                {gastos.length === 0 && !loading && (
                    <Card className="mt-6 border-l-4 border-l-pink-500">
                        <CardHeader>
                            <CardTitle>No hay gastos registrados</CardTitle>
                            <CardDescription>
                                Registra tu primer gasto de combustible, mantenimiento o salario.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/propietario/gastos/nuevo">
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" /> Registrar Gasto
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}


                {/* --- TABLA --- */}
                {gastos.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Gastos ({estadoFilter === 'activo' ? 'Activos' : 'Inactivos'})</CardTitle>
                            <CardDescription>Registro de todos los gastos operativos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead>Vehículo</TableHead> 
                                            <TableHead>Personal</TableHead>
                                            <TableHead>Monto</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead> 
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredGastos.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center h-24">No se encontraron gastos que coincidan con los filtros.</TableCell>
                                            </TableRow>
                                        )}
                                        {filteredGastos.map((gasto) => (
                                            <TableRow key={gasto.id}>
                                                <TableCell className="font-medium whitespace-nowrap">{gasto.descripcion}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getBadgeVariant(gasto.categoria)}>
                                                        {capitalizar(gasto.categoria)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">{gasto.vehiculo?.nombre || "N/A"}</TableCell>
                                                <TableCell className="whitespace-nowrap">{gasto.personal?.nombre || "N/A"}</TableCell>
                                                <TableCell className="whitespace-nowrap">C${formatCurrency(gasto.monto)}</TableCell>
                                                <TableCell className="whitespace-nowrap">{new Date(gasto.fecha + "T00:00:00").toLocaleDateString('es-NI')}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/dashboard/propietario/gastos/${gasto.id}`}>
                                                            <Button variant="ghost" size="icon" title="Editar">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        
                                                        {gasto.estado === "activo" ? (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                title="Desactivar"
                                                                onClick={() => cambiarEstadoGasto(gasto.id, "inactivo")}
                                                            >
                                                                <EyeOff className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon"
                                                                title="Activar"
                                                                onClick={() => cambiarEstadoGasto(gasto.id, "activo")}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            title="Eliminar (Mover a Papelera)"
                                                            onClick={() => cambiarEstadoGasto(gasto.id, "eliminado")}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
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
    )
}
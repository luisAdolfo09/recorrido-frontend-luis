"use client"

import { useState, useMemo, useEffect } from "react"
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { 
    Search, Users, DollarSign, Bus, UserCog, Bell, BarChart3, TrendingDown, 
    Loader2, Check, CheckCheck, Gift, ArrowLeft, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- TIPOS ---
export type Pago = {
    id: string;
    alumnoId: string;
    monto: number; 
    mes: string;
    fecha: string; 
};

export type Alumno = {
    id: string;
    nombre: string;
    tutorUser?: { nombre: string; telefono: string }; 
    tutor?: string; 
    grado: string;
    precio?: number;
    activo: boolean;
    vehiculoId?: string | null;
    // Auxiliares
    proximoMes?: string;
    saldoDic?: number;
    mesesRestantes?: number;
};

type Familia = {
    id: string; 
    tutorNombre: string;
    tutorTelefono: string;
    alumnos: Alumno[];
    totalMensual: number;
    deudaDiciembreTotal: number;
    proximoMesComun: string; 
    montoAPagarComun: number; 
    totalAnioRestante: number;
    todosAlDia: boolean;
    mesesRestantesMax: number;
}

// --- MENÚ ---
const menuItems: MenuItem[] = [
    { title: "Gestionar Alumnos", description: "Ver y administrar estudiantes", icon: Users, href: "/dashboard/propietario/alumnos", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
    { title: "Gestionar Pagos", description: "Ver historial y registrar pagos", icon: DollarSign, href: "/dashboard/propietario/pagos", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20" },
    { title: "Gestionar Gastos", description: "Control de combustible, salarios, etc.", icon: TrendingDown, href: "/dashboard/propietario/gastos", color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-900/20" },
    { title: "Gestionar Personal", description: "Administrar empleados y choferes", icon: Users, href: "/dashboard/propietario/personal", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-900/20" },
    { title: "Gestionar Vehículos", description: "Administrar flota de vehículos", icon: Bus, href: "/dashboard/propietario/vehiculos", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-900/20" },
    { title: "Gestionar Usuarios", description: "Administrar accesos al sistema", icon: UserCog, href: "/dashboard/propietario/usuarios", color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-900/20" },
    { title: "Enviar Avisos", description: "Comunicados a tutores y personal", icon: Bell, href: "/dashboard/propietario/avisos", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/20" },
    { title: "Generar Reportes", description: "Estadísticas y análisis", icon: BarChart3, href: "/dashboard/propietario/reportes", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-500/20" },
]

// --- CONSTANTES ---
const ANIO_ESCOLAR = new Date().getFullYear().toString(); 
const MESES_REGULARES = [
    "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre"
];
const MES_DICIEMBRE = `Diciembre ${ANIO_ESCOLAR}`; 

const formatCurrency = (num: number) => {
    return (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- COMPONENTE TOOLTIP DE ERROR ---
const ErrorTooltip = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
        // z-20 para evitar superposiciones indeseadas, absolute position
        <div className="absolute top-full left-0 mt-1 z-20 animate-in fade-in zoom-in-95 duration-200 w-full min-w-[200px]">
            {/* Triangulito */}
            <div className="absolute -top-[5px] left-4 w-3 h-3 bg-white dark:bg-card border-t border-l border-gray-200 dark:border-gray-700 transform rotate-45 shadow-sm z-10" />
            {/* Caja del mensaje */}
            <div className="relative bg-white dark:bg-card border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 text-xs px-3 py-2 rounded-md shadow-lg flex items-center gap-2">
                <div className="bg-orange-500 text-white rounded-sm p-0.5 shrink-0 flex items-center justify-center w-4 h-4">
                    <span className="font-bold text-[10px]">!</span>
                </div>
                <span className="font-medium">{message}</span>
            </div>
        </div>
    );
};

export default function PagosRapidosPage() {
    const { toast } = useToast();
    const [alumnos, setAlumnos] = useState<Alumno[]>([]);
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    
    const [loadingAction, setLoadingAction] = useState<string | null>(null); 
    const [abonosDiciembre, setAbonosDiciembre] = useState<Map<string, string>>(new Map());
    // Estado para errores de validación en abonos: Clave = FamiliaID, Valor = Mensaje Error
    const [abonoErrors, setAbonoErrors] = useState<Map<string, string>>(new Map());
    
    const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

    // --- CARGAR DATOS ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            const headers = { 'Authorization': `Bearer ${token}` };
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            const [resAlumnos, resPagos] = await Promise.all([
                fetch(`${apiUrl}/alumnos`, { headers }),
                fetch(`${apiUrl}/pagos`, { headers })
            ]);

            if (resAlumnos.ok) setAlumnos(await resAlumnos.json());
            if (resPagos.ok) setPagos(await resPagos.json());

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- LÓGICA DE AGRUPACIÓN ---
    const familias = useMemo(() => {
        const grupos = new Map<string, Familia>();

        const alumnosCalculados = alumnos.map(alumno => {
            const precio = Number(alumno.precio) || 0;
            const misPagos = pagos.filter(p => p.alumnoId === alumno.id && p.mes.includes(ANIO_ESCOLAR));
            const pagosPorMes = new Map<string, number>();
            misPagos.forEach(p => {
                pagosPorMes.set(p.mes, (pagosPorMes.get(p.mes) || 0) + Number(p.monto));
            });

            let proximo = "AL DIA";
            let mesesRestantes = 0;
            for (let i = 0; i < MESES_REGULARES.length; i++) {
                const mesNombre = `${MESES_REGULARES[i]} ${ANIO_ESCOLAR}`;
                if ((pagosPorMes.get(mesNombre) || 0) < (precio - 0.1)) { 
                    proximo = mesNombre;
                    mesesRestantes = MESES_REGULARES.length - i;
                    break;
                }
            }
            const saldoDic = Math.max(0, precio - (pagosPorMes.get(MES_DICIEMBRE) || 0));
            return { ...alumno, proximoMes: proximo, saldoDic, mesesRestantes };
        });

        alumnosCalculados.forEach(alumno => {
            const tutorNombre = alumno.tutorUser?.nombre || (typeof alumno.tutor === 'string' ? alumno.tutor : "Sin Tutor");
            const tutorTelefono = alumno.tutorUser?.telefono || "N/A";
            
            if (!grupos.has(tutorNombre)) {
                grupos.set(tutorNombre, { 
                    id: tutorNombre, 
                    tutorNombre, 
                    tutorTelefono, 
                    alumnos: [], 
                    totalMensual: 0, 
                    deudaDiciembreTotal: 0, 
                    proximoMesComun: "AL DIA", 
                    montoAPagarComun: 0, 
                    totalAnioRestante: 0,
                    todosAlDia: true,
                    mesesRestantesMax: 0
                });
            }

            const grupo = grupos.get(tutorNombre)!;
            grupo.alumnos.push(alumno);
            grupo.totalMensual += (alumno.precio || 0);
            grupo.deudaDiciembreTotal += (alumno.saldoDic || 0);
            
            if (alumno.proximoMes !== "AL DIA") {
                const precio = alumno.precio || 0;
                const meses = alumno.mesesRestantes || 0;
                grupo.totalAnioRestante += (precio * meses);
                if (meses > grupo.mesesRestantesMax) grupo.mesesRestantesMax = meses;
            }
        });

        return Array.from(grupos.values()).map(grupo => {
            let mesMasAntiguoIdx = Infinity;
            grupo.alumnos.forEach(a => {
                if (a.proximoMes !== "AL DIA") {
                    const idx = MESES_REGULARES.indexOf(a.proximoMes?.split(" ")[0] || "");
                    if (idx !== -1 && idx < mesMasAntiguoIdx) {
                        mesMasAntiguoIdx = idx;
                    }
                }
            });

            if (mesMasAntiguoIdx === Infinity) {
                grupo.proximoMesComun = "AL DIA";
                grupo.todosAlDia = true;
            } else {
                grupo.proximoMesComun = `${MESES_REGULARES[mesMasAntiguoIdx]} ${ANIO_ESCOLAR}`;
                grupo.todosAlDia = false;
                grupo.montoAPagarComun = grupo.alumnos.reduce((total, a) => {
                    return (a.proximoMes === grupo.proximoMesComun) ? total + (a.precio || 0) : total;
                }, 0);
            }
            return grupo;
        }).filter(g => 
            g.tutorNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.alumnos.some(a => a.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    }, [alumnos, pagos, searchTerm]);

    // --- HANDLERS ---

    const handlePagarMesFamilia = async (familia: Familia) => {
        setLoadingAction(familia.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            const hijosAPagar = familia.alumnos.filter(a => a.proximoMes === familia.proximoMesComun);

            for (const hijo of hijosAPagar) {
                const payload = {
                    alumnoId: hijo.id,
                    alumnoNombre: hijo.nombre,
                    monto: hijo.precio,
                    mes: familia.proximoMesComun,
                    fecha: new Date().toISOString().split("T")[0],
                    estado: "pagado"
                };
                await fetch(`${apiUrl}/pagos`, { method: 'POST', headers, body: JSON.stringify(payload) });
            }
            
            fetchData(); 
            toast({ title: "Pago Familiar Exitoso", description: `Se cobró ${familia.proximoMesComun} a la familia.` });

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingAction(null);
        }
    };

    const handlePagarAnioFamilia = async (familia: Familia) => {
        setLoadingAction(familia.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            for (const hijo of familia.alumnos) {
                if (hijo.proximoMes === "AL DIA") continue;

                const mesInicialIdx = MESES_REGULARES.indexOf(hijo.proximoMes!.split(" ")[0]);
                if (mesInicialIdx === -1) continue;

                const mesesAPagar = MESES_REGULARES
                    .slice(mesInicialIdx) 
                    .map(m => `${m} ${ANIO_ESCOLAR}`); 

                const payload = {
                    alumnoId: hijo.id,
                    alumnoNombre: hijo.nombre,
                    montoPorMes: hijo.precio || 0,
                    meses: mesesAPagar, 
                    fecha: new Date().toISOString().split("T")[0],
                };

                await fetch(`${apiUrl}/pagos/batch`, { method: 'POST', headers, body: JSON.stringify(payload) });
            }

            fetchData();
            toast({ title: "¡Año Pagado!", description: "Se completaron todos los pagos regulares de la familia." });

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingAction(null);
        }
    };

    // 🚀 ABONO A DICIEMBRE (VALIDADO)
    const handleAbonarDiciembreFamilia = async (familia: Familia) => {
        const abonoStr = abonosDiciembre.get(familia.id);
        const abonoTotal = parseFloat(abonoStr || "0");

        // Validación final antes de enviar (aunque la UI ya bloquea)
        if (!abonoTotal || abonoTotal <= 0) {
            return toast({ title: "Monto inválido", description: "Ingrese un monto válido.", variant: "destructive" });
        }
        if (abonoTotal > familia.deudaDiciembreTotal + 0.1) {
            return toast({ title: "Monto Excesivo", description: "El abono supera la deuda.", variant: "destructive" });
        }

        setLoadingAction(familia.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            const hijosConDeuda = familia.alumnos.filter(a => (a.saldoDic || 0) > 0.01);
            let restantePorDistribuir = abonoTotal;
            
            const montoIdealPorHijo = remainingToTwoDecimals(restantePorDistribuir / hijosConDeuda.length);

            for (let i = 0; i < hijosConDeuda.length; i++) {
                const hijo = hijosConDeuda[i];
                let pagoHijo = (i === hijosConDeuda.length - 1) 
                    ? restantePorDistribuir 
                    : montoIdealPorHijo;
                
                pagoHijo = Math.min(pagoHijo, hijo.saldoDic!);
                pagoHijo = remainingToTwoDecimals(pagoHijo);

                if (pagoHijo <= 0) continue;

                const payload = {
                    alumnoId: hijo.id,
                    alumnoNombre: hijo.nombre,
                    monto: pagoHijo,
                    mes: MES_DICIEMBRE,
                    fecha: new Date().toISOString().split("T")[0],
                    estado: "pagado"
                };

                await fetch(`${apiUrl}/pagos`, { method: 'POST', headers, body: JSON.stringify(payload) });
                restantePorDistribuir -= pagoHijo;
            }

            fetchData();
            toast({ title: "Abono Registrado", description: `Se distribuyeron C$ ${abonoTotal} entre los hermanos.` });
            
            // Limpiar el campo y errores
            const newAbonos = new Map(abonosDiciembre);
            newAbonos.set(familia.id, "");
            setAbonosDiciembre(newAbonos);
            
            const newErrors = new Map(abonoErrors);
            newErrors.delete(familia.id);
            setAbonoErrors(newErrors);

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingAction(null);
        }
    };

    const remainingToTwoDecimals = (num: number) => {
        return Math.floor(num * 100) / 100;
    }

    const toggleFamily = (id: string) => {
        const newSet = new Set(expandedFamilies);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedFamilies(newSet);
    }

    if (loading) return (
        <DashboardLayout title="Gestión de Pagos" menuItems={menuItems}>
            <div className="flex justify-center h-64 items-center"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>
        </DashboardLayout>
    );

    if (alumnos.length === 0) return (
        <DashboardLayout title="Gestión de Pagos" menuItems={menuItems}>
            <div className="text-center p-10 bg-muted/20 rounded-lg border border-dashed">
                <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4"/>
                <h3 className="text-xl font-bold">Sin Alumnos Registrados</h3>
                <p className="text-muted-foreground mb-6">Registra alumnos primero para poder gestionar sus pagos.</p>
                <Link href="/dashboard/propietario/alumnos/nuevo"><Button>Ir a Registro</Button></Link>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout title="Registro de Pagos" menuItems={menuItems}>
            <div className="space-y-4">
                
                {/* BOTÓN VOLVER Y BÚSQUEDA */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <Link href="/dashboard/propietario/pagos">
                        <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4"/> Volver al Historial</Button>
                    </Link>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar familia o alumno..." 
                            className="pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* LISTA PRINCIPAL */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <CardTitle>Registro Rápido de Pagos</CardTitle>
                                <CardDescription>
                                    Pague meses regulares (Feb-Nov) o abone a Diciembre en cualquier momento.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-2">
                        
                        {/* Encabezado */}
                        <div className="hidden md:flex justify-between items-center p-3 font-semibold text-sm text-muted-foreground bg-muted/50 rounded-t-lg">
                            <div className="w-1/4 pl-2">Familia / Tutor</div>
                            <div className="w-1/6 text-center">Mensualidad Total</div>
                            <div className="w-1/6 text-center">Estado (Mes)</div>
                            <div className="w-1/6 text-center">Saldo Diciembre</div>
                            <div className="w-[25%] text-right pr-2">Acciones Rápidas</div>
                        </div>
                        
                        {/* Filas de Familias */}
                        {familias.map((familia) => {
                            const isExpanded = expandedFamilies.has(familia.id);
                            const isLoading = loadingAction === familia.id;
                            const esRegularPagado = familia.todosAlDia;
                            const esDiciembrePagado = familia.deudaDiciembreTotal <= 0;

                            // Obtener error específico para esta familia si existe
                            const abonoError = abonoErrors.get(familia.id);
                            const abonoValue = abonosDiciembre.get(familia.id) || '';
                            const hasAbonoError = !!abonoError;
                            // Deshabilitar botón si hay error, está cargando, ya pagó o el campo está vacío
                            const isAbonoDisabled = isLoading || esDiciembrePagado || hasAbonoError || abonoValue === '';

                            return (
                                <div key={familia.id} className="border rounded-lg overflow-hidden transition-colors hover:bg-muted/20">
                                    
                                    {/* FILA PRINCIPAL (Resumen) */}
                                    <div 
                                        className="flex flex-col md:flex-row justify-between items-stretch p-3 gap-4 cursor-pointer"
                                        onClick={() => toggleFamily(familia.id)}
                                    >
                                        {/* Col 1: Tutor */}
                                        <div className="w-full md:w-1/4 flex items-center gap-2">
                                            <div>
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground inline mr-2"/> : <ChevronDown className="h-4 w-4 text-muted-foreground inline mr-2"/>}
                                                <span className="font-medium">{familia.tutorNombre}</span>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {familia.alumnos.length} hijo(s) • {familia.tutorTelefono}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Col 2: Mensualidad Total */}
                                        <div className="w-full md:w-1/6 flex flex-col justify-center text-left md:text-center">
                                            <span className="font-bold text-foreground">C$ {formatCurrency(familia.totalMensual)}</span>
                                        </div>
                                        
                                        {/* Col 3: Estado Regular */}
                                        <div className="w-full md:w-1/6 flex flex-col justify-center text-left md:text-center">
                                            {esRegularPagado ? (
                                                <Badge variant="default" className="w-fit md:mx-auto bg-green-600">Al día</Badge>
                                            ) : (
                                                <div>
                                                    <span className="font-medium text-orange-600 block text-sm">{familia.proximoMesComun}</span>
                                                    <span className="text-xs text-muted-foreground">Debe: C$ {formatCurrency(familia.montoAPagarComun)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Col 4: Saldo Diciembre (Solo texto) */}
                                        <div className="w-full md:w-1/6 flex flex-col justify-center text-left md:text-center">
                                            {esDiciembrePagado ? (
                                                <Badge variant="secondary" className="w-fit md:mx-auto bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200">Pagado</Badge>
                                            ) : (
                                                <span className="font-medium text-sm">C$ {formatCurrency(familia.deudaDiciembreTotal)}</span>
                                            )}
                                        </div>
                                        
                                        {/* Col 5: Acciones */}
                                        <div className="w-full md:w-[25%] text-left md:text-right space-y-2" onClick={e => e.stopPropagation()}>
                                            
                                            {/* Botón Pagar Mes */}
                                            <Button 
                                                onClick={() => handlePagarMesFamilia(familia)}
                                                disabled={isLoading || esRegularPagado}
                                                size="sm"
                                                className="w-full bg-primary hover:bg-primary/90 h-8"
                                            >
                                                {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
                                                Pagar Mes (C$ {formatCurrency(familia.montoAPagarComun)})
                                            </Button>

                                            {/* Botón Pagar Año */}
                                            <Button 
                                                onClick={() => handlePagarAnioFamilia(familia)}
                                                disabled={isLoading || esRegularPagado || familia.mesesRestantesMax <= 1}
                                                size="sm"
                                                variant="outline"
                                                className="w-full h-8"
                                            >
                                                {isLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCheck className="mr-2 h-3 w-3" />}
                                                Pagar Año (C$ {formatCurrency(familia.totalAnioRestante)})
                                            </Button>

                                            <Separator className="my-1"/>

                                            {/* Sección Abono Diciembre (Vertical) */}
                                            <div className="space-y-1 relative group">
                                                <Input
                                                    type="number"
                                                    placeholder={`Abono (Max: ${formatCurrency(familia.deudaDiciembreTotal)})`}
                                                    value={abonosDiciembre.get(familia.id) || ''}
                                                    onChange={(e) => {
                                                        const valStr = e.target.value;
                                                        const val = parseFloat(valStr);
                                                        const max = familia.deudaDiciembreTotal;

                                                        // Actualizar valor
                                                        setAbonosDiciembre(new Map(abonosDiciembre.set(familia.id, valStr)));

                                                        // Validar en tiempo real
                                                        const newErrors = new Map(abonoErrors);
                                                        if (valStr !== "") {
                                                            if (val <= 0) {
                                                                newErrors.set(familia.id, "El monto debe ser mayor a 0.");
                                                            } else if (val > max + 0.01) {
                                                                newErrors.set(familia.id, `Máximo permitido: C$ ${formatCurrency(max)}`);
                                                            } else {
                                                                newErrors.delete(familia.id);
                                                            }
                                                        } else {
                                                            newErrors.delete(familia.id);
                                                        }
                                                        setAbonoErrors(newErrors);
                                                    }}
                                                    disabled={isLoading || esDiciembrePagado}
                                                    className={`h-8 text-xs ${abonoError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                                />
                                                {/* Tooltip de error específico para esta familia */}
                                                <div className="hidden group-focus-within:block group-hover:block">
                                                    <ErrorTooltip message={abonoError} />
                                                </div>

                                                <Button 
                                                    onClick={() => handleAbonarDiciembreFamilia(familia)}
                                                    disabled={isAbonoDisabled}
                                                    size="sm"
                                                    variant="secondary"
                                                    className="w-full h-8 text-xs mt-1"
                                                >
                                                    <Gift className="mr-2 h-3 w-3" /> Abonar a Diciembre
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DETALLES DESPLEGABLES (HIJOS) */}
                                    {isExpanded && (
                                        <div className="bg-muted/30 p-3 border-t border-border text-sm">
                                            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Integrantes de la familia:</p>
                                            <div className="grid gap-2 md:grid-cols-2">
                                                {familia.alumnos.map(hijo => (
                                                    <div key={hijo.id} className="flex justify-between bg-card p-2 rounded border shadow-sm">
                                                        <div>
                                                            <span className="font-medium">{hijo.nombre}</span>
                                                            <span className="text-xs text-muted-foreground ml-2">({hijo.grado})</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs">Cuota: C$ {formatCurrency(hijo.precio || 0)}</div>
                                                            <div className={`text-xs font-medium ${hijo.proximoMes === 'AL DIA' ? 'text-green-600' : 'text-orange-600'}`}>
                                                                {hijo.proximoMes === 'AL DIA' ? 'Al día' : `Debe ${hijo.proximoMes}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        
                        {familias.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">No se encontraron familias con ese término.</p>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
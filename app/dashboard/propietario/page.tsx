"use client"

import { useState, useEffect, useRef } from "react"
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Users, DollarSign, Bus, UserCog, Bell, BarChart3, TrendingDown, 
    AlertTriangle, Settings, Loader2, GraduationCap, ArrowRight, Calendar as CalendarIcon,
    CheckCircle2, XCircle
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- 1. UTILIDADES Y VALIDACIONES ---

const soloLetrasRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/;

// Fechas para límites (Hora Local)
const hoy = new Date();
const year = hoy.getFullYear();
const month = String(hoy.getMonth() + 1).padStart(2, '0');
const day = String(hoy.getDate()).padStart(2, '0');
const fechaHoyStr = `${year}-${month}-${day}`;
const finAnioStr = `${year}-12-31`;

// Calculamos el último día de febrero del año actual dinámicamente
const lastDayFeb = new Date(year, 2, 0).getDate(); 

// RANGOS ESTRICTOS NICARAGUA (Para min/max en inputs y validación)
const rangos = {
    inicioClases: { min: `${year}-01-01`, max: `${year}-02-${lastDayFeb}` }, // Enero - Febrero
    vacaciones:   { min: `${year}-06-01`, max: `${year}-07-31` },            // Junio - Julio
    finClases:    { min: `${year}-11-01`, max: `${year}-12-31` }             // Noviembre - Diciembre
};

// Tipos de Errores
type FieldErrors = { [key: string]: string | undefined };

// --- COMPONENTE TOOLTIP ---
const ErrorTooltip = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
        <div className="absolute top-full left-0 mt-1 z-50 animate-in fade-in zoom-in-95 duration-200 w-full min-w-[200px]">
            <div className="absolute -top-[5px] left-4 w-3 h-3 bg-white dark:bg-slate-900 border-t border-l border-gray-200 dark:border-slate-700 transform rotate-45 shadow-sm z-10" />
            <div className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-100 text-xs px-3 py-2 rounded-md shadow-lg flex items-center gap-2">
                <div className="bg-orange-500 text-white rounded-sm p-0.5 shrink-0 flex items-center justify-center w-4 h-4">
                    <span className="font-bold text-[10px]">!</span>
                </div>
                <span className="font-medium">{message}</span>
            </div>
        </div>
    );
};

// --- COMPONENTE INPUT FECHA CON ICONO INTERACTIVO ---
const DateInput = ({ 
    value, 
    onChange, 
    min, 
    max, 
    error 
}: { 
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
    min?: string, 
    max?: string,
    error?: string
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const openPicker = () => {
        if (inputRef.current) {
            inputRef.current.showPicker(); 
        }
    };

    return (
        <div className="relative group">
            <CalendarIcon 
                className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 cursor-pointer hover:text-primary transition-colors z-10" 
                onClick={openPicker}
            />
            <Input 
                ref={inputRef}
                type="date" 
                className={`pl-8 cursor-pointer ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                value={value} 
                min={min}
                max={max}
                onChange={onChange} 
                onClick={openPicker}
            />
            <div className="hidden group-focus-within:block group-hover:block">
                <ErrorTooltip message={error} />
            </div>
        </div>
    );
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
  { title: "Generar Reportes", description: "Estadísticas y análisis", icon: BarChart3, href: "/dashboard/propietario/reportes", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20" },
]

export default function PropietarioDashboard() {
  const { toast } = useToast()
  
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [stats, setStats] = useState({
    alumnosActivos: 0,
    personal: 0,
    vehiculos: 0,
    pagosMesTotal: 0,
    mesActual: "..."
  })
  
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isPromoteOpen, setIsPromoteOpen] = useState(false)
  const [isPromoteConfirming, setIsPromoteConfirming] = useState(false) 

  // Datos Formularios
  const [motivoEmergencia, setMotivoEmergencia] = useState("")
  const [fechaSuspension, setFechaSuspension] = useState(fechaHoyStr)
  const [emergencyErrors, setEmergencyErrors] = useState<FieldErrors>({})

  const [configEscolar, setConfigEscolar] = useState({
    inicioAnioEscolar: "",
    finAnioEscolar: "",
    inicioVacacionesMedioAnio: "",
    finVacacionesMedioAnio: ""
  })
  const [configErrors, setConfigErrors] = useState<FieldErrors>({})

  // Cargar Stats
  useEffect(() => {
    const fetchStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/configuracion/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if(res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Error cargando stats:", error);
        }
    }
    fetchStats();
  }, []);

  // Cargar Configuración
  const fetchConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/configuracion`, {
          headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setConfigEscolar({
          inicioAnioEscolar: data.inicioAnioEscolar || "",
          finAnioEscolar: data.finAnioEscolar || "",
          inicioVacacionesMedioAnio: data.inicioVacacionesMedioAnio || "",
          finVacacionesMedioAnio: data.finVacacionesMedioAnio || ""
        })
      }
    } catch (error) {
      console.error("Error cargando config", error)
    }
  }

  // --- HELPERS VALIDACIÓN ---
  
  const fechaEnRango = (fecha: string, min: string, max: string) => {
      if (!fecha) return false;
      return fecha >= min && fecha <= max;
  };

  const validarAnio = (fecha: string) => {
      if (!fecha) return false;
      return parseInt(fecha.split('-')[0]) === year;
  }

  // --- ACCIONES ---

  const handleSaveConfig = async () => {
    setLoadingConfig(true)
    setConfigErrors({});

    const errors: FieldErrors = {};
    
    // 1. Inicio Clases (Estrictamente Enero - Febrero)
    if (!fechaEnRango(configEscolar.inicioAnioEscolar, rangos.inicioClases.min, rangos.inicioClases.max)) {
        errors.inicioAnioEscolar = "Debe ser entre Enero y Febrero.";
    }
    
    // 2. Fin Clases (Estrictamente Noviembre - Diciembre)
    if (!fechaEnRango(configEscolar.finAnioEscolar, rangos.finClases.min, rangos.finClases.max)) {
        errors.finAnioEscolar = "Debe ser entre Noviembre y Diciembre.";
    }

    // 3. Vacaciones (Estrictamente Junio - Julio)
    if (!fechaEnRango(configEscolar.inicioVacacionesMedioAnio, rangos.vacaciones.min, rangos.vacaciones.max)) {
        errors.inicioVacacionesMedioAnio = "Inicio debe ser Junio o Julio.";
    }
    if (!fechaEnRango(configEscolar.finVacacionesMedioAnio, rangos.vacaciones.min, rangos.vacaciones.max)) {
        errors.finVacacionesMedioAnio = "Fin debe ser Junio o Julio.";
    }

    // 4. Lógica de rangos cruzados
    if (configEscolar.inicioAnioEscolar && configEscolar.finAnioEscolar && configEscolar.inicioAnioEscolar > configEscolar.finAnioEscolar) {
        errors.finAnioEscolar = "La fecha de fin no puede ser antes del inicio.";
    }
    if (configEscolar.inicioVacacionesMedioAnio && configEscolar.finVacacionesMedioAnio && configEscolar.inicioVacacionesMedioAnio > configEscolar.finVacacionesMedioAnio) {
        errors.finVacacionesMedioAnio = "El fin de vacaciones no puede ser antes del inicio.";
    }

    if (Object.keys(errors).length > 0) {
        setConfigErrors(errors);
        setLoadingConfig(false);
        return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/configuracion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(configEscolar)
      })
      if (!res.ok) throw new Error("Error al guardar")
      toast({ title: "Configuración guardada", description: "Ciclo escolar actualizado." })
      setIsConfigOpen(false)
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" })
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleEmergencyStop = async () => {
    setEmergencyErrors({});
    
    const errors: FieldErrors = {};
    if (!motivoEmergencia.trim()) errors.motivo = "Motivo obligatorio.";
    else if (!soloLetrasRegex.test(motivoEmergencia)) errors.motivo = "Solo letras permitidas.";
    
    if (fechaSuspension < fechaHoyStr) errors.fecha = "No puedes suspender el pasado.";
    if (fechaSuspension > finAnioStr) errors.fecha = "Fecha fuera de rango.";

    if (Object.keys(errors).length > 0) {
        setEmergencyErrors(errors);
        return;
    }

    setLoadingConfig(true)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dias-no-lectivos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fecha: fechaSuspension, motivo: motivoEmergencia })
      })
      if (!res.ok) {
         if (res.status === 409) throw new Error("Ya existe suspensión para esta fecha.")
         throw new Error("Error al suspender")
      }
      toast({ title: "Día No Lectivo Registrado", description: `Se han suspendido las clases para el: ${fechaSuspension}`, variant: "destructive" })
      setIsEmergencyOpen(false)
      setMotivoEmergencia("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoadingConfig(false)
    }
  }

  // --- ACCIÓN DE PROMOCIÓN ---
  const handlePromoteStudents = async () => {
      setLoadingConfig(true);
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/alumnos/promover`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!res.ok) throw new Error("Error al ejecutar la promoción.");
          
          const data = await res.json();
          
          toast({ 
              title: "¡Ciclo Cerrado Exitosamente!", 
              description: `Se promovieron ${data.promovidos} alumnos y se graduaron ${data.graduados}.`,
              className: "bg-green-600 text-white"
          });
          
          setIsPromoteOpen(false);
          setIsPromoteConfirming(false); // Resetear estado
          
      } catch (error: any) {
          toast({ title: "Error crítico", description: error.message, variant: "destructive" });
      } finally {
          setLoadingConfig(false);
      }
  }

  const openEmergencyModal = () => {
      setFechaSuspension(fechaHoyStr);
      setMotivoEmergencia("");
      setEmergencyErrors({});
      setIsEmergencyOpen(true);
  }

  return (
    <DashboardLayout title="Panel del Propietario" menuItems={menuItems}>
      <div className="space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Suspensión */}
            <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
                <DialogTrigger asChild>
                    <Card onClick={openEmergencyModal} className="border-l-8 border-l-red-500 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-red-600 uppercase flex justify-between">
                                Emergencia <AlertTriangle className="h-5 w-5 group-hover:scale-110 transition-transform"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mt-1">Suspender Día</div>
                            <p className="text-xs text-muted-foreground mt-1">Registrar falta colectiva.</p>
                        </CardContent>
                    </Card>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Suspender Operaciones</DialogTitle>
                        <DialogDescription>No habrá cobro ni asistencia para este día.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <DateInput 
                                value={fechaSuspension}
                                min={fechaHoyStr} 
                                max={finAnioStr}  
                                onChange={(e) => {
                                    setFechaSuspension(e.target.value);
                                    setEmergencyErrors(prev => ({ ...prev, fecha: undefined }));
                                }}
                                error={emergencyErrors.fecha}
                            />
                        </div>
                        <div className="space-y-2 relative group">
                            <Label>Motivo</Label>
                            <Input 
                                placeholder="Ej: Lluvia intensa" 
                                value={motivoEmergencia} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return; 
                                    setMotivoEmergencia(val);
                                    setEmergencyErrors(prev => ({ ...prev, motivo: undefined }));
                                }} 
                            />
                            <div className="hidden group-focus-within:block group-hover:block">
                                <ErrorTooltip message={emergencyErrors.motivo} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEmergencyOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleEmergencyStop} disabled={loadingConfig || !motivoEmergencia}>
                            {loadingConfig ? <Loader2 className="h-4 w-4 animate-spin"/> : "Confirmar Suspensión"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. Configuración (RANGOS VALIDADOS) */}
            <Dialog open={isConfigOpen} onOpenChange={(open) => { setIsConfigOpen(open); if (open) fetchConfig(); }}>
                <DialogTrigger asChild>
                    <Card className="border-l-8 border-l-blue-500 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-blue-600 uppercase flex justify-between">
                                Administración <Settings className="h-5 w-5 group-hover:rotate-90 transition-transform"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mt-1">Ciclo Escolar</div>
                            <p className="text-xs text-muted-foreground mt-1">Fechas de inicio y vacaciones.</p>
                        </CardContent>
                    </Card>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>Configuración del Ciclo {year}</DialogTitle></DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Inicio Clases</Label>
                                <DateInput 
                                    value={configEscolar.inicioAnioEscolar} 
                                    // Solo Enero-Febrero
                                    min={rangos.inicioClases.min}
                                    max={rangos.inicioClases.max}
                                    onChange={(e) => {setConfigEscolar({...configEscolar, inicioAnioEscolar: e.target.value}); setConfigErrors(p=>({...p, inicioAnioEscolar: undefined}))}} 
                                    error={configErrors.inicioAnioEscolar}
                                />
                                <p className="text-[10px] text-muted-foreground">Enero o Febrero</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Fin Clases</Label>
                                <DateInput 
                                    value={configEscolar.finAnioEscolar} 
                                    // Solo Nov-Dic
                                    min={rangos.finClases.min}
                                    max={rangos.finClases.max}
                                    onChange={(e) => {setConfigEscolar({...configEscolar, finAnioEscolar: e.target.value}); setConfigErrors(p=>({...p, finAnioEscolar: undefined}))}} 
                                    error={configErrors.finAnioEscolar}
                                />
                                <p className="text-[10px] text-muted-foreground">Noviembre o Diciembre</p>
                            </div>
                        </div>
                        <div className="space-y-2 border-t pt-4"><h4 className="font-medium text-sm">Vacaciones Medio Año</h4></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Inicio</Label>
                                <DateInput 
                                    value={configEscolar.inicioVacacionesMedioAnio} 
                                    // Solo Jun-Jul
                                    min={rangos.vacaciones.min}
                                    max={rangos.vacaciones.max}
                                    onChange={(e) => {setConfigEscolar({...configEscolar, inicioVacacionesMedioAnio: e.target.value}); setConfigErrors(p=>({...p, inicioVacacionesMedioAnio: undefined}))}} 
                                    error={configErrors.inicioVacacionesMedioAnio}
                                />
                                <p className="text-[10px] text-muted-foreground">Junio o Julio</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Fin</Label>
                                <DateInput 
                                    value={configEscolar.finVacacionesMedioAnio} 
                                    // Solo Jun-Jul
                                    min={rangos.vacaciones.min}
                                    max={rangos.vacaciones.max}
                                    onChange={(e) => {setConfigEscolar({...configEscolar, finVacacionesMedioAnio: e.target.value}); setConfigErrors(p=>({...p, finVacacionesMedioAnio: undefined}))}} 
                                    error={configErrors.finVacacionesMedioAnio}
                                />
                                <p className="text-[10px] text-muted-foreground">Junio o Julio</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveConfig} disabled={loadingConfig}>{loadingConfig ? <Loader2 className="h-4 w-4 animate-spin"/> : "Guardar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 3. MANTENIMIENTO ANUAL (Ámbar) - BOTONES ARREGLADOS */}
            <Dialog open={isPromoteOpen} onOpenChange={(open) => { setIsPromoteOpen(open); setIsPromoteConfirming(false); }}>
                <DialogTrigger asChild>
                    <Card className="border-l-8 border-l-amber-500 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-amber-600 uppercase flex justify-between">
                                Fin de Año <GraduationCap className="h-6 w-6 group-hover:scale-110 transition-transform"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mt-1">Cerrar Ciclo</div>
                            <p className="text-xs text-muted-foreground mt-1">Promover alumnos de grado.</p>
                        </CardContent>
                    </Card>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-amber-600 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5"/> Fin de Ciclo Escolar
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="text-muted-foreground text-sm mt-2">
                                Acciones de mantenimiento anual para la base de datos de alumnos.
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    {!isPromoteConfirming ? (
                        <div className="py-4 space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30 text-sm text-amber-800 dark:text-amber-300">
                                <p className="font-semibold mb-2">Al ejecutar esta acción:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Alumnos de <strong>1° a 5°</strong> serán promovidos al siguiente grado.</li>
                                    <li>Alumnos de <strong>6° Grado</strong> se marcarán como <strong>Graduados</strong>.</li>
                                    <li>Los saldos pendientes se archivarán.</li>
                                </ul>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button 
                                    className="bg-amber-600 hover:bg-amber-700 text-white w-full"
                                    onClick={() => setIsPromoteConfirming(true)}
                                >
                                    Continuar <ArrowRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        // VISTA 2: Confirmación sin input, solo botones
                        <div className="py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center space-y-3">
                                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">¿Estás absolutamente seguro?</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 px-4">
                                    Esta acción modificará masivamente los grados de todos los estudiantes activos. No se puede deshacer fácilmente.
                                </p>
                            </div>
                            
                            {/* BOTONES BIEN DISTRIBUIDOS */}
                            <div className="flex justify-center gap-4 pt-2 px-4">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsPromoteConfirming(false)}
                                    disabled={loadingConfig}
                                    className="min-w-[120px]" // Ancho mínimo para que no se aplaste
                                >
                                    <XCircle className="mr-2 h-4 w-4"/> Cancelar
                                </Button>
                                <Button 
                                    variant="destructive"
                                    onClick={handlePromoteStudents}
                                    disabled={loadingConfig}
                                    className="min-w-[160px]" // Ancho mínimo
                                >
                                    {loadingConfig ? <Loader2 className="h-4 w-4 animate-spin"/> : <><CheckCircle2 className="mr-2 h-4 w-4"/> Confirmar Todo</>}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>

        {/* RESUMEN OPERATIVO */}
        <h3 className="text-lg font-semibold text-muted-foreground pt-4">Resumen Operativo</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardDescription className="text-xs font-medium">Alumnos Activos</CardDescription>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.alumnosActivos}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total registrados</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardDescription className="text-xs font-medium">Pagos ({stats.mesActual})</CardDescription>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">C$ {stats.pagosMesTotal.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Recaudado este mes</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardDescription className="text-xs font-medium">Personal</CardDescription>
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.personal}</div>
                    <p className="text-xs text-muted-foreground mt-1">Choferes y Asistentes</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardDescription className="text-xs font-medium">Vehículos</CardDescription>
                    <Bus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.vehiculos}</div>
                    <p className="text-xs text-muted-foreground mt-1">En flota activa</p>
                </CardContent>
            </Card>
        </div>

      </div>
    </DashboardLayout>
  )
}
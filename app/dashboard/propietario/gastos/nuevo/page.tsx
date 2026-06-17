"use client";

import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation";
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; 
import { ArrowLeft, Save, Users, DollarSign, Bus, UserCog, Bell, BarChart3, TrendingDown, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

// --- 1. LÓGICA DE FECHAS (HORA LOCAL) ---

// Obtener fecha de HOY (Máximo)
const hoy = new Date();
const yHoy = hoy.getFullYear();
const mHoy = String(hoy.getMonth() + 1).padStart(2, '0');
const dHoy = String(hoy.getDate()).padStart(2, '0');
const fechaHoyStr = `${yHoy}-${mHoy}-${dHoy}`; // YYYY-MM-DD

// Obtener fecha de hace 15 DÍAS (Mínimo)
const hace15 = new Date();
hace15.setDate(hoy.getDate() - 15);
const y15 = hace15.getFullYear();
const m15 = String(hace15.getMonth() + 1).padStart(2, '0');
const d15 = String(hace15.getDate()).padStart(2, '0');
const fechaMinStr = `${y15}-${m15}-${d15}`; // YYYY-MM-DD

// --- 2. REGLAS DE VALIDACIÓN (ZOD) ---

const soloLetrasRegex = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s]+$/; // Alfanumérico básico (Letras, números, espacios)

const gastoSchema = z.object({
    descripcion: z.string()
        .min(5, "Descripción muy corta (mín 5 caracteres).")
        .max(40, "Descripción muy larga (máx 40 caracteres).")
        .regex(soloLetrasRegex, "Solo letras y números (sin símbolos).")
        .refine((val) => !/(.)\1\1/.test(val), {
            message: "No repetir letras más de 2 veces.",
        }),
    categoria: z.string().min(1, "Selecciona una categoría."),
    monto: z.coerce.number()
        .gt(0, "El monto debe ser mayor a 0.")
        .lte(30000, "Monto excede el límite (30,000 C$)."), 
    fecha: z.string()
        .refine((val) => val >= fechaMinStr, {
            message: "No se permiten gastos de más de 15 días de antigüedad.",
        })
        .refine((val) => val <= fechaHoyStr, {
            message: "No se permiten fechas futuras.",
        }),
    vehiculoId: z.string().optional(),
    personalId: z.string().optional(),
});

// Tipos
type Vehiculo = { id: string; nombre: string; };
type Personal = { id: string; nombre: string; salario: number; };
type FieldErrors = { [key: string]: string | undefined; };

// --- COMPONENTE TOOLTIP DE ERROR ---
const ErrorTooltip = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
        <div className="absolute top-full left-0 mt-1 z-20 animate-in fade-in zoom-in-95 duration-200 w-full">
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
];

const formatCurrency = (num: number) => {
    return (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NuevoGastoPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    const [personal, setPersonal] = useState<Personal[]>([]); 
    const [dataLoading, setDataLoading] = useState(true);

    // Estados de error
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const [formData, setFormData] = useState({
        descripcion: "",
        categoria: "",
        vehiculoId: "N/A", 
        personalId: "N/A", 
        monto: "",
        fecha: fechaHoyStr, // Por defecto: HOY
    });

    useEffect(() => {
        const fetchData = async () => {
            setDataLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) throw new Error("Sesión no válida.");

                const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

                const [vehiculosRes, personalRes] = await Promise.all([
                    fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos?estado=activo`, { headers }),
                    fetch(`${process.env.NEXT_PUBLIC_API_URL}/personal?estado=activo`, { headers })
                ]);
                
                const handleRes = async (res: Response) => {
                    if (res.ok) return await res.json();
                    return [];
                };

                setVehiculos(await handleRes(vehiculosRes));
                setPersonal(await handleRes(personalRes));

            } catch (err: any) {
                console.error("Error dependencias:", err.message);
            } finally {
                setDataLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        // Limpiar error al escribir
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        // Limpiar error al seleccionar
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));

        if (name === "categoria" && value === "salarios") {
            setFormData(prev => ({ 
                ...prev, categoria: value, descripcion: "Pago de salario", vehiculoId: "N/A", monto: "", personalId: "N/A", 
            }));
        } else if (name === "personalId" && formData.categoria === "salarios") {
            const empleado = personal.find(p => p.id === value);
            if (empleado) {
                setFormData(prev => ({
                    ...prev, personalId: value, monto: (empleado.salario || 0).toString(), descripcion: `Pago de salario ${empleado.nombre}`
                }));
            } else {
                setFormData(prev => ({ ...prev, personalId: value, monto: "", descripcion: "Pago de salario" }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFieldErrors({}); // Limpiar errores previos

        const esSalario = formData.categoria === 'salarios';
        const esSalarioManual = esSalario && formData.personalId === "N/A";

        try {
            // 1. VALIDACIÓN ZOD
            const result = gastoSchema.safeParse(formData);

            if (!result.success) {
                const newErrors: FieldErrors = {};
                result.error.errors.forEach(err => {
                    if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
                });
                
                // Validaciones lógicas manuales adicionales
                if (esSalario && !formData.personalId && !esSalarioManual) {
                    newErrors.personalId = "Selecciona un empleado.";
                }

                setFieldErrors(newErrors);
                setLoading(false);
                return; // Detener si hay errores
            }

            // Validaciones lógicas extra (si pasaron Zod pero fallan lógica de negocio específica)
            if (esSalario && !formData.personalId && !esSalarioManual) {
                setFieldErrors(prev => ({ ...prev, personalId: "Selecciona un empleado." }));
                setLoading(false);
                return;
            }

            const valid = result.data;

            const payload = {
                descripcion: valid.descripcion.trim(),
                categoria: valid.categoria,
                monto: valid.monto,
                fecha: valid.fecha,
                vehiculoId: formData.vehiculoId === "N/A" ? null : formData.vehiculoId, 
                personalId: formData.personalId === "N/A" ? null : formData.personalId,
            };

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gastos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || "Error al registrar gasto.");
            }

            toast({ title: "✅ Gasto Registrado", description: "El gasto se ha guardado correctamente.", className: "bg-green-600 text-white" });
            
            setTimeout(() => { router.push("/dashboard/propietario/gastos"); }, 1000);

        } catch (err: any) {
            console.error(err);
            toast({ title: "Error del Sistema", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const esSalario = formData.categoria === 'salarios';
    const empleadoSeleccionado = personal.find(p => p.id === formData.personalId);
    const esSalarioManual = esSalario && formData.personalId === "N/A";
    
    if (dataLoading) {
         return (
            <DashboardLayout title="Registrar Gasto" menuItems={menuItems}>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Registrar Gasto" menuItems={menuItems}>
            <div className="space-y-6">
                <Link href="/dashboard/propietario/gastos">
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Volver a la lista</Button>
                </Link>

                <Card>
                    <CardHeader>
                        <CardTitle>Registrar Nuevo Gasto</CardTitle>
                        <CardDescription>Completa los detalles del gasto operativo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4 pb-8">
                            
                            {/* DESCRIPCIÓN */}
                            <div className="space-y-2 relative group">
                                <Label htmlFor="descripcion">Descripción *</Label>
                                <Textarea 
                                    id="descripcion" 
                                    name="descripcion"
                                    placeholder="Ej: Llenado de tanque" 
                                    value={formData.descripcion} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s.]*$/.test(val)) return; // Whitelist
                                        if (/(.)\1\1/.test(val)) return; // Anti-repetición
                                        
                                        setFormData({ ...formData, descripcion: val });
                                        setFieldErrors(prev => ({ ...prev, descripcion: undefined }));
                                    }} 
                                    required 
                                    maxLength={40}
                                    disabled={esSalario && empleadoSeleccionado && !esSalarioManual}
                                />
                                <p className="text-[10px] text-muted-foreground">Máx 40 caracteres. Solo letras y números.</p>
                                {/* Tooltip solo visible al hacer hover o focus */}
                                <div className="hidden group-focus-within:block group-hover:block">
                                    <ErrorTooltip message={fieldErrors.descripcion} />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2 relative group">
                                    <Label htmlFor="categoria">Categoría *</Label>
                                    <Select 
                                        value={formData.categoria} 
                                        onValueChange={(value) => handleSelectChange("categoria", value)}
                                        required disabled={loading}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="combustible">Combustible</SelectItem>
                                            <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                                            <SelectItem value="salarios">Salarios</SelectItem>
                                            <SelectItem value="otros">Otros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.categoria} />
                                    </div>
                                </div>
                                
                                <div className="space-y-2 relative group">
                                    <Label htmlFor="vehiculoId">Asignar Vehículo</Label>
                                    <Select 
                                        value={formData.vehiculoId} 
                                        onValueChange={(value) => handleSelectChange("vehiculoId", value)} 
                                        disabled={esSalario || loading}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Asignar a un vehículo" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="N/A">N/A (Gasto General)</SelectItem>
                                            {vehiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.vehiculoId} />
                                    </div>
                                </div>
                            </div>

                            {esSalario && (
                                <div className="space-y-2 md:col-span-2 relative group">
                                    <Label htmlFor="personalId">Asignar Empleado *</Label>
                                    <Select 
                                        value={formData.personalId} 
                                        onValueChange={(value) => handleSelectChange("personalId", value)}
                                        disabled={loading}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Selecciona un empleado" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="N/A">N/A (Registrar salario manual)</SelectItem>
                                            {personal.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.nombre} (Salario: C${formatCurrency(p.salario || 0)})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.personalId} />
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* MONTO */}
                                <div className="space-y-2 relative group">
                                    <Label htmlFor="monto">Monto (C$) *</Label>
                                    <Input 
                                        id="monto" 
                                        name="monto" 
                                        type="number" 
                                        step="0.01"
                                        placeholder="Ej: 1500.00"
                                        value={formData.monto} 
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (val < 0) return; // Bloqueo visual negativos
                                            if (val > 30000) return;
                                            setFormData({ ...formData, monto: e.target.value });
                                            setFieldErrors(prev => ({ ...prev, monto: undefined }));
                                        }} 
                                        required 
                                        disabled={(esSalario && empleadoSeleccionado && !esSalarioManual) || loading}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Máximo C$30,000.</p>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.monto} />
                                    </div>
                                </div>

                                {/* FECHA con Icono */}
                                <div className="space-y-2 relative group">
                                    <Label htmlFor="fecha">Fecha del Gasto *</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input 
                                            id="fecha" 
                                            name="fecha" 
                                            type="date" 
                                            className="pl-8" // Espacio para el icono
                                            value={formData.fecha} 
                                            min={fechaMinStr}   
                                            max={fechaHoyStr}    
                                            onChange={handleChange} 
                                            required 
                                            disabled={loading}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Permitido: {fechaMinStr} al {fechaHoyStr} (Hoy).
                                    </p>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.fecha} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                    Guardar Gasto
                                </Button>
                                <Link href="/dashboard/propietario/gastos">
                                    <Button type="button" variant="outline" disabled={loading}>Cancelar</Button>
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
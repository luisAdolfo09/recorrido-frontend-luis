"use client";

import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation";
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Trash2, Plus, Users, DollarSign, Bus, UserCog, Bell, BarChart3, TrendingDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { z } from "zod"; 

// --- 1. DEFINICIÓN DE REGLAS DE NEGOCIO (ZOD) ---
const nombreRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/;
const direccionRegex = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s]+$/;
const telefonoNicaRegex = /^[578][0-9]{7}$/; 

const alumnoSchema = z.object({
    nombre: z.string()
        .min(3, "El nombre es muy corto (mín 3 letras).")
        .max(60, "El nombre es muy largo.")
        .regex(nombreRegex, "Solo letras y espacios.")
        .refine((val) => !/(.)\1\1/.test(val), "No repetir letras más de 2 veces.")
        .refine((val) => /^[A-ZÁÉÍÓÚÑ]/.test(val), "Debe ingresar el nombre correctamente."),
    grado: z.string().min(1, "Debes seleccionar un grado."),
    vehiculoId: z.string().min(1, "Debes asignar un vehículo."),
});

const formularioSchema = z.object({
    ...alumnoSchema.shape,
    tutorNombre: z.string()
        .min(5, "Nombre muy corto.")
        .max(60, "Nombre muy largo.")
        .regex(nombreRegex, "Solo letras y espacios.")
        .refine((val) => !/(.)\1\1/.test(val), "No repetir letras excesivamente.")
        .refine((val) => /^[A-ZÁÉÍÓÚÑ]/.test(val), "Debe ingresar el nombre correctamente."),
    tutorTelefono: z.string()
        .regex(telefonoNicaRegex, "Teléfono inválido (8 dígitos, inicia 5, 7 u 8)."),
    direccion: z.string()
        .min(10, "Dirección muy corta (mín 10 carac).")
        .regex(direccionRegex, "Solo letras y números."),
    precio: z.coerce.number()
        .gte(700, "El valor debe ser mayor o igual que 700.") 
        .max(50000, "Precio excede el límite."),
});

const hermanoSchema = z.object({
    nombre: z.string()
        .min(3, "Nombre muy corto.")
        .regex(nombreRegex, "Solo letras.")
        .refine((val) => !/(.)\1\1/.test(val), "No repetir letras.")
        .refine((val) => /^[A-ZÁÉÍÓÚÑ]/.test(val), "Debe iniciar con mayúscula."),
    grado: z.string().min(1, "Selecciona el grado."),
    vehiculoId: z.string().min(1, "Selecciona el vehículo."),
});

// Tipos para manejo de errores
type FieldErrors = {
    [key: string]: string | undefined;
};

// --- COMPONENTE TOOLTIP DE ERROR ---
const ErrorTooltip = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
        // z-20 para que no tape el menú lateral (que suele ser z-40/50)
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
    { title: "Gestionar Alumnos", description: "Ver y administrar estudiantes", icon: Users, href: "/dashboard/propietario/alumnos", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20", },
    { title: "Gestionar Pagos", description: "Ver historial y registrar pagos", icon: DollarSign, href: "/dashboard/propietario/pagos", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20", },
    { title: "Gestionar Gastos", description: "Control de combustible, salarios, etc.", icon: TrendingDown, href: "/dashboard/propietario/gastos", color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-900/20", },
    { title: "Gestionar Personal", description: "Administrar empleados y choferes", icon: Users, href: "/dashboard/propietario/personal", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-900/20", },
    { title: "Gestionar Vehículos", description: "Administrar flota de vehículos", icon: Bus, href: "/dashboard/propietario/vehiculos", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-900/20", },
    { title: "Gestionar Usuarios", description: "Administrar accesos al sistema", icon: UserCog, href: "/dashboard/propietario/usuarios", color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-900/20", },
    { title: "Enviar Avisos", description: "Comunicados a tutores y personal", icon: Bell, href: "/dashboard/propietario/avisos", color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/20", },
    { title: "Generar Reportes", description: "Estadísticas y análisis", icon: BarChart3, href: "/dashboard/propietario/reportes", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20", },
];

type Vehiculo = { id: string; nombre: string; };

export default function NuevoAlumnoPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    
    // Estados de error
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [brotherErrors, setBrotherErrors] = useState<FieldErrors[]>([]);

    const [formData, setFormData] = useState({
        nombre: "", tutorNombre: "", tutorTelefono: "", grado: "", direccion: "", vehiculoId: "", 
        precio: "700", 
        hermanos: false,
    });
    const [otrosHijos, setOtrosHijos] = useState<{ nombre: string; grado: string; vehiculoId: string }[]>([]);

    useEffect(() => {
        const fetchVehiculos = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) return; 
                const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos?estado=activo`, { headers });
                if (response.ok) { const data = await response.json(); setVehiculos(data); }
            } catch (err) { console.error("Error vehículos", err); }
        };
        fetchVehiculos();
    }, []);

    const calcularPrecios = (total: number, cant: number) => {
        const base = Math.floor(total / cant);
        const resto = total % cant;
        const p = Array(cant).fill(base);
        p[0] += resto; return p;
    };

    // Helper Title Case
    const toTitleCase = (str: string) => {
        return str.replace(/(^|\s)[a-zñáéíóú]/g, (c) => c.toUpperCase());
    };

    // Helper para limpiar errores al escribir
    const clearError = (field: string) => {
        setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFieldErrors({});
        setBrotherErrors([]);

        try {
            // 1. VALIDACIÓN FORMULARIO PRINCIPAL
            const result = formularioSchema.safeParse(formData);
            
            let isValid = true;
            let mainData = null;

            if (!result.success) {
                const newErrors: FieldErrors = {};
                result.error.errors.forEach(err => {
                    if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
                });
                setFieldErrors(newErrors);
                isValid = false;
            } else {
                mainData = result.data;
            }

            // 2. VALIDACIÓN HERMANOS
            if (formData.hermanos) {
                if (otrosHijos.length === 0) {
                    toast({ title: "Error", description: "Marcaste hermanos pero la lista está vacía.", variant: "destructive" });
                    setLoading(false);
                    return;
                }

                const newBrotherErrors: FieldErrors[] = [];
                let brothersValid = true;

                otrosHijos.forEach((h) => {
                    const res = hermanoSchema.safeParse(h);
                    if (!res.success) {
                        const errors: FieldErrors = {};
                        res.error.errors.forEach(err => {
                            if (err.path[0]) errors[err.path[0].toString()] = err.message;
                        });
                        newBrotherErrors.push(errors);
                        brothersValid = false;
                    } else {
                        newBrotherErrors.push({});
                    }
                });

                if (!brothersValid) {
                    setBrotherErrors(newBrotherErrors);
                    isValid = false;
                }
            }

            if (!isValid) {
                setLoading(false);
                return; // Detenemos el envío sin toast global, ya se muestran los tooltips
            }

            // Si todo es válido, procedemos
            const lista = [{ nombre: mainData!.nombre, grado: mainData!.grado, vehiculoId: mainData!.vehiculoId }, ...otrosHijos];
            const precios = calcularPrecios(mainData!.precio, lista.length);
            
            const { data: { session } } = await supabase.auth.getSession();
            const headers = { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };

            for (const [i, al] of lista.entries()) {
                const payload = {
                    nombre: al.nombre.trim(), grado: al.grado, 
                    tutor: { nombre: mainData!.tutorNombre.trim(), telefono: mainData!.tutorTelefono.trim() },
                    direccion: mainData!.direccion.trim(), vehiculoId: al.vehiculoId, precio: precios[i], activo: true
                };
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/alumnos`, { method: 'POST', headers, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error(`Falló registro de ${al.nombre}`);
            }

            toast({ title: "¡Éxito!", description: "Familia registrada correctamente.", className: "bg-green-600 text-white" });
            router.push("/dashboard/propietario/alumnos");

        } catch (err: any) {
            toast({ title: "Error del Sistema", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
    };

    return (
        <DashboardLayout title="Registrar Alumno" menuItems={menuItems}>
            <div className="space-y-6">
                <Link href="/dashboard/propietario/alumnos"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Button></Link>
                <Card>
                    <CardHeader><CardTitle>Ingreso de Nuevo Alumno</CardTitle><CardDescription>Registra estudiante y familia.</CardDescription></CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4 pb-8"> 
                            
                            <div className="grid gap-4 md:grid-cols-2">
                                
                                {/* Nombre Alumno */}
                                <div className="space-y-2 relative group">
                                    <Label className={fieldErrors.nombre ? "text-red-500" : ""}>Nombre Alumno *</Label>
                                    <Input 
                                        value={formData.nombre} 
                                        placeholder="Ej: Juan Pablo"
                                        className={fieldErrors.nombre ? "border-red-500 focus-visible:ring-red-500" : ""}
                                        onChange={(e) => { 
                                            const val = e.target.value;
                                            if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                                            if (/(.)\1\1/.test(val)) return;
                                            setFormData({...formData, nombre: toTitleCase(val)}); 
                                            clearError("nombre");
                                        }} 
                                    />
                                    {/* Tooltip solo visible al hacer hover o focus */}
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.nombre} />
                                    </div>
                                </div>

                                {/* Grado */}
                                <div className="space-y-2 relative group">
                                    <Label className={fieldErrors.grado ? "text-red-500" : ""}>Grado *</Label>
                                    <Select value={formData.grado} onValueChange={(v) => {
                                        setFormData({...formData, grado: v});
                                        clearError("grado");
                                    }}>
                                        <SelectTrigger className={fieldErrors.grado ? "border-red-500" : ""}><SelectValue placeholder="Grado"/></SelectTrigger>
                                        <SelectContent>{["1° Preescolar","2° Preescolar","3° Preescolar","1° Primaria","2° Primaria","3° Primaria","4° Primaria","5° Primaria","6° Primaria"].map(g=><SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.grado} />
                                    </div>
                                </div>

                                {/* Tutor Nombre */}
                                <div className="space-y-2 relative group">
                                    <Label className={fieldErrors.tutorNombre ? "text-red-500" : ""}>Nombre Tutor *</Label>
                                    <Input 
                                        value={formData.tutorNombre} 
                                        placeholder="Ej: Ricardo Leandro Martin Perez"
                                        className={fieldErrors.tutorNombre ? "border-red-500 focus-visible:ring-red-500" : ""}
                                        onChange={(e) => { 
                                            const val = e.target.value;
                                            if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                                            if (/(.)\1\1/.test(val)) return;
                                            setFormData({...formData, tutorNombre: toTitleCase(val)}); 
                                            clearError("tutorNombre");
                                        }} 
                                    />
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.tutorNombre} />
                                    </div>
                                </div>
                                
                                {/* Teléfono Tutor */}
                                <div className="space-y-2 relative group">
                                    <Label className={fieldErrors.tutorTelefono ? "text-red-500" : ""}>Teléfono Tutor *</Label>
                                    <Input 
                                        type="tel" 
                                        maxLength={8} 
                                        value={formData.tutorTelefono} 
                                        placeholder="Ej: 88888888"
                                        className={fieldErrors.tutorTelefono ? "border-red-500 focus-visible:ring-red-500" : ""}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.length === 1 && !['5','7','8'].includes(val)) return;
                                            setFormData({...formData, tutorTelefono: val});
                                            clearError("tutorTelefono");
                                        }} 
                                    />
                                    <p className="text-[10px] text-muted-foreground">8 dígitos. Debe iniciar con 5, 7 u 8.</p>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.tutorTelefono} />
                                    </div>
                                </div>

                                {/* Dirección */}
                                <div className="space-y-2 md:col-span-2 relative group">
                                    <Label className={fieldErrors.direccion ? "text-red-500" : ""}>Dirección *</Label>
                                    <Input 
                                        value={formData.direccion} 
                                        placeholder="Direccion detallada..."
                                        className={fieldErrors.direccion ? "border-red-500 focus-visible:ring-red-500" : ""}
                                        onChange={(e) => { 
                                            if (/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s]*$/.test(e.target.value)) {
                                                setFormData({...formData, direccion: e.target.value});
                                                clearError("direccion");
                                            }
                                        }} 
                                    />
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.direccion} />
                                    </div>
                                </div>

                                {/* Vehículo */}
                                <div className="space-y-2 relative group">
                                    <Label className={fieldErrors.vehiculoId ? "text-red-500" : ""}>Vehículo *</Label>
                                    <Select value={formData.vehiculoId} onValueChange={(v) => {
                                        setFormData({...formData, vehiculoId: v});
                                        clearError("vehiculoId");
                                    }}>
                                        <SelectTrigger className={fieldErrors.vehiculoId ? "border-red-500" : ""}><SelectValue placeholder="Vehículo"/></SelectTrigger>
                                        <SelectContent>{vehiculos.map(v=><SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.vehiculoId} />
                                    </div>
                                </div>

                                {/* Precio */}
                                <div className="space-y-2 relative group">
                                    <Label className={fieldErrors.precio ? "text-red-500" : "text-green-600 font-bold"}>Precio Familiar (C$) *</Label>
                                    <Input 
                                        type="number" 
                                        value={formData.precio} 
                                        placeholder="Mínimo 700"
                                        min={700} 
                                        className={`border-green-200 focus:ring-green-500 ${fieldErrors.precio ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val !== "" && Number(val) < 0) return; 
                                            setFormData({...formData, precio: val});
                                            clearError("precio");
                                        }} 
                                    />
                                    <p className="text-[10px] text-muted-foreground">Debe ser mayor o igual a 700.</p>
                                    <div className="hidden group-focus-within:block group-hover:block">
                                        <ErrorTooltip message={fieldErrors.precio} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t">
                                <Checkbox checked={formData.hermanos} onCheckedChange={(c)=>{ setFormData({...formData, hermanos: c===true}); setOtrosHijos(c ? [{nombre:"", grado:"", vehiculoId:""}] : []); setBrotherErrors([]); }} id="h"/>
                                <Label htmlFor="h" className="cursor-pointer font-medium">¿Tiene hermanos?</Label>
                            </div>

                            {/* Sección Hermanos */}
                            {formData.hermanos && (
                                <div className="space-y-4 mt-4 border-t pt-4">
                                    {otrosHijos.map((h, i) => (
                                        <div key={i} className="grid gap-4 md:grid-cols-3 items-start border-b pb-4 relative">
                                            <div className="space-y-2 relative group">
                                                <Label className={brotherErrors[i]?.nombre ? "text-red-500" : ""}>Hermano {i+1}</Label>
                                                <Input 
                                                    value={h.nombre} 
                                                    className={brotherErrors[i]?.nombre ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    onChange={(e)=>{ 
                                                        const val = e.target.value;
                                                        if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                                                        if (/(.)\1\1/.test(val)) return;

                                                        const n=[...otrosHijos]; 
                                                        n[i].nombre = toTitleCase(val); 
                                                        setOtrosHijos(n);
                                                        
                                                        if (brotherErrors[i]?.nombre) {
                                                            const newErrs = [...brotherErrors];
                                                            newErrs[i] = { ...newErrs[i], nombre: undefined };
                                                            setBrotherErrors(newErrs);
                                                        }
                                                    }}
                                                />
                                                <div className="hidden group-focus-within:block group-hover:block">
                                                    <ErrorTooltip message={brotherErrors[i]?.nombre} />
                                                </div>
                                            </div>
                                            <div className="space-y-2 relative group">
                                                <Label className={brotherErrors[i]?.grado ? "text-red-500" : ""}>Grado</Label>
                                                <Select value={h.grado} onValueChange={(v)=>{
                                                    const n=[...otrosHijos]; n[i].grado=v; setOtrosHijos(n);
                                                    if (brotherErrors[i]?.grado) {
                                                        const newErrs = [...brotherErrors];
                                                        newErrs[i] = { ...newErrs[i], grado: undefined };
                                                        setBrotherErrors(newErrs);
                                                    }
                                                }}>
                                                    <SelectTrigger className={brotherErrors[i]?.grado ? "border-red-500" : ""}><SelectValue placeholder="Grado"/></SelectTrigger>
                                                    <SelectContent>{["1° Preescolar","2° Preescolar","3° Preescolar","1° Primaria","2° Primaria","3° Primaria","4° Primaria","5° Primaria","6° Primaria"].map(g=><SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <div className="hidden group-focus-within:block group-hover:block">
                                                    <ErrorTooltip message={brotherErrors[i]?.grado} />
                                                </div>
                                            </div>
                                            <div className="space-y-2 flex gap-2 items-start relative group">
                                                <div className="flex-1 space-y-2">
                                                    <Label className={brotherErrors[i]?.vehiculoId ? "text-red-500" : ""}>Vehículo</Label>
                                                    <Select value={h.vehiculoId} onValueChange={(v)=>{
                                                        const n=[...otrosHijos]; n[i].vehiculoId=v; setOtrosHijos(n);
                                                        if (brotherErrors[i]?.vehiculoId) {
                                                            const newErrs = [...brotherErrors];
                                                            newErrs[i] = { ...newErrs[i], vehiculoId: undefined };
                                                            setBrotherErrors(newErrs);
                                                        }
                                                    }}>
                                                        <SelectTrigger className={brotherErrors[i]?.vehiculoId ? "border-red-500" : ""}><SelectValue placeholder="Vehículo"/></SelectTrigger>
                                                        <SelectContent>{vehiculos.map(v=><SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <div className="hidden group-focus-within:block group-hover:block">
                                                        <ErrorTooltip message={brotherErrors[i]?.vehiculoId} />
                                                    </div>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="text-red-500 mt-8" onClick={()=>{
                                                    const n=[...otrosHijos]; n.splice(i,1); setOtrosHijos(n);
                                                    const e=[...brotherErrors]; e.splice(i,1); setBrotherErrors(e);
                                                }}><Trash2 className="h-5 w-5"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={()=>setOtrosHijos([...otrosHijos, {nombre:"", grado:"", vehiculoId:""}])}><Plus className="mr-2 h-4 w-4"/> Otro hermano</Button>
                                </div>
                            )}

                            <Button type="submit" disabled={loading} className="w-full md:w-auto">{loading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>} Registrar Familia</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
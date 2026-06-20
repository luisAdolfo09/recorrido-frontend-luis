"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, DollarSign, Bus, UserCog, Bell, BarChart3, TrendingDown, ArrowLeft, Save, Loader2, UserCheck, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Separator } from "@/components/ui/separator"
import { z } from "zod"

// --- 1. REGLAS DE NEGOCIO Y SEGURIDAD ---

const nombreRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/;
const direccionRegex = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s]+$/;
const telefonoNicaRegex = /^[578][0-9]{7}$/; 

// Esquema para validar al Tutor
const tutorSchema = z.object({
    nombre: z.string()
        .min(5, "El nombre del tutor es muy corto.")
        .max(60, "El nombre del tutor es muy largo.")
        .regex(nombreRegex, "El nombre solo debe contener letras.")
        .refine((val) => !/(.)\1\1/.test(val), "No repetir letras excesivamente (máx 2 veces).")
        .refine((val) => /^[A-ZÁÉÍÓÚÑ]/.test(val), "El nombre debe iniciar con mayúscula."),
    telefono: z.string()
        .regex(telefonoNicaRegex, "Teléfono inválido (8 dígitos, inicia con 5, 7 u 8)."),
    direccion: z.string()
        .min(10, "Dirección muy corta.")
        .regex(direccionRegex, "La dirección solo acepta letras y números.")
        .refine((val) => !/(.)\1\1/.test(val), "No repetir caracteres excesivamente en la dirección."),
});

// Esquema para validar cada Alumno
const alumnoSchema = z.object({
    nombre: z.string()
        .min(3, "Nombre de alumno muy corto.")
        .regex(nombreRegex, "Nombre de alumno solo letras.")
        .refine((val) => !/(.)\1\1/.test(val), "No repetir letras excesivamente (máx 2 veces).")
        .refine((val) => /^[A-ZÁÉÍÓÚÑ]/.test(val), "Nombre de alumno debe iniciar con mayúscula."),
    grado: z.string().min(1, "Selecciona un grado."),
    vehiculoId: z.string().min(1, "Selecciona un vehículo."),
});

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

type Vehiculo = { id: string; nombre: string };

export default function EditarFamiliaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    
    const [tutorData, setTutorData] = useState({
        nombre: "",
        telefono: "",
        direccion: "" 
    });
    const [tutorId, setTutorId] = useState<string | null>(null);

    const [hijos, setHijos] = useState<any[]>([]);
    const [precioFamiliarTotal, setPrecioFamiliarTotal] = useState(0);

    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) throw new Error("Sesión inválida");

                const headers = { 'Authorization': `Bearer ${token}` };
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

                const resVehiculos = await fetch(`${apiUrl}/vehiculos?estado=activo`, { headers });
                if (resVehiculos.ok) setVehiculos(await resVehiculos.json());

                const resAlumno = await fetch(`${apiUrl}/alumnos/${id}`, { headers });
                if (!resAlumno.ok) throw new Error("Alumno no encontrado");
                const alumnoPrincipal = await resAlumno.json();

                const tId = alumnoPrincipal.tutorUserId;
                setTutorId(tId);

                setTutorData({
                    nombre: alumnoPrincipal.tutorUser?.nombre || alumnoPrincipal.tutor || "",
                    telefono: alumnoPrincipal.tutorUser?.telefono || alumnoPrincipal.contacto || "",
                    direccion: alumnoPrincipal.direccion || ""
                });

                let todosLosHijos = [alumnoPrincipal];
                if (tId) {
                    const resTodos = await fetch(`${apiUrl}/alumnos`, { headers });
                    if (resTodos.ok) {
                        const listaCompleta = await resTodos.json();
                        todosLosHijos = listaCompleta.filter((a: any) => a.tutorUserId === tId);
                    }
                }

                const hijosFormateados = todosLosHijos.map((h: any) => ({
                    id: h.id,
                    nombre: h.nombre,
                    grado: h.grado,
                    vehiculoId: h.vehiculo?.id || h.vehiculoId || "",
                    precio: Number(h.precio),
                    activo: h.activo
                }));

                setHijos(hijosFormateados);
                const total = hijosFormateados.reduce((sum: number, h: any) => sum + h.precio, 0);
                setPrecioFamiliarTotal(total);

            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                router.push("/dashboard/propietario/alumnos");
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [id, toast, router]);

    const handleChangeHijo = (index: number, field: string, value: any) => {
        const nuevos = [...hijos];
        nuevos[index] = { ...nuevos[index], [field]: value };
        setHijos(nuevos);
    };

    const agregarHermano = () => {
        setHijos([...hijos, { nombre: "", grado: "", vehiculoId: "", precio: 0, activo: true }]);
    };

    const eliminarHijo = async (index: number) => {
        const hijo = hijos[index];
        if (hijo.id) {
            if (!confirm(`¿Estás seguro de eliminar a ${hijo.nombre}? Esto borrará su historial.`)) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/alumnos/${hijo.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                });
                toast({ title: "Alumno eliminado" });
            } catch (e) {
                console.error(e);
                return; 
            }
        }
        const nuevos = [...hijos];
        nuevos.splice(index, 1);
        setHijos(nuevos);
        const total = nuevos.reduce((sum: number, h: any) => sum + Number(h.precio), 0);
        setPrecioFamiliarTotal(total);
    };

    const redistribuirPrecio = (nuevoTotal: number) => {
        setPrecioFamiliarTotal(nuevoTotal);
        const count = hijos.length;
        if (count === 0) return;
        
        const base = Math.floor(nuevoTotal / count);
        const resto = nuevoTotal % count;

        const nuevosHijos = hijos.map((h, i) => ({
            ...h,
            // Redondeamos a 2 decimales para no arrastrar ruido de punto flotante
            // (ej. 1000.7 % 3 = 1.6999999…) al precio que se muestra y se persiste.
            precio: i === 0 ? Number((base + resto).toFixed(2)) : base
        }));
        setHijos(nuevosHijos);
    };

    // Helper Title Case
    const toTitleCase = (str: string) => {
        return str.replace(/(^|\s)[a-zñáéíóú]/g, (c) => c.toUpperCase());
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // --- 1. VALIDACIÓN ZOD ---
            
            // Validar Tutor
            const tutorValidado = tutorSchema.parse(tutorData);

            // Validar Precio Total
            if (precioFamiliarTotal < 700) {
                throw new Error("El precio mensual familiar debe ser al menos 700 C$.");
            }

            // Validar Cada Hijo
            for (const [index, hijo] of hijos.entries()) {
                try {
                    alumnoSchema.parse(hijo);
                } catch (err: any) {
                    if (err instanceof z.ZodError) {
                        throw new Error(`Error en Estudiante ${index + 1} (${hijo.nombre || 'Nuevo'}): ${err.errors[0].message}`);
                    }
                    throw err;
                }
            }

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            if (tutorId) {
                await fetch(`${apiUrl}/users/${tutorId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        nombre: tutorValidado.nombre,
                        telefono: tutorValidado.telefono
                    })
                });
            }

            for (const hijo of hijos) {
                const payload = {
                    nombre: hijo.nombre.trim(),
                    grado: hijo.grado,
                    vehiculoId: hijo.vehiculoId,
                    precio: hijo.precio,
                    direccion: tutorValidado.direccion.trim(),
                    activo: hijo.activo,
                    tutor: tutorId ? undefined : tutorValidado.nombre,
                    contacto: tutorId ? undefined : tutorValidado.telefono,
                    ...( !hijo.id && { tutorUserId: tutorId }) 
                };

                if (hijo.id) {
                    await fetch(`${apiUrl}/alumnos/${hijo.id}`, {
                        method: 'PATCH', headers, body: JSON.stringify(payload)
                    });
                } else {
                    const createPayload = {
                        ...payload,
                        tutor: { nombre: tutorValidado.nombre, telefono: tutorValidado.telefono }
                    };
                    await fetch(`${apiUrl}/alumnos`, {
                        method: 'POST', headers, body: JSON.stringify(createPayload)
                    });
                }
            }
            
            toast({ title: "Familia Actualizada", description: "Todos los cambios se han guardado.", className: "bg-green-600 text-white" });
            router.push("/dashboard/propietario/alumnos");

        } catch (error: any) {
            const mensaje = error instanceof z.ZodError ? error.errors[0].message : error.message;
            toast({ title: "Error de Validación", description: mensaje, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-screen justify-center items-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <DashboardLayout title="Editar Familia" menuItems={menuItems}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex justify-between items-center">
                    <Link href="/dashboard/propietario/alumnos">
                        <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-1 rounded-full border">
                        <UserCheck className="w-4 h-4" /> Editando Grupo Familiar
                    </div>
                </div>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Información Familiar</CardTitle>
                        <CardDescription>Modifica los datos del responsable y gestiona a todos los estudiantes del grupo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-8">
                            
                            <div className="p-6 rounded-lg border bg-card/50">
                                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-4 tracking-wider">Datos del Tutor (Responsable)</h3>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Nombre del Tutor</Label>
                                        <Input 
                                            value={tutorData.nombre} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                                                if (/(.)\1\1/.test(val)) return; // Anti-repeat visual
                                                setTutorData({...tutorData, nombre: toTitleCase(val)});
                                            }}
                                            placeholder="Nombre completo"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono (Contacto)</Label>
                                        <Input 
                                            value={tutorData.telefono} 
                                            maxLength={8}
                                            onChange={(e) => {
                                                let val = e.target.value.replace(/\D/g, '');
                                                if (val.length === 1 && !['5','7','8'].includes(val)) return;
                                                setTutorData({...tutorData, telefono: val});
                                            }}
                                            placeholder="Ej: 88888888"
                                        />
                                        <p className="text-[10px] text-muted-foreground">8 dígitos (5, 7, 8).</p>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Dirección de Recogida</Label>
                                        <Input 
                                            value={tutorData.direccion} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                                                if (/(.)\1\1/.test(val)) return; // Anti-repeat visual para dirección
                                                setTutorData({...tutorData, direccion: val})
                                            }}
                                            placeholder="Dirección exacta"
                                        />
                                        <p className="text-xs text-muted-foreground">Esta dirección se aplicará a todos los hijos.</p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider">Estudiantes ({hijos.length})</h3>
                                    <div className="w-48">
                                        <Label className="text-xs mb-1 block text-right font-medium text-green-600 dark:text-green-400">Mensualidad Familiar (C$)</Label>
                                        <Input 
                                            type="number" 
                                            min={700}
                                            value={precioFamiliarTotal}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (e.target.value !== "" && val < 0) return;
                                                redistribuirPrecio(val);
                                            }}
                                            className="text-right font-bold text-lg border-green-200 dark:border-green-900/30"
                                        />
                                    </div>
                                </div>

                                {hijos.map((hijo, index) => (
                                    <div key={index} className="grid gap-4 md:grid-cols-12 items-end p-4 border rounded-lg shadow-sm relative bg-card">
                                            <div className="md:col-span-4 space-y-2">
                                                <Label>Nombre</Label>
                                                <Input 
                                                    value={hijo.nombre} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                                                        if (/(.)\1\1/.test(val)) return; // Anti-repeat visual
                                                        handleChangeHijo(index, "nombre", toTitleCase(val));
                                                    }} 
                                                    placeholder="Nombre del alumno"
                                                />
                                            </div>
                                            <div className="md:col-span-3 space-y-2">
                                                <Label>Grado</Label>
                                                <Select value={hijo.grado} onValueChange={(val) => handleChangeHijo(index, "grado", val)}>
                                                    <SelectTrigger><SelectValue placeholder="Grado" /></SelectTrigger>
                                                    <SelectContent>
                                                        {["1° Preescolar", "2° Preescolar", "3° Preescolar", "1° Primaria", "2° Primaria", "3° Primaria", "4° Primaria", "5° Primaria", "6° Primaria"].map(g => (
                                                            <SelectItem key={g} value={g}>{g}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-3 space-y-2">
                                                <Label>Vehículo</Label>
                                                <Select value={hijo.vehiculoId || "N/A"} onValueChange={(val) => handleChangeHijo(index, "vehiculoId", val)}>
                                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                                    <SelectContent>
                                                        {vehiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 flex gap-2 items-end">
                                                <div className="space-y-2 flex-1">
                                                    <Label className="text-xs text-muted-foreground">Cuota</Label>
                                                    <div className="h-10 flex items-center px-3 bg-muted rounded-md border text-sm text-muted-foreground">
                                                        C$ {Number(hijo.precio || 0).toFixed(2)}
                                                    </div>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 mb-0.5"
                                                    onClick={() => eliminarHijo(index)}
                                                    title="Eliminar estudiante"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                    </div>
                                ))}

                                <Button type="button" variant="outline" onClick={agregarHermano} className="w-full border-dashed py-6 text-muted-foreground hover:text-primary hover:border-primary">
                                    <Plus className="h-4 w-4 mr-2" /> Agregar otro hermano a este grupo
                                </Button>
                            </div>

                            <div className="flex justify-end pt-6 border-t">
                                <Button type="submit" disabled={saving} className="min-w-[200px]">
                                    {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Guardar Cambios
                                </Button>
                            </div>

                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
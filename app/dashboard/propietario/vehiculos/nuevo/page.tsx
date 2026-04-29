"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    ArrowLeft, 
    Save, 
    Users, 
    DollarSign, 
    Bus, 
    UserCog, 
    Bell, 
    BarChart3, 
    TrendingDown,
    Loader2,
    Upload,
    Image as ImageIcon,
    X
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

// --- 1. REGLAS DE NEGOCIO Y SEGURIDAD ---

// Regex básicos
const soloLetrasRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/;
const modeloRegex = /^[a-zA-Z0-9\s-]+$/; 

// PLACA: Empieza con M, el primer dígito es 1-9 (no 0), seguido de 5 dígitos cualesquiera.
const placaRegex = /^M[1-9][0-9]{5}$/; 

// Fechas para validación de año
const currentYear = new Date().getFullYear();
const maxYear = currentYear + 1;

const vehiculoSchema = z.object({
    nombre: z.string()
        .min(3, "El nombre es muy corto.")
        .max(40, "El nombre es muy largo.")
        .regex(soloLetrasRegex, "El nombre solo debe contener letras.")
        .refine((val) => !/(.)\1\1/.test(val), "No puedes repetir la misma letra más de 2 veces seguidas."),
    marca: z.string()
        .min(3, "La marca es muy corta.")
        .regex(soloLetrasRegex, "La marca solo debe contener letras.")
        .refine((val) => !/(.)\1\1/.test(val), "No repitas letras excesivamente."),
    placa: z.string()
        .regex(placaRegex, "La placa debe ser 'M' seguida de 6 números y NO puede iniciar con 0."),
    modelo: z.string()
        .min(2, "El modelo es muy corto.")
        .regex(modeloRegex, "El modelo solo acepta letras, números y un guion.")
        .refine((val) => (val.match(/-/g) || []).length <= 1, "Solo se permite un guion '-' en el modelo.")
        .refine((val) => (val.match(/\d/g) || []).length <= 4, "El modelo no puede tener más de 4 números.")
        .refine((val) => !/(.)\1\1/.test(val), "No repitas caracteres más de 2 veces seguidas."),
    anio: z.coerce.number()
        .min(1990, "El año no puede ser menor a 1990.")
        .max(maxYear, `El año no puede ser mayor a ${maxYear}.`),
    capacidad: z.coerce.number()
        .min(10, "La capacidad mínima de un microbús es de 10 pasajeros.")
        .max(60, "La capacidad máxima permitida es 60."),
    estado: z.string().optional(),
    fotoUrl: z.string().optional(),
});

// Tipos para errores
type FieldErrors = {
    [key: string]: string | undefined;
};

// --- COMPONENTE TOOLTIP DE ERROR ---
const ErrorTooltip = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
        <div className="absolute top-full left-0 mt-1 z-20 animate-in fade-in zoom-in-95 duration-200 w-full">
            {/* Triangulito */}
            <div className="absolute -top-[5px] left-4 w-3 h-3 bg-white border-t border-l border-gray-200 transform rotate-45 shadow-sm z-10" />
            {/* Caja del mensaje */}
            <div className="relative bg-white border border-gray-200 text-gray-800 text-xs px-3 py-2 rounded-md shadow-lg flex items-center gap-2">
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

export default function NuevoVehiculoPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState("");
  
  // Estado de Errores
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [formData, setFormData] = useState({
    nombre: "",
    placa: "M", 
    marca: "",
    modelo: "",
    anio: "",
    capacidad: "10", 
    estado: "activo" 
  });

  // Helper para limpiar errores al escribir
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFieldErrors(prev => ({ ...prev, [name]: undefined })); // Limpiar error del campo
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Formatos de imagen aceptados
  const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  const ACCEPTED_LABEL = 'JPG, PNG, WEBP o HEIC';
  const MAX_SIZE_MB = 5;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    try {
      if (!input.files || input.files.length === 0) return;

      setUploading(true);
      const file = input.files[0];

      // Validar tipo de archivo
      if (!ACCEPTED_TYPES.includes(file.type)) {
        throw new Error(`Formato no permitido. Solo se aceptan: ${ACCEPTED_LABEL}.`);
      }

      // Validar tamaño
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`La imagen no puede superar los ${MAX_SIZE_MB}MB.`);
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vehiculos')
        .upload(fileName, file, { upsert: false });

      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes('bucket not found')) {
          throw new Error(
            'El almacenamiento de imágenes no está configurado. Contacta al administrador para crear el bucket "vehiculos" en Supabase Storage.'
          );
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from('vehiculos').getPublicUrl(fileName);
      setFotoUrl(data.publicUrl);
      toast({ title: "Imagen cargada", description: "La foto se subió correctamente." });

    } catch (error: any) {
      console.error("Error subiendo imagen:", error);
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      input.value = ''; // Permite reseleccionar el mismo archivo
    }
  };

  const handleRemoveImage = () => {
    setFotoUrl("");
  };

  // --- Enviar Vehículo ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({}); // Limpiar errores previos

    try {
      // 1. VALIDACIÓN ZOD
      const datosParaValidar = {
          ...formData,
          placa: formData.placa.replace(/\s/g, ''), 
          anio: Number(formData.anio),
          capacidad: Number(formData.capacidad),
          fotoUrl: fotoUrl
      };

      // Usamos safeParse para obtener todos los errores sin lanzar excepción
      const result = vehiculoSchema.safeParse(datosParaValidar);

      if (!result.success) {
          const newErrors: FieldErrors = {};
          result.error.errors.forEach(err => {
              if (err.path[0]) {
                  newErrors[err.path[0].toString()] = err.message;
              }
          });
          setFieldErrors(newErrors);
          setLoading(false);
          return; // Detenemos el envío si hay errores
      }

      const valid = result.data;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const token = session.access_token;

      const payload = {
        nombre: valid.nombre.trim(),
        placa: valid.placa, 
        marca: valid.marca.trim(),
        modelo: valid.modelo.trim(),
        anio: valid.anio,
        capacidad: valid.capacidad,
        estado: valid.estado,
        fotoUrl: valid.fotoUrl || null,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      toast({ title: "¡Vehículo Registrado!", description: "El vehículo se ha guardado correctamente.", className: "bg-green-600 text-white" });
      router.push("/dashboard/propietario/vehiculos");
      router.refresh();

    } catch (err: any) {
      console.error("Error completo:", err);
      toast({ title: "Error del Sistema", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Registrar Vehículo" menuItems={menuItems}>
      <div className="space-y-6">
        <Link href="/dashboard/propietario/vehiculos">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Volver a la lista</Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Registrar Nuevo Vehículo</CardTitle>
            <CardDescription>Completa los detalles de la unidad de transporte.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6 pb-8">
              
              {/* FOTO */}
              <div className="space-y-2">
                  <Label>Fotografía de la Unidad</Label>
                  <div className="flex items-start gap-6 border p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20">
                      <div className="relative h-32 w-48 bg-white dark:bg-gray-800 rounded-md border flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                          {uploading ? (
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          ) : fotoUrl ? (
                              <>
                                <img src={fotoUrl} alt="Vista previa" className="h-full w-full object-cover" />
                                <button type="button" onClick={handleRemoveImage} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600" title="Eliminar foto">
                                    <X className="h-3 w-3" />
                                </button>
                              </>
                          ) : (
                              <div className="text-center p-2">
                                  <ImageIcon className="h-8 w-8 text-gray-300 mx-auto mb-1" />
                                  <span className="text-xs text-gray-400">Sin imagen</span>
                              </div>
                          )}
                      </div>
                      <div className="flex-1 space-y-2">
                          <p className="text-sm text-muted-foreground">Sube una foto clara del vehículo.</p>
                          <Label htmlFor="foto-upload" className="cursor-pointer inline-flex">
                              <div className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                                  <Upload className="h-4 w-4" /> {fotoUrl ? "Cambiar Foto" : "Subir Foto"}
                              </div>
                              <Input
                                id="foto-upload"
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                                className="hidden"
                                onChange={handleImageUpload}
                                disabled={uploading || loading}
                              />
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Formatos aceptados: <span className="font-medium">JPG, PNG, WEBP, HEIC</span> · Máx. 5 MB
                          </p>
                      </div>
                  </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* NOMBRE (Auto Capitalize) */}
                <div className="space-y-2 relative group">
                  <Label htmlFor="nombre">Nombre o Apodo *</Label>
                  <Input 
                    id="nombre" 
                    name="nombre"
                    placeholder="Ej: Microbús 01" 
                    value={formData.nombre} 
                    onChange={(e) => {
                        const val = e.target.value;
                        if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                        if (/(.)\1\1/.test(val)) return;
                        const valFormatted = val.replace(/(^|\s)[a-zñáéíóú]/g, (c) => c.toUpperCase());
                        setFormData({ ...formData, nombre: valFormatted });
                        handleChange(e); // Limpia error
                    }} 
                    required disabled={loading}
                  />
                  <p className="text-[10px] text-muted-foreground">Solo letras. Primera mayúscula.</p>
                  {/* Tooltip */}
                  <div className="hidden group-focus-within:block group-hover:block">
                      <ErrorTooltip message={fieldErrors.nombre} />
                  </div>
                </div>

                {/* PLACA (M + 6 Dígitos, sin iniciar en 0) */}
                <div className="space-y-2 relative group">
                  <Label htmlFor="placa">Placa *</Label>
                   <Input 
                    id="placa" 
                    name="placa"
                    placeholder="M 123 456" 
                    value={formData.placa} 
                    maxLength={7} // M + 6 dígitos
                    onChange={(e) => {
                        let val = e.target.value.toUpperCase();
                        
                        if (!val.startsWith("M")) {
                            val = "M" + val.replace(/[^0-9]/g, "");
                        } else {
                            val = "M" + val.substring(1).replace(/[^0-9]/g, "");
                        }

                        if (val.length > 1 && val[1] === '0') {
                            val = val.slice(0, 1) + val.slice(2);
                        }
                        
                        setFormData({ ...formData, placa: val });
                        handleChange(e);
                    }} 
                    required disabled={loading}
                  />
                  <p className="text-[10px] text-muted-foreground">Formato: M seguido de 6 dígitos (No puede iniciar con 0).</p>
                  <div className="hidden group-focus-within:block group-hover:block">
                      <ErrorTooltip message={fieldErrors.placa} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                 {/* MARCA */}
                 <div className="space-y-2 relative group">
                  <Label htmlFor="marca">Marca</Label>
                  <Input 
                    id="marca" 
                    name="marca"
                    placeholder="Ej: Toyota" 
                    value={formData.marca} 
                    onChange={(e) => {
                        const val = e.target.value;
                        if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]*$/.test(val)) return;
                        if (/(.)\1\1/.test(val)) return;
                        const valFormatted = val.replace(/(^|\s)[a-zñáéíóú]/g, (c) => c.toUpperCase());
                        setFormData({ ...formData, marca: valFormatted });
                        handleChange(e);
                    }} 
                    disabled={loading}
                  />
                   <div className="hidden group-focus-within:block group-hover:block">
                      <ErrorTooltip message={fieldErrors.marca} />
                  </div>
                </div>

                {/* MODELO */}
                <div className="space-y-2 relative group">
                  <Label htmlFor="modelo">Modelo</Label>
                  <Input 
                    id="modelo" 
                    name="modelo" 
                    placeholder="Ej: Hiace-2024" 
                    value={formData.modelo} 
                    onChange={(e) => {
                        const val = e.target.value;
                        if (!/^[a-zA-Z0-9\s-]*$/.test(val)) return;
                        
                        if ((val.match(/-/g) || []).length > 1) return; 
                        if ((val.match(/\d/g) || []).length > 4) return; 
                        if (/(.)\1\1/.test(val)) return; 

                        setFormData({ ...formData, modelo: val });
                        handleChange(e);
                    }} 
                    disabled={loading}
                  />
                  <p className="text-[10px] text-muted-foreground">Letras, números (máx 4) y un guion.</p>
                   <div className="hidden group-focus-within:block group-hover:block">
                      <ErrorTooltip message={fieldErrors.modelo} />
                  </div>
                </div>
              </div>

               <div className="grid gap-4 md:grid-cols-2">
                {/* AÑO - SIN TRIANGULITOS */}
                <div className="space-y-2 relative group">
                  <Label htmlFor="anio">Año</Label>
                  <Input 
                    id="anio" 
                    name="anio" 
                    type="number" 
                    placeholder={`1990 - ${maxYear}`}
                    value={formData.anio} 
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length > 4) return;
                        setFormData({ ...formData, anio: val });
                        handleChange(e);
                    }} 
                    disabled={loading}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                   <div className="hidden group-focus-within:block group-hover:block">
                      <ErrorTooltip message={fieldErrors.anio} />
                  </div>
                </div>

                {/* CAPACIDAD - MIN 10 */}
                <div className="space-y-2 relative group">
                  <Label htmlFor="capacidad">Capacidad (Asientos)</Label>
                  <Input 
                    id="capacidad" 
                    name="capacidad" 
                    type="number" 
                    placeholder="10 - 60"
                    min={10} // BLOQUEA bajada con flechas
                    max={60}
                    value={formData.capacidad} 
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length > 2) return; 
                        setFormData({ ...formData, capacidad: val });
                        handleChange(e);
                    }} 
                    disabled={loading}
                  />
                  <p className="text-[10px] text-muted-foreground">Mínimo 10 asientos.</p>
                   <div className="hidden group-focus-within:block group-hover:block">
                      <ErrorTooltip message={fieldErrors.capacidad} />
                  </div>
                </div>
              </div>

              {/* Campo estado oculto */}
              <input type="hidden" name="estado" value={formData.estado} />

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading || uploading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {loading ? "Guardando..." : "Guardar Vehículo"}
                </Button>
                <Link href="/dashboard/propietario/vehiculos">
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
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
    X,
    AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase"; 
import { z } from "zod";

// --- 1. REGLAS DE NEGOCIO Y SEGURIDAD (Idénticas a Nuevo Vehículo) ---

const soloLetrasRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/;
const modeloRegex = /^[a-zA-Z0-9\s-]+$/; 
const placaRegex = /^M[1-9][0-9]{5}$/; // Placa M, primer dígito 1-9, luego 5 dígitos.

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

// --- Menú ---
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

export default function EditarVehiculoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // Estado separado para el guardado
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombre: "",
    placa: "",
    marca: "",
    modelo: "",
    anio: "",
    capacidad: "",
    estado: "activo"
  });

  // Cargar datos del vehículo
  useEffect(() => {
    const fetchVehiculo = async () => {
      if (!id) {
        setError("ID no válido");
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("No hay sesión activa");
          return;
        }

        const token = session.access_token;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Vehículo no encontrado");
          }
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        
        setFormData({
          nombre: data.nombre || "",
          placa: data.placa || "",
          marca: data.marca || "",
          modelo: data.modelo || "",
          anio: data.anio?.toString() || "",
          capacidad: data.capacidad?.toString() || "10",
          estado: data.estado || "activo"
        });
        
        if (data.fotoUrl) setFotoUrl(data.fotoUrl);

      } catch (err: any) {
        console.error("Error cargando vehículo:", err);
        setError(err.message);
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchVehiculo();
  }, [id, toast]);

  // Formatos de imagen aceptados
  const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  const ACCEPTED_LABEL = 'JPG, PNG, WEBP o HEIC';
  const MAX_SIZE_MB = 5;

  // Subida de Imagen
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
        // Error específico cuando el bucket no existe
        if (uploadError.message?.toLowerCase().includes('bucket not found')) {
          throw new Error(
            'El almacenamiento de imágenes no está configurado. Contacta al administrador para crear el bucket "vehiculos" en Supabase Storage.'
          );
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from('vehiculos').getPublicUrl(fileName);
      setFotoUrl(data.publicUrl);
      toast({ title: "Imagen actualizada", description: "Recuerda guardar los cambios." });

    } catch (error: any) {
      console.error("Error subiendo imagen:", error);
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      // Limpiar el input para permitir volver a seleccionar el mismo archivo
      input.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFotoUrl("");
  };

  // Guardar Cambios
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 1. VALIDACIÓN ZOD
      const datosParaValidar = {
          ...formData,
          placa: formData.placa.replace(/\s/g, ''), 
          anio: Number(formData.anio),
          capacidad: Number(formData.capacidad),
          fotoUrl: fotoUrl
      };

      const valid = vehiculoSchema.parse(datosParaValidar);

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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehiculos/${id}`, {
        method: 'PATCH',
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

      toast({ title: "¡Vehículo Actualizado!", description: "Los cambios se guardaron correctamente.", className: "bg-green-600 text-white" });
      router.push("/dashboard/propietario/vehiculos");
      router.refresh();

    } catch (err: any) {
      console.error("Error guardando:", err);
      const mensaje = err instanceof z.ZodError ? err.errors[0].message : err.message;
      toast({ title: "Error de Validación", description: mensaje, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Editar Vehículo" menuItems={menuItems}>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-3 text-muted-foreground">Cargando vehículo...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Editar Vehículo" menuItems={menuItems}>
        <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 rounded-lg border border-red-100">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-red-700 mb-2">Error al cargar vehículo</h3>
          <p className="text-muted-foreground max-w-md">{error}</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard/propietario/vehiculos")}>
            Volver a la lista
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Editar Vehículo" menuItems={menuItems}>
      <div className="space-y-6">
        <Link href="/dashboard/propietario/vehiculos">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Volver a la lista</Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Editar Vehículo</CardTitle>
            <CardDescription>Modifica los detalles o la foto de la unidad.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
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
                                <button type="button" onClick={handleRemoveImage} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600" title="Quitar foto">
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
                          <p className="text-sm text-muted-foreground">Cambia la foto si la unidad ha sido renovada o pintada.</p>
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
                                disabled={uploading || saving}
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
                <div className="space-y-2">
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
                    }} 
                    required disabled={saving}
                  />
                  <p className="text-[10px] text-muted-foreground">Solo letras. Primera mayúscula.</p>
                </div>

                {/* PLACA (Validación estricta) */}
                <div className="space-y-2">
                  <Label htmlFor="placa">Placa *</Label>
                   <Input 
                    id="placa" 
                    name="placa"
                    placeholder="M 123 456" 
                    value={formData.placa} 
                    maxLength={7} 
                    onChange={(e) => {
                        let val = e.target.value.toUpperCase();
                        if (!val.startsWith("M")) {
                            val = "M" + val.replace(/[^0-9]/g, "");
                        } else {
                            val = "M" + val.substring(1).replace(/[^0-9]/g, "");
                        }
                        // Bloqueo visual de 0 inicial
                        if (val.length > 1 && val[1] === '0') {
                            val = val.slice(0, 1) + val.slice(2);
                        }
                        setFormData({ ...formData, placa: val });
                    }} 
                    required disabled={saving}
                  />
                  <p className="text-[10px] text-muted-foreground">Formato: M seguido de 6 dígitos (No 0 inicial).</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                 {/* MARCA */}
                 <div className="space-y-2">
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
                    }} 
                    disabled={saving}
                  />
                </div>

                {/* MODELO */}
                <div className="space-y-2">
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
                    }} 
                    disabled={saving}
                  />
                  <p className="text-[10px] text-muted-foreground">Letras, números (máx 4) y un guion.</p>
                </div>
              </div>

               <div className="grid gap-4 md:grid-cols-2">
                {/* AÑO - SIN TRIANGULITOS */}
                <div className="space-y-2">
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
                    }} 
                    disabled={saving}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* CAPACIDAD - MIN 10 */}
                <div className="space-y-2">
                  <Label htmlFor="capacidad">Capacidad (Asientos)</Label>
                  <Input 
                    id="capacidad" 
                    name="capacidad" 
                    type="number" 
                    placeholder="10 - 60"
                    min={10} // BLOQUEO VISUAL
                    max={60}
                    value={formData.capacidad} 
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val.length > 2) return; 
                        setFormData({ ...formData, capacidad: val });
                    }} 
                    disabled={saving}
                  />
                  <p className="text-[10px] text-muted-foreground">Mínimo 10 asientos.</p>
                </div>
              </div>

              <input type="hidden" name="estado" value={formData.estado} />

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving || uploading}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </Button>
                <Link href="/dashboard/propietario/vehiculos">
                    <Button type="button" variant="outline" disabled={saving}>Cancelar</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
    Users, 
    DollarSign, 
    Bus, 
    UserCog, 
    Bell, 
    BarChart3, 
    TrendingDown,
    Eye,
    EyeOff,
    Filter,
    AlertTriangle,
    Loader2
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

// --- TIPOS ---
type Vehiculo = {
  id: string;
  nombre: string;
  capacidad?: number;
};

type AlumnoFromAPI = {
  id: string;
  nombre: string;
  tutor: any; 
  tutorUser?: {
    nombre: string;
    telefono: string;
    email?: string;
  };
  contacto?: string;
  grado: string;
  direccion: string;
  activo: boolean;
  precio?: number;
  vehiculoId: string | null; 
  vehiculo?: Vehiculo; 
};

type AlumnoNormalizado = {
  id: string;
  nombre: string;
  tutor: {
    nombre: string;
    telefono: string;
  };
  grado: string;
  direccion: string;
  activo: boolean;
  precio?: number;
  vehiculoId: string | null; 
  vehiculo?: Vehiculo; 
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

// --- NORMALIZACIÓN ---
const normalizarAlumno = (alumno: AlumnoFromAPI): AlumnoNormalizado => {
  let tutorNombre = "N/A";
  let tutorTelefono = "N/A";

  if (alumno.tutorUser) {
    tutorNombre = alumno.tutorUser.nombre;
    tutorTelefono = alumno.tutorUser.telefono;
  } 
  else if (alumno.tutor && typeof alumno.tutor === 'object') {
    tutorNombre = alumno.tutor.nombre || "N/A";
    tutorTelefono = alumno.tutor.telefono || "N/A";
  }
  else if (typeof alumno.tutor === 'string') {
    tutorNombre = alumno.tutor;
  }

  if (tutorTelefono === "N/A" && alumno.contacto) {
    tutorTelefono = alumno.contacto;
  }

  return {
    ...alumno,
    tutor: {
      nombre: tutorNombre,
      telefono: tutorTelefono
    }
  };
};

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<AlumnoNormalizado[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]) 
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedVehiculo, setSelectedVehiculo] = useState("todos") 
  const [estadoFilter, setEstadoFilter] = useState("activo"); 
  const [sortOption, setSortOption] = useState("grado-asc"); 

  // --- OBTENER DATOS ---
  const fetchDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

      const [alumnosRes, vehiculosRes] = await Promise.all([
        fetch(`${apiUrl}/alumnos?estado=${estadoFilter}`, { headers }), 
        fetch(`${apiUrl}/vehiculos?estado=activo`, { headers })
      ]);

      if (!alumnosRes.ok) {
        if (alumnosRes.status === 404 || alumnosRes.status === 204) {
          setAlumnos([]);
        } else {
          const errorData = await alumnosRes.json().catch(() => ({}));
          throw new Error(errorData.message || `Error del servidor (${alumnosRes.status})`);
        }
      } else {
        const alumnosData: AlumnoFromAPI[] = await alumnosRes.json();
        const alumnosNormalizados = alumnosData.map(normalizarAlumno);
        setAlumnos(alumnosNormalizados);
      }
      
      if (!vehiculosRes.ok) {
        if (vehiculosRes.status === 404 || vehiculosRes.status === 204) {
          setVehiculos([]);
        } else {
          console.error("Error cargando vehículos");
          setVehiculos([]);
        }
      } else {
        const vehiculosData: Vehiculo[] = await vehiculosRes.json();
        setVehiculos(vehiculosData);
      }

    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error al cargar datos",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDatos();
  }, [toast, estadoFilter]); 

  // --- LÓGICA DE FILTRADO Y ORDEN ---
  const filteredAlumnos = useMemo(() => { 
    const gradoToNumber = (grado: string) => {
      const parts = grado.split(' ');
      if (parts.length < 2) return 99;
      const numero = parseInt(parts[0], 10) || 0;
      const nivel = parts[1].toLowerCase();
      
      if (nivel.startsWith('preescolar')) return numero;
      if (nivel.startsWith('primaria')) return numero + 3;
      return 99;
    };

    let alumnosFiltrados = [...alumnos];

    if (selectedVehiculo !== "todos") {
      alumnosFiltrados = alumnosFiltrados.filter(a => a.vehiculoId === selectedVehiculo);
    }
    
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      alumnosFiltrados = alumnosFiltrados.filter(
        (alumno) =>
          alumno.nombre.toLowerCase().includes(lowerTerm) ||
          alumno.tutor.nombre.toLowerCase().includes(lowerTerm) ||
          alumno.tutor.telefono.toLowerCase().includes(lowerTerm) ||
          (alumno.direccion && alumno.direccion.toLowerCase().includes(lowerTerm))
      );
    }

    switch (sortOption) {
      case 'grado-asc':
        alumnosFiltrados.sort((a, b) => gradoToNumber(a.grado) - gradoToNumber(b.grado));
        break;
      case 'grado-desc':
        alumnosFiltrados.sort((a, b) => gradoToNumber(b.grado) - gradoToNumber(a.grado));
        break;
      case 'nombre-asc':
        alumnosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case 'nombre-desc':
        alumnosFiltrados.sort((a, b) => b.nombre.localeCompare(a.nombre));
        break;
      case 'tutor-asc':
        alumnosFiltrados.sort((a, b) => a.tutor.nombre.localeCompare(b.tutor.nombre));
        break;
      case 'tutor-desc':
        alumnosFiltrados.sort((a, b) => b.tutor.nombre.localeCompare(a.tutor.nombre));
        break;
      case 'precio-asc':
        alumnosFiltrados.sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0));
        break;
      case 'precio-desc':
        alumnosFiltrados.sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0));
        break;
      default:
        alumnosFiltrados.sort((a, b) => gradoToNumber(a.grado) - gradoToNumber(b.grado));
    }
    
    return alumnosFiltrados;
  }, [alumnos, searchTerm, selectedVehiculo, sortOption]); 

  // --- CÁLCULOS DE RESUMEN ---
  const cardInfo = useMemo(() => {
    const totalAlumnos = filteredAlumnos.length;
    let totalCapacidad = 0;
    let descripcionCapacidad = "Capacidad Total (Activos)";
    
    // Cálculo de ingresos
    const totalIngresos = filteredAlumnos.reduce((sum, alumno) => sum + (alumno.precio || 0), 0);

    if (selectedVehiculo === 'todos') {
      totalCapacidad = vehiculos.reduce((sum, v) => sum + (v.capacidad || 0), 0);
    } else {
      const vehiculo = vehiculos.find(v => v.id === selectedVehiculo);
      totalCapacidad = vehiculo?.capacidad || 0;
      descripcionCapacidad = `Capacidad en ${vehiculo?.nombre || 'Vehículo'}`;
    }
    
    return { totalAlumnos, totalCapacidad, descripcionCapacidad, totalIngresos };
  }, [selectedVehiculo, filteredAlumnos, vehiculos, estadoFilter]);

  // --- ACCIONES ---
  const cambiarEstadoAlumno = async (id: string, nuevoEstado: "activo" | "inactivo") => {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;

    const confirmMessage = nuevoEstado === 'inactivo' 
      ? `¿Estás seguro de DESACTIVAR a ${alumno.nombre}? (Se moverá a 'Inactivos')` 
      : `¿Estás seguro de REACTIVAR a ${alumno.nombre}? (Se moverá a 'Activos')`;
      
    if (!window.confirm(confirmMessage)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/alumnos/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ activo: nuevoEstado === 'activo' }), 
      });

      if (!response.ok) throw new Error("No se pudo actualizar el estado");
      
      setAlumnos(prev => prev.filter(a => a.id !== id)); 

      toast({
        title: "Estado actualizado",
        description: `Alumno ${nuevoEstado} correctamente.`,
      });

    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const handleDelete = async (id: string) => {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;

    if (window.confirm(`¿Estás SEGURO de ELIMINAR PERMANENTEMENTE a ${alumno.nombre}?`)) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        
        const response = await fetch(`${apiUrl}/alumnos/${id}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) throw new Error("No se pudo eliminar.");

        setAlumnos(prev => prev.filter((a) => a.id !== id));
        toast({ title: "Alumno Eliminado" });

      } catch (err: any) {
        toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Gestión de Alumnos" menuItems={menuItems}>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Cargando alumnos...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error && alumnos.length === 0) {
    return (
      <DashboardLayout title="Gestión de Alumnos" menuItems={menuItems}>
        <div className="flex flex-col justify-center items-center h-64 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Error al cargar datos</h3>
          <p className="text-muted-foreground max-w-md">{error}</p>
          <Button className="mt-4" onClick={fetchDatos}>
            Intentar de nuevo
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestión de Alumnos" menuItems={menuItems}>
      <div className="space-y-6">
        
        {/* --- TARJETAS DE RESUMEN --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tarjeta 1: Total Alumnos */}
          <Card className="card-accent card-rise">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">
                Total Alumnos ({estadoFilter === 'activo' ? 'Activos' : 'Inactivos'})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cardInfo.totalAlumnos}</div>
            </CardContent>
          </Card>

          {/* Tarjeta 2: Capacidad */}
          <Card className="card-accent card-rise">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{cardInfo.descripcionCapacidad}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{cardInfo.totalCapacidad}</div>
            </CardContent>
          </Card>

          {/* Tarjeta 3: Ingresos Mensuales Estimados (NUEVA) */}
          <Card className="card-accent card-rise">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">
                Ingreso Mensual Estimado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">C${formatCurrency(cardInfo.totalIngresos)}</div>
            </CardContent>
          </Card>
        </div>

        {/* --- CONTROLES DE BÚSQUEDA Y ACCIÓN --- */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alumno, tutor, contacto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
            <Select onValueChange={setSelectedVehiculo} defaultValue="todos">
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por vehículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Vehículos</SelectItem>
                {vehiculos.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setEstadoFilter} value={estadoFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activos</SelectItem>
                <SelectItem value="inactivo">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={setSortOption} defaultValue="grado-asc">
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grado-asc">Grado (Asc)</SelectItem>
                <SelectItem value="nombre-asc">Nombre (A-Z)</SelectItem>
                <SelectItem value="tutor-asc">Tutor (A-Z)</SelectItem>
                <SelectItem value="precio-asc">Precio (Asc)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end w-full sm:w-auto">
            <Link href="/dashboard/propietario/alumnos/nuevo" className="w-full sm:w-auto">
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Alumno
              </Button>
            </Link>
          </div>
        </div>

        {/* --- TABLA --- */}
        {alumnos.length === 0 ? (
          <Card className="mt-6 border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle>¡Comencemos a trabajar!</CardTitle>
              <CardDescription>
                No tienes alumnos registrados con el filtro "{estadoFilter}".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/propietario/alumnos/nuevo">
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Registrar Alumno
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Contacto Tutor</TableHead>
                      <TableHead>Grado</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlumnos.map((alumno) => (
                      <TableRow key={alumno.id}>
                        <TableCell className="font-medium whitespace-nowrap">{alumno.nombre}</TableCell>
                        <TableCell className="whitespace-nowrap">{alumno.tutor.nombre}</TableCell>
                        <TableCell className="whitespace-nowrap">
                            {alumno.tutor.telefono !== "N/A" ? (
                                <span>{alumno.tutor.telefono}</span>
                            ) : (
                                <span className="text-gray-400 italic">N/A</span>
                            )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{alumno.grado}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">{alumno.vehiculo?.nombre || "Sin asignar"}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">C${formatCurrency(alumno.precio ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/propietario/alumnos/${alumno.id}`}>
                              <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => cambiarEstadoAlumno(alumno.id, alumno.activo ? "inactivo" : "activo")}>
                                {alumno.activo ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(alumno.id)}>
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
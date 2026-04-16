"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, DollarSign, Bus, UserCog, Bell, BarChart3, TrendingDown,
  Trash2, Shield, User, Loader2, Send, KeyRound, CheckCircle2, Search, Filter, UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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

// Tipo unificado para la tabla
type UsuarioUnificado = {
    id: string;
    tipo: 'usuario' | 'solicitud';
    nombre: string;
    telefono: string;
    username?: string; // Solo usuarios
    rol?: string;      // Solo usuarios
    estatus: 'ACTIVO' | 'INVITADO' | 'SOLICITUD';
    hijoNombre?: string; // Solo solicitudes
};

export default function UsuariosPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [dataUnificada, setDataUnificada] = useState<UsuarioUnificado[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // todos, activos, invitados, solicitudes

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sesión no válida.");

      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      
      const [resUsers, resSolicitudes] = await Promise.all([
        fetch(`${apiUrl}/users`, { headers }),
        fetch(`${apiUrl}/solicitudes`, { headers }),
      ]);

      const users = resUsers.ok ? await resUsers.json() : [];
      const solicitudes = resSolicitudes.ok ? await resSolicitudes.json() : [];

      // Normalizar datos en una sola lista
      const listaUsuarios: UsuarioUnificado[] = users.map((u: any) => ({
          id: u.id,
          tipo: 'usuario',
          nombre: u.nombre,
          telefono: u.telefono,
          username: u.username,
          rol: u.rol,
          estatus: u.estatus || 'INVITADO'
      }));

      const listaSolicitudes: UsuarioUnificado[] = solicitudes.map((s: any) => ({
          id: s.id,
          tipo: 'solicitud',
          nombre: s.padreNombre,
          telefono: s.telefono,
          estatus: 'SOLICITUD',
          hijoNombre: s.hijoNombre
      }));

      setDataUnificada([...listaSolicitudes, ...listaUsuarios]);
      
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudieron cargar los usuarios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- LÓGICA DE FILTRADO ---
  const filteredData = useMemo(() => {
      return dataUnificada.filter(item => {
          const matchSearch = 
              item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (item.username && item.username.toLowerCase().includes(searchTerm.toLowerCase()));
          
          if (!matchSearch) return false;

          if (filterStatus === "todos") return true;
          if (filterStatus === "solicitudes") return item.estatus === "SOLICITUD";
          if (filterStatus === "activos") return item.estatus === "ACTIVO";
          if (filterStatus === "pendientes") return item.estatus === "INVITADO";
          
          return true;
      });
  }, [dataUnificada, searchTerm, filterStatus]);

  // --- ACCIONES ---

  // 1. Generar acceso temporal y abrir WhatsApp
  const handleEnviarInvitacion = async (user: UsuarioUnificado, esReset: boolean) => {
    setActionLoading(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      
      const res = await fetch(`${apiUrl}/users/${user.id}/invitacion`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error("No se pudo generar el acceso temporal.");

      const data = await res.json();

      // Normalizar teléfono al formato internacional de WhatsApp (505 = Nicaragua)
      let telefonoLimpio = user.telefono.replace(/[\s\-\(\)]/g, '');
      if (telefonoLimpio.startsWith('+')) {
        telefonoLimpio = telefonoLimpio.slice(1);
      } else if (!telefonoLimpio.startsWith('505') && telefonoLimpio.length === 8) {
        telefonoLimpio = `505${telefonoLimpio}`;
      }

      const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(data.mensaje)}`;
      window.open(url, "_blank");
      
      toast({ 
        title: esReset ? "🔑 Nuevo acceso generado" : "✅ Invitación lista",
        description: `WhatsApp se abrirá con el usuario y contraseña temporal de ${user.nombre}.`
      });
      fetchData();

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Aprobar Solicitud
  const handleAprobarSolicitud = async (id: string) => {
    setActionLoading(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

      const res = await fetch(`${apiUrl}/solicitudes/${id}/aprobar`, {
        method: "PATCH",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Error al aprobar solicitud");

      toast({ title: "Solicitud Aprobada", description: "Usuario tutor generado correctamente." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Eliminar / Rechazar
  const handleDelete = async (user: UsuarioUnificado) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${user.nombre}? Esta acción es irreversible.`)) return;
    
    setActionLoading(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      const endpoint = user.tipo === 'usuario' ? 'users' : 'solicitudes';
      
      await fetch(`${apiUrl}/${endpoint}/${user.id}`, { 
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast({ title: "Registro eliminado" });
      setDataUnificada(prev => prev.filter(i => i.id !== user.id)); // Optimistic update
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      fetchData(); // Rollback si falla
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Gestión de Usuarios" menuItems={menuItems}>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const solicitudesCount = dataUnificada.filter(u => u.estatus === 'SOLICITUD').length;

  return (
    <DashboardLayout title="Gestión de Usuarios" menuItems={menuItems}>
      <div className="space-y-6">
        
        {/* --- BARRA DE FILTROS Y BÚSQUEDA --- */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-card p-4 rounded-lg border shadow-sm">
            <div className="w-full md:w-1/2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por nombre, usuario o teléfono..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="w-full md:w-auto flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="activos">Activos (Login OK)</SelectItem>
                        <SelectItem value="pendientes">Invitados (Sin Login)</SelectItem>
                        <SelectItem value="solicitudes">
                            Solicitudes {solicitudesCount > 0 && `(${solicitudesCount})`}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        {/* --- TABLA UNIFICADA --- */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Directorio de Acceso</CardTitle>
            <CardDescription>Administra quién puede entrar a la aplicación y sus permisos.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol / Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Credenciales</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No se encontraron usuarios con ese criterio.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredData.map((item) => {
                            const isProcessing = actionLoading === item.id;
                            return (
                                <TableRow key={item.id}>
                                    {/* Columna 1: Info Principal */}
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.nombre}</span>
                                            <span className="text-xs text-muted-foreground">{item.telefono}</span>
                                            {item.hijoNombre && (
                                                <span className="text-xs text-orange-600 mt-1">Hijo: {item.hijoNombre}</span>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* Columna 2: Rol */}
                                    <TableCell>
                                        {item.tipo === 'solicitud' ? (
                                            <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">Solicitud</Badge>
                                        ) : (
                                            <div className="flex items-center gap-2 capitalize">
                                                {item.rol === 'propietario' ? <Shield className="h-3 w-3 text-purple-600"/> : <User className="h-3 w-3 text-blue-600"/>}
                                                {item.rol}
                                            </div>
                                        )}
                                    </TableCell>

                                    {/* Columna 3: Estado */}
                                    <TableCell>
                                        {item.estatus === 'ACTIVO' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 shadow-none">Activo</Badge>}
                                        {item.estatus === 'INVITADO' && <Badge variant="secondary" className="text-xs">Pendiente</Badge>}
                                        {item.estatus === 'SOLICITUD' && <Badge variant="outline" className="text-xs border-orange-200 text-orange-600">Por Aprobar</Badge>}
                                    </TableCell>

                                    {/* Columna 4: Usuario (Solo si existe) */}
                                    <TableCell>
                                        {item.username ? (
                                            <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 border border-slate-200">
                                                {item.username}
                                            </code>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">-</span>
                                        )}
                                    </TableCell>

                                    {/* Columna 5: Acciones */}
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            
                                            {/* CASO 1: Solicitud */}
                                            {item.estatus === 'SOLICITUD' && (
                                                <Button 
                                                    size="sm" 
                                                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                                                    disabled={isProcessing}
                                                    onClick={() => handleAprobarSolicitud(item.id)}
                                                >
                                                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3 mr-2"/>}
                                                    Aprobar
                                                </Button>
                                            )}

                                            {/* CASO 2: Usuario Pendiente (Invitar) */}
                                            {item.estatus === 'INVITADO' && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                    disabled={isProcessing}
                                                    onClick={() => handleEnviarInvitacion(item, false)}
                                                >
                                                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <Send className="h-3 w-3 mr-2"/>}
                                                    Invitar
                                                </Button>
                                            )}

                                            {/* CASO 3: Usuario Activo (Resetear Password) */}
                                            {item.estatus === 'ACTIVO' && (
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost"
                                                    className="h-8 text-gray-600 hover:text-orange-600 hover:bg-orange-50"
                                                    title="Restablecer contraseña (envía link)"
                                                    disabled={isProcessing}
                                                    onClick={() => handleEnviarInvitacion(item, true)}
                                                >
                                                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <KeyRound className="h-4 w-4"/>}
                                                </Button>
                                            )}

                                            {/* Botón Eliminar (Común) */}
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                disabled={isProcessing}
                                                onClick={() => handleDelete(item)}
                                            >
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
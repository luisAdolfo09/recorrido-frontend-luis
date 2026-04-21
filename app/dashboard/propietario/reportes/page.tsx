"use client"

import { useState, useEffect } from "react"
import {
    Download, TrendingUp, Users, DollarSign, TrendingDown,
    Bus, UserCog, Bell, BarChart3, Loader2, AlertTriangle,
    Wallet, FileSpreadsheet, FileText
} from "lucide-react"
import {
    Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis,
    CartesianGrid, ResponsiveContainer, Tooltip, Legend
} from "recharts"
import jsPDF from "jspdf"
import * as XLSX from "xlsx"

import { DashboardLayout, type MenuItem } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

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

// Colores para gráficas
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ─────────────────────────────────────────────────────────────────
//  HELPERS PDF
// ─────────────────────────────────────────────────────────────────

/** Dibuja un rectángulo redondeado */
function roundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number) {
    doc.roundedRect(x, y, w, h, r, r, 'F');
}

/** Cabecera del PDF */
function drawPDFHeader(doc: jsPDF, fecha: string, periodo: string) {
    const pw = doc.internal.pageSize.getWidth();

    // Fondo azul marino degradado (simulado con rectángulos)
    doc.setFillColor(26, 42, 108);   // #1a2a6c
    doc.rect(0, 0, pw, 42, 'F');
    doc.setFillColor(29, 66, 128);   // #1d4280
    doc.rect(pw * 0.55, 0, pw * 0.45, 42, 'F');

    // Logo / ícono de bus (cuadrado redondeado)
    doc.setFillColor(255, 255, 255, 0.15);
    doc.setFillColor(50, 80, 150);
    roundedRect(doc, 14, 8, 22, 22, 3);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('🚌', 17, 23);

    // Título principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('REPORTE OPERATIVO', 41, 17);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 200, 240);
    doc.text('Sistema de Gestión · Recorrido Escolar', 41, 25);

    // Info derecha
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 215, 255);
    doc.text(`Fecha: ${fecha}`, pw - 14, 14, { align: 'right' });
    doc.text(`Período: ${periodo === 'semestre' ? 'Últimos 6 meses' : 'Año actual'}`, pw - 14, 21, { align: 'right' });
    doc.text(`Generado automáticamente`, pw - 14, 28, { align: 'right' });
    doc.text(`Confidencial`, pw - 14, 35, { align: 'right' });
}

/** Pie de página */
function drawPDFFooter(doc: jsPDF, pageNum: number, totalPages: number) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    doc.setFillColor(240, 244, 255);
    doc.rect(0, ph - 14, pw, 14, 'F');
    doc.setDrawColor(200, 210, 240);
    doc.line(0, ph - 14, pw, ph - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 120, 180);
    doc.text('Recorrido Escolar — Sistema de Gestión Operativa', 14, ph - 5);
    doc.text(`Página ${pageNum} de ${totalPages}`, pw - 14, ph - 5, { align: 'right' });
}

/** Título de sección con línea de color */
function drawSectionTitle(doc: jsPDF, title: string, subtitle: string, y: number, color: number[]) {
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(14, y, 4, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 40, 80);
    doc.text(title, 22, y + 8);
    if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 135, 160);
        doc.text(subtitle, pw - 14, y + 8, { align: 'right' });
    }
    return y + 18;
}

/** KPI card en PDF */
function drawKPICard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, sub: string, color: number[]) {
    // Fondo blanco con sombra simulada (rectángulo ligeramente mayor)
    doc.setFillColor(235, 240, 250);
    roundedRect(doc, x + 0.8, y + 0.8, w, 28, 3);
    doc.setFillColor(255, 255, 255);
    roundedRect(doc, x, y, w, 28, 3);

    // Barra superior de color
    doc.setFillColor(color[0], color[1], color[2]);
    roundedRect(doc, x, y, w, 4, 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 135, 160);
    doc.text(label, x + 5, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 5, y + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 165, 185);
    doc.text(sub, x + 5, y + 27);
}

/** Tabla de datos */
function drawTable(doc: jsPDF, headers: string[], rows: string[][], startY: number, colWidths: number[], headerColor: number[]) {
    const margin = 14;
    const rowH = 8;
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    let y = startY;

    // Encabezado de tabla
    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.rect(margin, y, pw - margin * 2, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let x = margin + 3;
    headers.forEach((h, i) => {
        doc.text(h, x, y + 5.5);
        x += colWidths[i];
    });
    y += rowH;

    // Filas
    rows.forEach((row, rowIdx) => {
        // Control de página
        if (y + rowH > ph - 20) {
            doc.addPage();
            y = 50;
        }
        // Fila par/impar
        doc.setFillColor(rowIdx % 2 === 0 ? 248 : 255, rowIdx % 2 === 0 ? 250 : 255, rowIdx % 2 === 0 ? 255 : 255);
        doc.rect(margin, y, pw - margin * 2, rowH, 'F');

        doc.setDrawColor(220, 228, 245);
        doc.line(margin, y + rowH, pw - margin, y + rowH);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 60, 90);

        x = margin + 3;
        row.forEach((cell, i) => {
            doc.text(String(cell), x, y + 5.5, { maxWidth: colWidths[i] - 4 });
            x += colWidths[i];
        });
        y += rowH;
    });

    return y;
}

/** Mini gráfica de barras dibujada con primitivas PDF (sin imagen) */
function drawBarChart(doc: jsPDF, data: { label: string; value: number; value2?: number; color: string; color2?: string }[], x: number, y: number, w: number, h: number, title: string, isCurrency = false) {
    const barAreaH = h - 20;
    const maxVal = Math.max(...data.map(d => Math.max(d.value, d.value2 ?? 0))) * 1.1 || 1;
    const totalBars = data.length;
    const hasTwo = data.some(d => d.value2 !== undefined);
    const groupW = w / totalBars;
    const barW = hasTwo ? groupW * 0.35 : groupW * 0.55;

    // Fondo
    doc.setFillColor(250, 252, 255);
    roundedRect(doc, x, y, w, h, 3);
    doc.setDrawColor(220, 228, 248);
    doc.roundedRect(x, y, w, h, 3, 3, 'S');

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 55, 90);
    doc.text(title, x + 5, y + 7);

    const chartY = y + 14;
    const chartX = x + 5;
    const chartW = w - 10;

    // Línea base
    doc.setDrawColor(200, 210, 235);
    doc.line(chartX, chartY + barAreaH, chartX + chartW, chartY + barAreaH);

    data.forEach((d, i) => {
        const bx = chartX + i * (chartW / totalBars) + (chartW / totalBars - barW * (hasTwo ? 2 : 1)) / 2;
        const bh = (d.value / maxVal) * barAreaH;
        const by = chartY + barAreaH - bh;

        const hex = d.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        doc.setFillColor(r, g, b);
        roundedRect(doc, bx, by, barW, bh, 1);

        if (hasTwo && d.value2 !== undefined) {
            const bh2 = (d.value2 / maxVal) * barAreaH;
            const by2 = chartY + barAreaH - bh2;
            const hex2 = (d.color2 || '#ef4444').replace('#', '');
            const r2 = parseInt(hex2.substring(0, 2), 16);
            const g2 = parseInt(hex2.substring(2, 4), 16);
            const b2 = parseInt(hex2.substring(4, 6), 16);
            doc.setFillColor(r2, g2, b2);
            roundedRect(doc, bx + barW + 2, by2, barW, bh2, 1);
        }

        // Etiqueta eje X
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 120, 160);
        const label = d.label.length > 6 ? d.label.substring(0, 6) + '.' : d.label;
        doc.text(label, bx + (hasTwo ? barW : barW / 2), chartY + barAreaH + 5, { align: hasTwo ? 'left' : 'center' });
    });
}

// ─────────────────────────────────────────────────────────────────
//  GENERADOR DE PDF COMPLETO
// ─────────────────────────────────────────────────────────────────
function generarPDF(data: any, periodo: string) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const fecha = new Date().toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── PÁGINA 1: Portada + KPIs ──────────────────────────────────
    drawPDFHeader(doc, fecha, periodo);

    let y = 55;

    // ---- KPIs ----
    y = drawSectionTitle(doc, 'Resumen Ejecutivo', 'Indicadores clave del período', y, [29, 66, 128]);

    const kpiW = (pw - 28 - 9) / 4;
    drawKPICard(doc, 14,           y, kpiW, 'Ingresos Totales',  `C$ ${(data.kpi.ingresosTotales || 0).toLocaleString()}`, 'Histórico acumulado', [16, 185, 129]);
    drawKPICard(doc, 14 + kpiW + 3, y, kpiW, 'Gastos Totales',    `C$ ${(data.kpi.gastosTotales || 0).toLocaleString()}`,  'Operativos y mantenim.', [239, 68, 68]);
    drawKPICard(doc, 14 + (kpiW + 3) * 2, y, kpiW, 'Utilidad Neta', `C$ ${(data.kpi.beneficioNeto || 0).toLocaleString()}`, 'Ingresos − Gastos', [99, 102, 241]);
    drawKPICard(doc, 14 + (kpiW + 3) * 3, y, kpiW, 'Alumnos Activos', String(data.kpi.alumnosActivos || 0), 'Matrícula actual', [59, 130, 246]);

    y += 38;

    // ---- Gráfica de balance mensual ----
    if (data.finanzasPorMes && data.finanzasPorMes.length > 0) {
        y = drawSectionTitle(doc, 'Balance Mensual', 'Ingresos vs Gastos por mes', y, [16, 185, 129]);

        const chartData = data.finanzasPorMes.map((d: any) => ({
            label: d.mes,
            value: d.ingreso || 0,
            value2: d.gasto || 0,
            color: '#10b981',
            color2: '#ef4444',
        }));
        drawBarChart(doc, chartData, 14, y, pw - 28, 65, 'Ingresos (verde) vs Gastos (rojo)', true);
        y += 72;
    }

    // ---- Leyenda debajo de la gráfica ----
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setFillColor(16, 185, 129);
    doc.circle(18, y + 2, 2, 'F');
    doc.setTextColor(60, 80, 120);
    doc.text('Ingresos', 22, y + 4);
    doc.setFillColor(239, 68, 68);
    doc.circle(50, y + 2, 2, 'F');
    doc.text('Gastos', 54, y + 4);
    y += 10;

    // ---- Tabla resumen mensual ----
    if (data.finanzasPorMes && data.finanzasPorMes.length > 0) {
        y = drawSectionTitle(doc, 'Detalle Financiero Mensual', '', y, [29, 66, 128]);
        const headers = ['Mes', 'Ingresos (C$)', 'Gastos (C$)', 'Balance (C$)'];
        const colWidths = [40, 50, 50, 42];
        const rows = data.finanzasPorMes.map((d: any) => [
            d.mes || '',
            (d.ingreso || 0).toLocaleString(),
            (d.gasto || 0).toLocaleString(),
            ((d.ingreso || 0) - (d.gasto || 0)).toLocaleString(),
        ]);
        y = drawTable(doc, headers, rows, y, colWidths, [29, 66, 128]);
        y += 10;
    }

    // ── PÁGINA 2: Vehículos + Pagos ──────────────────────────────
    doc.addPage();
    drawPDFHeader(doc, fecha, periodo);
    y = 55;

    if (data.finanzasPorVehiculo && data.finanzasPorVehiculo.length > 0) {
        y = drawSectionTitle(doc, 'Rentabilidad por Vehículo', 'Rendimiento financiero por unidad', y, [245, 158, 11]);

        const vehData = data.finanzasPorVehiculo.map((d: any) => ({
            label: d.nombre || 'Unidad',
            value: d.ingresos || 0,
            value2: d.gastos || 0,
            color: '#3b82f6',
            color2: '#f59e0b',
        }));
        drawBarChart(doc, vehData, 14, y, pw - 28, 60, 'Generado (azul) vs Gastado (naranja)', true);
        y += 68;

        // Tabla vehículos
        y = drawSectionTitle(doc, 'Detalle por Unidad', '', y, [245, 158, 11]);
        const hveh = ['Vehículo', 'Ingresos Generados (C$)', 'Gastos Asignados (C$)', 'Utilidad (C$)'];
        const cveh = [50, 56, 52, 24];
        const rveh = data.finanzasPorVehiculo.map((d: any) => [
            d.nombre || 'Sin nombre',
            (d.ingresos || 0).toLocaleString(),
            (d.gastos || 0).toLocaleString(),
            ((d.ingresos || 0) - (d.gastos || 0)).toLocaleString(),
        ]);
        y = drawTable(doc, hveh, rveh, y, cveh, [245, 158, 11]);
        y += 12;
    }

    // ---- Estado de Pagos ----
    if (data.estadoPagos && data.estadoPagos.length > 0) {
        y = drawSectionTitle(doc, 'Estado de Cartera de Pagos', 'Distribución por estado de cobro', y, [139, 92, 246]);

        const total = data.estadoPagos.reduce((s: number, d: any) => s + (d.valor || 0), 0) || 1;
        const barW = pw - 28;
        const barH = 12;
        let bx = 14;
        
        // Barra de progreso apilada
        doc.setFillColor(240, 242, 250);
        roundedRect(doc, 14, y, barW, barH, 2);

        data.estadoPagos.forEach((d: any) => {
            const pct = (d.valor || 0) / total;
            const segW = barW * pct;
            const hex = (d.color || '#3b82f6').replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            doc.setFillColor(r, g, b);
            roundedRect(doc, bx, y, segW, barH, 2);
            bx += segW;
        });

        y += 16;

        // Leyenda
        data.estadoPagos.forEach((d: any, i: number) => {
            const lx = 14 + i * 55;
            const hex = (d.color || '#3b82f6').replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            doc.setFillColor(r, g, b);
            doc.circle(lx + 3, y + 2, 2, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(50, 65, 100);
            doc.text(`${d.nombre}: ${d.valor} (${Math.round((d.valor / total) * 100)}%)`, lx + 7, y + 4);
        });
        y += 12;

        // Tabla estado pagos
        const hpag = ['Estado', 'Cantidad', 'Porcentaje'];
        const cpag = [80, 60, 42];
        const rpag = data.estadoPagos.map((d: any) => [
            d.nombre || '',
            String(d.valor || 0),
            `${Math.round(((d.valor || 0) / total) * 100)}%`,
        ]);
        y = drawTable(doc, hpag, rpag, y, cpag, [139, 92, 246]);
        y += 12;
    }

    // ── PÁGINA 3: Demografía Alumnos ─────────────────────────────
    doc.addPage();
    drawPDFHeader(doc, fecha, periodo);
    y = 55;

    if (data.alumnosPorGrado && data.alumnosPorGrado.length > 0) {
        y = drawSectionTitle(doc, 'Demografía Estudiantil', 'Distribución de alumnos por grado', y, [99, 102, 241]);

        const gradosData = data.alumnosPorGrado.map((d: any, i: number) => ({
            label: d.grado || `G${i + 1}`,
            value: d.alumnos || 0,
            value2: undefined,
            color: COLORS[i % COLORS.length],
        }));
        drawBarChart(doc, gradosData, 14, y, pw - 28, 70, 'Cantidad de alumnos por grado/grupo');
        y += 78;

        // Tabla grados
        y = drawSectionTitle(doc, 'Detalle por Grado', '', y, [99, 102, 241]);
        const hgrad = ['Grado / Grupo', 'Nº de Alumnos', 'Porcentaje del total'];
        const cgrad = [70, 55, 57];
        const totalAlumnos = data.alumnosPorGrado.reduce((s: number, d: any) => s + (d.alumnos || 0), 0) || 1;
        const rgrad = data.alumnosPorGrado.map((d: any) => [
            d.grado || '',
            String(d.alumnos || 0),
            `${Math.round(((d.alumnos || 0) / totalAlumnos) * 100)}%`,
        ]);
        y = drawTable(doc, hgrad, rgrad, y, cgrad, [99, 102, 241]);
        y += 12;
    }

    // Cuadro de observaciones al final
    if (y < ph - 60) {
        y = drawSectionTitle(doc, 'Observaciones', '', y, [100, 116, 139]);
        doc.setFillColor(248, 250, 255);
        doc.setDrawColor(210, 218, 240);
        doc.roundedRect(14, y, pw - 28, 30, 3, 3, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(120, 140, 180);
        doc.text('Este reporte fue generado de forma automática por el Sistema de Gestión Recorrido Escolar.', 18, y + 10);
        doc.text('Los datos presentados reflejan la información registrada en el sistema a la fecha de generación.', 18, y + 17);
        doc.text('Para más detalle, contacte al administrador del sistema.', 18, y + 24);
    }

    // Agregar pies de página a todas las páginas
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawPDFFooter(doc, i, totalPages);
    }

    const filename = `Reporte_Recorrido_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────
//  GENERADOR DE EXCEL
// ─────────────────────────────────────────────────────────────────
function generarExcel(data: any, periodo: string) {
    const wb = XLSX.utils.book_new();
    const fecha = new Date().toLocaleDateString('es-NI');
    const periodoLabel = periodo === 'semestre' ? 'Últimos 6 meses' : 'Año actual';

    // ── Hoja 1: Resumen General ──────────────────────────────────
    const resumen = [
        ['REPORTE OPERATIVO — RECORRIDO ESCOLAR'],
        [`Período: ${periodoLabel}    |    Fecha de generación: ${fecha}`],
        [],
        ['INDICADORES CLAVE (KPI)'],
        ['Indicador', 'Valor'],
        ['Ingresos Totales (C$)', data.kpi?.ingresosTotales || 0],
        ['Gastos Totales (C$)', data.kpi?.gastosTotales || 0],
        ['Utilidad Neta (C$)', data.kpi?.beneficioNeto || 0],
        ['Alumnos Activos', data.kpi?.alumnosActivos || 0],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
    wsResumen['!cols'] = [{ wch: 35 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen General');

    // ── Hoja 2: Balance Mensual ──────────────────────────────────
    if (data.finanzasPorMes && data.finanzasPorMes.length > 0) {
        const rows = [
            ['BALANCE MENSUAL', '', '', ''],
            [`Período: ${periodoLabel}`, '', '', ''],
            [],
            ['Mes', 'Ingresos (C$)', 'Gastos (C$)', 'Balance (C$)'],
            ...data.finanzasPorMes.map((d: any) => [
                d.mes,
                d.ingreso || 0,
                d.gasto || 0,
                (d.ingreso || 0) - (d.gasto || 0),
            ]),
            [],
            ['TOTALES',
                data.finanzasPorMes.reduce((s: number, d: any) => s + (d.ingreso || 0), 0),
                data.finanzasPorMes.reduce((s: number, d: any) => s + (d.gasto || 0), 0),
                data.finanzasPorMes.reduce((s: number, d: any) => s + (d.ingreso || 0) - (d.gasto || 0), 0),
            ],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Balance Mensual');
    }

    // ── Hoja 3: Rentabilidad Vehículos ───────────────────────────
    if (data.finanzasPorVehiculo && data.finanzasPorVehiculo.length > 0) {
        const rows = [
            ['RENTABILIDAD POR VEHÍCULO', '', '', ''],
            [`Período: ${periodoLabel}`, '', '', ''],
            [],
            ['Vehículo', 'Ingresos Generados (C$)', 'Gastos Asignados (C$)', 'Utilidad (C$)'],
            ...data.finanzasPorVehiculo.map((d: any) => [
                d.nombre || 'Sin nombre',
                d.ingresos || 0,
                d.gastos || 0,
                (d.ingresos || 0) - (d.gastos || 0),
            ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 25 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Vehículos');
    }

    // ── Hoja 4: Estado de Pagos ──────────────────────────────────
    if (data.estadoPagos && data.estadoPagos.length > 0) {
        const total = data.estadoPagos.reduce((s: number, d: any) => s + (d.valor || 0), 0) || 1;
        const rows = [
            ['ESTADO DE CARTERA DE PAGOS', '', ''],
            [`Período: ${periodoLabel}`, '', ''],
            [],
            ['Estado', 'Cantidad', 'Porcentaje (%)'],
            ...data.estadoPagos.map((d: any) => [
                d.nombre || '',
                d.valor || 0,
                `${Math.round(((d.valor || 0) / total) * 100)}%`,
            ]),
            [],
            ['TOTAL', total, '100%'],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Estado de Pagos');
    }

    // ── Hoja 5: Demografía Alumnos ───────────────────────────────
    if (data.alumnosPorGrado && data.alumnosPorGrado.length > 0) {
        const totalAlumnos = data.alumnosPorGrado.reduce((s: number, d: any) => s + (d.alumnos || 0), 0) || 1;
        const rows = [
            ['DEMOGRAFÍA ESTUDIANTIL', '', ''],
            [],
            ['Grado / Grupo', 'Nº de Alumnos', 'Porcentaje (%)'],
            ...data.alumnosPorGrado.map((d: any) => [
                d.grado || '',
                d.alumnos || 0,
                `${Math.round(((d.alumnos || 0) / totalAlumnos) * 100)}%`,
            ]),
            [],
            ['TOTAL', totalAlumnos, '100%'],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Demografía Alumnos');
    }

    const filename = `Reporte_Recorrido_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// ─────────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export default function ReportesPage() {
    const { toast } = useToast()
    const [periodo, setPeriodo] = useState("anio")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<any>(null)

    const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

    const [isDarkMode, setIsDarkMode] = useState(false);

    // --- DETECCIÓN DE TEMA ---
    useEffect(() => {
        const checkTheme = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        checkTheme();
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // --- CARGA DE DATOS ---
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Sesión no válida.");

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reportes/dashboard`, { headers });

            if (!res.ok) {
                if (res.status === 404 || res.status === 204) {
                    setData({});
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.message || `Error del servidor (${res.status})`);
                }
            } else {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error(error);
            setError((error as Error).message);
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, [toast])

    // --- EXPORTAR PDF ---
    const handleExportarPDF = async () => {
        if (!data) return;
        setExporting('pdf');
        try {
            generarPDF(data, periodo);
            toast({ title: "✅ PDF generado", description: "El reporte profesional se ha descargado." });
        } catch (err) {
            console.error("Error PDF:", err);
            toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
        } finally {
            setExporting(null);
        }
    }

    // --- EXPORTAR EXCEL ---
    const handleExportarExcel = async () => {
        if (!data) return;
        setExporting('excel');
        try {
            generarExcel(data, periodo);
            toast({ title: "✅ Excel generado", description: "El archivo Excel se ha descargado con todas las hojas de datos." });
        } catch (err) {
            console.error("Error Excel:", err);
            toast({ title: "Error", description: "No se pudo generar el Excel.", variant: "destructive" });
        } finally {
            setExporting(null);
        }
    }

    // --- ESTILOS GRÁFICAS ---
    const chartTheme = {
        textColor: isDarkMode ? "#94a3b8" : "#64748b",
        gridColor: isDarkMode ? "#334155" : "#e2e8f0",
        tooltipBg: isDarkMode ? "#1e293b" : "#ffffff",
        tooltipBorder: isDarkMode ? "#475569" : "#e2e8f0",
        tooltipText: isDarkMode ? "#f8fafc" : "#0f172a"
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div
                    className="p-3 text-sm rounded-lg shadow-xl border"
                    style={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText
                    }}
                >
                    <p className="font-semibold mb-2">{label || payload[0].payload.nombre || payload[0].name}</p>
                    {payload.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                            <div style={{ width: 8, height: 8, backgroundColor: p.color, borderRadius: '50%' }} />
                            <span className="capitalize">
                                {p.name}: {['ingreso', 'gasto', 'monto', 'ingresos', 'gastos', 'valor'].some(k => p.dataKey?.toLowerCase().includes(k) || p.name?.toLowerCase().includes(k)) ? 'C$ ' : ''}
                                {Number(p.value).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    if (loading) {
        return (
            <DashboardLayout title="Reportes" menuItems={menuItems}>
                <div className="flex justify-center items-center h-96">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        )
    }

    if (error || !data || Object.keys(data).length === 0) {
        return (
            <DashboardLayout title="Reportes" menuItems={menuItems}>
                <div className="flex flex-col justify-center items-center h-96 text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Sin datos suficientes</h3>
                    <p className="text-muted-foreground max-w-md mb-4">
                        {error ? `Error: ${error}` : "Registra alumnos, pagos y gastos para ver las estadísticas."}
                    </p>
                    <Button onClick={fetchData}>Recargar</Button>
                </div>
            </DashboardLayout>
        );
    }

    const totalAlumnos = data.kpi?.alumnosActivos || 0;

    return (
        <DashboardLayout title="Reportes y Estadísticas" menuItems={menuItems}>
            <div className="space-y-6">

                {/* ---- BARRA SUPERIOR ---- */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold">Análisis Financiero</h2>
                        <CardDescription>Rendimiento en tiempo real del sistema.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={periodo} onValueChange={setPeriodo}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Periodo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="semestre">Últimos 6 meses</SelectItem>
                                <SelectItem value="anio">Año Actual</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Botón Excel */}
                        <Button
                            variant="outline"
                            onClick={handleExportarExcel}
                            disabled={exporting !== null}
                            className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                        >
                            {exporting === 'excel'
                                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                : <FileSpreadsheet className="h-4 w-4 mr-2" />
                            }
                            {exporting === 'excel' ? 'Generando...' : 'Exportar Excel'}
                        </Button>

                        {/* Botón PDF */}
                        <Button
                            onClick={handleExportarPDF}
                            disabled={exporting !== null}
                            className="bg-[#1d4280] hover:bg-[#1a2a6c] text-white"
                        >
                            {exporting === 'pdf'
                                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                : <FileText className="h-4 w-4 mr-2" />
                            }
                            {exporting === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}
                        </Button>
                    </div>
                </div>

                {/* ---- KPI CARDS ---- */}
                <div id="reporte-content" className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between">
                                <CardDescription>Ingresos Totales</CardDescription>
                                <DollarSign className="w-4 h-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    C$ {data.kpi.ingresosTotales.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Histórico acumulado</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between">
                                <CardDescription>Gastos Totales</CardDescription>
                                <TrendingDown className="w-4 h-4 text-pink-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                    C$ {data.kpi.gastosTotales.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Operativos y Mantenimiento</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between">
                                <CardDescription>Utilidad Neta</CardDescription>
                                <Wallet className="w-4 h-4 text-indigo-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    C$ {data.kpi.beneficioNeto.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Ingresos - Gastos</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between">
                                <CardDescription>Alumnos Activos</CardDescription>
                                <Users className="w-4 h-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">
                                    {totalAlumnos}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Matrícula actual</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ---- TABS DE GRÁFICAS ---- */}
                    <Tabs defaultValue="general" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="general">Finanzas General</TabsTrigger>
                            <TabsTrigger value="vehiculos">Rentabilidad x Unidad</TabsTrigger>
                            <TabsTrigger value="pagos">Estado de Cartera</TabsTrigger>
                            <TabsTrigger value="alumnos">Demografía</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Balance Mensual</CardTitle>
                                    <CardDescription>Ingresos vs Gastos por mes</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.finanzasPorMes}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
                                            <XAxis dataKey="mes" stroke={chartTheme.textColor} fontSize={12} />
                                            <YAxis stroke={chartTheme.textColor} fontSize={12} tickFormatter={(v) => `C$${v / 1000}k`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDarkMode ? '#33415540' : '#f1f5f980' }} />
                                            <Legend />
                                            <Bar dataKey="ingreso" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="gasto" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="vehiculos">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Rentabilidad por Vehículo</CardTitle>
                                    <CardDescription>Rendimiento financiero por unidad de transporte</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[400px] w-full overflow-x-auto">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={500}>
                                        <BarChart data={data.finanzasPorVehiculo}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
                                            <XAxis dataKey="nombre" stroke={chartTheme.textColor} fontSize={12} />
                                            <YAxis stroke={chartTheme.textColor} fontSize={12} tickFormatter={(v) => `C$${v / 1000}k`} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDarkMode ? '#33415540' : '#f1f5f980' }} />
                                            <Legend />
                                            <Bar dataKey="ingresos" name="Generado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="gastos" name="Gastado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="pagos">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Estado de Pagos</CardTitle>
                                    <CardDescription>Porcentaje de cumplimiento mensual</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[400px] w-full flex justify-center">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                                        <PieChart>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} />
                                            <Pie
                                                data={data.estadoPagos}
                                                dataKey="valor"
                                                nameKey="nombre"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={120}
                                                paddingAngle={2}
                                                stroke="none"
                                            >
                                                {data.estadoPagos?.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="alumnos">
                            <Card>
                                <CardHeader><CardTitle>Alumnos por Grado</CardTitle></CardHeader>
                                <CardContent className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.alumnosPorGrado} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.gridColor} />
                                            <XAxis type="number" stroke={chartTheme.textColor} />
                                            <YAxis dataKey="grado" type="category" width={100} stroke={chartTheme.textColor} fontSize={12} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDarkMode ? '#33415540' : '#f1f5f980' }} />
                                            <Bar dataKey="alumnos" name="Cantidad" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </DashboardLayout>
    )
}
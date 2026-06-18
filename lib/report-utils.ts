// ─────────────────────────────────────────────────────────────────────────
//  Utilidades de reportería compartidas (PDF + Excel)
//  Usadas por las páginas de Pagos y Gastos del panel de propietario.
//  Solo cliente (usa descargas del navegador). Sin dependencias de React.
// ─────────────────────────────────────────────────────────────────────────
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export type RGB = [number, number, number];

/** Paleta de marca del sistema (coincide con las gráficas del dashboard). */
export const REPORT_COLORS: Record<string, RGB> = {
    navy: [29, 66, 128],
    green: [16, 185, 129],
    red: [239, 68, 68],
    orange: [245, 158, 11],
    indigo: [99, 102, 241],
    purple: [139, 92, 246],
    blue: [59, 130, 246],
    pink: [236, 72, 153],
    slate: [100, 116, 139],
};

export interface ReportMeta {
    /** Título grande de la cabecera, ej. "REPORTE DE PAGOS". */
    titulo: string;
    /** Subtítulo bajo el título. */
    subtitulo?: string;
    /** Etiqueta de período mostrada a la derecha de la cabecera. */
    periodoLabel?: string;
    /** Color de acento de la cabecera (degradado). */
    accent?: RGB;
    /** Texto del pie de página. */
    footer?: string;
}

export interface KpiCard {
    label: string;
    value: string;
    sub?: string;
    color?: RGB;
}

export interface TableOptions {
    /** Anchos absolutos en mm por columna. Si se omite, se reparten equitativamente. */
    colWidths?: number[];
    headerColor?: RGB;
    /** Alineación por columna. Por defecto "left". */
    align?: ("left" | "right" | "center")[];
}

// ─────────────────────────────────────────────────────────────────────────
//  Formateadores
// ─────────────────────────────────────────────────────────────────────────
export function fmtMoney(n: number): string {
    return (Number(n) || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function fmtInt(n: number): string {
    return (Number(n) || 0).toLocaleString("en-US");
}

export function todayStr(): string {
    return new Date().toLocaleDateString("es-NI", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function fileStamp(): string {
    return new Date().toISOString().split("T")[0];
}

function hexToRgb(hex: string): RGB {
    const h = hex.replace("#", "");
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

// ─────────────────────────────────────────────────────────────────────────
//  Generador de PDF (API encadenable)
// ─────────────────────────────────────────────────────────────────────────
const MARGIN = 14;
const ROW_H = 8;

export class ReportPDF {
    doc: jsPDF;
    y: number;
    private meta: Required<Pick<ReportMeta, "titulo">> & ReportMeta;
    private fecha: string;
    private pw: number;
    private ph: number;

    constructor(meta: ReportMeta) {
        this.doc = new jsPDF("p", "mm", "a4");
        this.pw = this.doc.internal.pageSize.getWidth();
        this.ph = this.doc.internal.pageSize.getHeight();
        this.meta = { accent: REPORT_COLORS.navy, ...meta };
        this.fecha = todayStr();
        this.drawHeader();
        this.y = 52;
    }

    private rect(x: number, y: number, w: number, h: number, r: number) {
        this.doc.roundedRect(x, y, w, h, r, r, "F");
    }

    /**
     * Dibuja un autobús estilizado con primitivas vectoriales.
     * Reemplaza al emoji 🚌, que jsPDF (fuente Helvetica) renderiza como
     * caracteres ilegibles ("Ø=ÞŒ").
     */
    private drawBusIcon(bx: number, by: number, size: number) {
        const doc = this.doc;

        // Recuadro de fondo
        doc.setFillColor(50, 80, 150);
        doc.roundedRect(bx, by, size, size, 3, 3, "F");

        const bodyX = bx + size * 0.16;
        const bodyY = by + size * 0.3;
        const bodyW = size * 0.68;
        const bodyH = size * 0.34;

        // Carrocería (blanca)
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(bodyX, bodyY, bodyW, bodyH, 1.4, 1.4, "F");

        // Franja de ventanas (color del fondo)
        doc.setFillColor(50, 80, 150);
        const winY = bodyY + bodyH * 0.16;
        const winH = bodyH * 0.32;
        const winW = bodyW * 0.19;
        const gap = bodyW * 0.06;
        let wx = bodyX + bodyW * 0.1;
        for (let i = 0; i < 3; i++) {
            doc.roundedRect(wx, winY, winW, winH, 0.5, 0.5, "F");
            wx += winW + gap;
        }

        // Ruedas
        doc.setFillColor(25, 35, 70);
        const wheelY = bodyY + bodyH + size * 0.02;
        doc.circle(bodyX + bodyW * 0.26, wheelY, size * 0.075, "F");
        doc.circle(bodyX + bodyW * 0.74, wheelY, size * 0.075, "F");
    }

    private drawHeader() {
        const { doc, pw } = this;
        const accent = this.meta.accent || REPORT_COLORS.navy;

        // Banda superior
        doc.setFillColor(26, 42, 108);
        doc.rect(0, 0, pw, 42, "F");
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(pw * 0.55, 0, pw * 0.45, 42, "F");

        // Logo / icono (autobús vectorial, sin emoji)
        this.drawBusIcon(MARGIN, 8, 22);

        // Título
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(this.meta.titulo, 41, 17);

        // Subtítulo
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(180, 200, 240);
        doc.text(this.meta.subtitulo || "Sistema de Gestión · Recorrido Escolar", 41, 25);

        // Info derecha
        doc.setFontSize(8);
        doc.setTextColor(200, 215, 255);
        doc.text(`Fecha: ${this.fecha}`, pw - MARGIN, 14, { align: "right" });
        if (this.meta.periodoLabel) {
            doc.text(`Período: ${this.meta.periodoLabel}`, pw - MARGIN, 21, { align: "right" });
        }
        doc.text("Generado automáticamente", pw - MARGIN, 28, { align: "right" });
        doc.text("Confidencial", pw - MARGIN, 35, { align: "right" });
    }

    /** Inicia una nueva página y vuelve a dibujar la cabecera. */
    newPage(): this {
        this.doc.addPage();
        this.drawHeader();
        this.y = 52;
        return this;
    }

    /** Asegura que haya al menos `neededMm` de espacio vertical; si no, salta de página. */
    ensure(neededMm: number): this {
        if (this.y + neededMm > this.ph - 20) this.newPage();
        return this;
    }

    spacer(mm: number): this {
        this.y += mm;
        return this;
    }

    /** Título de sección con barra de color a la izquierda. */
    sectionTitle(title: string, subtitle?: string, color: RGB = REPORT_COLORS.navy): this {
        this.ensure(24);
        const { doc, pw, y } = this;
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(MARGIN, y, 4, 12, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 40, 80);
        doc.text(title, 22, y + 8);
        if (subtitle) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(120, 135, 160);
            doc.text(subtitle, pw - MARGIN, y + 8, { align: "right" });
        }
        this.y = y + 18;
        return this;
    }

    /** Fila(s) de tarjetas KPI (hasta 4 por fila). */
    kpis(cards: KpiCard[]): this {
        if (!cards.length) return this;
        const { doc, pw } = this;
        const perRow = Math.min(4, cards.length);
        const cardW = (pw - MARGIN * 2 - 3 * (perRow - 1)) / perRow;
        const cardH = 28;

        cards.forEach((c, i) => {
            const col = i % perRow;
            if (col === 0) this.ensure(cardH + 6);
            const x = MARGIN + col * (cardW + 3);
            const y = this.y;
            const color = c.color || REPORT_COLORS.navy;

            // Sombra + fondo
            doc.setFillColor(235, 240, 250);
            this.rect(x + 0.8, y + 0.8, cardW, cardH, 3);
            doc.setFillColor(255, 255, 255);
            this.rect(x, y, cardW, cardH, 3);

            // Barra de color
            doc.setFillColor(color[0], color[1], color[2]);
            this.rect(x, y, cardW, 4, 2);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(120, 135, 160);
            doc.text(c.label, x + 5, y + 12, { maxWidth: cardW - 8 });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(c.value, x + 5, y + 21, { maxWidth: cardW - 8 });

            if (c.sub) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
                doc.setTextColor(150, 165, 185);
                doc.text(c.sub, x + 5, y + 27, { maxWidth: cardW - 8 });
            }

            // Avanzar y al terminar cada fila
            if (col === perRow - 1 || i === cards.length - 1) {
                this.y = y + cardH + 8;
            }
        });
        return this;
    }

    /** Tabla con paginación automática (re-dibuja el encabezado al saltar de página). */
    table(headers: string[], rows: (string | number)[][], options: TableOptions = {}): this {
        const { doc, pw } = this;
        const headerColor = options.headerColor || REPORT_COLORS.navy;
        const align = options.align || [];
        const colWidths =
            options.colWidths && options.colWidths.length === headers.length
                ? options.colWidths
                : headers.map(() => (pw - MARGIN * 2) / headers.length);

        const cellX = (colIdx: number) => MARGIN + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0);

        const drawHeaderRow = () => {
            this.ensure(ROW_H * 2);
            const y = this.y;
            doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
            doc.rect(MARGIN, y, pw - MARGIN * 2, ROW_H, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            headers.forEach((h, i) => {
                const a = align[i] || "left";
                const x =
                    a === "right" ? cellX(i) + colWidths[i] - 3 : a === "center" ? cellX(i) + colWidths[i] / 2 : cellX(i) + 3;
                doc.text(h, x, y + 5.5, { align: a, maxWidth: colWidths[i] - 4 });
            });
            this.y = y + ROW_H;
        };

        drawHeaderRow();

        rows.forEach((row, rowIdx) => {
            if (this.y + ROW_H > this.ph - 20) {
                this.newPage();
                drawHeaderRow();
            }
            const y = this.y;
            doc.setFillColor(rowIdx % 2 === 0 ? 248 : 255, rowIdx % 2 === 0 ? 250 : 255, 255);
            doc.rect(MARGIN, y, pw - MARGIN * 2, ROW_H, "F");
            doc.setDrawColor(220, 228, 245);
            doc.line(MARGIN, y + ROW_H, pw - MARGIN, y + ROW_H);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(50, 60, 90);
            row.forEach((cell, i) => {
                const a = align[i] || "left";
                const x =
                    a === "right" ? cellX(i) + colWidths[i] - 3 : a === "center" ? cellX(i) + colWidths[i] / 2 : cellX(i) + 3;
                doc.text(String(cell ?? ""), x, y + 5.5, { align: a, maxWidth: colWidths[i] - 4 });
            });
            this.y = y + ROW_H;
        });
        this.y += 4;
        return this;
    }

    /** Barra horizontal apilada (útil para distribución por estado/categoría). */
    stackedBar(segments: { label: string; value: number; color: string | RGB }[], titulo?: string): this {
        const { doc, pw } = this;
        const total = segments.reduce((s, d) => s + (d.value || 0), 0) || 1;
        this.ensure(34);
        if (titulo) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(40, 55, 90);
            doc.text(titulo, MARGIN, this.y);
            this.y += 5;
        }
        const barW = pw - MARGIN * 2;
        const barH = 12;
        const y = this.y;
        doc.setFillColor(240, 242, 250);
        this.rect(MARGIN, y, barW, barH, 2);
        let bx = MARGIN;
        segments.forEach((d) => {
            const segW = (barW * (d.value || 0)) / total;
            const c = Array.isArray(d.color) ? d.color : hexToRgb(d.color);
            doc.setFillColor(c[0], c[1], c[2]);
            this.rect(bx, y, Math.max(segW, 0), barH, 2);
            bx += segW;
        });
        this.y = y + barH + 6;

        // Leyenda
        segments.forEach((d, i) => {
            const lx = MARGIN + (i % 3) * 60;
            if (i % 3 === 0 && i > 0) this.y += 6;
            const c = Array.isArray(d.color) ? d.color : hexToRgb(d.color);
            doc.setFillColor(c[0], c[1], c[2]);
            doc.circle(lx + 2, this.y + 1, 2, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(50, 65, 100);
            doc.text(
                `${d.label}: ${Math.round(((d.value || 0) / total) * 100)}%`,
                lx + 6,
                this.y + 3,
                { maxWidth: 52 }
            );
        });
        this.y += 10;
        return this;
    }

    /** Cuadro de observaciones / notas. */
    note(lines: string[], title = "Observaciones"): this {
        this.ensure(14 + lines.length * 7);
        if (title) this.sectionTitle(title, "", REPORT_COLORS.slate);
        const { doc, pw } = this;
        const h = 8 + lines.length * 7;
        doc.setFillColor(248, 250, 255);
        doc.setDrawColor(210, 218, 240);
        doc.roundedRect(MARGIN, this.y, pw - MARGIN * 2, h, 3, 3, "FD");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 140, 180);
        lines.forEach((l, i) => doc.text(l, MARGIN + 4, this.y + 7 + i * 7, { maxWidth: pw - MARGIN * 2 - 8 }));
        this.y += h + 6;
        return this;
    }

    private drawFooters() {
        const { doc, pw, ph } = this;
        const footer = this.meta.footer || "Recorrido Escolar — Sistema de Gestión Operativa";
        const total = doc.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            doc.setFillColor(240, 244, 255);
            doc.rect(0, ph - 14, pw, 14, "F");
            doc.setDrawColor(200, 210, 240);
            doc.line(0, ph - 14, pw, ph - 14);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(100, 120, 180);
            doc.text(footer, MARGIN, ph - 5);
            doc.text(`Página ${i} de ${total}`, pw - MARGIN, ph - 5, { align: "right" });
        }
    }

    /** Agrega los pies de página y descarga el archivo. */
    save(filename: string): void {
        this.drawFooters();
        this.doc.save(filename.endsWith(".pdf") ? filename : `${filename}_${fileStamp()}.pdf`);
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  Generador de Excel
// ─────────────────────────────────────────────────────────────────────────
export interface ExcelSheet {
    /** Nombre de la pestaña (máx. 31 caracteres, se recorta). */
    name: string;
    /** Filas como arreglo de arreglos (AOA). */
    aoa: (string | number)[][];
    /** Anchos de columna (en caracteres). */
    cols?: number[];
}

/** Crea y descarga un libro de Excel con las hojas indicadas. */
export function exportExcel(filename: string, sheets: ExcelSheet[]): void {
    const wb = XLSX.utils.book_new();
    sheets.forEach((s) => {
        const ws = XLSX.utils.aoa_to_sheet(s.aoa);
        if (s.cols) ws["!cols"] = s.cols.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
    });
    XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}_${fileStamp()}.xlsx`);
}

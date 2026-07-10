// Exportación a Excel (SheetJS). Solo escribimos archivos desde datos
// propios; nunca leemos archivos ajenos con esta librería.
// Import dinámico: la librería (~400 kB) se descarga solo al exportar.

export interface Hoja {
  nombre: string
  filas: Record<string, unknown>[]
}

export async function exportarExcel(nombreArchivo: string, hojas: Hoja[]) {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()
  for (const hoja of hojas) {
    const filas = hoja.filas.length > 0 ? hoja.filas : [{ Aviso: 'Sin datos para este reporte' }]
    // Excel limita el nombre de hoja a 31 caracteres.
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), hoja.nombre.slice(0, 31))
  }
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`)
}

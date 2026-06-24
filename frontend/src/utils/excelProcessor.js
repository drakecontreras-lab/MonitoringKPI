import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Mapeo estático para Gr. planif.PM
const planningGroupMap = {
  "C81": "Pl.Termoelec.Chuq.",
  "C82": "Pl.Dist.Energ.Elec",
  "C89": "Pl.Mant.Ind.Electr",
  "CO0": "Concentradora A0",
  "CO1": "Concentradora A1",
  "CO2": "Concentradora A2",
  "CB1": "SAE Centralizado",
  "C71": "Pl.Maestranza.Cent",
  "C72": "Pl.Calderería.Cent",
  "C74": "CONTRATOS METALMEC",
  "C40": "Planif. Refinería",
  "SAPCI": "SAPCI"
};

/**
 * Limpia y formatea estéticamente el nombre del proceso para reportes visuales corporativos.
 * Quita números anteriores, elimina el sufijo DCH y capitaliza la primera letra.
 * @param {string} name - Nombre original del proceso.
 * @returns {string} Nombre limpio y formateado.
 */
function formatProcesoName(name) {
  if (!name) return '';
  let cleaned = name.toString().trim();
  // Quitar dos números seguidos de espacio opcional al inicio (ej: "03 ", "99 ")
  cleaned = cleaned.replace(/^\d{2}\s+/, '');
  // Quitar " DCH" o "DCH" al final, insensible a mayúsculas
  cleaned = cleaned.replace(/\s+DCH$/i, '').replace(/DCH$/i, '');
  // Dejar la primera letra en mayúscula y el resto en minúscula
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }
  return cleaned;
}

/**
 * Detecta si una fila representa una celda de total, resultado o datos inválidos
 * que no deben aparecer en las tablas individuales de procesos.
 */
function isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM) {
  const p = String(proceso || '').trim().toLowerCase();
  const g = String(grPlanif || '').trim().toLowerCase();
  const gpm = String(grPlanifPM || '').trim().toLowerCase();
  
  if (p === 'n/a' || p === '' || p.includes('total') || p.includes('resultado') || p.includes('general') || p.includes('código no encontrado')) {
    return true;
  }
  if (g === 'n/a' || g === '' || g.includes('código no encontrado') || g.includes('resultado') || g.includes('total') || g.includes('general')) {
    return true;
  }
  if (gpm === 'n/a' || gpm === '' || gpm.includes('código no encontrado') || gpm.includes('resultado') || gpm.includes('total') || gpm.includes('general')) {
    return true;
  }
  return false;
}

/**
 * Convierte un valor de celda de Excel a un número decimal de porcentaje (0-1).
 * Maneja tanto números decimales (0.88), enteros (88), como strings ("88%", "88,3%").
 * Retorna null si el valor no es parseable como porcentaje.
 */
function parseCellPercentage(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string' && val.includes('%')) {
    // Strings tipo "100%", "88,3%", "88.3%"
    const cleaned = val.trim().replace(/%/g, '').replace(/,/g, '.').trim();
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      if (num > 0 && num <= 1.0001) return num;
      if (num > 1.0001 && num <= 100) return num / 100;
    }
    return null;
  }
  if (typeof val === 'number') {
    if (val > 0 && val <= 1.0001) return val;     // decimal tipo 0.88
    if (val > 1.0001 && val <= 100) return val / 100; // entero tipo 88
  }
  return null;
}

/**
 * Busca y extrae el porcentaje de cumplimiento real de la fila de totales en una hoja Excel.
 * Escanea de forma inteligente todas las celdas de la fila buscando 'total' o 'resultado' de abajo hacia arriba.
 * Prioridad: strings con "%" > decimales (0-1) > enteros (1-100), para no confundir cantidades con porcentajes.
 */
function extractTotalPercentage(rows, processColIdx) {
  if (!rows || rows.length <= 1) return null;
  // Recorrer las filas de abajo hacia arriba para encontrar los totales/resultados reales prioritariamente
  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    if (row && Array.isArray(row)) {
      // Validar si alguna celda en la fila contiene 'total' o 'resultado'
      const isTotalRow = row.some(cell => {
        const str = String(cell || '').trim().toLowerCase();
        return str.includes('total') || str.includes('resultado');
      });

      if (isTotalRow) {
        // Estrategia 1: buscar strings que contengan '%' (ej: "100%", "88,3%") — máxima confiabilidad
        for (let colIdx = row.length - 1; colIdx >= 0; colIdx--) {
          const val = row[colIdx];
          if (typeof val === 'string' && val.includes('%')) {
            const cleaned = val.trim().replace(/%/g, '').replace(/,/g, '.').trim();
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              if (num > 0 && num <= 1.0001) return num;
              if (num > 1.0001 && num <= 100) return num / 100;
            }
          }
        }
        // Estrategia 2: buscar números decimales entre 0 y 1 (formato interno de Excel para %)
        for (let colIdx = row.length - 1; colIdx >= 0; colIdx--) {
          const val = row[colIdx];
          if (typeof val === 'number' && val > 0 && val <= 1.0001) {
            return val;
          }
        }
        // Estrategia 3: NO usar enteros como fallback — podrían ser cantidades (22, 166, 188)
        // Si no se encontró un porcentaje claro, retornar null para usar el valor calculado
      }
    }
  }
  return null;
}


function decodeQuotedPrintableToBuffer(str) {
  const cleanStr = str.replace(/=\r?\n/g, '');
  const bytes = [];
  
  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    if (char === '=') {
      const hex = cleanStr.slice(i + 1, i + 3);
      if (/^[0-9A-F]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
      } else {
        bytes.push(char.charCodeAt(0));
      }
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  
  return Buffer.from(bytes);
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#(\d+);/g, (match, dec) => {
      const code = parseInt(dec, 10);
      if (code === 160) return ' ';
      return String.fromCharCode(code);
    })
    .replace(/&#x([0-9A-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function readExcelOrMhtmlFile(filePath) {
  // 1. Leer los primeros 20 bytes para verificar si es MHTML o zip/xlsx
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(20);
  fs.readSync(fd, buffer, 0, 20, 0);
  fs.closeSync(fd);
  
  const startString = buffer.toString('utf-8');
  
  // Si empieza con 'PK', es un archivo XLSX estándar comprimido
  if (startString.startsWith('PK\x03\x04')) {
    return XLSX.readFile(filePath);
  }
  
  // De lo contrario, leer como texto decodificando MHTML y quoted-printable
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.startsWith('MIME-Version:') || content.includes('<html')) {
    let htmlContent = content;
    
    if (content.startsWith('MIME-Version:')) {
      const boundaryMatch = content.match(/boundary="([^"]+)"/);
      const boundary = boundaryMatch ? boundaryMatch[1] : 'NEXTMIME';
      const parts = content.split('--' + boundary);
      const htmlPart = parts.find(p => p.includes('Content-Type: text/html'));
      
      if (htmlPart) {
        const headersEndIdx = htmlPart.indexOf('\r\n\r\n');
        const startIdx = headersEndIdx !== -1 ? headersEndIdx + 4 : 0;
        const body = htmlPart.slice(startIdx).trim();
        const decodedBuffer = decodeQuotedPrintableToBuffer(body);
        htmlContent = decodedBuffer.toString('latin1');
      }
    }
    
    const cleanHtml = decodeHtmlEntities(htmlContent);
    const wb = XLSX.read(cleanHtml, { type: 'string' });
    
    let maxRows = 0;
    let targetSheetName = wb.SheetNames[0];
    let targetSheet = wb.Sheets[targetSheetName];
    
    wb.SheetNames.forEach(name => {
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length > maxRows) {
        maxRows = rows.length;
        targetSheetName = name;
        targetSheet = sheet;
      }
    });
    
    const cleanWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(cleanWb, targetSheet, wb.SheetNames[0] || "Sheet1");
    return cleanWb;
  }
  
  return XLSX.readFile(filePath);
}

/**
 * Función principal para procesar los 6 excels y generar el libro unificado
 * @param {object} files - Rutas a los archivos subidos
 * @param {number} semanaNum - Número de semana
 * @param {string} outputPath - Ruta de destino para guardar el excel
 * @returns {object} Resumen de datos para los widgets del frontend e informe
 */
export function processKpiExcels(files, semanaNum, outputPath) {
  console.log(`[ExcelProcessor] Procesando semana ${semanaNum}...`);

  // 1. Cargar "Data" raw
  const wbData = readExcelOrMhtmlFile(files.data);
  const shData = wbData.Sheets[wbData.SheetNames[0]];
  const rawDataRows = XLSX.utils.sheet_to_json(shData, { header: 1 });
  
  // Construir mapa Orden -> Grupo Planificación
  // Basado en: Orden (columna index 4), Grupo planificación (columna index 0 o 5)
  const dataMap = new Map();
  if (rawDataRows.length > 1) {
    const headers = rawDataRows[0];
    const ordenIdx = headers.findIndex(h => String(h).toLowerCase().trim() === 'orden');
    const grupoIdx = headers.findIndex(h => String(h).toLowerCase().trim() === 'grupo planificación');
    
    // Fallback a indices estáticos si no se encuentran por nombre
    const finalOrdenIdx = ordenIdx !== -1 ? ordenIdx : 4;
    const finalGrupoIdx = grupoIdx !== -1 ? grupoIdx : 0;
    
    for (let i = 1; i < rawDataRows.length; i++) {
      const row = rawDataRows[i];
      if (row && row[finalOrdenIdx]) {
        dataMap.set(String(row[finalOrdenIdx]).trim(), String(row[finalGrupoIdx] || '').trim());
      }
    }
  }
  console.log(`[ExcelProcessor] Data map construido con ${dataMap.size} órdenes.`);

  // 2. Avisos Pendientes
  // Procesa la hoja omitiendo las filas 1 y 2, renombrando y estructurando las columnas indicadas
  const wbAvisos = readExcelOrMhtmlFile(files.avisos);
  const shAvisos = wbAvisos.Sheets[wbAvisos.SheetNames[0]];
  const rawAvisosRows = XLSX.utils.sheet_to_json(shAvisos, { header: 1 });
  
  // Copia desde fila 3 (index 2) para ignorar las primeras 2 filas
  const avisosRows = rawAvisosRows.slice(2);
  if (avisosRows.length > 0) {
    const headers = avisosRows[0];
    headers[5] = "Txt. Breve";
    headers[11] = "Gr.Planif"; // Renombrado sin espacio según especificación
    headers[13] = "Columna3"; // Reemplazado 'Denom' por 'Columna3'
    headers[15] = "Pto. Trabajo";
    headers[16] = "Número de avisos pendientes"; // Nueva columna añadida al final
    
    for (let i = 1; i < avisosRows.length; i++) {
      const row = avisosRows[i];
      if (row) {
        if (row[11]) row[11] = String(row[11]).replace('CH01/', '');
        if (row[15]) row[15] = String(row[15]).replace('CH01/', '');
        // Forzar valor de 1 en la nueva columna para facilitar sumas y conteos de avisos pendientes
        row[16] = 1;
      }
    }
  }

  // 3. Órdenes Pendientes
  const wbOrdenes = readExcelOrMhtmlFile(files.ordenes);
  const shOrdenes = wbOrdenes.Sheets[wbOrdenes.SheetNames[0]];
  const rawOrdenesRows = XLSX.utils.sheet_to_json(shOrdenes, { header: 1 });
  
  // Copia desde fila 3 (index 2)
  const ordenesRows = rawOrdenesRows.slice(2);
  if (ordenesRows.length > 0) {
    const headers = ordenesRows[0];
    headers[1] = "Gr. Planif";
    headers[6] = "Txt. Breve";
    headers[12] = "Pto. Trabajo";
    
    for (let i = 1; i < ordenesRows.length; i++) {
      const row = ordenesRows[i];
      if (row) {
        if (row[1]) row[1] = String(row[1]).replace('CH01/', '');
        if (row[6]) row[6] = String(row[6]).replace('CH01/', '');
        if (row[12]) row[12] = String(row[12]).replace('CH01/', '');
      }
    }
  }

  // 4. % Trabajo Planificado
  const wbTP = readExcelOrMhtmlFile(files.trabajoPlanificado);
  const shTP = wbTP.Sheets[wbTP.SheetNames[0]];
  const rawTPRows = XLSX.utils.sheet_to_json(shTP, { header: 1 });
  
  let tpRows = [];
  if (rawTPRows.length > 1) {
    // Copiar encabezados N:P (13 a 15) de fila 1 a fila 2
    rawTPRows[1][13] = rawTPRows[0][13];
    rawTPRows[1][14] = rawTPRows[0][14];
    rawTPRows[1][15] = rawTPRows[0][15];
    
    // Eliminar fila 1 (index 0)
    const tpRawSliced = rawTPRows.slice(1);
    
    // Filtrar filas con "Resultado" en columna D (index 3)
    tpRows = tpRawSliced.filter((row, idx) => idx === 0 || String(row[3] || '').trim() !== 'Resultado');
    
    if (tpRows.length > 0) {
      const headers = tpRows[0];
      headers[5] = "Pto. trabajo";
      headers[7] = "Txt. breve";
      
      // Reemplazar CH01/ en F (index 5) y meter nuevas columnas I, J (8, 9)
      for (let i = 1; i < tpRows.length; i++) {
        const row = tpRows[i];
        if (row) {
          if (row[5]) row[5] = String(row[5]).replace('CH01/', '');
          
          // Insertar 2 elementos en index 8 y 9
          row.splice(8, 0, undefined, undefined);
          
          // Orden de mantenimiento ahora está en index 10 (antes 8)
          const ordenMantenimiento = String(row[10] || '').trim();
          const grPlanif = dataMap.get(ordenMantenimiento) || 'Código no encontrado';
          row[8] = grPlanif;
          row[9] = planningGroupMap[grPlanif] || 'Código no encontrado';
        }
      }
      
      // Ajustar headers por inserción
      headers.splice(8, 0, "Gr. planif", "Gr. planif.PM");
      
      // Agregar columna Criterio al final (index 21)
      headers[21] = "Criterio";
      
      for (let i = 1; i < tpRows.length; i++) {
        const row = tpRows[i];
        if (row) {
          // % Planificado (HH) es index 18, HH Plan. Reales es index 19
          const val18 = row[18];
          const val19 = row[19];
          const val14 = String(row[14] || '').trim(); // Horizonte (O, index 14)
          
          let criterio = "Planificado";
          if ((val18 === undefined || val18 === null || val18 === '') && 
              (val19 === undefined || val19 === null || val19 === '')) {
            criterio = "Imprevistos";
          } else if (val14 === "#") {
            criterio = "Sin HR";
          }
          
          row[21] = criterio;
        }
      }
    }
  }

  // 5. Programa Semanal
  const wbProg = readExcelOrMhtmlFile(files.programaSemanal);
  const shProg = wbProg.Sheets[wbProg.SheetNames[0]];
  const rawProgRows = XLSX.utils.sheet_to_json(shProg, { header: 1 });
  const progRows = rawProgRows.slice(2); // Omitir filas 1 y 2

  // 6. Plan Matriz
  const wbMatriz = readExcelOrMhtmlFile(files.planMatriz);
  const shMatriz = wbMatriz.Sheets[wbMatriz.SheetNames[0]];
  const rawMatrizRows = XLSX.utils.sheet_to_json(shMatriz, { header: 1 });
  const matrizRows = rawMatrizRows.slice(2);

  // Extraer porcentajes totales reales de cumplimiento
  const totalTPCumplimientoValue = extractTotalPercentage(rawTPRows, 2);
  const totalProgCumplimientoValue = extractTotalPercentage(rawProgRows, 4);
  const totalMatrizCumplimientoValue = extractTotalPercentage(rawMatrizRows, 2);

  // ==========================================
  // GENERAR LA TABLA SUMMARY
  // ==========================================
  const tablaRows = [];

  // Helper para normalizar nombres de procesos/grupos
  const getSafeProceso = (p) => {
    const name = String(p || '').trim();
    if (!name) return 'Sin asignar / Otros';
    return formatProcesoName(name);
  };

  // --- AVISOS PENDIENTES SUMMARY ---
  // Genera la tabla resumen dinámica para los Avisos Pendientes con las columnas del reporte visual
  tablaRows.push([ 'Avisos Pendientes' ]);
  tablaRows.push([ 'Proceso', 'Gr.Plani', 'Gr.planif.PM', 'Avisos' ]);
  
  const groupAvisos = {};
  let totalAvisosCount = 0;
  
  if (avisosRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < avisosRows.length; i++) {
      const row = avisosRows[i];
      if (row && row[4]) { // row[4] es Aviso
        let procesoRaw = String(row[2] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[11] || '').trim() || 'N/A';
        const grPlanifPM = String(row[10] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        groupAvisos[key] = (groupAvisos[key] || 0) + 1;
        totalAvisosCount++;
      }
    }
  }
  
  Object.keys(groupAvisos).sort().forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    tablaRows.push([ proceso, grPlanif, grPlanifPM, groupAvisos[key] ]);
  });
  tablaRows.push([ 'Total general', null, null, totalAvisosCount ]);
  tablaRows.push([]);
  tablaRows.push([]);

  // --- ÓRDENES PENDIENTES SUMMARY ---
  tablaRows.push([ 'Órdenes Pendientes' ]);
  tablaRows.push([ 'Proceso', 'Gr. Planif', 'Gr.planif.PM', 'Órdenes' ]);
  
  const groupOrdenes = {};
  let totalOrdenesCount = 0;
  
  if (ordenesRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < ordenesRows.length; i++) {
      const row = ordenesRows[i];
      if (row && row[5]) { // row[5] es Orden mantenimiento
        let procesoRaw = String(row[3] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[1] || '').trim() || 'N/A';
        const grPlanifPM = String(row[0] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        groupOrdenes[key] = (groupOrdenes[key] || 0) + 1;
        totalOrdenesCount++;
      }
    }
  }
  
  Object.keys(groupOrdenes).sort().forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    tablaRows.push([ proceso, grPlanif, grPlanifPM, groupOrdenes[key] ]);
  });
  tablaRows.push([ 'Total general', null, null, totalOrdenesCount ]);
  tablaRows.push([]);
  tablaRows.push([]);

  // --- % TRABAJO PLANIFICADO SUMMARY ---
  tablaRows.push([ '% Trabajo Planificado' ]);
  tablaRows.push([ 'Suma de HH Totales Reales', null, null, 'Criterio', null, null, null, null ]);
  tablaRows.push([ 'Proceso', 'Gr. planif', 'Gr. planif.PM', 'Planificado', 'Sin HR', 'Imprevistos', 'Total general', 'Cumplimiento' ]);
  
  const groupTP = {};
  let totalTPPlanificado = 0;
  let totalTPSinHR = 0;
  let totalTPImprevistos = 0;
  let totalTPTotal = 0;
  
  if (tpRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < tpRows.length; i++) {
      const row = tpRows[i];
      if (row) {
        let procesoRaw = String(row[2] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[8] || '').trim() || 'N/A';
        const grPlanifPM = String(row[9] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        const hhReal = Number(row[20] || 0); // HH Totales Reales
        const criterio = String(row[21] || 'Planificado').trim();
        
        if (!groupTP[key]) {
          groupTP[key] = { planificado: 0, sinHr: 0, imprevistos: 0 };
        }
        
        if (criterio === "Planificado") {
          groupTP[key].planificado += hhReal;
          totalTPPlanificado += hhReal;
        } else if (criterio === "Sin HR") {
          groupTP[key].sinHr += hhReal;
          totalTPSinHR += hhReal;
        } else if (criterio === "Imprevistos") {
          groupTP[key].imprevistos += hhReal;
          totalTPImprevistos += hhReal;
        }
        totalTPTotal += hhReal;
      }
    }
  }
  
  Object.keys(groupTP).sort().forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { planificado, sinHr, imprevistos } = groupTP[key];
    const rowTotal = planificado + sinHr + imprevistos;
    const cumplimiento = rowTotal > 0 ? (planificado / rowTotal) : 0;
    
    tablaRows.push([
      proceso, 
      grPlanif, 
      grPlanifPM, 
      planificado || null, 
      sinHr || null, 
      imprevistos || null, 
      rowTotal, 
      cumplimiento
    ]);
  });
  
  const totalTPCumplimiento = totalTPTotal > 0 ? (totalTPPlanificado / totalTPTotal) : 0;
  tablaRows.push([
    'Total general',
    null,
    null,
    totalTPPlanificado,
    totalTPSinHR || null,
    totalTPImprevistos,
    totalTPTotal,
    totalTPCumplimiento
  ]);
  tablaRows.push([]);
  tablaRows.push([]);

  // --- PROGRAMA SEMANAL SUMMARY ---
  tablaRows.push([ 'Programa Semanal' ]);
  tablaRows.push([ 'Suma de Total Op. Programadas', null, null, 'Criterio', null, null, null ]);
  tablaRows.push([ 'Proceso', 'Gr.planif', 'Gr.planif.PM', 'Cumple', 'No Cumple', 'Total general', '% Cumplimiento' ]);
  
  const groupProg = {};
  let totalProgCumple = 0;
  let totalProgNoCumple = 0;
  let totalProgTotal = 0;
  let totalProgIndicadorCumple = 0;
  
  if (progRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < progRows.length; i++) {
      const row = progRows[i];
      if (row) {
        let procesoRaw = String(row[4] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[1] || '').trim() || 'N/A';
        const grPlanifPM = String(row[0] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        const totalOp = Number(row[16] || 0); // Total Op. Programadas
        const indCumple = Number(row[15] || 0); // Indicador cumple sem
        const criterio = String(row[17] || 'Cumple').trim();
        
        if (!groupProg[key]) {
          groupProg[key] = { cumple: 0, noCumple: 0, sumTotalOp: 0, sumIndicadorCumple: 0 };
        }
        
        if (criterio === "Cumple") {
          groupProg[key].cumple += totalOp;
          totalProgCumple += totalOp;
        } else {
          groupProg[key].noCumple += totalOp;
          totalProgNoCumple += totalOp;
        }
        
        groupProg[key].sumTotalOp += totalOp;
        groupProg[key].sumIndicadorCumple += indCumple;
        
        totalProgTotal += totalOp;
        totalProgIndicadorCumple += indCumple;
      }
    }
  }
  
  Object.keys(groupProg).sort().forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { cumple, noCumple, sumTotalOp, sumIndicadorCumple } = groupProg[key];
    const cumplimiento = sumTotalOp > 0 ? (sumIndicadorCumple / sumTotalOp) : 0;
    
    tablaRows.push([
      proceso,
      grPlanif,
      grPlanifPM,
      cumple || null,
      noCumple || null,
      sumTotalOp,
      cumplimiento
    ]);
  });
  
  const totalProgCumplimiento = totalProgTotal > 0 ? (totalProgIndicadorCumple / totalProgTotal) : 0;
  tablaRows.push([
    'Total general',
    null,
    null,
    totalProgCumple,
    totalProgNoCumple || null,
    totalProgTotal,
    totalProgCumplimiento
  ]);
  tablaRows.push([]);
  tablaRows.push([]);

  // --- PLAN MATRIZ SUMMARY ---
  tablaRows.push([ 'Plan Matriz' ]);
  tablaRows.push([ 'Suma de Cantidad de Operaciones totales', null, null, 'Criterio', null, null, null ]);
  tablaRows.push([ 'Proceso', 'Gr.planif', 'Gr.planif.PM', 'Cumple', 'No Cumple', 'Total general', '% Cumplimiento' ]);
  
  const groupMatriz = {};
  let totalMatrizCumple = 0;
  let totalMatrizNoCumple = 0;
  let totalMatrizTotal = 0;
  let totalMatrizEjecutadas = 0;
  
  if (matrizRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < matrizRows.length; i++) {
      const row = matrizRows[i];
      if (row) {
        let procesoRaw = String(row[2] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[5] || '').trim() || 'N/A';
        const grPlanifPM = String(row[4] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        const totalOps = Number(row[18] || 0); // Cantidad de Operaciones totales
        const ejecutadas = Number(row[17] || 0); // Cantidad de Operaciones Ejecutadas
        const criterio = String(row[19] || 'Cumple').trim();
        
        if (!groupMatriz[key]) {
          groupMatriz[key] = { cumple: 0, noCumple: 0, sumTotales: 0, sumEjecutadas: 0 };
        }
        
        if (criterio === "Cumple") {
          groupMatriz[key].cumple += totalOps;
          totalMatrizCumple += totalOps;
        } else {
          groupMatriz[key].noCumple += totalOps;
          totalMatrizNoCumple += totalOps;
        }
        
        groupMatriz[key].sumTotales += totalOps;
        groupMatriz[key].sumEjecutadas += ejecutadas;
        
        totalMatrizTotal += totalOps;
        totalMatrizEjecutadas += ejecutadas;
      }
    }
  }
  
  Object.keys(groupMatriz).sort().forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { cumple, noCumple } = groupMatriz[key];
    const totalOpsGrupo = cumple + noCumple;
    const cumplimiento = totalOpsGrupo > 0 ? (cumple / totalOpsGrupo) : 0;
    
    tablaRows.push([
      proceso,
      grPlanif,
      grPlanifPM,
      cumple || null,
      noCumple || null,
      totalOpsGrupo,
      cumplimiento
    ]);
  });
  
  const totalMatrizTotalCalculado = totalMatrizCumple + totalMatrizNoCumple;
  // Se calcula el porcentaje dividiendo cumple por total general de manera matemática directa, sin priorizar el excel
  const totalMatrizCumplimiento = totalMatrizTotalCalculado > 0 ? (totalMatrizCumple / totalMatrizTotalCalculado) : 0;
  
  tablaRows.push([
    'Total general',
    null,
    null,
    totalMatrizCumple,
    totalMatrizNoCumple || null,
    totalMatrizTotalCalculado,
    totalMatrizCumplimiento
  ]);

  // ==========================================
  // COMPILAR Y ESCRIBIR EL WORKBOOK FINAL
  // Genera las hojas del libro unificado de KPI y configura propiedades avanzadas como filtros nativos
  // ==========================================
  const wbDest = XLSX.utils.book_new();

  // Agregar hojas
  XLSX.utils.book_append_sheet(wbDest, XLSX.utils.aoa_to_sheet(rawDataRows), "Data");
  
  const shTabla = XLSX.utils.aoa_to_sheet(tablaRows);
  // Habilitar filtros nativos de Excel en las cabeceras de la tabla resumen de la hoja Tabla
  shTabla['!autofilter'] = { ref: `A2:D${tablaRows.length}` };
  XLSX.utils.book_append_sheet(wbDest, shTabla, "Tabla");
  
  const shAvisosDest = XLSX.utils.aoa_to_sheet(avisosRows);
  // Convertir la información de avisos en tabla activando filtros automáticos nativos de Excel
  if (avisosRows.length > 0) {
    shAvisosDest['!autofilter'] = { ref: `A1:Q${avisosRows.length}` };
  }
  XLSX.utils.book_append_sheet(wbDest, shAvisosDest, "Avisos Pendientes");
  
  XLSX.utils.book_append_sheet(wbDest, XLSX.utils.aoa_to_sheet(ordenesRows), "Órdenes Pendientes");
  XLSX.utils.book_append_sheet(wbDest, XLSX.utils.aoa_to_sheet(tpRows), "% Trabajo Planificado");
  XLSX.utils.book_append_sheet(wbDest, XLSX.utils.aoa_to_sheet(progRows), "Programa Semanal");
  XLSX.utils.book_append_sheet(wbDest, XLSX.utils.aoa_to_sheet(matrizRows), "Plan Matriz");

  // Guardar archivo final
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  XLSX.writeFile(wbDest, outputPath);
  console.log(`[ExcelProcessor] Archivo excel KPI generado con éxito en: ${outputPath}`);

  // ==========================================
  // RETORNAR RESUMEN PARA EL REPORT/EMAIL
  // ==========================================
  
  // NOTA: Se eliminó el procesamiento antiguo de distribuciones fijas y descriptores simplificados
  // para utilizar directamente la agrupación dinámica de groupAvisos y groupOrdenes.

  // Cumplimiento Trabajo Planificado por grupo para el widget
  const cumpTrabajoPlanificado = [];
  Object.keys(groupTP).forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { planificado, sinHr, imprevistos } = groupTP[key];
    const totalRow = planificado + sinHr + imprevistos;
    const cump = totalRow > 0 ? (planificado / totalRow) : 0;
    
    cumpTrabajoPlanificado.push({
      proceso: proceso,
      grPlanif: grPlanif,
      grPlanifPM: grPlanifPM,
      planificado,
      sinHr,
      imprevistos,
      total: totalRow,
      cumplimiento: cump
    });
  });

  // Programa Semanal por grupo para el widget
  const cumpProgramaSemanal = [];
  Object.keys(groupProg).forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { cumple, noCumple, sumTotalOp, sumIndicadorCumple } = groupProg[key];
    const cump = sumTotalOp > 0 ? (sumIndicadorCumple / sumTotalOp) : 0;
    
    cumpProgramaSemanal.push({
      proceso: proceso,
      grPlanif: grPlanif,
      grPlanifPM: grPlanifPM,
      cumple,
      noCumple,
      total: sumTotalOp,
      cumplimiento: cump
    });
  });

  // Plan Matriz por grupo para el widget
  const cumpPlanMatriz = [];
  Object.keys(groupMatriz).forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { cumple, noCumple } = groupMatriz[key];
    const totalOpsGrupo = cumple + noCumple;
    const cump = totalOpsGrupo > 0 ? (cumple / totalOpsGrupo) : 0;
    
    cumpPlanMatriz.push({
      proceso: proceso,
      grPlanif: grPlanif,
      grPlanifPM: grPlanifPM,
      cumple,
      noCumple,
      total: totalOpsGrupo,
      cumplimiento: cump
    });
  });

  return {
    semana: semanaNum,
    indicadores: {
      avisosPendientes: totalAvisosCount,
      ordenesPendientes: totalOrdenesCount,
      trabajoPlanificado: Math.round((totalTPCumplimientoValue !== null ? totalTPCumplimientoValue : totalTPCumplimiento) * 100),
      programaSemanal: Math.round((totalProgCumplimientoValue !== null ? totalProgCumplimientoValue : totalProgCumplimiento) * 100),
      planMatriz: Math.round(totalMatrizCumplimiento * 100)
    },
    resumenAvisos: {
      total: totalAvisosCount,
      distribucion: Object.keys(groupAvisos).sort().map(key => {
        const [proceso, grPlanif, grPlanifPM] = key.split('||');
        return { proceso, grPlanif, grPlanifPM, cantidad: groupAvisos[key] };
      })
    },
    resumenOrdenes: {
      total: totalOrdenesCount,
      distribucion: Object.keys(groupOrdenes).sort().map(key => {
        const [proceso, grPlanif, grPlanifPM] = key.split('||');
        return { proceso, grPlanif, grPlanifPM, cantidad: groupOrdenes[key] };
      })
    },
    trabajoPlanificado: {
      grupos: cumpTrabajoPlanificado,
      total: {
        planificado: totalTPPlanificado,
        sinHr: totalTPSinHR,
        imprevistos: totalTPImprevistos,
        total: totalTPTotal,
        cumplimiento: totalTPCumplimientoValue !== null ? totalTPCumplimientoValue : totalTPCumplimiento
      }
    },
    programaSemanal: {
      grupos: cumpProgramaSemanal,
      total: {
        cumple: totalProgCumple,
        noCumple: totalProgNoCumple,
        total: totalProgTotal,
        cumplimiento: totalProgCumplimientoValue !== null ? totalProgCumplimientoValue : totalProgCumplimiento
      }
    },
    planMatriz: {
      grupos: cumpPlanMatriz,
      total: {
        cumple: totalMatrizCumple,
        noCumple: totalMatrizNoCumple,
        total: totalMatrizTotal,
        cumplimiento: totalMatrizCumplimiento
      }
    }
  };
}

/**
 * Procesa un archivo Excel Consolidado (Listo) para extraer los datos de KPIs
 * @param {string} filePath - Ruta al archivo Excel
 * @param {number} semanaNum - Número de semana
 */
export function processReadyExcel(filePath, semanaNum) {
  console.log(`[ExcelProcessor] Procesando Excel Listo semana ${semanaNum}...`);
  
  const wb = XLSX.readFile(filePath);
  
  // Extraer los porcentajes de totales reales de las hojas
  const rawTPRows = wb.SheetNames.includes("% Trabajo Planificado") ? XLSX.utils.sheet_to_json(wb.Sheets["% Trabajo Planificado"], { header: 1 }) : [];
  const rawProgRows = wb.SheetNames.includes("Programa Semanal") ? XLSX.utils.sheet_to_json(wb.Sheets["Programa Semanal"], { header: 1 }) : [];
  const rawMatrizRows = wb.SheetNames.includes("Plan Matriz") ? XLSX.utils.sheet_to_json(wb.Sheets["Plan Matriz"], { header: 1 }) : [];
  
  const totalTPCumplimientoValue = extractTotalPercentage(rawTPRows, 2);
  const totalProgCumplimientoValue = extractTotalPercentage(rawProgRows, 4);
  const totalMatrizCumplimientoValue = extractTotalPercentage(rawMatrizRows, 2);

  // Helper para normalizar nombres de procesos/grupos
  const getSafeProceso = (p) => {
    const name = String(p || '').trim();
    if (!name) return 'Sin asignar / Otros';
    return formatProcesoName(name);
  };

  // --- Avisos Pendientes ---
  let avisosRows = [];
  if (wb.SheetNames.includes("Avisos Pendientes")) {
    avisosRows = XLSX.utils.sheet_to_json(wb.Sheets["Avisos Pendientes"], { header: 1 });
  } else if (wb.SheetNames.includes("Avisos")) {
    avisosRows = XLSX.utils.sheet_to_json(wb.Sheets["Avisos"], { header: 1 });
  }

  // Agrupar avisos por Proceso, Gr.Planif (col 11) y Gr.planif.PM (col 10)
  const groupAvisos = {};
  let totalAvisosCount = 0;

  if (avisosRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < avisosRows.length; i++) {
      const row = avisosRows[i];
      if (row && row[4]) { // col 4 = Aviso
        let procesoRaw = String(row[2] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[11] || '').trim() || 'N/A';
        const grPlanifPM = String(row[10] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        groupAvisos[key] = (groupAvisos[key] || 0) + 1;
        totalAvisosCount++;
      }
    }
  }

  // --- Órdenes Pendientes ---
  let ordenesRows = [];
  if (wb.SheetNames.includes("Órdenes Pendientes")) {
    ordenesRows = XLSX.utils.sheet_to_json(wb.Sheets["Órdenes Pendientes"], { header: 1 });
  } else if (wb.SheetNames.includes("Ordenes Pendientes")) {
    ordenesRows = XLSX.utils.sheet_to_json(wb.Sheets["Ordenes Pendientes"], { header: 1 });
  }

  // Agrupar órdenes por Proceso, Gr.Planif (col 1) y Gr.planif.PM (col 0)
  const groupOrdenes = {};
  let totalOrdenesCount = 0;

  if (ordenesRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < ordenesRows.length; i++) {
      const row = ordenesRows[i];
      if (row && row[5]) { // col 5 = Orden mantenimiento
        let procesoRaw = String(row[3] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[1] || '').trim() || 'N/A';
        const grPlanifPM = String(row[0] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        groupOrdenes[key] = (groupOrdenes[key] || 0) + 1;
        totalOrdenesCount++;
      }
    }
  }

  // --- % Trabajo Planificado ---
  let tpRows = [];
  if (wb.SheetNames.includes("% Trabajo Planificado")) {
    tpRows = XLSX.utils.sheet_to_json(wb.Sheets["% Trabajo Planificado"], { header: 1 });
  }

  const groupTP = {};
  let totalTPPlanificado = 0;
  let totalTPSinHR = 0;
  let totalTPImprevistos = 0;
  let totalTPTotal = 0;

  if (tpRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < tpRows.length; i++) {
      const row = tpRows[i];
      if (row) {
        let procesoRaw = String(row[2] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[8] || '').trim() || 'N/A';
        const grPlanifPM = String(row[9] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        const hhReal = Number(row[20] || 0);
        const criterio = String(row[21] || 'Planificado').trim();
        
        if (!groupTP[key]) {
          groupTP[key] = { planificado: 0, sinHr: 0, imprevistos: 0 };
        }
        
        if (criterio === "Planificado") {
          groupTP[key].planificado += hhReal;
          totalTPPlanificado += hhReal;
        } else if (criterio === "Sin HR") {
          groupTP[key].sinHr += hhReal;
          totalTPSinHR += hhReal;
        } else if (criterio === "Imprevistos") {
          groupTP[key].imprevistos += hhReal;
          totalTPImprevistos += hhReal;
        }
        totalTPTotal += hhReal;
      }
    }
  }

  const totalTPCumplimiento = totalTPTotal > 0 ? (totalTPPlanificado / totalTPTotal) : 0;
  const cumpTrabajoPlanificado = [];
  Object.keys(groupTP).forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { planificado, sinHr, imprevistos } = groupTP[key];
    const totalRow = planificado + sinHr + imprevistos;
    const cump = totalRow > 0 ? (planificado / totalRow) : 0;
    
    cumpTrabajoPlanificado.push({
      proceso: proceso,
      grPlanif: grPlanif,
      grPlanifPM: grPlanifPM,
      planificado,
      sinHr,
      imprevistos,
      total: totalRow,
      cumplimiento: cump
    });
  });

  // --- Programa Semanal ---
  let progRows = [];
  if (wb.SheetNames.includes("Programa Semanal")) {
    progRows = XLSX.utils.sheet_to_json(wb.Sheets["Programa Semanal"], { header: 1 });
  }

  const groupProg = {};
  let totalProgCumple = 0;
  let totalProgNoCumple = 0;
  let totalProgTotal = 0;
  let totalProgIndicadorCumple = 0;

  if (progRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < progRows.length; i++) {
      const row = progRows[i];
      if (row) {
        let procesoRaw = String(row[4] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[1] || '').trim() || 'N/A';
        const grPlanifPM = String(row[0] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        const totalOp = Number(row[16] || 0);
        const indCumple = Number(row[15] || 0);
        const criterio = String(row[17] || 'Cumple').trim();
        
        if (!groupProg[key]) {
          groupProg[key] = { cumple: 0, noCumple: 0, sumTotalOp: 0, sumIndicadorCumple: 0 };
        }
        
        if (criterio === "Cumple") {
          groupProg[key].cumple += totalOp;
          totalProgCumple += totalOp;
        } else {
          groupProg[key].noCumple += totalOp;
          totalProgNoCumple += totalOp;
        }
        
        groupProg[key].sumTotalOp += totalOp;
        groupProg[key].sumIndicadorCumple += indCumple;
        
        totalProgTotal += totalOp;
        totalProgIndicadorCumple += indCumple;
      }
    }
  }

  const totalProgCumplimiento = totalProgTotal > 0 ? (totalProgIndicadorCumple / totalProgTotal) : 0;
  const cumpProgramaSemanal = [];
  Object.keys(groupProg).forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { cumple, noCumple, sumTotalOp, sumIndicadorCumple } = groupProg[key];
    const cump = sumTotalOp > 0 ? (sumIndicadorCumple / sumTotalOp) : 0;
    
    cumpProgramaSemanal.push({
      proceso: proceso,
      grPlanif: grPlanif,
      grPlanifPM: grPlanifPM,
      cumple,
      noCumple,
      total: sumTotalOp,
      cumplimiento: cump
    });
  });

  // --- Plan Matriz ---
  let matrizRows = [];
  if (wb.SheetNames.includes("Plan Matriz")) {
    matrizRows = XLSX.utils.sheet_to_json(wb.Sheets["Plan Matriz"], { header: 1 });
  }

  const groupMatriz = {};
  let totalMatrizCumple = 0;
  let totalMatrizNoCumple = 0;
  let totalMatrizTotal = 0;
  let totalMatrizEjecutadas = 0;

  if (matrizRows.length > 1) {
    let lastProceso = '';
    for (let i = 1; i < matrizRows.length; i++) {
      const row = matrizRows[i];
      if (row) {
        let procesoRaw = String(row[2] || '').trim();
        if (procesoRaw) {
          lastProceso = procesoRaw;
        } else {
          procesoRaw = lastProceso;
        }
        const proceso = getSafeProceso(procesoRaw);
        const grPlanif = String(row[5] || '').trim() || 'N/A';
        const grPlanifPM = String(row[4] || '').trim() || 'N/A';
        if (isTotalOrInvalidRow(proceso, grPlanif, grPlanifPM)) {
          continue;
        }
        const key = `${proceso}||${grPlanif}||${grPlanifPM}`;
        
        const totalOps = Number(row[18] || 0);
        const ejecutadas = Number(row[17] || 0);
        const criterio = String(row[19] || 'Cumple').trim();
        
        if (!groupMatriz[key]) {
          groupMatriz[key] = { cumple: 0, noCumple: 0, sumTotales: 0, sumEjecutadas: 0 };
        }
        
        if (criterio === "Cumple") {
          groupMatriz[key].cumple += totalOps;
          totalMatrizCumple += totalOps;
        } else {
          groupMatriz[key].noCumple += totalOps;
          totalMatrizNoCumple += totalOps;
        }
        
        groupMatriz[key].sumTotales += totalOps;
        groupMatriz[key].sumEjecutadas += ejecutadas;
        
        totalMatrizTotal += totalOps;
        totalMatrizEjecutadas += ejecutadas;
      }
    }
  }

  const totalMatrizTotalCalculado = totalMatrizCumple + totalMatrizNoCumple;
  // Se calcula el porcentaje dividiendo cumple por total general de manera matemática directa, sin priorizar el excel
  const totalMatrizCumplimiento = totalMatrizTotalCalculado > 0 ? (totalMatrizCumple / totalMatrizTotalCalculado) : 0;
  
  const cumpPlanMatriz = [];
  Object.keys(groupMatriz).forEach(key => {
    const [proceso, grPlanif, grPlanifPM] = key.split('||');
    const { cumple, noCumple } = groupMatriz[key];
    const totalOpsGrupo = cumple + noCumple;
    const cump = totalOpsGrupo > 0 ? (cumple / totalOpsGrupo) : 0;
    
    cumpPlanMatriz.push({
      proceso: proceso,
      grPlanif: grPlanif,
      grPlanifPM: grPlanifPM,
      cumple,
      noCumple,
      total: totalOpsGrupo,
      cumplimiento: cump
    });
  });

  return {
    semana: semanaNum,
    indicadores: {
      avisosPendientes: totalAvisosCount,
      ordenesPendientes: totalOrdenesCount,
      trabajoPlanificado: Math.round((totalTPCumplimientoValue !== null ? totalTPCumplimientoValue : totalTPCumplimiento) * 100),
      programaSemanal: Math.round((totalProgCumplimientoValue !== null ? totalProgCumplimientoValue : totalProgCumplimiento) * 100),
      planMatriz: Math.round(totalMatrizCumplimiento * 100)
    },
    resumenAvisos: {
      total: totalAvisosCount,
      distribucion: Object.keys(groupAvisos).sort().map(key => {
        const [proceso, grPlanif, grPlanifPM] = key.split('||');
        return { proceso, grPlanif, grPlanifPM, cantidad: groupAvisos[key] };
      })
    },
    resumenOrdenes: {
      total: totalOrdenesCount,
      distribucion: Object.keys(groupOrdenes).sort().map(key => {
        const [proceso, grPlanif, grPlanifPM] = key.split('||');
        return { proceso, grPlanif, grPlanifPM, cantidad: groupOrdenes[key] };
      })
    },
    trabajoPlanificado: {
      grupos: cumpTrabajoPlanificado,
      total: {
        planificado: totalTPPlanificado,
        sinHr: totalTPSinHR,
        imprevistos: totalTPImprevistos,
        total: totalTPTotal,
        cumplimiento: totalTPCumplimientoValue !== null ? totalTPCumplimientoValue : totalTPCumplimiento
      }
    },
    programaSemanal: {
      grupos: cumpProgramaSemanal,
      total: {
        cumple: totalProgCumple,
        noCumple: totalProgNoCumple,
        total: totalProgTotal,
        cumplimiento: totalProgCumplimientoValue !== null ? totalProgCumplimientoValue : totalProgCumplimiento
      }
    },
    planMatriz: {
      grupos: cumpPlanMatriz,
      total: {
        cumple: totalMatrizCumple,
        noCumple: totalMatrizNoCumple,
        total: totalMatrizTotalCalculado,
        cumplimiento: totalMatrizCumplimiento
      }
    }
  };
}

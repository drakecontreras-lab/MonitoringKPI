import React, { useState, useEffect } from 'react';
import EmailPreview from './EmailPreview';
import SettingsModal from './SettingsModal';
import { createPortal } from 'react-dom';
import KpiDashboardCharts from './KpiDashboardCharts';
import SortableRow from './SortableRow';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// Archivos requeridos para el procesamiento de KPIs
const REQUIRED_FILES = [
  { key: 'avisos', label: '1. Avisos Pendientes', desc: 'Archivo de avisos backlog' },
  { key: 'ordenes', label: '2. Órdenes Pendientes', desc: 'Archivo de órdenes backlog' },
  { key: 'trabajoPlanificado', label: '3. % Trabajo Planificado', desc: 'Horas y criterio de planificación' },
  { key: 'programaSemanal', label: '4. Programa Semanal', desc: 'Cumplimiento semanal' },
  { key: 'planMatriz', label: '5. Plan Matriz', desc: 'Cumplimiento matriz de operaciones' }
];

/**
 * Pestaña KPIs Corporativos.
 * Estado COMPLETAMENTE independiente de ProyeccionesTab.
 * Props recibidas de App.jsx: onOpenSettings, user, defaultSemana, emailSettings, setEmailSettings
 */
export default function KpiCorporativosTab({ onOpenSettings, user, defaultSemana, emailSettings, setEmailSettings }) {
  // ─── Estado KPI ───
  const [kpiSubTab, setKpiSubTab] = useState('visualizacion');
  const [semana, setSemana] = useState(defaultSemana || '23');
  const [uploadMode, setUploadMode] = useState('raw');
  const [isEditing, setIsEditing] = useState(false);
  const [files, setFiles] = useState({
    avisos: null, ordenes: null, trabajoPlanificado: null,
    programaSemanal: null, planMatriz: null, proyOts: null, proy37n: null
  });
  const [filesStatus, setFilesStatus] = useState({});
  const [readyFile, setReadyFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  const [processingSuccess, setProcessingSuccess] = useState(false);
  const [kpiDataOriginal, setKpiDataOriginal] = useState(null);
  const [kpiData, setKpiData] = useState(null);

  const agruparKpiData = (dataOriginal, agruparPorPto) => {
    if (!dataOriginal) return null;
    const newData = JSON.parse(JSON.stringify(dataOriginal));
    newData.use_pto_trabajo = agruparPorPto;

    const agruparArray = (arr, propsNum, isCump = false) => {
      const mapa = {};
      arr.forEach(item => {
        let clave = agruparPorPto 
          ? `${item.proceso}||${item.ptoTrabajo}` 
          : `${item.proceso}||${item.grPlanif}||${item.grPlanifPM}`;
        if (!mapa[clave]) {
          mapa[clave] = { ...item, _rowId: clave };
          propsNum.forEach(p => mapa[clave][p] = 0);
        }
        propsNum.forEach(p => mapa[clave][p] += (Number(item[p]) || 0));
      });
      const res = Object.values(mapa);
      if (isCump) {
        res.forEach(item => {
          if (item.planificado !== undefined) {
             item.total = (item.planificado||0) + (item.sinHr||0) + (item.sinHorizonte||0) + (item.imprevistos||0);
             item.cumplimiento = item.total > 0 ? (item.planificado||0) / item.total : 0;
          } else if (item.cumple !== undefined) {
             item.total = (item.cumple||0) + (item.noCumple||0);
             item.cumplimiento = item.total > 0 ? (item.cumple||0) / item.total : 0;
          }
        });
      }
      return res;
    };

    if (newData.resumenAvisos) {
      newData.resumenAvisos.distribucion = agruparArray(newData.resumenAvisos.distribucion, ['cantidad']);
    }
    if (newData.resumenOrdenes) {
      newData.resumenOrdenes.distribucion = agruparArray(newData.resumenOrdenes.distribucion, ['cantidad']);
    }
    if (newData.trabajoPlanificado) {
      newData.trabajoPlanificado.grupos = agruparArray(newData.trabajoPlanificado.grupos, ['planificado', 'sinHr', 'sinHorizonte', 'imprevistos'], true);
    }
    if (newData.programaSemanal) {
      newData.programaSemanal.grupos = agruparArray(newData.programaSemanal.grupos, ['cumple', 'noCumple'], true);
    }
    if (newData.planMatriz) {
      newData.planMatriz.grupos = agruparArray(newData.planMatriz.grupos, ['cumple', 'noCumple'], true);
    }

    return newData;
  };


  // ─── Estado Robot SAP interno de esta pestaña (AISLADO) ───
  const [kpiRobotRunning, setKpiRobotRunning] = useState(false);
  const [kpiRobotProgress, setKpiRobotProgress] = useState(0.0);
  const [kpiRobotProgressText, setKpiRobotProgressText] = useState('Iniciando...');
  const [kpiRobotLogs, setKpiRobotLogs] = useState([]);
  const [kpiRobotVisor, setKpiRobotVisor] = useState('');
  const [kpiSolicitarMfa, setKpiSolicitarMfa] = useState(false);
  const [kpiMfaCode, setKpiMfaCode] = useState('');
  const [kpiMfaLoading, setKpiMfaLoading] = useState(false);

  // ─── Estado Power BI ───
  const [pbiImage, setPbiImage] = useState(null);
  const [pbiCapturing, setPbiCapturing] = useState(false);
  const [pbiStatus, setPbiStatus] = useState({ progreso: 0, progreso_texto: 'Inactivo', logs: [], visor: '', solicitar_mfa: false });
  const [pbiMfaCode, setPbiMfaCode] = useState('');
  const [pbiMfaLoading, setPbiMfaLoading] = useState(false);
  const [includePowerBI, setIncludePowerBI] = useState(false);

  // ─── Estado Correo ───
  const [recipients, setRecipients] = useState('');
  const [cc, setCc] = useState('');
  const [testRecipients, setTestRecipients] = useState('');
  const [subject, setSubject] = useState('GSYS | Reporte Semanal KPI corporativo');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ success: false, error: '', message: '' });
  const [selectedTemplate, setSelectedTemplate] = useState(7);
  const [usePtoTrabajo, setUsePtoTrabajo] = useState(false);

  const [orgOptions, setOrgOptions] = useState({ divisiones: [], gerencias: [], superintendencias: [] });
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedGerencia, setSelectedGerencia] = useState('');
  const [selectedSuperintendencia, setSelectedSuperintendencia] = useState('');

  // ─── Efectos ───
  useEffect(() => {
    fetch('/api/org-structure')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setOrgOptions(data);
        }
      })
      .catch(e => console.error(e));
  }, []);

  useEffect(() => {
    // Desactivado el auto-completado de destinatarios de prueba
    setTestRecipients('');
  }, [user]);

  useEffect(() => {
    if (defaultSemana) setSemana(defaultSemana);
  }, [defaultSemana]);

  useEffect(() => {
    if (semana) setSubject(`Reporte Semanal KPI - Mantenimiento DCH - Semana ${semana}`);
  }, [semana]);

  // Cargar destinatarios y config de correo desde backend
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.recipients) setRecipients(data.recipients);
        if (data.cc) setCc(data.cc);
        if (data.email_settings) setEmailSettings(prev => ({ ...prev, ...data.email_settings }));
      } catch (e) {}
    };
    cargar();
  }, []);

  // Polling del robot SAP interno de KPIs (AISLADO - usa HUD kpi propio)
  useEffect(() => {
    let interval;
    if (kpiRobotRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/status-modulos');
          const d = await res.json();
          const kpi = d.kpi || {};
          setKpiRobotProgress(kpi.progreso || 0);
          setKpiRobotProgressText(kpi.progreso_texto || 'Inactivo');
          setKpiRobotLogs(kpi.logs || []);
          if (kpi.visor) setKpiRobotVisor(kpi.visor);
          setKpiSolicitarMfa(kpi.solicitar_mfa || false);
          if (!kpi.solicitar_mfa && (kpi.progreso >= 1.0 || kpi.progreso <= 0.0)) {
            setKpiRobotRunning(false);
          }
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [kpiRobotRunning]);

  // Polling Power BI
  useEffect(() => {
    let interval;
    if (pbiCapturing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/status-modulos');
          const d = await res.json();
          setPbiStatus({
            progreso: d.progreso, progreso_texto: d.progreso_texto,
            logs: d.logs || [], visor: d.visor, solicitar_mfa: d.solicitar_mfa
          });
          if (d.progreso >= 1.0) {
            setPbiCapturing(false);
            clearInterval(interval);
            const resImg = await fetch('/api/powerbi/latest');
            const dataImg = await resImg.json();
            if (dataImg.success) { setPbiImage(dataImg.image); setIncludePowerBI(true); }
          } else if (d.progreso <= 0.0) {
            setPbiCapturing(false);
            clearInterval(interval);
            alert('Error al realizar la captura de Power BI.');
          }
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pbiCapturing]);

  // ─── Handlers ───

  const handleFileChange = async (key, file) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [key]: file }));
    setFilesStatus(prev => ({ ...prev, [key]: { loading: true } }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', key);
      const res = await fetch('/api/preview-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setFilesStatus(prev => ({ ...prev, [key]: { rows: data.rows, message: data.message } }));
      } else {
        setFilesStatus(prev => ({ ...prev, [key]: { error: data.error || 'Archivo no reconocido' } }));
      }
    } catch (e) {
      setFilesStatus(prev => ({ ...prev, [key]: { error: 'Error de conexión al previsualizar' } }));
    }
  };

  const handleProcessKpis = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setProcessingError('');
    setProcessingSuccess(false);
    setKpiDataOriginal(null);
    setKpiData(null);
    // Iniciar el polling del robot SAP interno de KPIs (NO toca ProyeccionesTab)
    setKpiRobotRunning(true);
    setKpiRobotProgress(0.05);
    setKpiRobotProgressText('Iniciando...');
    setKpiRobotLogs([]);
    setKpiRobotVisor('');
    setKpiSolicitarMfa(false);

    if (!semana || isNaN(semana) || semana < 1 || semana > 53) {
      setProcessingError('Ingrese un número de semana válido (1 - 53).');
      setProcessing(false);
      setKpiRobotRunning(false);
      return;
    }

    const formData = new FormData();
    formData.append('semana', semana);
    formData.append('use_pto_trabajo', usePtoTrabajo);
    formData.append('division', selectedDivision);
    formData.append('gerencia', selectedGerencia);
    formData.append('superintendencia', selectedSuperintendencia);
    formData.append('user_email', user?.preferred_username || '');

    let url = '/api/process-kpis';

    if (uploadMode === 'ready') {
      if (!readyFile) {
        setProcessingError('Por favor cargue el archivo Excel consolidado.');
        setProcessing(false);
        setKpiRobotRunning(false);
        return;
      }
      formData.append('readyExcel', readyFile);
      url = '/api/process-ready-excel';
    } else {
      const uploadedKeys = REQUIRED_FILES.filter(f => files[f.key]).map(f => f.key);
      if (uploadedKeys.length === 0) {
        setProcessingError('Debe cargar al menos un archivo de KPI.');
        setProcessing(false);
        setKpiRobotRunning(false);
        return;
      }
      uploadedKeys.forEach(key => formData.append(key, files[key]));
      if (files.proyOts) formData.append('proy_ots', files.proyOts);
      if (files.proy37n) formData.append('proy_37n', files.proy37n);
    }

    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Error al procesar en el servidor.');
      setKpiDataOriginal(resData.data);
      setKpiData(agruparKpiData(resData.data, usePtoTrabajo));
      setProcessingSuccess(true);
    } catch (err) {
      setProcessingError(err.message || 'Error de conexión con el backend.');
    } finally {
      setProcessing(false);
      setKpiRobotRunning(false);
    }
  };


  // React to toggle changes
  useEffect(() => {
    if (kpiDataOriginal && !processing) {
       setKpiData(agruparKpiData(kpiDataOriginal, usePtoTrabajo));
    }
  }, [usePtoTrabajo, kpiDataOriginal, processing]);

  const handleCapturePowerBI = async () => {
    setPbiCapturing(true);
    setPbiImage(null);
    setPbiStatus({ progreso: 0.05, progreso_texto: 'Iniciando', logs: [], visor: '', solicitar_mfa: false });
    try {
      const res = await fetch('/api/powerbi/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana: kpiData ? kpiData.semana : semana })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al iniciar la captura.');
    } catch (e) {
      setPbiCapturing(false);
      alert(e.message);
    }
  };

  const enviarMfaSap = async () => {
    if (!kpiMfaCode) return;
    setKpiMfaLoading(true);
    try {
      await fetch('/api/enviar-mfa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: kpiMfaCode, contexto: 'kpi' })
      });
      setKpiMfaCode('');
      setKpiSolicitarMfa(false);
    } catch (e) { alert('Error al enviar código MFA SAP.'); }
    finally { setKpiMfaLoading(false); }
  };

  const enviarMfaPbi = async () => {
    if (!pbiMfaCode) return;
    setPbiMfaLoading(true);
    try {
      await fetch('/api/enviar-mfa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: pbiMfaCode })
      });
      setPbiMfaCode('');
      setPbiStatus(prev => ({ ...prev, solicitar_mfa: false }));
    } catch (e) { alert('Error al enviar código MFA.'); }
    finally { setPbiMfaLoading(false); }
  };

  const handleSendTestEmail = async () => {
    setEmailStatus({ success: false, error: '', message: '' });
    if (!user?.preferred_username) {
      setEmailStatus({ success: false, error: 'Debe iniciar sesión con su cuenta Microsoft.', message: '' });
      return;
    }
    if (!testRecipients) {
      setEmailStatus({ success: false, error: 'Ingrese al menos un destinatario de prueba.', message: '' });
      return;
    }
    setSendingEmail(true);
    try {
      const response = await fetch('/api/send-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: testRecipients, cc: cc,
          subject: subject.startsWith('[PRUEBA]') ? subject : `[PRUEBA] ${subject}`,
          kpiData: kpiData, templateId: selectedTemplate,
          emailSettings: emailSettings, includePowerBI: includePowerBI,
          division: selectedDivision, gerencia: selectedGerencia,
          superintendencia: selectedSuperintendencia, user_email: user?.preferred_username || ''
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Error al enviar correo de prueba.');
      setEmailStatus({ success: true, error: '', message: resData.message });
    } catch (err) {
      setEmailStatus({ success: false, error: err.message || 'Error de envío de prueba.', message: '' });
    } finally { setSendingEmail(false); }
  };

  const handleSendRealEmail = async () => {
    setEmailStatus({ success: false, error: '', message: '' });
    if (!user?.preferred_username) {
      setEmailStatus({ success: false, error: 'Debe iniciar sesión con su cuenta Microsoft.', message: '' });
      return;
    }
    if (!recipients) {
      setEmailStatus({ success: false, error: 'Ingrese al menos un destinatario oficial.', message: '' });
      return;
    }
    setSendingEmail(true);
    try {
      const response = await fetch('/api/send-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: recipients, cc: cc, subject: subject,
          kpiData: kpiData, templateId: selectedTemplate,
          emailSettings: emailSettings, includePowerBI: includePowerBI,
          division: selectedDivision, gerencia: selectedGerencia,
          superintendencia: selectedSuperintendencia, user_email: user?.preferred_username || ''
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Error al enviar correo oficial.');
      setEmailStatus({ success: true, error: '', message: resData.message });
    } catch (err) {
      setEmailStatus({ success: false, error: err.message || 'Error de envío oficial.', message: '' });
    } finally { setSendingEmail(false); }
  };

  const [savingReport, setSavingReport] = useState(false);
  const handleSaveReport = async () => {
    if (!kpiData) return;
    setSavingReport(true);
    try {
      const response = await fetch('/api/save-kpi-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpiData: kpiData,
          division: selectedDivision, gerencia: selectedGerencia,
          superintendencia: selectedSuperintendencia,
          user_email: user?.preferred_username || ''
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Error al guardar.');
      alert(resData.message || 'Reporte guardado en BD correctamente.');
    } catch (err) {
      alert('Error al guardar reporte: ' + (err.message || ''));
    } finally { setSavingReport(false); }
  };

  const handleResetReport = () => {
    if (!window.confirm('¿Reiniciar reporte? Se limpiarán todos los archivos cargados y datos procesados.')) return;
    setFiles({ avisos: null, ordenes: null, trabajoPlanificado: null, programaSemanal: null, planMatriz: null, proyOts: null, proy37n: null });
    setFilesStatus({});
    setReadyFile(null);
    setProcessingError('');
    setProcessingSuccess(false);
    setKpiDataOriginal(null);
    setKpiData(null);
    setKpiRobotRunning(false);
    setKpiRobotProgress(0.0);
    setKpiRobotLogs([]);
    setKpiRobotVisor('');
    setPbiImage(null);
    setIncludePowerBI(false);
  };

  const handleSaveEmailSettings = async () => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: recipients, cc: cc, email_settings: emailSettings })
      });
      const data = await response.json();
      if (response.ok && data.success) alert('Configuración de correo guardada con éxito.');
      else alert('Error al guardar la configuración: ' + (data.error || ''));
    } catch (e) { alert('Error de conexión al guardar configuración.'); }
  };

  // Edición de tablas
  const handleTableChange = (section, idx, field, value) => {
    const newData = JSON.parse(JSON.stringify(kpiData));
    if (section === 'resumenAvisos' || section === 'resumenOrdenes') {
      const group = newData[section].distribucion[idx];
      if (['proceso', 'grPlanif', 'grPlanifPM'].includes(field)) {
        group[field] = value;
      } else {
        group[field] = Math.max(0, Number(value) || 0);
        let sumTotal = 0;
        newData[section].distribucion.forEach(item => { sumTotal += Number(item.cantidad) || 0; });
        newData[section].total = sumTotal;
        const indKey = section === 'resumenAvisos' ? 'avisosPendientes' : 'ordenesPendientes';
        newData.indicadores[indKey] = sumTotal;
      }
    } else {
      const group = newData[section].grupos[idx];
      if (['proceso', 'grPlanif', 'grPlanifPM'].includes(field)) {
        group[field] = value;
      } else if (field === 'cumplimiento') {
        group.cumplimiento = Math.max(0, Number(value) || 0) / 100;
      } else if (field === 'total') {
        group.total = Math.max(0, Number(value) || 0);
      } else {
        group[field] = Math.max(0, Number(value) || 0);
        if (section === 'trabajoPlanificado') {
          group.total = (group.planificado || 0) + (group.sinHr || 0) + (group.sinHorizonte || 0) + (group.imprevistos || 0);
          group.cumplimiento = group.total > 0 ? (group.planificado || 0) / group.total : 0;
        } else {
          group.total = (group.cumple || 0) + (group.noCumple || 0);
          group.cumplimiento = group.total > 0 ? (group.cumple || 0) / group.total : 0;
        }
      }
      if (section === 'trabajoPlanificado') {
        let sumPlan = 0, sumSin = 0, sumSinHor = 0, sumImp = 0, sumTotal = 0;
        newData.trabajoPlanificado.grupos.forEach(g => {
          sumPlan += Number(g.planificado) || 0;
          sumSin += Number(g.sinHr) || 0;
          sumSinHor += Number(g.sinHorizonte) || 0;
          sumImp += Number(g.imprevistos) || 0;
          sumTotal += Number(g.total) || 0;
        });
        newData.trabajoPlanificado.total = { planificado: sumPlan, sinHr: sumSin, sinHorizonte: sumSinHor, imprevistos: sumImp, total: sumTotal, cumplimiento: sumTotal > 0 ? sumPlan / sumTotal : 0 };
        newData.indicadores.trabajoPlanificado = Math.round((sumTotal > 0 ? sumPlan / sumTotal : 0) * 100);
      } else {
        let sumCumple = 0, sumNo = 0, sumTotal = 0;
        newData[section].grupos.forEach(g => {
          sumCumple += Number(g.cumple) || 0;
          sumNo += Number(g.noCumple) || 0;
          sumTotal += Number(g.total) || 0;
        });
        newData[section].total = { cumple: sumCumple, noCumple: sumNo, total: sumTotal, cumplimiento: sumTotal > 0 ? sumCumple / sumTotal : 0 };
        newData.indicadores[section] = Math.round((sumTotal > 0 ? sumCumple / sumTotal : 0) * 100);
      }
    }
    setKpiData(newData);
  };

  const handleTotalChange = (section, field, value) => {
    const newData = JSON.parse(JSON.stringify(kpiData));
    if (section === 'resumenAvisos' || section === 'resumenOrdenes') {
      const val = Math.max(0, Number(value) || 0);
      newData[section].total = val;
      const indKey = section === 'resumenAvisos' ? 'avisosPendientes' : 'ordenesPendientes';
      newData.indicadores[indKey] = val;
    } else {
      if (field === 'cumplimiento') {
        const pctVal = Math.max(0, Number(value) || 0) / 100;
        newData[section].total.cumplimiento = pctVal;
        newData.indicadores[section] = Math.round(pctVal * 100);
      } else if (field === 'total') {
        newData[section].total.total = Math.max(0, Number(value) || 0);
      } else {
        newData[section].total[field] = Math.max(0, Number(value) || 0);
      }
    }
    setKpiData(newData);
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (section, subKey, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newData = JSON.parse(JSON.stringify(kpiData));
    const arr = newData[section][subKey];
    const oldIndex = arr.findIndex(g => g._rowId === active.id);
    const newIndex = arr.findIndex(g => g._rowId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    newData[section][subKey] = arrayMove(arr, oldIndex, newIndex);
    setKpiData(newData);
  };

  const renderCumpPill = (val) => {
    const pct = val * 100;
    let className = 'pct-badge error';
    if (pct >= 95) className = 'pct-badge success';
    else if (pct >= 70) className = 'pct-badge warning';
    return <span className={className}>{pct % 1 === 0 ? Math.round(pct) : pct.toFixed(1)}%</span>;
  };

  // ─── RENDER ───
  return (
    <div className="kpis-container">
      {/* Sub-navegación */}
      <div className="sub-tab-navigation flex gap-2 mb-2">
        {/* Ocultado por requerimiento de cliente
        <button className={`btn ${kpiSubTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setKpiSubTab('dashboard')}>
          <span className="material-icons">analytics</span> Dashboard Histórico
        </button>
        */}
        <button className={`btn ${kpiSubTab === 'visualizacion' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setKpiSubTab('visualizacion')}>
          <span className="material-icons">bar_chart</span> Carga y Visualización
        </button>
        <button className={`btn ${kpiSubTab === 'envio' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setKpiSubTab('envio')} disabled={!kpiData}>
          <span className="material-icons">preview</span> Previsualizar Reporte
        </button>
      </div>


      {kpiSubTab === 'visualizacion' && (
        <div className="dashboard-grid">
          {/* Panel izquierdo: carga de archivos */}
          <div className="flex-col gap-2">
            <form onSubmit={handleProcessKpis} className="glass-card flex-col gap-1.5">
              <div className="flex-between">
                <h2 className="card-title">
                  <span className="material-icons text-indigo">description</span>
                  <span>1. Carga de Datos</span>
                </h2>
                <button type="button" onClick={onOpenSettings} className="btn-settings-icon" title="Configurar SMTP">
                  <span className="material-icons">settings</span>
                </button>
              </div>

              <div className="form-group">
                <label>Número de Semana de Trabajo (1 - 53)</label>
                <input type="number" min="1" max="53" required className="form-control" value={semana} onChange={(e) => setSemana(e.target.value)} />
              </div>

              <div className="form-group flex-col gap-1">
                <div>
                  <label>División</label>
                  <input list="divList" type="text" className="form-control" placeholder="Ej. Chuquicamata" value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)} />
                  <datalist id="divList">{orgOptions.divisiones?.map(d => <option key={d.id} value={d.nombre} />)}</datalist>
                </div>
                <div>
                  <label>Gerencia</label>
                  <input list="gerList" type="text" className="form-control" placeholder="Ej. Extracción" value={selectedGerencia} onChange={e => setSelectedGerencia(e.target.value)} />
                  <datalist id="gerList">{orgOptions.gerencias?.map(g => <option key={g.id} value={g.nombre} />)}</datalist>
                </div>
                <div>
                  <label>Superintendencia (Opcional)</label>
                  <input list="supList" type="text" className="form-control" placeholder="En blanco si es a nivel Gerencia" value={selectedSuperintendencia} onChange={e => setSelectedSuperintendencia(e.target.value)} />
                  <datalist id="supList">{orgOptions.superintendencias?.map(s => <option key={s.id} value={s.nombre} />)}</datalist>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(59, 130, 246, 0.05)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }} htmlFor="togglePtoTrabajo">
                  <span className="material-icons" style={{ color: usePtoTrabajo ? '#3b82f6' : 'var(--text-muted)' }}>account_tree</span>
                  Agrupar Informe por Puesto de Trabajo
                </label>
                <div style={{ position: 'relative', width: '44px', height: '24px' }}>
                  <input id="togglePtoTrabajo" type="checkbox" checked={usePtoTrabajo} onChange={(e) => setUsePtoTrabajo(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: usePtoTrabajo ? '#3b82f6' : '#cbd5e1', borderRadius: '24px', cursor: 'pointer', transition: '0.3s' }} onClick={() => setUsePtoTrabajo(!usePtoTrabajo)}>
                    <div style={{ position: 'absolute', top: '2px', left: usePtoTrabajo ? '22px' : '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              </div>

              <div className="upload-tabs flex gap-0.5 mt-1 mb-1" style={{ display: 'flex', flexDirection: 'row', gap: '10px', width: '100%', flexWrap: 'nowrap' }}>
                <button type="button" className={`btn flex-1 flex-center gap-0.25 ${uploadMode === 'raw' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.78rem', padding: '0.5rem 0.2rem', whiteSpace: 'nowrap', minWidth: 0 }}
                  onClick={() => { setUploadMode('raw'); setProcessingError(''); }}>
                  <span className="material-icons" style={{ fontSize: '1.05rem' }}>library_books</span>
                  <span>Múltiples Excels</span>
                </button>
                <button type="button" className={`btn flex-1 flex-center gap-0.25 ${uploadMode === 'ready' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.78rem', padding: '0.5rem 0.2rem', whiteSpace: 'nowrap', minWidth: 0 }}
                  onClick={() => { setUploadMode('ready'); setProcessingError(''); }}>
                  <span className="material-icons" style={{ fontSize: '1.05rem' }}>fact_check</span>
                  <span>Consolidado Listo</span>
                </button>
              </div>

              {uploadMode === 'raw' ? (
                <>
                  <div className="file-grid">
                    {REQUIRED_FILES.map(item => {
                      const status = filesStatus[item.key];
                      const hasFile = !!files[item.key];
                      return (
                        <div key={item.key} className={`dropzone ${hasFile ? 'filled' : ''} ${status?.error ? 'dropzone-error' : ''}`}>
                          <input type="file" accept=".xlsx,.xlsm,.xls" onChange={(e) => handleFileChange(item.key, e.target.files[0])} />
                          <span className="material-icons drop-icon">
                            {status?.loading ? 'hourglass_top' : hasFile && !status?.error ? 'task' : 'cloud_upload'}
                          </span>
                          <div className="drop-title">{item.label}</div>
                          <div className="drop-desc">{hasFile ? files[item.key].name : item.desc}</div>
                          {status && (
                            <div className={`file-preview-badge ${status.loading ? 'badge-loading' : status.error ? 'badge-error' : 'badge-success'}`}>
                              {status.loading ? '⧐ Procesando...' : status.error ? `⚠ ${status.error}` : `✓ ${status.message}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
                    <p className="text-muted" style={{ fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 500 }}>
                      <span className="material-icons" style={{ fontSize: '0.8rem', verticalAlign: 'middle', marginRight: '0.2rem' }}>info</span>
                      Opcional: Sube los Excel descargados de IW39 e IW37N para saltar la automatización SAP
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {[
                        { key: 'proyOts', label: 'Proy OTs (IW39)', desc: 'Excel descargado de IW39' },
                        { key: 'proy37n', label: 'Proy 37N (IW37N)', desc: 'Excel descargado de IW37N' }
                      ].map(item => {
                        const hasFile = !!files[item.key];
                        return (
                          <div key={item.key} className={`dropzone dropzone-optional ${hasFile ? 'filled' : ''}`}>
                            <input type="file" accept=".xlsx,.xlsm,.xls" onChange={(e) => setFiles(prev => ({ ...prev, [item.key]: e.target.files[0] }))} />
                            <span className="material-icons drop-icon">{hasFile ? 'task' : 'attach_file'}</span>
                            <div className="drop-title">{item.label}</div>
                            <div className="drop-desc">{hasFile ? files[item.key].name : item.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="dropzone filled-large">
                  <input type="file" accept=".xlsx,.xlsm,.xls" onChange={(e) => setReadyFile(e.target.files[0])} />
                  <span className="material-icons drop-icon" style={{ fontSize: '3rem' }}>{readyFile ? 'verified' : 'cloud_upload'}</span>
                  <div className="drop-title" style={{ fontSize: '1.25rem' }}>Excel Consolidado KPI</div>
                  <div className="drop-desc">{readyFile ? readyFile.name : 'Sube aquí el archivo consolidado (KPI GSYS SEMXX.xlsx)'}</div>
                </div>
              )}

              <button type="submit" disabled={processing} className="btn btn-primary w-full">
                {processing ? (
                  <span className="flex-center gap-0.5"><span className="spinner-mini"></span><span>Procesando Archivos...</span></span>
                ) : <span>Procesar y Generar Reporte</span>}
              </button>

              {processingError && (
                <div className="alert error"><span className="material-icons">error</span><span>{processingError}</span></div>
              )}
              {processingSuccess && (
                <div className="alert success"><span className="material-icons">check_circle</span><span>Libro de KPIs consolidado correctamente para la semana {semana}.</span></div>
              )}

              {/* Visor y Logs del Robot SAP si está corriendo */}
              {kpiRobotRunning && (
                <div className="glass-card flex-col gap-1 mt-1">
                  <div className="flex-between">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-light)' }}>
                      Robot SAP: <strong style={{ color: 'var(--secondary)' }}>{kpiRobotProgressText}</strong>
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{Math.round(kpiRobotProgress * 100)}%</span>
                  </div>
                  <div className="progress-bar-wrapper" style={{ height: '6px' }}>
                    <div className="progress-bar-fill" style={{ width: `${kpiRobotProgress * 100}%` }}></div>
                  </div>

                  {kpiSolicitarMfa && createPortal(
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                      <div className="glass-card flex-col gap-1 text-center animate-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', alignItems: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <span className="material-icons text-warning" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>security</span>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Microsoft Authenticator (SAP)</h3>
                        <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>El robot requiere código MFA para iniciar sesión en SAP. Ingresa el código OTP de tu app Authenticator.</p>
                        <input type="text" maxLength="8" placeholder="000000" className="form-control font-mono text-center font-bold"
                          style={{ width: '150px', letterSpacing: '4px', fontSize: '1.4rem', margin: '1rem auto' }}
                          value={kpiMfaCode} onChange={(e) => setKpiMfaCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enviarMfaSap(); }} />
                        <div className="flex gap-1" style={{ width: '100%', marginTop: '0.5rem' }}>
                          {/* Cancelar detiene el robot SAP (kpi_auto) pero NO aborta el fetch HTTP de /api/process-kpis.
                              El backend continuará procesando los archivos subidos y retornará el resultado. */}
                          <button type="button" onClick={async () => {
                            await fetch('/api/detener-modulo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo_id: 'kpi_auto' }) });
                            setKpiSolicitarMfa(false);
                            setKpiRobotRunning(false);
                          }} className="btn btn-secondary flex-1">Cancelar (continuar sin IW39)</button>
                          <button type="button" onClick={enviarMfaSap} disabled={kpiMfaLoading || !kpiMfaCode} className="btn btn-primary flex-2">{kpiMfaLoading ? 'Enviando...' : 'Reanudar'}</button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Panel derecho: visualización */}
          <div className="flex-col gap-2">
            {kpiData ? (
              <>
                <div className="glass-card flex-col gap-1.5">
                  <h2 className="card-title">
                    <span className="material-icons text-cyan">dashboard</span>
                    <span>2. Visualización de Indicadores</span>
                  </h2>

                  <div className="kpis-summary-grid">
                    {(() => {
                      const av = kpiData.indicadores.avisosPendientes;
                      const ord = kpiData.indicadores.ordenesPendientes;
                      const tp = kpiData.indicadores.trabajoPlanificado;
                      const ps = kpiData.indicadores.programaSemanal;
                      const pm = kpiData.indicadores.planMatriz;
                      const at = parseInt(emailSettings.avisos_target) || 10;
                      const ot = parseInt(emailSettings.ordenes_target) || 10;
                      const tpT = parseInt(emailSettings.tp_target) || 80;
                      const psT = parseInt(emailSettings.ps_target) || 85;
                      const pmT = parseInt(emailSettings.pm_target) || 85;
                      return (<>
                        <div className={'kpi-widget ' + (av === 0 ? 'success' : av < at ? 'warning' : 'danger')}>
                          <span className="material-icons widget-icon">notification_important</span>
                          <div className="widget-value">{av}</div>
                          <div className="widget-label">Avisos Pendientes</div>
                        </div>
                        <div className={'kpi-widget ' + (ord === 0 ? 'success' : ord < ot ? 'warning' : 'danger')}>
                          <span className="material-icons widget-icon">assignment_late</span>
                          <div className="widget-value">{ord}</div>
                          <div className="widget-label">Órdenes Pendientes</div>
                        </div>
                        <div className={'kpi-widget ' + (tp >= tpT ? 'success' : tp >= tpT - 10 ? 'warning' : 'danger')}>
                          <span className="material-icons widget-icon">insights</span>
                          <div className="widget-value">{tp}%</div>
                          <div className="widget-label">Trab. Planificado</div>
                        </div>
                        <div className={'kpi-widget ' + (ps >= psT ? 'success' : ps >= psT - 10 ? 'warning' : 'danger')}>
                          <span className="material-icons widget-icon">date_range</span>
                          <div className="widget-value">{ps}%</div>
                          <div className="widget-label">Prog. Semanal</div>
                        </div>
                        <div className={'kpi-widget ' + (pm >= pmT ? 'success' : pm >= pmT - 10 ? 'warning' : 'danger')}>
                          <span className="material-icons widget-icon">view_list</span>
                          <div className="widget-value">{pm}%</div>
                          <div className="widget-label">Plan Matriz</div>
                        </div>
                      </>);
                    })()}
                  </div>

                  {/* Descarga Excel y Power BI */}
                  <div className="excel-download-bar" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', alignItems: 'stretch' }}>
                    <div className="flex-between w-full">
                      <div className="flex-center gap-1">
                        <span className="material-icons text-green" style={{ fontSize: '2.5rem' }}>feed</span>
                        <div>
                          <div className="download-title">Consolidado KPI Unificado</div>
                          <div className="download-subtitle">{kpiData.filename}</div>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        <button className="btn btn-danger flex-center gap-0.5" onClick={handleResetReport} title="Reiniciar reporte y carga">
                          <span className="material-icons">restart_alt</span><span>Reiniciar</span>
                        </button>
                        <button className="btn btn-outline flex-center gap-0.5" onClick={handleSaveReport} disabled={savingReport || !kpiData} title="Guardar reporte en base de datos">
                          {savingReport ? <><span className="spinner-mini"></span><span>Guardando...</span></> : <><span className="material-icons">save</span><span>Guardar BD</span></>}
                        </button>
                        <button className="btn btn-success flex-center gap-0.5" onClick={async () => {
                          if (window.pywebview?.api) {
                            const success = await window.pywebview.api.save_excel(kpiData.filename);
                            if (success) alert('Archivo descargado y guardado exitosamente.');
                          } else { window.location.href = kpiData.downloadUrl; }
                        }}>
                          <span className="material-icons">download</span><span>Descargar Excel</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.2rem' }} className="flex-col gap-1">
                      <div className="flex-between">
                        <div className="flex-center gap-1">
                          <span className="material-icons text-cyan" style={{ fontSize: '2.5rem' }}>screenshot_keyboard</span>
                          <div>
                            <div className="download-title">Captura Automatizada de Power BI</div>
                            <div className="download-subtitle" style={{ fontSize: '0.78rem' }}>Genera y adjunta una captura visual del reporte de Power BI</div>
                          </div>
                        </div>
                        <button type="button" onClick={handleCapturePowerBI} disabled={pbiCapturing} className="btn btn-primary flex-center gap-0.5">
                          <span className="material-icons">{pbiCapturing ? 'hourglass_top' : 'photo_camera'}</span>
                          <span>{pbiCapturing ? 'Capturando...' : 'Capturar Power BI'}</span>
                        </button>
                      </div>

                      {pbiCapturing && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }} className="flex-col gap-0.8">
                          <div className="flex-between">
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-light)' }}>
                              Robot Power BI: <strong style={{ color: 'var(--secondary)' }}>{pbiStatus.progreso_texto}</strong>
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{Math.round(pbiStatus.progreso * 100)}%</span>
                          </div>
                          <div className="progress-bar-wrapper" style={{ height: '6px' }}>
                            <div className="progress-bar-fill" style={{ width: `${pbiStatus.progreso * 100}%` }}></div>
                          </div>

                          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0b0f19', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {pbiStatus.visor ? (
                              <img src={`data:image/jpeg;base64,${pbiStatus.visor}`} alt="Transmisión Power BI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              <div className="flex-col flex-center text-muted" style={{ gap: '0.4rem' }}>
                                <span className="material-icons" style={{ fontSize: '1.8rem' }}>tv_off</span>
                                <span style={{ fontSize: '0.75rem' }}>Esperando transmisión...</span>
                              </div>
                            )}
                          </div>

                          <div className="hud-console font-mono" style={{ maxHeight: '110px', minHeight: '60px' }}>
                            {(pbiStatus.logs || []).length > 0 ? pbiStatus.logs.slice(-20).map((log, idx) => (
                              <div key={idx} className={`console-line ${log.level}`} style={{ fontSize: '0.72rem' }}><span className="line-time">[{log.time}]</span><span className="line-text">{log.text}</span></div>
                            )) : (
                              <div className="console-placeholder text-center text-muted" style={{ fontSize: '0.75rem' }}>Esperando mensajes del robot...</div>
                            )}
                          </div>

                          <div className="flex gap-0.5" style={{ marginTop: '0.5rem' }}>
                            <button type="button" onClick={async () => { await fetch('/api/pausar-modulo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo_id: 'powerbi' }) }); }} className="btn btn-secondary flex-1" style={{ fontSize: '0.75rem', padding: '0.35rem' }}>Pausar</button>
                            <button type="button" onClick={async () => { await fetch('/api/detener-modulo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo_id: 'powerbi' }) }); setPbiCapturing(false); }} className="btn btn-danger flex-1" style={{ fontSize: '0.75rem', padding: '0.35rem' }}>Detener</button>
                          </div>
                          {pbiStatus.solicitar_mfa && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 8, 22, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                              <div className="glass-card flex-col gap-1 text-center animate-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#162130', alignItems: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
                                <span className="material-icons text-warning" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>security</span>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Microsoft Authenticator</h3>
                                <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>El robot requiere código MFA para iniciar sesión en Power BI. Ingresa el código OTP de tu app Authenticator.</p>
                                <input type="text" maxLength="8" placeholder="000000" className="form-control font-mono text-center font-bold"
                                  style={{ width: '150px', letterSpacing: '4px', fontSize: '1.4rem', margin: '1rem auto' }}
                                  value={pbiMfaCode} onChange={(e) => setPbiMfaCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enviarMfaPbi(); }} />
                                <div className="flex gap-1" style={{ width: '100%', marginTop: '0.5rem' }}>
                                  <button type="button" onClick={async () => { await fetch('/api/detener-modulo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo_id: 'powerbi' }) }); setPbiStatus(prev => ({ ...prev, solicitar_mfa: false })); setPbiCapturing(false); }} className="btn btn-secondary flex-1">Cancelar</button>
                                  <button type="button" onClick={enviarMfaPbi} disabled={pbiMfaLoading || !pbiMfaCode} className="btn btn-primary flex-2">{pbiMfaLoading ? 'Enviando...' : 'Reanudar'}</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {pbiImage && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 'bold' }}>Última captura obtenida:</span>
                          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={pbiImage} alt="Captura Power BI" style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'contain', background: '#0b0f19' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tablas Editables de Detalle */}
                <div className="glass-card flex-col gap-1">
                  <div className="flex-between border-b pb-1">
                    <h2 className="card-title">
                      <span className="material-icons text-indigo">edit_note</span>
                      <span>Detalle de Cumplimiento Planificado</span>
                    </h2>
                    <button onClick={() => setIsEditing(!isEditing)} className={`btn-toggle-edit ${isEditing ? 'active' : ''}`}>
                      <span className="material-icons">{isEditing ? 'check_circle' : 'edit'}</span>
                      <span>{isEditing ? 'Guardar Cambios' : 'Modificar Valores'}</span>
                    </button>
                  </div>

                  <div className="tables-accordion gap-1.5 flex-col">
                    {/* Avisos Pendientes */}
                    {kpiData.resumenAvisos && (
                      <div className="table-subpanel">
                        <h3>Avisos Pendientes</h3>
                        <div className="responsive-table-wrapper">
                          <table className="premium-table">
                            <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso Mantenimiento</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cantidad</th></tr></thead>
                            {isEditing ? (
                              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('resumenAvisos', 'distribucion', e)}>
                                <SortableContext items={(kpiData.resumenAvisos.distribucion || []).map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                  <tbody>
                                    {(kpiData.resumenAvisos.distribucion || []).map((g, idx) => (
                                      <SortableRow key={g._rowId} id={g._rowId}>
                                        {(listeners) => (<>
                                          <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                          <td><input type="text" className="cell-input" value={g.proceso || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, 'proceso', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajo : g.grPlanif) || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM) || ''} onChange={(e) => handleTableChange('resumenAvisos', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                          <td className="text-center font-number"><input type="number" className="cell-input text-center w-80" value={g.cantidad || 0} onChange={(e) => handleTableChange('resumenAvisos', idx, 'cantidad', e.target.value)} /></td>
                                        </>)}
                                      </SortableRow>
                                    ))}
                                  </tbody>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <tbody>
                                {(kpiData.resumenAvisos.distribucion || []).map((g, idx) => (
                                  <tr key={g._rowId || idx}>
                                    <td>{g.proceso}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                    <td className="text-center font-number">{Math.round(g.cantidad || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            )}
                            <tfoot><tr className="footer-row"><td colSpan={isEditing ? 4 : 3}>TOTAL GENERAL</td><td className="text-center font-number font-bold">{isEditing ? <input type="number" className="cell-input text-center w-80 font-bold" value={kpiData.resumenAvisos.total || 0} onChange={(e) => handleTotalChange('resumenAvisos', 'total', e.target.value)} /> : Math.round(kpiData.resumenAvisos.total || 0)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Órdenes Pendientes */}
                    {kpiData.resumenOrdenes && (
                      <div className="table-subpanel">
                        <h3>Órdenes Pendientes</h3>
                        <div className="responsive-table-wrapper">
                          <table className="premium-table">
                            <thead><tr>{isEditing && <th className="drag-handle-col"></th>}<th>Proceso Mantenimiento</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. Planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cantidad</th></tr></thead>
                            {isEditing ? (
                              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('resumenOrdenes', 'distribucion', e)}>
                                <SortableContext items={(kpiData.resumenOrdenes.distribucion || []).map(g => g._rowId)} strategy={verticalListSortingStrategy}>
                                  <tbody>
                                    {(kpiData.resumenOrdenes.distribucion || []).map((g, idx) => (
                                      <SortableRow key={g._rowId} id={g._rowId}>
                                        {(listeners) => (<>
                                          <td className="drag-handle-cell" {...listeners}><span className="material-icons">drag_indicator</span></td>
                                          <td><input type="text" className="cell-input" value={g.proceso || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, 'proceso', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajo : g.grPlanif) || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /></td>
                                          <td><input type="text" className="cell-input text-center" value={(usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM) || ''} onChange={(e) => handleTableChange('resumenOrdenes', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /></td>
                                          <td className="text-center font-number"><input type="number" className="cell-input text-center w-80" value={g.cantidad || 0} onChange={(e) => handleTableChange('resumenOrdenes', idx, 'cantidad', e.target.value)} /></td>
                                        </>)}
                                      </SortableRow>
                                    ))}
                                  </tbody>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <tbody>
                                {(kpiData.resumenOrdenes.distribucion || []).map((g, idx) => (
                                  <tr key={g._rowId || idx}>
                                    <td>{g.proceso}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajo : g.grPlanif}</td>
                                    <td>{usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM}</td>
                                    <td className="text-center font-number">{Math.round(g.cantidad || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            )}
                            <tfoot><tr className="footer-row"><td colSpan={isEditing ? 4 : 3}>TOTAL GENERAL</td><td className="text-center font-number font-bold">{isEditing ? <input type="number" className="cell-input text-center w-80 font-bold" value={kpiData.resumenOrdenes.total || 0} onChange={(e) => handleTotalChange('resumenOrdenes', 'total', e.target.value)} /> : Math.round(kpiData.resumenOrdenes.total || 0)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Trabajo Planificado */}
                    <div className="table-subpanel">
                      <h3>% Trabajo Planificado (HH)</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr><th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-right">Planificado</th><th className="text-right">Sin HR</th><th className="text-right">Sin Hor.</th><th className="text-right">Imprevistos</th><th className="text-right">Total HH</th><th className="text-center">Cumplimiento</th></tr></thead>
                          <tbody>
                            {kpiData.trabajoPlanificado.grupos.map((g, idx) => (
                              <tr key={idx}>
                                <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('trabajoPlanificado', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('trabajoPlanificado', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.planificado} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'planificado', e.target.value)} /> : Math.round(g.planificado)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.sinHr} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'sinHr', e.target.value)} /> : Math.round(g.sinHr)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.sinHorizonte || 0} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'sinHorizonte', e.target.value)} /> : Math.round(g.sinHorizonte || 0)}</td>
                                <td className="text-right font-number">{isEditing ? <input type="number" className="cell-input text-right" value={g.imprevistos} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'imprevistos', e.target.value)} /> : Math.round(g.imprevistos)}</td>
                                <td className="text-right font-number font-bold">{isEditing ? <input type="number" className="cell-input text-right" value={g.total} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'total', e.target.value)} /> : Math.round(g.total)}</td>
                                <td className="text-center">{isEditing ? <div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('trabajoPlanificado', idx, 'cumplimiento', e.target.value)} /><span>%</span></div> : renderCumpPill(g.cumplimiento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="footer-row">
                              <td colSpan="3">TOTAL GENERAL</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.planificado)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.sinHr)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.sinHorizonte || 0)}</td>
                              <td className="text-right font-number">{Math.round(kpiData.trabajoPlanificado.total.imprevistos)}</td>
                              <td className="text-right font-number font-bold">{Math.round(kpiData.trabajoPlanificado.total.total)}</td>
                              <td className="text-center">{renderCumpPill(kpiData.trabajoPlanificado.total.cumplimiento)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Programa Semanal */}
                    <div className="table-subpanel">
                      <h3>Programa Semanal</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr><th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total Ops</th><th className="text-center">Cumplimiento</th></tr></thead>
                          <tbody>
                            {kpiData.programaSemanal.grupos.map((g, idx) => (
                              <tr key={idx}>
                                <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('programaSemanal', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('programaSemanal', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('programaSemanal', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.cumple} onChange={(e) => handleTableChange('programaSemanal', idx, 'cumple', e.target.value)} /> : Math.round(g.cumple)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.noCumple} onChange={(e) => handleTableChange('programaSemanal', idx, 'noCumple', e.target.value)} /> : Math.round(g.noCumple)}</td>
                                <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                <td className="text-center">{isEditing ? <div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('programaSemanal', idx, 'cumplimiento', e.target.value)} /><span>%</span></div> : renderCumpPill(g.cumplimiento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="footer-row"><td colSpan="3">TOTAL</td><td className="text-center font-number">{Math.round(kpiData.programaSemanal.total.cumple)}</td><td className="text-center font-number">{Math.round(kpiData.programaSemanal.total.noCumple)}</td><td className="text-center font-number font-bold">{Math.round(kpiData.programaSemanal.total.total)}</td><td className="text-center">{renderCumpPill(kpiData.programaSemanal.total.cumplimiento)}</td></tr></tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Plan Matriz */}
                    <div className="table-subpanel">
                      <h3>Plan Matriz</h3>
                      <div className="responsive-table-wrapper">
                        <table className="premium-table">
                          <thead><tr><th>Proceso</th><th>{usePtoTrabajo ? 'Pto. Trabajo' : 'Gr. planif'}</th><th>{usePtoTrabajo ? 'Desc. Pto. Trabajo' : 'Gr. planif.PM'}</th><th className="text-center">Cumple</th><th className="text-center">No Cumple</th><th className="text-center">Total Ops</th><th className="text-center">Cumplimiento</th></tr></thead>
                          <tbody>
                            {kpiData.planMatriz.grupos.map((g, idx) => (
                              <tr key={idx}>
                                <td>{isEditing ? <input type="text" className="cell-input" value={g.proceso} onChange={(e) => handleTableChange('planMatriz', idx, 'proceso', e.target.value)} /> : g.proceso}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajo : g.grPlanif} onChange={(e) => handleTableChange('planMatriz', idx, usePtoTrabajo ? 'ptoTrabajo' : 'grPlanif', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajo : g.grPlanif)}</td>
                                <td>{isEditing ? <input type="text" className="cell-input text-center" value={usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM} onChange={(e) => handleTableChange('planMatriz', idx, usePtoTrabajo ? 'ptoTrabajoDesc' : 'grPlanifPM', e.target.value)} /> : (usePtoTrabajo ? g.ptoTrabajoDesc : g.grPlanifPM)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.cumple} onChange={(e) => handleTableChange('planMatriz', idx, 'cumple', e.target.value)} /> : Math.round(g.cumple)}</td>
                                <td className="text-center font-number">{isEditing ? <input type="number" className="cell-input text-center" value={g.noCumple} onChange={(e) => handleTableChange('planMatriz', idx, 'noCumple', e.target.value)} /> : Math.round(g.noCumple)}</td>
                                <td className="text-center font-number font-bold">{Math.round(g.total)}</td>
                                <td className="text-center">{isEditing ? <div className="flex-center gap-0.25"><input type="number" className="cell-input text-center w-60" value={Math.round(g.cumplimiento * 100)} onChange={(e) => handleTableChange('planMatriz', idx, 'cumplimiento', e.target.value)} /><span>%</span></div> : renderCumpPill(g.cumplimiento)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="footer-row"><td colSpan="3">TOTAL</td><td className="text-center font-number">{Math.round(kpiData.planMatriz.total.cumple)}</td><td className="text-center font-number">{Math.round(kpiData.planMatriz.total.noCumple)}</td><td className="text-center font-number font-bold">{Math.round(kpiData.planMatriz.total.total)}</td><td className="text-center">{renderCumpPill(kpiData.planMatriz.total.cumplimiento)}</td></tr></tfoot>
                        </table>
                      </div>

                    </div>
                  </div>
                </div>
              </>
            ) : kpiRobotRunning ? (
              <div className="glass-card flex-col gap-1 h-full" style={{ minHeight: '400px', position: 'relative', overflow: 'hidden' }}>
                <h2 className="card-title mb-1">
                  <span className="material-icons text-cyan">videocam</span>
                  <span>Extracción SAP Automática en Curso</span>
                </h2>
                <div className="flex-between">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-light)' }}>Estado: <strong style={{ color: 'var(--secondary)' }}>{kpiRobotProgressText}</strong></span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{Math.round(kpiRobotProgress * 100)}%</span>
                </div>
                <div className="progress-bar-wrapper" style={{ height: '8px', marginBottom: '0.5rem' }}>
                  <div className="progress-bar-fill" style={{ width: `${kpiRobotProgress * 100}%` }}></div>
                </div>
                <div className="live-screencast-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {kpiRobotVisor ? (
                    <img src={`data:image/jpeg;base64,${kpiRobotVisor}`} alt="Transmisión del navegador" className="screencast-img" style={{ flex: 1, objectFit: 'contain' }} />
                  ) : (
                    <div className="screencast-placeholder" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-icons flex-center text-muted" style={{ fontSize: '3rem' }}>tv_off</span>
                      <p style={{ marginTop: '1rem' }} className="text-muted">Esperando transmisión de imagen del robot...</p>
                    </div>
                  )}
                </div>
                <div className="hud-console font-mono" style={{ maxHeight: '140px', minHeight: '80px', marginTop: '0.5rem' }}>
                  {kpiRobotLogs.length > 0 ? kpiRobotLogs.slice(-30).map((log, idx) => (
                    <div key={idx} className={`console-line ${log.level}`}><span className="line-time">[{log.time}]</span><span className="line-text">{log.text}</span></div>
                  )) : (
                    <div className="console-placeholder text-center text-muted">Esperando mensajes del robot...</div>
                  )}
                </div>
              </div>
            ) : processing ? (
              <div className="glass-card flex-center flex-col h-full" style={{ minHeight: '400px' }}>
                <span className="spinner-mini" style={{ width: '3rem', height: '3rem', borderWidth: '4px', marginBottom: '1.5rem' }}></span>
                <h3 className="text-muted-light">Generando Reporte Consolidado...</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>La automatización SAP finalizó. Consolidando datos y construyendo el Excel con tablas dinámicas.</p>
              </div>
            ) : kpiRobotVisor ? (
              /* Última captura del robot — se mantiene visible después de finalizar la automatización */
              <div className="glass-card flex-col gap-1 h-full" style={{ minHeight: '400px', position: 'relative', overflow: 'hidden' }}>
                <h2 className="card-title mb-1">
                  <span className="material-icons text-secondary">check_circle</span>
                  <span>Última Captura del Robot SAP</span>
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted-light)', marginBottom: '0.5rem' }}>
                  Pantalla final que dejó el robot al terminar la extracción. Pulsa "Iniciar" para una nueva automatización.
                </p>
                <div className="live-screencast-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img src={`data:image/jpeg;base64,${kpiRobotVisor}`} alt="Última captura del navegador" className="screencast-img" style={{ flex: 1, objectFit: 'contain' }} />
                </div>
              </div>
            ) : (
              <div className="glass-card flex-center flex-col h-full" style={{ minHeight: '350px' }}>
                <span className="material-icons text-muted" style={{ fontSize: '4.5rem', marginBottom: '1rem' }}>analytics</span>
                <h3 className="text-muted-light">Esperando Carga de Datos</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Carga los excels de SAP del periodo en el panel de la izquierda para consolidar y visualizar celdas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-pestaña Dashboard */}
      {kpiSubTab === 'dashboard' && (
        <KpiDashboardCharts data={kpiData} semana={semana} />
      )}

      {/* Sub-pestaña Envío */}
      {kpiSubTab === 'envio' && (
        <div className="dashboard-grid-rows" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          <div className="glass-card flex-col gap-1.5">
            <h2 className="card-title"><span className="material-icons text-indigo">mail</span><span>Configuración y Envío de Reporte</span></h2>
            <div className="form-group">
              <label>Destinatarios Oficiales (Separados por coma o punto y coma)</label>
              <textarea required placeholder="destinatario1@codelco.cl, destinatario2@codelco.cl" className="form-control h-80" style={{ resize: 'none' }} value={recipients} onChange={(e) => setRecipients(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Destinatarios CC (En Copia, separados por coma o punto y coma)</label>
              <textarea placeholder="copia1@codelco.cl, copia2@codelco.cl" className="form-control h-60" style={{ resize: 'none' }} value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Destinatarios de Prueba</label>
              <input type="text" placeholder="consultor@monitoring.cl" className="form-control" value={testRecipients} onChange={(e) => setTestRecipients(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Asunto del Correo</label>
              <input type="text" required placeholder="Asunto" className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="flex gap-1" style={{ marginTop: '1.5rem' }}>
              <button type="button" onClick={handleSaveEmailSettings} className="btn btn-outline flex-1 flex-center gap-0.5">
                <span className="material-icons">save</span><span>Guardar Destinatarios por Defecto</span>
              </button>
            </div>
            {emailStatus.error && <div className="alert error" style={{ marginTop: '1rem' }}><span className="material-icons">error</span><span>{emailStatus.error}</span></div>}
            {emailStatus.success && <div className="alert success" style={{ marginTop: '1rem' }}><span className="material-icons">check_circle</span><span>{emailStatus.message}</span></div>}
          </div>
          <div className="flex-col gap-2">
            <EmailPreview
              kpiData={kpiData}
              sending={sendingEmail}
              onSendTestEmail={handleSendTestEmail}
              onSendRealEmail={handleSendRealEmail}
              emailSettings={emailSettings}
              setEmailSettings={setEmailSettings}
              onSaveEmailSettings={handleSaveEmailSettings}
              includePowerBI={includePowerBI}
              setIncludePowerBI={setIncludePowerBI}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
            />
          </div>
        </div>
      )}
    </div>
  );
}

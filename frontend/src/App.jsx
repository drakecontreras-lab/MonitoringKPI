import React, { useState, useEffect } from 'react';
import SettingsModal from './components/SettingsModal';
import KpiCorporativosTab from './components/KpiCorporativosTab';
import ProyeccionesTab from './components/ProyeccionesTab';
import KpiUsoSapTab from './components/KpiUsoSapTab';

/**
 * Componente raíz App.
 * Responsabilidades: autenticación, navegación entre pestañas, config SMTP, config general SAP.
 * Toda la lógica de KPIs Corporativos → KpiCorporativosTab (estado local propio).
 * Toda la lógica de Proyecciones/Robot → ProyeccionesTab (estado local propio).
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'sap-uso' | 'proyecciones' | 'config'
  const [theme, setTheme] = useState('dark');

  // ─── Autenticación ───
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ─── Configuración SMTP (compartida: usada por KpiCorporativosTab para envíos) ───
  const [smtpConfig, setSmtpConfig] = useState({ email: '', password: '' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ─── Configuración general de SAP / navegador ───
  const [generalConfig, setGeneralConfig] = useState({
    credenciales: { usuario: '', contrasena: '' },
    navegador: { url_base: '', headless: false }
  });
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);

  // ─── Email settings (compartido como prop para KpiCorporativosTab) ───
  const [emailSettings, setEmailSettings] = useState({
    header_tag: '■ &nbsp; DIVISIÓN CHUQUICAMATA &nbsp;·&nbsp; GSYS MANTENIMIENTO',
    title: 'Reporte Semanal de KPIs Corporativos',
    subtitle: 'Sistema de Gestión & Mantenimiento Industrial',
    body_p1: 'Este es un texto tipo y se debe modificar.',
    body_p2: 'Este es un texto tipo y se debe modificar.',
    generado_nombre: 'José Contreras Luna',
    generado_email: 'jose.contreras@monitoring.cl',
    avisos_target: 10,
    ordenes_target: 10,
    tp_target: 80,
    ps_target: 85,
    pm_target: 85
  });

  // ─── Fechas por defecto (para inicializar ambos tabs sin interferencia) ───
  const [defaultSemana, setDefaultSemana] = useState('23');
  const [defaultFechaBase, setDefaultFechaBase] = useState('19-01-2026');

  // ─── Login ───

  const verificarSesion = async () => {
    try {
      const response = await fetch('/api/auth/usuario');
      const data = await response.json();
      if (data.logged) { setLogged(true); setUser(data.user); }
      else { setLogged(false); setUser(null); }
    } catch (e) { console.error('Error al verificar sesión:', e); }
    finally { setAuthLoading(false); }
  };

  const iniciarLogin = async () => {
    try {
      setAuthLoading(true);
      await fetch('/api/auth/login', { method: 'POST' });
      let intentos = 0;
      const interval = setInterval(async () => {
        intentos++;
        const res = await fetch('/api/auth/usuario');
        const d = await res.json();
        if (d.logged) {
          setLogged(true); setUser(d.user);
          clearInterval(interval); setAuthLoading(false);
        }
        if (intentos > 60) { clearInterval(interval); setAuthLoading(false); }
      }, 2000);
    } catch (e) { console.error('Error al iniciar login:', e); setAuthLoading(false); }
  };

  const cerrarSesion = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { }
    
    localStorage.removeItem('outlook_email');
    localStorage.removeItem('outlook_password');
    setGeneralConfig({
      credenciales: { usuario: '', contrasena: '' },
      navegador: { url_base: '', headless: false }
    });
    setSmtpConfig({ email: '', password: '' });
    
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credenciales: { usuario: '', contrasena: '' },
          navegador: { url_base: '', headless: false },
          smtp: { email: '', password: '' }
        })
      });
    } catch (e) {}
    
    setLogged(false); setUser(null);
  };

  // ─── Tema ───
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ─── Carga inicial ───
  useEffect(() => {
    verificarSesion();

    const cargarDatosIniciales = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data) {
          setGeneralConfig({
            credenciales: data.credenciales || { usuario: '', contrasena: '' },
            navegador: data.navegador || { url_base: '', headless: false }
          });
          if (data.smtp?.email) {
            setSmtpConfig({ email: data.smtp.email, password: data.smtp.password || '' });
            localStorage.setItem('outlook_email', data.smtp.email);
            if (data.smtp.password) localStorage.setItem('outlook_password', data.smtp.password);
          }
          if (data.email_settings) setEmailSettings(prev => ({ ...prev, ...data.email_settings }));
        }
      } catch (e) { console.error('Error al cargar configuración:', e); }

      const savedEmail = localStorage.getItem('outlook_email') || '';
      const savedPassword = localStorage.getItem('outlook_password') || '';
      if (savedEmail) {
        setSmtpConfig(prev => (!prev.email ? { email: savedEmail, password: savedPassword } : prev));
      }

      try {
        const resFechas = await fetch('/api/proy/default-dates');
        const dataFechas = await resFechas.json();
        if (dataFechas?.semana && dataFechas?.fecha_base) {
          setDefaultSemana(dataFechas.semana);
          setDefaultFechaBase(dataFechas.fecha_base);
        }
      } catch (e) { console.error('Error al cargar fechas por defecto:', e); }
    };

    cargarDatosIniciales();
  }, []);

  const handleSaveSettings = async (config) => {
    setSmtpConfig(config);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtp: config })
      });
    } catch (e) { console.error('Error al guardar config SMTP:', e); }
  };

  const handleSaveGeneralConfig = async (e) => {
    e.preventDefault();
    setSaveConfigLoading(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generalConfig)
      });
      const data = await res.json();
      if (res.ok && data.success) alert('Configuración general guardada con éxito.');
      else alert('Error al guardar configuración: ' + (data.error || ''));
    } catch (err) { alert('Error de red al guardar configuración.'); }
    finally { setSaveConfigLoading(false); }
  };

  // ─── Splash de carga ───
  if (authLoading) {
    return (
      <div className="auth-splash">
        <div className="splash-card">
          <div className="splash-spinner"></div>
          <h2>Cargando Suite de Monitoreo...</h2>
          <p>Comprobando sesión corporativa de Codelco</p>
        </div>
      </div>
    );
  }

  // ─── Pantalla de login ───
  if (!logged) {
    return (
      <div className="auth-splash">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1a237e_0%,transparent_50%)] opacity-30 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,#00E5FF_0%,transparent_50%)] opacity-10 pointer-events-none"></div>
        <div className="login-card glass-panel shadow-2xl">
          <div className="brand-logo-glow"><span className="material-icons">security</span></div>
          <h1 className="login-title">Monitoring KPI's Corporativos</h1>
          <p className="login-subtitle">Entorno Unificado de Automatizaciones</p>
          <div className="login-divider"></div>
          <div className="login-info">
            <h3>Acceso Restringido</h3>
            <p>Debes iniciar sesión con tu cuenta corporativa de Microsoft para poder ingresar al panel y ejecutar descargas de SAP.</p>
          </div>
          <button onClick={iniciarLogin} className="btn btn-primary login-btn">
            <svg viewBox="0 0 23 23" width="23" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0h11v11H0z" fill="#f25022" />
              <path d="M12 0h11v11H12z" fill="#7fba00" />
              <path d="M0 12h11v11H0z" fill="#00a4ef" />
              <path d="M12 12h11v11H12z" fill="#ffb900" />
            </svg>
            <span>Iniciar Sesión con Microsoft</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── App principal ───
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header glass-panel">
        <div className="brand-section">
          <div>
            <h1 className="brand-title">Monitoring KPI's Corporativos</h1>
            <div className="brand-subtitle">KPIs</div>
          </div>
        </div>

        <nav className="tab-navigation">
          <button className={`tab-btn ${activeTab === 'kpis' ? 'active' : ''}`} onClick={() => setActiveTab('kpis')}>
            <span className="material-icons">query_stats</span>
            <span>KPIs Corporativos</span>
          </button>
          {/* Ocultado por requerimiento
          <button className={`tab-btn ${activeTab === 'sap-uso' ? 'active' : ''}`} onClick={() => setActiveTab('sap-uso')}>
            <span className="material-icons">hub</span>
            <span>CRUD</span>
          </button>
          <button className={`tab-btn ${activeTab === 'proyecciones' ? 'active' : ''}`} onClick={() => setActiveTab('proyecciones')}>
            <span className="material-icons">precision_manufacturing</span>
            <span>Proyecciones</span>
          </button>
          */}
          <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <span className="material-icons">settings</span>
            <span>Configuración</span>
          </button>
        </nav>

        <div className="user-section">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className="btn-logout" 
            title="Alternar Tema"
            style={{ marginRight: '0.5rem' }}
          >
            <span className="material-icons">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <div className="user-profile">
            <span className="material-icons user-avatar">account_circle</span>
            <div className="user-meta">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.preferred_username}</div>
            </div>
          </div>
          <button onClick={cerrarSesion} className="btn-logout" title="Cerrar Sesión">
            <span className="material-icons">logout</span>
          </button>
        </div>
      </header>

      <main className="main-content">

        {/* ── Pestaña 1: KPIs Corporativos ─ siempre montado, oculto cuando inactivo ── */}
        <div style={{ display: activeTab === 'kpis' ? 'contents' : 'none' }}>
          <KpiCorporativosTab
            smtpConfig={smtpConfig}
            onOpenSettings={() => setIsSettingsOpen(true)}
            user={user}
            defaultSemana={defaultSemana}
            emailSettings={emailSettings}
            setEmailSettings={setEmailSettings}
          />
        </div>

        {/* ── Pestaña 2: KPIs Uso SAP (CRUD de base de datos) ── */}
        <div style={{ display: activeTab === 'sap-uso' ? 'contents' : 'none' }}>
          <KpiUsoSapTab />
        </div>

        {/* ── Pestaña 3: Proyecciones ─ siempre montada, oculta cuando inactiva ── */}
        <div style={{ display: activeTab === 'proyecciones' ? 'contents' : 'none' }}>
          <ProyeccionesTab
            defaultSemana={defaultSemana}
            defaultFechaBase={defaultFechaBase}
            smtpConfig={smtpConfig}
            onOpenSettings={() => setIsSettingsOpen(true)}
            user={user}
          />
        </div>

        {/* ── Pestaña 4: Configuración General ── */}
        {activeTab === 'config' && (
          <div className="glass-card flex-col gap-1.5" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem' }}>
            <h2 className="card-title">
              <span className="material-icons text-indigo">settings</span>
              <span>Configuración General de la Suite</span>
            </h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1rem' }}>
              Ajusta las credenciales corporativas y parámetros de navegación para el robot automatizador de SAP.
            </p>
            <form onSubmit={handleSaveGeneralConfig} className="flex-col gap-1.2">
              <div className="form-group">
                <label>Usuario SAP Fiori (Codelco)</label>
                <input type="email" required className="form-control" placeholder="ejemplo@contratistas.codelco.cl"
                  value={generalConfig.credenciales.usuario}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, credenciales: { ...generalConfig.credenciales, usuario: e.target.value } })} />
              </div>
              <div className="form-group">
                <label>Contraseña SAP Fiori</label>
                <input type="password" required className="form-control" placeholder="Contraseña de la cuenta"
                  value={generalConfig.credenciales.contrasena}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, credenciales: { ...generalConfig.credenciales, contrasena: e.target.value } })} />
              </div>
              <div className="form-group">
                <label>URL Base SAP Fiori</label>
                <input type="text" required className="form-control"
                  value={generalConfig.navegador.url_base}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, navegador: { ...generalConfig.navegador, url_base: e.target.value } })} />
              </div>
              <div className="form-group flex-row gap-0.5" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
                <input type="checkbox" id="headless-mode" checked={generalConfig.navegador.headless}
                  onChange={(e) => setGeneralConfig({ ...generalConfig, navegador: { ...generalConfig.navegador, headless: e.target.checked } })} />
                <label htmlFor="headless-mode" style={{ cursor: 'pointer', fontSize: '0.88rem' }}>Ejecutar en Segundo Plano (Headless)</label>
              </div>
              <button type="submit" disabled={saveConfigLoading} className="btn btn-primary w-full flex-center gap-0.5" style={{ marginTop: '1.5rem' }}>
                {saveConfigLoading ? (
                  <><span className="spinner-mini"></span><span>Guardando Ajustes...</span></>
                ) : (
                  <><span className="material-icons">save</span><span>Guardar Configuración</span></>
                )}
              </button>
            </form>
          </div>
        )}

      </main>

      {/* Modal SMTP */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

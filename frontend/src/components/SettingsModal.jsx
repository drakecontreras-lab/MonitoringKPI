import React, { useState, useEffect } from 'react';

/**
 * Componente modal para la configuración de credenciales de correo de Outlook.
 * Almacena la información localmente de manera segura en el almacenamiento del navegador (localStorage).
 * 
 * @param {object} props - Propiedades del componente React.
 * @param {boolean} props.isOpen - Indica si el modal está visible en pantalla.
 * @param {function} props.onClose - Función callback para cerrar el modal.
 * @param {function} props.onSave - Función callback disparada al guardar exitosamente la configuración.
 */
export default function SettingsModal({ isOpen, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isStoredPassword, setIsStoredPassword] = useState(false);

  // Cargar credenciales guardadas en localStorage al montar el componente
  useEffect(() => {
    if (isOpen) {
      const savedEmail = localStorage.getItem('outlook_email') || '';
      const savedPassword = localStorage.getItem('outlook_password') || '';
      
      setEmail(savedEmail);

      if (savedPassword) {
        setPassword('__STORED_PASSWORD_PLACEHOLDER__');
        setIsStoredPassword(true);
      } else {
        setPassword('');
        setIsStoredPassword(false);
      }
    }
  }, [isOpen]);

  /**
   * Maneja el cambio de la contraseña. Si ya existía una guardada y el usuario digita,
   * limpia la máscara de seguridad para capturar la nueva clave limpia.
   */
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    if (isStoredPassword && val !== '__STORED_PASSWORD_PLACEHOLDER__') {
      setIsStoredPassword(false);
      setPassword(val.replace('__STORED_PASSWORD_PLACEHOLDER__', ''));
    } else {
      setPassword(val);
    }
  };

  /**
   * Manejador del submit del formulario.
   * Guarda los valores de configuración en localStorage de forma local.
   * 
   * @param {Event} e - Evento de submit del formulario.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    
    localStorage.setItem('outlook_email', email.trim());
    
    let passwordToSave = password;
    if (password === '__STORED_PASSWORD_PLACEHOLDER__') {
      passwordToSave = localStorage.getItem('outlook_password') || '';
    } else {
      localStorage.setItem('outlook_password', password);
    }
    
    setSaveSuccess(true);
    
    // Notificar al componente padre que se actualizaron las configuraciones
    if (onSave) {
      onSave({ email, password: passwordToSave });
    }
    
    // Ocultar mensaje de éxito y cerrar el modal tras un breve retraso
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal} className="glass-card">
        <div style={modalStyles.header}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>
            <i className="bi bi-gear-fill" style={{ marginRight: '8px', color: 'var(--secondary)' }}></i>
            Configuración SMTP Outlook
          </h3>
          <button onClick={onClose} style={modalStyles.closeBtn}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0.5rem 0', lineHeight: '1.4' }}>
          Configura tus credenciales SMTP de Outlook/Office 365 para el envío de informes. Las credenciales se guardan localmente en tu navegador.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Input Correo Remitente */}
          <div className="form-group">
            <label htmlFor="outlook-email">Correo Outlook Remitente</label>
            <div className="input-wrapper">
              <input
                id="outlook-email"
                type="email"
                required
                className="form-control"
                placeholder="ejemplo@miempresa.cl o @outlook.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <i className="bi bi-envelope-fill"></i>
            </div>
          </div>

          {/* Input Contraseña / App Password */}
          <div className="form-group">
            <label htmlFor="outlook-password">
              Contraseña de Cuenta o de Aplicación
            </label>
            <div className="input-wrapper">
              <input
                id="outlook-password"
                type={isStoredPassword ? 'password' : (showPassword ? 'text' : 'password')}
                required
                className="form-control"
                placeholder="Contraseña segura"
                value={password}
                onChange={handlePasswordChange}
              />
              <i className="bi bi-shield-lock-fill"></i>
              {!isStoredPassword && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={modalStyles.togglePasswordBtn}
                >
                  <i className={showPassword ? "bi bi-eye-slash-fill" : "bi bi-eye-fill"}></i>
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-dark)' }}>
              🔑 Si tu cuenta tiene MFA/2FA, debes usar una <strong>Contraseña de aplicación</strong> generada en Microsoft Office 365.
            </span>
          </div>

          {/* Banner de Éxito al guardar */}
          {saveSuccess && (
            <div className="alert-banner alert-success" style={{ padding: '0.65rem 1rem' }}>
              <i className="bi bi-check-circle-fill"></i>
              <span>Credenciales guardadas con éxito.</span>
            </div>
          )}

          {/* Botones de acción */}
          <div style={modalStyles.actions}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
              <i className="bi bi-save2-fill"></i> Guardar Credenciales
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// Estilos específicos locales para el Modal overlay & layouts
const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 22, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.2s ease-out'
  },
  modal: {
    width: '100%',
    maxWidth: '450px',
    border: '1px solid var(--bg-card-border)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
    animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '1.25rem',
    transition: 'color var(--transition-fast)',
    padding: '0.2rem'
  },
  togglePasswordBtn: {
    position: 'absolute',
    right: '1rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted-dark)',
    cursor: 'pointer',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    height: '100%'
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem'
  }
};

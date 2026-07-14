import React from 'react';

/**
 * Logotipo corporativo "Monitoring Gestión de Activos", consciente del tema
 * activo (oscuro/claro). Ambas variantes se superponen y hacen crossfade por
 * CSS (ver .brand-logo-wrap en index.css) siguiendo el atributo [data-theme]
 * del documento, para una transición suave al cambiar de tema.
 *
 * @param {string} props.height - Altura del logotipo en CSS (por defecto '48px').
 */
export default function MonitoringLogo({ height = '48px' }) {
  return (
    <div className="brand-logo-wrap" style={{ height }}>
      <img src="/LogoMonitoring-dark-theme.png" alt="Monitoring - Gestión de Activos" className="brand-logo-img brand-logo-for-dark" />
      <img src="/LogoMonitoring-light-theme.png" alt="Monitoring - Gestión de Activos" className="brand-logo-img brand-logo-for-light" />
    </div>
  );
}

import React from 'react';

/**
 * Componente que renderiza el logotipo oficial corporativo "Monitoring Gestión de Activos"
 * a partir de la imagen SVG física copiada en el directorio público del proyecto.
 * Garantiza fidelidad visual absoluta al diseño original de la marca en la pantalla.
 * 
 * @param {object} props - Propiedades del componente React.
 * @param {string} props.height - Altura del logotipo en CSS (por defecto '48px').
 * @param {string} props.width - Ancho opcional del logotipo.
 */
export default function MonitoringLogo({ height = '48px', width = 'auto' }) {
  return (
    <img 
      src="/LogoMonitoring.svg" 
      alt="Monitoring - Gestión de Activos" 
      style={{ 
        height: height, 
        width: width, 
        display: 'inline-block', 
        verticalAlign: 'middle',
        objectFit: 'contain'
      }} 
    />
  );
}

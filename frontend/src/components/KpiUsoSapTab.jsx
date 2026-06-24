import React, { useState, useEffect } from 'react';

export default function KpiUsoSapTab() {
  const [tablesMeta, setTablesMeta] = useState({});
  const [tablesData, setTablesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentTable, setCurrentTable] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/api/db/tables');
      const data = await res.json();
      if (data.success) {
        setTablesMeta(data.tables);
        // Fetch data for all tables
        const allData = {};
        for (const tableName of Object.keys(data.tables)) {
          const tRes = await fetch(`/api/db/tables/${tableName}`);
          const tData = await tRes.json();
          if (tData.success) {
            allData[tableName] = tData.rows;
          }
        }
        setTablesData(allData);
      } else {
        setError(data.error || 'Error al cargar estructura de base de datos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor. Verifica que backend/main.py esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = (tableName) => {
    setCurrentTable(tableName);
    setEditingRow(null);
    setFormData({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tableName, row) => {
    setCurrentTable(tableName);
    setEditingRow(row);
    setFormData({ ...row });
    setIsFormOpen(true);
  };

  const handleDelete = async (tableName, id) => {
    if (!window.confirm(`¿Estás seguro de eliminar este registro de ${tablesMeta[tableName].name}?`)) return;
    try {
      const res = await fetch(`/api/db/tables/${tableName}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTablesData(prev => ({
          ...prev,
          [tableName]: prev[tableName].filter(r => r.id !== id)
        }));
      } else {
        alert('Error al eliminar: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingRow 
        ? `/api/db/tables/${currentTable}/${editingRow.id}`
        : `/api/db/tables/${currentTable}`;
      
      const method = editingRow ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (data.success) {
        setTablesData(prev => {
          const currentData = prev[currentTable] || [];
          if (editingRow) {
            return { ...prev, [currentTable]: currentData.map(r => r.id === data.data.id ? data.data : r) };
          } else {
            return { ...prev, [currentTable]: [data.data, ...currentData] };
          }
        });
        setIsFormOpen(false);
      } else {
        alert('Error al guardar: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const tableOrder = ['divisiones', 'gerencias', 'areas', 'procesos'];

  return (
    <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div className="glass-card flex-row justify-between align-center" style={{ padding: '1.25rem 2rem', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }} className="flex-row gap-0.5">
            <span className="material-icons text-primary">storage</span>
            Administrador de Datos BD
          </h2>
          <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Gestiona la jerarquía corporativa (Divisiones, Gerencias, Áreas y Procesos)
          </p>
        </div>
      </div>

      <div style={{ flex: 1, paddingBottom: '2rem' }}>
        {error && (
          <div className="glass-card flex-center flex-col gap-1 text-center" style={{ padding: '3rem 1rem' }}>
            <span className="material-icons text-danger" style={{ fontSize: '3rem' }}>error_outline</span>
            <h3 style={{ color: 'var(--danger)', margin: 0 }}>Ha ocurrido un problema</h3>
            <p className="text-muted" style={{ maxWidth: '400px', fontSize: '0.9rem' }}>{error}</p>
            <button className="btn btn-outline" onClick={fetchMetadata}>Reintentar Consulta</button>
          </div>
        )}

        {!error && loading && (
          <div className="flex-center flex-col gap-1.5" style={{ padding: '5rem 0' }}>
            <div className="splash-spinner" style={{ width: '40px', height: '40px' }}></div>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Cargando estructura de base de datos...</p>
          </div>
        )}

        {!error && !loading && tableOrder.map(tableName => {
          const meta = tablesMeta[tableName];
          if (!meta) return null;
          const rows = tablesData[tableName] || [];
          
          return (
            <div key={tableName} className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <div className="flex-row justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="material-icons text-cyan">table_chart</span>
                  {meta.name}
                </h3>
                <button 
                  onClick={() => handleOpenCreate(tableName)} 
                  className="btn btn-primary flex-center gap-0.25"
                  style={{ height: '36px', padding: '0 1rem' }}
                >
                  <span className="material-icons" style={{ fontSize: '1.2rem' }}>add</span>
                  <span>Agregar {meta.name}</span>
                </button>
              </div>

              {rows.length === 0 ? (
                <div className="flex-center flex-col text-center" style={{ padding: '2rem 1rem' }}>
                  <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
                    La tabla no tiene registros. Agrega uno nuevo.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="kpi-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem' }} className="text-indigo">ID</th>
                        {meta.columns.map(col => (
                          <th key={col.key} style={{ textAlign: 'left', padding: '0.75rem' }}>{col.label}</th>
                        ))}
                        <th style={{ textAlign: 'center', padding: '0.75rem', width: '120px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.id || idx} className="hover-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--cyan)' }}>{row.id}</td>
                          {meta.columns.map(col => (
                            <td key={col.key} style={{ padding: '0.75rem', color: 'var(--text-muted-light)' }}>
                              {row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '-'}
                            </td>
                          ))}
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div className="flex-row gap-0.25" style={{ justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleOpenEdit(tableName, row)} 
                                className="btn btn-outline" 
                                style={{ padding: '0.35rem 0.5rem', minWidth: 'auto', display: 'flex', alignItems: 'center' }}
                                title="Editar"
                              >
                                <span className="material-icons" style={{ fontSize: '1rem' }}>edit</span>
                              </button>
                              <button 
                                onClick={() => handleDelete(tableName, row.id)} 
                                className="btn btn-danger" 
                                style={{ padding: '0.35rem 0.5rem', minWidth: 'auto', display: 'flex', alignItems: 'center' }}
                                title="Eliminar"
                              >
                                <span className="material-icons" style={{ fontSize: '1rem' }}>delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Formulario (Crear / Editar) */}
      {isFormOpen && currentTable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(5, 8, 22, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="glass-card flex-col animate-scale-up" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: '#162130', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }} className="flex-row gap-0.5">
              <span className="material-icons text-cyan">{editingRow ? 'edit' : 'add_circle'}</span>
              <span>{editingRow ? `Editar en ${tablesMeta[currentTable].name}` : `Nuevo Registro en ${tablesMeta[currentTable].name}`}</span>
            </h3>

            <form onSubmit={handleSave} className="flex-col gap-1" style={{ marginTop: '1.25rem' }}>
              {tablesMeta[currentTable].columns.map(col => (
                <div key={col.key} className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>
                    {col.label} {col.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                  </label>
                  <input 
                    type={col.type}
                    required={col.required}
                    className="form-control"
                    placeholder={`Ingrese ${col.label.toLowerCase()}`}
                    value={formData[col.key] || ''}
                    onChange={(e) => handleInputChange(col.key, e.target.value)}
                  />
                </div>
              ))}

              <div className="flex-row gap-1" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsFormOpen(false)} className="btn btn-outline" disabled={saving} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

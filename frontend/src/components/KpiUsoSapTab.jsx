import React, { useState, useEffect } from 'react';

export default function KpiUsoSapTab() {
  const [tables, setTables] = useState({});
  const [selectedTable, setSelectedTable] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null); // null for new row, object for editing
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' }); // type: 'success' | 'error'

  // Fetch tables metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/db/tables');
        const data = await res.json();
        if (data.success) {
          setTables(data.tables);
          // Auto select first table
          const firstTable = Object.keys(data.tables)[0];
          if (firstTable) {
            setSelectedTable(firstTable);
          }
        } else {
          setError(data.error || 'Error al cargar metadatos de base de datos.');
        }
      } catch (err) {
        setError('Error de red al cargar metadatos.');
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch rows when selected table changes
  const fetchRows = async (tableName) => {
    if (!tableName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/db/tables/${tableName}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.rows || []);
      } else {
        setError(data.error || `Error al obtener datos de ${tableName}.`);
      }
    } catch (err) {
      setError('Error de red al consultar registros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(selectedTable);
  }, [selectedTable]);

  // Show status toasts
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  // Open creation form
  const handleOpenCreate = () => {
    setEditingRow(null);
    const initialData = {};
    const cols = tables[selectedTable]?.columns || [];
    cols.forEach(c => {
      initialData[c.key] = '';
    });
    setFormData(initialData);
    setIsFormOpen(true);
  };

  // Open edit form
  const handleOpenEdit = (row) => {
    setEditingRow(row);
    setFormData({ ...row });
    setIsFormOpen(true);
  };

  // Handle Input Changes
  const handleInputChange = (key, val) => {
    setFormData(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingRow 
        ? `/api/db/tables/${selectedTable}/${editingRow.id}` 
        : `/api/db/tables/${selectedTable}`;
      const method = editingRow ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        showToast(
          editingRow ? 'Registro actualizado con éxito.' : 'Registro agregado con éxito.', 
          'success'
        );
        setIsFormOpen(false);
        fetchRows(selectedTable);
      } else {
        showToast(data.error || 'Error al guardar el registro.', 'error');
      }
    } catch (err) {
      showToast('Error de red al intentar guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (rowId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este registro de forma permanente?')) return;
    try {
      const res = await fetch(`/api/db/tables/${selectedTable}/${rowId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Registro eliminado con éxito.', 'success');
        fetchRows(selectedTable);
      } else {
        showToast(data.error || 'Error al eliminar el registro.', 'error');
      }
    } catch (err) {
      showToast('Error de red al intentar eliminar.', 'error');
    }
  };

  // Filter columns based on search input
  const filteredRows = rows.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const columns = tables[selectedTable]?.columns || [];
  const currentTableName = tables[selectedTable]?.name || selectedTable;

  return (
    <div className="flex-col gap-1.5 h-full" style={{ padding: '0.5rem 0' }}>
      
      {/* Toast Alert */}
      {toast.message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          backgroundColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#fff',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.3s ease',
          animation: 'slide-in 0.3s ease'
        }}>
          <span className="material-icons">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Selector de tablas y controles */}
      <div className="glass-panel flex-row flex-between gap-1" style={{ padding: '1rem 1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        <div className="flex-row gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="flex-row gap-0.5" style={{ alignItems: 'center' }}>
            <span className="material-icons text-cyan" style={{ fontSize: '1.8rem' }}>storage</span>
            <h2 className="text-glow" style={{ margin: 0, fontSize: '1.25rem' }}>Administrador de Datos BD</h2>
          </div>
          
          {/* Table select dropdown */}
          <div className="form-group" style={{ margin: 0 }}>
            <select 
              className="form-control" 
              style={{ minWidth: '220px', padding: '0.4rem 0.8rem', cursor: 'pointer' }}
              value={selectedTable} 
              onChange={(e) => setSelectedTable(e.target.value)}
              disabled={loading && Object.keys(tables).length === 0}
            >
              {Object.entries(tables).map(([key, value]) => (
                <option key={key} value={key} style={{ backgroundColor: '#1a2332', color: '#fff' }}>{value.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex-row gap-0.8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, position: 'relative' }}>
            <span className="material-icons text-muted" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>search</span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar registros..." 
              style={{ paddingLeft: '2.2rem', width: '220px', height: '36px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={handleOpenCreate} 
            className="btn btn-primary flex-center gap-0.25"
            style={{ height: '36px', padding: '0 1rem' }}
          >
            <span className="material-icons" style={{ fontSize: '1.2rem' }}>add</span>
            <span>Nuevo Registro</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass-card flex-col" style={{ flex: 1, minHeight: '380px', padding: '1rem', overflowX: 'auto' }}>
        {error && (
          <div className="flex-center flex-col gap-1 text-center" style={{ padding: '3rem 1rem' }}>
            <span className="material-icons text-danger" style={{ fontSize: '3rem' }}>error_outline</span>
            <h3 style={{ color: 'var(--danger)', margin: 0 }}>Ha ocurrido un problema</h3>
            <p className="text-muted" style={{ maxWidth: '400px', fontSize: '0.9rem' }}>{error}</p>
            <button className="btn btn-outline" onClick={() => fetchRows(selectedTable)}>
              Reintentar Consulta
            </button>
          </div>
        )}

        {!error && loading && rows.length === 0 && (
          <div className="flex-center flex-col gap-1.5" style={{ padding: '5rem 0' }}>
            <div className="splash-spinner" style={{ width: '40px', height: '40px' }}></div>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Consultando base de datos corporativa...</p>
          </div>
        )}

        {!error && (!loading || rows.length > 0) && (
          <>
            {filteredRows.length === 0 ? (
              <div className="flex-center flex-col text-center" style={{ padding: '5rem 1rem' }}>
                <span className="material-icons text-muted" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>find_in_page</span>
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>No se encontraron registros</h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {searchTerm ? 'Prueba refinando los términos de búsqueda.' : `La tabla '${currentTableName}' está vacía actualmente.`}
                </p>
              </div>
            ) : (
              <table className="kpi-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }} className="text-indigo">ID</th>
                    {columns.map(col => (
                      <th key={col.key} style={{ textAlign: 'left', padding: '0.75rem' }}>{col.label}</th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '0.75rem', width: '120px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--cyan)' }}>{row.id}</td>
                      {columns.map(col => (
                        <td key={col.key} style={{ padding: '0.75rem', color: 'var(--text-muted-light)' }}>
                          {row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '-'}
                        </td>
                      ))}
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div className="flex-row gap-0.25" style={{ justifyContent: 'center' }}>
                          <button 
                            onClick={() => handleOpenEdit(row)} 
                            className="btn btn-outline" 
                            style={{ padding: '0.35rem 0.5rem', minWidth: 'auto', display: 'flex', alignItems: 'center' }}
                            title="Editar"
                          >
                            <span className="material-icons" style={{ fontSize: '1rem' }}>edit</span>
                          </button>
                          <button 
                            onClick={() => handleDelete(row.id)} 
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
            )}
          </>
        )}
      </div>

      {/* Modal Formulario (Crear / Editar) */}
      {isFormOpen && (
        <div style={{
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
          zIndex: 999
        }}>
          <div className="glass-card flex-col animate-scale-up" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: '#162130', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }} className="flex-row gap-0.5">
              <span className="material-icons text-cyan">{editingRow ? 'edit' : 'add_circle'}</span>
              <span>{editingRow ? `Editar en ${currentTableName}` : `Nuevo Registro en ${currentTableName}`}</span>
            </h3>

            <form onSubmit={handleSave} className="flex-col gap-1" style={{ marginTop: '1.25rem' }}>
              
              {columns.map(col => (
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
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)} 
                  className="btn btn-outline" 
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={saving}
                  style={{ flex: 2 }}
                >
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

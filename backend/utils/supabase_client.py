import os
from supabase import create_client, Client

_log_fn = None

def set_log_fn(fn):
    global _log_fn
    _log_fn = fn

def _log(msg, level="warn"):
    print(f"[Supabase] {msg}")
    if _log_fn:
        _log_fn("db", msg, level)

def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    # Fallback: parse .env manually if not loaded in environment
    if not url or not key:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        env_path = os.path.join(root_dir, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            k, v = parts[0].strip(), parts[1].strip()
                            if k == "SUPABASE_URL":
                                url = v
                            elif k == "SUPABASE_KEY":
                                key = v
    
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment or .env file.")
        
    return create_client(url, key)

# Shared client instance
supabase: Client = None
try:
    supabase = get_supabase_client()
except Exception as e:
    print(f"[Supabase] Warning: Could not initialize Supabase client: {e}")

def sync_hierarchy(division_name, gerencia_name, area_name):
    """Sincroniza la jerarquía y devuelve el ID del área."""
    if not supabase: return None
    
    try:
        # 1. Division
        div_res = supabase.table("divisiones").select("id").eq("nombre", division_name).execute()
        if not div_res.data:
            div_res = supabase.table("divisiones").insert({"nombre": division_name}).execute()
        div_id = div_res.data[0]["id"]
        
        # 2. Gerencia
        ger_res = supabase.table("gerencias").select("id").eq("division_id", div_id).eq("nombre", gerencia_name).execute()
        if not ger_res.data:
            ger_res = supabase.table("gerencias").insert({"division_id": div_id, "nombre": gerencia_name}).execute()
        ger_id = ger_res.data[0]["id"]
        
        # 3. Area
        area_res = supabase.table("areas").select("id").eq("gerencia_id", ger_id).eq("nombre", area_name).execute()
        if not area_res.data:
            area_res = supabase.table("areas").insert({"gerencia_id": ger_id, "nombre": area_name}).execute()
        
        return area_res.data[0]["id"]
    except Exception as e:
        print(f"[Supabase] Error sincronizando jerarquía: {e}")
        if _log_fn:
            _log_fn("db", f"❌ Error sincronizando jerarquía: {e}", "error")
        return None

def sync_proceso(area_id, proceso_name):
    """Sincroniza un proceso asociado a un área y devuelve su ID."""
    if not supabase or not area_id: return None
    try:
        proc_res = supabase.table("procesos").select("id").eq("area_id", area_id).eq("nombre", proceso_name).execute()
        if not proc_res.data:
            proc_res = supabase.table("procesos").insert({"area_id": area_id, "nombre": proceso_name}).execute()
        return proc_res.data[0]["id"]
    except Exception as e:
        print(f"[Supabase] Error sincronizando proceso {proceso_name}: {e}")
        return None

def save_kpi_to_supabase(area_id, anio, semana, data, user_email=""):
    """Guarda/Sobrescribe el reporte y sus métricas en Supabase separando por PROCESO."""
    if not supabase or not area_id: return False
    
    try:
        # Extraemos todos los procesos presentes en la data
        procesos_encontrados = set()
        
        def recolectar_procesos(grupos):
            for g in grupos:
                p = g.get("proceso") or "Sin Proceso"
                procesos_encontrados.add(p)

        if "resumenAvisos" in data: recolectar_procesos(data["resumenAvisos"].get("distribucion", []))
        if "resumenOrdenes" in data: recolectar_procesos(data["resumenOrdenes"].get("distribucion", []))
        if "trabajoPlanificado" in data: recolectar_procesos(data["trabajoPlanificado"].get("grupos", []))
        if "programaSemanal" in data: recolectar_procesos(data["programaSemanal"].get("grupos", []))
        if "planMatriz" in data: recolectar_procesos(data["planMatriz"].get("grupos", []))

        # Iteramos por cada proceso para crear un reporte separado
        for nombre_proceso in procesos_encontrados:
            proceso_id = sync_proceso(area_id, nombre_proceso)
            if not proceso_id: continue
            
            # 1. Buscar si ya existe el reporte para esta área, proceso y semana
            rep_res = supabase.table("kpi_reports").select("id")\
                .eq("area_id", area_id)\
                .eq("proceso_id", proceso_id)\
                .eq("anio", anio)\
                .eq("semana", semana).execute()
            
            if rep_res.data:
                report_id = rep_res.data[0]["id"]
                supabase.table("kpi_reports").update({"created_by": user_email}).eq("id", report_id).execute()
                supabase.table("kpi_metrics").delete().eq("report_id", report_id).execute()
            else:
                rep_res = supabase.table("kpi_reports").insert({
                    "area_id": area_id,
                    "proceso_id": proceso_id,
                    "anio": anio,
                    "semana": semana,
                    "created_by": user_email
                }).execute()
                report_id = rep_res.data[0]["id"]
                
            # 2. Preparar métricas a insertar (solo las que coincidan con este proceso)
            metrics_to_insert = []
            
            def procesar_grupos(kpi_type, grupos):
                for g in grupos:
                    if g.get("proceso") != nombre_proceso: continue
                    metrics_to_insert.append({
                        "report_id": report_id,
                        "kpi_type": kpi_type,
                        "grupo_planificacion": g.get("grPlanif", "N/A"),
                        "proceso": g.get("proceso", "N/A"),
                        "valor_absoluto": g.get("total") if "total" in g else g.get("cantidad"),
                        "porcentaje": g.get("cumplimiento"),
                        "metadata": g
                    })

            if "resumenAvisos" in data: procesar_grupos("avisos_pendientes", data["resumenAvisos"].get("distribucion", []))
            if "resumenOrdenes" in data: procesar_grupos("ordenes_pendientes", data["resumenOrdenes"].get("distribucion", []))
            if "trabajoPlanificado" in data: procesar_grupos("trabajo_planificado", data["trabajoPlanificado"].get("grupos", []))
            if "programaSemanal" in data: procesar_grupos("programa_semanal", data["programaSemanal"].get("grupos", []))
            if "planMatriz" in data: procesar_grupos("plan_matriz", data["planMatriz"].get("grupos", []))
                
            # 3. Insertar métricas masivamente
            if metrics_to_insert:
                supabase.table("kpi_metrics").insert(metrics_to_insert).execute()
                
            print(f"[Supabase] Reporte Semana {semana} guardado exitosamente para proceso {nombre_proceso} (Report ID: {report_id})")
            if _log_fn:
                _log_fn("db", f"✅ KPI guardado en DB: Semana {semana} · Proceso {nombre_proceso} (Report ID: {report_id})", "ok")
            
        return True
    except Exception as e:
        print(f"[Supabase] Error guardando KPI: {e}")
        if _log_fn:
            _log_fn("db", f"❌ Error guardando KPI en DB: {e}", "error")
        return False

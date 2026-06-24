import os
from supabase import create_client, Client

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
        return None

def save_kpi_to_supabase(area_id, anio, semana, data, user_email=""):
    """Guarda/Sobrescribe el reporte y sus métricas en Supabase."""
    if not supabase or not area_id: return False
    
    try:
        # 1. Buscar si ya existe el reporte
        rep_res = supabase.table("kpi_reports").select("id").eq("area_id", area_id).eq("anio", anio).eq("semana", semana).execute()
        
        if rep_res.data:
            report_id = rep_res.data[0]["id"]
            # Upsert implícito: Si ya existe, se actualiza el created_by o modified
            supabase.table("kpi_reports").update({"created_by": user_email}).eq("id", report_id).execute()
            # Eliminar métricas antiguas para sobrescribir (UPSERT approach)
            supabase.table("kpi_metrics").delete().eq("report_id", report_id).execute()
        else:
            rep_res = supabase.table("kpi_reports").insert({
                "area_id": area_id,
                "anio": anio,
                "semana": semana,
                "created_by": user_email
            }).execute()
            report_id = rep_res.data[0]["id"]
            
        # 2. Preparar métricas a insertar
        metrics_to_insert = []
        
        # Helper interno para extraer grupos
        def procesar_grupos(kpi_type, grupos):
            for g in grupos:
                metrics_to_insert.append({
                    "report_id": report_id,
                    "kpi_type": kpi_type,
                    "grupo_planificacion": g.get("grPlanif", "N/A"),
                    "proceso": g.get("proceso", "N/A"),
                    "valor_absoluto": g.get("total") if "total" in g else g.get("cantidad"),
                    "porcentaje": g.get("cumplimiento"),
                    "metadata": g
                })

        if "resumenAvisos" in data and "distribucion" in data["resumenAvisos"]:
            procesar_grupos("avisos_pendientes", data["resumenAvisos"]["distribucion"])
            
        if "resumenOrdenes" in data and "distribucion" in data["resumenOrdenes"]:
            procesar_grupos("ordenes_pendientes", data["resumenOrdenes"]["distribucion"])
            
        if "trabajoPlanificado" in data and "grupos" in data["trabajoPlanificado"]:
            procesar_grupos("trabajo_planificado", data["trabajoPlanificado"]["grupos"])
            
        if "programaSemanal" in data and "grupos" in data["programaSemanal"]:
            procesar_grupos("programa_semanal", data["programaSemanal"]["grupos"])
            
        if "planMatriz" in data and "grupos" in data["planMatriz"]:
            procesar_grupos("plan_matriz", data["planMatriz"]["grupos"])
            
        # 3. Insertar métricas masivamente
        if metrics_to_insert:
            # Batch inserts to avoid payload limits if too big, but usually under 100 rows
            supabase.table("kpi_metrics").insert(metrics_to_insert).execute()
            
        print(f"[Supabase] Reporte Semana {semana} guardado exitosamente (Report ID: {report_id})")
        return True
    except Exception as e:
        print(f"[Supabase] Error guardando KPI: {e}")
        return False

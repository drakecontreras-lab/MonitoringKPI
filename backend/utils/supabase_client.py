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

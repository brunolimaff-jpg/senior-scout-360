import time
import re
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Senior Scout 360 API")

# --- CONFIGURAÇÃO DE SEGURANÇA (CORS) ---
# Permite que o seu Frontend (React) converse com este Backend
origins = ["*"]  # Em produção, restringiremos para o domínio do Cloud Run

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REGRAS DE NEGÓCIO (COMPLIANCE) ---

def validate_anti_jair(name: str) -> bool:
    """
    REGRA DE OURO: Bloqueia nomes que começam com números ou sequências 
    numéricas longas (Padrão MEI/PF disfarçado).
    """
    if not name:
        return False
    # Regex: Começa com dígito OU tem sequência de 5+ dígitos
    if re.search(r'^\d', name) or re.search(r'\d{5,}', name):
        return False
    return True

def get_brasil_api_data(cnpj: str):
    """
    RESILIÊNCIA: Tenta conectar 3 vezes com Backoff Exponencial.
    Nunca removemos isso. A BrasilAPI oscila.
    """
    clean_cnpj = re.sub(r'\D', '', cnpj)
    base_url = f"https://brasilapi.com.br/api/cnpj/v1/{clean_cnpj}"
    
    attempts = 0
    delay = 1
    
    while attempts < 3:
        try:
            response = requests.get(base_url, timeout=5)
            if response.status_code == 200:
                return response.json()
            if response.status_code == 404:
                return None # CNPJ não existe
            if response.status_code == 429: # Rate limit
                time.sleep(delay)
        except Exception as e:
            print(f"Erro de conexão (tentativa {attempts+1}): {e}")
        
        attempts += 1
        time.sleep(delay)
        delay *= 2 # Backoff (1s -> 2s -> 4s)
    
    raise HTTPException(status_code=503, detail="Serviço de consulta instável. Tente novamente.")

# --- ROTAS (ENDPOINTS) ---

@app.get("/")
def health_check():
    return {"status": "Senior Scout 360 Operational"}

@app.get("/enrich/{cnpj}")
def enrich_lead(cnpj: str):
    # 1. Consulta BrasilAPI
    data = get_brasil_api_data(cnpj)
    
    if not data:
        raise HTTPException(status_code=404, detail="CNPJ não encontrado na base pública.")

    # Dados brutos
    razao_social = data.get('razao_social', '')
    nome_fantasia = data.get('nome_fantasia', '') or razao_social
    cnae_text = data.get('cnae_fiscal_descricao', '').lower()
    capital = data.get('capital_social', 0)

    # 2. Aplica Filtro Anti-Jair (Server-Side)
    if not validate_anti_jair(nome_fantasia) and not validate_anti_jair(razao_social):
        return {
            "status": "BLOCKED",
            "reason": "Nome inválido detectado (Regra Anti-Jair)",
            "data": {}
        }

    # 3. Inteligência Comercial (Scoring)
    score = 50 # Base Score
    products = ["ERP Senior"] # Obrigatório para todos
    tags = []

    # Regra GAtec (Agronegócio)
    is_agro = 'cultivo' in cnae_text or 'agro' in nome_fantasia.lower() or 'cereal' in cnae_text
    if is_agro:
        score += 30
        products.append("GAtec")
        tags.append("AGRO FOCUS")

    # Regra HCM (Big Fish - Capital > 50MM)
    is_big_fish = capital > 50000000
    if is_big_fish:
        score += 20
        products.append("HCM")
        tags.append("BIG FISH")

    # Regra S/A
    is_sa = "S/A" in razao_social or "S.A." in razao_social
    if is_sa:
        score += 10
        tags.append("S/A")

    return {
        "status": "APPROVED",
        "company": {
            "name": nome_fantasia,
            "cnpj": cnpj,
            "capital": capital,
            "location": f"{data.get('municipio', '')}/{data.get('uf', '')}"
        },
        "intelligence": {
            "score": min(score, 100),
            "products": products,
            "tags": tags,
            "is_big_fish": is_big_fish
        }
    }
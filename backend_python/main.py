import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
import xlwings as xw

# --- Configuração de Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="GPRO Alfa Racing API")

# --- Configuração CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Caminhos ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE_PATH = os.path.normpath(os.path.join(CURRENT_DIR, "..", "data", "calculadora.xlsx"))

# --- Singleton para Conexão Excel ---
class ExcelManager:
    def __init__(self):
        self.app = None
        self.wb = None

    def get_wb(self):
        try:
            if self.app:
                self.app.books.count 
        except:
            self.app = None
            self.wb = None

        if not self.wb:
            logger.info(f"Conectando ao Excel: {EXCEL_FILE_PATH}")
            try:
                if len(xw.apps) > 0:
                    self.app = xw.apps.active
                    for book in self.app.books:
                        if os.path.basename(EXCEL_FILE_PATH) in book.name:
                            self.wb = book
                            logger.info("Conectado a uma instância existente do Excel.")
                            break
            except:
                pass

            if not self.wb:
                logger.info("Iniciando nova instância do Excel...")
                self.app = xw.App(visible=False)
                self.app.display_alerts = False
                self.wb = self.app.books.open(EXCEL_FILE_PATH)
        
        return self.wb

excel_manager = ExcelManager()

# --- Helpers de Limpeza e Escrita ---
def _safe_val(val):
    """Trata valores vindos do Excel para o JSON."""
    if val is None or val == "" or val == "-":
        return None
    if isinstance(val, str):
        val = val.strip()
        if val.lower() == "opt": return "Opt"
        if val.lower() == "best": return "Best"
        if val.lower() == "tyres": return "Tyres"
        try:
            clean = val.replace(',', '.')
            if '.' in clean: return float(clean)
            return int(clean)
        except:
            return val
    return val

def _write_val(sheet, cell, value):
    """Escreve no Excel tratando None como limpar célula."""
    try:
        if value == "" or value is None:
            sheet.range(cell).value = None
        else:
            sheet.range(cell).value = value
    except Exception as e:
        logger.error(f"Erro na célula {cell} ({sheet.name}): {e}")

# --- Endpoints ---

@app.get("/api/python/strategy/state")
async def get_strategy_state():
    """Lê o estado completo do Excel para sincronizar todas as páginas do Frontend."""
    try:
        wb = excel_manager.get_wb()
        sheet_setup = wb.sheets['Setup&WS']
        sheet_tf = wb.sheets['Tyre&Fuel']
        
        # 1. Pista e Opções de Corrida
        pista_atual = _safe_val(sheet_setup.range('R5').value)
        avg_temp = _safe_val(sheet_setup.range('R9').value)

        # 2. Piloto (E6 a E17)
        driver_data = {
            "concentracao": _safe_val(sheet_setup.range('E6').value),
            "talento": _safe_val(sheet_setup.range('E7').value),
            "agressividade": _safe_val(sheet_setup.range('E8').value),
            "experiencia": _safe_val(sheet_setup.range('E9').value),
            "tecnica": _safe_val(sheet_setup.range('E10').value),
            "resistencia": _safe_val(sheet_setup.range('E11').value),
            "carisma": _safe_val(sheet_setup.range('E12').value),
            "motivacao": _safe_val(sheet_setup.range('E13').value),
            "reputacao": _safe_val(sheet_setup.range('E14').value),
            "peso": _safe_val(sheet_setup.range('E15').value),
            "idade": _safe_val(sheet_setup.range('E16').value),
            "energia": _safe_val(sheet_setup.range('E17').value),
            "total": _safe_val(sheet_setup.range('E5').value)
        }

        # 3. Carro (I6:J16)
        car_data = []
        part_names = ["Chassi", "Motor", "Asa dianteira", "Asa traseira", "Assoalho", "Laterais", "Radiador", "Câmbio", "Freios", "Suspensão", "Eletrônicos"]
        for i, name in enumerate(part_names):
            row = 6 + i
            car_data.append({
                "name": name,
                "lvl": _safe_val(sheet_setup.range(f'I{row}').value) or 1,
                "wear": _safe_val(sheet_setup.range(f'J{row}').value) or 0
            })

        # 4. Clima Completo
        weather_data = {
            "tempQ1": _safe_val(sheet_setup.range('R7').value) or 0,
            "tempQ2": _safe_val(sheet_setup.range('R8').value) or 0,
            "weatherQ1": _safe_val(sheet_setup.range('T7').value) or "Dry",
            "weatherQ2": _safe_val(sheet_setup.range('T8').value) or "Dry",
            "weatherRace": _safe_val(sheet_setup.range('T9').value) or "Dry",
            "r1_temp_min": _safe_val(sheet_setup.range('S12').value) or 0,
            "r1_temp_max": _safe_val(sheet_setup.range('T12').value) or 0,
            "r2_temp_min": _safe_val(sheet_setup.range('S13').value) or 0,
            "r2_temp_max": _safe_val(sheet_setup.range('T13').value) or 0,
            "r3_temp_min": _safe_val(sheet_setup.range('S14').value) or 0,
            "r3_temp_max": _safe_val(sheet_setup.range('T14').value) or 0,
            "r4_temp_min": _safe_val(sheet_setup.range('S15').value) or 0,
            "r4_temp_max": _safe_val(sheet_setup.range('T15').value) or 0,
        }

        # 5. Testes
        test_points = {
            "power": _safe_val(sheet_setup.range('N6').value) or 0,
            "handling": _safe_val(sheet_setup.range('N7').value) or 0,
            "accel": _safe_val(sheet_setup.range('N8').value) or 0
        }

        return {
            "sucesso": True, 
            "data": {
                "current_track": pista_atual,
                "driver": driver_data,
                "car": car_data,
                "weather": weather_data,
                "test_points": test_points,
                "race_options": {
                    "avg_temp": avg_temp,
                    "desgaste_pneu_percent": _safe_val(sheet_tf.range('G3').value)
                }
            }
        }
    except Exception as e:
        logger.error(f"Erro ao ler estado: {e}")
        return {"sucesso": False, "message": str(e)}

@app.post("/api/python/update_driver_car")
async def update_driver_car(data: Dict[Any, Any]):
    """Salva dados do Piloto e do Carro vindos da Visão Geral."""
    try:
        wb = excel_manager.get_wb()
        sheet_setup = wb.sheets['Setup&WS']
        
        # Escreve Piloto
        d = data.get('driver', {})
        _write_val(sheet_setup, 'E6', d.get('concentracao'))
        _write_val(sheet_setup, 'E7', d.get('talento'))
        _write_val(sheet_setup, 'E8', d.get('agressividade'))
        _write_val(sheet_setup, 'E9', d.get('experiencia'))
        _write_val(sheet_setup, 'E10', d.get('tecnica'))
        _write_val(sheet_setup, 'E11', d.get('resistencia'))
        _write_val(sheet_setup, 'E12', d.get('carisma'))
        _write_val(sheet_setup, 'E13', d.get('motivacao'))
        _write_val(sheet_setup, 'E14', d.get('reputacao'))
        _write_val(sheet_setup, 'E15', d.get('peso'))
        _write_val(sheet_setup, 'E16', d.get('idade'))
        _write_val(sheet_setup, 'E17', d.get('energia'))

        # Escreve Carro
        car_parts = data.get('car', [])
        for i, part in enumerate(car_parts):
            row = 6 + i
            _write_val(sheet_setup, f'I{row}', part.get('lvl'))
            _write_val(sheet_setup, f'J{row}', part.get('wear'))
        
        # Escreve Pontos de Teste
        tp = data.get('test_points', {})
        _write_val(sheet_setup, 'N6', tp.get('power'))
        _write_val(sheet_setup, 'N7', tp.get('handling'))
        _write_val(sheet_setup, 'N8', tp.get('accel'))

        wb.app.calculate()
        return {"sucesso": True, "oa": _safe_val(sheet_setup.range('E5').value)}
    except Exception as e:
        return {"sucesso": False, "message": str(e)}

@app.post("/api/python/update_setup_weather")
async def update_setup_weather(data: Dict[Any, Any]):
    """Salva dados de clima e temperaturas vindos da página de Setup."""
    try:
        wb = excel_manager.get_wb()
        sheet_setup = wb.sheets['Setup&WS']
        
        _write_val(sheet_setup, 'R7', data.get('tempQ1'))
        _write_val(sheet_setup, 'R8', data.get('tempQ2'))
        _write_val(sheet_setup, 'R9', data.get('avgTemp'))
        _write_val(sheet_setup, 'T7', data.get('weatherQ1'))
        _write_val(sheet_setup, 'T8', data.get('weatherQ2'))
        _write_val(sheet_setup, 'T9', data.get('weatherRace'))
        
        # Temperaturas Detalhadas
        _write_val(sheet_setup, 'S12', data.get('r1_temp_min'))
        _write_val(sheet_setup, 'T12', data.get('r1_temp_max'))
        _write_val(sheet_setup, 'S13', data.get('r2_temp_min'))
        _write_val(sheet_setup, 'T13', data.get('r2_temp_max'))
        _write_val(sheet_setup, 'S14', data.get('r3_temp_min'))
        _write_val(sheet_setup, 'T14', data.get('r3_temp_max'))
        _write_val(sheet_setup, 'S15', data.get('r4_temp_min'))
        _write_val(sheet_setup, 'T15', data.get('r4_temp_max'))
        
        return {"sucesso": True}
    except Exception as e:
        return {"sucesso": False, "message": str(e)}

@app.post("/api/python/setup/calculate")
async def calculate_setup(data: Dict[Any, Any]):
    """Faz o cálculo completo do Setup Ideal e Desgaste das peças."""
    try:
        wb = excel_manager.get_wb()
        sheet_setup = wb.sheets['Setup&WS']
        
        # Pista
        pista = data.get('pista')
        if pista and pista != "Selecionar Pista": _write_val(sheet_setup, 'R5', pista)

        # Clima e Risco
        _write_val(sheet_setup, 'R7', data.get('tempQ1'))
        _write_val(sheet_setup, 'R8', data.get('tempQ2'))
        _write_val(sheet_setup, 'R9', data.get('avgTemp'))
        _write_val(sheet_setup, 'T7', data.get('weatherQ1'))
        _write_val(sheet_setup, 'T8', data.get('weatherQ2'))
        _write_val(sheet_setup, 'T9', data.get('weatherRace'))

        wb.app.calculate()

        # Leitura Setup (AC6:AE11)
        setup_q1 = [ _safe_val(sheet_setup.range(f'AC{r}').value) for r in range(6, 12) ]
        setup_q2 = [ _safe_val(sheet_setup.range(f'AD{r}').value) for r in range(6, 12) ]
        setup_race = [ _safe_val(sheet_setup.range(f'AE{r}').value) for r in range(6, 12) ]

        # Leitura Desgaste (Coluna K)
        wear_results = []
        for r in range(6, 17):
            wear_results.append({"start": _safe_val(sheet_setup.range(f'J{r}').value), "end": _safe_val(sheet_setup.range(f'K{r}').value)})

        resultado = {
            "asaDianteira": { "q1": setup_q1[0], "q2": setup_q2[0], "race": setup_race[0], "wear": wear_results[2] },
            "asaTraseira":  { "q1": setup_q1[1], "q2": setup_q2[1], "race": setup_race[1], "wear": wear_results[3] },
            "motor":        { "q1": setup_q1[2], "q2": setup_q2[2], "race": setup_race[2], "wear": wear_results[1] },
            "freios":       { "q1": setup_q1[3], "q2": setup_q2[3], "race": setup_race[3], "wear": wear_results[8] },
            "cambio":       { "q1": setup_q1[4], "q2": setup_q2[4], "race": setup_race[4], "wear": wear_results[7] },
            "suspensao":    { "q1": setup_q1[5], "q2": setup_q2[5], "race": setup_race[5], "wear": wear_results[9] },
            "chassi":       {"wear": wear_results[0]}, "assoalho": {"wear": wear_results[4]}, "laterais": {"wear": wear_results[5]}, "radiador": {"wear": wear_results[6]}, "eletronicos": {"wear": wear_results[10]}
        }
        return {"sucesso": True, "data": resultado}
    except Exception as e:
        return {"sucesso": False, "message": str(e)}

@app.post("/api/python/strategy/calculate")
async def calculate_strategy(data: Dict[Any, Any]):
    """Faz o cálculo da estratégia de pneus, combustível e boosts."""
    try:
        wb = excel_manager.get_wb()
        sheet_tf = wb.sheets['Tyre&Fuel']
        sheet_setup = wb.sheets['Setup&WS'] 
        
        # ==========================================
        # 1. ESCRITA DE INPUTS (DO FRONTEND PARA O EXCEL)
        # ==========================================
        
        # A. Pista e Opções Gerais
        pista = data.get('pista')
        if pista and pista != "Selecionar Pista": _write_val(sheet_setup, 'R5', pista)
            
        ro = data.get('race_options', {})
        _write_val(sheet_tf, 'G3', ro.get('desgaste_pneu_percent'))
        _write_val(sheet_tf, 'C3', ro.get('condicao'))
        _write_val(sheet_tf, 'C4', ro.get('ct_valor'))
        _write_val(sheet_tf, 'C5', ro.get('pneus_fornecedor'))
        _write_val(sheet_tf, 'C6', ro.get('tipo_pneu'))
        _write_val(sheet_tf, 'C7', ro.get('pitstops_num'))
        _write_val(sheet_setup, 'R9', ro.get('avg_temp'))

        # B. Voltas Manuais (Personal Stints) - Linha 21
        # Stint 1 = Coluna G (chr 71), Stint 2 = H, etc.
        ps = data.get('personal_stint_voltas', {})
        if ps:
            for i in range(1, 9):
                col_letter = chr(70 + i) # 70=F, 71=G. Stint 1 é G.
                _write_val(sheet_tf, f'{col_letter}21', ps.get(f"stint{i}"))

        # C. Boosts Inputs - Coluna R, Linhas 20-22 (Amarelas na imagem)
        bl = data.get('boost_laps', {})
        _write_val(sheet_tf, 'R20', bl.get('boost1', {}).get('volta'))
        _write_val(sheet_tf, 'R21', bl.get('boost2', {}).get('volta'))
        _write_val(sheet_tf, 'R22', bl.get('boost3', {}).get('volta'))

        # ==========================================
        # 2. CÁLCULO
        # ==========================================
        wb.app.calculate()

        # ==========================================
        # 3. LEITURA DE RESULTADOS (DO EXCEL PARA O JSON)
        # ==========================================

        # A. Resultados Gerais e Stints Normais
        output = {
            "race_calculated_data": {
                "nivel_aderencia": _safe_val(sheet_tf.range('D24').value),
                "consumo_combustivel": _safe_val(sheet_tf.range('D22').value),
                "desgaste_pneu_str": _safe_val(sheet_tf.range('D23').value),
                "ultrapassagem": _safe_val(sheet_tf.range('D17').value),
                "voltas": _safe_val(sheet_tf.range('D18').value),
                "pit_io": _safe_val(sheet_tf.range('D19').value),
                "tcd_corrida": _safe_val(sheet_tf.range('D21').value),
            },
            "compound_details_outputs": {}, 
            "stints_predefined": {}, 
            "stints_personal": {},
            "boost_laps_outputs": {},       # Inicializa vazio para preencher abaixo
            "boost_mini_stints_outputs": {} # Inicializa vazio para preencher abaixo
        }
        
        # B. Detalhes Compostos (Linhas 6 a 9)
        rows_comp = {"Extra Soft": 6, "Soft": 7, "Medium": 8, "Hard": 9}
        for comp, row in rows_comp.items():
            output["compound_details_outputs"][comp] = {
                "req_stops": _safe_val(sheet_tf.range(f'G{row}').value),
                "fuel_load": _safe_val(sheet_tf.range(f'K{row}').value),
                "tyre_wear": _safe_val(sheet_tf.range(f'N{row}').value),
                "total": _safe_val(sheet_tf.range(f'O{row}').value)
            }

        # C. Stints (Automático 14, Manual 21)
        for st_key, start_row in [("stints_predefined", 14), ("stints_personal", 21)]:
            for label, row_offset in [("voltas", 0), ("desg_final_pneu", 1), ("comb_necessario", 2), ("est_tempo_pit", 3), ("voltas_em_bad", 4)]:
                row_idx = start_row + row_offset
                row_data = { f"stint{j}": _safe_val(sheet_tf.range(f"{chr(70+j)}{row_idx}").value) for j in range(1, 9) }
                row_data["total"] = _safe_val(sheet_tf.range(f"O{row_idx}").value)
                output[st_key][label] = row_data

        # D. Leitura Boosts - Lado Direito (Colunas S e T, Linhas 20-22)
        for i in range(1, 4):
            row = 19 + i # 20, 21, 22
            output["boost_laps_outputs"][f"boost{i}"] = {
                "stint": _safe_val(sheet_tf.range(f'S{row}').value),      
                "voltas_list": _safe_val(sheet_tf.range(f'T{row}').value) 
            }

        # E. Leitura Combustível Stints Boost (Rodapé da Imagem - Linhas 24 e 25)
        # Stint 1 = Coluna R (ASCII 82)
        for i in range(1, 9): 
            col_char = chr(82 + i - 1) # R, S, T, U...
            output["boost_mini_stints_outputs"][f"stint{i}"] = {
                "val1": _safe_val(sheet_tf.range(f'{col_char}25').value), # Litros (Ex: 61 L)
                "val2": _safe_val(sheet_tf.range(f'{col_char}24').value)  # Qtd Boosts (Ex: 1)
            }

        return {"sucesso": True, "data": output}
    except Exception as e:
        logger.error(f"Erro Strategy: {e}")
        return {"sucesso": False, "message": str(e)}

@app.get("/api/python/tracks")
async def get_tracks():
    try:
        wb = excel_manager.get_wb()
        tracks = [x for x in wb.sheets['Tracks'].range('A4:A67').value if x]
        return {"sucesso": True, "tracks": tracks}
    except Exception as e:
        return {"sucesso": False, "message": str(e)}

@app.get("/api/python/tyre_suppliers")
async def get_suppliers():
    suppliers = ["Pipirelli", "Avonn", "Yokomama", "Dunnolop", "Contimental", "Badyear", "Hancock", "Michelini", "Bridgerock"]
    return {"sucesso": True, "suppliers": suppliers}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
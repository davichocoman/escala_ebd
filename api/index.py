from flask import Flask, request, jsonify, render_template # Adicionado render_template e jsonify
import gspread
from google.oauth2.service_account import Credentials # Import correto para ServiceAccountCredentials
from datetime import datetime
import os
import json

# --- Configuração de Credenciais Google Sheets ---
cred_raw = os.getenv("GOOGLE_CREDENTIALS")
if not cred_raw:
    raise ValueError("Variável de ambiente GOOGLE_CREDENTIALS não está definida! Crie um arquivo .env ou defina-a.")

try:
    JSON_CRED_FILE = json.loads(cred_raw)
except Exception as e:
    raise ValueError(f"Erro ao carregar JSON de credenciais: {str(e)}")

scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def conectar_sheets(sheet_name, aba):
    # Corrigido: Use Credentials.from_service_account_info e passe o dicionário JSON_CRED_FILE
    credentials = Credentials.from_service_account_info(JSON_CRED_FILE, scopes=scopes)
    client = gspread.authorize(credentials)
    return client.open(sheet_name).worksheet(aba)


# --- Configuração do Aplicativo Flask ---
app = Flask(__name__,
            template_folder='../templates', # Define que a pasta de templates está um nível acima de 'api'
            static_folder='../static')      # Define que a pasta de arquivos estáticos está um nível acima de 'api'

# Rota principal para servir o HTML estático
@app.route("/", methods=["GET"])
def serve_index():
    return render_template("index.html", year=datetime.now().year)

# Rota da API para a Escala de Professores
@app.route("/api/schedule", methods=["POST"])
def get_schedule():
    try:
        classe = request.form.get("classe", "Coordenação") # O frontend envia 'classe' no formulário
        planilha = conectar_sheets("Escala EBD", classe) # Nome da sua planilha de Escala
        planilha_temas = conectar_sheets("Escala EBD", "Temas")

        if not planilha or not planilha_temas:
            return jsonify({"erro": "Erro ao conectar com a planilha de escalas ou de temas."}), 500

        # Cabeçalhos esperados da sua PLANILHA DE ESCALA (a antiga)
        valores = planilha.get_all_records(expected_headers=["DATA", "PROFESSOR", "LIÇÃO", "TRIMESTRE", "TEMA"])
        temas = planilha_temas.get_all_records(expected_headers=["CLASSE", "TRIMESTRE", "TEMA"])

        # Organize os dados por trimestre para o frontend
        trimestre_data = {
            "1": [], "2": [], "3": [], "4": []
        }

        lista_de_temas = []

        for tema in temas:
            if tema["CLASSE"] == classe:
                lista_de_temas.append(tema) 

        for aula in valores:
            # Extrai o número do trimestre (ex: "1" de "1 Trimestre")
            trimester_num_str = str(aula.get("TRIMESTRE", "")).split(' ')[0]
            if trimester_num_str in trimestre_data:
                trimestre_data[trimester_num_str].append(aula)

        return jsonify({
            "classe": classe,
            "year": datetime.now().year, # Inclua o ano se o frontend precisar
            "temas": lista_de_temas,
            "trimestre_1": trimestre_data["1"],
            "trimestre_2": trimestre_data["2"],
            "trimestre_3": trimestre_data["3"],
            "trimestre_4": trimestre_data["4"]
        })

    except Exception as e:
        print(f"Erro interno na rota /api/schedule: {e}")
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

# Rota da API para Lições (NOVA ROTA para sua nova planilha)
@app.route("/api/lessons", methods=["GET"])
def get_lessons():
    try:
        # Conecte à sua nova planilha de lições. Adapte o nome da planilha e da aba.
        planilha_licoes = conectar_sheets("Escala EBD", "Lições") # Nome da sua nova planilha e aba

        if not planilha_licoes:
            return jsonify({"erro": "Erro ao conectar com a planilha de lições."}), 500

        # Os headers da sua nova planilha de Lições (ajuste conforme os nomes exatos)
        lessons_data = planilha_licoes.get_all_records(
            expected_headers=["TITULO", "SUB-TITULO", "CLASSE", "TRIMESTRE", "TIPO", "IMAGEM", "LINK"]
        )

        # Formate os dados para o que o frontend espera
        formatted_lessons = []
        for lesson in lessons_data:
            formatted_lessons.append({
                "id": f"{lesson.get('TRIMESTRE', '')}-{lesson.get('CLASSE', '')}-{lesson.get('TIPO', '')}".replace(' ', '-').lower(),
                "title": lesson.get("TITULO", ""),
                "trimester": int(lesson.get("TRIMESTRE", 0)), # O JS espera um número
                "theme": lesson.get("SUB-TITULO", ""),
                "coverImage": lesson.get("IMAGEM", ""),
                "driveLink": lesson.get("LINK", ""),
                "type": lesson.get("TIPO", "").lower(), # 'professor' ou 'aluno'
                "class": lesson.get("CLASSE", "")
            })
        
        return jsonify(formatted_lessons)

    except Exception as e:
        print(f"Erro interno na rota /api/lessons: {e}")
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500


# Exporta o app para ser usado como handler no Vercel
handler = app


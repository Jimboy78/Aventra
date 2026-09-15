# Aventra Backend

Generador de Historias Interactivas con IA - Backend API

## Características

- **FastAPI** - API REST moderna y rápida
- **LangChain** - Orquestación de IA y memoria conversacional  
- **GPT-4.1 mini** - Generación de narrativa
- **Gemini 2.5 Flash** - Generación de imágenes
- **Sistema de Estado JSON** - Persistencia completa del juego
- **Debug y Trazas** - Sistema completo de monitoreo
- **Parches JSON** - Actualizaciones eficientes de estado

## Instalación

### Requisitos
- Python 3.9+
- pip

### Configuración

1. Instalar dependencias:
```bash
pip install -r requirements.txt
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus API keys
```

3. Variables de entorno requeridas:
```
OPENAI_API_KEY=tu_api_key_de_openai
GOOGLE_API_KEY=tu_api_key_de_google  
DEBUG=true
CORS_ORIGINS=http://localhost:3000
```

## Ejecución

### Método 1: Script principal
```bash
python main.py
```

### Método 2: Uvicorn directo
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El servidor se iniciará en `http://localhost:8000`

## Endpoints Principales

### Setup de Sesión
```http
POST /api/setup-session
```
Inicializa una nueva sesión de juego con personaje y mundo.

### Generar Historia
```http
POST /api/generate-story
```
Genera continuación de historia basada en input del usuario.

### Actualizar Estado
```http
POST /api/update-state
```
Aplica parches JSON al estado del juego.

### Generar Imagen
```http
POST /api/generate-image
```
Genera imágenes usando Gemini 2.5 Flash.

### Consultas de Estado
```http
GET /api/state/player-view
GET /api/state/player-view/character
GET /api/state/player-view/inventory
GET /api/state/player-view/monster/{monster_id}
```

### Debug
```http
GET /api/debug/performance
GET /api/debug/health
POST /api/debug/clear-metrics
```

## Documentación API

Una vez iniciado el servidor, la documentación interactiva está disponible en:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Estructura del Proyecto

```
backend/
├── app/
│   ├── models/          # Modelos Pydantic
│   │   ├── state.py     # Estado del juego
│   │   └── output.py    # Respuestas de API
│   ├── services/        # Lógica de negocio
│   │   ├── game_service.py    # Servicio principal del juego
│   │   ├── ai_service.py      # Integración con LangChain/GPT
│   │   ├── image_service.py   # Generación de imágenes
│   │   └── state_service.py   # Gestión de estado
│   ├── routes/          # Endpoints REST
│   │   ├── setup.py     # Setup de sesión
│   │   ├── story.py     # Generación de historia
│   │   ├── state.py     # Gestión de estado
│   │   ├── images.py    # Imágenes
│   │   └── debug.py     # Debug y métricas
│   ├── utils/           # Utilidades
│   │   ├── logger.py    # Sistema de logging
│   │   ├── debug.py     # Sistema de debug/trazas
│   │   └── json_patch.py # Parches JSON
│   └── main.py          # Aplicación FastAPI
├── main.py              # Punto de entrada
├── requirements.txt     # Dependencias
├── .env.example        # Variables de entorno ejemplo
└── README.md           # Este archivo
```

## Modo Debug

El sistema incluye un modo debug completo:

### Configuración Debug
```json
{
  "enabled": true,
  "level": "verbose",
  "include": {
    "prompts": true,
    "state_patches": true,
    "memory_ops": true,
    "risk_resolution": true,
    "timing": true
  }
}
```

### Niveles de Debug
- `basic` - Información básica
- `verbose` - Información detallada  
- `trace` - Información completa (incluye prompts)

## Sistema de Estado

El juego mantiene un estado JSON completo que incluye:

- **Escena actual** - Ubicación, ambiente, descripción
- **Personajes** - Jugador, NPCs, aliados, enemigos
- **Inventario** - Items con cantidades y descripciones
- **Monstruos** - Criaturas activas con nivel de amenaza
- **Misiones** - Quests activas con objetivos
- **Banderas** - Variables globales del juego
- **Memoria** - Resumen conversacional
- **Posición narrativa** - Capítulo y turno actual

## Integración con IA

### LangChain
- Memoria conversacional con resúmenes
- Salidas estructuradas JSON
- Orquestación de cadenas de prompts

### GPT-4.1 mini
- Generación de narrativa
- Actualización de estado
- Sugerencias de acciones con niveles de riesgo

### Gemini 2.5 Flash
- Generación de imágenes descriptivas
- Transporte en Base64
- Estilos personalizables

## Desarrollo

### Agregar nuevos endpoints
1. Crear archivo en `app/routes/`
2. Implementar lógica en `app/services/`
3. Agregar modelos en `app/models/`
4. Registrar router en `app/main.py`

### Testing
```bash
# Instalar dependencias de testing
pip install pytest pytest-asyncio httpx

# Ejecutar tests
pytest tests/
```

## Troubleshooting

### Error: API Key no configurada
```
WARNING - Missing required environment variables: ['OPENAI_API_KEY']
```
Solución: Configurar las API keys en el archivo `.env`

### Error: Puerto en uso
```
OSError: [Errno 98] Address already in use
```
Solución: Cambiar puerto en `main.py` o terminar proceso existente

### Error: Dependencias faltantes
```
ModuleNotFoundError: No module named 'package_name'
```
Solución: `pip install -r requirements.txt`

## Contribuir

1. Fork del repositorio
2. Crear branch para feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Agregar nueva funcionalidad'`
4. Push al branch: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## Licencia

[Especificar licencia]
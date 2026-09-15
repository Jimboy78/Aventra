# Sistema de Guardado de Partidas - Aventra

## 📋 Resumen

El sistema de guardado de Aventra permite a los usuarios guardar y cargar sus partidas completamente, con soporte para:

- **Guardado manual** con títulos personalizados
- **Auto-guardado** automático cada 5 turnos
- **Metadatos completos** de cada partida
- **Export/Import** de partidas
- **Gestión avanzada** con limpieza y estadísticas
- **Validación** y sistema de backup

## 🗂️ Estructura de Datos

### SaveGameMetadata
Metadatos que se almacenan para cada partida:

```python
{
    "save_id": "uuid-único",
    "title": "Título de la partida",
    "player_name": "Nombre del jugador",
    "world_name": "Nombre del mundo",
    "chapter": 1,
    "turn": 15,
    "location": "Ubicación actual",
    "created_at": "2024-01-01T12:00:00",
    "updated_at": "2024-01-01T12:30:00",
    "playtime_minutes": 30,
    "thumbnail_description": "En Taberna, con 5 items",
    "game_over": false,
    "auto_save": false
}
```

### Estructura de Archivos
```
data/saves/
├── save_index.json                 # Índice de todas las partidas
├── {save_id}.json                 # Archivo de partida completo
├── metadata/
│   └── {save_id}_meta.json        # Metadatos de la partida
└── backups/
    └── {save_id}_backup.json      # Backup de partidas manuales
```

## 🚀 API Endpoints

### Guardado y Carga

#### POST `/api/saves/save-game`
Guarda una partida manualmente.

**Request:**
```json
{
    "state": { /* Estado completo del juego */ },
    "session_id": "session_123",
    "title": "Mi Aventura Épica",
    "auto_save": false
}
```

**Response:**
```json
{
    "success": true,
    "save_id": "uuid-de-la-partida",
    "title": "Mi Aventura Épica",
    "auto_save": false,
    "saved_at": "2024-01-01T12:00:00"
}
```

#### GET `/api/saves/load-game/{save_id}`
Carga una partida guardada.

**Response:**
```json
{
    "success": true,
    "save_id": "uuid-de-la-partida",
    "state": { /* Estado completo del juego */ },
    "session_id": "session_123",
    "metadata": { /* Metadatos completos */ },
    "loaded_at": "2024-01-01T12:00:00"
}
```

#### GET `/api/saves/saves`
Lista todas las partidas guardadas.

**Query Parameters:**
- `include_auto_saves`: boolean (default: true)

**Response:**
```json
[
    {
        "save_id": "uuid-1",
        "title": "Aventura 1",
        "player_name": "Aragorn",
        "world_name": "Tierra Media",
        "chapter": 2,
        "turn": 25,
        "location": "Bosque Oscuro",
        "created_at": "2024-01-01T10:00:00",
        "updated_at": "2024-01-01T11:30:00",
        "thumbnail_description": "En Bosque Oscuro, con 8 items",
        "game_over": false,
        "auto_save": false,
        "file_size": 15648
    }
]
```

#### DELETE `/api/saves/delete-save/{save_id}`
Elimina una partida guardada.

### Auto-Guardado

#### POST `/api/saves/auto-save`
Realiza auto-guardado si corresponde.

**Request:** (mismo que save-game)

**Response:**
```json
{
    "success": true,
    "save_id": "autosave_session_123_25",
    "auto_save": true,
    "saved_at": "2024-01-01T12:00:00"
}
```

### Gestión

#### GET `/api/saves/save-stats`
Estadísticas del sistema de guardado.

**Response:**
```json
{
    "total_saves": 15,
    "manual_saves": 12,
    "auto_saves": 3,
    "total_size_bytes": 2097152,
    "total_size_mb": 2.0,
    "oldest_save": "2024-01-01T08:00:00",
    "newest_save": "2024-01-01T12:00:00"
}
```

#### POST `/api/saves/cleanup-saves`
Limpia archivos huérfanos y corruptos.

#### GET `/api/saves/save-details/{save_id}`
Detalles de una partida específica.

#### POST `/api/saves/rename-save/{save_id}`
Renombra una partida.

### Export/Import

#### GET `/api/saves/export-save/{save_id}`
Descarga una partida como archivo JSON.

#### POST `/api/saves/import-save`
Importa una partida desde archivo.

**Form Data:**
- `file`: Archivo JSON de la partida

## ⚙️ Configuración del Auto-Guardado

```python
# En SaveService.__init__()
self.auto_save_enabled = True          # Habilitar auto-guardado
self.auto_save_interval_turns = 5      # Auto-guardar cada 5 turnos
self.max_auto_saves = 3               # Mantener últimos 3 auto-guardados
```

## 🔧 Integración en GameService

El auto-guardado se ejecuta automáticamente en cada turno:

```python
async def generate_story(...):
    # ... generar historia ...
    
    # Update state if needed
    if session_id:
        await self.state_service.store_session(session_id, state)
        
        # Check for auto-save
        should_auto_save = await self.save_service.should_auto_save(state, session_id)
        if should_auto_save:
            auto_save_result = await self.save_service.auto_save_game(state, session_id)
            logger.info(f"Auto-save triggered: {auto_save_result.get('success', False)}")
```

## 🧪 Testing

Para probar el sistema completo:

```bash
cd backend
python test_save_system.py
```

Esto ejecuta tests para:
- ✅ Guardado y carga básico
- ✅ Sistema de auto-guardado
- ✅ Gestión de partidas
- ✅ Export/Import
- ✅ Casos edge y manejo de errores

## 📱 Uso desde Frontend

### Guardar Partida Manual
```typescript
const saveGame = async (state: GameState, title: string) => {
    const response = await fetch('/api/saves/save-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            state,
            session_id: currentSessionId,
            title,
            auto_save: false
        })
    });
    
    const result = await response.json();
    if (result.success) {
        console.log('Partida guardada:', result.save_id);
    }
};
```

### Listar Partidas
```typescript
const loadSavesList = async () => {
    const response = await fetch('/api/saves/saves?include_auto_saves=false');
    const saves = await response.json();
    
    return saves.map(save => ({
        id: save.save_id,
        title: save.title,
        playerName: save.player_name,
        location: save.location,
        progress: `Capítulo ${save.chapter}, Turno ${save.turn}`,
        lastPlayed: new Date(save.updated_at),
        isGameOver: save.game_over
    }));
};
```

### Cargar Partida
```typescript
const loadGame = async (saveId: string) => {
    const response = await fetch(`/api/saves/load-game/${saveId}`);
    const result = await response.json();
    
    if (result.success) {
        return {
            state: result.state,
            sessionId: result.session_id,
            metadata: result.metadata
        };
    } else {
        throw new Error(result.error);
    }
};
```

## 🔒 Características de Seguridad

1. **Validación de datos**: Todos los saves se validan antes de guardar/cargar
2. **Backups automáticos**: Las partidas manuales tienen backup automático
3. **Limpieza automática**: Los auto-saves antiguos se eliminan automáticamente
4. **Detección de corrupción**: Se detectan y manejan archivos corruptos
5. **IDs únicos**: Cada partida tiene un UUID único para evitar conflictos

## 📊 Monitoreo y Mantenimiento

### Estadísticas Disponibles
- Total de partidas guardadas
- Número de partidas manuales vs auto-saves
- Tamaño total ocupado en disco
- Partida más antigua y más nueva

### Tareas de Mantenimiento
- Limpieza automática de auto-saves antiguos
- Detección y eliminación de archivos huérfanos
- Validación de integridad de datos
- Compresión de backups antiguos

## 🚨 Resolución de Problemas

### Error: "Save file not found"
- Verificar que el save_id existe en la lista
- Comprobar permisos de archivo
- Ejecutar cleanup para archivos huérfanos

### Error: "Invalid save data format" 
- El archivo está corrupto
- Intentar restaurar desde backup
- Verificar versión de compatibilidad

### Auto-save no funciona
- Verificar que `auto_save_enabled = True`
- Comprobar que han pasado suficientes turnos
- Revisar logs para errores de escritura

## 🔄 Migración y Versionado

El sistema incluye versionado para futuras migraciones:

```python
save_data = {
    "save_version": "1.0",  # Versión del formato de guardado
    "metadata": { ... },
    "state": { ... }
}
```

Esto permite futuras actualizaciones sin romper partidas existentes.
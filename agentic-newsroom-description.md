# Agentic Newsroom - Descripción Técnica Detallada

## 📋 Resumen Ejecutivo

**Agentic Newsroom** es una plataforma inteligente de monitoreo y análisis de noticias que utiliza agentes de IA para automatizar el flujo de trabajo completo de una agencia de noticias moderna. El sistema ingesta feeds RSS, detecta idiomas, traduce contenido a español, extrae entidades nombradas (NER) y proporciona una interfaz web completa para la gestión editorial.

---

## 🏗️ Arquitectura del Sistema

### Estructura del Proyecto

```
agentic-newsroom/
├── backend/                    # API FastAPI + Servicios de Agentes IA
│   ├── main.py                # Punto de entrada, endpoints REST, migraciones
│   ├── models.py              # Modelos SQLAlchemy (ORM)
│   ├── schemas.py             # Esquemas Pydantic (validación)
│   ├── database.py            # Configuración SQLite + Session factory
│   ├── migrate_db.py          # Script de migración manual
│   ├── requirements.txt       # Dependencias Python
│   └── services/              # Lógica de negocio de los agentes
│       ├── __init__.py
│       ├── ingestor.py        # Ingesta y procesamiento de RSS
│       ├── translator.py      # Traducción con Groq/LLMs
│       ├── extractor.py       # Extracción de entidades con SpaCy
│       └── crawler.py         # Web scraping adicional
└── frontend/                   # Aplicación React + Vite
    ├── src/
    │   ├── App.jsx            # Router principal y providers
    │   ├── main.jsx           # Entry point React
    │   ├── index.css          # Estilos globales Tailwind
    │   ├── pages/             # Vistas principales
    │   │   ├── News.jsx       # Dashboard de noticias descubiertas
    │   │   ├── Newsroom.jsx   # Noticias aprobadas
    │   │   ├── Sources.jsx    # Gestión de fuentes RSS
    │   │   ├── Entities.jsx   # Gestión de entidades (NER)
    │   │   ├── Topics.jsx     # Temas de interés
    │   │   ├── Tags.jsx       # Sistema de etiquetas
    │   │   ├── AIConfig.jsx   # Configuración de IA
    │   │   ├── Settings.jsx   # Configuración general
    │   │   └── Trash.jsx      # Papelera de reciclaje
    │   ├── components/        # Componentes reutilizables
    │   │   ├── Layout.jsx     # Layout principal con sidebar
    │   │   ├── Sidebar.jsx    # Navegación lateral
    │   │   ├── Reader.jsx     # Lector de noticias
    │   │   └── StatusBar.jsx  # Barra de estado
    │   ├── context/           # Estado global (Context API)
    │   │   ├── ToastContext.jsx   # Notificaciones toast
    │   │   ├── ThemeContext.jsx   # Modo claro/oscuro
    │   │   └── HighlightContext.jsx # Sistema de highlights
    │   └── lib/
    │       └── utils.js       # Utilidades (clsx, cn)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## 🔧 Stack Tecnológico

### Backend (Python 3.8+)

| Tecnología | Propósito |
|------------|-----------|
| **FastAPI** | Framework web asíncrono para API REST |
| **SQLAlchemy** | ORM para gestión de base de datos |
| **SQLite** | Base de datos embebida (archivo `news.db`) |
| **Pydantic** | Validación y serialización de datos |
| **Groq** | Inferencia rápida de LLMs (traducción) |
| **Google Gemini** | LLM alternativo configurado |
| **SpaCy** (`es_core_news_lg`) | NER local para extracción de entidades en español |
| **langdetect** | Detección automática de idioma |
| **feedparser** | Parseo de feeds RSS/Atom |
| **BeautifulSoup4** | Limpieza de HTML |
| **requests** | Cliente HTTP para ingesta |
| **crawl4ai** | Web scraping avanzado |
| **playwright** | Automatización de navegador |

### Frontend (Node.js 18+)

| Tecnología | Propósito |
|------------|-----------|
| **React 18** | Framework UI component-based |
| **Vite** | Build tool y dev server ultrarrápido |
| **Tailwind CSS** | Utility-first CSS framework |
| **React Router v6** | Enrutamiento cliente-side |
| **Context API** | Estado global (sin Redux) |
| **Lucide React** | Iconografía moderna |
| **Axios** | Cliente HTTP para comunicación con backend |
| **clsx + tailwind-merge** | Utilidades para clases condicionales |

---

## 🔄 Flujo de Procesamiento (Pipeline de IA)

El sistema implementa un pipeline de procesamiento multi-etapa completamente automatizado:

### Etapa 1: Ingesta (`ingestor.py`)

**Función principal:** `process_feeds(db)`

1. **Escaneo de fuentes**: Itera sobre todas las fuentes RSS activas registradas
2. **Filtro temporal**: Solo procesa noticias de las últimas 24 horas
3. **Deduplicación**: Verifica existencia por URL antes de insertar
4. **Extracción de contenido**: 
   - Prioriza: `content` > `summary_detail` > `summary` > `description`
   - Limpia HTML con BeautifulSoup
5. **Detección de idioma**: Usa `langdetect` en título + snippet
6. **Persistencia**: Guarda en `NewsItem` con estado `DISCOVERED`

**Retorna:** `(count_nuevas_noticias, [lista_ids])`

---

### Etapa 2: Traducción (`translator.py`)

**Función principal:** `process_pending_translations(db, item_ids)`

**Disparador:** Items donde `title_es IS NULL`

#### Fase Local (pre-procesamiento):
1. Detecta idioma si no está registrado
2. Si es español (`language == 'es'`):
   - Copia `title` → `title_es`
   - Copia `content_snippet` → `content_es`
   - **No consume tokens de API**

#### Fase API (batch processing):
1. **Agrupamiento**: Procesa en lotes de 5 noticias
2. **Prompt engineering**: Construye prompt batch con instrucciones de:
   - Traducción al español neutro
   - Tono periodístico
   - Reglas gramaticales específicas (sin punto en títulos, con punto en contenido)
   - Formato JSON estricto
3. **Llamada a Groq**: Usa modelo `llama-3.1-8b-instant` (configurable)
4. **Rate limiting**: Pausa de 12 segundos entre lotes
5. **Métricas**: Loggea tokens de entrada/salida, tiempo de respuesta
6. **Extracción automática**: Dispara `extractor.process_pending_entities()` tras cada lote

**Características destacadas:**
- Manejo de fallback si la API falla
- Logging detallado de métricas por lote
- Acumulación de estadísticas de tokens

---

### Etapa 3: Extracción de Entidades (`extractor.py`)

**Funciones principales:**
- `process_pending_entities(db, item_ids)` - Para noticias traducidas
- `process_native_pending(db)` - Para noticias nativas en español

**Motor:** SpaCy con modelo `es_core_news_lg`

#### Estrategia Híbrida de Extracción:

**Paso 1: NER Estadístico (SpaCy)**
- Extrae entidades usando el modelo pre-entrenado
- Mapea labels de SpaCy a tipos del sistema:
  - `PER` → `PERSON`
  - `ORG` → `ORGANIZATION`
  - `GPE`, `LOC` → `LOCATION`

**Paso 2: Matcher Determinista (Watch List)**
- Carga entidades activas de la base de datos
- Incluye **aliases** (nombres alternativos)
- Usa `PhraseMatcher` de SpaCy para búsqueda exacta
- Permite detectar entidades personalizadas no cubiertas por el modelo

**Paso 3: Filtrado Heurístico**
La función `is_valid_entity()` aplica reglas para evitar "basura":
- Rechaza artículos/preposiciones al inicio (`El `, `La `, `De `, etc.)
- Valida longitud (2-50 caracteres)
- Evita saltos de línea, tabs, puntuación excesiva
- Descarta números puros

**Paso 4: Blacklist**
- Excluye entidades marcadas como `is_ignored = True`

**Paso 5: Persistencia y Vinculación**
- Crea o recupera entidades en DB
- Relaciona con la noticia mediante tabla intermedia `news_entities`
- Marca `entities_extracted = True`

---

## 🗄️ Modelo de Datos

### Tablas Principales

#### `sources`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | Integer | PK |
| name | String | Nombre de la fuente |
| type | String | RSS, WEBSITE, SOCIAL, API, VIDEO, DOCUMENT |
| subtype | String | TWITTER, YOUTUBE, etc. |
| config | JSON | `{ "url": "...", "headers": "..." }` |
| icon | String | URL del ícono |
| health_status | String | OK, ERROR, etc. |
| active | Boolean | Estado de activación |

#### `news_items`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | Integer | PK |
| source_id | Integer | FK → sources |
| title | String | Título original |
| url | String | URL única |
| published_date | String | Fecha de publicación (ISO) |
| created_at | DateTime | Timestamp de creación |
| status | String | DISCOVERED, APPROVED, REJECTED |
| language | String | Código ISO detectado |
| content_snippet | String | Contenido limpio (original) |
| full_content | Text | Contenido completo (opcional) |
| title_es | String | Título traducido al español |
| content_es | Text | Contenido traducido al español |
| entities_extracted | Boolean | Flag de procesamiento NER |

#### `entities`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | Integer | PK |
| name | String | Nombre canónico (único) |
| type | String | PERSON, ORGANIZATION, LOCATION, CONCEPT |
| is_ignored | Boolean | Blacklist flag |
| aliases | JSON | Lista de nombres alternativos |

#### `entity_types`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | Integer | PK |
| name | String | Nombre del tipo (ej: "PERSON") |
| color | String | Color para UI (blue, purple, green, etc.) |

#### `tags`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | Integer | PK |
| name | String | Nombre único |
| color | String | Color para UI |
| description | String | Descripción opcional |

#### `interest_topics`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | Integer | PK |
| subject | String | Asunto principal |
| scope | String | Alcance geográfico/temático |
| keywords | String | Palabras clave (comma-separated) |
| exclusions | String | Términos de exclusión |
| relevance_level | String | High, Medium, Low |
| context_tags | String | Tags de contexto |

#### `agent_config`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| key | String | PK (ej: "gemini_api_key", "system_instructions") |
| value | String | Valor de configuración |

### Tablas Intermedias (Many-to-Many)

- `news_tags`: news_items ↔ tags
- `news_entities`: news_items ↔ entities
- `entity_sources`: entities ↔ sources

---

## 🌐 API Endpoints

### Fuentes (`/api/sources`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/sources` | Listar fuentes (paginación: skip, limit) |
| POST | `/api/sources` | Crear nueva fuente |
| PUT | `/api/sources/{id}` | Actualizar fuente |
| DELETE | `/api/sources/{id}` | Eliminar fuente |

### Noticias
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/news/discovered` | Noticias en estado DISCOVERED |
| GET | `/api/news/approved` | Noticias aprobadas (Newsroom) |
| GET | `/api/news/rejected` | Noticias rechazadas |
| PUT | `/api/news/{id}/status` | Cambiar estado (APPROVE/REJECT) |
| DELETE | `/api/news/{id}` | Eliminar noticia individual |
| POST | `/api/news/batch/delete` | Eliminación masiva |
| POST | `/api/news/batch/restore` | Restauración masiva |
| PUT | `/api/news/{id}/restore` | Restaurar de papelera |

### Escaneo
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/scan` | Disparar ingesta de feeds (background tasks) |

### Entidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/entities` | Listar entidades (include_ignored param) |
| POST | `/api/entities` | Crear entidad manual |
| PUT | `/api/entities/{id}` | Editar entidad (incluye aliases) |
| DELETE | `/api/entities/{id}` | Eliminar entidad |
| PUT | `/api/entities/{id}/ignore` | Marcar como ignorada |
| PUT | `/api/entities/{id}/restore` | Quitar de ignoradas |
| POST | `/api/extract-entities` | Trigger manual de extracción |

### Tipos de Entidad
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/entity-types` | Listar tipos disponibles |
| POST | `/api/entity-types` | Crear nuevo tipo |
| PUT | `/api/entity-types/{id}` | Actualizar tipo |
| DELETE | `/api/entity-types/{id}` | Eliminar tipo |

### Tags
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/tags` | Listar tags |
| POST | `/api/tags` | Crear tag |
| PUT | `/api/tags/{id}` | Actualizar tag |
| DELETE | `/api/tags/{id}` | Eliminar tag |

### Temas de Interés
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/topics` | Listar temas |
| POST | `/api/topics` | Crear tema |
| PUT | `/api/topics/{id}` | Actualizar tema |
| DELETE | `/api/topics/{id}` | Eliminar tema |

### Configuración IA
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/config` | Obtener configuración (API key enmascarada) |
| POST | `/api/config` | Guardar configuración (API key + system prompt) |

### Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard-stats` | Estadísticas rápidas (active_news, sources_count) |
| GET | `/api/status` | Health check del sistema |

---

## 🎨 Frontend - Páginas y Funcionalidades

### 1. **News.jsx** - Dashboard de Descubrimiento
- Lista noticias en estado `DISCOVERED`
- **Acciones:**
  - Escaneo manual de fuentes (botón con spinner)
  - Aprobación/rechazo individual
  - Selección múltiple para acciones batch
  - Filtro por fuente
  - Resaltado visual de items recién encontrados
  - Lector modal (Reader.jsx) para vista previa
- **Indicadores:**
  - Badge de idioma original
  - Iconos de entidades adjuntas
  - Estado de traducción

### 2. **Newsroom.jsx** - Sala de Redacción
- Noticias aprobadas listas para publicación
- Vista similar a News pero enfocada en contenido final
- Exportación/Compartir (según implementación)

### 3. **Entities.jsx** - Gestor de Entidades
- **Vista dual:** Activas vs Ignoradas (tabs)
- **Filtros:**
  - Por tipo (PERSON, ORGANIZATION, etc.)
  - Por letra inicial (alfabeto navegable)
  - Búsqueda por texto
- **CRUD completo:**
  - Crear/editar con aliases
  - Asignar a fuentes específicas
  - Ignorar/restaurar entidades
  - Eliminación
- **Visualización:**
  - Íconos por tipo (User, Building2, MapPin, Lightbulb)
  - Badges de colores según tipo
  - Contador de noticias asociadas

### 4. **Sources.jsx** - Administración de Fuentes
- Lista todas las fuentes configuradas
- Formulario para agregar/editar:
  - Nombre, tipo, subtipo
  - Configuración JSON (URL, headers)
  - Ícono personalizado
- Indicador de salud (health_status)
- Toggle activo/inactivo

### 5. **Topics.jsx** - Temas de Interés
- Define alcances editoriales
- Campos:
  - Asunto (subject)
  - Alcance (scope)
  - Palabras clave (keywords)
  - Exclusiones
  - Nivel de relevancia (High/Medium/Low)
  - Tags de contexto

### 6. **Tags.jsx** - Sistema de Etiquetado
- CRUD de etiquetas
- Selector de color
- Descripción opcional
- Uso para clasificación manual

### 7. **AIConfig.jsx** - Configuración de IA
- **Gemini/Groq API Key:** Input seguro (enmascarado en GET)
- **System Prompt:**Textarea para instrucciones personalizadas del agente
- Guía de mejores prácticas para prompts

### 8. **Trash.jsx** - Papelera de Reciclaje
- Noticias eliminadas (soft delete pending)
- Acciones:
  - Restaurar individual/múltiple
  - Vaciar papelera completamente

### 9. **Settings.jsx** - Configuración General
- Preferencias de usuario
- Configuración de la aplicación

### Componentes Compartidos

#### `Reader.jsx`
- Modal de lectura inmersiva
- Muestra título, contenido, metadata
- Resalta entidades mencionadas
- Acciones rápidas (aprobar, rechazar, etiquetar)

#### `Sidebar.jsx`
- Navegación principal
- Indicadores de cantidad (badges)
- Colapsable en móviles

#### `StatusBar.jsx`
- Estado del sistema en tiempo real
- Contadores rápidos
- Indicador de conexión

---

## 🔑 Características Clave

### ✅ Automatización Inteligente
- **Ingesta programable**: Escaneo bajo demanda (extensible a cron)
- **Traducción automática**: Solo para idiomas no españoles
- **Extracción en cascada**: NER se dispara automáticamente post-traducción
- **Background tasks**: Procesamiento asíncrono para no bloquear API

### ✅ Optimización de Costos
- **Detección local de idioma**: Evita llamadas innecesarias a API
- **Batch processing**: Agrupa hasta 5 noticias por llamada a Groq
- **Rate limiting consciente**: Pausas para respetar límites de API
- **Métricas de tokens**: Tracking detallado para optimización

### ✅ Calidad de Datos
- **Filtro temporal**: Solo últimas 24h (evita contenido obsoleto)
- **Deduplicación por URL**: Previene duplicados
- **Limpieza de HTML**: Contenido legible sin markup
- **Heurísticas de validación**: Filtra entidades inválidas

### ✅ Flexibilidad Editorial
- **Flujo de aprobación**: Control humano sobre publicación
- **Blacklist de entidades**: Ignora términos no deseados
- **Aliases**: Reconoce variaciones de nombres
- **Tipos personalizables**: Extiende más allá de PER/ORG/LOC

### ✅ Experiencia de Usuario
- **Modo oscuro/claro**: Theme toggle
- **Notificaciones toast**: Feedback inmediato
- **Selección múltiple**: Operaciones batch eficientes
- **Lectura inmersiva**: Reader modal sin distracciones
- **Responsive**: Adaptable a diferentes dispositivos

---

## ⚙️ Configuración y Despliegue

### Variables de Entorno (Backend)

Crear archivo `backend/.env`:

```bash
# API Keys
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
# Opcional: GOOGLE_API_KEY=xxxxxxxxxxxxx

# Configuración de Modelo
MODEL=llama-3.1-8b-instant

# Base de Datos (por defecto SQLite local)
DATABASE_URL=sqlite:///./news.db

# Puerto del servidor
PORT=8000
```

### Instalación Paso a Paso

#### Backend
```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Descargar modelo SpaCy
python -m spacy download es_core_news_lg

# Ejecutar migraciones (automático en startup, pero puede forzarse)
python migrate_db.py

# Iniciar servidor
uvicorn main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar dev server
npm run dev

# Build para producción
npm run build
```

### Acceso a la Aplicación
- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:8000`
- **Documentación API (Swagger):** `http://localhost:8000/docs`

---

## 🚀 Extensiones Futuras Sugeridas

1. **Programación de escaneos**: Integrar APScheduler para ingesta automática periódica
2. **Webhooks**: Notificar sistemas externos cuando hay noticias aprobadas
3. **Exportación**: Generar PDFs, newsletters, o posts para redes sociales
4. **Colaboración**: Sistema de usuarios con roles (editor, periodista, admin)
5. **Analytics**: Dashboard de métricas de rendimiento (noticias/día, fuentes más activas, etc.)
6. **Búsqueda full-text**: Integrar Elasticsearch o usar FTS de SQLite
7. **Resumen automático**: Usar LLM para generar summaries ejecutivos
8. **Clustering**: Agrupar noticias relacionadas por tema/evento
9. **Soporte multimedia**: Análisis de transcripciones de video/podcast
10. **API pública**: Endpoints autenticados para consumo externo

---

## 📝 Notas Importantes para el Agente IA

### Convenciones de Código

**Backend:**
- Logging estructurado con prefijos: `[INGESTOR]`, `[TRADUCTOR]`, `[EXTRACTOR]`
- Manejo de errores con rollback explícito en transacciones
- Migraciones automáticas en startup para robustez
- Sessions de SQLAlchemy cerradas siempre en bloques `finally`

**Frontend:**
- Componentes funcionales con hooks
- Context API para estado global (evitar prop drilling)
- Fetching directo con `fetch()` o `axios` (sin React Query/SWR en esta versión)
- Clases utilitarias `cn()` para Tailwind condicional

### Patrones de Diseño

1. **Service Layer**: Lógica de negocio aislada en `services/`
2. **Repository implícito**: Queries directas desde endpoints (prototipo)
3. **DTOs**: Pydantic schemas separados de modelos ORM
4. **Background Tasks**: FastAPI `BackgroundTasks` para operaciones pesadas
5. **Batch Processing**: Procesamiento en lotes para optimizar llamadas a API

### Consideraciones de Seguridad

- API keys almacenadas en DB (en producción usar secrets manager)
- CORS habilitado para todos los orígenes (solo desarrollo)
- No hay autenticación implementada (agregar JWT/OAuth en producción)
- Input validation con Pydantic en todos los endpoints

---

## 📊 Métricas y Monitoreo

El sistema loggea extensivamente:

### Métricas de Traducción
- Tokens de entrada/salida por lote
- Tiempo de respuesta por llamada
- Total acumulado de tokens consumidos
- Duración total del proceso

### Métricas de Extracción
- Cantidad de entidades por noticia
- Entidades ignoradas vs activas
- Eficiencia del matcher (watch list hits)

### Métricas de Sistema
- Noticias ingeridas por escaneo
- Tasa de éxito de fuentes RSS
- Estado de salud de la base de datos

---

## 🆘 Troubleshooting Común

### Problema: SpaCy no carga el modelo
**Solución:**
```bash
python -m spacy download es_core_news_lg
```

### Problema: Error de rate limit con Groq
**Solución:** Aumentar pausa entre lotes en `translator.py` (actualmente 12s)

### Problema: Noticias no se traducen
**Verificar:**
1. `GROQ_API_KEY` configurada en `.env`
2. Items tienen `title_es IS NULL`
3. Logs del background task

### Problema: Entidades no se extraen
**Verificar:**
1. Modelo SpaCy instalado
2. Noticias tienen `title_es` o `content_es` poblado
3. No están en blacklist

---

## 📞 Contacto y Contribución

Este proyecto está diseñado como una base sólida para una redacción automatizada moderna. La arquitectura es modular y extensible, permitiendo incorporar nuevos agentes, fuentes de datos y flujos de trabajo según las necesidades editoriales.

---

*Documento generado para facilitar la comprensión del proyecto por agentes de IA colaboradores.*

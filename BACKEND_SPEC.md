# 📋 Especificación Técnica & Directivas de Desarrollo del Backend: Lalan AI (Studio & Lounge)

Este documento contiene la **arquitectura, especificación de modelos de datos, endpoints de API REST, eventos WebSocket, reglas de negocio e integraciones de IA** necesarias para que un agente de Inteligencia Artificial o un equipo de ingeniería construya el backend completo de la plataforma **Lalan AI**.

---

## 1. Visión General del Sistema y Arquitectura

**Lalan AI** es una plataforma SaaS de gestión integral para salones de belleza, spas y centros de estética de lujo, equipada con asistentes inteligentes (Bots) para agendamiento automatizado a través de WhatsApp, Instagram Direct y Facebook Messenger, gestión de CRM con hospitalidad personalizada (Lounge), control de inventario/catálogo con precios escalonados (Price Tiers), agenda en tiempo real con tiempos de tolerancia y descanso (*buffers*), y analítica operativa.

### Stack Recomendado para el Backend:
- **Lenguaje/Entorno:** Node.js (TypeScript) con Express / NestJS, o Python con FastAPI.
- **Base de Datos:**
  - **Relacional:** PostgreSQL con Prisma o Drizzle ORM (recomendada para consistencia transaccional en citas, inventario y roles).
  - **NoSQL alternativa:** MongoDB / Firebase Firestore.
- **Tiempo Real:** WebSockets (Socket.io) para sincronización en vivo de chats, estado de bots, agenda y notificaciones.
- **Motor de IA:** Google Gemini API (`@google/genai` con modelo `gemini-2.5-flash` o similar) con soporte para Function Calling / Tools (agendar citas, consultar catálogo, consultar disponibilidad).
- **Integraciones Externas:** Meta Graph API (WhatsApp Cloud API Webhooks, Instagram Messaging API, Messenger Webhooks).

---

## 2. Detalle de Pantallas del Frontend y Necesidades Backend

A continuación se describe cada una de las pantallas de la aplicación cliente, qué datos consume, qué acciones desencadena y qué endpoints requiere:

### 1. `SplashScreen.tsx` (Pantalla de Bienvenida / Splash)
- **Propósito:** Animación de arranque, precarga de metadatos de marca y verificación de sesión del usuario.
- **Funcionalidad Backend:**
  - `GET /api/v1/health` y `GET /api/v1/settings/public` (devuelve el nombre del salón, tagline, logo, colores de marca y estado del servidor).
  - Verificación de token JWT en cabecera `Authorization: Bearer <token>` para validar si el usuario tiene una sesión activa válida.

### 2. `LoginScreen.tsx` (Autenticación y Selección de Rol)
- **Propósito:** Inicio de sesión multi-perfil (Roles: `admin`, `assistant`, `support`).
  - **Admin (Alanny):** Control total (métricas, bots, configuración, agenda, chats, logs).
  - **Assistant (Alan):** Operación diaria (agenda de citas, confirmaciones, chat directo con clientes).
  - **Support (Lufe):** DevOps y telemetría (telemetría de bots, webhooks de Meta, logs de sistema, configuraciones avanzadas).
- **Funcionalidad Backend:**
  - `POST /api/v1/auth/login`: Autenticación con email/usuario y contraseña/PIN. Devuelve tokens JWT (Access Token y Refresh Token) junto con el perfil (`UserProfile`) y la matriz de permisos (`permissions`).
  - `POST /api/v1/auth/refresh`: Renovación del token de sesión.
  - `GET /api/v1/auth/me`: Obtiene el perfil del usuario autenticado.
  - `POST /api/v1/auth/switch-role` (opcional en desarrollo): Permite alternar roles para pruebas de permisos.

### 3. `DashboardScreen.tsx` (Panel de Control y Métricas)
- **Propósito:** Visualización de KPIs ejecutivos en tiempo real con filtro por período (`day`, `week`, `month`).
- **Datos Mostrados:**
  - Ingresos totales y porcentaje de crecimiento (`totalRevenue`, `revenueGrowthPercent`).
  - Nuevos clientes y tasa de retención (`clientsCount`, `clientsGrowthPercent`).
  - Citas completadas y citas generadas por IA (`completedAppointments`, `aiBookedAppointments`, `aiConversionRate`).
  - Top servicios con ingresos y porcentaje de ventas.
  - Horas pico de afluencia (`peakHours`: hora, puntaje de saturación 0-100, clientes promedio).
  - Días más concurridos de la semana (`busiestDays`).
  - Distribución de canales de comunicación (WhatsApp %, Instagram %, Messenger %).
- **Funcionalidad Backend:**
  - `GET /api/v1/metrics?period={day|week|month}`: Agregación en tiempo real de facturación, citas y mensajes.
  - Suscripción WebSocket a evento `metrics:updated` cuando una cita se cobra o un bot agenda una nueva cita.

### 4. `CalendarScreen.tsx` (Agenda y Línea de Tiempo de Citas)
- **Propósito:** Gestión visual de la agenda del salón con filtrado por fecha, categoría de servicio y estado de cita.
- **Estados de Cita:**
  - `confirmed_by_ai` (Cita agendada automáticamente por el bot)
  - `attending` (Cliente en cabina o estación de atención)
  - `completed` (Servicio finalizado y cobrado)
  - `cancelled` (Cancelada por cliente o recepcionista)
  - `pending` (En espera de confirmación o anticipo)
- **Reglas de Negocio Clave:**
  - **Buffer Time:** Respetar tiempo de descanso entre citas (ej. 10 min configurables en settings).
  - **Grace Period (Tolerancia):** Tiempo de tolerancia de espera al cliente (ej. 15 min).
  - **Anticipos:** Cálculo del depósito requerido según el porcentaje configurado (`depositPercent`).
  - **Detección de Conflictos:** No permitir citas superpuestas para el mismo personal o sillón a menos que la configuración lo habilite.
- **Funcionalidad Backend:**
  - `GET /api/v1/appointments?date=YYYY-MM-DD&status=...&serviceCategory=...`: Lista de citas filtradas.
  - `POST /api/v1/appointments`: Crear nueva cita (valida disponibilidad de horario y buffer).
  - `PATCH /api/v1/appointments/:id/status`: Actualizar estado de la cita (`status`: `attending`, `completed`, etc.).
  - `PUT /api/v1/appointments/:id`: Editar datos (hora, servicio, staff asignado, anticipo pagado).
  - `DELETE /api/v1/appointments/:id`: Cancelar o eliminar cita.
  - Evento WebSocket `appointment:created`, `appointment:updated`, `appointment:cancelled` para reflejar cambios en vivo.

### 5. `ClientsScreen.tsx` (CRM de Clientas y Perfiles VIP)
- **Propósito:** Ficha completa de clientas recurrentes y nuevas, historial de visitas y preferencias de lujo.
- **Datos Relevantes:**
  - Datos de contacto (teléfono, email, avatar, canal preferido).
  - Etiquetas (`vip`, `frecuente`, `nuevo`, `alergico_sensible`, `puntual`, `requiere_anticipo`).
  - Notas de belleza y notas médicas/alergias.
  - **Módulo de Hospitalidad VIP:**
    - Bebidas favoritas (`favoriteDrinks`: ej. Matcha Latte frío, Copa de Mimosa).
    - Snacks favoritos (`favoriteSnacks`: ej. Macarons franceses, Frutos rojos).
    - Ambiente musical (`musicVibe`: ej. Lofi Chillhop & Neo-Soul, Bossa Nova).
    - Artistas o canciones favoritas (`favoriteArtistsOrSongs`).
    - Aroma de cabina (`roomAroma`), temperatura (`cálida`, `fresca`, `neutra`) y nivel de conversación deseado (`silenciosa_zen`, `charla_amigable`, `solo_consultas`).
  - Estadísticas del cliente: `totalVisits`, `totalSpent`, `lastVisitDate`.
- **Funcionalidad Backend:**
  - `GET /api/v1/clients?search=...&tag=...`: Búsqueda y listado paginado de clientes.
  - `GET /api/v1/clients/:id`: Detalle completo con historial de citas y preferencias de hospitalidad.
  - `POST /api/v1/clients`: Registrar nuevo cliente.
  - `PUT /api/v1/clients/:id`: Actualizar datos o preferencias de hospitalidad.
  - `DELETE /api/v1/clients/:id`: Eliminar o anonimizar cliente.
  - `GET /api/v1/clients/:id/appointments`: Historial de citas pasadas y futuras.

### 6. `CatalogScreen.tsx` (Catálogo de Servicios y Productos con Precios Escalonados)
- **Propósito:** Gestión del catálogo de servicios del salón (Uñas, Peinados, Masajes, Spa de Pies, Faciales) e inventario de productos retail.
- **Características Especiales:**
  - **Price Tiers (Precios Escalonados):** Cada servicio y producto puede tener múltiples niveles de precios (ej. *Precio Estándar*, *VIP Frecuente*, *Retoque / Mantenimiento*, *Largo / Extra Glam*, *Promoción Happy Hour*).
  - **Flag `aiAvailable`:** Si está en `true`, el motor de IA del chatbot tiene permiso de recomendarlo, cotizarlo y agendarlo a través de WhatsApp / Instagram.
  - **Control de Stock:** Para productos físicos (SKU, inventario actual, alerta de bajo stock).
- **Funcionalidad Backend:**
  - **Servicios:**
    - `GET /api/v1/services`: Listado de servicios (con filtro `aiAvailable=true` para el bot).
    - `POST /api/v1/services`: Crear servicio con sus price tiers.
    - `PUT /api/v1/services/:id`: Actualizar servicio.
    - `PATCH /api/v1/services/:id/ai-toggle`: Activar/desactivar visibilidad para el Bot.
    - `DELETE /api/v1/services/:id`: Desactivar o eliminar servicio.
  - **Productos:**
    - `GET /api/v1/products`: Listado de productos e inventario.
    - `POST /api/v1/products`: Alta de producto físico.
    - `PUT /api/v1/products/:id`: Edición de stock y precios.
    - `PATCH /api/v1/products/:id/ai-toggle`: Habilitar recomendación por IA.
    - `DELETE /api/v1/products/:id`: Baja de producto.

### 7. `ChatsScreen.tsx` (Bandeja Omnicanal: WhatsApp, Instagram, Messenger)
- **Propósito:** Inbox unificado en tiempo real con capacidad de alternar entre control por Bot y control Manual por la recepcionista.
- **Estados de Chat (`ChatStatus`):**
  - `ai_active`: El bot responde automáticamente según el tono y reglas configuradas.
  - `manual_control`: Un agente humano tomó el control; el bot no interfiere.
  - `needs_attention`: El cliente solicitó un humano o la IA detectó baja certidumbre (`confidenceScore < 70`).
- **Funcionalidad Backend:**
  - `GET /api/v1/conversations?channel=...&status=...`: Lista de conversaciones ordenadas por fecha del último mensaje.
  - `GET /api/v1/conversations/:id/messages`: Historial cronológico de mensajes.
  - `POST /api/v1/conversations/:id/messages`: Envío de mensaje desde el operador humano hacia el cliente (a través de Meta API).
  - `PATCH /api/v1/conversations/:id/ai-status`: Conmutar entre `ai_active` y `manual_control`.
  - `POST /api/v1/conversations/:id/read`: Marcar mensajes como leídos.
  - Evento WebSocket `chat:new_message` y `chat:status_change`.

### 8. `BotsControlScreen.tsx` (Orquestación y Telemetría de Bots)
- **Propósito:** Panel de control de los canales de automatización (WhatsApp Cloud API, Instagram Graph API, Facebook Messenger).
- **Funcionalidad y Métricas:**
  - Estado del canal: `online`, `degraded`, `offline`.
  - Conmutador de encendido/apagado global por canal (`enabled: boolean`).
  - Modelo de IA activo (ej. `gemini-2.5-flash`).
  - Latencia promedio de webhooks en milisegundos (`webhookLatencyMs`).
  - Conteo de mensajes procesados hoy y citas agendadas por el bot.
  - Mensaje de bienvenida personalizado (`welcomeMessage`) y mensaje fuera de horario (`offHoursMessage`).
  - Registro de logs del sistema (`SystemLog`: `service`, `level`, `message`, `payload`).
- **Funcionalidad Backend:**
  - `GET /api/v1/bots/configs`: Configuración y métricas de cada canal.
  - `PATCH /api/v1/bots/configs/:channelId`: Habilitar/deshabilitar canal o actualizar mensajes de bienvenida.
  - `GET /api/v1/system/logs?limit=50&level=...`: Logs de auditoría y conectividad con Meta APIs.
  - `POST /api/v1/bots/test-webhook`: Endpoint para simular recepción de mensajes y probar respuestas.

### 9. `SettingsScreen.tsx` (Reglas de Negocio y Configuración del Salón)
- **Propósito:** Ajuste de parámetros operativos que rigen el cálculo de la agenda y el comportamiento de la IA.
- **Parámetros:**
  - Identidad: Nombre del salón, teléfono, dirección, horario de apertura y cierre (`openingTime`, `closingTime`).
  - Horarios: Tiempo de descanso entre citas (`bufferTimeMinutes`), duración de cita estándar (`defaultAppointmentDurationMinutes`), tolerancia de espera (`gracePeriodMinutes`), anticipación máxima de agendamiento (`maxAdvanceBookingDays`), horas mínimas para cancelar (`cancellationNoticeHours`).
  - Anticipos y Pagos: Requerir anticipo (`requireDeposit`), porcentaje (`depositPercent`).
  - Motor IA: Agendamiento automático (`aiAutoBooking`), forzar horarios estrictos (`aiStrictSlots`), tono conversacional (`friendly_luxury`, `direct_professional`, `chic_casual`).
  - Redes Sociales: `@instagramHandle`, `facebookPage`.
- **Funcionalidad Backend:**
  - `GET /api/v1/settings`: Obtener la configuración actual.
  - `PUT /api/v1/settings`: Actualizar los parámetros de negocio (requiere rol `admin` o `support`).

### 10. `LoungePlayerScreen.tsx` (Experiencia Lounge VIP & Hospitalidad)
- **Propósito:** Interfaz de sala de espera y cabina VIP para reproducir música ambiental personalizada y registrar las atenciones de cortesía servidas a la clienta.
- **Funcionalidad:**
  - Lista de pistas de audio / playlists ambientales (`LoungeTrack`: título, artista, duración, vibe, url).
  - Selección de cliente en atención para consultar sus preferencias de bebidas, snacks y música.
  - Registro histórico de cortesías servidas durante la sesión (`servedHospitalityHistory`).
- **Funcionalidad Backend:**
  - `GET /api/v1/lounge/tracks`: Listado de pistas recomendadas para el salón.
  - `POST /api/v1/lounge/tracks`: Agregar nueva pista o stream de audio.
  - `POST /api/v1/lounge/serve-item`: Registrar cortesía entregada a un cliente (ej. "Matcha Latte frío" a "Sofía Morales").
  - `GET /api/v1/lounge/history?clientId=...`: Historial de hospitalidad de la sesión actual.

---

## 3. Modelo de Datos y Esquemas de Base de Datos

A continuación se define la estructura de tablas/colecciones requeridas:

```sql
-- 1. Usuarios y Perfiles del Sistema
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'assistant', 'support')),
    role_title VARCHAR(100),
    avatar VARCHAR(255),
    badge_color VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Clientes (CRM)
CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(100),
    avatar VARCHAR(255),
    preferred_channel VARCHAR(20) NOT NULL CHECK (preferred_channel IN ('whatsapp', 'instagram', 'messenger')),
    tags TEXT[], -- ['vip', 'frecuente', 'alergico_sensible', etc.]
    beauty_notes TEXT,
    medical_or_allergy_notes TEXT,
    hospitality_preferences JSONB, -- { favoriteDrinks: [], favoriteSnacks: [], musicVibe: "", ... }
    total_visits INT DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    last_visit_date DATE,
    registered_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Categorías y Servicios
CREATE TABLE services (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('nails', 'hair', 'massage', 'pedi_spa', 'facial')),
    category_name VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20),
    popular BOOLEAN DEFAULT FALSE,
    description TEXT,
    ai_available BOOLEAN DEFAULT TRUE,
    price_tiers JSONB NOT NULL DEFAULT '[]'::jsonb -- [{ id, name, price, isDefault }]
);

-- 4. Productos de Venta Retail
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('nailcare', 'haircare', 'skincare', 'spa_body')),
    category_name VARCHAR(50) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image VARCHAR(255),
    description TEXT,
    ai_available BOOLEAN DEFAULT TRUE,
    price_tiers JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 5. Citas (Appointments)
CREATE TABLE appointments (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(100) NOT NULL,
    client_phone VARCHAR(30) NOT NULL,
    service_id VARCHAR(50) REFERENCES services(id),
    service_name VARCHAR(100) NOT NULL,
    service_category VARCHAR(30) NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL, -- "HH:MM"
    duration_minutes INT NOT NULL,
    buffer_minutes INT DEFAULT 10,
    price DECIMAL(10, 2) NOT NULL,
    selected_price_tier_name VARCHAR(100),
    deposit_paid DECIMAL(10, 2) DEFAULT 0.00,
    staff_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('confirmed_by_ai', 'attending', 'completed', 'cancelled', 'pending')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Conversaciones y Mensajes Omnicanal
CREATE TABLE conversations (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(100) NOT NULL,
    client_handle VARCHAR(100),
    client_phone VARCHAR(30),
    client_avatar VARCHAR(255),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ai_active', 'manual_control', 'needs_attention')),
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    service_interest VARCHAR(100),
    confidence_score INT DEFAULT 100
);

CREATE TABLE messages (
    id VARCHAR(50) PRIMARY KEY,
    conversation_id VARCHAR(50) REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('client', 'bot', 'agent')),
    text TEXT NOT NULL,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    appointment_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Configuración de Negocio (Singleton o por sucursal)
CREATE TABLE salon_settings (
    id VARCHAR(20) PRIMARY KEY DEFAULT 'default',
    salon_name VARCHAR(100) NOT NULL,
    tagline VARCHAR(200),
    phone VARCHAR(30),
    address VARCHAR(200),
    opening_time VARCHAR(10) DEFAULT '09:00',
    closing_time VARCHAR(10) DEFAULT '20:00',
    buffer_time_minutes INT DEFAULT 10,
    default_appointment_duration_minutes INT DEFAULT 60,
    grace_period_minutes INT DEFAULT 15,
    cancellation_notice_hours INT DEFAULT 24,
    max_advance_booking_days INT DEFAULT 30,
    require_deposit BOOLEAN DEFAULT TRUE,
    deposit_percent INT DEFAULT 30,
    ai_auto_booking BOOLEAN DEFAULT TRUE,
    ai_strict_slots BOOLEAN DEFAULT TRUE,
    ai_tone VARCHAR(30) DEFAULT 'friendly_luxury',
    instagram_handle VARCHAR(100),
    facebook_page VARCHAR(100)
);

-- 8. Configuración de Canales de Bots
CREATE TABLE bot_channel_configs (
    id VARCHAR(20) PRIMARY KEY CHECK (id IN ('whatsapp', 'instagram', 'messenger')),
    name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    model VARCHAR(50) DEFAULT 'gemini-2.5-flash',
    webhook_latency_ms INT DEFAULT 120,
    status VARCHAR(20) DEFAULT 'online',
    messages_processed_today INT DEFAULT 0,
    appointments_booked_today INT DEFAULT 0,
    welcome_message TEXT,
    off_hours_message TEXT
);

-- 9. Logs de Sistema y Webhooks
CREATE TABLE system_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level VARCHAR(10) CHECK (level IN ('info', 'warn', 'error', 'success')),
    service VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB
);
```

---

## 4. Motor de Inteligencia Artificial (Gemini Bot & Function Calling)

El backend debe implementar el agente conversacional utilizando el SDK oficial `@google/genai` con **Function Calling (Herramientas)**. Cuando ingresa un mensaje por webhook de WhatsApp, Instagram o Messenger:

### 1. Instrucción de Sistema (System Prompt):
```text
Eres el Asistente Inteligente de Lalan AI Studio & Lounge, un salón de belleza y spa integral de lujo.
Tu objetivo es brindar una atención cordial, sofisticada y empática, resolver dudas sobre servicios, paquetes y precios, y ayudar a las clientas a agendar su cita de manera fluida.

Reglas operativas:
1. Solo puedes ofrecer servicios y productos que tengan 'aiAvailable = true'.
2. Si la clienta pregunta por precios, presenta las opciones y sus categorías (precios regulares, VIP o promociones si aplican).
3. Para agendar una cita, siempre debes verificar disponibilidad utilizando la función 'checkAvailability' antes de confirmar.
4. Recuerda a la clienta la política de anticipo del salón (ej. 30%) y el tiempo de tolerancia (15 min).
5. Mantén un tono elegante, cálido y conciso.
```

### 2. Declaración de Tools / Funciones para el LLM:
1. `getServicesCatalog(category?: string)`: Devuelve servicios disponibles, duración y tablas de precios.
2. `checkAvailability(date: string, durationMinutes: number)`: Consulta si existen espacios libres entre la hora de apertura y cierre, respetando el buffer de descanso entre citas.
3. `bookAppointment(clientName: string, phone: string, serviceId: string, date: string, time: string, priceTierName?: string)`: Crea la cita en base de datos con estado `confirmed_by_ai` y descuenta el slot.
4. `requestHumanAgent(reason: string)`: Cambia el estado de la conversación a `needs_attention` o `manual_control` para que una recepcionista humana continúe.

---

## 5. Arquitectura de Webhooks de Meta (WhatsApp, Instagram, Messenger)

El backend debe exponer los endpoints estándar de verificación y recepción de eventos de Meta Graph API:

### 1. Verificación de Webhook:
- `GET /api/v1/webhooks/meta`
- Valida `hub.mode === 'subscribe'` y `hub.verify_token === process.env.META_VERIFY_TOKEN`.
- Retorna `hub.challenge`.

### 2. Recepción de Mensajes Entrantes:
- `POST /api/v1/webhooks/meta`
- Identifica el canal de procedencia:
  - WhatsApp: `entry[].changes[].value.messages[]`
  - Instagram: `entry[].messaging[].message`
  - Messenger: `entry[].messaging[].message`
- Valida si el bot de ese canal está `enabled` en `bot_channel_configs`.
- Si la conversación está en `manual_control`, solo almacena el mensaje y emite vía WebSocket a los clientes conectados (`chat:new_message`).
- Si la conversación está en `ai_active`:
  - Ejecuta la llamada al LLM (Gemini).
  - Si el LLM ejecuta una herramienta (Function Call), realiza la acción y genera la respuesta final.
  - Envía la respuesta al usuario mediante la API de Meta Graph correspondiente.
  - Guarda ambos mensajes en la base de datos y emite actualización en tiempo real por WebSocket.

---

## 6. Eventos WebSocket (Socket.io)

Para garantizar la experiencia reactiva en el frontend:

| Evento Emisor | Payload | Descripción |
| :--- | :--- | :--- |
| `appointment:created` | `Appointment` | Nueva cita agendada (por bot o recepcionista). |
| `appointment:updated` | `Appointment` | Cambio de estado o fecha de una cita. |
| `chat:new_message` | `{ conversationId, message }` | Mensaje nuevo de cliente o bot. |
| `chat:status_changed` | `{ conversationId, status }` | Alternancia entre control AI y manual. |
| `bot:status_updated` | `BotChannelConfig` | Conexión, latencia o cambio en estado del bot. |
| `metrics:refresh` | `SalonMetrics` | Recálculo de ingresos y afluencia. |

---

## 7. Checklist de Implementación para el Backend

1. [ ] Inicializar proyecto Node.js / TypeScript con Express o NestJS (o FastAPI en Python).
2. [ ] Configurar base de datos PostgreSQL con migraciones según el esquema de la sección 3.
3. [ ] Implementar autenticación JWT con roles (`admin`, `assistant`, `support`) y middlewares de permisos (RBAC).
4. [ ] Desarrollar endpoints CRUD para `clients`, `services`, `products` y `appointments`.
5. [ ] Implementar la lógica del motor de agenda (cálculo de slots disponibles considerando duración + `bufferTimeMinutes` y horarios de apertura/cierre).
6. [ ] Configurar integración con Google Gemini API (`@google/genai`) con Function Calling para agendamiento.
7. [ ] Implementar los endpoints de Webhooks para Meta (WhatsApp Cloud API e Instagram Messaging).
8. [ ] Configurar servidor WebSocket para emitir eventos en vivo al frontend.
9. [ ] Implementar agregaciones de métricas operativas y financieras para el Dashboard.
10. [ ] Generar tests unitarios y de integración para el flujo crítico de reserva sin traslapes.

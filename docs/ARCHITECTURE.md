# Arquitectura y Diseño del Sistema (G-Inventory)

Este documento describe la arquitectura técnica, los flujos de datos en tiempo real, el esquema de base de datos y la seguridad por roles de **G-Inventory**.

---

## 1. Arquitectura de Alto Nivel

El sistema sigue una arquitectura desacoplada basada en el patrón de **Single Page Application (SPA)** en el frontend y **API REST / WebSockets** en el backend.

```mermaid
graph TD
    subgraph Cliente ["Cliente (Browser)"]
        FE[Frontend - React SPA]
        LS[(Local Storage - JWT)]
    end

    subgraph Servidor ["Servidor de Aplicación"]
        Gateway[Render / Vercel router]
        WS[Django Channels - WebSockets]
        REST[DRF - API REST]
    end

    subgraph Datos ["Capa de Datos"]
        DB[(PostgreSQL / SQLite)]
    end

    FE -->|HTTPS / JWT| REST
    FE -->|WSS / WebSocket| WS
    REST --> DB
    WS --> DB
    FE -.->|Lee/Escribe Token| LS
```

### Componentes Clave:
*   **Frontend (SPA)**: Construido con React 18, Vite y TypeScript. Se encarga de pintar los gráficos de rendimiento y paneles reactivos.
*   **Backend (API & WebSockets)**: Django 5.x utilizando Django REST Framework (DRF) para exponer endpoints de base de datos y Django Channels + Daphne (ASGI) para gestionar el canal persistente de WebSockets.
*   **Bases de Datos**:
    *   *Desarrollo*: SQLite (`backend/db.sqlite3`).
    *   *Producción*: PostgreSQL administrada.

---

## 2. Flujo de Comunicación e Integración de Tiempo Real

El sistema utiliza un modelo de comunicación híbrido:
1.  **Peticiones HTTP (REST)**: Operaciones transaccionales CRUD básicas, autenticación JWT, registro de órdenes de compra, etc.
2.  **WebSockets (Canal Bidireccional)**: Conexión abierta permanente que difunde cambios de stock al instante a todos los clientes conectados cuando ocurre una transacción (entradas, salidas, transferencias y recepciones).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (Frontend)
    participant API as Backend (DRF)
    participant WS as WebSocket Group (Channels)
    participant DB as Base de Datos

    U->>API: POST /api/stock/transfer/ (Datos de Transferencia)
    Note over API: Valida stock en origen y crea transacciones en BD
    API->>DB: Guarda transacciones (Atomic transaction)
    DB-->>API: Confirmación de guardado
    API->>WS: Notifica evento "stock_update" a nivel de canal
    WS-->>U: Envía notificación WebSocket en tiempo real
    Note over U: El frontend actualiza los gráficos y listas automáticamente
    API-->>U: Respuesta HTTP 201 Created (Confirmación)
```

---

## 3. Roles de Usuario y Permisos (Seguridad)

El backend valida cada petición usando tokens JWT. Los roles de seguridad están estructurados de la siguiente manera:

| Rol | Permisos y Capacidades |
| :--- | :--- |
| **Administrador (Superuser)** | • Acceso total a todas las APIs.<br>• Creación y edición de almacenes y categorías.<br>• Consulta de todas las métricas globales. |
| **Manager (Gerente de Almacén)** | • Aprobación de Órdenes de Compra (PO).<br>• Autorización de transferencias entre almacenes.<br>• Creación/Edición de productos y proveedores. |
| **Staff / Auditor** | • Creación de borradores de Órdenes de Compra.<br>• Registro de entradas/salidas manuales (ajustes).<br>• Visualización de existencias y logs históricos. |

---

## 4. Diseño del Esquema de Datos (Base de Datos)

El esquema relacional garantiza la integridad de los datos a través de llaves foráneas y restricciones atómicas:

```mermaid
erDiagram
    CATEGORY {
        int id PK
        string name
        string description
    }
    PRODUCT {
        int id PK
        string sku
        string name
        string description
        decimal price
        int min_stock_level
        int category_id FK
    }
    WAREHOUSE {
        int id PK
        string name
        string location
        int capacity
    }
    PRODUCT_STOCK {
        int id PK
        int product_id FK
        int warehouse_id FK
        int quantity
    }
    STOCK_TRANSACTION {
        int id PK
        int product_id FK
        int warehouse_id FK
        string type "IN/OUT/TRANSFER"
        int quantity
        string reference_id
        int user_id FK
        datetime created_at
    }
    SUPPLIER {
        int id PK
        string name
        string contact_info
    }
    PURCHASE_ORDER {
        int id PK
        string order_number
        int supplier_id FK
        string status "PENDING/APPROVED/RECEIVED/CANCELLED"
        decimal total_amount
        datetime created_at
    }
    PURCHASE_ORDER_ITEM {
        int id PK
        int purchase_order_id FK
        int product_id FK
        int quantity
        decimal unit_price
    }

    CATEGORY ||--o{ PRODUCT : contains
    PRODUCT ||--o{ PRODUCT_STOCK : has
    WAREHOUSE ||--o{ PRODUCT_STOCK : stores
    PRODUCT ||--o{ STOCK_TRANSACTION : records
    WAREHOUSE ||--o{ STOCK_TRANSACTION : triggers
    SUPPLIER ||--o{ PURCHASE_ORDER : supplies
    PURCHASE_ORDER ||--o{ PURCHASE_ORDER_ITEM : contains
    PRODUCT ||--o{ PURCHASE_ORDER_ITEM : ordered_as
```

---

## 5. Pipeline de CI/CD (Infraestructura de Despliegue)

El flujo de entrega continua está automatizado usando **GitHub Actions**:

```mermaid
graph LR
    Push[git push origin main] --> Workflow{GitHub Actions}
    Workflow -->|Build & Test| CI[Validador de Código]
    CI -->|Deploy Frontend| Vercel[Vercel SPA]
    CI -->|Deploy Backend| Render[Render Web Service]
```

*   **Frontend (SPA)**: Servido estáticamente por **Vercel** con reglas de reescritura de rutas configuradas en `vercel.json`.
*   **Backend (API)**: Alojado en **Render** ejecutando la aplicación con un servidor ASGI para el soporte concurrente de HTTP y WebSockets.

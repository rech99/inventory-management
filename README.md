# Sistema de Gestión de Inventarios en Tiempo Real (G-Inventory)

G-Inventory es una solución full-stack y de alta precisión para el control de inventarios en tiempo real. Está compuesta por un **Backend API REST en Django** (con soporte WebSocket mediante **Django Channels / Daphne**), un **Panel de Control Web en React (Vite)** y una **Aplicación Móvil en React Native (Expo)**.

El diseño sigue una estética técnica **OLED Dark Mode** de alta precisión con bordes angulares planos, alta legibilidad y alineaciones tabulares numéricas.

---

## 📂 Estructura del Proyecto

* **`backend/`**: API REST en Django + Django Channels. Administra la lógica de negocio, autenticación JWT, registros históricos de transacciones, ordenes de compra (POs) y transmisión de eventos WebSocket en tiempo real.
* **`frontend-web/`**: Panel administrativo SPA construido con React + Vite + TypeScript. Permite visualizar analíticas, gestionar el stock, aprobar órdenes de compra, y ver actualizaciones en tiempo real gracias a conexiones WebSocket.
* **`mobile/`**: Aplicación de almacén en React Native con Expo. Permite a los operarios escanear SKUs de forma simulada, registrar movimientos rápidos de stock e ingresar la recepción física de mercancías asociadas a órdenes de compra.
* **`design-system/`**: Carpeta que contiene las guías de estilos, colores, tipografía e identidad visual de G-Inventory ([MASTER.md](design-system/g-inventory/MASTER.md)).

---

## 🚀 Guía de Inicio Rápido

### Prerrequisitos
* **Python** (versión 3.12 recomendada)
* **Node.js** (versión 18 o superior recomendada)

---

### 1. Servidor Backend (Django)
Navega a la carpeta [backend](file:///C:/Users/USER/documents/github/inventory-management/backend):
```powershell
cd backend

# Crear entorno virtual e instalar dependencias
py -3.12 -m venv venv
.\venv\Scripts\activate.ps1
pip install -r requirements.txt

# Aplicar migraciones y sembrar base de datos SQLite de prueba
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py seed_data

# Iniciar servidor de desarrollo en puerto 8000
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```
* HTTP: `http://localhost:8000/api`
* WebSockets: `ws://localhost:8000/ws/stock/`

---

### 2. Panel Web (React)
Navega a la carpeta [frontend-web](file:///C:/Users/USER/documents/github/inventory-management/frontend-web):
```bash
cd frontend-web

# Instalar dependencias e iniciar servidor de desarrollo
npm install
npm run dev
```
* Acceso local: `http://localhost:5173/`

---

### 3. Aplicación Móvil (Expo)
Navega a la carpeta [mobile](file:///C:/Users/USER/documents/github/inventory-management/mobile):
```bash
cd mobile

# Instalar dependencias e iniciar CLI de Expo
npm install
npm run start
```
* Presiona `a` para emulador de Android (Host IP recomendado: `10.0.2.2:8000`).
* Presiona `i` para simulador de iOS (Host IP recomendado: `localhost:8000`).
* Escanea el código QR mediante la aplicación **Expo Go** para pruebas en dispositivos físicos conectados a la misma red Wi-Fi de tu computadora.

---

## 🔐 Credenciales de Prueba (Sembradas en SQLite)

La base de datos SQLite local (`backend/db.sqlite3`) se inicializa con los siguientes usuarios de prueba:

| Usuario | Contraseña | Rol / Permisos |
| :--- | :--- | :--- |
| **`admin`** | `adminpass` | Superusuario (Administrador General) |
| **`manager`** | `managerpass` | Manager de Almacén (Aprobación y Recepción) |
| **`staff`** | `staffpass` | Auditor / Operario de Almacén |

---

## 🎨 Especificación Estética (Aesthetic Tech Moderno)
* **Tipografía**:
  * Títulos principales y de sección: **Outfit**
  * Textos descriptivos e interfaces: **Inter**
  * Códigos SKU, fechas, cantidades y precios: **JetBrains Mono**
* **Estilo Visual**: Temática OLED negra pura (`#000000`) con bordes planos de 1px (`border-radius: 0`) y acentos en tonos cian y celeste cian, optimizados para paneles de control de alto contraste.

---

## 🔄 Flujos Operativos Principales
1. **Recepción de Mercadería por Orden de Compra**:
   * Genera una nueva Orden de Compra (PO) en estado `PENDING` desde el panel web.
   * Cambia su estado a `APPROVED`.
   * Abre la aplicación móvil y pulsa en **Receive Stock** sobre esa PO.
   * La app móvil registrará la transacción de entrada, y el backend actualizará la base de datos SQLite y emitirá una señal WebSocket.
   * El panel web de analíticas recibirá la actualización instantáneamente en caliente, mostrando el aumento de unidades con un efecto de destello cian.
2. **Alertas de Stock Bajo**:
   * Si la cantidad disponible de algún producto cae por debajo de su límite mínimo (`min_stock_level`), el backend emite un evento `LOW_STOCK_ALERT`.
   * Ambos paneles (web y móvil) iluminarán de color rojo las alertas de inventario.

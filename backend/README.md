# Backend - Sistema de Gestión de Inventarios (G-Inventory)

Este directorio contiene el backend del sistema de gestión de inventarios, desarrollado con **Django** y **Django REST Framework (DRF)**. Utiliza **Django Channels / Daphne** para manejar conexiones WebSocket bidireccionales en tiempo real y **SQLite** como base de datos local de desarrollo.

---

## 🛠️ Stack Tecnológico
* **Framework**: Django >= 6.0.6
* **APIs**: Django REST Framework >= 3.17.1
* **Autenticación**: SimpleJWT (JSON Web Tokens)
* **Sockets / Tiempo Real**: Daphne (Servidor ASGI) + Django Channels
* **Base de Datos**: SQLite (`db.sqlite3`)

---

## 🚀 Guía de Instalación y Configuración

Sigue estos pasos en tu terminal desde el directorio `backend/`:

### 1. Crear e instalar el Entorno Virtual
Es mandatorio utilizar el entorno virtual para mantener las versiones y dependencias aisladas:

```powershell
# Crear el venv local
py -3.12 -m venv venv

# Activar en Windows PowerShell
.\venv\Scripts\activate.ps1

# O en Windows CMD
.\venv\Scripts\activate.bat
```

### 2. Instalar Dependencias
Una vez activado el entorno virtual, instala los paquetes listados en `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 3. Ejecutar Migraciones del Esquema
Aplica las migraciones necesarias para crear las tablas de base de datos de Django e Inventario:
```bash
.\venv\Scripts\python.exe manage.py migrate
```

---

## 📊 Sembrado de Datos (Seeding)
Para realizar pruebas con datos reales inmediatos, el backend incluye un comando personalizado de administración que borra la base de datos local y carga un lote completo de usuarios, productos, depósitos y órdenes de compra.

Para ejecutar el seed:
```powershell
.\venv\Scripts\python.exe manage.py seed_data
```

### Usuarios Creados por Defecto
El comando crea las siguientes cuentas de prueba:

* **Administrador**: `admin` / `adminpass` (Superuser)
* **Manager**: `manager` / `managerpass` (Staff/Depósitos)
* **Auditor**: `staff` / `staffpass` (Auditor de stock)
* **Automator**: `system` / `systempass` (Procesador interno)

---

## 💻 Servidor de Desarrollo (Daphne/ASGI)
Daphne se encarga de servir las peticiones HTTP regulares y las conexiones WebSocket de forma unificada.

Para iniciar el servidor en el puerto `8000`:
```powershell
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

> [!IMPORTANT]
> El puerto por defecto es `8000`. Si otro proceso lo está ocupando, puedes pasar un puerto diferente como argumento (ej. `8080`), pero asegúrate de actualizar la URL base en los frontends.

---

## 📡 Canales WebSocket (Real-time Broadcast)
El servidor transmite eventos globales al grupo a través de los siguientes eventos:
1. `STOCK_UPDATED`: Cuando cambia el stock físico de un producto en un depósito.
2. `LOW_STOCK_ALERT`: Se dispara si el stock total de un producto baja de su `min_stock_level`.
3. `PO_STATUS_CHANGED`: Transmite cambios en el estado de las órdenes de compra.

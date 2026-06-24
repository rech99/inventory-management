# Frontend Web - Panel de Analíticas (G-Inventory)

Este es el cliente web de administración para el sistema de control de inventarios. Está desarrollado como una Single Page Application (SPA) ultrarrápida usando **Vite**, **React**, y **TypeScript**, estilizada con CSS puro adaptando un diseño técnico de alto contraste **OLED Dark Mode**.

---

## 🛠️ Stack Tecnológico
* **Build Tool**: Vite
* **Librería**: React 19 + TypeScript
* **Iconografía**: Lucide React
* **Peticiones HTTP**: Axios
* **Comunicación en Tiempo Real**: WebSocket nativo de navegador

---

## 🚀 Guía de Instalación y Ejecución

Sigue estos pasos en tu terminal desde el directorio `frontend-web/`:

### 1. Instalar Módulos de Node
Descarga e instala todas las dependencias del proyecto:
```bash
npm install
```

### 2. Iniciar el Servidor de Desarrollo
Levanta el servidor local de Vite:
```bash
npm run dev
```

El servidor se iniciará normalmente en:
* **Local**: `http://localhost:5173/` (o `http://localhost:5174/` si el puerto base está en uso).

---

## ⚙️ Configuración de API e Integración
* **Endpoints HTTP**: El frontend se comunica con el servidor local del backend a través del endpoint base configurado en `src/App.tsx` en la variable:
  ```typescript
  const API_BASE = 'http://localhost:8000/api';
  ```
* **WebSocket**: Para las notificaciones en tiempo real (alertas de stock bajo, movimientos), el frontend abre una conexión persistente a:
  ```typescript
  ws://localhost:8000/ws/stock/
  ```

---

## 🎨 Sistema de Diseño y Tipografía
La web sigue las especificaciones estéticas de la guía de diseño del proyecto:
* **Tipografía**:
  * Títulos y Branding: `Outfit`
  * Textos y Formularios: `Inter`
  * Precios, Cantidades y SKUs: `JetBrains Mono`
* **Estilo**: Bordes angulares planos de precisión de 1px (`border-radius: 0`), fondo OLED negro profundo (`#000000`) y acentos en celeste/cian vibrantes.

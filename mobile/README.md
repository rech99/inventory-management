# Mobile App - Operación de Almacenes (G-Inventory)

La aplicación móvil es un cliente de almacén desarrollado con **Expo** y **React Native**. Su propósito es permitir a los operarios auditar existencias físicas en tiempo real, simular escaneos de códigos de barra mediante animaciones visuales, y recibir/comprobar órdenes de compra (POs) directamente desde el suelo del depósito.

---

## 🛠️ Stack Tecnológico
* **Framework**: Expo (React Native) + TypeScript
* **Peticiones HTTP**: Axios
* **Estructura**: Expo Router (Estructura basada en archivos)

---

## 🚀 Guía de Instalación y Ejecución

Sigue estos pasos en tu terminal desde el directorio `mobile/`:

### 1. Instalar Dependencias
Instala los paquetes necesarios en el directorio móvil:
```bash
npm install
```

### 2. Iniciar el Servidor de Expo
Levanta el CLI de desarrollo de Expo:
```bash
npm run start
```
* Presiona `a` para abrir el emulador de Android (si está configurado).
* Presiona `i` para abrir el simulador de iOS (si usas macOS).
* Escanea el código QR desde tu teléfono físico mediante la app de Expo Go (Android) o la cámara de iOS.

---

## 📡 Configuración del Servidor (API Host)

Debido a cómo los emuladores y dispositivos móviles manejan las direcciones de red, **no siempre** puedes usar `localhost` para conectar la app móvil con el backend de Django:

1. **Emulador de Android**: Cambia la dirección del servidor en la pantalla de login de la app a:
   ```text
   10.0.2.2:8000
   ```
2. **Simulador de iOS**: Puedes usar:
   ```text
   localhost:8000
   ```
3. **Dispositivo Celular Físico**: Debes ingresar la dirección IP local de tu computadora en la red Wi-Fi (ejemplo: `192.168.1.15:8000`) y asegurarte de que tu teléfono y tu PC compartan la misma red.

---

## 🔍 Simulador de Escáner de Barra
Para evitar bloqueos y fallos del hardware de cámara nativo dentro de entornos emulados, la aplicación cuenta con un simulador visual:
* Permite seleccionar o teclear un SKU para simular el disparo del láser de escaneo.
* Dispara una animación visual de barrido láser (`scanBeam`).
* Permite al operario registrar entradas/salidas inmediatas asociadas al depósito elegido.
* Emite un aviso en tiempo real que actualiza inmediatamente el panel web de analíticas.

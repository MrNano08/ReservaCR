# Verificación de la entrega

Fecha: 23/09/2026. Entorno: Node.js 24.19.0, MariaDB 10.11.14, Chromium Headless 141, React 19.3.0, NestJS 11.2.6 y TypeORM 0.3.31. Las versiones resueltas están fijadas en package-lock.json.

| Comprobación | Resultado |
|---|---|
| Compilación TypeScript del backend | Correcta |
| Compilación TypeScript y build Vite del frontend | Correcta |
| Dominio: fechas CR/UTC, fechas inválidas, adyacencia y duración | 5 pruebas correctas |
| Integración contra MariaDB real | 11 casos internos y suite principal correctos; runner informa 12/12 |
| Rutas HTTP a través del proxy del frontend | 32 comprobaciones correctas |
| Navegador: cliente busca, confirma y cancela | Correcto |
| Navegador: propietario consulta servicios, horarios y cupos | Correcto |
| Navegador: administrador abre revisión y categorías | Correcto |
| Navegador: 390 px, menú móvil y cambio de tema | Correcto, sin desbordamiento horizontal |
| Excepciones JavaScript en recorridos probados | Ninguna |
| Auditoría npm completa y dependencias de producción | 0 vulnerabilidades conocidas reportadas en la verificación |

## Integración de reservas

Se verificó: dos clientes sobre el último cupo; un cliente reservando simultáneamente en dos negocios; doble envío idempotente; reutilización de clave con contenido diferente; duración larga atravesando un intervalo ocupado; acceso y cancelación ajenos; cancelación simultánea repetida sin duplicar notificaciones; inicio no alineado; negocio suspendido; horario y bloqueos incompatibles con citas; estado completado antes de tiempo; preservación del snapshot al editar un servicio; fallo SMTP; contraseñas, sesión revocable y correo único.

La prueba de fallo SMTP utilizó una conexión local no disponible. El trabajador conservó las reservas y dejó los envíos pendientes con intentos registrados. No se enviaron correos a personas reales.

## Integración HTTP

Se verificó el flujo de registro de propietario → perfil pendiente → bloqueo de publicación → aprobación administrativa → servicios y horarios → publicación → suspensión. También se verificaron acceso por rol, bloqueo de escalada a administrador, origen ajeno, datos propios, reserva, idempotencia, agenda del propietario, notificación, cancelación, imagen falsa, imagen válida normalizada a WebP, auditoría y cierre de sesión.

## Límites de la evidencia

No se validó un proveedor SMTP externo, un certificado TLS real ni un servidor de producción. Docker y el ejemplo de Nginx se entregan como configuraciones para el entorno del usuario; no se ejecutó Docker aquí. Las pruebas no constituyen una auditoría de seguridad profesional ni una prueba de carga masiva. La instalación requiere configurar las variables y ejecutar migraciones.

Los datos y capturas son ficticios; no se incluyen la base de pruebas, sesiones, archivos `.env` ni contraseñas utilizadas en la verificación.

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

## Cierre de bundle y UserWay — 2026-10-14

Análisis con el propio Rollup de Vite, sin instalar herramientas. Los tamaños renderizados antes de minificar identificaron React DOM (654 kB), libphonenumber-js (298 kB, incluidos 158 kB de metadatos), código de aplicación (152 kB), React Router (89 kB) e i18next (83 kB) como bloques principales. Son medidas de diagnóstico, no tamaños de descarga. UserWay se descarga externamente y no integra el bundle. Los imports ESM de iconos/i18next permiten tree-shaking; los recursos ES/EN se conservan para el cambio inmediato de idioma.

Se aplicó `React.lazy` únicamente a Owner/Admin, con el indicador Loading existente. La utilidad telefónica se separó de la validación i18n compartida para que `libphonenumber-js/max` se descargue con Owner. Se conservan los metadatos completos y exactamente las mismas reglas CR; no se sustituye `/max` por una validación menos precisa ni se copian metadatos que puedan quedar obsoletos.

| JavaScript de producción | Antes | Después | Gzip después |
|---|---:|---:|---:|
| Inicial | 595,80 kB | 384,08 kB | 123,85 kB |
| Owner bajo demanda | Incluido arriba | 205,40 kB | 53,49 kB |
| Admin bajo demanda | Incluido arriba | 7,90 kB | 2,32 kB |

Reducción inicial de 35,5 %; ya no hay advertencia de chunks mayores de 500 kB. El total descargado si se visitan todas las rutas se mantiene aproximadamente igual. Chrome confirmó que catálogo no solicita Owner/Admin y que ambos cargan al abrir directamente sus rutas, conservando permisos e idioma. Build frontend, 13 pruebas i18n y 19 pruebas backend seguras aprobados. Los tests HTTP/SMTP usan servidores locales simulados y requirieron autorización de red local del entorno; no se conectó a DB real ni se modificó backend en este cierre.

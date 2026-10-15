# API de ReservaCR

Prefijo `/api`. JSON salvo la subida de imágenes. Las mutaciones requieren `X-Requested-With: ReservaCR`. Las solicitudes de navegador deben provenir de `WEB_ORIGIN`; autenticación por cookie HttpOnly `reservacr_session`, enviada con `credentials: include`. No se guardan tokens en localStorage.

| Método / ruta | Acceso | Función |
|---|---|---|
| GET /health | Público | Conectividad real con MariaDB |
| POST /auth/register | Público | name, email, password, phone, role CLIENT/BUSINESS |
| POST /auth/login | Público | email, password |
| GET /auth/me | Autenticado | Usuario actual |
| POST /auth/logout | Sesión actual | Revocar sesión |
| GET /categories | Público | Categorías activas |
| GET /businesses | Público | q, categoryId, province, canton, page |
| GET /businesses/:id | Público | Perfil publicado, servicios, horarios |
| GET /availability | Público/sesión opcional | serviceId, date YYYY-MM-DD; con sesión cliente excluye sus solapamientos |
| POST /bookings | Cliente | serviceId, startAt ISO con zona, notes, idempotencyKey UUID |
| GET /bookings | Cliente/Negocio | Listado propio con datos mínimos |
| PATCH /bookings/:id | Cliente/Negocio | status CANCELLED/COMPLETED/NO_SHOW, reason; valida rol y estado |
| GET /owner/business | Negocio | Perfil propio completo |
| PUT /owner/business | Negocio | Perfil, ubicación, categoría, cupos y política de cancelación |
| POST /owner/image | Negocio | multipart campo image |
| POST /owner/services | Negocio | name, description, duration, price nullable, active |
| PUT /owner/services/:id | Negocio | Actualizar servicio propio |
| PUT /owner/hours | Negocio | Array de weekday 0–6, startMinute, endMinute |
| PATCH /owner/publish | Negocio | published boolean |
| POST /owner/resubmit | Negocio rechazado | Volver a revisión |
| POST /owner/blocks | Negocio | startAt/endAt ISO, reason |
| DELETE /owner/blocks/:id | Negocio | Quitar bloqueo propio |
| GET /notifications | Autenticado | Bandeja propia |
| PATCH /notifications/:id/read | Autenticado | Marcar notificación propia |
| GET /admin/businesses | Administrador | Listado de revisión |
| GET /admin/businesses/:id | Administrador | Detalle para revisión |
| PATCH /admin/businesses/:id | Administrador | status APPROVED/REJECTED/SUSPENDED y reviewNote |
| GET/POST /admin/categories | Administrador | Listar/crear categorías |
| PATCH /admin/categories/:id | Administrador | name, active |
| GET /admin/audit | Administrador | Últimas 200 acciones |
| GET /admin/notifications | Administrador | Estado de envíos sin direcciones ni cuerpos |
| POST /admin/notifications/:id/retry | Administrador | Reabrir envío fallido |

Perfil completo para `PUT /owner/business`:

```json
{"name":"Mi negocio","description":"Descripción de mi negocio local","categoryId":"UUID","province":"Guanacaste","canton":"Nicoya","address":"Dirección exacta","phone":"8888-8888","capacity":2,"cancellationMinutes":120}
```

Respuesta de error uniforme: `{ "statusCode": 409, "message": "..." }`. 400 validación; 401 sesión requerida; 403 permiso/origen; 404 recurso no visible; 409 conflicto de negocio/cupo; 413 imagen demasiado grande; 429 exceso de peticiones; 500 error interno sin revelar detalles SQL.

La confirmación devuelve un código `CR-…`, identificador, instantes UTC y estado `CONFIRMED`. El servidor determina negocio, duración y precio desde el servicio; no confía en esos valores enviados por el cliente.

### Límites de entradas

Inventario contrastado con entidades, migraciones y esquemas Zod. Se conservan los límites previos del backend; ambos buscadores ahora tienen `maxLength=100` (el de reservas filtra localmente).

| Campo | Pantalla | DB / validación actual | Límite previo UI | Límite aplicado UI/API |
|---|---|---|---|---|
| Búsqueda | Catálogo / reservas | Sin DB; query catálogo Zod 100 | Sin límite | 100 / 100 (reservas local) |
| Nombre usuario | Registro | varchar(100), Zod 100 | 100 | 100 |
| Correo | Registro, login, recuperación | varchar(190), Zod email 190 | 190 | 190 |
| Contraseña / confirmación | Registro, login, recuperación | Hash varchar(100); entrada Zod 72 | 72 | 72; mínimo 10 al crear/restablecer, 1 en login |
| Teléfono usuario | Registro | varchar(25), Zod 25 | 25 | 25 |
| Nombre negocio | Owner | varchar(120), Zod 120 | 120 | 120 |
| Descripción negocio ES/EN | Owner | text, Zod 2500 | 2500 | 2500 |
| Provincia / cantón | Catálogo / Owner | varchar(80), provincia enum Owner / Zod 80 query | Provincia select / cantón 80 | 80; provincia Owner enum |
| Dirección | Owner | varchar(300), Zod 300 | 300 | 300 |
| Teléfono negocio | Owner | varchar(25), Zod 25 | 25 | 25 y número CR válido |
| Nombre servicio ES/EN | Owner | varchar(100), Zod 100 | 100 | 100 |
| Descripción servicio ES/EN | Owner | varchar(500), Zod 500 | 500 | 500 |
| Motivo bloqueo | Owner | varchar(200), Zod 200 | 200 | 200 |
| Notas reserva | Detalle negocio | varchar(500), Zod 500 | 500 | 500 |
| Motivo cancelación | Reservas | varchar(300), Zod 300 | 300 | 300 |
| Categoría | Admin | varchar(80), Zod 80 | 80 | 80 |
| Nota revisión | Admin | varchar(500), Zod 500 | 500 | 500 |

No hay apellido separado. Fechas, UUID, enums, archivos y campos numéricos conservan sus validaciones de formato, rango o tamaño; `maxlength` no aplica a ellos. Los límites de texto se verifican antes de `trim()` para rechazar cargas excesivas incluso con espacios. Todos los textarea muestran contador.

`PUT /owner/business` valida números CR de ocho dígitos con `libphonenumber-js/max`, permitiendo `87026279`, `8702 6279`, `8702-6279` y `+506 8702 6279`. Rechaza letras, extensiones, países ajenos y numeración inválida. Conserva espacios/guiones internos al guardar; solo recorta espacios exteriores, como antes. No se transforman filas históricas ni se requieren migraciones. La validación comprueba el plan de numeración, no que una línea esté activa.

Los errores conservan `code`, `message`, `statusCode` y `fieldErrors`. Los errores de longitud añaden a cada campo `code: MAX_LENGTH` y `max`; los de teléfono añaden `code: INVALID_PHONE`. El cliente traduce estos metadatos a ES/EN sin depender del texto Zod.

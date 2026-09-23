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

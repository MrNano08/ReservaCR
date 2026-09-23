# Alcance y trazabilidad

Fuentes revisadas: `ReservaCR_Seguimiento_1 .docx` y `ReservaCR — Seguimiento 1 · Oscura final.pptx`, archivos suministrados por el equipo; contexto posterior de la pizarra del 21/09/2026 y solicitud actual. El documento contiene una propuesta antigua de PostgreSQL; la presentación, la decisión posterior de MariaDB y la solicitud TypeORM prevalecen.

| Requisito | Implementación |
|---|---|
| React + TypeScript | Vite, React Router, estructura por páginas/componentes/hooks/services/utils |
| API modular NestJS | Módulos de acceso, negocios, reservas y notificaciones |
| MariaDB + TypeORM | Diez entidades, migración explícita, InnoDB, synchronize desactivado |
| Cliente | Registro, búsqueda, reserva, cancelación, historial, notificaciones propias |
| Negocio | Perfil, imagen, categoría, ubicación, servicios, horarios, cupos, bloqueos, agenda |
| Administrador | Revisión, aprobación, rechazo, suspensión, categorías, auditoría y cola de correo |
| Publicación controlada | Estado aprobado + servicio activo + horario configurado |
| Búsqueda | Nombre/descripción/cantón, categoría y provincia; API también acepta cantón |
| Duración y precio opcional | Múltiplos de 30 min, precio CRC entero o consultar |
| Último cupo | Transacción READ COMMITTED y bloqueo pesimista del negocio |
| Cliente en distintos locales | Bloqueo de fila del cliente y verificación de solapamiento global |
| Doble clic/reintento | Clave única cliente/idempotencia; respuesta original en duplicado idéntico |
| Cancelación única | Cambio de estado bajo bloqueo; disponibilidad derivada, sin restar contadores |
| Correo fallido | Outbox persistente creada en la misma transacción que la reserva |
| Permisos por recurso | Filtros por cliente/propietario y guardas por rol en el servidor |
| Imágenes seguras | Límite 5 MB, formatos permitidos, decodificación/recompresión con sharp y nombre aleatorio |
| Auditoría | Confirmación/cancelación/estado de reservas y decisiones administrativas |
| Tema oscuro y vista administrativa | Implementados en React, junto con tema claro y diseño móvil |

## Decisiones concretadas para ejecutar el MVP

Un negocio por propietario, bloques de 30 min, hasta 50 cupos, hasta 90 días de anticipación, cancelación de cliente predeterminada a 120 min, precio entero en colones, no asignación por empleado. El bloqueo del cliente impide **solapamientos**; no le impide reservar otra fecha o una cita consecutiva. Si el equipo pretendía una sola reserva activa total, esa es una regla diferente y no se ha asumido.

El backend conserva instantes UTC y snapshots del servicio. Las entidades físicas no copian literalmente el modelo conceptual: no existe tabla de ocupación, ya que se calcula desde reservas confirmadas dentro del bloqueo del negocio. Esto evita desincronización de cupos y mantiene la consistencia con duraciones de varios intervalos.

## Exclusiones preservadas

Pagos, facturación, agenda de trabajadores, app móvil, chat, IA, puntos/cupones, reseñas complejas y planes comerciales. Google estaba por validar, por lo que no se añadió. El alojamiento, los certificados y el proveedor SMTP se configuran al desplegar.

## Referencia técnica consultada

TypeORM: [transacciones](https://typeorm.io/docs/transactions/), [bloqueos](https://typeorm.io/docs/query-builder/select-query-builder/) y [driver MariaDB/MySQL](https://typeorm.io/docs/drivers/mysql/). Las operaciones transaccionales utilizan exclusivamente el EntityManager entregado por la transacción.

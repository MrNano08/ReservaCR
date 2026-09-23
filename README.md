# ReservaCR

Aplicación del proyecto EIF409 Aplicaciones Informáticas Globales, UNA Campus Nicoya. React + TypeScript en el frontend; NestJS + TypeORM + MariaDB en el backend. Interfaz en español, adaptable a móvil, con tema oscuro y claro.

**Implementa el MVP documentado**: registro e ingreso, tres roles, catálogo, aprobación y publicación de negocios, servicios, horarios, cupos compartidos, bloqueos, reservas, cancelación, historial, notificaciones y correo con reintentos. Los datos se guardan en MariaDB; no se usan datos simulados para sustituir la API. Los ejemplos se cargan solamente mediante un comando explícito.

## Inicio rápido

Requisitos: Node.js 22.12 o posterior, npm y MariaDB 10.11 o posterior. Docker Compose es una opción para la base de datos y el buzón de pruebas, no es obligatorio.

Desde la carpeta del proyecto:

```bash
npm ci
node scripts/setup.mjs
```

1. Edita `backend/.env`: configura usuario, contraseña y base de datos. Si usarás Docker, edita también `.env` y usa el mismo `DB_PASSWORD` en ambos. Sustituye los valores de ejemplo.
2. Inicia la base de datos y el buzón local:

```bash
docker compose up -d
```

Si ya tienes MariaDB, omite Docker y crea una base y usuario (sustituye la contraseña):

```sql
CREATE DATABASE reservacr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'reservacr'@'localhost' IDENTIFIED BY 'TU_CONTRASENA_LOCAL';
GRANT ALL PRIVILEGES ON reservacr.* TO 'reservacr'@'localhost';
```

Para Docker, el usuario se crea automáticamente. Para una instalación remota, define una cuenta restringida al host de la API. No expongas el puerto de MariaDB a Internet.

3. Aplica la migración:

```bash
npm run db:migrate
```

4. Carga ejemplos ficticios para probar todos los roles (opcional):

Linux/macOS:

```bash
SEED_PASSWORD='UnaClaveLocalLarga2026' node scripts/seed.mjs
```

PowerShell:

```powershell
$env:SEED_PASSWORD='UnaClaveLocalLarga2026'
node scripts/seed.mjs
```

Cuentas de ejemplo, todas con la contraseña que tú estableciste:

| Rol | Correo |
|---|---|
| Administrador | admin@reservacr.test |
| Cliente | cliente@reservacr.test |
| Negocio principal | negocio@reservacr.test |
| Otros negocios | barberia@reservacr.test, salud@reservacr.test, spa@reservacr.test |

El seed es repetible: no sobrescribe contraseñas ni registros existentes. No se ejecuta en producción. Los negocios y sus datos son ficticios.

5. Inicia ambos proyectos:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API y salud: http://localhost:3000/api/health
- Buzón Mailpit (si lo iniciaste con Compose): http://localhost:8025

Abre siempre el frontend en `localhost:5173`, coherente con `WEB_ORIGIN`. Si cambias dominio, IP o puerto, actualiza esa variable y reinicia la API. El proxy de Vite evita necesitar URLs distintas en los componentes.

## Demostración completa

1. Registra una cuenta de negocio y guarda su perfil.
2. Ingresa como administrador, abre Administración → Negocios → Revisar y apruébalo.
3. Regresa al negocio, crea servicios y franjas semanales, configura cupos y pulsa **Publicar negocio**.
4. Ingresa como cliente, busca el negocio por nombre, categoría o ubicación y elige un servicio.
5. Selecciona una fecha y un horario; confirma la reserva.
6. Verifica la cita en **Mis reservas**, en **Agenda** del negocio y en las notificaciones. Mailpit permite inspeccionar el correo sin enviarlo a personas reales.
7. Cancela con la anticipación permitida; comprueba la liberación del cupo.
8. Prueba dos clientes sobre el último cupo o un cliente en dos negocios a la misma hora: solo una confirmación puede registrarse.

## Administrador sin datos de ejemplo

No existe registro público como administrador. Desde una terminal de confianza:

```bash
ADMIN_NAME='Administrador' ADMIN_EMAIL='admin@tudominio.cr' ADMIN_PASSWORD='UnaClaveSeguraDe12OMas' npm run admin:create
```

En PowerShell define las tres variables con `$env:ADMIN_NAME=...`, `$env:ADMIN_EMAIL=...` y `$env:ADMIN_PASSWORD=...`; ejecuta luego `npm run admin:create`. Un correo existente no se convierte automáticamente en administrador.

## Organización

```text
backend/src/
  auth/             Sesiones y permisos
  businesses/       Negocios, servicios, horarios, categorías y administración
  bookings/         Disponibilidad, confirmación, consulta y cancelación
  notifications/    Bandeja interna y trabajador SMTP
  common/           Configuración, validación y fechas
  database/         Entidades, migración, seed y creación de administrador
backend/test/       Pruebas de dominio e integración MariaDB
frontend/src/
  components/       Componentes compartidos y estructura visual
  hooks/            Sesión y carga de datos
  services/         Cliente HTTP
  utils/            Formato en español y zona horaria
  pages/            Catálogo, acceso, reservas y paneles
scripts/            Configuración y carga de ejemplos
```

## Reglas implementadas

- Roles: cliente, negocio y administrador. Cada propietario maneja un solo negocio en este MVP.
- Un negocio nuevo empieza pendiente y oculto. Solo el administrador aprueba/rechaza/suspende. Publicar requiere aprobación, al menos un servicio activo y al menos un horario.
- Categorías desactivadas ya no se admiten en nuevos registros; se conservan referencias existentes.
- Cupos compartidos del negocio, sin asignación de trabajadores. Un cupo representa una atención simultánea.
- Intervalos de 30 minutos y servicios de 30 a 480 minutos, múltiplos de 30. Cada reserva ocupa todo su intervalo; la ocupación se deriva de reservas confirmadas, sin contadores que puedan quedar desincronizados.
- La consulta de disponibilidad es informativa: al confirmar se vuelve a calcular dentro de una transacción.
- Se bloquea primero el cliente y luego el negocio. El cliente no puede tener dos citas superpuestas, incluso en negocios diferentes. Citas consecutivas sí se permiten; no se modela tiempo de viaje.
- Clave de idempotencia por cliente; repetir exactamente la misma solicitud devuelve la reserva original. Reutilizar la clave para otro contenido produce conflicto.
- Cancelación predeterminada: hasta 120 minutos antes; cada negocio puede modificarla. El negocio puede cancelar antes del inicio. Las citas completadas o con inasistencia solo pueden marcarse después de finalizar su horario.
- Cambiar servicios no reescribe duración, nombre ni precio de reservas históricas. Horarios nuevos no pueden dejar citas futuras fuera de atención. No se permite reducir cupos con citas vigentes.
- Bloqueos por fecha/rango para cierres y descansos. Si afectan citas existentes, estas deben gestionarse primero.
- Horizonte de reserva: 90 días. Horarios semanales, sin turnos que atraviesen medianoche; usa dos franjas en días consecutivos.
- UTC en base de datos y `America/Costa_Rica` en interfaz y correos. Costa Rica se convierte con UTC−06:00, sin usar la zona horaria del navegador para interpretar formularios.
- El correo no condiciona la reserva: se registra una notificación por destinatario en la misma transacción. Se reintenta con espera creciente, hasta ocho intentos; el administrador puede reactivar los fallidos.

Estas decisiones completan detalles que el Seguimiento 1 dejaba por validar. Consulta `docs/ALCANCE.md` para la trazabilidad y los límites.

## Verificación

```bash
npm run build
npm test
npm audit --omit=dev
```

Integración requiere una **base aislada terminada en `_test`**, con permisos concedidos al usuario de prueba. La prueba crea tablas si faltan y agrega datos ficticios únicos; no borra bases ni tablas. No apuntarla a producción.

```sql
CREATE DATABASE reservacr_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON reservacr_test.* TO 'reservacr'@'localhost';
```

```bash
DB_DATABASE=reservacr_test npm run test:integration
```

En PowerShell: `$env:DB_DATABASE='reservacr_test'` antes del comando, y luego `Remove-Item Env:DB_DATABASE`. El detalle de la verificación efectuada en esta entrega está en `docs/VERIFICACION.md`.

### Pruebas HTTP y de navegador

Con la aplicación local iniciada y los datos ficticios cargados:

```bash
SEED_PASSWORD='TuClaveDeEjemplos' npm run test:http
npx playwright install chromium --only-shell
SEED_PASSWORD='TuClaveDeEjemplos' npm run test:browser
```

En PowerShell define `$env:SEED_PASSWORD` antes de los comandos. Estas pruebas modifican **datos de demostración**: crean y cancelan citas, suben una imagen de prueba y crean un negocio que suspenden al finalizar. Ejecútalas solo sobre una instalación local de prueba. Los scripts esperan los cuatro negocios publicados del seed. Las capturas se generan en `test-results/`; se incluyen capturas verificadas en `docs/capturas/`.

## Producción

```bash
npm ci
npm run build
npm run db:migrate
npm run start -w backend
```

Sirve `frontend/dist` desde Nginx; el ejemplo está en `docs/nginx.conf.example`. El backend corre como proceso o contenedor y no ejecuta migraciones ni seeds automáticamente. El Dockerfile usa la raíz del repositorio como contexto.

Antes de exponer el servicio: configurar HTTPS, `NODE_ENV=production`, `COOKIE_SECURE=true`, `WEB_ORIGIN=https://tu-dominio`, credenciales propias, SMTP real y un volumen persistente para `backend/uploads`. La aplicación rechaza una configuración de producción sin HTTPS/cookie segura. El ejemplo de Nginx muestra el encaminamiento HTTP: el certificado y la terminación TLS dependen del proveedor elegido.

Respalda conjuntamente MariaDB y las imágenes. Restaura y prueba en un entorno aparte antes de reemplazar la base activa. No se incluyen credenciales reales ni proveedor de alojamiento contratado.

## Límites del alcance

No incluye pagos, facturación, agenda por empleado, aplicación móvil, chat, IA, cupones, reseñas complejas, planes comerciales ni acceso con Google. La recuperación de contraseña y verificación de correo no estaban especificadas y no se implementaron: el sistema ofrece registro/acceso por contraseña. SMTP real requiere configuración externa.

Los paneles muestran hasta 1.000 reservas, 500 negocios en administración y 200 eventos administrativos; el catálogo público tiene paginación. La cola SMTP tiene entrega **al menos una vez**: una caída entre el envío y el commit puede repetir un correo, pero no la reserva. El límite de peticiones usa memoria por instancia; para múltiples réplicas debe conectarse un almacén compartido. Se serializa la confirmación por negocio, adecuado al MVP, no una promesa de escala ilimitada.

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

### Contenido bilingüe de publicaciones

`description` (negocio) y `name`/`description` (servicio) conservan el español.
Los campos opcionales `descriptionEn` y `nameEn` permiten al Owner escribir inglés;
no se usa traducción automática ni ningún servicio externo. En EN se muestra el
inglés no vacío, con fallback literal al español. Nombres de negocios/personas,
ubicaciones, direcciones, contactos, códigos e IDs no se traducen.

Las categorías conservan sus UUID/nombres y usan `code` opcional para resolver
`common:categories.*` en i18next. Admin puede elegir una categoría controlada
(Comida/Food, Ropa/Clothing, etc.) o conservar el nombre personalizado. Un código
ausente/desconocido conserva el nombre; no se infiere identidad desde el texto.
El seed de demostración asigna códigos al crear categorías nuevas. La migración
`BilingualContent1790000000003` adopta por IDs exactos las dos categorías de la
instalación diagnosticada; en otras instalaciones se asignan desde Admin.

Reservas mantiene `serviceName` histórico y captura `serviceNameEn` para nuevas
reservas. Para antiguas, usa la traducción actual solo si el nombre español del
servicio aún coincide; de lo contrario conserva la copia histórica. Cambiar idioma
actualiza la vista sin recargar ni consultar nuevamente la API. Los payloads viejos
siguen siendo válidos; omitir inglés en una actualización no borra lo ya guardado.

La migración agrega únicamente columnas nullable; no cambia UUID, tipos previos
ni textos originales. `synchronize` permanece desactivado. Requiere respaldo,
revisión de esquema/historial y ejecutar `npm run db:migrate` antes de arrancar el
backend actualizado. MariaDB confirma DDL implícitamente: una ejecución parcial
debe diagnosticarse, no forzarse. Para revertir código conservar las columnas;
`down` bloquea su eliminación para proteger traducciones.

### Widget de accesibilidad UserWay

La carga global está en `frontend/src/main.tsx`: agrega a `<head>` un único script
asíncrono `https://cdn.userway.org/widget.js`, con ID `userway-widget-script` y
`data-account` tomado de `VITE_USERWAY_ACCOUNT_ID`. No depende de las rutas ni de
los efectos de React StrictMode. Si existe el script por ID o URL, no lo duplica.

Obtén el Account ID del código de instalación oficial de la cuenta que gestiona
ReservaCR y su dominio. En `frontend/.env` (ignorado por Git), configura
`VITE_USERWAY_ACCOUNT_ID=` con ese valor real; alternativamente define la variable
en el entorno del build. No copies credenciales backend al frontend. Vite no lee
el `.env` de la raíz con esta configuración. Reinicia Vite en desarrollo; en
producción reconstruye y despliega `frontend/dist`, porque el valor se incorpora
durante el build. El ID es público, no una clave secreta.

Sin ID, o con un valor compuesto solo de espacios, no se inserta el script ni se
solicita UserWay. La app conserva su comportamiento; solo en desarrollo aparece
una advertencia. Un fallo de red del widget no bloquea el render ni lanza una
excepción desde este cargador. No se guardan datos en cookies/localStorage ni se
envían manualmente tokens, credenciales o datos de usuarios desde la integración.

El script externo puede acceder al DOM y a recursos del navegador, y sus recursos
pueden cambiar sin un despliegue local: revisar privacidad y configuración de la
cuenta antes de activarlo. El widget no sustituye la accesibilidad propia del sitio.
El widget usa el atributo oficial `data-trigger="userway-widget-trigger"` y un
botón de accesibilidad en el header. La QA autenticada detectó que el icono
flotante inferior tapaba controles Owner/Admin; este acceso evita esas superposiciones.
No se fuerza idioma del widget; el selector de ReservaCR sigue gestionando
`html.lang` y su propia preferencia.

No hay CSP del documento en `frontend/index.html` ni en el ejemplo Nginx. Helmet
se configura en el backend; no se modificó. Si el hosting agrega CSP, revisar
`script-src`, `style-src`, `img-src`, `connect-src`, `font-src`, `media-src` y
`frame-src` según la [guía oficial de UserWay](https://help.userway.org/en/articles/15592167-how-to-install-and-get-started-with-the-userway-accessibility-widget)
y los recursos observados en Network. La entrada del script es
`https://cdn.userway.org`; UserWay puede cargar recursos adicionales de sus
dominios. No ampliar políticas ni añadir `unsafe-inline` sin revisar el despliegue.

Con el ID válido: confirmar en Network `widget.js` y recursos de la cuenta sin
errores; en Elements comprobar un solo `#userway-widget-script`, incluso al
cambiar rutas. Abrir/cerrar el widget y revisar Login, catálogo, Reservas, Owner,
Admin y Notificaciones en ES/EN a 375/768/1280 px, incluidos modales y botones
críticos. Confirmar recarga/`html.lang`, preferencia de idioma y ausencia de
superposiciones. No usar IDs de ejemplo ni atribuir a una preparación sin ID un
widget ya validado.

Validación de esta preparación: build frontend y los 9 tests de i18n PASARON.
Chrome local comprobó 18 casos sin ID en Login/404, ES/EN con recarga y preferencia
persistida, a 375/768/1280 px: cero scripts/peticiones UserWay, sin overflow ni
excepciones JavaScript. El backend estaba detenido tras la limpieza QA anterior;
sus peticiones de sesión devolvieron 500 del proxy. Login autenticado, catálogo,
Reservas, Owner, Admin y Notificaciones no se revalidaron en esta etapa. No se
crearon cuentas/sesiones QA ni se accedió a DB/SMTP. Las pruebas con Account ID
válido (carga, abrir/cerrar, posición, duplicación en rutas e interacción real con
i18n/cookies) quedan NO EJECUTADAS. Estado: LISTO CON OBSERVACIONES, pendiente de
configuración y QA del widget real. Esta validación sin ID corresponde a la etapa
previa; la activación local vigente se describe abajo.

Activación local: `frontend/.env` contiene el Account ID oficial proporcionado por
el propietario, `oXADhQbJ9t`. El archivo está ignorado por Git; no se modificaron
entornos de producción. Vite fue iniciado en `localhost:5173`. Chrome local y
Playwright validaron 27 casos públicos de catálogo, Login y 404 en ES/EN a
375/768/1280: script único con ID/account correctos, icono visible, menú real que
abre/cierra, navegación SPA conservando el mismo script, idioma persistido con
recarga y sin overflow documental. Se verificó ausencia de superposición con
controles de header/login y formularios visibles. El icono flotante puede ocupar
una esquina de una tarjeta; no se atribuye esa intersección con el rectángulo de
la tarjeta a un botón crítico tapado. Modales/tablas autenticados siguen pendientes.

UserWay y sus recursos observados respondieron 200; sin 5xx de UserWay, errores
de petición bloqueada o excepciones JavaScript. Las consultas `/api/auth/me`
respondieron 401 esperado sin sesión. Build frontend y los 9 tests de i18n PASARON.
El backend existente respondió DB conectada; no se accedió a cuentas autenticadas,
no se crearon sesiones/datos QA ni se ejecutaron migraciones o acciones SMTP.
QA autenticada con UserWay: NO EJECUTADA, cuentas QA previas eliminadas y sin
credenciales disponibles. Backend sin modificaciones por comparación de hashes.
Estado de activación: LISTO CON OBSERVACIONES por la cobertura autenticada pendiente.
Evidencia de esa etapa pública fuera de Git: `userway-live-validation.json` y seis capturas en la carpeta
de visualizaciones de la sesión. Copia/scripts de pruebas retirados; Chrome cerrado.

QA autenticada posterior (Chrome local/Playwright): 168 casos finales y 10
comprobaciones adicionales PASARON para CLIENT/BUSINESS/ADMIN, Reservas, Owner,
Admin y Notificaciones, ES/EN, a 375/768/1280 px. Incluye cancelación de reserva,
formularios Owner, modal Admin, notificaciones leídas/no leídas y acceso denegado
por rol. El menú abrió/cerró en 30 comprobaciones; sin overflow documental,
superposiciones con controles visibles, excepciones JavaScript, 5xx ni bloqueos
de peticiones. Recarga y navegación SPA conservaron idioma y un solo cargador.
El selector amplio `script[src*="userway"]` cuenta 3–4 recursos legítimos del SDK;
el cargador `widget.js`, el botón y el iframe del widget son únicos.
Build frontend y los 9 tests de i18n PASARON. Backend, esquema y registros
originales permanecieron intactos. Se usó exclusivamente SMTP local de captura.
Las tres cuentas y fixtures QA quedan inventariados por IDs exactos, pendientes
de autorización de limpieza; no se deben borrar por prefijo o correo parcial.
Evidencia vigente fuera de Git: `userway-auth-final-results.json`,
`userway-auth-manifest.json` y capturas `uw-auth-fixed-*.png`. El backend/SMTP
temporal y Chrome QA fueron detenidos; los scripts temporales fueron retirados.
Estado: LISTO CON OBSERVACIONES por la limpieza pendiente y la precisión del
contador de scripts del SDK; la cobertura autenticada ya fue ejecutada.

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

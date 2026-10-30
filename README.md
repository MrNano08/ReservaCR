# ReservaCR

**Plataforma web para descubrir negocios locales y gestionar reservas de servicios.**

ReservaCR conecta a personas que buscan un servicio con negocios que administran su disponibilidad. Permite consultar un catálogo, elegir fechas y horarios, crear y cancelar reservas, y gestionar la operación desde paneles diferenciados para clientes, propietarios y administradores.

El proyecto se desarrolló en el contexto del curso **Aplicaciones Informáticas Globales (EIF409)** de la **Universidad Nacional de Costa Rica, Campus Nicoya**. Su objetivo técnico es integrar una aplicación web completa: interfaz, API, base de datos, reglas de negocio y despliegue en un servidor Linux.

## Funcionalidades

| Área | Capacidades |
| --- | --- |
| Clientes | Registro e inicio de sesión, búsqueda de negocios y servicios, consulta de disponibilidad, reservas, historial y cancelaciones. |
| Propietarios | Gestión de perfil del negocio, servicios, horarios, cupos, bloqueos y agenda de reservas. |
| Administración | Revisión y aprobación de negocios, administración del catálogo y seguimiento de notificaciones. |
| Notificaciones | Avisos dentro de la aplicación y envío de correos para eventos de reservas y recuperación de acceso, con reintentos ante fallos de entrega. |
| Idiomas | Interfaz disponible en español e inglés, con formato localizado de fechas y horas. |

### Reglas de reserva

- La disponibilidad se comprueba nuevamente al confirmar una reserva para reducir conflictos de concurrencia.
- Los cupos pertenecen al negocio y se comparten entre sus servicios; no se administra una agenda individual por empleado.
- Las reservas utilizan franjas base de **30 minutos** y contemplan bloqueos de horario.
- El sistema impide que un mismo cliente confirme reservas que se superpongan.
- El horizonte documentado de reservación es de **90 días**. La cancelación admite una antelación predeterminada de **120 minutos**, configurable por negocio.
- El registro de la reserva es independiente de la entrega del correo: una incidencia SMTP no debe invalidar una reserva confirmada.

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Frontend | React, TypeScript, Vite, CSS |
| Backend | Node.js, NestJS, TypeScript |
| Datos | MariaDB, TypeORM y migraciones |
| Validación | Zod y validaciones del backend |
| Internacionalización | i18next, react-i18next |
| Correo | Nodemailer, SMTP y notificaciones persistentes |
| Archivos | Subida de imágenes y procesamiento con Sharp |
| Infraestructura | Debian GNU/Linux, Nginx y systemd |
| Herramientas de desarrollo | npm, Docker Compose y Mailpit (opcionales) |

## Arquitectura

```text
Navegador
   |
   v
React + TypeScript (Vite)
   |
   | HTTP(S) / JSON
   v
NestJS - API REST (/api)
   |             |               |
   v             v               v
TypeORM      SMTP / correo   Imágenes (/uploads)
   |
   v
MariaDB
```

En el entorno de despliegue documentado, **Nginx** sirve el frontend compilado y funciona como proxy inverso para la API y los archivos públicos. El backend se ejecuta como servicio de **systemd**. La persistencia principal se realiza en MariaDB, sin depender de datos simulados para operar.

## Inicio rápido en desarrollo

### Requisitos

- **Node.js 22.12 o posterior** y npm.
- **MariaDB 10.11 o posterior**, local o mediante Docker Compose.
- Docker Compose es opcional; permite levantar servicios auxiliares de desarrollo.

### 1. Clonar e instalar

```bash
git clone https://github.com/MrNano08/ReservaCR.git
cd ReservaCR
npm ci
node scripts/setup.mjs
```

### 2. Configurar las variables de entorno

Edita `backend/.env` con los valores de tu entorno de desarrollo, en especial la conexión a MariaDB y el origen de la interfaz web (`WEB_ORIGIN`). Si utilizas Compose, comprueba que la contraseña de la base coincida con la configuración de los contenedores.

**No subas archivos `.env`, credenciales ni copias de bases de datos al repositorio.**

### 3. Preparar la base de datos

Si utilizas los servicios locales definidos para desarrollo:

```bash
docker compose up -d
```

Si ya tienes MariaDB instalado, puedes utilizarlo sin Docker. En ambos casos, configura primero una base de datos y un usuario con los permisos necesarios para el proyecto.

Ejecuta las migraciones:

```bash
npm run db:migrate
```

### 4. Iniciar la aplicación

```bash
npm run dev
```

| Servicio | Dirección local |
| --- | --- |
| Aplicación web | `http://localhost:5173` |
| Comprobación de la API | `http://localhost:3000/api/health` |
| Mailpit (si está habilitado) | `http://localhost:8025` |

### Datos de demostración (opcional)

El repositorio documenta un script para cargar cuentas y negocios **ficticios** en un entorno de pruebas. Define primero una contraseña de demostración propia:

```bash
SEED_PASSWORD='CAMBIA_ESTA_CLAVE_LOCAL' node scripts/seed.mjs
```

No ejecutes el seed ni los escenarios de prueba sobre la base de datos de producción.

## Organización del proyecto

```text
ReservaCR/
├── backend/
│   ├── src/
│   │   ├── auth/             # Autenticación, sesiones y permisos
│   │   ├── businesses/       # Negocios, servicios y horarios
│   │   ├── bookings/         # Disponibilidad y reservas
│   │   ├── notifications/    # Avisos y correo
│   │   ├── database/         # Entidades y migraciones
│   │   └── common/           # Funciones y validaciones compartidas
│   └── test/                 # Pruebas del backend
├── frontend/
│   └── src/                 # Componentes, páginas, hooks y servicios
├── scripts/                 # Configuración y datos de demostración
└── README.md
```

## Calidad y pruebas

Desde la raíz del proyecto, los comandos documentados incluyen:

```bash
npm run build
npm test
```

El proyecto también ha utilizado pruebas de integración con MariaDB y pruebas de interfaz en navegador. Estas deben ejecutarse en **entornos de prueba aislados**, nunca sobre datos de producción. Haber superado pruebas en una versión anterior no implica que el estado actual del repositorio esté libre de errores.

## Internacionalización

La interfaz utiliza **i18next** y **react-i18next** para presentar textos en español e inglés. La preferencia de idioma de la interfaz se conserva localmente; el backend también contempla un idioma asociado a cada usuario para ciertas comunicaciones.

Las fechas de las reservas se almacenan en UTC y se presentan según la zona horaria del proyecto, **America/Costa_Rica**.

## Despliegue

La configuración de publicación documentada utiliza:

1. Compilación del frontend y backend con `npm run build`.
2. Migraciones de base de datos con `npm run db:migrate`.
3. **Nginx** para servir `frontend/dist` y enrutar `/api/` y `/uploads/`.
4. **systemd** para mantener activo el proceso del backend.
5. **HTTPS**, cookies seguras y configuración privada de SMTP y base de datos.

Para un despliegue nuevo, adapta los archivos de configuración de infraestructura al dominio y al servidor correspondientes. Haz respaldo de **MariaDB** y del directorio de imágenes antes de actualizar.

## Alcance y límites

ReservaCR está orientado a la gestión de negocios y reservas. En su alcance documentado **no incluye** pagos en línea, facturación, agenda individual por empleado, aplicación móvil nativa ni chat.

El proyecto continúa siendo una base para aprendizaje y evolución técnica; la disponibilidad pública de una instancia de demostración puede variar.

---

**Repositorio:** [github.com/MrNano08/ReservaCR](https://github.com/MrNano08/ReservaCR)

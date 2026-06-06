# Docker - TOTEM

![Docker](https://img.shields.io/badge/Docker-Contenedores-2496ED?logo=docker&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker_Compose-Orquestación-2496ED?logo=docker&logoColor=white)

---

## Requisitos Previos

- Docker Desktop o Docker Engine con Docker Compose, si usarás contenedores.

---

## Ejecución con Docker Compose

> [!TIP]
> Esta es la forma más rápida de levantar todo el sistema: PostgreSQL, backend Express y frontend React servido con Nginx.

### Servicios incluidos

| Servicio | Imagen/base | Puerto local | Rol |
| --- | --- | --- | --- |
| `postgres` | `postgres:16-alpine` | `5432` | Base de datos PostgreSQL con volumen persistente. |
| `backend` | `node:22-bookworm-slim` | `3000` | API Express, Sequelize, Socket.IO y archivos locales. |
| `frontend` | `nginx:1.27-alpine` | `5173` | Build estático de React/Vite y proxy interno hacia el backend. |

### 1. Configurar variables

El archivo raíz `.env.example` contiene valores seguros de desarrollo para Docker Compose. Si necesitas cambiar puertos, secretos de sesión, SMTP o credenciales de PostgreSQL, crea tu `.env` local:

```bash
copy .env.example .env
```
### 2. Levantar todo el sistema

Si ya tienes el archivo de imágenes Docker `totem-docker-images.tar`, cárgalo primero y levanta los servicios sin reconstruir:

```bash
docker load -i totem-docker-images.tar
docker compose up
```

Si no tienes imágenes previamente exportadas, construye y levanta todo con:

```bash
docker compose up --build
```

Cuando los contenedores estén saludables, abre:

| Recurso | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3000` |
| Health backend | `http://localhost:3000/api/health` |
| Prueba de base de datos | `http://localhost:3000/api/db-test` |

### 3. Detener los servicios

```bash
docker compose down
```

Si además quieres eliminar los volúmenes persistentes de PostgreSQL y uploads:

```bash
docker compose down -v
```

> [!CAUTION]
> `docker compose down -v` borra los datos de PostgreSQL y los archivos subidos en Docker.

### Migraciones y seeders en Docker

Las migraciones no se ejecutan automáticamente al iniciar los contenedores para evitar cambios no intencionales. Ejecútalas cuando PostgreSQL y backend estén levantados:

```bash
docker compose exec backend npm run db:migrate
```

Para crear o actualizar el usuario `SuperAdmin` inicial:

```bash
docker compose exec backend npm run db:seed:admin
```

Este seeder crea o actualiza el primer usuario administrativo:

| Campo | Valor |
| --- | --- |
| Nombre | `Juan Perez` |
| Correo | `superadmin@gmail.com` |
| Contraseña | `Qqwerty8!` |
| Rol | `SuperAdmin` |

Tambien se pueden cargar los scripts SQL ubicados en la carpeta `database/`.

```text
database/
|-- 01_schema.sql
|-- 02_seed.sql
`-- README_BD.md
```

| Archivo | Descripción |
| --- | --- |
| `01_schema.sql` | Script de generación de la base de datos. Contiene tablas, claves primarias, claves foráneas, índices y tipos necesarios. |
| `02_seed.sql` | Script de inserción de datos de ejemplo para pruebas o demostración del sistema. |
| `README_BD.md` | Documento descriptivo sobre la base de datos y el uso de los scripts. |

Para cargar los scripts SQL en Docker ejecutar en PowerShell: 

```bash
Get-Content database/01_schema.sql | docker compose exec -T postgres psql -U usuario -d nombre_bd
Get-Content database/02_seed.sql | docker compose exec -T postgres psql -U usuario -d nombre_bd 
```

Si la estructura ya fue creada con migraciones y solo se desean cargar datos de ejemplo: 

```bash
Get-Content database/02_seed.sql | docker compose exec -T postgres psql -U usuario -d nombre_bd 
```

### Usuarios de prueba

| Rol | Correo | Contraseña |
| --- | --- | --- |
| SuperAdmin | `superadmin@totem.test` | `Admin123*` |
| Admin Cochabamba | `admin.cbba@totem.test` | `Admin123*` |
| Admin La Paz | `admin.lpz@totem.test` | `Admin123*` |

---
### Comunicación entre contenedores

- El backend se conecta a PostgreSQL usando `PGHOST=postgres`, que es el nombre del servicio dentro de la red de Docker Compose.
- En Docker, el frontend se compila con `VITE_API_URL` vacío para usar rutas relativas.
- Nginx reenvía `/api`, `/client`, `/uploads` y `/socket.io` al servicio `backend:3000`.
- `FRONTEND_URL=http://localhost:5173` mantiene CORS, cookies, enlaces de recuperación y Socket.IO alineados con el origen usado por el navegador.

### Persistencia

| Volumen | Montaje | Contenido |
| --- | --- | --- |
| `postgres_data` | `/var/lib/postgresql/data` | Datos de PostgreSQL. |
| `backend_uploads` | `/app/uploads` | Archivos locales subidos por el backend. |

En Docker, `PUBLIC_FILES_URL=/uploads` para que los archivos se sirvan por el mismo origen del frontend mediante Nginx. En ejecución local sin Docker puedes conservar `PUBLIC_FILES_URL=http://localhost:3000/uploads`.

### Archivos

- En Docker Compose, los archivos se guardan en el volumen persistente `backend_uploads`, montado en `/app/uploads`.
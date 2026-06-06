# Base de Datos - TOTEM

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Base_de_Datos-4169E1?logo=postgresql&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-ORM-52B0E7?logo=sequelize&logoColor=white)
![SQL](https://img.shields.io/badge/SQL-Scripts-336791?logo=postgresql&logoColor=white)

---

## Descripción

Esta carpeta contiene los scripts SQL utilizados para documentar, generar y poblar la base de datos del sistema **TOTEM**.

La base de datos está desarrollada en **PostgreSQL** y es utilizada por el backend del sistema para almacenar información relacionada con usuarios, campus, tótems, contenidos, asignaciones, notificaciones, sesiones y datos del modo de preguntas basado en documentos PDF.

---

## Estructura de archivos

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

---

## Scripts incluidos

### `01_schema.sql`

Contiene la estructura principal de la base de datos del sistema **TOTEM**.

Incluye:

- Creación de tablas.
- Definición de claves primarias.
- Definición de claves foráneas.
- Creación de índices.
- Tipos `ENUM` necesarios para algunos campos.
- Relaciones entre entidades principales.

### `02_seed.sql`

Contiene datos de ejemplo para cargar información inicial en la base de datos.

Incluye datos de prueba para:

- Campus.
- Usuarios administrativos.
- Tótems.
- Contenidos.
- Asignaciones.
- Notificaciones.
- Documentos PDF.
- Preguntas y respuestas extraídas.
- Imágenes asociadas a preguntas.

---

## Orden de ejecución

> [!IMPORTANT]
> Los scripts deben ejecutarse en orden. Primero se debe crear la estructura y después insertar los datos de ejemplo.

### 1. Ejecutar el script de estructura

```bash
psql -U usuario -d nombre_base_datos -f database/01_schema.sql
```

### 2. Ejecutar el script de datos de ejemplo

```bash
psql -U usuario -d nombre_base_datos -f database/02_seed.sql
```

También se puede ejecutar usando una URL de conexión:

```bash
psql "postgresql://usuario:password@host:puerto/base_datos" -f database/01_schema.sql
psql "postgresql://usuario:password@host:puerto/base_datos" -f database/02_seed.sql
```

---

## Tablas principales

| Tabla | Función |
| --- | --- |
| `campuses` | Almacena los campus o sedes del sistema. |
| `app_user` | Registra los usuarios administrativos. |
| `totems` | Almacena los tótems digitales registrados. |
| `contents` | Guarda los contenidos que pueden mostrarse en los tótems. |
| `totem_contents` | Relaciona los contenidos con los tótems asignados. |
| `notification` | Registra las notificaciones creadas desde el panel administrativo. |
| `notification_target` | Define los destinos de las notificaciones. |
| `pdf_documents` | Almacena documentos PDF procesados. |
| `pdf_chunks` | Guarda preguntas y respuestas extraídas desde los PDFs. |
| `pdf_question_images` | Permite asociar imágenes a preguntas extraídas desde PDFs. |
| `totem_device_sessions` | Registra sesiones de vinculación de los dispositivos tótem. |
| `totem_question_sessions` | Registra sesiones del modo preguntas. |
| `user_invitations` | Guarda invitaciones enviadas a nuevos usuarios. |
| `password_reset_token` | Guarda tokens para recuperación de contraseña. |
| `user_sessions` | Almacena sesiones de usuarios autenticados. |
| `SequelizeMeta` | Tabla interna utilizada por Sequelize para controlar migraciones ejecutadas. |

---

## Datos de prueba

El archivo `02_seed.sql` carga información básica para probar el funcionamiento del sistema.

### Usuarios de prueba

| Rol | Correo | Contraseña |
| --- | --- | --- |
| SuperAdmin | `superadmin@totem.test` | `Admin123*` |
| Admin Cochabamba | `admin.cbba@totem.test` | `Admin123*` |
| Admin La Paz | `admin.lpz@totem.test` | `Admin123*` |

> [!NOTE]
> Las contraseñas de prueba deben usarse únicamente en entornos locales, pruebas o demostraciones.

---

## Consideraciones importantes

> [!CAUTION]
> El archivo `02_seed.sql` puede eliminar datos existentes mediante `TRUNCATE`. No debe ejecutarse sobre una base de datos de producción con información real.

Usar los scripts únicamente en:

- Entorno local.
- Entorno de pruebas.
- Base de datos de demostración.
- Preparación de datos para presentación.

---

## Uso con Sequelize

El sistema utiliza **Sequelize ORM** para manejar modelos, relaciones y migraciones desde el backend.

Aunque estos scripts SQL permiten documentar y recrear la base de datos, durante el desarrollo también se pueden utilizar los comandos propios del backend para ejecutar migraciones y seeders.

Ejemplo:

```bash
npm run db:migrate
```
-- ==========================================================
-- 02_seed.sql
-- Datos de ejemplo para la base de datos del sistema TOTEM
-- Ejecutar después de 01_schema.sql
-- ==========================================================

BEGIN;

-- Extensión usada para generar hashes de contraseña de ejemplo.
-- Si tu servidor PostgreSQL no permite crear extensiones,
-- reemplaza crypt('Admin123*', gen_salt('bf', 12)) por un hash bcrypt real.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ADVERTENCIA:
-- Este script elimina datos existentes de las tablas principales.
-- Usar solo en entorno local, pruebas o demostración.

TRUNCATE TABLE
    public.user_sessions,
    public.user_invitations,
    public.password_reset_token,
    public.pdf_question_images,
    public.pdf_chunks,
    public.pdf_documents,
    public.notification_target,
    public.notification,
    public.totem_question_sessions,
    public.totem_device_sessions,
    public.totem_contents,
    public.contents,
    public.totems,
    public.app_user,
    public.campuses
RESTART IDENTITY CASCADE;

-- ==========================================================
-- 1. CAMPUS
-- ==========================================================

INSERT INTO public.campuses (name)
VALUES
    ('Cochabamba'),
    ('La Paz'),
    ('Sucre'),
    ('Santa Cruz'),
    ('Trinidad');

-- ==========================================================
-- 2. USUARIOS
-- Contraseña de prueba para todos: Admin123*
-- ==========================================================

INSERT INTO public.app_user
(name, email, password_hash, role, status, campus_id)
VALUES
    (
        'Administrador General',
        'superadmin@totem.test',
        crypt('Admin123*', gen_salt('bf', 12)),
        'SuperAdmin',
        1,
        1
    ),
    (
        'Admin Cochabamba',
        'admin.cbba@totem.test',
        crypt('Admin123*', gen_salt('bf', 12)),
        'Admin',
        1,
        1
    ),
    (
        'Admin La Paz',
        'admin.lpz@totem.test',
        crypt('Admin123*', gen_salt('bf', 12)),
        'Admin',
        1,
        2
    ),
    (
        'Usuario Invitado',
        'invitado@totem.test',
        NULL,
        'Admin',
        2,
        1
    );

-- ==========================================================
-- 3. INVITACIÓN DE USUARIO DE EJEMPLO
-- ==========================================================

INSERT INTO public.user_invitations
(user_id, token_hash, expires_at)
VALUES
    (
        4,
        'HASH_TOKEN_INVITACION_DEMO',
        NOW() + INTERVAL '24 hours'
    );

-- ==========================================================
-- 4. TÓTEMS
-- ==========================================================

INSERT INTO public.totems
(
    name,
    code,
    state,
    connection_status,
    device_token,
    linking_code,
    linking_code_generated_at,
    linking_code_expires_at,
    linking_code_ttl_minutes,
    campus_id
)
VALUES
    (
        'Tótem Principal Cochabamba',
        'TOTEM-CBBA-001',
        'active',
        'offline',
        'device-token-cbba-001',
        '123456',
        NOW(),
        NOW() + INTERVAL '10 minutes',
        10,
        1
    ),
    (
        'Tótem Biblioteca Cochabamba',
        'TOTEM-CBBA-002',
        'active',
        'offline',
        'device-token-cbba-002',
        NULL,
        NULL,
        NULL,
        NULL,
        1
    ),
    (
        'Tótem Principal La Paz',
        'TOTEM-LPZ-001',
        'active',
        'offline',
        'device-token-lpz-001',
        NULL,
        NULL,
        NULL,
        NULL,
        2
    ),
    (
        'Tótem Principal Sucre',
        'TOTEM-SCRE-001',
        'active',
        'offline',
        'device-token-scre-001',
        NULL,
        NULL,
        NULL,
        NULL,
        3
    ),
    (
        'Tótem Santa Cruz',
        'TOTEM-SCZ-001',
        'inactive',
        'offline',
        'device-token-scz-001',
        NULL,
        NULL,
        NULL,
        NULL,
        4
    );

-- ==========================================================
-- 5. CONTENIDOS
-- ==========================================================

INSERT INTO public.contents
(
    title,
    description,
    content_type,
    file_url,
    status,
    campus_id,
    file_path,
    file_provider,
    file_mime_type,
    file_size
)
VALUES
    (
        'Bienvenida Institucional',
        'Imagen de bienvenida para los estudiantes y visitantes.',
        'image',
        '/uploads/contents/bienvenida-institucional.png',
        'active',
        1,
        'contents/bienvenida-institucional.png',
        'local',
        'image/png',
        350000
    ),
    (
        'Video Institucional',
        'Video informativo sobre la institución.',
        'video',
        '/uploads/contents/video-institucional.mp4',
        'active',
        1,
        'contents/video-institucional.mp4',
        'local',
        'video/mp4',
        12500000
    ),
    (
        'Horarios de Atención',
        'Los horarios de atención administrativa son de lunes a viernes de 08:00 a 18:00.',
        'news',
        NULL,
        'active',
        1,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        'Preguntas Frecuentes Cochabamba',
        'Documento PDF con preguntas y respuestas frecuentes para el tótem.',
        'pdf',
        '/uploads/contents/preguntas-frecuentes-cbba.pdf',
        'active',
        1,
        'contents/preguntas-frecuentes-cbba.pdf',
        'local',
        'application/pdf',
        980000
    ),
    (
        'Agenda Académica La Paz',
        'Imagen informativa sobre actividades académicas.',
        'image',
        '/uploads/contents/agenda-academica-lapaz.png',
        'active',
        2,
        'contents/agenda-academica-lapaz.png',
        'local',
        'image/png',
        420000
    ),
    (
        'Comunicado de Mantenimiento',
        'Se realizará mantenimiento preventivo en los laboratorios durante el fin de semana.',
        'news',
        NULL,
        'active',
        2,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        'Reglamento de Servicios Estudiantiles',
        'Documento PDF con información sobre servicios estudiantiles.',
        'pdf',
        '/uploads/contents/reglamento-servicios.pdf',
        'active',
        3,
        'contents/reglamento-servicios.pdf',
        'local',
        'application/pdf',
        760000
    ),
    (
        'Evento Institucional Santa Cruz',
        'Imagen promocional de evento institucional.',
        'image',
        '/uploads/contents/evento-scz.png',
        'active',
        4,
        'contents/evento-scz.png',
        'local',
        'image/png',
        390000
    );

-- ==========================================================
-- 6. ASIGNACIONES DE CONTENIDO A TÓTEMS
-- ==========================================================

INSERT INTO public.totem_contents
(
    totem_id,
    content_id,
    status,
    start_at,
    end_at,
    priority,
    sort_order
)
VALUES
    (1, 1, 'active', NOW(), NOW() + INTERVAL '30 days', 2, 1),
    (1, 2, 'active', NOW(), NOW() + INTERVAL '15 days', 1, 1),
    (1, 3, 'active', NOW(), NOW() + INTERVAL '10 days', 1, 1),
    (1, 4, 'active', NOW(), NOW() + INTERVAL '60 days', 1, 1),
    (2, 1, 'active', NOW(), NOW() + INTERVAL '30 days', 1, 1),
    (3, 5, 'active', NOW(), NOW() + INTERVAL '20 days', 1, 1),
    (3, 6, 'active', NOW(), NOW() + INTERVAL '7 days', 1, 1),
    (4, 7, 'active', NOW(), NOW() + INTERVAL '60 days', 1, 1);

-- ==========================================================
-- 7. DOCUMENTOS PDF PROCESADOS
-- ==========================================================

INSERT INTO public.pdf_documents
(
    content_id,
    file_url,
    extraction_status,
    extracted_text,
    parsed_pairs_count,
    processed_at
)
VALUES
    (
        4,
        '/uploads/contents/preguntas-frecuentes-cbba.pdf',
        'completed',
        'Texto extraído del documento de preguntas frecuentes Cochabamba.',
        3,
        NOW()
    ),
    (
        7,
        '/uploads/contents/reglamento-servicios.pdf',
        'completed',
        'Texto extraído del reglamento de servicios estudiantiles.',
        2,
        NOW()
    );

-- ==========================================================
-- 8. PREGUNTAS Y RESPUESTAS EXTRAÍDAS DE PDF
-- ==========================================================

INSERT INTO public.pdf_chunks
(
    pdf_document_id,
    chunk_order,
    question_text,
    answer_text,
    question_key
)
VALUES
    (
        1,
        1,
        '¿Dónde se encuentra la biblioteca?',
        'La biblioteca se encuentra en el bloque principal de la sede.',
        'donde-se-encuentra-la-biblioteca'
    ),
    (
        1,
        2,
        '¿Cuál es el horario de atención?',
        'El horario de atención es de lunes a viernes de 08:00 a 18:00.',
        'cual-es-el-horario-de-atencion'
    ),
    (
        1,
        3,
        '¿Dónde puedo realizar consultas administrativas?',
        'Las consultas administrativas pueden realizarse en ventanilla de atención estudiantil.',
        'consultas-administrativas'
    ),
    (
        2,
        1,
        '¿Qué servicios están disponibles para estudiantes?',
        'Los estudiantes tienen acceso a biblioteca, laboratorios, atención administrativa y servicios académicos.',
        'servicios-disponibles-estudiantes'
    ),
    (
        2,
        2,
        '¿Dónde se solicitan certificados?',
        'Los certificados se solicitan en el área de registros académicos.',
        'solicitud-certificados'
    );

-- ==========================================================
-- 9. IMÁGENES ASOCIADAS A PREGUNTAS PDF
-- ==========================================================

INSERT INTO public.pdf_question_images
(
    pdf_chunk_id,
    file_url,
    sort_order,
    status,
    file_path,
    file_provider,
    file_mime_type,
    file_size
)
VALUES
    (
        1,
        '/uploads/pdf-question-images/biblioteca-ubicacion.png',
        1,
        'active',
        'pdf-question-images/biblioteca-ubicacion.png',
        'local',
        'image/png',
        250000
    ),
    (
        3,
        '/uploads/pdf-question-images/ventanilla-atencion.png',
        1,
        'active',
        'pdf-question-images/ventanilla-atencion.png',
        'local',
        'image/png',
        300000
    ),
    (
        4,
        '/uploads/pdf-question-images/servicios-estudiantiles.png',
        1,
        'active',
        'pdf-question-images/servicios-estudiantiles.png',
        'local',
        'image/png',
        280000
    );

-- ==========================================================
-- 10. NOTIFICACIONES
-- ==========================================================

INSERT INTO public.notification
(
    title,
    message,
    created_by,
    type,
    duration_minutes,
    target_scope,
    start_at,
    end_at,
    status
)
VALUES
    (
        'Bienvenida al sistema TOTEM',
        'Bienvenidos al sistema informativo institucional.',
        1,
        'normal',
        120,
        'all',
        NOW(),
        NOW() + INTERVAL '120 minutes',
        'active'
    ),
    (
        'Mantenimiento programado',
        'El laboratorio principal estará en mantenimiento durante el fin de semana.',
        1,
        'normal',
        240,
        'campus',
        NOW(),
        NOW() + INTERVAL '240 minutes',
        'active'
    ),
    (
        'Aviso urgente',
        'Se solicita prestar atención a las indicaciones del personal administrativo.',
        1,
        'urgent',
        30,
        'totems',
        NOW(),
        NOW() + INTERVAL '30 minutes',
        'active'
    );

-- ==========================================================
-- 11. DESTINOS DE NOTIFICACIONES
-- ==========================================================

INSERT INTO public.notification_target
(
    notification_id,
    totem_id,
    campus_id,
    target_type
)
VALUES
    (1, NULL, NULL, 'all'),
    (2, NULL, 1, 'campus'),
    (3, 1, NULL, 'totem');

-- ==========================================================
-- 12. TOKEN DE RECUPERACIÓN DE CONTRASEÑA DE EJEMPLO
-- ==========================================================

INSERT INTO public.password_reset_token
(
    user_id,
    token_hash,
    expires_at
)
VALUES
    (
        3,
        'HASH_TOKEN_RESET_DEMO',
        NOW() + INTERVAL '30 minutes'
    );

COMMIT;
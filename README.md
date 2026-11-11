# 4Clover Technology - Sitio Web Público

Sitio web institucional de **4Clover Technology SpA**, construido con Astro + Tailwind CSS y servido mediante Docker + Nginx.

## Stack Tecnológico

- **[Astro](https://astro.build/)** — Framework de sitios estáticos ultra performante
- **[Tailwind CSS](https://tailwindcss.com/)** — Estilos utilitarios
- **[TypeScript](https://www.typescriptlang.org/)** — Tipado estático
- **[Docker](https://www.docker.com/) + Nginx Alpine** — Contenedor de producción (~25MB)

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:4321)
npm run dev

# Compilar para producción
npm run build

# Previsualizar build local
npm run preview
```

## Producción con Docker

```bash
# Construir y levantar el contenedor
docker compose up -d --build

# Ver logs
docker compose logs -f

# Detener
docker compose down
```

El sitio estará disponible en **http://localhost:80**.

## Configuración Requerida Antes de Publicar

### 1. Formspree (formulario de contacto)
1. Crear una cuenta en [formspree.io](https://formspree.io)
2. Crear un nuevo formulario y copiar el ID
3. Reemplazar `YOUR_FORM_ID` en `src/components/Contact.astro`

### 2. WhatsApp
- Editar el número en `src/components/Contact.astro` y `src/components/WhatsAppButton.astro`
- Variable: `WHATSAPP_NUMBER = '56942405123'`

### 3. Calendly
- Editar la URL en `src/components/Contact.astro` y `src/components/Hero.astro`
- Variable: `CALENDLY_URL = 'https://calendly.com/4clover'`

### 4. Email de contacto
- Editar en `src/components/Contact.astro` y `src/components/Footer.astro`
- Variable: `EMAIL = 'contacto@4clover.cl'`

### 5. URL del sitio (SEO/Sitemap)
- Editar `site` en `astro.config.mjs` con el dominio real

## Auto-diagnóstico de ciberseguridad (páginas privadas)

Cuestionarios que se comparten **solo por correo**: `/diagnostico/<cliente>-<token>/`.
Hoy existe uno: `/diagnostico/triconos-mineros-yjbr6uvi32uq/`.

**Cómo llegan las respuestas.** El navegador del cliente cifra todo (RSA-OAEP-4096 + AES-256-GCM,
Web Crypto) con la llave pública de 4Clover y lo envía a Formspree. Formspree y el correo solo ven un
bloque `-----BEGIN 4CLOVER DIAGNOSTICO-----`; si el cifrado falla, no se envía nada.

**Cómo leerlas.**
1. Abre `tools/visor-diagnostico.html` con doble clic (funciona sin internet; no se publica).
2. Carga la llave privada (`Documentos/4Clover/diagnostico-llave-privada.pem`).
3. Pega el bloque del correo (o el correo completo) y pulsa *Descifrar*: reporte imprimible, CSV (Excel) o JSON.

Alternativa por consola: `node scripts/diagnostico-descifrar.mjs <llave.pem> <correo.txt> [salida.json]`.

**La llave privada.** Sin ella no se pueden leer las respuestas: guarda una copia en un lugar seguro
(gestor de contraseñas o USB cifrado). Nunca la subas al repo ni al servidor. Para rotarla:
`node scripts/diagnostico-llaves.mjs` y pega la nueva llave pública en `src/data/diagnosticos/index.ts`
(las respuestas antiguas solo se abren con la llave antigua).

**Privacidad de la página.** `noindex` (meta y header `X-Robots-Tag`), fuera del sitemap, URL con
token aleatorio, CSP estricta (solo scripts propios; la única salida de datos permitida es Formspree),
sin analítica ni scripts de terceros. El avance se guarda solo en el navegador del cliente y se borra al enviar.
Para revocar un enlace, cambia el token del `slug` y vuelve a desplegar.

**Nuevo cliente.** Copia `src/data/diagnosticos/triconos-mineros.ts`, ajusta textos y `slug`
(token nuevo: `node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"`) y agrégalo
a la lista en `src/data/diagnosticos/index.ts`. El puntaje se calcula con el `score` de cada opción
(Sí 1 · Parcial 0,5 · No / No sé 0 · N/A no cuenta); las preguntas informativas no puntúan.

## Estructura del Proyecto

```
public-website/
├── src/
│   ├── components/         # Componentes Astro
│   ├── layouts/Layout.astro
│   ├── data/diagnosticos/  # Cuestionarios del auto-diagnóstico + llave pública
│   ├── lib/diagnostico/    # Tipos, puntaje y cifrado
│   ├── scripts/            # Lógica de cliente del auto-diagnóstico
│   ├── pages/
│   │   ├── index.astro     # Página principal
│   │   ├── diagnostico/    # Páginas privadas (noindex)
│   │   └── 404.astro
│   └── styles/global.css
├── public/
│   ├── js/theme-init.js    # Tema claro/oscuro sin script inline (CSP)
│   └── logos/              # Logos (dark y light)
├── scripts/                # Generar llaves / descifrar por consola
├── tools/                  # Visor local de respuestas (no se publica)
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

## Funcionalidades

- Modo claro / oscuro (con persistencia en localStorage)
- Animaciones scroll-triggered con IntersectionObserver
- Formulario de contacto con Formspree
- Integración con WhatsApp (botón flotante + enlace directo)
- Popup de Calendly para agendar reuniones
- SEO completo (meta tags, Open Graph, sitemap, robots.txt)
- Responsive mobile-first
- Nginx con Gzip, cache headers y security headers

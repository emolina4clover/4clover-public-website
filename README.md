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

## Estructura del Proyecto

```
public-website/
├── src/
│   ├── components/         # Componentes Astro
│   ├── layouts/Layout.astro
│   ├── pages/
│   │   ├── index.astro     # Página principal
│   │   └── 404.astro
│   └── styles/global.css
├── public/
│   └── logos/              # Logos (dark y light)
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

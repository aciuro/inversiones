# Inversiones

App web para seguimiento de inversiones inmobiliarias de pozo entre socios.

## Features

- Login con usuario y contraseña (cada socio tiene su cuenta)
- Acceso granular por proyecto (cada usuario ve solo los proyectos donde participa)
- Por proyecto:
  - Precio de entrada y valor actual (editable)
  - Cuotas mensuales fijas — marcar como pagadas con un click
  - Refuerzos bianualles opcionales
  - Total invertido y % de ganancia calculados automáticamente
  - Sección de archivos (fotos, contratos, recibos)
- Cambio de contraseña desde configuración

## Stack

- **Next.js 16** (App Router)
- **PostgreSQL** + **Prisma 7**
- **NextAuth.js v5** (autenticación JWT)
- **shadcn/ui** + **Tailwind CSS**
- **Deploy:** Railway

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://user:password@host:5432/db"
AUTH_SECRET="genera-uno-con-openssl-rand-base64-32"
UPLOAD_DIR="./uploads"
```

### 3. Generar cliente Prisma y migrar

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Crear usuarios iniciales

Editá los emails en `prisma/seed.ts` y ejecutá:

```bash
npx tsx prisma/seed.ts
```

### 5. Correr en desarrollo

```bash
npm run dev
```

## Deploy en Railway

El proyecto deploya automáticamente desde el branch `master`.

**Build command:**
```
npx prisma generate && npm run build
```

**Variables requeridas en Railway:**
- `DATABASE_URL` — referencia al servicio PostgreSQL
- `AUTH_SECRET` — secret para JWT
- `AUTH_TRUST_HOST` — `true`
- `UPLOAD_DIR` — `/uploads`
- `NEXTAUTH_URL` — URL pública del servicio

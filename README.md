# Inversiones

App web para seguimiento de inversiones inmobiliarias de pozo entre socios. Permite registrar proyectos, cuotas, refuerzos, y llevar el balance personal de cada inversor.

---

## Stack

- **Framework**: Next.js 16 (App Router, server + client components)
- **Base de datos**: PostgreSQL en Railway
- **ORM**: Prisma 7 con adapter PrismaPg
- **Auth**: Auth.js (NextAuth v5) con Credentials provider
- **UI**: Tailwind CSS + shadcn/ui + Recharts
- **Deploy**: Railway (CI desde GitHub `master`)

---

## Funcionalidades

### Proyectos
- Crear proyectos con: nombre, desarrolladora, ubicación, unidad, moneda (USD o BRL), precio total, precio de entrada, precio de entrada en BRL
- Socios por proyecto con porcentaje de participación
- Estado: `active`, `pending_approval`, `sold`
- Valor actual modificable (arranca igual al precio total)

### Cuotas y refuerzos
- Cuotas mensuales con fecha de vencimiento y monto
- Refuerzos con fecha y etiqueta
- Proyectos BRL: `amount` en reales, `amountUSD` opcional (se carga al pagar)
- Modal de pago: registrar equivalente en USD y quién pagó
- Desmarcar cuota pagada requiere aprobación de todos los socios (excepto proyectos sin socios)

### Sistema de aprobaciones
- Modificar una cuota pagada → propone un `PendingChange`
- Modificar el valor actual → propone un `PendingChange`
- Cada socio aprueba desde el dashboard o desde el proyecto
- Si todos aprueban → se aplica el cambio automáticamente
- Proyectos sin socios → cambios se aplican inmediatamente

### Invitaciones
- Al crear un proyecto con socios, se generan `ProjectInvite`
- El proyecto queda en `pending_approval` hasta que todos acepten
- Los socios ven las invitaciones pendientes en el dashboard

### Métricas por proyecto
- **Balance** = valor actual − total invertido (entrada + cuotas + refuerzos)
- **Ganancia** = valor actual − precio total del proyecto
- Gráfico de progreso de pago (% sobre precio total)
- Gráfico de barras por concepto (entrada, cuotas, refuerzos, llave en mano)
- Torta de aporte por socio con porcentajes
- Llave en mano = 50% del precio total (pendiente al final)

### Dashboard personal (`/inicio`)
- Resumen: lo invertido, balance, proyectos en curso y finalizados
- Lista de proyectos activos y finalizados en secciones separadas
- Aprobaciones pendientes: invitaciones y cambios propuestos
- Notas personales

### Usuarios
- Login con email y contraseña (bcrypt)
- Crear y eliminar usuarios desde Configuración (`/configuracion`)
- Flag `mustChangePassword`: al crearse, el usuario es forzado a cambiar contraseña antes de navegar

---

## Modelo de datos (Prisma)

```
User
  id, name, email, password, mustChangePassword, createdAt

Project
  id, name, description, developer, location, unitNumber
  totalPrice, entryPrice, entryPriceBRL, currentValue
  currency (USD | BRL), status, soldPrice, soldAt

ProjectMember       → User + Project, role, sharePercent
Installment         → cuota, amount, amountUSD, dueDate, paidAt, paidByUserId
Reinforcement       → refuerzo, amount, amountUSD, dueDate, label, paidAt
PendingChange       → tipo (cuota_unmark | value_update), payload JSON, status
ChangeApproval      → un registro por aprobación por usuario
Note                → nota personal, opcional ligada a proyecto
ProjectInvite       → invitación pendiente o aceptada
ProjectFile         → archivos adjuntos (tabla creada, funcionalidad no implementada)
```

---

## Rutas

```
/                   → redirige a /inicio (logueado) o /login
/inicio             → dashboard personal
/proyectos          → lista de proyectos
/proyectos/nuevo    → formulario nuevo proyecto
/proyectos/[id]     → detalle del proyecto
/configuracion      → gestión de usuarios + cambio de contraseña
/login              → formulario de login
```

---

## Variables de entorno

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://tu-dominio.railway.app
```

Railway inyecta `DATABASE_URL` automáticamente desde el plugin de PostgreSQL.

---

## Setup local

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Deploy

Railway detecta el push a `master` y redeploya automáticamente.

**Build command configurado en Railway:**
```
npx prisma generate && npm run build
```

Las migraciones se corren manualmente contra la DB pública cuando hay cambios de schema:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate dev --name nombre_migracion
```

---

## Usuarios

Los usuarios se crean desde `/configuracion`. Al crearse reciben contraseña temporal y son forzados a cambiarla al primer login.

# Control de Flota — Trazabilidad de inventario

Aplicación web independiente (React + Vite) para reemplazar el marcado con
cinta por un tablero digital de trazabilidad. Los datos se guardan en una
base de datos real (Supabase, gratis) y se sincronizan en tiempo real entre
todos los técnicos que tengan la página abierta.

## 1. Crear la base de datos (Supabase — gratis)

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un proyecto nuevo (elige cualquier nombre y contraseña de base de
   datos; guárdala, no la necesitarás de nuevo para esto).
3. Ve a **SQL Editor** (menú lateral) → **New query**.
4. Abre el archivo `supabase-schema.sql` de esta carpeta, copia todo su
   contenido, pégalo en el editor y dale **Run**. Esto crea la tabla
   `equipos` con los permisos y el tiempo real ya configurados.
5. Ve a **Project Settings → API**. Ahí vas a encontrar dos valores que
   necesitas en el siguiente paso:
   - **Project URL**
   - **anon public** key

## 2. Probar en tu computador (opcional pero recomendado)

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o más).

```bash
cd inventario-app
cp .env.example .env
```

Abre `.env` y pega tu **Project URL** y tu **anon public key** en
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

```bash
npm install
npm run dev
```

Abre la URL que aparece en la terminal (normalmente `http://localhost:5173`).
Deberías ver la aplicación funcionando y cualquier equipo que registres
quedará guardado en tu proyecto de Supabase.

## 3. Subir el código a GitHub

Vercel despliega leyendo un repositorio de GitHub.

1. Crea un repositorio nuevo en [github.com](https://github.com) (puede ser
   privado).
2. Desde la carpeta `inventario-app`:

```bash
git init
git add .
git commit -m "Primera version"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

(El archivo `.env` no se sube gracias al `.gitignore` — eso es correcto y
deseado, las llaves se configuran directamente en Vercel en el paso
siguiente.)

## 4. Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) y crea una cuenta (puedes
   entrar directamente con tu cuenta de GitHub).
2. Clic en **Add New… → Project**.
3. Selecciona el repositorio que acabas de subir. Vercel detecta
   automáticamente que es un proyecto Vite — no cambies nada en "Build and
   Output Settings".
4. Antes de darle a "Deploy", abre la sección **Environment Variables** y
   agrega las dos mismas variables que usaste en tu `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Dale **Deploy**. En un minuto obtienes una URL como
   `https://control-de-flota.vercel.app`.
6. Comparte esa URL con tus compañeros de turno — cualquiera que la abra ve
   y edita el mismo inventario, en tiempo real.

Cada vez que quieras actualizar la app, simplemente haz `git push` de tus
cambios: Vercel vuelve a desplegar automáticamente.

## Notas importantes

- **Nombre del técnico**: cada persona escribe su nombre una sola vez en la
  barra superior; queda guardado en su propio navegador (no se comparte)
  para que sus acciones queden firmadas en la trazabilidad.
- **Seguridad**: esta versión no tiene sistema de usuarios/contraseñas —
  cualquiera con el enlace puede leer y modificar el inventario, lo cual es
  razonable para una herramienta interna de un solo equipo de piso. Si más
  adelante quieres restringir el acceso (por ejemplo, que solo entre gente
  con correo @teleperformance.com), se puede agregar Supabase Auth; pídeme
  ayuda cuando llegues a ese punto.
- **Costos**: el plan gratuito de Supabase y el de Vercel son suficientes
  para este uso (decenas de técnicos, miles de equipos). No deberías pagar
  nada para operar esto.

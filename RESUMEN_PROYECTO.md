# ReadySet Investment — Resumen técnico

*(antes "App de Finanzas"; renombrada el 23/09/2026)*

## Qué es (modelo vigente desde el 23/09/2026)
Herramienta de **seguimiento personal** de inversiones: cada usuario registra las
operaciones que hace por su cuenta en su bróker (Schwab u otro) y ve el
rendimiento y la evolución de su cartera. Además, todos los usuarios ven la misma
sección **"Tendencias del mercado: acciones en alza hoy"**, que es información
general de mercado y **no** una recomendación.

**Cambio de modelo respecto de la versión anterior:** se eliminaron las
recomendaciones personalizadas que el admin enviaba a cada cliente. Motivo:
recomendar compras/ventas a un cliente concreto es, en sustancia,
asesoramiento de inversión, que en Uruguay requiere habilitación del BCU (Ley
18.627 de Mercado de Valores). Las tendencias nuevas se arman solas, son iguales
para todos y no miran la cartera de nadie. Esto baja mucho el riesgo
regulatorio, pero **conviene igual que un abogado de mercado de valores revise
el encuadre y el texto de /terminos antes de abrir la app al público**.

## Stack
- **Frontend**: Next.js 16 (App Router) + React 18, desplegado en Vercel.
- **Backend/DB**: Supabase (Postgres + Auth + Realtime + Edge Functions +
  pg_net + pg_cron), proyecto `app-finanzas` (región sa-east-1).
- Todos los gráficos son SVG hechos a mano, sin librerías.

## URLs
- App: **https://app-finanzas-sandy.vercel.app** ← usar siempre esta (alias
  estable). Las URLs con código aleatorio en el medio son fotos congeladas de
  cada despliegue y no se actualizan nunca.
- Supabase project ref: `snxxmvkvbvvnreurpbxl`
- (El proyecto de Vercel sigue llamándose `app-finanzas`; el nombre de la app
  que ven los usuarios es ReadySet Investment. Si querés otra URL, se agrega un
  dominio o alias en Vercel → Settings → Domains.)

## Despliegue
El token de Vercel de estas sesiones no tiene permisos sobre el team (403), así
que despliega Fernando a mano: extraer el zip (incluye `.vercel/project.json`),
abrir PowerShell en esa carpeta y correr **`vercel.cmd --prod`** (no
`vercel --prod`, que falla por la política de scripts de Windows).

**Importante:** los cambios de base de datos de esta versión ya están aplicados
en Supabase y son compatibles con la versión publicada anterior. Mientras no se
despliegue el frontend nuevo, la pantalla vieja de recomendaciones va a dar
error al intentar enviar una (es esperado: la función quedó deshabilitada).

## Avisos legales en la app
- **/terminos** (pública): términos, condiciones y avisos legales. Dice
  expresamente que ReadySet Investment no es intermediario de valores ni asesor
  de inversión, que no está registrada ni supervisada por el BCU, que no ejecuta
  órdenes ni custodia fondos, que las tendencias no son recomendaciones, que la
  información cargada es meramente informativa y responsabilidad de cada
  usuario, datos de terceros sin garantía, riesgos, datos personales (Ley
  18.331), limitación de responsabilidad y ley uruguaya.
- **Aceptación obligatoria**: al registrarse hay que tildar la aceptación, y
  además `/dashboard`, `/dashboard/resumen` y `/como-empezar` redirigen a
  `/terminos` hasta que el usuario acepte la versión vigente. Queda registrada
  la versión y la fecha en `profiles.terms_version` / `terms_accepted_at`. Si
  se cambia el texto, subir `TERMS_VERSION` en `lib/brand.ts` y a todos se les
  vuelve a pedir que acepten.
- **Pie de página legal** en todas las pantallas.
- Aviso junto a la sección de tendencias y junto al formulario de registrar
  operación.
- Casilla de contacto para datos personales: `CONTACT_EMAIL` en
  `lib/brand.ts` (hoy es el mail de Fernando; conviene cambiarla por una
  casilla de la app).

## Modelo de datos (Postgres, RLS en todas las tablas)
- **profiles**: `role` = `admin` o `cliente`; `terms_version`,
  `terms_accepted_at` *(nuevo)*.
- **instruments**: catálogo con precios sincronizados con Yahoo Finance cada 15
  minutos.
- **holdings**: tenencias de cada cliente (se recalculan solas).
- **position_baselines** *(nueva)*: punto de partida de cada posición (lo que
  había antes de las operaciones editables). Se inicializó con las tenencias
  existentes y el importador de carteras la reescribe.
- **transactions**: registro de operaciones. Columnas nuevas: `source`
  (`cliente` = cargada por el usuario, editable; `historico` = del modelo
  viejo), `locked` (consolidada por una carga de cartera posterior),
  `created_at`, `edited_at`.
- **market_trends** *(nueva)*: top 10 de "Day Gainers" de Yahoo Finance
  (acciones de EE.UU. que suben más de 3% en el día, precio ≥ US$5). Lectura
  para usuarios logueados; solo la escribe la Edge Function.
- **portfolio_value_history**: snapshot diario del valor de cartera.
- **recommendations** y **operation_requests**: quedan con el histórico, ya no
  se usan.

Funciones `SECURITY DEFINER` vigentes (todas validan al usuario):
- `record_my_trade(...)` — registra una compra/venta y recalcula la posición.
- `update_my_trade(tx_id, instrument_id, tipo, cantidad, precio, fecha)`
  *(nueva)* — corrige una operación propia (se puede cambiar incluso el
  instrumento).
- `delete_my_trade(tx_id)` *(nueva)* — elimina una operación propia.
- Ambas re-aplican en orden cronológico todas las operaciones editables desde
  el punto de partida (costo promedio), recalculan las ganancias realizadas de
  las ventas y **rechazan el cambio** si dejaría una venta por encima de la
  tenencia a esa fecha.
- `admin_bulk_load_portfolio(email, tenencias)` — importador; ahora además fija
  el punto de partida y marca como "consolidadas" las operaciones anteriores del
  cliente en ese instrumento.
- `accept_terms(version)` *(nueva)*.
- `update_instrument_price(...)` — ajuste manual de precios (admin).
- Deshabilitadas (sin permiso de ejecución): `create_recommendations`,
  `cancel_operation_request`, `review_operation_request`,
  `set_holding_auto_reinvest`, `notify_recommendation_webhook`.

Probado (en una transacción revertida): compra → venta → corrección de precio
de la compra (recalcula costo promedio y ganancia de la venta) → intento de
borrar la compra dejando la venta sin respaldo (bloqueado) → borrar la venta →
mover la compra a otro instrumento → intento de editar una operación histórica
(bloqueado). Todos los resultados dieron correctos.

## Infraestructura serverless
- **sync-yahoo-prices** (v6): precios del catálogo cada 15 minutos vía pg_cron
  **y** ahora también la lista de tendencias. Un fallo en tendencias no afecta
  los precios; si Yahoo no devuelve datos se conserva la última lista buena.
- **notify-new-user**: mail al admin cuando alguien se registra.
- **notify-recommendation**: sigue desplegada pero ya no la dispara nada (se
  eliminó el trigger). Se puede borrar desde el panel de Supabase.

Límite conocido de Resend: remitente `onboarding@resend.dev` (sandbox), solo
entrega a `fernandoguerr@gmail.com`.

## Pantallas (reorganizadas el 28/09/2026)
Cinco secciones, cada una con pestañas (`?ver=`):
- **Mi cartera** `/dashboard`: Resumen (valor + evolución) · Operaciones
  (registrar, corregir, eliminar) · Ganancias (`?ver=ganancias`).
- **Mercado** `/mercado`: En alza hoy · Buscar (`?q=`) · Cartera ReadySet.
  "Mis inversiones hoy" se integró en Mi cartera (línea "Hoy" + columna "Hoy").
- **Explorar** `/explorar`: Simular · Escenarios · Práctica · Carteras de ejemplo.
- **Cómo empezar** `/como-empezar`: solo la guía para abrir cuenta.
- **Admin** `/admin`: Clientes · Importar (con plantilla CSV) · Cartera ReadySet.
- `/terminos` (solo en el menú).
Redirecciones en `next.config.js`: `/simulador` → `/explorar`,
`/dashboard/resumen` → `/dashboard?ver=ganancias`,
`/admin/importar-cartera` → `/admin?ver=importar`; `/como-empezar?ver=carteras|practica`
→ `/explorar`. Helpers: `lib/page-user.ts` (usuario + términos), `lib/model.ts`.

## Cartera ReadySet (28/09/2026)
Una sola cartera de referencia, **igual para todos**, que publica un admin
(pestaña Admin › Cartera ReadySet: símbolo + peso, repartir en partes iguales,
CSV `symbol,weight`, comentario). Se muestra en Mercado con autor, fecha,
aviso de que no considera la situación de cada usuario y de que quienes la
arman pueden tener esos instrumentos, rendimiento teórico de US$ 1.000 desde
la publicación y versiones anteriores con su resultado.
Tablas `model_portfolios`, `model_positions`, `model_history`; RPC
`admin_publish_model_portfolio(p_comment, p_positions)` (máx. 30, pesos suman
100, desactiva la versión anterior); `refresh_model_history()` en el cron
`practice-history-daily` (21:30 UTC, L-V). Términos actualizados (sección 4 y
punto 2): versión `2026-09-28`, todos los usuarios vuelven a aceptar.

## Buscador y armonía entre secciones (28/09/2026)
- Edge Function `market-search` (verify_jwt; exige usuario logueado o
  `x-cron-secret`): `search` (Yahoo: acciones/ETF/fondos de EE.UU. en USD,
  hasta 5, con día, 1 mes, año, 12 meses, rango 52s y 12 meses de cierres) y
  `add` (valida en Yahoo y agrega el instrumento al catálogo). Server actions
  `searchMarket` / `addInstrumentFromSearch`.
- Desde un resultado: Simular (`/explorar?simbolo=`), cartera de práctica, o
  "Ya lo compré" (`/dashboard?ver=operaciones&simbolo=`). Los símbolos de Mi
  cartera, En alza y Cartera ReadySet enlazan al buscador.
- Mi cartera: línea "Hoy" (US$, %, en alza/en baja), mosaico "Ganancia
  realizada" (enlaza a Ganancias) en lugar del % duplicado, tabla con Hoy en
  US$, ganancia en US$, peso y orden; estado vacío con primeros pasos.
- Ganancias traducida al español. Cartera ReadySet firmada "Equipo ReadySet";
  `author_name` ya no es legible para usuarios (grants por columna).
- Términos `2026-09-28.2` (buscador y firma).

## Catálogo ampliado a Yahoo Finance (29/09/2026)
- Cualquier acción/ETF/fondo de EE.UU. en USD de Yahoo se puede usar: se
  agrega al catálogo automáticamente (validado en Yahoo) al publicar la
  Cartera ReadySet, al importar una cartera (plantilla o Schwab sin precio) y
  desde el buscador de Mercado.
- Editor de la Cartera ReadySet: autocompletado con sugerencias de Yahoo
  (símbolo o nombre) y estado por fila (catálogo / ✓ se agrega de Yahoo / no
  existe).
- Server actions `suggestInstruments` y `ensureInstruments` (con respaldo a
  `search`/`add`). Función `market-search` v3 desplegada el 29/09 (acciones
  `suggest` y `ensure`), probada OK.

## Dividendos (02/10/2026)
- Fuente: Yahoo Finance (`chart?events=div`, 2 años). `sync-yahoo-prices` v11
  refresca una vez por día cada instrumento (de a 25 por corrida) y guarda en
  `instruments`: `div_ttm` (dividendo anual estimado = últimos N pagos, con N
  la frecuencia estándar más cercana: 1/2/4/12/52), `div_count_12m`
  (frecuencia), `div_last_date` (ex-dividendo), `div_last_amount`,
  `div_events` (24 meses). `market_trends` guarda `div_rate`/`div_yield` del
  screener. `market-search` v6 devuelve los mismos datos en el buscador.
- **Retención 30 %** (Schwab, no residentes): `lib/dividends.ts`
  (`DIVIDEND_WITHHOLDING = 0.3`). Se muestra bruto, retención y neto.
- Dónde: Cartera ReadySet (rendimiento por dividendos, US$/año sobre
  US$ 1.000, cobrados netos desde la publicación, resultado total precio +
  dividendos netos, columna por instrumento); Mercado › En alza (columna);
  Mercado › Buscar (bloque de dividendos, con lo que cobrarías con tus
  unidades); Mi cartera (mosaico "Dividendos por año (netos)").

## Fase 1 de mejoras UX (08/10/2026)
- Cada usuario importa su export de Schwab o la plantilla desde Mi cartera ›
  Importar (`PortfolioImporter mode="self"`, RPC `load_my_portfolio`, sin
  crear instrumentos: los nuevos se validan en Yahoo con `ensureInstruments`).
  Botón "Actualizar cartera" en el resumen y CTA principal en la cartera vacía.
- Avisos legales compactos: componente `Note` (una línea + "Más info"
  desplegable); el aviso general queda en el pie de todas las páginas.
- Accesibilidad: contraste AA (muted #6b6a65, verde #087f08, azul #2368bd en
  claro; muted #9a9890 en oscuro), texto mínimo 12 px, foco visible,
  objetivos táctiles de 44 px.
- Mi cartera: 3 indicadores (Invertido · Dividendos netos · Ganancia
  realizada); cantidad de instrumentos en el título de la tabla.
- Registrar operación: buscador de instrumento (símbolo o nombre).
- Barra inferior del celular sin "Cómo empezar" (sigue en menú y cartera vacía).
- Vercel Web Analytics (`@vercel/analytics`); `_vercel` excluido del proxy.
  Hay que activarlo en Vercel → proyecto → Analytics → Enable.

## Seguridad del login
- En la app: contraseña de al menos 10 caracteres con mayúsculas, minúsculas y
  números al registrarse, aceptación de términos, errores de login traducidos
  al español.
- **CAPTCHA (Cloudflare Turnstile)** en login y registro, sin dependencias
  (`components/TurnstileWidget.tsx`). Se activa solo si existe la variable
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel. Orden obligatorio: crear el
  widget en Cloudflare → cargar la variable en Vercel → desplegar → recién
  ahí activar CAPTCHA en Supabase con la Secret Key (si se activa antes en
  Supabase, nadie puede iniciar sesión).
- **Pendiente en el panel de Supabase** (la app no lo puede forzar sola): ver la
  guía de seguridad del login entregada en el chat del 23/09/2026 — largo
  mínimo y caracteres requeridos, confirmación de email, CAPTCHA, MFA,
  límites de intentos y SMTP propio.
- Protección de contraseñas filtradas (HaveIBeenPwned): solo en plan Pro.

## Versión celular y app instalable (24/09/2026)
- **Diseño adaptable** (pantallas de hasta 720 px): menú ☰ con panel lateral
  (links, modo oscuro, Salir), **barra de pestañas abajo** (Cartera, Resumen,
  Empezar y Admin para admins), y las tablas se convierten en **tarjetas**
  (clase `rtable` + `data-label` en cada celda). En la PC queda igual.
- **App instalable (PWA)**: `app/manifest.ts` (nombre, ícono, pantalla
  completa), íconos en `public/icons/` y `app/icon.png` / `app/apple-icon.png`,
  service worker mínimo `public/sw.js` que **no** guarda páginas ni datos en
  caché (solo una página "Sin conexión", `public/offline.html`).
- En la cartera, desde el celular, aparece un aviso para instalar: en Android
  con botón "Instalar"; en iPhone con la instrucción Compartir → "Agregar a
  inicio". Se puede descartar y no vuelve a aparecer en ese celular.
- Costo: US$ 0 (sin tiendas de apps).

## Panel de admin (24/09/2026)
- Arriba de todo: **resumen de clientes** (valor total en carteras, ganancia
  no realizada y del día, usuarios registrados, activos en los últimos 30 días,
  con cartera cargada, invertido, ganancia realizada) y una **tabla por
  cliente** (último ingreso, instrumentos, invertido, valor, ganancia $ y %,
  variación del día, ganancia realizada y cantidad de operaciones, aviso de
  términos pendientes). Sale de la función `admin_client_summary()` (solo
  admins; lee el último ingreso de `auth.users`).
- Abajo, tendencias en modo lectura.
- Se quitó la tabla de instrumentos y cotizaciones (y el ajuste manual de
  precios desde la pantalla; los precios siguen sincronizándose solos).

## Selector de cliente y "Mis inversiones hoy" (24/09/2026)
- Panel admin: selector "Ver" (o clic en una fila de la tabla) para ver los
  indicadores de un cliente puntual: valor, ganancia no realizada y del día,
  invertido, ganancia realizada, instrumentos, mejor posición, operaciones y
  su tabla de tenencias (`components/AdminClientsDashboard.tsx`).
- Cartera del cliente: la sección "Tendencias" tiene dos pestañas:
  **"En alza en el mercado"** (la lista general, igual para todos) y **"Mis
  inversiones hoy"** (cómo se movieron hoy los instrumentos que el usuario ya
  tiene, con el efecto en su cartera). Cada pestaña tiene su propio aviso,
  verdadero para lo que muestra. No se cruzan ambas listas ni se sugiere
  comprar o vender (`components/TrendsPanel.tsx`).

## Simulador y navegación más clara (25/09/2026)
- **Nueva sección `/simulador`** (`components/Simulator.tsx`), con dos pestañas:
  - **Simular una operación**: el usuario elige compra o venta, instrumento,
    cantidad y precio (por defecto la cotización actual). Muestra cómo quedaría
    la cartera: unidades y costo promedio del instrumento, valor total,
    invertido, ganancia no realizada, peso de cada instrumento antes y después
    y, en ventas, la ganancia o pérdida que realizaría (corto o largo plazo
    estimado). Valida que no venda más de lo que tiene. No guarda nada.
  - **Escenarios de mercado**: control de −50% a +50% (con atajos) aplicado a
    toda la cartera, y ajuste por instrumento. Muestra valor hoy vs. escenario
    y el resultado contra lo invertido.
  - Los campos arrancan vacíos (elige el usuario), los resultados se rotulan
    como hipotéticos y hay aviso de que no es recomendación.
- **Navegación**: la barra superior muestra "ReadySet Investment › *Sección
  actual*" (en el celular, el nombre de la sección grande debajo del nombre de
  la app), y el link de la sección actual queda resaltado. Las secciones están
  centralizadas en `lib/nav.ts`. Links cortos en la PC; debajo de 1060 px pasa
  al menú ☰. Barra inferior del celular: Cartera, Simular, Resumen, Empezar
  (+ Admin).

## Carteras de ejemplo (25/09/2026)
- "Cómo empezar" tiene ahora dos pestañas internas (`components/PageTabs.tsx`,
  con `?ver=carteras` en la dirección): **Abrir una cuenta** (la guía de
  siempre) y **Carteras de ejemplo** (`components/ExamplePortfolios.tsx`).
- Contenido educativo sobre cinco estrategias públicas de terceros: 60/40,
  tres fondos (Bogleheads), cartera permanente (Harry Browne), "todo clima"
  (versión de Tony Robbins de las ideas de Ray Dalio) y 90/10 de Buffett. De
  cada una: origen, idea, reparto por tipo de activo (barra), para qué se
  pensó y puntos débiles (incluida la caída de 2022 del 60/40).
- A propósito: sin tickers ni productos, sin rendimientos como gancho, sin
  "la mejor", sin comparar con la cartera del usuario y sin botón para cargarla
  en el simulador. Aviso destacado de que no son recomendaciones y fuentes al pie.

## Cartera de práctica (25/09/2026)
- Tercera pestaña de "Cómo empezar" (`?ver=practica`,
  `components/PracticePortfolios.tsx`). Cada usuario arma hasta 5 carteras
  con plata ficticia (por defecto US$ 1.000), eligiendo él los instrumentos
  (del catálogo o de "en alza hoy") y los porcentajes (máx. 10 por cartera,
  deben sumar 100%). Se "compran" al precio del momento.
- Se muestra: valor actual, ganancia desde el inicio y del día, mini gráfico,
  mejor y peor día, cierres registrados, tabla por instrumento y una
  comparación entre carteras. Se pueden eliminar.
- Base: tablas `practice_portfolios`, `practice_positions`, `practice_history`
  (valor diario) y `practice_quotes` (cotizaciones de símbolos que no están en
  el catálogo). Funciones `create_practice_portfolio` y
  `delete_practice_portfolio` (validan todo del lado del servidor).
- La Edge Function `sync-yahoo-prices` (v7) también actualiza
  `practice_quotes` cada 15 min y borra las que ya no usa ninguna cartera.
  Tarea diaria `practice-history-daily` (pg_cron, 21:30 UTC, lun-vie) guarda el
  valor de cierre de cada cartera.
- La app nunca elige instrumentos ni porcentajes: aviso de "ejercicio, no
  recomendación" y advertencia de volatilidad de las acciones en alza.

## Importador: export de Schwab (28/09/2026)
- "Importar cartera" acepta el **export de posiciones de Charles Schwab** tal
  cual se descarga (Accounts → Positions → Export), además de la plantilla
  propia. Detecta el formato solo; lee Symbol, Description, Qty, Price, Price
  Chng $, Cost Basis (total → costo promedio = Cost Basis / Qty), Mkt Val y
  Asset Type (Equity → acción, ETFs & Closed End Funds → ETF). Omite "Cash &
  Cash Investments" y "Positions Total"; muestra la fecha del archivo.
- Vista previa antes de cargar: tenencias, instrumentos nuevos, filas con
  error, costo total y valor de mercado del archivo.
- Los símbolos que no están en el catálogo **se agregan solos** (nombre, tipo
  y precio del archivo) y desde ahí se sincronizan con Yahoo.
- Opción **"Reemplazar la cartera completa"** (marcada por defecto con Schwab):
  lo que el cliente tenía y no está en el archivo queda en cero.
- El export no trae fechas de compra: se conserva la fecha anterior si el
  instrumento ya estaba; si no, queda sin fecha.
- Función `admin_bulk_load_portfolio(email, tenencias, p_replace)` (v2). La
  Edge Function `sync-yahoo-prices` (v8) ahora consulta de a 8 símbolos en
  paralelo, para soportar catálogos grandes.
- Probado con `test2.csv` (54 tenencias, 53 instrumentos nuevos, costo total
  US$ 31.661,64 y valor de mercado US$ 28.254,46 + efectivo US$ 5.099,85 =
  US$ 33.354,31, igual al total del archivo).

## Qué falta
- Revisión legal de /terminos y del encuadre con un abogado de mercado de
  valores — en especial la Cartera ReadySet: publicar una cartera modelo
  general puede considerarse recomendación de inversión ante el BCU.
- Configurar la seguridad del login en Supabase (ver arriba).
- Verificar un dominio propio en Resend (mails a clientes y confirmación de
  email a escala).
- Cambiar `CONTACT_EMAIL` por una casilla de la app.
- Los snapshots de valor de cartera de días anteriores no se recalculan al
  corregir una operación vieja (solo el de hoy).

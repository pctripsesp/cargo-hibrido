# ¿Cargo o gasolina? ⚡⛽

PWA muy sencilla para decidir en segundos, cuando estás fuera de casa, si compensa cargar tu **híbrido enchufable** en un cargador público o tirar de gasolina.

## Cómo funciona

- **Ajustes (⚙)** – se configuran una vez:
  - Consumo medio de gasolina (L/100 km)
  - Consumo medio eléctrico (kWh/100 km)
  - Precio de tu gasolinera de referencia (€/L)
  - Pérdidas de carga (%; 10 % por defecto)
  - Máximo del dial (€/kWh; 1,00 por defecto)
- **Pantalla principal** – un dial circular a pantalla completa, como un reloj:
  - El arco es **verde** desde 0 hasta el precio umbral y **rojo** a partir de ahí; un marcador blanco señala el umbral exacto.
  - Arrastra el mando con el dedo hasta el precio del cargador (pasos de 0,01 €/kWh).
  - En el centro aparece el precio, el veredicto (**CARGA** / **GASOLINA**) y cuánto ahorras o pierdes cada 100 km.
  - Toca el centro para escribir el precio exacto a mano.
  - Vibra al cruzar el umbral y recuerda el último precio usado.

## Cálculo

```
coste gasolina /100 km  = L/100km × €/L
coste eléctrico /100 km = kWh/100km × €/kWh ÷ (1 − pérdidas)
precio umbral (€/kWh)   = L/100km × €/L × (1 − pérdidas) ÷ kWh/100km
```

Ejemplo: 6 L/100 km × 1,60 €/L, 18 kWh/100 km y 10 % de pérdidas → compensa cargar hasta **0,48 €/kWh**.

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Vistas: dial principal, ajustes y diálogo de precio manual |
| `styles.css` | Estilos (modo oscuro, dial adaptado al tamaño de pantalla) |
| `app.js` | Cálculos, dial SVG interactivo y ajustes en `localStorage` |
| `sw.js` | Service worker: red primero y caché sin cobertura (funciona offline) |
| `manifest.webmanifest`, `icon*.{svg,png}` | Instalación como app |

HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Probarla

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Para instalarla en el móvil hay que servirla por **HTTPS** (GitHub Pages, Netlify, Gitea Pages, etc.); después, en el navegador: *Añadir a pantalla de inicio* (Chrome en Android, Safari en iOS).

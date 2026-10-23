# Laboratorio de Evolución Diferencial · Sesión 36 · versión 3

Abrir **laboratorio_evolucion_diferencial.html** en un navegador. El archivo trae la página, el algoritmo y los datos; funciona sin instalación,
sin servidor y sin conexión. Publicado en https://lara-montano.github.io/laboratorio-evolucion-diferencial/ (el QR de la hoja y de la lámina 21).

**Para explorar en casa: material opcional, sin entrega ni evaluación.** El ejercicio a mano de la clase se conserva; el laboratorio sirve para repasarlo.

## Qué tiene (una sola página)

1. **El problema.** El cerro con cuatro mínimos locales, f(x₁, x₂) = g(x₁) + g(x₂) con g(t) = t⁴ − 4t² + t en [−2.2, 2.2]², o el caso solar (comunidad sin red): los 1271 diseños de la clase (paneles cada 0.5 kW, batería cada 2 kWh; el más barato, 10 kW y 28 kWh, 3285.6 USD/año).
2. **Los parámetros.** NP, F y CR, las generaciones y la semilla. Por omisión, el cerro como la animación de la clase (NP = 6, 8 generaciones) y el caso solar como su corrida (NP = 10, 20 generaciones).
3. **La corrida.** «Una generación», «Animar» y «Reiniciar». El mapa muestra los exploradores, el mejor y el mínimo global; después de cada generación dibuja el paso del explorador 1 (los tres sorteados, la flecha d, F d y el mutante v) y lo explica con las tres reglas de la clase: mutación, cruza y selección. Debajo, el mejor f en cada generación.
4. **Repetir con 30 semillas.** Cuenta en cuántas el mejor termina en la región de atracción del mínimo global (el cerro) o en el diseño más barato (el caso solar), con los mismos parámetros.
5. **Preguntas para pensar.** F = 0 y F = 2; CR = 0 y la j_rand; el tamaño de la población y su costo en evaluaciones; las simulaciones de una corrida frente a las 1271 de la malla.

## Qué se quitó de la versión 2 (23-oct-2026, pedido del autor: «mejora el laboratorio virtual, no lo sobre compliques»)

Las pestañas, la comparación A/B con cuartiles y victorias, las cuatro funciones de referencia (esfera, Rosenbrock, Rastrigin, Ackley), el registro de
predicciones con almacenamiento local, las exportaciones a CSV y texto, la diversidad y el modo de presupuesto por evaluaciones. La versión 2 completa
quedó en `_v2_23oct2026/` (página, estilo, aplicación y sus pruebas de interfaz) y en `version_v2_23oct2026.html`.

## Convenciones

**DE/rand/1/bin** (Storn y Price, 1997) con actualización por generación, tres sorteados distintos entre sí y del explorador, recorte del mutante al
dominio antes de la cruza, una coordenada obligatoria (j_rand) y aceptación con costo menor o igual. El motor es `src/engine.js`, el mismo de la versión 2.
En el caso solar las posiciones son continuas y se redondean a la malla al evaluar. Las semillas reproducen las corridas de este laboratorio, no las de la
clase: el generador de números aleatorios es otro. La frontera de las regiones de atracción del cerro es el máximo local de g, cerca de 0.126.

## Construir y probar

    node build.cjs                  # arma laboratorio_evolucion_diferencial.html y dist/index.html desde src/
    node --test tests/*.test.cjs    # pruebas del motor y del núcleo de la página

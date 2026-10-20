# Laboratorio de Evolución Diferencial · Sesión 36 · versión 2

Abre **laboratorio_evolucion_diferencial.html** con un navegador. El archivo incluye la aplicación, el algoritmo y los datos; funciona sin instalación, servidor ni conexión. Puedes compartir únicamente ese HTML con los estudiantes.

La aplicación se creó en una carpeta nueva. El PDF original y las presentaciones revisadas se conservan. Si ya la tenías abierta, recarga la página: el encabezado debe mostrar **v2**. La entrega anterior se conserva en `version_anterior_20oct2026.html`.

## Qué pueden hacer los estudiantes

- **Explorar:** ajustar NP, F y CR; elegir la semilla y el criterio de paro; avanzar una generación, animar la corrida o completarla. El mapa muestra la población, y la curva muestra la mejor solución frente al número de evaluaciones. La brecha absoluta es `f − f*`, válida incluso cuando el óptimo es cero. El panel desplegable explica una mutación, una cruza y una selección de la última generación.
- **Comparar:** ejecutar dos configuraciones con el mismo límite de evaluaciones y la misma lista de semillas. Hay experimentos preparados para F, CR y NP; todos sus valores se pueden cambiar. La tabla resume mediana, cuartiles, extremos, éxito, diversidad y esfuerzo de búsqueda.
- **Registrar:** escribir una predicción, evidencia y conclusión; descargar el registro en texto y los resultados de la comparación en CSV.

Las respuestas se guardan solo en el navegador cuando este permite almacenamiento local. El botón de descarga permite conservarlas si ese almacenamiento no está disponible. Las notas se separan por caso. Si el visor impide descargar, el panel de exportación muestra el texto completo para seleccionarlo y copiarlo. Las notas de la versión anterior se conservan aparte porque esa versión no guardaba a qué caso pertenecían.

## Actividad para sustituir el ejercicio final — 8 a 10 minutos

1. **Predecir (1 min).** En parejas, elegir un parámetro y escribir qué esperan que ocurra. Conservar los demás parámetros.
2. **Observar (3 min).** Ejecutar una comparación y mirar las curvas. Repetir con otra semilla: una sola corrida puede ser afortunada.
3. **Repetir (2 min).** Ejecutar las 30 semillas, con límite de 240 evaluaciones por corrida. Comparar mediana, dispersión y proporción de éxito.
4. **Explicar (2–4 min).** Citar dos cifras y una limitación. Si cambiaron NP, explicar por qué cambia el número de generaciones. Si hay tiempo, repetir con 840 evaluaciones: ¿se conserva la ventaja?

Preguntas para la discusión: ¿F más grande siempre ayuda? ¿Qué hace CR = 0 cuando existe una coordenada obligatoria? ¿Una población más grande compensa sus menos generaciones? ¿Qué cambia cuando el presupuesto permite que ambas configuraciones alcancen la referencia?

**No hay una configuración universalmente ganadora.** Un empate también es un resultado. El presupuesto inicial corto ayuda a observar diferencias en la velocidad de convergencia; el presupuesto amplio permite estudiar si esas diferencias persisten.

## Funciones objetivo disponibles

| Caso | Dominio usado | Mínimo de referencia | Qué observar |
|---|---|---|---|
| Sistema solar | P de 0 a 20 kW; E de 0 a 60 kWh, por módulos | 3285.6 en (10,28) | Redondeo, mesetas y decisiones discretas |
| Terreno | [−2.2,2.2]² | −10.888384… cerca de (−1.473,−1.473) | Cuatro mínimos locales |
| Esfera | [−5,5]² | 0 en (0,0) | Convergencia sobre una superficie sencilla |
| Rosenbrock | x₁ en [−2,2]; x₂ en [−1,3] | 0 en (1,1) | Variables acopladas y valle estrecho |
| Rastrigin | [−5.12,5.12]² | 0 en (0,0) | Muchos mínimos locales |
| Ackley | [−5,5]² | 0 en (0,0) | Un pozo central rodeado de ondulaciones |

Cada caso muestra su fórmula, dominio y orientación didáctica. Las cuatro funciones añadidas usan una tolerancia de éxito de `0.0001`. Los dominios se eligieron para visualizar el problema en dos dimensiones; algunos son más pequeños que los habituales.

Referencias: biblioteca de Surjanovic y Bingham, Simon Fraser University: [Esfera](https://www.sfu.ca/~ssurjano/spheref.html), [Rosenbrock](https://www.sfu.ca/~ssurjano/rosen.html), [Rastrigin](https://www.sfu.ca/~ssurjano/rastr.html) y [Ackley](https://www.sfu.ca/~ssurjano/ackley.html). Las implementaciones del laboratorio están escritas para esta aplicación.

Para una segunda actividad, conserva A, B y el presupuesto y cambia de Esfera a Rastrigin. Compara qué configuración conserva su ventaja. La magnitud de la brecha tiene las unidades de cada objetivo: no debe compararse directamente entre funciones diferentes.

## Convenciones

**Sistema solar con batería.** Usa los datos sintéticos de la sesión: 41 tamaños de paneles por 31 tamaños de batería, 1271 diseños. Cada propuesta consulta una tabla de costos, almacenados a décimas de dólar. Su referencia es 10 kW de paneles y 28 kWh de batería, con costo anual de 3285.6 dólares. El modelo penaliza energía no suministrada; no exige abastecer toda la demanda.

**Terreno con cuatro mínimos.** Usa `f(x₁,x₂) = g(x₁) + g(x₂)`, donde `g(t) = t⁴ − 4t² + t`, en `[-2.2, 2.2]²`. La referencia global está cerca de `(-1.473, -1.473)`, con valor `-10.888384`. Se considera éxito una brecha absoluta de hasta `0.01`.

Se implementa **DE/rand/1/bin** con actualización generacional, tres donantes distintos que excluyen al objetivo, recorte del mutante antes de la cruza, una coordenada obligatoria y aceptación de costo menor o igual. En el caso solar, las posiciones se mantienen continuas y se redondean a módulos al evaluar; los empates exactos se resuelven al índice par, como `np.rint` en el modelo de Python.

Las evaluaciones incluyen la población inicial y todas las propuestas, aunque repitan un diseño. El presupuesto termina al cerrar generaciones completas; si queda un remanente, la aplicación lo indica. La diversidad es la dispersión de las coordenadas normalizadas, no una medida de calidad.

Las semillas reproducen los resultados dentro de esta aplicación. El generador aleatorio difiere del usado por el experimento original en Python: el mismo número de semilla no reproduce aquella trayectoria.

La cuenta de victorias usa empates prácticos: una diferencia de valor final menor o igual a la tolerancia de éxito del caso se considera empate. Los valores y las brechas completos se conservan en el CSV.

Q1–Q3 describe el 50% central de las corridas; no es un intervalo de confianza. La gráfica de convergencia comparativa muestra únicamente la primera semilla, y la segunda gráfica muestra los resultados finales de todas las semillas.

## Archivos

- `laboratorio_evolucion_diferencial.html`: entrega para usar y compartir.
- `vista_previa.png`: captura histórica de la primera versión, no de la revisión 2.
- `REVISION_Y_MEJORAS.md`: errores corregidos, mejoras aplicadas y alcance de las verificaciones.
- `src/`: fuentes editables y copia de los datos utilizados.
- `build.cjs`: genera el HTML autónomo y la copia de previsualización en `dist/`.
- `tests/engine.test.cjs`: pruebas del algoritmo, presupuestos y funciones objetivo.
- `tests/ui.test.cjs`: pruebas de estados, eventos, notas, exportaciones y operaciones de dibujo simuladas.

Para regenerar el HTML con Node.js: `node build.cjs`. Para verificar el motor: `node --test tests/*.test.cjs`.

# Revisión 2: correcciones y mejoras

Se revisaron el motor matemático, los estados de la interfaz, el almacenamiento de notas y las exportaciones. La entrega actual es `laboratorio_evolucion_diferencial.html`; la entrega anterior se conserva en `version_anterior_20oct2026.html`. El PDF original no se modificó.

## Errores detectados y corregidos

| Problema reproducible | Corrección aplicada |
|---|---|
| NP = 60 y presupuesto = 60: el botón anunciaba una animación aunque solo había población inicial. | No se habilita el avance cuando no cabe ninguna generación; se explica cómo aumentar el presupuesto. |
| Completar una corrida y reiniciarla conservaba «Volver a correr» en vez de «Iniciar». | Los botones se actualizan a partir del estado de la nueva corrida; una pausa se identifica como «Continuar». |
| Cambiar de Solar a Terreno conservaba las notas solares y las descargaba como si fueran del terreno. | Notas separadas por caso, persistencia por caso y exportaciones con el nombre correcto. Las notas antiguas sin procedencia se conservan aparte. |
| «Usar esta configuración como A» copiaba parámetros y semilla pero conservaba un presupuesto distinto. | Se copia también el número efectivo de evaluaciones de la corrida. |
| Los valores mostrados a pocos decimales parecían iguales mientras se contaban victorias por diferencias diminutas. | Mayor precisión, notación científica para brechas pequeñas y empates prácticos explícitos, según la tolerancia del caso. |
| La cuantización solar resolvía los empates de forma distinta a Python. | Empate exacto al índice par, consistente con `np.rint`. Los generadores aleatorios siguen siendo diferentes, como se explica en la aplicación. |
| Las pruebas del motor dependían de datos externos a la carpeta entregada. | Las pruebas leen la copia de datos incluida y pueden ejecutarse al mover el laboratorio. |
| Una matriz de energía no servida incompleta podía devolver valores indefinidos. | Validación de dimensiones y valores finitos antes de crear el problema. |

## Mejoras aplicadas

- **Cuatro funciones adicionales:** Esfera, Rosenbrock, Rastrigin y Ackley, además de Solar y Terreno. Se muestran fórmula, dominio, mínimo conocido y una pregunta didáctica.
- **Brecha absoluta:** `f − f*`, en las unidades de la función. Se evita dividir entre un óptimo igual a cero o asignar un porcentaje arbitrario.
- **Contexto visible:** la función objetivo permanece visible; los resultados indican los parámetros A y B, semillas y presupuesto.
- **Comparación controlada:** se indica qué parámetros difieren y se advierte cuando cambia más de uno. Un presupuesto inferior a NP bloquea la comparación.
- **Presupuestos accesibles:** botones para 240 y 840 evaluaciones; los límites pueden ajustarse con precisión.
- **Curvas más fieles:** avance escalonado por cierres de generación; B usa línea discontinua y cuadrados para distinguirla además del color.
- **Exportación alternativa:** el CSV y el registro también aparecen en un área de texto seleccionable si el visor no permite descargar.
- **Protección de la entrega:** la generación del HTML comprueba sintaxis, datos incluidos y ausencia de recursos externos necesarios antes de actualizar el archivo.

## Verificación

**36 pruebas automáticas pasan:** 21 del motor y las funciones objetivo, y 15 de interacción y dibujo simulado.

Se comprobaron mínimos, valores conocidos, límites, presupuestos, reproducibilidad, selección, cruza, redondeo, notas por caso, exportaciones y recuperación de entradas inválidas. Las pruebas de funciones recorren 2601 puntos por función. Los ensayos de dibujo ejecutan los seis casos en superficies de 600 × 300 y 320 × 240, comprueban números finitos y verifican que la brecha no esté etiquetada como porcentaje.

Estas pruebas de dibujo no sustituyen una inspección visual. La herramienta de navegador no permitió inspeccionar automáticamente la pestaña local con protocolo `file:`; no se afirma haber comprobado visualmente esta revisión en ese visor. El HTML se valida como archivo autónomo y no requiere servicios externos.

## Posibles ampliaciones

- Seleccionar cualquier individuo para inspeccionar sus donantes, cruza y selección; hoy se explica el primero de la última generación.
- Exportar la trayectoria de todas las semillas, además de los resultados finales que ya se exportan.
- Incorporar una vista tridimensional opcional para contrastar con el mapa de calor. Para la comparación cuantitativa, el mapa y las curvas siguen siendo la vista principal.

Son ampliaciones opcionales, no requisitos para ejecutar los seis casos actuales.

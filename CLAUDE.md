# Lalan front: reglas del negocio

## Multi todo: salón, sede, moneda e inventario

Lalan es multi-tenant, multisede, multimoneda y lleva el inventario por sede.
Todo cambio tiene que respetarlo:

- **Pantallas con datos de una sede** (caja, canales, inventario): usan
  `SelectorSede` y `useSedes()`. El selector se oculta con una sola sede y
  cuando el usuario está atado a una.
- **Reportes:** `SelectorSede` con `todas` y `&sede=` en la petición.
- **Lo que pasa dentro de un local** (Lounge, música, bienvenida a quien
  llega, mostrador) usa la sede del local, `services/sedeLocal.ts`. Las rutas
  del Lounge van con `conSedeLocal(ruta)`. El socket manda esa sede al conectar.
- **Pasos de la bienvenida** que cargan inventario o personal preguntan la
  sede cuando hay varias.
- Nunca supongas que hay una sola sede.

## UX primero: conecta, muestra y enlaza

La dueña hace el menor esfuerzo posible. En toda función nueva:

- **Si una cosa conecta con otra, conéctala.** Un aviso sobre una clienta
  abre su ficha; un aviso sobre un producto deja decir qué producto es ahí
  mismo.
- **Si una función genera información importante, muéstrala donde se decide.**
  Di el dato concreto ("piel sensible"), no "tiene alergias anotadas".
- **Si un flujo lleva a algún lado, pon el botón.** Nunca dejes a la dueña
  buscando a mano lo que el aviso ya sabe.

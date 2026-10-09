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

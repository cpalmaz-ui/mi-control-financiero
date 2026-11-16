# Mi Control Financiero

Aplicación web instalable. El repositorio y GitHub Pages son públicos. Los respaldos, estados de cuenta e importes personales deben permanecer fuera del repositorio y de su historial.

## Modo dispositivo y modo cuenta

La aplicación conserva la clave local anterior y admite respaldos JSON existentes. En modo cuenta, el navegador mantiene los cambios de esa sesión en memoria. Usa **Guardar en mi cuenta** para sincronizarlos. Cerrar sesión devuelve la vista a los datos del dispositivo.

Si la cuenta todavía no tiene respaldo, **Importar datos de este dispositivo** copia los datos a la sesión. La copia se envía a Firestore al pulsar **Guardar en mi cuenta**. Para abrirla desde otro equipo, inicia sesión con la misma cuenta y selecciona **Abrir datos de mi cuenta**. La sincronización es manual. Un respaldo más nuevo en otro equipo bloquea la sobrescritura y permite exportar los cambios pendientes antes de recargar.

## Activación pendiente de aprobación

1. Registrar la app web en el proyecto `mi-control-financiero-e72c3` y completar `firebaseConfig` en `cloud-sync.js`.
2. Habilitar el proveedor Google en Firebase Authentication y autorizar `cpalmaz-ui.github.io` para iniciar sesión desde GitHub Pages.
3. Probar con datos ficticios y dos UID diferentes. Verificar lectura, creación y actualización propias y denegación de acceso cruzado, acceso anónimo, listado y borrado.
4. Publicar las reglas aprobadas en Firestore `(default)`. El único documento habilitado por cuenta es `users/{uid}/records/app-state`. El cliente limita el respaldo a 900 kB y rechaza sobrescrituras concurrentes con un número de revisión.
5. Publicar la revisión aprobada en GitHub Pages desde `main`.

Quedan fuera de esta activación la facturación Blaze y los servicios de pago.

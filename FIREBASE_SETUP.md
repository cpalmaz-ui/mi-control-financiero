# Configuración segura de Firebase — Mi Control Financiero

**Estado:** plantilla de configuración, **NO** hay Firebase conectado ni sincronización activada.

## Antes de activar
1. Crear proyecto propio en https://console.firebase.google.com/ con cuenta controlada por la propietaria.
2. Registrar aplicación web y obtener `firebaseConfig` del proyecto. No introducir claves de servicio privadas en GitHub.
3. Authentication → Sign-in method → activar Google. Configurar dominios autorizados, incluido `cpalmaz-ui.github.io`. Restringir inicialmente a usuarios de prueba si se desea.
4. Crear Cloud Firestore en modo producción, nunca en modo prueba abierto. Publicar `firestore.rules` en Firebase y probar con Rules Playground / Emulator: usuario A no puede leer/escribir `users/B`, usuario no autenticado no puede acceder, historial `audit` no puede modificarse ni borrarse.
5. Conectar frontend solo después de probar las reglas. Los registros se guardarán en `users/{uid}/records/{id}` y los eventos inmutables en `users/{uid}/audit/{eventId}`. Las reglas son una defensa inicial: deben reforzarse con validación por tipo de registro, límites de tamaño, App Check, manejo de errores y pruebas.
6. Antes de migrar: exportar JSON desde el navegador actual, guardar copia fuera de GitHub y validar que el importador preserve cuotas y pagos. Importar solo tras iniciar sesión, con vista previa y confirmación. Evitar sobreescritura accidental de datos en nube.
7. No guardar documentos, números completos de tarjetas, contraseñas ni identificaciones sensibles en registros de prueba.
8. Para respaldo real independiente de sincronización, diseñar exportación privada periódica por usuario. Firestore no equivale por sí solo a un backup recuperable de cambios o borrados.

## Privacidad
El repositorio GitHub Pages es público. Los datos de cada persona deben permanecer en Firestore protegidos por UID y reglas, nunca en archivos del repositorio. El acceso del administrador del proyecto Firebase es privilegiado: las reglas de cliente no impiden acceso administrativo. Para privacidad incluso frente a administradores, evaluar cifrado de extremo a extremo con gestión de claves y recuperación.

## Estado actual
La app sigue usando localStorage. Este documento y las reglas NO habilitan el acceso multiusuario por sí solos.

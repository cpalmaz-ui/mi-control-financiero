const firebaseConfig = {
  "apiKey": "AIzaSyCogTgyYBGD7O9sHGV7o0j3OLMs21OApvQ",
  "authDomain": "mi-control-financiero-e72c3.firebaseapp.com",
  "projectId": "mi-control-financiero-e72c3",
  "appId": "1:533562307996:web:427b52b3816ca8540d4459"
};
const projectId = 'mi-control-financiero-e72c3';
const maxBackupBytes = 900000;
const status = document.getElementById('cloud-status');
const title = document.getElementById('cloud-title');
const dashboard = document.getElementById('finance-workspace');
const buttons = Object.fromEntries(
  ['login', 'open', 'import', 'save', 'refresh', 'logout'].map(name =>
    [name, document.getElementById('cloud-' + name)])
);

function writeStatus(message) {
  status.textContent = message;
}

async function start() {
  if (firebaseConfig.projectId !== projectId) {
    writeStatus('Modo dispositivo. La configuración apunta a otro proyecto.');
    return;
  }

  const sdk = 'https://www.gstatic.com/firebasejs/12.13.0/';
  const [application, authentication, firestore] = await Promise.all([
    import(sdk + 'firebase-app.js'),
    import(sdk + 'firebase-auth.js'),
    import(sdk + 'firebase-firestore-lite.js')
  ]);
  const app = application.initializeApp(firebaseConfig);
  const auth = authentication.initializeAuth(app, {
    persistence: [authentication.browserSessionPersistence, authentication.inMemoryPersistence],
    popupRedirectResolver: authentication.browserPopupRedirectResolver
  });
  const database = firestore.getFirestore(app);

  let account = null;
  let workspace = null;
  let busy = false;

  function controls() {
    dashboard.hidden = !workspace;
    title.textContent = account ? 'Mi cuenta' : 'Inicia sesión para continuar';
    buttons.login.hidden = Boolean(account);
    buttons.open.hidden = !account || Boolean(workspace);
    buttons.import.hidden = !workspace || workspace.revision !== 0 || workspace.dirty;
    buttons.save.hidden = !workspace;
    buttons.refresh.hidden = !workspace;
    buttons.logout.hidden = !account;
    for (const button of Object.values(buttons)) button.disabled = busy;
    buttons.save.disabled = busy || !workspace?.dirty;
  }

  function accountStatus(message) {
    writeStatus(account ? (account.email ?? 'Cuenta de Google') + ' · ' + message : message);
  }

  function requireAccount(current) {
    if (!current || current !== account || auth.currentUser?.uid !== current.uid) {
      throw new Error('La sesión cambió. Vuelve a abrir tu cuenta.');
    }
  }

  async function perform(action) {
    if (busy) return;
    busy = true;
    controls();
    try {
      await action();
    } catch (error) {
      const messages = {
        'permission-denied': 'Firestore denegó el acceso. Revisa las reglas vigentes.',
        'auth/unauthorized-domain': 'Este dominio aún no está autorizado en Firebase.',
        'auth/operation-not-allowed': 'El inicio de sesión con Google aún no está habilitado.',
        'auth/popup-blocked': 'Permite las ventanas emergentes para iniciar sesión.',
        'auth/popup-closed-by-user': 'Se cerró la ventana de inicio de sesión.'
      };
      const custom = error instanceof Error && !error.code;
      accountStatus(messages[error.code] ?? (custom ? error.message : 'Operación incompleta. Revisa la conexión e inténtalo de nuevo.'));
    } finally {
      busy = false;
      controls();
    }
  }

  function backupRef(current) {
    return firestore.doc(database, 'users', current.uid, 'records', 'app-state');
  }

  function decode(snapshot) {
    if (!snapshot.exists()) return { revision: 0, data: {} };
    const record = snapshot.data();
    if (record.schemaVersion !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1) {
      throw new Error('El respaldo guardado usa una versión incompatible.');
    }
    const data = JSON.parse(record.payload);
    if (!Array.isArray(data?.plans) || !isMap(data.payments)) throw new Error('El respaldo guardado está incompleto.');
    return { revision: record.revision, data };
  }

  function draftKey(user) {
    return 'mi-control-financiero:pendiente:' + projectId + ':' + user.uid;
  }

  function readDraft(user) {
    let saved;
    try { saved = sessionStorage.getItem(draftKey(user)); } catch { return null; }
    if (!saved) return null;
    const draft = JSON.parse(saved);
    if (!Number.isSafeInteger(draft.revision) || draft.revision < 0 || typeof draft.payload !== 'string') {
      throw new Error('El borrador de esta pestaña tiene un formato incompatible.');
    }
    return draft;
  }

  function storeDraft(user, revision, payload) {
    try {
      sessionStorage.setItem(draftKey(user), JSON.stringify({ revision, payload }));
      return true;
    } catch {
      return false;
    }
  }

  function clearDraft(user) {
    try { sessionStorage.removeItem(draftKey(user)); } catch { /* Storage is unavailable. */ }
  }

  function editNotice() {
    workspace.dirty = true;
    workspace.generation++;
    const recoverable = storeDraft(account, workspace.revision, JSON.stringify(state));
    accountStatus(recoverable
      ? 'Cambios pendientes. Puedes recuperarlos si recargas esta pestaña.'
      : 'Cambios pendientes. Guarda en tu cuenta o exporta antes de salir.');
    controls();
  }

  async function openWorkspace({ discardDraft = false } = {}) {
    const current = account;
    const initialWorkspace = workspace;
    const initialGeneration = workspace?.generation;
    requireAccount(current);
    const snapshot = await firestore.getDoc(backupRef(current));
    requireAccount(current);
    if (workspace !== initialWorkspace || workspace?.generation !== initialGeneration) {
      throw new Error('Editaste mientras se cargaba el respaldo. Tus cambios siguen abiertos.');
    }
    const { revision, data } = decode(snapshot);
    const draft = discardDraft ? null : readDraft(current);
    const alreadySaved = draft && revision > draft.revision && draft.payload === snapshot.data()?.payload;
    const pending = draft && !alreadySaved;
    const next = {
      revision: pending ? draft.revision : revision,
      dirty: Boolean(pending), generation: 0, changed: editNotice
    };
    switchWorkspace(next, pending ? JSON.parse(draft.payload) : data);
    workspace = next;
    if (discardDraft || alreadySaved) clearDraft(current);
    if (pending) {
      accountStatus(draft.revision === revision
        ? 'Cambios pendientes recuperados de esta pestaña.'
        : 'Cambios pendientes recuperados. Existe una versión distinta en tu cuenta. Exporta los cambios para conservarlos antes de recargar.');
    } else {
      accountStatus(revision ? 'Respaldo de la cuenta abierto.' : 'Cuenta sin respaldo. Puedes comenzar o importar los datos de este dispositivo.');
    }
  }

  function setAccount(user) {
    if (account?.uid === user?.uid) return;
    if (workspace) {
      dashboard.hidden = true;
      switchWorkspace(null);
      workspace = null;
    }
    account = user;
    accountStatus(user ? 'Sesión iniciada. Abriendo tus datos…' : 'Entra con Google para abrir tu espacio privado.');
    controls();
  }

  buttons.login.onclick = () => perform(async () => {
    const { user } = await authentication.signInWithPopup(auth, new authentication.GoogleAuthProvider());
    setAccount(user);
    await openWorkspace();
  });
  buttons.open.onclick = () => perform(openWorkspace);
  buttons.import.onclick = () => perform(() => {
    requireAccount(account);
    if (!workspace || workspace.revision || workspace.dirty) return;
    if (!confirm('¿Copiar los datos de este dispositivo a la sesión de ' + account.email + '? Se subirán cuando pulses Guardar en mi cuenta.')) return;
    switchWorkspace(workspace, JSON.parse(JSON.stringify(localState)));
    editNotice();
  });
  buttons.save.onclick = () => perform(async () => {
    const current = account;
    const working = workspace;
    requireAccount(current);
    if (!working?.dirty) return;
    const generation = working.generation;
    const payload = JSON.stringify(state);
    if (new TextEncoder().encode(payload).byteLength > maxBackupBytes) {
      throw new Error('El respaldo excede 900 kB. Exporta una copia JSON para conservar tus cambios.');
    }
    const expected = working.revision;
    const reference = backupRef(current);
    await firestore.runTransaction(database, async transaction => {
      const latest = await transaction.get(reference);
      requireAccount(current);
      const actual = latest.exists() ? latest.data().revision : 0;
      if (actual === expected + 1 && latest.data().payload === payload) return;
      if (actual !== expected) {
        throw new Error('Otro dispositivo guardó una versión más reciente. Exporta tus cambios antes de recargar.');
      }
      transaction.set(reference, {
        payload,
        revision: expected + 1,
        schemaVersion: 1,
        updatedAt: firestore.serverTimestamp()
      });
    });
    requireAccount(current);
    working.revision = expected + 1;
    working.dirty = working.generation !== generation;
    if (working.dirty) {
      editNotice();
    } else {
      clearDraft(current);
      accountStatus('Respaldo guardado en tu cuenta.');
    }
  });
  buttons.refresh.onclick = () => perform(async () => {
    const discardDraft = Boolean(workspace?.dirty);
    if (discardDraft && !confirm('¿Descartar los cambios pendientes y abrir el respaldo de la cuenta? Puedes cancelar y exportar una copia JSON primero.')) return;
    await openWorkspace({ discardDraft });
  });
  buttons.logout.onclick = () => perform(async () => {
    const current = account;
    const discardDraft = Boolean(workspace?.dirty);
    if (discardDraft && !confirm('¿Cerrar sesión y descartar los cambios pendientes? Puedes cancelar y exportar una copia JSON primero.')) return;
    await authentication.signOut(auth);
    if (discardDraft) clearDraft(current);
  });

  authentication.onAuthStateChanged(auth, user => {
    if (account?.uid === user?.uid) {
      if (!user) accountStatus('Entra con Google para abrir tu espacio privado.');
      controls();
      return;
    }
    setAccount(user);
    if (user && !busy) void perform(openWorkspace);
  });
  window.addEventListener('beforeunload', event => {
    if (!workspace?.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

start().catch(() => writeStatus('No se pudo conectar para iniciar sesión. Revisa tu conexión y recarga la página.'));

/* ============================================================
   Sincronização com Firebase — login Google + Firestore
   ------------------------------------------------------------
   Estratégia: local primeiro.
     · Sem configuração ou sem internet, o site funciona igual,
       guardando tudo no navegador.
     · Ao entrar com o Google, o progresso local é mesclado com o
       da nuvem (vence o bloco alterado mais recentemente) e passa
       a sincronizar entre dispositivos.

   Carregado como módulo. Se o SDK não puder ser buscado (offline,
   arquivo aberto direto do disco), o site apenas segue local.
   ============================================================ */

const VERSAO_SDK = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${VERSAO_SDK}`;

const Sync = {
  ativo: false,
  usuario: null,
  _db: null,
  _auth: null,
  _doc: null,
  _pendente: null,
  _aplicandoRemoto: false,
};
window.Sync = Sync;

/* ---------- interface visual ---------- */
function sinal(estado, texto) {
  const s = document.getElementById('sync-sinal');
  if (!s) return;
  s.dataset.estado = estado;
  s.textContent = texto;
  s.hidden = false;
}

function pintarConta() {
  const box = document.getElementById('conta');
  const btnEntrar = document.getElementById('btn-entrar');
  if (!box || !btnEntrar) return;

  while (box.firstChild) box.removeChild(box.firstChild);

  if (Sync.usuario) {
    btnEntrar.hidden = true;
    if (Sync.usuario.photoURL) {
      const img = document.createElement('img');
      img.className = 'conta-foto';
      img.src = Sync.usuario.photoURL;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      box.appendChild(img);
    }
    const nome = document.createElement('span');
    nome.className = 'conta-nome';
    nome.textContent = Sync.usuario.displayName || Sync.usuario.email || 'conectado';
    box.appendChild(nome);

    const sair = document.createElement('button');
    sair.className = 'btn btn--sutil';
    sair.type = 'button';
    sair.textContent = 'Sair';
    sair.addEventListener('click', () => Sync.sair());
    box.appendChild(sair);
    box.hidden = false;
  } else {
    box.hidden = true;
    btnEntrar.hidden = !Sync.ativo;
  }
}

/* ---------- inicialização ---------- */
Sync.iniciar = async function () {
  const cfg = window.FIREBASE_CONFIG || {};
  if (!cfg.apiKey || !cfg.projectId) {
    sinal('local', 'Só neste dispositivo');
    pintarConta();
    return;
  }

  try {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`${BASE}/firebase-app.js`),
      import(`${BASE}/firebase-auth.js`),
      import(`${BASE}/firebase-firestore.js`),
    ]);

    const app = initializeApp(cfg);
    Sync._auth = auth.getAuth(app);
    Sync._db = fs.getFirestore(app);
    Sync._fs = fs;
    Sync._authMod = auth;
    Sync.ativo = true;

    await auth.setPersistence(Sync._auth, auth.browserLocalPersistence);

    auth.onAuthStateChanged(Sync._auth, async (u) => {
      Sync.usuario = u;
      pintarConta();
      if (u) {
        sinal('enviando', 'Sincronizando…');
        await conectarDocumento(u.uid);
      } else {
        if (Sync._parar) { Sync._parar(); Sync._parar = null; }
        Sync._doc = null;
        sinal('local', 'Só neste dispositivo');
      }
    });

    /* Login por redirecionamento pode voltar aqui */
    try { await auth.getRedirectResult(Sync._auth); } catch (e) { /* sem pendência */ }

    pintarConta();
  } catch (e) {
    console.warn('Firebase indisponível, seguindo em modo local:', e);
    sinal('local', 'Só neste dispositivo');
    pintarConta();
  }
};

Sync.entrar = async function () {
  if (!Sync.ativo) return;
  const auth = Sync._authMod;
  const provedor = new auth.GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await auth.signInWithPopup(Sync._auth, provedor);
  } catch (e) {
    /* bloqueio de pop-up é comum no celular: cai para redirecionamento */
    if (e && /popup/i.test(e.code || '')) {
      await auth.signInWithRedirect(Sync._auth, provedor);
    } else {
      console.warn('Falha no login:', e);
      if (window.Roadmaps) Roadmaps.brinde('Não consegui entrar');
    }
  }
};

Sync.sair = async function () {
  if (!Sync.ativo) return;
  try { await Sync._authMod.signOut(Sync._auth); } catch (e) { /* ignora */ }
  if (window.Roadmaps) Roadmaps.brinde('Sessão encerrada — dados seguem neste dispositivo');
};

/* ---------- documento do usuário ---------- */
async function conectarDocumento(uid) {
  const fs = Sync._fs;
  Sync._doc = fs.doc(Sync._db, 'usuarios', uid);

  try {
    const snap = await fs.getDoc(Sync._doc);
    if (snap.exists()) {
      const remoto = snap.data() || {};
      if (remoto.progresso) Progresso.mesclar(remoto.progresso);
    }
    /* sobe o resultado da mesclagem */
    await Sync.enviar(Progresso.dados, true);

    if (Sync._parar) Sync._parar();
    Sync._parar = fs.onSnapshot(Sync._doc, (s) => {
      if (!s.exists() || Sync._aplicandoRemoto) return;
      const d = s.data() || {};
      if (d.progresso) Progresso.mesclar(d.progresso);
    }, (err) => {
      console.warn('Escuta interrompida:', err);
      sinal('erro', 'Sincronização com erro');
    });

    sinal('ok', 'Sincronizado');
  } catch (e) {
    console.warn('Falha ao sincronizar:', e);
    sinal('erro', 'Sincronização com erro');
  }
}

/* ---------- envio, com agrupamento ---------- */
Sync.enviar = function (dados, imediato) {
  if (!Sync.ativo || !Sync._doc) return Promise.resolve();
  clearTimeout(Sync._pendente);
  const gravar = async () => {
    const fs = Sync._fs;
    try {
      Sync._aplicandoRemoto = true;
      sinal('enviando', 'Salvando…');
      await fs.setDoc(Sync._doc, {
        progresso: dados,
        atualizadoEm: fs.serverTimestamp(),
      }, { merge: true });
      sinal('ok', 'Sincronizado');
    } catch (e) {
      console.warn('Falha ao salvar:', e);
      sinal('erro', 'Sincronização com erro');
    } finally {
      Sync._aplicandoRemoto = false;
    }
  };
  if (imediato) return gravar();
  Sync._pendente = setTimeout(gravar, 1200);
  return Promise.resolve();
};

/* ---------- partida ----------
   O módulo se inicia sozinho para não depender da ordem em que os
   scripts são avaliados. */
function partir() {
  const b = document.getElementById('btn-entrar');
  if (b) b.addEventListener('click', () => Sync.entrar());
  Sync.iniciar();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', partir);
else partir();

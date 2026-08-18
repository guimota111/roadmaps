/* ============================================================
   Configuração do Firebase (aplicativo web)
   ------------------------------------------------------------
   Estes valores NÃO são segredo. A config web do Firebase é feita
   para ficar visível no cliente — a proteção real vem das Security
   Rules (firestore.rules) e da lista de domínios autorizados no
   console. Pode ficar commitada num repositório público.

   NUNCA coloque aqui a chave de service account / Admin SDK
   (o JSON com "private_key"). Essa sim é secreta.

   Enquanto os campos estiverem vazios, o site funciona normalmente
   em modo local: tudo é salvo no navegador e a sincronização fica
   desligada.

   Para ativar:
     1. Console do Firebase → Configurações do projeto → Seus apps →
        App da Web → Configuração do SDK. Copie os valores.
     2. Authentication → Sign-in method → ative "Google".
     3. Authentication → Settings → Authorized domains → adicione
        guimota111.github.io
     4. Firestore Database → crie o banco e publique firestore.rules.
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBVSHN3bYruRIUCSxjEVltratuHZq_6ETc',
  authDomain: 'roadmaps-gui.firebaseapp.com',
  projectId: 'roadmaps-gui',
  storageBucket: 'roadmaps-gui.firebasestorage.app',
  messagingSenderId: '86626276355',
  appId: '1:86626276355:web:b1132205fd3e011aa36a36',
  measurementId: 'G-JMCXW504MP',
};

/* O Analytics do trecho gerado pelo console não é carregado aqui de
   propósito: ele acrescenta um SDK e rastreamento que este site não usa,
   e falha quando bloqueadores estão ativos. O measurementId fica acima
   apenas para o caso de você querer ligá-lo depois. */

# Meus roadmaps de estudo

Controle pessoal de estudos. Cada tema é um **fluxograma navegável**: as fases
avançam da esquerda para a direita, as trilhas correm em paralelo, e cada bloco
abre um modal com os recursos, o estado de estudo, anotações e histórico.

**No ar:** https://guimota111.github.io/roadmaps/

## Como funciona

- **Motor** (`assets/`) — desenha o fluxograma, gerencia progresso e sincroniza.
- **Dados** (`data/`) — um arquivo por roadmap. Adicionar um tema novo não encosta no motor.

O progresso vive no `localStorage` do navegador. Com login Google, sobe para o
Firestore e sincroniza entre dispositivos — mas o site continua funcionando
inteiro sem login e sem internet.

| Arquivo | Papel |
|---|---|
| `index.html` | Casca: barra superior, modal, ordem de carregamento |
| `assets/app.js` | Motor: rotas, fluxograma, modais, progresso, eventos |
| `assets/app.css` | Estilos, temas claro/escuro, responsividade |
| `assets/sync.js` | Login Google + Firestore (opcional) |
| `assets/firebase-config.js` | Config do app web (não é segredo) |
| `firestore.rules` | Regras de segurança do banco |
| `data/*.js` | Os roadmaps |

## Adicionar um roadmap novo

1. Crie `data/meu-tema.js`.
2. Some uma linha no fim do `index.html`:
   ```html
   <script defer src="data/meu-tema.js"></script>
   ```

Pronto. O card aparece na home sozinho.

### Formato

```js
Roadmaps.registrar({
  id: 'meu-tema',              // único; vira a URL (#/r/meu-tema)
  titulo: 'Patologia convencional',
  subtitulo: 'Por sistemas',   // opcional, aparece como sobrelinha
  icone: '🧫',                 // opcional
  cor: '#2E8B6B',              // acento do roadmap
  resumo: 'Uma frase sobre o que este roadmap cobre.',

  // opcional: a tabelinha de contexto no topo
  contexto: [
    { rotulo: 'Ponto de partida', valor: 'Residência concluída' },
  ],

  // colunas do fluxograma, na ordem de exibição
  fases: [
    { id: 'f1', nome: 'Fundamentos', duracao: '3 meses',
      tese: 'Frase que explica o porquê desta fase.' },
    { id: 'gate', nome: 'Decisão', duracao: 'ponto de decisão', tipo: 'decisao' },
  ],

  // faixas horizontais
  trilhas: [
    { id: 'teo', nome: 'Teoria', cor: '#2E8B6B' },
    { id: 'prat', nome: 'Prática', cor: '#C9821F' },
  ],

  // os blocos clicáveis
  nos: [
    {
      id: 'f1-teo',            // único dentro do roadmap
      fase: 'f1',              // id de uma fase
      trilha: 'teo',           // id de uma trilha
      titulo: 'Título do bloco',
      resumo: 'Uma linha, aparece no card do fluxograma.',
      tipo: 'decisao',         // opcional: desenha o bloco tracejado
      depende: ['outro-no'],   // opcional: desenha a seta de ligação
      itens: [
        { id: 'r1', titulo: 'Nome do recurso', tipo: 'livro',
          url: 'https://…',    // opcional, vira link
          nota: 'Por que vale e o que ler.' },
      ],
      marco: 'O que você deve conseguir fazer sozinho antes de avançar.',
    },
  ],

  // opcional: material que não pertence a nenhuma fase
  referencias: [
    { titulo: 'Stack', grupos: [{ nome: 'Grupo', itens: ['linha', 'linha'] }] },
    { titulo: 'Armadilhas', alertas: [{ titulo: 'Erro', texto: 'Explicação.' }] },
  ],
});
```

**Regras que o motor assume:**

- Um bloco precisa de `fase` e `trilha` válidas, senão não é desenhado.
- Fases e trilhas sem nenhum bloco são omitidas automaticamente.
- Vários blocos na mesma célula (mesma fase + mesma trilha) empilham na vertical.
- `depende` aceita qualquer `id` de bloco do mesmo roadmap; a seta fica colorida
  quando o bloco de origem está concluído.
- `id` de bloco e de item entram no armazenamento do progresso. **Renomear um
  `id` descarta o progresso daquele bloco** — mude o título à vontade, o `id` não.

## Controle de estudos

- **Três estados por bloco:** a fazer · estudando · concluído. Marcar o primeiro
  recurso move o bloco para "estudando" sozinho.
- **Anotações** por bloco, salvas enquanto você digita.
- **Histórico:** data de início, de conclusão e da última alteração.
- **Exportar/Importar:** baixa tudo (progresso, anotações e log de eventos) em
  JSON, e recarrega depois. É também a ponte para integrações externas.

### Log de eventos

Toda mudança gera um evento, guardado localmente e exposto para outros sistemas:

```js
Roadmaps.eventos()   // [{ ts, tipo, roadmap, no, item?, de?, para? }, …]
Roadmaps.exportar()  // { versao, geradoEm, progresso, eventos, resumo }
```

Tipos: `no:estado`, `item:marcado`, `item:desmarcado`. O evento também é
disparado no `window`:

```js
window.addEventListener('roadmap:evento', e => console.log(e.detail));
```

## Ligar a sincronização

O site funciona sem nada disso — é só para sincronizar entre dispositivos.

1. Crie um projeto no [Firebase](https://console.firebase.google.com/).
2. **Authentication → Sign-in method →** ative **Google**.
3. **Authentication → Settings → Authorized domains →** adicione
   `guimota111.github.io`.
4. **Firestore Database →** crie o banco e publique o conteúdo de
   `firestore.rules`.
5. **Configurações do projeto → Seus apps → App da Web →** copie a config para
   `assets/firebase-config.js`.

> A config web do Firebase **não é segredo** e pode ficar num repositório
> público: a proteção vem das Security Rules e dos domínios autorizados.
> A chave de **service account / Admin SDK** (o JSON com `private_key`) é
> secreta e nunca deve ser commitada — este projeto não precisa dela.

## Rodar local

Arquivo estático, sem build. Mas use um servidor: o `sync.js` é um módulo ES e
não carrega por `file://`.

```
python3 -m http.server 8000
```

## Publicação

Push na `main` → o workflow regenera a branch `gh-pages` → o GitHub Pages
reconstrói. Não edite a `gh-pages` à mão: ela é sobrescrita a cada push.

## Nota

Roadmaps que citam normas técnicas ou regulatórias são material de estudo, não
orientação profissional. Confirme sempre o texto vigente nas fontes oficiais.

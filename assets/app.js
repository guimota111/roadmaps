/* ============================================================
   Roadmaps de estudo — motor
   ------------------------------------------------------------
   Responsabilidades:
     · registro dos roadmaps (data/*.js chamam Roadmaps.registrar)
     · desenho do fluxograma horizontal e das ligações
     · modal de cada bloco: estado, itens, anotações, datas
     · progresso local + ponte para a sincronização (assets/sync.js)
     · log de eventos de estudo, para exportar a outros sistemas
   ============================================================ */
(function () {
  'use strict';

  var CHAVE = 'roadmaps:v2';
  var CHAVE_EVENTOS = 'roadmaps:v2:eventos';
  var MAX_EVENTOS = 800;

  var ESTADOS = [
    { id: 'todo', rotulo: 'A fazer' },
    { id: 'doing', rotulo: 'Estudando' },
    { id: 'done', rotulo: 'Concluído' },
  ];

  /* ---------------------------------------------------------
     Registro de roadmaps
     --------------------------------------------------------- */
  var Roadmaps = {
    lista: [],
    registrar: function (def) {
      if (!def || !def.id) throw new Error('Roadmap sem id');
      if (Roadmaps.obter(def.id)) throw new Error('Roadmap duplicado: ' + def.id);
      def.nos = def.nos || [];
      def.fases = def.fases || [];
      def.trilhas = def.trilhas || [];
      Roadmaps.lista.push(def);
      if (typeof document !== 'undefined' && document.body) agendarRender();
      return def;
    },
    obter: function (id) {
      for (var i = 0; i < Roadmaps.lista.length; i++) {
        if (Roadmaps.lista[i].id === id) return Roadmaps.lista[i];
      }
      return null;
    },
  };
  window.Roadmaps = Roadmaps;

  /* ---------------------------------------------------------
     Progresso — verdade local, espelhada na nuvem quando há login
     --------------------------------------------------------- */
  var Progresso = {
    dados: { roadmaps: {}, atualizadoEm: 0 },

    carregar: function () {
      try {
        var bruto = localStorage.getItem(CHAVE);
        if (bruto) {
          var d = JSON.parse(bruto);
          if (d && typeof d === 'object') {
            Progresso.dados = { roadmaps: d.roadmaps || {}, atualizadoEm: d.atualizadoEm || 0 };
          }
        }
      } catch (e) { /* armazenamento indisponível: segue em memória */ }
      Progresso.migrarV1();
    },

    /* O site antigo guardava índices de checkbox numa única lista.
       Sem correspondência confiável com os blocos novos, então apenas
       preservamos o dado bruto para não destruir histórico do usuário. */
    migrarV1: function () {
      try {
        var antigo = localStorage.getItem('roadmap-patologia-ia:v1');
        if (antigo && !localStorage.getItem('roadmap-patologia-ia:v1:arquivado')) {
          localStorage.setItem('roadmap-patologia-ia:v1:arquivado', antigo);
        }
      } catch (e) { /* ignora */ }
    },

    salvar: function (silencioso) {
      Progresso.dados.atualizadoEm = Date.now();
      try { localStorage.setItem(CHAVE, JSON.stringify(Progresso.dados)); } catch (e) { /* ignora */ }
      if (!silencioso && window.Sync && Sync.enviar) Sync.enviar(Progresso.dados);
    },

    doRoadmap: function (rid) {
      if (!Progresso.dados.roadmaps[rid]) Progresso.dados.roadmaps[rid] = { nos: {} };
      if (!Progresso.dados.roadmaps[rid].nos) Progresso.dados.roadmaps[rid].nos = {};
      return Progresso.dados.roadmaps[rid];
    },

    doNo: function (rid, nid) {
      var r = Progresso.doRoadmap(rid);
      if (!r.nos[nid]) r.nos[nid] = { estado: 'todo', itens: {}, nota: '' };
      if (!r.nos[nid].itens) r.nos[nid].itens = {};
      return r.nos[nid];
    },

    definirEstado: function (rid, nid, estado) {
      var n = Progresso.doNo(rid, nid);
      if (n.estado === estado) return;
      var antes = n.estado;
      n.estado = estado;
      n.atualizadoEm = Date.now();
      if (estado === 'doing' && !n.iniciadoEm) n.iniciadoEm = Date.now();
      if (estado === 'done') {
        if (!n.iniciadoEm) n.iniciadoEm = Date.now();
        n.concluidoEm = Date.now();
      } else {
        delete n.concluidoEm;
      }
      if (estado === 'todo') { delete n.iniciadoEm; }
      registrarEvento({ tipo: 'no:estado', roadmap: rid, no: nid, de: antes, para: estado });
      Progresso.salvar();
    },

    alternarItem: function (rid, nid, iid, marcado) {
      var n = Progresso.doNo(rid, nid);
      if (marcado) n.itens[iid] = true; else delete n.itens[iid];
      n.atualizadoEm = Date.now();
      /* marcar o primeiro item move o bloco para "estudando" sozinho */
      if (marcado && n.estado === 'todo') {
        n.estado = 'doing';
        if (!n.iniciadoEm) n.iniciadoEm = Date.now();
        registrarEvento({ tipo: 'no:estado', roadmap: rid, no: nid, de: 'todo', para: 'doing', automatico: true });
      }
      registrarEvento({ tipo: marcado ? 'item:marcado' : 'item:desmarcado', roadmap: rid, no: nid, item: iid });
      Progresso.salvar();
    },

    definirNota: function (rid, nid, texto) {
      var n = Progresso.doNo(rid, nid);
      if (n.nota === texto) return;
      n.nota = texto;
      n.atualizadoEm = Date.now();
      Progresso.salvar();
    },

    /* Mescla o que veio da nuvem. Resolve por bloco, pelo mais recente. */
    mesclar: function (remoto) {
      if (!remoto || !remoto.roadmaps) return false;
      var mudou = false;
      Object.keys(remoto.roadmaps).forEach(function (rid) {
        var rRem = remoto.roadmaps[rid] || {};
        var rLoc = Progresso.doRoadmap(rid);
        Object.keys(rRem.nos || {}).forEach(function (nid) {
          var nRem = rRem.nos[nid];
          var nLoc = rLoc.nos[nid];
          if (!nLoc || (nRem.atualizadoEm || 0) > (nLoc.atualizadoEm || 0)) {
            rLoc.nos[nid] = nRem;
            mudou = true;
          }
        });
      });
      if (mudou) { Progresso.salvar(true); agendarRender(); }
      return mudou;
    },

    zerarRoadmap: function (rid) {
      delete Progresso.dados.roadmaps[rid];
      Progresso.salvar();
    },
  };
  window.Progresso = Progresso;

  /* ---------------------------------------------------------
     Log de eventos — matéria-prima para integrações externas
     (ex.: alimentar um tamagochi com sessões de estudo)
     --------------------------------------------------------- */
  var eventos = [];

  function carregarEventos() {
    try {
      var b = localStorage.getItem(CHAVE_EVENTOS);
      if (b) { var d = JSON.parse(b); if (Array.isArray(d)) eventos = d; }
    } catch (e) { /* ignora */ }
  }

  function registrarEvento(ev) {
    ev.ts = Date.now();
    eventos.push(ev);
    if (eventos.length > MAX_EVENTOS) eventos = eventos.slice(-MAX_EVENTOS);
    try { localStorage.setItem(CHAVE_EVENTOS, JSON.stringify(eventos)); } catch (e) { /* ignora */ }
    window.dispatchEvent(new CustomEvent('roadmap:evento', { detail: ev }));
  }

  /* Formato estável para consumo externo. Mantenha compatível. */
  function exportar() {
    return {
      versao: 2,
      geradoEm: new Date().toISOString(),
      progresso: Progresso.dados,
      eventos: eventos,
      resumo: Roadmaps.lista.map(function (r) {
        var e = estatisticas(r);
        return {
          roadmap: r.id, titulo: r.titulo,
          blocos: e.total, concluidos: e.done, estudando: e.doing,
          itens: e.itensTotal, itensFeitos: e.itensFeitos,
          percentual: e.pct,
        };
      }),
    };
  }
  Roadmaps.exportar = exportar;
  Roadmaps.eventos = function () { return eventos.slice(); };

  /* ---------------------------------------------------------
     Estatísticas
     --------------------------------------------------------- */
  function estatisticas(rm) {
    var e = { total: rm.nos.length, todo: 0, doing: 0, done: 0, itensTotal: 0, itensFeitos: 0, pct: 0 };
    rm.nos.forEach(function (no) {
      var p = (Progresso.dados.roadmaps[rm.id] || { nos: {} }).nos[no.id] || { estado: 'todo', itens: {} };
      e[p.estado || 'todo']++;
      var itens = no.itens || [];
      e.itensTotal += itens.length;
      itens.forEach(function (it) { if ((p.itens || {})[it.id]) e.itensFeitos++; });
    });
    e.pct = e.itensTotal ? Math.round((e.itensFeitos / e.itensTotal) * 100) : 0;
    return e;
  }

  /* ---------------------------------------------------------
     Utilidades
     --------------------------------------------------------- */
  function el(tag, cls, texto) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function dataBR(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function brinde(msg) {
    var b = document.getElementById('brinde');
    b.textContent = msg;
    b.classList.add('mostra');
    clearTimeout(brinde._t);
    brinde._t = setTimeout(function () { b.classList.remove('mostra'); }, 2600);
  }

  /* ---------------------------------------------------------
     Roteamento por hash
       #/                    → home
       #/r/<roadmap>         → fluxograma
       #/r/<roadmap>/<bloco> → fluxograma com o modal aberto
     --------------------------------------------------------- */
  function rota() {
    var h = (location.hash || '#/').replace(/^#/, '');
    var p = h.split('/').filter(Boolean);
    if (p[0] === 'r' && p[1]) return { vista: 'roadmap', rid: decodeURIComponent(p[1]), nid: p[2] ? decodeURIComponent(p[2]) : null };
    return { vista: 'home' };
  }
  function irPara(hash) { location.hash = hash; }

  var renderAgendado = false;
  function agendarRender() {
    if (renderAgendado) return;
    renderAgendado = true;
    requestAnimationFrame(function () { renderAgendado = false; render(); });
  }

  /* ---------------------------------------------------------
     Home
     --------------------------------------------------------- */
  function renderHome(alvo) {
    var sec = el('section', 'home');
    var shell = el('div', 'shell');

    var cab = el('div', 'home-cab');
    cab.appendChild(el('p', 'eyebrow', 'Controle de estudos'));
    cab.appendChild(el('h1', null, 'Meus roadmaps'));
    var p = el('p', null,
      'Cada roadmap é um fluxograma: fases da esquerda para a direita, trilhas paralelas empilhadas. ' +
      'Clique em qualquer bloco para abrir os recursos, marcar o que já estudou e deixar anotações.');
    cab.appendChild(p);
    shell.appendChild(cab);

    if (!Roadmaps.lista.length) {
      shell.appendChild(el('div', 'vazio', 'Nenhum roadmap carregado ainda.'));
    } else {
      var grade = el('div', 'grade-roadmaps');
      Roadmaps.lista.forEach(function (rm) {
        var e = estatisticas(rm);
        var c = el('button', 'cartao');
        c.type = 'button';
        c.style.setProperty('--cor', rm.cor || 'var(--acc)');
        c.setAttribute('aria-label', 'Abrir roadmap ' + rm.titulo);

        var topo = el('div', 'cartao-topo');
        topo.appendChild(el('span', 'cartao-ico', rm.icone || '📘'));
        var tw = el('div');
        tw.appendChild(el('h2', null, rm.titulo));
        if (rm.subtitulo) tw.appendChild(el('div', 'cartao-sub', rm.subtitulo));
        topo.appendChild(tw);
        c.appendChild(topo);

        if (rm.resumo) c.appendChild(el('p', null, rm.resumo));

        var pe = el('div', 'cartao-rodape');
        var barra = el('div', 'barra');
        var fill = el('i');
        fill.style.width = e.pct + '%';
        barra.appendChild(fill);
        pe.appendChild(barra);
        pe.appendChild(el('span', 'barra-num', e.pct + '%'));
        c.appendChild(pe);

        var det = el('div', 'barra-num');
        det.textContent = e.done + ' de ' + e.total + ' blocos concluídos' +
          (e.doing ? ' · ' + e.doing + ' em andamento' : '');
        c.appendChild(det);

        c.addEventListener('click', function () { irPara('#/r/' + encodeURIComponent(rm.id)); });
        grade.appendChild(c);
      });
      shell.appendChild(grade);
    }

    var aviso = el('div', 'aviso');
    var ap = el('p');
    ap.innerHTML = '<b>Como adicionar um roadmap novo:</b> crie um arquivo em <code>data/</code> ' +
      'seguindo o modelo de <code>data/patologia-digital.js</code> e registre-o com uma linha em ' +
      '<code>index.html</code>. O guia completo do formato está no <code>README.md</code>.';
    aviso.appendChild(ap);
    shell.appendChild(aviso);

    sec.appendChild(shell);
    alvo.appendChild(sec);
  }

  /* ---------------------------------------------------------
     Fluxograma
     --------------------------------------------------------- */
  function renderRoadmap(alvo, rm) {
    document.documentElement.style.setProperty('--acc', rm.cor || '#6C5CE0');
    var e = estatisticas(rm);

    /* --- cabeçalho --- */
    var cab = el('header', 'rm-cab');
    var cs = el('div', 'shell rm-cab-in');

    var tit = el('div', 'rm-titulo');
    tit.appendChild(el('span', 'rm-titulo-ico', rm.icone || '📘'));
    var tw = el('div');
    if (rm.subtitulo) tw.appendChild(el('p', 'eyebrow', rm.subtitulo));
    tw.appendChild(el('h1', null, rm.titulo));
    tit.appendChild(tw);
    cs.appendChild(tit);

    if (rm.resumo) cs.appendChild(el('p', 'rm-resumo', rm.resumo));

    if (rm.contexto && rm.contexto.length) {
      var ctx = el('dl', 'contexto');
      rm.contexto.forEach(function (c) {
        var d = el('div');
        d.appendChild(el('dt', null, c.rotulo));
        d.appendChild(el('dd', null, c.valor));
        ctx.appendChild(d);
      });
      cs.appendChild(ctx);
    }

    var med = el('div', 'rm-medidores');
    [['done', 'concluídos', e.done], ['doing', 'estudando', e.doing], ['todo', 'a fazer', e.todo]]
      .forEach(function (m) {
        var d = el('div', 'medidor medidor--' + m[0]);
        var b = el('b', null, String(m[2]));
        d.appendChild(b);
        d.appendChild(document.createTextNode(' ' + m[1]));
        med.appendChild(d);
      });
    var pct = el('div', 'medidor');
    pct.style.setProperty('--pt', 'var(--acc)');
    pct.appendChild(el('b', null, e.itensFeitos + '/' + e.itensTotal));
    pct.appendChild(document.createTextNode(' recursos · ' + e.pct + '%'));
    med.appendChild(pct);
    cs.appendChild(med);

    cab.appendChild(cs);
    alvo.appendChild(cab);

    /* --- grade do fluxograma --- */
    alvo.appendChild(el('p', 'dica-scroll', 'Role na horizontal para avançar pelas fases · clique num bloco para abrir'));

    var wrap = el('div', 'flow-wrap');
    var flow = el('div', 'flow');

    var fasesUsadas = rm.fases.filter(function (f) {
      return rm.nos.some(function (n) { return n.fase === f.id; });
    });
    var trilhasUsadas = rm.trilhas.filter(function (t) {
      return rm.nos.some(function (n) { return n.trilha === t.id; });
    });

    flow.style.gridTemplateColumns = 'auto repeat(' + fasesUsadas.length + ', max-content)';
    flow.style.gridTemplateRows = 'auto repeat(' + trilhasUsadas.length + ', auto)';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'edges');
    flow.appendChild(svg);

    fasesUsadas.forEach(function (f, i) {
      var h = el('div', 'fase-cab');
      if (f.tipo) h.dataset.tipo = f.tipo;
      h.style.gridColumn = String(i + 2);
      h.style.gridRow = '1';
      h.appendChild(el('h2', null, f.nome));
      h.appendChild(el('div', 'dur', f.duracao || ''));
      flow.appendChild(h);
    });

    trilhasUsadas.forEach(function (t, j) {
      var r = el('div', 'trilha-rot');
      r.style.setProperty('--tc', t.cor || 'var(--acc)');
      r.style.gridColumn = '1';
      r.style.gridRow = String(j + 2);
      r.appendChild(el('span', null, t.nome));
      flow.appendChild(r);
    });

    var mapaNos = {};
    fasesUsadas.forEach(function (f, i) {
      trilhasUsadas.forEach(function (t, j) {
        var doCelula = rm.nos.filter(function (n) { return n.fase === f.id && n.trilha === t.id; });
        if (!doCelula.length) return;
        var cel = el('div', 'celula');
        cel.style.gridColumn = String(i + 2);
        cel.style.gridRow = String(j + 2);
        cel.style.display = 'flex';
        cel.style.flexDirection = 'column';
        cel.style.gap = '14px';
        doCelula.forEach(function (no) {
          var b = criarNo(rm, no, t);
          mapaNos[no.id] = b;
          cel.appendChild(b);
        });
        flow.appendChild(cel);
      });
    });

    wrap.appendChild(flow);
    alvo.appendChild(wrap);

    /* --- ligações, depois do layout --- */
    function desenharLigacoes() {
      limpar(svg);
      var largura = flow.scrollWidth, altura = flow.scrollHeight;
      svg.setAttribute('viewBox', '0 0 ' + largura + ' ' + altura);
      svg.setAttribute('width', largura);
      svg.setAttribute('height', altura);

      rm.nos.forEach(function (no) {
        (no.depende || []).forEach(function (origemId) {
          var a = mapaNos[origemId], b = mapaNos[no.id];
          if (!a || !b) return;
          var x1 = a.offsetLeft + a.offsetWidth, y1 = a.offsetTop + a.offsetHeight / 2;
          var x2 = b.offsetLeft, y2 = b.offsetTop + b.offsetHeight / 2;
          var dx = Math.max(28, (x2 - x1) / 2);
          var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('d', 'M ' + x1 + ',' + y1 + ' C ' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2);
          var pOrig = Progresso.doNo(rm.id, origemId);
          if (pOrig.estado === 'done') p.setAttribute('class', 'viva');
          svg.appendChild(p);
        });
      });
    }
    requestAnimationFrame(desenharLigacoes);
    if (redesenhar) window.removeEventListener('resize', redesenhar);
    redesenhar = desenharLigacoes;
    window.addEventListener('resize', redesenhar);

    /* --- referências --- */
    if (rm.referencias && rm.referencias.length) {
      var refs = el('section', 'refs');
      var rs = el('div', 'shell');
      rm.referencias.forEach(function (bloco) {
        var b = el('div', 'ref-bloco');
        b.appendChild(el('h2', null, bloco.titulo));
        if (bloco.nota) b.appendChild(el('p', null, bloco.nota));
        if (bloco.grupos) {
          var g = el('div', 'ref-grade');
          bloco.grupos.forEach(function (grp) {
            var d = el('div');
            d.appendChild(el('h3', null, grp.nome));
            var ul = el('ul');
            grp.itens.forEach(function (i) { ul.appendChild(el('li', null, i)); });
            d.appendChild(ul);
            g.appendChild(d);
          });
          b.appendChild(g);
        }
        if (bloco.alertas) {
          var pilha = el('div', 'pilha');
          bloco.alertas.forEach(function (a) {
            var d = el('div', 'alerta');
            d.appendChild(el('h3', null, a.titulo));
            d.appendChild(el('p', null, a.texto));
            pilha.appendChild(d);
          });
          b.appendChild(pilha);
        }
        rs.appendChild(b);
      });
      refs.appendChild(rs);
      alvo.appendChild(refs);
    }
  }
  var redesenhar = null;

  function criarNo(rm, no, trilha) {
    var p = Progresso.doNo(rm.id, no.id);
    var b = el('button', 'no');
    b.type = 'button';
    b.dataset.estado = p.estado || 'todo';
    if (no.tipo) b.dataset.tipo = no.tipo;
    b.setAttribute('aria-label', 'Abrir bloco ' + no.titulo);

    var topo = el('div', 'no-topo');
    topo.appendChild(el('div', 'no-titulo', no.titulo));
    topo.appendChild(el('span', 'no-selo'));
    b.appendChild(topo);

    if (no.resumo) b.appendChild(el('div', 'no-resumo', no.resumo));

    var itens = no.itens || [];
    var feitos = itens.filter(function (i) { return (p.itens || {})[i.id]; }).length;

    var pe = el('div', 'no-pe');
    var barra = el('div', 'barra');
    var fill = el('i');
    fill.style.width = (itens.length ? (feitos / itens.length) * 100 : 0) + '%';
    fill.style.background = trilha && trilha.cor ? trilha.cor : 'var(--acc)';
    barra.appendChild(fill);
    pe.appendChild(barra);
    pe.appendChild(el('span', 'no-cont', feitos + '/' + itens.length));
    if (p.nota && p.nota.trim()) {
      var n = el('span', 'no-nota', '✎');
      n.title = 'Tem anotação';
      pe.appendChild(n);
    }
    b.appendChild(pe);

    b.addEventListener('click', function () {
      irPara('#/r/' + encodeURIComponent(rm.id) + '/' + encodeURIComponent(no.id));
    });
    return b;
  }

  /* ---------------------------------------------------------
     Modal do bloco
     --------------------------------------------------------- */
  var dlg = null;

  function abrirModal(rm, no) {
    if (!dlg) {
      dlg = document.getElementById('modal');
      dlg.addEventListener('close', function () {
        var r = rota();
        if (r.vista === 'roadmap' && r.nid) irPara('#/r/' + encodeURIComponent(r.rid));
      });
      dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    }
    var trilha = rm.trilhas.filter(function (t) { return t.id === no.trilha; })[0] || {};
    var p = Progresso.doNo(rm.id, no.id);

    limpar(dlg);
    var box = el('div', 'modal-in');

    /* cabeçalho */
    var cab = el('div', 'modal-cab');
    cab.style.setProperty('--est', 'var(--st-' + (p.estado || 'todo') + ')');
    var linha = el('div', 'modal-cab-linha');
    var esq = el('div');
    var tr = el('div', 'modal-trilha');
    tr.style.setProperty('--tc', trilha.cor || 'var(--acc)');
    var fase = rm.fases.filter(function (f) { return f.id === no.fase; })[0] || {};
    tr.appendChild(el('span', null, (fase.nome || '') + (trilha.nome ? ' · ' + trilha.nome : '')));
    esq.appendChild(tr);
    esq.appendChild(el('h2', null, no.titulo));
    linha.appendChild(esq);
    var x = el('button', 'fechar', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Fechar');
    x.addEventListener('click', function () { dlg.close(); });
    linha.appendChild(x);
    cab.appendChild(linha);
    if (no.resumo) cab.appendChild(el('p', 'modal-resumo', no.resumo));
    box.appendChild(cab);

    /* corpo */
    var corpo = el('div', 'modal-corpo');

    /* estado */
    var sEst = el('div', 'secao');
    sEst.appendChild(el('p', 'eyebrow', 'Estado do bloco'));
    var estWrap = el('div', 'estados');
    ESTADOS.forEach(function (est) {
      var bt = el('button', 'estado-btn', est.rotulo);
      bt.type = 'button';
      bt.dataset.estado = est.id;
      bt.setAttribute('aria-pressed', String((p.estado || 'todo') === est.id));
      bt.addEventListener('click', function () {
        Progresso.definirEstado(rm.id, no.id, est.id);
        abrirModal(rm, no);
        agendarRender();
        brinde(est.id === 'done' ? 'Bloco concluído' : 'Estado atualizado');
      });
      estWrap.appendChild(bt);
    });
    sEst.appendChild(estWrap);
    corpo.appendChild(sEst);

    /* itens */
    if ((no.itens || []).length) {
      var sIt = el('div', 'secao');
      var feitos = no.itens.filter(function (i) { return (p.itens || {})[i.id]; }).length;
      sIt.appendChild(el('p', 'eyebrow', 'Recursos · ' + feitos + ' de ' + no.itens.length));
      var lista = el('div', 'itens');
      no.itens.forEach(function (it) {
        var lab = el('label', 'item');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = !!(p.itens || {})[it.id];
        cb.addEventListener('change', function () {
          Progresso.alternarItem(rm.id, no.id, it.id, cb.checked);
          abrirModal(rm, no);
          agendarRender();
        });
        lab.appendChild(cb);
        var c = el('div', 'item-corpo');
        if (it.url) {
          var tw2 = el('div', 'item-tit');
          var a = el('a', null, it.titulo);
          a.href = it.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.addEventListener('click', function (ev) { ev.stopPropagation(); });
          tw2.appendChild(a);
          c.appendChild(tw2);
        } else {
          c.appendChild(el('div', 'item-tit', it.titulo));
        }
        if (it.tipo) {
          var meta = el('div', 'item-meta');
          meta.appendChild(el('span', 'marca-tipo', it.tipo));
          c.appendChild(meta);
        }
        if (it.nota) c.appendChild(el('div', 'item-nota', it.nota));
        lab.appendChild(c);
        lista.appendChild(lab);
      });
      sIt.appendChild(lista);
      corpo.appendChild(sIt);
    }

    /* marco */
    if (no.marco) {
      var sM = el('div', 'secao');
      sM.appendChild(el('p', 'eyebrow', 'Marco de checagem'));
      var mc = el('div', 'marco-caixa');
      mc.appendChild(el('p', null, no.marco));
      sM.appendChild(mc);
      corpo.appendChild(sM);
    }

    /* anotações */
    var sN = el('div', 'secao');
    sN.appendChild(el('p', 'eyebrow', 'Minhas anotações'));
    var ta = el('textarea', 'nota-campo');
    ta.value = p.nota || '';
    ta.placeholder = 'Dúvidas, links que você achou, o que ficou faltando, onde parou…';
    var tDeb;
    ta.addEventListener('input', function () {
      clearTimeout(tDeb);
      tDeb = setTimeout(function () {
        Progresso.definirNota(rm.id, no.id, ta.value);
        agendarRender();
      }, 500);
    });
    sN.appendChild(ta);
    corpo.appendChild(sN);

    /* datas */
    var sD = el('div', 'secao');
    sD.appendChild(el('p', 'eyebrow', 'Histórico'));
    var dl = el('dl', 'datas');
    [['Iniciado em', p.iniciadoEm], ['Concluído em', p.concluidoEm], ['Última alteração', p.atualizadoEm]]
      .forEach(function (d) {
        var w = el('div', 'data-item');
        w.appendChild(el('dt', null, d[0]));
        w.appendChild(el('dd', null, dataBR(d[1])));
        dl.appendChild(w);
      });
    sD.appendChild(dl);
    corpo.appendChild(sD);

    box.appendChild(corpo);

    /* rodapé com navegação entre blocos */
    var pe2 = el('div', 'modal-pe');
    var idx = rm.nos.indexOf(no);
    var nav = el('div', 'nav-nos');
    var ant = el('button', 'btn', '← Anterior');
    ant.type = 'button';
    ant.disabled = idx <= 0;
    ant.addEventListener('click', function () {
      irPara('#/r/' + encodeURIComponent(rm.id) + '/' + encodeURIComponent(rm.nos[idx - 1].id));
    });
    var prox = el('button', 'btn', 'Próximo →');
    prox.type = 'button';
    prox.disabled = idx >= rm.nos.length - 1;
    prox.addEventListener('click', function () {
      irPara('#/r/' + encodeURIComponent(rm.id) + '/' + encodeURIComponent(rm.nos[idx + 1].id));
    });
    nav.appendChild(ant);
    nav.appendChild(prox);
    pe2.appendChild(nav);
    var fim = el('button', 'btn btn--sutil', 'Fechar');
    fim.type = 'button';
    fim.addEventListener('click', function () { dlg.close(); });
    pe2.appendChild(fim);
    box.appendChild(pe2);

    dlg.appendChild(box);
    if (!dlg.open) dlg.showModal();
  }

  /* ---------------------------------------------------------
     Render principal
     --------------------------------------------------------- */
  function render() {
    var r = rota();
    var app = document.getElementById('app');
    limpar(app);

    if (r.vista === 'roadmap') {
      var rm = Roadmaps.obter(r.rid);
      if (!rm) {
        /* Nenhum roadmap carregado ainda: espera o registro em vez de
           expulsar o usuário da URL que ele pediu. */
        if (!Roadmaps.lista.length) return;
        irPara('#/');
        return;
      }
      renderRoadmap(app, rm);
      atualizarTopo(rm);
      if (r.nid) {
        var no = rm.nos.filter(function (n) { return n.id === r.nid; })[0];
        if (no) abrirModal(rm, no);
        else if (dlg && dlg.open) dlg.close();
      } else if (dlg && dlg.open) {
        dlg.close();
      }
    } else {
      document.documentElement.style.setProperty('--acc', '#6C5CE0');
      renderHome(app);
      atualizarTopo(null);
      if (dlg && dlg.open) dlg.close();
    }
  }

  function atualizarTopo(rm) {
    var ctx = document.getElementById('topo-contexto');
    limpar(ctx);
    if (rm) {
      var b = el('button', 'btn btn--sutil');
      b.type = 'button';
      b.setAttribute('aria-label', 'Voltar para todos os roadmaps');
      b.appendChild(el('span', null, '←'));
      b.appendChild(el('span', 'btn-rot', 'Todos os roadmaps'));
      b.addEventListener('click', function () { irPara('#/'); });
      ctx.appendChild(b);
    }
  }

  /* ---------------------------------------------------------
     Ações da barra superior
     --------------------------------------------------------- */
  function ligarAcoes() {
    document.getElementById('btn-marca').addEventListener('click', function () { irPara('#/'); });

    document.getElementById('btn-exportar').addEventListener('click', function () {
      var dados = exportar();
      var blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'meus-estudos-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      brinde('Progresso exportado');
    });

    var inp = document.getElementById('arquivo-importar');
    document.getElementById('btn-importar').addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var d = JSON.parse(fr.result);
          var alvo = d.progresso || d;
          if (!alvo || !alvo.roadmaps) throw new Error('formato');
          Progresso.mesclar(alvo);
          brinde('Progresso importado');
          agendarRender();
        } catch (err) {
          brinde('Arquivo inválido');
        }
        inp.value = '';
      };
      fr.readAsText(f);
    });

    var tema = document.getElementById('btn-tema');
    tema.addEventListener('click', function () {
      var atual = document.documentElement.getAttribute('data-theme');
      var escuroSO = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var novo = atual ? (atual === 'dark' ? 'light' : 'dark') : (escuroSO ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', novo);
      try { localStorage.setItem('roadmaps:tema', novo); } catch (e) { /* ignora */ }
    });
    try {
      var salvo = localStorage.getItem('roadmaps:tema');
      if (salvo) document.documentElement.setAttribute('data-theme', salvo);
    } catch (e) { /* ignora */ }
  }

  /* ---------------------------------------------------------
     Início
     --------------------------------------------------------- */
  function iniciar() {
    Progresso.carregar();
    carregarEventos();
    ligarAcoes();
    window.addEventListener('hashchange', render);
    render();
    /* assets/sync.js parte sozinho — não depende da ordem dos scripts */
  }

  Roadmaps.render = agendarRender;
  Roadmaps.brinde = brinde;

  /* Precisa ser DOMContentLoaded, e não a execução deste script: os
     arquivos de data/ são carregados com defer DEPOIS deste, então na
     hora em que ele roda a lista de roadmaps ainda está vazia. */
  if (document.readyState === 'complete') iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();

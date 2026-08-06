# Roadmap — IA aplicada à Patologia Digital

Site estático com um roadmap de aprendizado e carreira para um médico patologista
construir um produto na interseção de inteligência artificial e patologia digital.

## Perfil para o qual foi construído

| | |
|---|---|
| Ponto de partida | Patologista clínico, programação básica, sem formação em ML |
| Papel pretendido | Clínico-fundador que constrói protótipos |
| Mercado inicial | Brasil (Anvisa), com FDA/UE no horizonte |
| Computação | Notebook comum, sem GPU dedicada |
| Vertical do produto | Em aberto — decidida num ponto de decisão explícito entre as fases 2 e 3 |
| Ritmo | Part-time consistente, ~8–10 h/semana |

## Estrutura

Seis fases sequenciais (0 a 5) e três trilhas que correm em paralelo dentro de cada fase:

- **Técnica** — de NumPy a foundation models de patologia e MIL
- **Regulatória e clínica** — RDC 751/2022, RDC 657/2022, IEC 62304, ISO 14971/13485, CEP/CONEP
- **Produto e negócio** — entrevistas, mapa de players, precificação, integração com LIS, financiamento

Entre as fases 2 e 3 há uma faixa de decisão de vertical, com três caminhos
(diagnóstico regulado, fluxo de trabalho, plataforma de pesquisa) comparados por
risco regulatório, prazo até receita e critério de escolha.

Cada fase termina com um marco de checagem concreto — o que você deve conseguir
fazer sozinho antes de avançar.

## Uso

Arquivo único, sem dependências externas nem etapa de build.

```
open index.html
```

O progresso dos itens é salvo no `localStorage` do próprio navegador.

## Nota

As referências normativas mudam com frequência. Confirme sempre o texto vigente
nas fontes oficiais antes de tomar decisão de produto com base nelas. É material
de estudo e planejamento, não orientação regulatória ou jurídica.

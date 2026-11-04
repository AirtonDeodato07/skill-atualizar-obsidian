---
tipo: cópia-ia
origem: ".claude/skills/atualizar-obsidian/SKILL.md"
sincronizado: 2026-11-04
---

> [!warning] Cópia gerada — não edite aqui
> Original: `.claude/skills/atualizar-obsidian/SKILL.md`. Refeita por `sincronizar-ias.mjs` (skill `atualizar-obsidian`);
> mudança feita aqui some na próxima sincronia. Índice: [[IA do projeto]].

```yaml
name: atualizar-obsidian
description: OBRIGATÓRIA neste projeto — mantém a memória VIVA do chat (Sessões/Memória de chat DD-MM.md, criada no começo e atualizada a cada etapa da conversa) e atualiza o vault Obsidian do projeto (caminho em obsidian-skill.config.json) com o que a tarefa mudou ou descobriu. Use SEMPRE no começo de um chat que vá fazer algo, a cada pedido/resultado/decisão, e antes de dar por concluída qualquer tarefa que mexa em código, regra de negócio, esquema do banco, migration, deploy, procedimento, integração externa ou que descubra uma armadilha, um número medido ou um comportamento de API — mesmo sem mudar código. Use também quando o usuário falar em Obsidian, vault, notas, documentação, "registrar", "anotar" ou pedir para atualizar o conhecimento do sistema, inclusive a auditoria completa do vault.
```

# Atualizar o Obsidian

O vault (pasta definida em `obsidian-skill.config.json`, campo `vault`) é a memória do projeto:
o `CLAUDE.md` só roteia, o conhecimento mora nas notas. Uma nota que ficou para trás é pior que
nota nenhuma — ela afirma com segurança uma regra que o código já não segue, e a próxima sessão
confia nela.

A tarefa **não está pronta** enquanto o vault não descrever o que mudou. Ao terminar, diga ao
usuário quais notas criou ou editou.

## Antes de tudo: CONSULTAR o vault

Antes de responder ou agir sobre um assunto do sistema, leia a nota que a tabela de roteamento do
`CLAUDE.md` aponta e procure o assunto no vault (`Grep` na pasta do vault pelo nome da função,
termo do negócio ou identificador do registro). Pergunta sobre trabalho passado ⇒ `Sessões/` e
`IA do projeto/Memórias do Claude/`. Só então o código. O que a nota afirma e o código desmente se
corrige na mesma tarefa.

## 0. A memória deste chat (sempre, e ao longo da conversa)

Cada chat tem a sua nota em `Sessões/Memória de chat DD-MM.md` (dois chats no mesmo dia:
`DD-MM assunto`).

- **Crie** na primeira resposta que fizer algo; **atualize a cada etapa** — pedido novo,
  resultado medido, decisão do usuário, pendência aberta ou fechada. Não deixe para o fim: o chat
  pode acabar (ou ser resumido) no meio, e a memória é o que a próxima sessão lê.
- **Formato** (copie de [[Modelo - Memória de chat]]): frontmatter `tipo: sessão`, `periodo`,
  `atualizado`, `cobre`; seção **"Estado agora"** no topo (pronto / esperando autorização /
  em andamento); **linha do tempo** numerada com o pedido **nas palavras do usuário** e o que foi
  feito ou medido; **decisões do usuário**; **pendências** em checklist (`- [ ]` / `- [x]`).
- A memória é o fio da meada: o detalhe técnico vai para a nota do módulo, e a memória aponta
  para ela com `[[link]]`. Resposta errada que foi corrigida depois fica registrada como tal.
- Ligue a nota nova a `Home.md` (seção "Sessões de trabalho").

## 1. Descobrir o que precisa mudar

Rode a auditoria da raiz do repositório (só lê, não escreve nada):

```bash
node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs --mudados   # o que a working tree mexeu
node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs             # o vault inteiro
node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs --detalhe   # + commits que atrasaram cada nota
```

Ela lista: **notas atrasadas** (um caminho do `cobre:` mudou depois do `atualizado:`),
**código sem nota**, **caminhos do `cobre:` que sumiram**, **links quebrados** (nota ou
`#seção` inexistente), **órfãs**, **caracteres de controle** e a **contagem** por pasta contra o
`CLAUDE.md`.

`--mudados` traz também o que outra sessão mexeu. Cuide primeiro dos arquivos que **esta**
tarefa tocou, mas não esconda o resto — avise o usuário do que viu atrasado.

Além da auditoria, confira a tabela **"Roteamento — mexeu aqui, leia isto ANTES"** do
`CLAUDE.md`: ela aponta a nota de cada caminho e as armadilhas (⚠️) de cada área.

## 2. Ler antes de escrever

Abra a nota (ou a seção) que vai mudar. Mudança que contradiz o que está escrito precisa
**corrigir** o trecho antigo, não só acrescentar um parágrafo novo embaixo — senão a nota passa
a afirmar as duas coisas. Quando a regra antiga tiver valor histórico, marque-a como
superada e aponte a nova ("desde DD/MM …").

## 3. Onde escrever

| O que é | Pasta | Exemplo |
| --- | --- | --- |
| Conceito estável do negócio ou do stack | `Conceitos/Domínio`, `Conceitos/Stack` | o que é um pedido, como funciona a sessão |
| Como o código faz | `Módulos/` | `Módulos/Autenticação.md` |
| Procedimento | `Operação/` | deploy, migration, criar usuário |
| **Por que** a escolha foi feita | `Decisões/` — nota nova datada `Título DD-MM.md` | `Decisões/Autenticação própria 14-10.md` |
| Comportamento de serviço externo | `Integrações e APIs/` — **com a data da medição/consulta** | `Banco de dados.md`, `Hospedagem.md` |
| Fio de uma sessão | `Sessões/` | memória de cada chat |

Frontmatter (copie o formato da nota vizinha):

```yaml
---
tipo: nota            # nota | decisao | moc | sessão | conceito
modulo: pedidos       # quando houver
data: 2026-10-15      # só em decisao
cobre: [src/lib/x.ts, src/app/api/y]   # caminhos que a nota documenta — arquivo OU pasta
atualizado: 2026-10-15
---
```

- **`atualizado:`** = hoje, em toda nota que você conferiu contra o código. Só mude a data
  depois de conferir de verdade: data nova em nota não conferida esconde o atraso da auditoria.
- **`cobre:`** ganha todo arquivo novo que a nota passa a documentar; arquivo apagado ou
  renomeado sai (a auditoria lista os que sumiram).
- **Nota nova precisa de link de entrada** — de `Home.md`, do MOC do módulo ou do
  `Glossário.md`. Sem isso ela vira órfã e ninguém a acha.
- Link para seção usa o **título exato**: `[[Autenticação#Sessões]]`.

## 4. Como escrever (o que vale a pena registrar)

A armadilha vale mais que o caminho feliz. Para cada mudança, registre:

- **o que quebrou ou enganou**, com o caso real (identificador do registro, data) e o **número medido**;
- **o falso positivo evitado** e por que a regra é do tamanho que é;
- **datas absolutas** (nunca "ontem", "semana passada");
- a regra que é **ÚNICA** (o nome da função que todo mundo deve chamar), para ninguém copiar a
  expressão.

Use os callouts do Obsidian: `> [!danger]` para armadilha, `> [!important]` para regra,
`> [!note]` para registro/medição. Frases curtas, nada de "refatorado X": escreva o efeito.

Não registre: segredo (token, chave, senha — vivem só no `.env.local` e no painel da hospedagem;
`Operação/Ambiente e segredos.md` lista os NOMES, nunca os valores), dado pessoal de cliente
(nome completo, CPF/CNPJ, telefone, endereço, e-mail — use um identificador interno) e não mexa
em `.obsidian/` (configuração do app).

## 4b. A cópia das IAs no vault (`IA do projeto/`)

Os `.md` das IAs do projeto ficam COPIADOS no vault para também servir como base. Ao fim da
tarefa, sempre:

```bash
node .claude/skills/atualizar-obsidian/scripts/sincronizar-ias.mjs
```

Ele copia `CLAUDE.md`, as skills PRÓPRIAS (`skillsProprias` na config) e as memórias do Claude
para `IA do projeto/`, refaz o índice (com as skills de TERCEIROS só como lista) e — fora do
vault, se `gerarAgentsMd` estiver ligado — **regenera o `AGENTS.md` (Codex) a partir do
`CLAUDE.md`** e copia as skills de `espelharNoCodex` para `.agents/skills`. Só escreve o que
mudou; segredo vira "[segredo removido]".

- Mudou o `CLAUDE.md`, uma skill própria ou uma memória? Rode o script — a auditoria acusa a cópia
  fora de sincronia.
- **Nunca edite** nada em `IA do projeto/` nem o `AGENTS.md`: a próxima sincronia desfaz. Edite o
  original.
- Skill nova escrita para o projeto ⇒ entra em `skillsProprias` no `obsidian-skill.config.json`.

## 5. O CLAUDE.md também é do vault

- Arquivo ou área nova com armadilha importante ⇒ linha (ou ⚠️ a mais) na tabela de roteamento,
  no mesmo estilo curto das outras.
- Nota criada ou apagada ⇒ ajuste o **"Mapa do vault"** e o **"Total: N notas (contagem
  conferida em DD/MM/AAAA)"** com os números da auditoria.
- Regra de trabalho nova que o usuário pediu ⇒ entra em "Regras de trabalho".

## 6. Conferir e contar ao usuário

1. Rode a auditoria de novo: nenhum link quebrado novo, nenhuma órfã nova, contagem batendo.
2. No resumo final para o usuário, uma linha por nota: o que mudou nela
   (ex.: "`Módulos/Autenticação.md` — nova seção do 2FA").

## Atualização completa do vault

Quando o pedido for "atualizar tudo" (ou a auditoria mostrar muitas notas atrasadas):

1. `--detalhe` para ver os commits depois do `atualizado:` de cada nota.
2. Triagem por nota: commit que só muda estilo, import ou nome interno não altera o que a nota
   afirma — confira o trecho e só atualize a data. Commit que muda regra, rota, tabela, prazo,
   texto ao cliente ou integração ⇒ reescreva o trecho.
3. Corrija links quebrados (aponte para o título que existe hoje), `cobre:` com caminho sumido
   e órfãs (ligue-as a um MOC ou à Home).
4. Atualize a contagem no `CLAUDE.md`.
5. Comece pelas notas de módulo e integração (as mais lidas antes de codar); `Decisões/` são
   registros datados — corrija links e caminhos, mas não reescreva a história: acrescente
   "superada em DD/MM por [[…]]" quando a decisão caiu.

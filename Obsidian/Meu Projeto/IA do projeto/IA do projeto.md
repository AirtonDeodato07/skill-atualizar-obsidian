---
tipo: moc
cobre: [CLAUDE.md, AGENTS.md, .claude/skills, .agents/skills, .interface-design/system.md, skills-lock.json]
atualizado: 2026-11-04
---

# IA do projeto

Cópia dos `.md` das IAs do projeto dentro do vault, para servirem também como base. Aqui estão as **instruções**, as
**skills próprias** e as **memórias** das IAs que trabalham neste projeto — o Claude Code
(`CLAUDE.md`, `.claude/skills`) e o Codex (`AGENTS.md`, `.agents/skills`).

> [!warning] Tudo nesta pasta é CÓPIA — o original manda
> `sincronizar-ias.mjs` (skill `atualizar-obsidian`) refaz as cópias a partir dos originais e
> esta nota junto. Editar aqui não adianta: a próxima sincronia desfaz. O `AGENTS.md` da raiz é
> **gerado** do `CLAUDE.md`, e as skills próprias do Claude são copiadas para `.agents/skills` —
> as duas IAs seguem as mesmas regras. Ver [[Manter o vault em dia]].

## Instruções

| Nota | O que é |
| --- | --- |
| [[CLAUDE]] | o que o Claude Code lê em toda conversa: regras de trabalho e roteamento |
| [[AGENTS]] | o que o Codex lê — gerado do `CLAUDE.md` |

## Skills do projeto

| Skill | Para quê | Codex |
| --- | --- | --- |
| [[Skill atualizar-obsidian]] | OBRIGATÓRIA neste projeto — mantém a memória VIVA do chat (Sessões/Memória de chat DD-MM.md, criada no começo e atualizada a cada etapa da conversa) e atualiza o vault Obsidian do projeto (caminho em obsidian-skill.conf… | igual |

Os scripts das skills (`.mjs`) não são `.md` e ficam só no original — ex.:
`.claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs` e este `sincronizar-ias.mjs`.

## Memórias do Claude (0)

Nenhuma memória salva ainda. Cada memória é um fato com o porquê; as notas
do vault continuam sendo a fonte do detalhe técnico.



## Skills de terceiros — só o índice (0)

Instaladas de fora do projeto (copiadas à mão ou por plugin).
O conteúdo NÃO vem para o vault — é documentação genérica que misturaria a busca e o grafo com
assunto que não é do sistema. O texto está no caminho indicado.

| Skill | Descrição | Origem | Onde | Arquivos |
| --- | --- | --- | --- | --- |


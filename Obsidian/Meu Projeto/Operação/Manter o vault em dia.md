---
tipo: nota
cobre: [.claude/skills/atualizar-obsidian, obsidian-skill.config.json, CLAUDE.md]
atualizado: 2026-11-04
---

# Manter o vault em dia

A skill `atualizar-obsidian` faz a IA consultar o vault antes de agir e atualizá-lo ao terminar.
Volte para a [[Home]].

## O ciclo

1. **Consultar** — a IA lê a nota que o `CLAUDE.md` aponta para o caminho que vai mexer.
2. **Memória do chat** — cria `Sessões/Memória de chat DD-MM.md` e atualiza a cada etapa.
3. **Auditar** — `node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs --mudados`.
4. **Escrever** — corrige o trecho antigo (não só acrescenta), atualiza `atualizado:` e `cobre:`.
5. **Sincronizar** — `node .claude/skills/atualizar-obsidian/scripts/sincronizar-ias.mjs`.
6. **Conferir** — auditoria de novo: sem link quebrado, sem órfã, contagem batendo.

## O frontmatter

```yaml
---
tipo: nota
cobre: [src/lib/x.ts, src/app/api/y]
atualizado: 2026-11-04
---
```

> [!important] `atualizado:` só muda depois de conferir a nota contra o código
> Data nova em nota não conferida esconde o atraso da auditoria.

## O que a auditoria acusa

| Seção | Quer dizer |
| --- | --- |
| Notas atrasadas | um caminho do `cobre:` mudou depois do `atualizado:` |
| Código sem nota | arquivo mexido que nenhum `cobre:` cobre |
| Caminhos que sumiram | o `cobre:` aponta para arquivo apagado ou renomeado |
| Links quebrados | `[[Nota]]` ou `[[Nota#Seção]]` que não existe |
| Órfãs | nota sem link de entrada |
| Cópias fora de sincronia | rode `sincronizar-ias.mjs` |
| Caracteres de controle | texto corrompido por escape (ex.: `\b` virou backspace) |

---
tipo: cópia-ia
origem: "CLAUDE.md"
sincronizado: 2026-11-04
---

> [!warning] Cópia gerada — não edite aqui
> Original: `CLAUDE.md`. Refeita por `sincronizar-ias.mjs` (skill `atualizar-obsidian`);
> mudança feita aqui some na próxima sincronia. Índice: [[IA do projeto]].

# Meu Projeto — instruções para as IAs

<!-- MODELO: troque "Meu Projeto" e preencha as seções. Mantenha este arquivo CURTO: ele só roteia. -->

Uma ou duas frases sobre o sistema: o que faz, para quem, onde roda em produção.

O conhecimento mora no vault **`Obsidian/Meu Projeto/`** — este arquivo só roteia.
Comece pela [[Home]] do vault (`Obsidian/Meu Projeto/Home.md`).

## Regras de trabalho

1. **Consulte o vault antes de agir** (skill `atualizar-obsidian`): leia a nota que a tabela abaixo aponta.
2. **Atualize o vault ao terminar** qualquer tarefa que mude código, regra, banco, deploy ou que descubra
   algo — e mantenha a memória do chat em `Sessões/Memória de chat DD-MM.md` a cada etapa.
3. **Nunca** grave segredo (chave, senha, token, URL do banco) em nota, commit ou mensagem. Os nomes das
   variáveis estão em `Operação/Ambiente e segredos.md`; os valores só no `.env.local` e no painel da hospedagem.
4. **Dado pessoal de cliente** (nome completo, CPF, telefone, endereço) não vai para o vault nem para testes.
5. Commit e deploy só quando o usuário pedir.

## Roteamento — mexeu aqui, leia isto ANTES

| Caminho | Nota | ⚠️ Armadilhas |
| --- | --- | --- |
| `src/lib/exemplo/` | `Módulos/Modelo - Módulo` | ⚠️ escreva aqui, em uma linha, a armadilha que mais custou caro |

## Mapa do vault

- `Home.md`, `Glossário.md` — entrada
- `Conceitos/` — o que é cada coisa
- `Módulos/` — como o código faz
- `Operação/` — procedimentos (deploy, migration, usuários, testes, segredos)
- `Decisões/` — por que (notas datadas)
- `Integrações e APIs/` — serviços externos
- `Sessões/` — memória de cada chat
- `IA do projeto/` — cópia gerada deste arquivo e das skills (não editar)

Total: **7 notas** (contagem conferida em 04/11/2026).

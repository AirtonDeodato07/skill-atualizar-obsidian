#!/usr/bin/env node
/**
 * Cópia dos .md das IAs do projeto DENTRO do vault, para servirem também como base de consulta.
 *
 *   node .claude/skills/atualizar-obsidian/scripts/sincronizar-ias.mjs             # sincroniza
 *   node .claude/skills/atualizar-obsidian/scripts/sincronizar-ias.mjs --conferir  # só diz o que mudaria
 *
 * Mão ÚNICA: o original manda, a cópia é refeita. Editar a cópia no Obsidian não adianta — a
 * próxima sincronia desfaz. O que entra:
 *  - `CLAUDE.md` → `<pastaIA>/Instruções/CLAUDE.md`, e (opcional) o `AGENTS.md` regenerado dele;
 *  - `.interface-design/system.md`, se existir;
 *  - as skills PRÓPRIAS (todo .md da pasta) — a versão do Codex só se for diferente;
 *  - as memórias do Claude deste projeto (`~/.claude/projects/<projeto>/memory/*.md`);
 *  - as skills de TERCEIROS só como índice, na nota-índice.
 * E fora do vault: as skills de `espelharNoCodex` são copiadas para `.agents/skills` (o Codex lê
 * de lá) e o `AGENTS.md` da raiz é reescrito — as duas IAs seguem as mesmas regras.
 *
 * Nada de segredo vai para o vault: o que parece token é trocado por "[segredo removido]".
 * Só escreve o que MUDOU (a data da sincronia não conta como mudança).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { CONFIG, RAIZ, VAULT } from "./config.mjs";

const PASTA = CONFIG.pastaIA;
/**
 * O Claude Code guarda a memória pelo CAMINHO do projeto: cada caractere fora de [A-Za-z0-9] vira "-".
 * Calcular daqui é o que deixa o script certo em qualquer pasta ou máquina.
 */
const PROJETO_CLAUDE = RAIZ.replace(/[^A-Za-z0-9]/g, "-");
const MEMORIA = join(homedir(), ".claude", "projects", PROJETO_CLAUDE, "memory");
/** Skills escritas PARA este projeto. O resto de `.claude/skills` e `.agents/skills` é de terceiros. */
const PROPRIAS = CONFIG.skillsProprias;
/** Estas o Claude criou e o Codex precisa ter igual. */
const ESPELHAR_NO_CODEX = CONFIG.espelharNoCodex;
const AVISO_AGENTS =
  "<!-- GERADO a partir do CLAUDE.md por .claude/skills/atualizar-obsidian/scripts/sincronizar-ias.mjs — edite o CLAUDE.md, não este arquivo. -->\n";

const posix = (p) => p.split(sep).join("/");
const hoje = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const ler = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function arquivos(dir, filtro = () => true) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...arquivos(p, filtro));
    else if (filtro(p)) out.push(p);
  }
  return out;
}

/**
 * Valores REAIS das variáveis sensíveis do `.env.local` (pelo NOME: client id,
 * segredo, token, chave, senha, certificado, URL de banco). O formato sozinho não
 * basta: um `client_id` que é um UUID comum nenhum padrão reconhece — e ele iria
 * para o GitHub dentro da cópia de uma memória do Claude.
 */
function valoresSensiveis(arquivo = join(RAIZ, CONFIG.arquivoEnv)) {
  if (!existsSync(arquivo)) return [];
  const nomeSensivel = /(CLIENT_ID|SECRET|TOKEN|_KEY|KEY_|SENHA|PASSWORD|PASS\b|CERT|PEM|DB_URL|ACCESS|PRIVATE)/i;
  const valores = [];
  for (const linha of readFileSync(arquivo, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = linha.match(/^﻿?([A-Z0-9_]+)=(.*)$/);
    if (!m || !nomeSensivel.test(m[1]) || m[1].startsWith("NEXT_PUBLIC_")) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (v.length >= 8 && !/^(true|false|\d+)$/i.test(v)) valores.push(v);
  }
  // O mais longo primeiro: um valor que contém outro não fica pela metade.
  return valores.sort((a, b) => b.length - a.length);
}
const SENSIVEIS = valoresSensiveis();

/** O que parece credencial sai da cópia — o vault é lido por gente e por IA. */
export function redigir(texto, valores = SENSIVEIS) {
  let t = texto
    .replace(/\bsbp_[A-Za-z0-9]{12,}/g, "[segredo removido]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[segredo removido]")
    .replace(/\bsk-[A-Za-z0-9_-]{20,}/g, "[segredo removido]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[segredo removido]");
  for (const v of valores) t = t.split(v).join("[segredo removido]");
  return t;
}

function separarFrontmatter(texto) {
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?/);
  return m ? { fm: m[1], corpo: texto.slice(m[0].length) } : { fm: "", corpo: texto };
}

function campoDoFrontmatter(fm, campo) {
  const m = fm.match(new RegExp(`^${campo}:\\s*(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function copia(origemRel, texto) {
  const { fm, corpo } = separarFrontmatter(texto);
  return (
    `---\ntipo: cópia-ia\norigem: "${origemRel}"\nsincronizado: ${hoje}\n---\n\n` +
    `> [!warning] Cópia gerada — não edite aqui\n` +
    `> Original: \`${origemRel}\`. Refeita por \`sincronizar-ias.mjs\` (skill \`atualizar-obsidian\`);\n` +
    `> mudança feita aqui some na próxima sincronia. Índice: [[${PASTA}]].\n\n` +
    (fm ? "```yaml\n" + fm + "\n```\n\n" : "") +
    redigir(corpo).replace(/^\n+/, "")
  );
}

/** Igual a menos da data — sincronizar todo dia sem mudança não pode reescrever nada. */
const semData = (t) => t.replace(/^(sincronizado|atualizado): .*$/gm, "");

function notasDoVaultForaDaPasta() {
  return new Set(
    arquivos(VAULT, (p) => p.endsWith(".md"))
      .map((p) => posix(relative(VAULT, p)))
      .filter((r) => !r.startsWith(PASTA + "/") && !r.startsWith("."))
      .map((r) => r.split("/").pop().replace(/\.md$/, "").toLowerCase())
  );
}

/** Tudo o que a sincronia escreveria: [{ destino (absoluto), conteudo, rotulo }]. */
export function planejar() {
  const plano = [];
  const ocupados = notasDoVaultForaDaPasta();
  const nomeLivre = (nome) => (ocupados.has(nome.toLowerCase()) ? `IA - ${nome}` : nome);
  const noVault = (sub, nome) => join(VAULT, PASTA, sub, `${nomeLivre(nome)}.md`);
  const avisos = [];

  // 1. Instruções — o AGENTS.md vem do CLAUDE.md
  const claude = ler(join(RAIZ, "CLAUDE.md"));
  const agents =
    AVISO_AGENTS +
    claude.replace(
      /^(# .+\n)/,
      "$1\n> **Este é o `AGENTS.md` do Codex: cópia gerada do `CLAUDE.md`** (mesmas regras para as duas IAs).\n" +
        "> As skills citadas estão em `.agents/skills/` (cópia de `.claude/skills/`).\n"
    );
  plano.push({ destino: noVault("Instruções", "CLAUDE"), conteudo: copia("CLAUDE.md", claude), rotulo: "CLAUDE" });
  if (CONFIG.gerarAgentsMd) {
    plano.push({ destino: join(RAIZ, "AGENTS.md"), conteudo: agents, rotulo: "AGENTS.md (raiz, para o Codex)" });
    plano.push({ destino: noVault("Instruções", "AGENTS"), conteudo: copia("AGENTS.md", agents), rotulo: "AGENTS" });
  }
  const sistema = join(RAIZ, ".interface-design", "system.md");
  if (existsSync(sistema)) {
    plano.push({
      destino: noVault("Instruções", "interface-design system"),
      conteudo: copia(".interface-design/system.md", ler(sistema)),
      rotulo: "interface-design system",
    });
  }

  // 2. Skills próprias (o Codex recebe as do Claude; a versão dele só vira cópia se diferir)
  const skills = [];
  for (const nome of PROPRIAS) {
    const dirClaude = join(RAIZ, ".claude", "skills", nome);
    const dirCodex = join(RAIZ, ".agents", "skills", nome);
    if (!existsSync(dirClaude) && !existsSync(dirCodex)) continue;
    const base = existsSync(dirClaude) ? dirClaude : dirCodex;
    for (const arq of arquivos(base)) {
      const rel = posix(relative(base, arq));
      if (ESPELHAR_NO_CODEX.includes(nome) && base === dirClaude) {
        plano.push({
          destino: join(dirCodex, ...rel.split("/")),
          conteudo: readFileSync(arq),
          rotulo: `.agents/skills/${nome}/${rel}`,
          binario: true,
        });
      }
      if (!rel.endsWith(".md")) continue;
      const titulo = rel === "SKILL.md" ? `Skill ${nome}` : `Skill ${nome} — ${rel.replace(/\.md$/, "").replace(/\//g, " · ")}`;
      plano.push({
        destino: noVault("Skills", titulo),
        conteudo: copia(posix(relative(RAIZ, arq)), ler(arq)),
        rotulo: titulo,
      });
    }
    const fm = separarFrontmatter(ler(join(base, "SKILL.md"))).fm;
    let codexDifere = false;
    if (base === dirClaude && existsSync(join(dirCodex, "SKILL.md")) && !ESPELHAR_NO_CODEX.includes(nome)) {
      const a = ler(join(dirClaude, "SKILL.md"));
      const b = ler(join(dirCodex, "SKILL.md"));
      if (a !== b) {
        codexDifere = true;
        plano.push({
          destino: noVault("Skills", `Skill ${nome} (Codex)`),
          conteudo: copia(`.agents/skills/${nome}/SKILL.md`, b),
          rotulo: `Skill ${nome} (Codex)`,
        });
      }
    }
    skills.push({ nome, descricao: campoDoFrontmatter(fm, "description"), codex: existsSync(dirCodex) || ESPELHAR_NO_CODEX.includes(nome), codexDifere });
  }

  // 3. Memórias do Claude deste projeto
  //
  // A pasta só existe na máquina do usuário (o caminho dela sai do diretório aberto). Na nuvem,
  // ou em outro computador, ela NÃO existe — e "não achei a origem" não é "a origem foi apagada".
  // Sem a pasta, as cópias e a seção do índice ficam como estão (senão seriam apagadas como órfãs).
  const memorias = [];
  const preservar = [];
  let secaoMemoriasAtual = null;
  if (existsSync(MEMORIA)) {
    for (const arq of arquivos(MEMORIA, (p) => p.endsWith(".md"))) {
      const nome = arq.split(sep).pop().replace(/\.md$/, "");
      const texto = ler(arq);
      plano.push({
        destino: noVault("Memórias do Claude", nome),
        conteudo: copia(`~/.claude/projects/${PROJETO_CLAUDE}/memory/${nome}.md`, texto),
        rotulo: `memória ${nome}`,
      });
      const fm = separarFrontmatter(texto).fm;
      memorias.push({ nome: nomeLivre(nome), descricao: campoDoFrontmatter(fm, "description") });
    }
  } else {
    preservar.push(join(VAULT, PASTA, "Memórias do Claude"));
    const indiceAtual = join(VAULT, PASTA, `${PASTA}.md`);
    if (existsSync(indiceAtual))
      secaoMemoriasAtual = ler(indiceAtual).match(/^## Memórias do Claude \(\d+\)\n[\s\S]*?(?=^## )/m)?.[0] ?? null;
    avisos.push(
      `pasta de memórias não encontrada (${MEMORIA}) — memórias não sincronizadas; as cópias que já estão no vault foram MANTIDAS`
    );
  }

  // 4. Índice das skills de terceiros + a nota-índice
  const lock = existsSync(join(RAIZ, "skills-lock.json")) ? JSON.parse(ler(join(RAIZ, "skills-lock.json"))).skills ?? {} : {};
  const terceiros = new Map();
  for (const [onde, rotulo] of [[join(RAIZ, ".claude", "skills"), "Claude"], [join(RAIZ, ".agents", "skills"), "Codex"]]) {
    if (!existsSync(onde)) continue;
    for (const nome of readdirSync(onde)) {
      if (PROPRIAS.includes(nome) || !existsSync(join(onde, nome, "SKILL.md"))) continue;
      const t = terceiros.get(nome) ?? { nome, onde: [], descricao: "", textos: [], arquivos: 0 };
      t.onde.push(rotulo);
      const texto = ler(join(onde, nome, "SKILL.md"));
      t.textos.push(texto);
      t.descricao ||= campoDoFrontmatter(separarFrontmatter(texto).fm, "description");
      t.arquivos = Math.max(t.arquivos, arquivos(join(onde, nome)).length);
      terceiros.set(nome, t);
    }
  }
  const curto = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s).replace(/\|/g, "\\|");
  const linhaTerceiro = (t) =>
    `| \`${t.nome}\` | ${curto(t.descricao || "—", 160)} | ${lock[t.nome]?.source ?? "instalada à mão"} | ${t.onde.join(" + ")}${t.textos.length > 1 && t.textos[0] !== t.textos[1] ? " (versões DIFERENTES)" : ""} | ${t.arquivos} |`;
  const indice = `---
tipo: moc
cobre: [CLAUDE.md, AGENTS.md, .claude/skills, .agents/skills, .interface-design/system.md, skills-lock.json]
atualizado: ${hoje}
---

# ${PASTA}

Cópia dos \`.md\` das IAs do projeto dentro do vault, para servirem também como base. Aqui estão as **instruções**, as
**skills próprias** e as **memórias** das IAs que trabalham neste projeto — o Claude Code
(\`CLAUDE.md\`, \`.claude/skills\`) e o Codex (\`AGENTS.md\`, \`.agents/skills\`).

> [!warning] Tudo nesta pasta é CÓPIA — o original manda
> \`sincronizar-ias.mjs\` (skill \`atualizar-obsidian\`) refaz as cópias a partir dos originais e
> esta nota junto. Editar aqui não adianta: a próxima sincronia desfaz. O \`AGENTS.md\` da raiz é
> **gerado** do \`CLAUDE.md\`, e as skills próprias do Claude são copiadas para \`.agents/skills\` —
> as duas IAs seguem as mesmas regras. Ver [[Manter o vault em dia]].

## Instruções

| Nota | O que é |
| --- | --- |
| [[${nomeLivre("CLAUDE")}]] | o que o Claude Code lê em toda conversa: regras de trabalho e roteamento |
${CONFIG.gerarAgentsMd ? `| [[${nomeLivre("AGENTS")}]] | o que o Codex lê — gerado do \`CLAUDE.md\` |\n` : ""}${existsSync(sistema) ? `| [[${nomeLivre("interface-design system")}]] | a memória de design da skill \`interface-design\` (\`.interface-design/system.md\`) |\n` : ""}
## Skills do projeto

| Skill | Para quê | Codex |
| --- | --- | --- |
${skills
  .map(
    (s) =>
      `| [[${nomeLivre(`Skill ${s.nome}`)}]] | ${curto(s.descricao || "—", 220)} | ${s.codex ? (s.codexDifere ? `versão diferente: [[${nomeLivre(`Skill ${s.nome} (Codex)`)}]]` : "igual") : "não tem"} |`
  )
  .join("\n")}

Os scripts das skills (\`.mjs\`) não são \`.md\` e ficam só no original — ex.:
\`.claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs\` e este \`sincronizar-ias.mjs\`.

${
  secaoMemoriasAtual ??
  `## Memórias do Claude (${memorias.length})

${memorias.some((m) => m.nome === nomeLivre("MEMORY")) ? `O índice é [[${nomeLivre("MEMORY")}]]. ` : "Nenhuma memória salva ainda. "}Cada memória é um fato com o porquê; as notas
do vault continuam sendo a fonte do detalhe técnico.

${memorias
  .filter((m) => m.nome !== nomeLivre("MEMORY"))
  .map((m) => `- [[${m.nome}]] — ${curto(m.descricao || "", 180)}`)
  .join("\n")}

`
}## Skills de terceiros — só o índice (${terceiros.size})

Instaladas de fora do projeto (copiadas à mão ou por plugin).
O conteúdo NÃO vem para o vault — é documentação genérica que misturaria a busca e o grafo com
assunto que não é do sistema. O texto está no caminho indicado.

| Skill | Descrição | Origem | Onde | Arquivos |
| --- | --- | --- | --- | --- |
${[...terceiros.values()].sort((a, b) => a.nome.localeCompare(b.nome)).map(linhaTerceiro).join("\n")}
`;
  plano.push({ destino: join(VAULT, PASTA, `${PASTA}.md`), conteudo: indice, rotulo: `${PASTA} (índice)` });
  return { plano, avisos, preservar };
}

/**
 * O que está diferente do plano (e cópias órfãs, cujo original sumiu).
 * `preservar`: pastas cuja ORIGEM não está nesta máquina — nada ali é órfão, nada se apaga.
 */
export function diferencas(plano, preservar = []) {
  const mudar = [];
  for (const item of plano) {
    if (!existsSync(item.destino)) {
      mudar.push({ ...item, acao: "criar" });
      continue;
    }
    if (item.binario) {
      if (!readFileSync(item.destino).equals(item.conteudo)) mudar.push({ ...item, acao: "atualizar" });
    } else if (semData(ler(item.destino)) !== semData(item.conteudo)) mudar.push({ ...item, acao: "atualizar" });
  }
  const destinos = new Set(plano.map((i) => i.destino));
  for (const arq of arquivos(join(VAULT, PASTA), (p) => p.endsWith(".md"))) {
    if (destinos.has(arq)) continue;
    if (preservar.some((dir) => arq.startsWith(dir + sep))) continue;
    if (/^tipo: cópia-ia$/m.test(ler(arq).slice(0, 200))) mudar.push({ destino: arq, rotulo: posix(relative(VAULT, arq)), acao: "apagar" });
  }
  return mudar;
}

function aplicar(mudar) {
  for (const m of mudar) {
    if (m.acao === "apagar") {
      rmSync(m.destino);
      continue;
    }
    mkdirSync(dirname(m.destino), { recursive: true });
    writeFileSync(m.destino, m.conteudo);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const conferir = process.argv.includes("--conferir");
  const { plano, avisos, preservar } = planejar();
  const mudar = diferencas(plano, preservar);
  for (const a of avisos) console.warn("aviso:", a);
  if (mudar.length === 0) {
    console.log(`cópias das IAs em dia (${plano.length} itens conferidos)`);
    process.exit(0);
  }
  for (const m of mudar) console.log(`${conferir ? "mudaria" : "ok"}  ${m.acao.padEnd(9)} ${m.rotulo}`);
  if (conferir) {
    console.log(`${mudar.length} item(ns) fora de sincronia — rode sem --conferir`);
    process.exit(1);
  }
  aplicar(mudar);
  console.log(`${mudar.length} item(ns) sincronizado(s) de ${plano.length}`);
}

#!/usr/bin/env node
/**
 * Auditoria do vault Obsidian contra o código (caminho em `obsidian-skill.config.json`).
 *
 *   node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs            # tudo
 *   node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs --mudados  # só o que a working tree mexeu
 *   node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs --detalhe  # + commits que atrasaram cada nota
 *   node .claude/skills/atualizar-obsidian/scripts/auditar-vault.mjs --json
 *
 * O que ela responde:
 *  1. NOTA ATRASADA — algum caminho do `cobre:` mudou (commit ou working tree)
 *     DEPOIS do `atualizado:` da nota;
 *  2. CAMINHO SUMIU — o `cobre:` aponta para arquivo/pasta que não existe mais;
 *  3. SEM NOTA — arquivo de código mexido na working tree que nenhum `cobre:` cobre;
 *  4. LINK QUEBRADO — `[[Nota]]` sem nota com esse nome (e `#seção` sem título);
 *  5. ÓRFÃ — nota sem nenhum link de entrada (a Home não conta);
 *  6. CONTAGEM — notas por pasta e total, para conferir com o CLAUDE.md.
 *
 * Só LÊ. Não escreve nada no vault nem no repositório.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CODIGO, CONFIG, RAIZ, VAULT } from "./config.mjs";

const SO_MUDADOS = process.argv.includes("--mudados");
const JSON_SAIDA = process.argv.includes("--json");
const DETALHE = process.argv.includes("--detalhe");

if (!existsSync(VAULT)) {
  console.error(`vault não encontrado em ${VAULT} — rode da raiz do repositório`);
  process.exit(1);
}

const git = (args) =>
  execFileSync("git", ["-c", "core.quotepath=off", ...args], { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
const posix = (p) => p.split(sep).join("/");
const hojeLocal = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ---------------------------------------------------------------- notas
function listarNotas(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listarNotas(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function frontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  const linhas = m[1].split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].match(/^([\w-]+):\s*(.*)$/);
    if (!l) continue;
    const [, chave, valor] = l;
    if (valor.startsWith("[")) {
      // Lista em linha, que pode quebrar em várias linhas. Termina quando os
      // colchetes FECHAM — caminho como `api/extratos/[id]` também tem `]`
      const saldo = (t) => [...t].reduce((n, ch) => n + (ch === "[" ? 1 : ch === "]" ? -1 : 0), 0);
      let bruto = valor;
      while (saldo(bruto) > 0 && i + 1 < linhas.length) bruto += " " + linhas[++i].trim();
      fm[chave] = bruto.trim().slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else if (valor === "") {
      // lista em bloco: - a / - b
      const itens = [];
      while (i + 1 < linhas.length && /^\s*-\s+/.test(linhas[i + 1])) itens.push(linhas[++i].replace(/^\s*-\s+/, "").trim());
      fm[chave] = itens.length ? itens : "";
    } else fm[chave] = valor.replace(/^["']|["']$/g, "");
  }
  return fm;
}

const slug = (s) =>
  s.normalize("NFC").toLowerCase().replace(/[`*_~]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const notas = listarNotas(VAULT).map((arquivo) => {
  const texto = readFileSync(arquivo, "utf8");
  const rel = posix(relative(VAULT, arquivo));
  const nome = rel.split("/").pop().replace(/\.md$/, "");
  // Bloco de código e código em linha não são links: `[[código, d]]` é JS
  // (só o código em linha que CONTÉM `[[` — título com `código` dentro do link é link)
  const corpo = texto.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*\[\[[^`\n]*`/g, "");
  const titulos = new Set([...texto.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));
  // `[[Nota\|apelido]]` dentro de tabela: a barra invertida é do Markdown, não do nome
  const links = [...corpo.matchAll(/!?\[\[([^\]|#\n]+?)\\?(#[^\]|\n]+?)?\\?(\|[^\]\n]*)?\]\]/g)].map((m) => ({
    alvo: m[1].trim(),
    secao: m[2] ? m[2].slice(1).trim() : "",
  }));
  // Caractere de controle (fora tab/LF/CR): é texto que passou por string com
  // escape — `\b` de regex virando BACKSPACE, `C:\...\18\bin` virando \x01+\x08.
  // Invisível no Obsidian, por isso a auditoria procura.
  const controle = [...texto.matchAll(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g)].map((m) => texto.slice(0, m.index).split("\n").length);
  return { arquivo, rel, nome, fm: frontmatter(texto), titulos, links, controle };
});
const porNome = new Map(notas.map((n) => [n.nome.normalize("NFC").toLowerCase(), n]));
const achar = (alvo) => porNome.get(alvo.split("/").pop().replace(/\.md$/, "").normalize("NFC").toLowerCase());

/** `cobre:` também lista TABELA (`financeiro_setores`, `tabela.coluna`): isso não é arquivo. */
const ehCaminho = (c) => c.includes("/") || /^[\w.-]+\.(json|ts|tsx|js|mjs|mts|cjs|sql|md|ya?ml|toml|css)$/.test(c);

// ---------------------------------------------------------------- quando cada caminho mudou
/** caminho → data (AAAA-MM-DD) da última mudança CERTA: commit comum OU working tree. */
const mudouEm = new Map();
const marcar = (p, d) => {
  if (!mudouEm.has(p) || mudouEm.get(p) < d) mudouEm.set(p, d);
};
/**
 * Commit-SNAPSHOT (mais de `ARQUIVOS_SNAPSHOT` arquivos): a working tree ficou semanas sem commit
 * e entrou de uma vez (ex.: um commit com mais de mil arquivos acumulados). A data dele
 * NÃO é a da mudança: o arquivo mudou em algum dia entre o commit anterior (`desde`) e ele.
 * caminho → { data, desde } do snapshot mais recente que o tocou.
 */
const ARQUIVOS_SNAPSHOT = CONFIG.arquivosSnapshot;
const snapshotEm = new Map();
const commits = [];
/** Repositório recém-criado (sem nenhum commit): o `git log` falha — histórico vazio. */
const historico = (() => {
  try {
    return git(["log", `--since=${CONFIG.historicoDesde}`, "--name-only", "--format=@@%cs"]);
  } catch {
    return "";
  }
})();
for (const linha of historico.split(/\r?\n/)) {
  if (linha.startsWith("@@")) commits.push({ data: linha.slice(2), arquivos: [] });
  else if (linha.trim() && commits.length) commits[commits.length - 1].arquivos.push(linha.trim());
}
commits.forEach((c, i) => {
  if (c.arquivos.length > ARQUIVOS_SNAPSHOT) {
    const desde = commits[i + 1]?.data ?? "";
    for (const p of c.arquivos) if (!snapshotEm.has(p)) snapshotEm.set(p, { data: c.data, desde });
  } else for (const p of c.arquivos) marcar(p, c.data);
});
const naWorkingTree = [];
for (const linha of git(["status", "--porcelain=v1", "-uall"]).split(/\r?\n/)) {
  if (!linha.trim()) continue;
  const estado = linha.slice(0, 2);
  let p = linha.slice(3).trim();
  if (p.includes(" -> ")) p = p.split(" -> ")[1];
  p = p.replace(/^"|"$/g, "");
  if (p.startsWith(CONFIG.vault.split("/")[0] + "/")) continue;
  const abs = join(RAIZ, p);
  const d = existsSync(abs) ? hojeLocal(statSync(abs).mtime) : hojeLocal(new Date());
  marcar(p, d);
  naWorkingTree.push({ caminho: p, estado: estado.trim() || "?", data: d });
}

/** A última mudança de um caminho do `cobre:` (arquivo ou pasta). */
function ultimaMudanca(caminho) {
  const c = caminho.replace(/\/+$/, "");
  let melhor = "";
  let quem = "";
  for (const [p, d] of mudouEm) {
    if ((p === c || p.startsWith(c + "/")) && d > melhor) {
      melhor = d;
      quem = p;
    }
  }
  return { data: melhor, arquivo: quem };
}

/** O snapshot mais recente que tocou o caminho (arquivo ou pasta) — ou null. */
function snapshotDe(caminho) {
  const c = caminho.replace(/\/+$/, "");
  let melhor = null;
  for (const [p, s] of snapshotEm) {
    if ((p === c || p.startsWith(c + "/")) && (!melhor || s.data > melhor.data)) melhor = { ...s, arquivo: p };
  }
  return melhor;
}

// ---------------------------------------------------------------- 1 e 2: atrasadas e caminhos sumidos
const atrasadas = [];
/** Só um snapshot as acusa e ele pode ser de ANTES da nota: conferir, sem pressa. */
const incertas = new Map();
const sumidos = [];
const escopo = SO_MUDADOS ? new Set(naWorkingTree.map((w) => w.caminho)) : null;
/** Nota de SESSÃO é registro datado de uma conversa: não "atrasa" (só confere caminho sumido). */
const ehSessao = (n) => /^sess/i.test(String(n.fm.tipo ?? "")) || n.rel.startsWith("Sessões/");
/**
 * A pasta das IAs é CÓPIA gerada por `sincronizar-ias.mjs`: não atrasa (quem confere é
 * a seção "Cópias de IA fora de sincronia"), não conta no total de notas e o link que ela COPIOU
 * (ex.: o `[[link]]` de exemplo de uma skill) não é defeito do vault. O índice continua precisando
 * de link de entrada.
 */
const PASTA_IA = CONFIG.pastaIA + "/";
const INDICE_IA = PASTA_IA + CONFIG.pastaIA + ".md";
const ehCopiaIA = (n) => n.rel.startsWith(PASTA_IA);
for (const n of notas) {
  if (ehCopiaIA(n)) continue;
  const cobre = Array.isArray(n.fm.cobre) ? n.fm.cobre : [];
  const atualizado = String(n.fm.atualizado ?? "");
  for (const c of cobre.filter(ehCaminho)) {
    const limpo = c.replace(/\/+$/, "");
    if (!existsSync(join(RAIZ, limpo)) && !limpo.includes("*")) {
      sumidos.push({ nota: n.rel, caminho: c });
      continue;
    }
    if (ehSessao(n)) continue;
    if (escopo && ![...escopo].some((p) => p === limpo || p.startsWith(limpo + "/"))) continue;
    const u = ultimaMudanca(limpo);
    if (u.data && (!atualizado || u.data > atualizado)) {
      atrasadas.push({ nota: n.rel, atualizado: atualizado || "—", caminho: u.arquivo, mudou: u.data });
      continue;
    }
    const s = snapshotDe(limpo);
    if (!s || (atualizado && s.data <= atualizado)) continue;
    if (!atualizado || atualizado < s.desde) {
      // a nota é mais velha que o commit ANTERIOR ao snapshot: a mudança é certamente depois dela
      atrasadas.push({ nota: n.rel, atualizado: atualizado || "—", caminho: s.arquivo, mudou: `${s.desde}…${s.data} (snapshot)` });
    } else if (!incertas.has(n.rel)) {
      incertas.set(n.rel, { nota: n.rel, atualizado, caminho: s.arquivo, janela: `${s.desde}…${s.data}` });
    }
  }
}
for (const a of atrasadas) incertas.delete(a.nota);
// uma linha por nota: a mudança mais recente
const atrasadaPorNota = new Map();
for (const a of atrasadas) {
  const atual = atrasadaPorNota.get(a.nota);
  if (!atual || a.mudou > atual.mudou) atrasadaPorNota.set(a.nota, { ...a, outros: (atual?.outros ?? 0) + (atual ? 1 : 0) });
  else atual.outros++;
}

// ---------------------------------------------------------------- 3: código mexido sem nota
const coberturas = notas.flatMap((n) =>
  (Array.isArray(n.fm.cobre) ? n.fm.cobre : []).filter(ehCaminho).map((c) => c.replace(/\/+$/, ""))
);
const semNota = naWorkingTree
  .filter((w) => CODIGO.test(w.caminho))
  // Arquivo APAGADO (ainda não commitado) não tem o que documentar: pô-lo no
  // `cobre:` faria a seção "caminhos que não existem mais" acusá-lo. A decisão
  // que o apagou é que registra a saída.
  .filter((w) => existsSync(join(RAIZ, w.caminho)))
  .filter((w) => !coberturas.some((c) => w.caminho === c || w.caminho.startsWith(c + "/")))
  .map((w) => w.caminho);

// ---------------------------------------------------------------- 4 e 5: links
const quebrados = [];
const entradas = new Map(notas.map((n) => [n.rel, 0]));
for (const n of notas) {
  if (ehCopiaIA(n) && n.rel !== INDICE_IA) continue;
  for (const l of n.links) {
    if (/\.(png|jpe?g|gif|svg|pdf|canvas|base)$/i.test(l.alvo)) continue;
    const alvo = achar(l.alvo);
    if (!alvo) {
      quebrados.push({ nota: n.rel, link: `[[${l.alvo}${l.secao ? "#" + l.secao : ""}]]`, motivo: "nota não existe" });
      continue;
    }
    if (alvo.rel !== n.rel) entradas.set(alvo.rel, (entradas.get(alvo.rel) ?? 0) + 1);
    if (l.secao && !l.secao.startsWith("^") && !alvo.titulos.has(slug(l.secao))) {
      quebrados.push({ nota: n.rel, link: `[[${l.alvo}#${l.secao}]]`, motivo: "seção não existe" });
    }
  }
}
const orfas = [...entradas]
  .filter(([rel, qtd]) => qtd === 0 && rel !== "Home.md" && (!rel.startsWith(PASTA_IA) || rel === INDICE_IA))
  .map(([rel]) => rel);

// ---------------------------------------------------------------- 5b: cópias das IAs
let foraDeSincronia = [];
try {
  const { planejar, diferencas } = await import("./sincronizar-ias.mjs");
  // `preservar`: sem a pasta de memórias (nuvem, outra máquina) as cópias NÃO são órfãs —
  // sem isto a auditoria mandaria "apagar" todas as memórias copiadas.
  const { plano, preservar } = planejar();
  foraDeSincronia = diferencas(plano, preservar).map((m) => `${m.acao} ${m.rotulo}`);
} catch (err) {
  foraDeSincronia = [`não deu para conferir: ${err instanceof Error ? err.message : String(err)}`];
}

// ---------------------------------------------------------------- 6: contagem
const porPasta = {};
const copiasIA = notas.filter(ehCopiaIA).length;
for (const n of notas) {
  if (ehCopiaIA(n)) continue;
  const partes = n.rel.split("/");
  const pasta = partes.length > 1 ? partes.slice(0, -1).join("/") : "(raiz)";
  porPasta[pasta] = (porPasta[pasta] ?? 0) + 1;
}
const claudeMd = existsSync(join(RAIZ, "CLAUDE.md")) ? readFileSync(join(RAIZ, "CLAUDE.md"), "utf8") : "";
const totalDeclarado = Number((claudeMd.match(/Total:\s*\*\*(\d+)\s*notas\*\*/) ?? [])[1] ?? NaN);

// ---------------------------------------------------------------- saída
const resultado = {
  modo: SO_MUDADOS ? "mudados" : "completo",
  atrasadas: [...atrasadaPorNota.values()].sort((a, b) => b.mudou.localeCompare(a.mudou)),
  incertas: [...incertas.values()],
  caminhosSumidos: sumidos,
  semNota,
  linksQuebrados: quebrados,
  orfas,
  foraDeSincronia,
  caracteresDeControle: notas.filter((n) => n.controle.length).map((n) => ({ nota: n.rel, linhas: [...new Set(n.controle)] })),
  contagem: { total: notas.length - copiasIA, copiasIA, totalNoClaudeMd: Number.isFinite(totalDeclarado) ? totalDeclarado : null, porPasta },
};

if (JSON_SAIDA) {
  console.log(JSON.stringify(resultado, null, 2));
  process.exit(0);
}

const secao = (titulo, itens, linha) => {
  console.log(`\n## ${titulo} (${itens.length})`);
  if (itens.length === 0) console.log("   nada");
  for (const i of itens) console.log("   " + linha(i));
};
console.log(`# Auditoria do vault — modo ${resultado.modo}`);
secao("Notas atrasadas (código mudou depois do `atualizado:`)", resultado.atrasadas, (a) =>
  `${a.nota} — atualizado ${a.atualizado}; ${a.caminho} mudou ${a.mudou}${a.outros ? ` (+${a.outros} caminho(s))` : ""}`
);
if (DETALHE) {
  // O que mudou em cada nota atrasada: os commits depois do `atualizado:` e o
  // que está só na working tree — é por aqui que se decide o que reescrever
  for (const a of resultado.atrasadas) {
    const n = notas.find((x) => x.rel === a.nota);
    const caminhos = (n.fm.cobre ?? []).filter(ehCaminho).map((c) => c.replace(/\/+$/, "")).filter((c) => existsSync(join(RAIZ, c)));
    console.log(`\n### ${a.nota} (atualizado ${a.atualizado})`);
    if (caminhos.length && a.atualizado !== "—") {
      const log = git(["log", `--since=${a.atualizado} 23:59:59`, "--format=   %cs %h %s", "--", ...caminhos]).trim();
      if (log) console.log(log);
    }
    const locais = naWorkingTree.filter((w) => caminhos.some((c) => w.caminho === c || w.caminho.startsWith(c + "/")));
    for (const w of locais) console.log(`   (working tree ${w.estado}) ${w.caminho}`);
  }
}
secao("Incertas: só um commit-snapshot as acusa (a mudança pode ser de antes da nota)", resultado.incertas, (i) =>
  `${i.nota} — atualizado ${i.atualizado}; ${i.caminho} entrou no snapshot ${i.janela}`
);
secao("Código mexido sem nota que o cubra", semNota, (p) => p);
secao("Caminhos do `cobre:` que não existem mais", sumidos, (s) => `${s.nota} → ${s.caminho}`);
secao("Links quebrados", quebrados, (q) => `${q.nota}: ${q.link} (${q.motivo})`);
secao("Notas órfãs (sem link de entrada)", orfas, (o) => o);
secao("Cópias de IA fora de sincronia (rode sincronizar-ias.mjs)", foraDeSincronia, (f) => f);
secao("Caracteres de controle (texto corrompido por escape — `\\b` virou backspace)", resultado.caracteresDeControle, (c) =>
  `${c.nota}: linha(s) ${c.linhas.join(", ")}`
);
console.log(`\n## Contagem`);
console.log(`   total ${resultado.contagem.total} (+ ${copiasIA} cópias em ${PASTA_IA})${resultado.contagem.totalNoClaudeMd !== null ? ` · CLAUDE.md diz ${resultado.contagem.totalNoClaudeMd}` : ""}`);
for (const [p, q] of Object.entries(porPasta).sort()) console.log(`   ${q}  ${p}`);

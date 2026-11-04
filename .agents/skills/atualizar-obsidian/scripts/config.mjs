/**
 * Configuração da skill, lida de `obsidian-skill.config.json` na raiz do repositório.
 * Todos os campos são opcionais — os padrões abaixo valem quando o arquivo não existe.
 *
 * {
 *   "vault": "Obsidian/Meu Projeto",          // pasta do vault, relativa à raiz
 *   "codigo": "^(src/|scripts/|drizzle/)",    // regex: arquivos que PRECISAM de nota
 *   "historicoDesde": "2026-01-01",           // até onde olhar o git log
 *   "arquivosSnapshot": 300,                  // commit com mais arquivos que isto = "snapshot"
 *   "pastaIA": "IA do projeto",               // onde ficam as cópias das instruções das IAs
 *   "skillsProprias": ["atualizar-obsidian"], // skills escritas PARA o projeto
 *   "espelharNoCodex": ["atualizar-obsidian"],// copiadas para .agents/skills (Codex)
 *   "gerarAgentsMd": true,                    // regenerar o AGENTS.md a partir do CLAUDE.md
 *   "arquivoEnv": ".env.local"                // de onde tirar os valores sensíveis a redigir
 * }
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const RAIZ = process.cwd();

const PADRAO = {
  vault: "Obsidian/Meu Projeto",
  codigo: "^(src/|scripts/|drizzle/|vercel\\.json$|next\\.config\\.ts$)",
  historicoDesde: "2026-01-01",
  arquivosSnapshot: 300,
  pastaIA: "IA do projeto",
  skillsProprias: ["atualizar-obsidian"],
  espelharNoCodex: ["atualizar-obsidian"],
  gerarAgentsMd: true,
  arquivoEnv: ".env.local",
};

const arquivo = join(RAIZ, "obsidian-skill.config.json");
const lido = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf8").replace(/^﻿/, "")) : {};

export const CONFIG = { ...PADRAO, ...lido };
export const VAULT = join(RAIZ, ...CONFIG.vault.split("/"));
export const CODIGO = new RegExp(CONFIG.codigo);

---
tipo: nota
atualizado: 2026-11-04
---

# Ambiente e segredos

Só os **NOMES** das variáveis. Os valores ficam no `.env.local` (fora do git) e no painel da
hospedagem — nunca aqui. Volte para a [[Home]].

> [!danger] Valor de segredo não entra em nota, commit nem mensagem
> O `sincronizar-ias.mjs` troca por "[segredo removido]" o que parece token e todo valor de
> variável sensível do `.env.local` — mas a primeira defesa é não escrever.

| Variável | Para quê | Onde está |
| --- | --- | --- |
| `DATABASE_URL` | conexão com o banco | `.env.local`, painel da hospedagem |
| `EXEMPLO_API_KEY` | chave do serviço X | `.env.local`, painel da hospedagem |

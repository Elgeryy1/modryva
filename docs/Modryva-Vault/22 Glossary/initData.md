---
id: modryva-glossary-initdata
title: initData
type: glossary
domain: glossary
status: implemented
maturity: stable
source:
  - apps/api/src/telegram-init-data.ts
tags:
  - modryva
  - glossary
  - api
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# initData

Cadena firmada por Telegram que la Mini App entrega para autenticar al usuario. El backend la verifica por
HMAC (`apps/api/src/telegram-init-data.ts`) en el [[Guard InitData]]; el frontend la manda como
`Authorization: tma <initData>`. Su antigüedad máxima la limita [[Env INITDATA_MAX_AGE_SECONDS]]. Es la base
de autenticación de toda la API `v1/miniapp/*`. Ver [[Integración Telegram Mini Apps]].

## Relaciones
- Relacionado con: [[Guard InitData]], [[Integración Telegram Mini Apps]], [[Package auth]]

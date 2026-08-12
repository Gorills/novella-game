# ADR: web runtime для первого vertical slice

## Status

Accepted for the first playable slice.

## Decision

Первый vertical slice реализуется как dependency-free web runtime: HTML, CSS и ES modules JavaScript с единым state-driven game core.

## Why

Главное требование этапа — получить небольшой продукт, который можно реально запустить, пройти человеком, пройти агентом, тестировать детерминированно и визуально проверять до script/art lock.

Web baseline не означает автоматический выбор web как финального движка всей игры. Финальный engine остаётся отдельным production decision после проверки slice.

## Agent contract

`window.__NOVELLA__` предоставляет observation/action API поверх того же `GameState`, который использует UI.

## No-dependency baseline

Baseline не зависит от внешних CDN и npm-пакетов для runtime. Это делает smoke-проверку воспроизводимой в ограниченной среде.

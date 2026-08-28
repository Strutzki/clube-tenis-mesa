-- Fase A1 — coluna de método de pareamento em `circuitos`.
-- Relevante SÓ no Sistema B (A já resolve pelo rating). Valores: 'sorteio' | 'grupos'.
-- Nullable: circuitos Sistema A ficam com pareamento = null. O BH (sistema A) passa no check.
-- Não toca em dados existentes além de adicionar a coluna (default null).

alter table public.circuitos
  add column if not exists pareamento text;

alter table public.circuitos
  drop constraint if exists circuitos_pareamento_check;

alter table public.circuitos
  add constraint circuitos_pareamento_check
  check (pareamento is null or pareamento in ('sorteio', 'grupos'));

-- (slug já é UNIQUE e sistema já tem CHECK A/B — nada a fazer nesses.)

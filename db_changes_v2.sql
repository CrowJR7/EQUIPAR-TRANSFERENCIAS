-- 1. Coluna para rastrear quando a separação ocorreu
ALTER TABLE public.transferencias ADD COLUMN data_separado TIMESTAMP;

-- 2. Coluna para o SLA (Prazo limite) de Pendências (5 dias)
ALTER TABLE public.transferencias ADD COLUMN prazo_pendencia TIMESTAMP;

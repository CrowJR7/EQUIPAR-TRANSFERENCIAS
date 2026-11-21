-- 1. Adiciona a coluna 'tipo'
ALTER TABLE public.transferencias ADD COLUMN tipo VARCHAR(50);

-- 2. Atualiza os registros existentes para terem o tipo padrão 'INTERNA'
UPDATE public.transferencias SET tipo = 'INTERNA' WHERE tipo IS NULL;

-- 3. Torna a coluna 'tipo' obrigatória
ALTER TABLE public.transferencias ALTER COLUMN tipo SET NOT NULL;

-- 4. Remove a obrigatoriedade da coluna 'valor' (pois transferências de VENDA nascem sem valor)
ALTER TABLE public.transferencias ALTER COLUMN valor DROP NOT NULL;

-- Atualizar GOLD
UPDATE auth.users 
SET email = 'equipar.morrinhos@hotmail.com', 
    encrypted_password = crypt('Equipar@2026', gen_salt('bf')) 
WHERE email = 'gold@equipar.com';

-- Atualizar ONIX
UPDATE auth.users 
SET email = 'equipar.onix@hotmail.com', 
    encrypted_password = crypt('Equipar@2026', gen_salt('bf')) 
WHERE email = 'onix@equipar.com';

-- Atualizar SORS
UPDATE auth.users 
SET email = 'equipar.caldas@hotmail.com', 
    encrypted_password = crypt('Equipar@2026', gen_salt('bf')) 
WHERE email = 'sors@equipar.com';

-- Atualizar A&C
UPDATE auth.users 
SET email = 'equipar.acl@hotmail.com', 
    encrypted_password = crypt('Equipar@2026', gen_salt('bf')) 
WHERE email = 'aec@equipar.com';

-- Atualizar ADM
UPDATE auth.users 
SET email = 'equipar.adm23@hotmail.com', 
    encrypted_password = crypt('Equipar@2026', gen_salt('bf')) 
WHERE email = 'admin@equipar.com';

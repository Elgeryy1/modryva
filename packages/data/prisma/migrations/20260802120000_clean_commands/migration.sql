-- Borrado automático del mensaje de comando.
--
-- Con esto activado, cuando alguien escribe "/casino" el bot responde y acto
-- seguido borra el "/casino", de modo que en el chat solo queda el panel del
-- bot. Es puramente cosmético: el comando ya se ejecutó y queda en la auditoría.
--
-- Aditiva y apagada por defecto: ningún grupo existente cambia de
-- comportamiento hasta que un administrador lo encienda a propósito. Un borrado
-- no se deshace, así que el valor por defecto tiene que ser "no toques nada".

ALTER TABLE "group_hygiene_configs"
    ADD COLUMN "cleanCommands" BOOLEAN NOT NULL DEFAULT false;

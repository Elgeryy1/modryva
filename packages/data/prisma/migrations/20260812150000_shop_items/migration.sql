-- La tienda del grupo: inventario y compras.
--
-- Dos tablas y no una porque responden a preguntas distintas. `user_items` es
-- un estado que se sobreescribe ("que tiene esta persona AHORA"); es la que se
-- lee en cada robo, y por eso lleva una fila por objeto y no una por compra.
-- `shop_purchases` es un historico que solo crece ("quien compro que y a quien
-- se lo tiro"), y es la unica que puede contestar quien le compro la mordaza a
-- alguien — el libro mayor solo sabe que salieron 5.000 monedas por "shop-buy".
--
-- De `shop_purchases` salen ademas dos numeros que no se guardan aparte: lo que
-- cuesta la fianza (el doble de la mordaza que te comiste) y si a esa persona le
-- compraron otra hace demasiado poco. Derivarlos de las filas, igual que las
-- esperas del robo salen del libro mayor, evita un contador que pueda acabar
-- contradiciendo a los hechos.
--
-- El unique de `user_items` es lo que hace que comprar dos veces lo mismo sume
-- en vez de duplicar: la segunda navaja sube `uses` y el segundo escudo alarga
-- `expiresAt`. Sin el, cada golpe tendria que elegir cual de las tres navajas
-- gastar, que es una decision sin respuesta buena.
--
-- Aditiva: crea dos tablas nuevas y no toca ninguna existente.

-- CreateTable
CREATE TABLE "user_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "itemId" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "targetTelegramId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_items_tenantId_chatId_userTelegramId_idx" ON "user_items"("tenantId", "chatId", "userTelegramId");

-- CreateIndex
CREATE UNIQUE INDEX "user_items_tenantId_chatId_userTelegramId_itemId_key" ON "user_items"("tenantId", "chatId", "userTelegramId", "itemId");

-- CreateIndex
CREATE INDEX "shop_purchases_tenantId_chatId_createdAt_idx" ON "shop_purchases"("tenantId", "chatId", "createdAt");

-- CreateIndex
CREATE INDEX "shop_purchases_tenantId_chatId_targetTelegramId_createdAt_idx" ON "shop_purchases"("tenantId", "chatId", "targetTelegramId", "createdAt");

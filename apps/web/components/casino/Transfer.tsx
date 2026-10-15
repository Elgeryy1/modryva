"use client";

// Send chips to another player. Two steps on purpose: pick a person, THEN say
// how much. Amount-first would let a mistyped tap land on the wrong name with
// the number already filled in, and a gift cannot be undone.

import { type JSX, useEffect, useMemo, useState } from "react";
import {
  type CasinoRecipient,
  casinoErrorLabel,
  casinoRecipients,
  casinoTransfer,
} from "../../lib/api";
import {
  Banner,
  Button,
  Empty,
  Field,
  Group,
  GroupNote,
  Row,
  SkeletonList,
} from "../ui";

/**
 * A stable id for ONE intended gift. Regenerated only after a gift completes,
 * so every retry of a failed or slow request carries the same id and the server
 * can tell "they tapped twice" from "they want to send again".
 *
 * crypto.randomUUID needs a secure context; Telegram's webview is one, but the
 * fallback keeps the screen usable rather than throwing on the money path.
 */
const newRequestId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function Transfer({
  balance,
  onBalance,
}: {
  balance: number | null;
  onBalance: (n: number) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CasinoRecipient[] | null>(null);
  const [picked, setPicked] = useState<CasinoRecipient | null>(null);
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    if (picked) {
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      casinoRecipients(query)
        .then((res) => {
          if (live) {
            setRows(res.rows);
          }
        })
        .catch(() => {
          if (live) {
            setRows([]);
          }
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, picked]);

  const parsed = Number(amount);
  const amountOk =
    Number.isInteger(parsed) &&
    parsed > 0 &&
    (balance === null || parsed <= balance);

  const problem = useMemo(() => {
    if (amount.trim() === "") {
      return null;
    }
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return "Pon una cantidad entera y mayor que cero.";
    }
    if (balance !== null && parsed > balance) {
      return `Solo tienes ${balance} 🪙.`;
    }
    return null;
  }, [amount, parsed, balance]);

  const send = async (): Promise<void> => {
    if (!picked || !amountOk || sending) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await casinoTransfer(
        picked.telegramUserId,
        parsed,
        requestId,
      );
      onBalance(res.balance);
      setDone(
        res.repeated
          ? `Ese envío a ${picked.name} ya se había hecho.`
          : `Enviaste ${parsed} 🪙 a ${picked.name}.`,
      );
      // Only now: a new id would have turned a retry into a second gift.
      setRequestId(newRequestId());
      setPicked(null);
      setAmount("");
      setQuery("");
      setRows(null);
    } catch (e) {
      setError(casinoErrorLabel(e));
    } finally {
      setSending(false);
    }
  };

  if (picked) {
    return (
      <>
        {done != null && <Banner kind="success">{done}</Banner>}
        <Group>
          <Row
            icon="👤"
            tone="blue"
            title={picked.name ?? picked.telegramUserId}
            subtitle="Recibirá las fichas"
          />
        </Group>
        <Group>
          <Field
            label="Cuántas fichas"
            hint={
              balance !== null ? `Tienes ${balance} 🪙 disponibles.` : undefined
            }
          >
            <input
              className="input"
              inputMode="numeric"
              placeholder="Ej. 100"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/gu, ""))}
            />
          </Field>
        </Group>
        {problem != null && <Banner kind="error">{problem}</Banner>}
        {error != null && <Banner kind="error">{error}</Banner>}
        <Group>
          <Button block disabled={!amountOk || sending} onClick={send}>
            {sending ? "Enviando…" : `Enviar ${amountOk ? parsed : ""} 🪙`}
          </Button>
          <Button
            block
            variant="ghost"
            disabled={sending}
            onClick={() => {
              setPicked(null);
              setError(null);
            }}
          >
            Elegir otra persona
          </Button>
        </Group>
        <GroupNote>
          Las fichas se envían al momento y no se pueden recuperar. Asegúrate de
          que es la persona correcta.
        </GroupNote>
      </>
    );
  }

  return (
    <>
      {done != null && <Banner kind="success">{done}</Banner>}
      <Group>
        <Field label="Buscar persona">
          <input
            className="input"
            placeholder="Escribe un nombre o @usuario"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
      </Group>
      {rows === null ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <Empty
          icon="🔍"
          title={
            query.trim() === ""
              ? "Todavía no hay nadie jugando"
              : "Nadie coincide con esa búsqueda"
          }
          hint="Solo aparece la gente que juega al casino en este grupo."
        />
      ) : (
        <Group>
          {rows.map((r) => (
            <Row
              key={r.telegramUserId}
              icon="👤"
              tone="gray"
              title={r.name ?? r.telegramUserId}
              chevron
              onClick={() => {
                setPicked(r);
                setDone(null);
                setError(null);
              }}
            />
          ))}
        </Group>
      )}
      <GroupNote>
        Solo se puede enviar a gente que juega al casino aquí. No se muestran
        saldos de nadie.
      </GroupNote>
    </>
  );
}

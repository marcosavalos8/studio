import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";

// Assigns the next contract folio inside a Firestore transaction, so two
// admins creating a contract at the same moment can never collide on the
// same number — unlike a client-computed "count existing docs + 1", which
// is exactly the race condition a transactional counter avoids.
//
// The counter itself never resets per year; the year is just a display
// prefix on whatever the next global sequence number is (e.g.
// "CON-2026-00001", then "CON-2026-00002", and still "CON-2027-00003" if
// that one happens to be issued in the next calendar year). This keeps the
// counter document and its failure modes simple — no "did this year's
// counter doc exist yet" branch — while still producing a folio that reads
// as current-year and globally unique.
export async function generateContractNumber(firestore: Firestore): Promise<string> {
  const counterRef = doc(firestore, "settings", "contractCounter");
  const year = new Date().getFullYear();

  const nextSeq = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().lastNumber as number) || 0 : 0;
    const next = current + 1;
    tx.set(
      counterRef,
      { lastNumber: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return next;
  });

  return `CON-${year}-${String(nextSeq).padStart(5, "0")}`;
}

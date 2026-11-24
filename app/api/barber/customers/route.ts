import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  barberAuth,
  businessFailure,
  firstIssue,
  readJson,
} from "@/app/api/barber/_auth";
import {
  getBusinessCustomer,
  listBusinessCustomers,
  saveCustomerNote,
} from "@/lib/domain/barber-business";
import { apiError, apiOk } from "@/lib/http";

const noteSchema = z.object({
  userId: z.string().trim().min(1).max(36),
  note: z.string().trim().max(512),
});

/** GET /api/barber/customers[?id=…] — visitors or one member's full history. */
export async function GET(request: NextRequest) {
  const auth = await barberAuth(request);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const parsed = z.string().trim().min(1).max(36).safeParse(id);
      if (!parsed.success) return apiError("Pick a member.", 400, "invalid_customer");
      return apiOk({ customer: await getBusinessCustomer(auth.userId, parsed.data) });
    }
    return apiOk({ customers: await listBusinessCustomers(auth.userId) });
  } catch (error) {
    return businessFailure(error, "Could not load your customers.", "customers_failed");
  }
}

/** PATCH /api/barber/customers — private note, never exposed to members. */
export async function PATCH(request: NextRequest) {
  const auth = await barberAuth(request, true);
  if (!auth.ok) return auth.response;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = noteSchema.safeParse(json.value);
  if (!parsed.success) {
    return apiError(firstIssue(parsed.error, "Check the note."), 400, "invalid_note");
  }

  try {
    const note = await saveCustomerNote(
      auth.userId,
      parsed.data.userId,
      parsed.data.note,
    );
    return apiOk({ note });
  } catch (error) {
    return businessFailure(error, "Could not save the note.", "note_failed");
  }
}

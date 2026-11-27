import "server-only";

import {
  createBooking,
  deleteBooking,
  getBarber,
  getService,
  listBusy,
  listUserBookings,
} from "./data";
import { LEAD_MINUTES, SLOT_STEP, isBookableDate, isFree } from "./availability";
import { priceOf } from "./pricing";
import { shopClock } from "./time";
import type { Booking } from "./types";

export type BookFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type BookResult = { ok: true; booking: Booking } | BookFailure;

const fail = (
  status: number,
  code: string,
  message: string,
): BookFailure => ({ ok: false, status, code, message });

/**
 * Create a booking after re-checking availability.
 *
 * Two members can pass the availability check at the same time, so after the
 * insert we look at every overlapping booking for that barber and keep only the
 * oldest one. The loser is deleted and told the slot is gone.
 */
export async function book(input: {
  user: string;
  barber: string;
  service: string;
  date: string;
  start: number;
  note: string;
}): Promise<BookResult> {
  if (!isBookableDate(input.date)) {
    return fail(400, "bad_date", "Pick a date inside the next 60 days.");
  }

  const [barber, service] = await Promise.all([
    getBarber(input.barber),
    getService(input.service),
  ]);

  if (!barber || !barber.active) {
    return fail(404, "no_barber", "That barber is not taking bookings.");
  }

  if (!service || !service.active) {
    return fail(404, "no_service", "That service is no longer offered.");
  }

  if (service.barber && service.barber !== input.barber) {
    return fail(400, "wrong_chair", "That service belongs to another chair.");
  }

  const clock = shopClock();
  if (input.start % SLOT_STEP !== 0) {
    return fail(400, "bad_time", "Pick one of the offered times.");
  }

  if (input.date === clock.date && input.start < clock.minutes + LEAD_MINUTES) {
    return fail(
      409,
      "too_soon",
      `Pick a time at least ${LEAD_MINUTES} minutes from now.`,
    );
  }

  const end = input.start + service.time;

  const free = await isFree({
    barber: input.barber,
    date: input.date,
    start: input.start,
    end,
  });

  if (!free) {
    return fail(409, "slot_taken", "That slot just went. Pick another time.");
  }

  const mine = await listUserBookings(input.user);
  const clash = mine.some(
    (booking) =>
      ["pending", "accepted", "booked"].includes(booking.status) &&
      booking.date === input.date &&
      input.start < booking.end &&
      booking.start < end,
  );

  if (clash) {
    return fail(409, "already_booked", "You already have a booking at that time.");
  }

  const booking = await createBooking({
    user: input.user,
    barber: input.barber,
    service: input.service,
    date: input.date,
    start: input.start,
    end,
    price: priceOf(service),
    note: input.note,
    status: barber.confirm ? "pending" : "booked",
  });

  const overlapping = (await listBusy(input.barber, input.date))
    .filter((row) => row.start < booking.end && booking.start < row.end)
    .sort((a, b) => (a.created < b.created ? -1 : 1));

  if (overlapping.length > 0 && overlapping[0].id !== booking.id) {
    await deleteBooking(booking.id);
    return fail(409, "slot_taken", "That slot just went. Pick another time.");
  }

  return { ok: true, booking };
}

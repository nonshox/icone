import "server-only";

import { TABLES } from "@/lib/appwrite/db";

import {
  getMany,
  listAgenda,
  listReviewsByUser,
  listUserBookings,
} from "./data";
import type { Booking, BookingRow } from "./types";

/** Attach barber, service and (optionally) member names to bookings. */
export async function enrich(
  bookings: Booking[],
  options: { withUser?: boolean } = {},
): Promise<BookingRow[]> {
  if (bookings.length === 0) return [];

  const [barbers, services, users] = await Promise.all([
    getMany(TABLES.barbers, bookings.map((booking) => booking.barber)),
    getMany(TABLES.services, bookings.map((booking) => booking.service)),
    options.withUser
      ? getMany(TABLES.users, bookings.map((booking) => booking.user))
      : Promise.resolve([]),
  ]);

  const barberName = new Map(barbers.map((row) => [row.$id, String(row.name)]));
  const service = new Map(
    services.map((row) => [
      row.$id,
      { name: String(row.name), time: Number(row.time) },
    ]),
  );
  const userName = new Map(users.map((row) => [row.$id, String(row.name)]));

  return bookings.map((booking) => ({
    ...booking,
    barberName: barberName.get(booking.barber) ?? "Barber",
    serviceName: service.get(booking.service)?.name ?? "Service",
    serviceTime: service.get(booking.service)?.time ?? 30,
    userName: options.withUser
      ? (userName.get(booking.user) ?? "Member")
      : undefined,
  }));
}

/** The member's bookings, newest visit first, with a `reviewed` flag. */
export async function myBookings(userId: string): Promise<BookingRow[]> {
  const [bookings, reviews] = await Promise.all([
    listUserBookings(userId),
    listReviewsByUser(userId),
  ]);

  const reviewed = new Set(reviews.map((review) => review.booking));
  const rows = await enrich(bookings);

  return rows.map((booking) => ({
    ...booking,
    reviewed: reviewed.has(booking.id),
  }));
}

export async function agenda(
  date: string,
  barberId?: string,
): Promise<BookingRow[]> {
  return enrich(await listAgenda(date, barberId), { withUser: true });
}

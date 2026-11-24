export type Role = "client" | "barber" | "admin";

export const STATUSES = ["booked", "done", "cancel", "noshow"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  booked: "Booked",
  done: "Completed",
  cancel: "Cancelled",
  noshow: "No-show",
};

export type Profile = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  avatar: string;
};

export type Barber = {
  id: string;
  name: string;
  title: string;
  bio: string;
  photo: string;
  rating: number;
  active: boolean;
};

export type Service = {
  id: string;
  name: string;
  note: string;
  price: number;
  time: number;
  active: boolean;
};

export type Booking = {
  id: string;
  user: string;
  barber: string;
  service: string;
  date: string;
  start: number;
  end: number;
  price: number;
  status: Status;
  note: string;
  created: string;
};

/** A booking with the names the UI needs, resolved server-side. */
export type BookingRow = Booking & {
  barberName: string;
  serviceName: string;
  serviceTime: number;
  userName?: string;
  reviewed?: boolean;
};

export type Review = {
  id: string;
  user: string;
  barber: string;
  booking: string;
  rate: number;
  note: string;
  created: string;
  userName: string;
};

export type Slot = {
  start: number;
  end: number;
  label: string;
};

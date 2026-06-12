import type { Venue, Court } from "@/lib/types";

export const venues: Venue[] = [
  {
    id: "everyday-badminton", name: "Everyday Badminton",
    sports: ["badminton"], rating: 4.8, reviewCount: 124,
    openTime: "10:00", closeTime: "22:00", address: "ถนนงามวงศ์วาน นนทบุรี",
    imageUrl: "/venues/everyday.jpg",
    facilities: ["parking", "shower", "cafe", "wifi", "aircon"],
  },
  {
    id: "tsr-arena", name: "TSR Arena",
    sports: ["badminton", "futsal"], rating: 4.6, reviewCount: 88,
    openTime: "09:00", closeTime: "23:00", address: "ปทุมธานี",
    imageUrl: "/venues/tsr.jpg", facilities: ["parking", "cafe"],
  },
];

export const courts: Court[] = Array.from({ length: 6 }, (_, i) => ({
  id: `court-${i + 1}`, venueId: "everyday-badminton",
  name: `Court ${i + 1}`, sport: "badminton", pricePerHour: 200,
}));

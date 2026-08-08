"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const useVenues = () => useQuery({ queryKey: ["venues"], queryFn: api.getVenues });
export const useVenue = (id: string) => useQuery({ queryKey: ["venue", id], queryFn: () => api.getVenue(id) });
export const useCourts = (venueId: string) => useQuery({ queryKey: ["courts", venueId], queryFn: () => api.getCourts(venueId) });
export const useSchedule = (courtId: string | undefined, date: string) =>
  useQuery({ queryKey: ["schedule", courtId, date], queryFn: () => api.getCourtSchedule(courtId!, date), enabled: !!courtId });
export const useBooking = (id: string) => useQuery({ queryKey: ["booking", id], queryFn: () => api.getBooking(id) });
export const useBookings = () => useQuery({ queryKey: ["bookings"], queryFn: api.listBookings });
export const useRefunds = () => useQuery({ queryKey: ["refunds"], queryFn: api.getRefunds });
export const useReviews = (venueId: string) => useQuery({ queryKey: ["reviews", venueId], queryFn: () => api.getReviews(venueId) });
export const usePackages = () => useQuery({ queryKey: ["packages"], queryFn: api.getPackages });
export const useMembership = () => useQuery({ queryKey: ["membership"], queryFn: api.getMembership });
export const useCredit = () => useQuery({ queryKey: ["credit"], queryFn: api.getCredit });
export const usePromotions = () => useQuery({ queryKey: ["promotions"], queryFn: api.getPromotions });
export const useNotifications = () => useQuery({ queryKey: ["notifications"], queryFn: api.getNotifications });

/** Equipment for one slot. Idle until a court and time are chosen. */
export function useRentals(date: string, start?: string, end?: string) {
  return useQuery({
    queryKey: ["rentals", date, start, end],
    queryFn: () => api.getRentals(date, start!, end!),
    enabled: Boolean(date && start && end),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

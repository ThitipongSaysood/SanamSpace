import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SlideToConfirm } from "./slide-to-confirm";

/**
 * The control exists to make an accidental touch impossible, so the assertions
 * that matter are the ones about NOT firing: a tap, a short drag, and a drag
 * released halfway all have to leave the customer's points alone.
 */
describe("SlideToConfirm", () => {
  function setup(onConfirm = vi.fn()) {
    render(<SlideToConfirm label="สไลด์เพื่อยืนยัน" onConfirm={onConfirm} />);
    const track = screen.getByRole("slider");
    // jsdom lays nothing out, so the track has to be told how wide it is or the
    // component measures a travel distance of zero.
    Object.defineProperty(track, "clientWidth", { configurable: true, value: 344 });
    track.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 344, bottom: 56, width: 344, height: 56, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    act(() => { fireEvent(window, new Event("resize")); });
    return { track, knob: track.querySelector("button")!, onConfirm };
  }

  /**
   * jsdom has no PointerEvent, and Testing Library's fallback drops clientX —
   * which silently made a "dragged to the end" test pass without moving
   * anything. A MouseEvent carries the coordinate for real.
   */
  function pointer(el: Element, type: string, clientX?: number) {
    const ev = new MouseEvent(type, { bubbles: true, clientX });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    act(() => { el.dispatchEvent(ev); });
  }

  it("does nothing when the knob is merely tapped", () => {
    const { knob, onConfirm } = setup();

    pointer(knob, "pointerdown", 24);
    pointer(knob, "pointerup");

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does nothing when the slide is released halfway", () => {
    const { knob, onConfirm } = setup();

    pointer(knob, "pointerdown", 24);
    pointer(knob, "pointermove", 150);
    pointer(knob, "pointerup");

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms when the knob is dragged to the end", () => {
    const { knob, onConfirm } = setup();

    pointer(knob, "pointerdown", 24);
    pointer(knob, "pointermove", 340);
    pointer(knob, "pointerup");

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("confirms from the keyboard, so a customer who cannot drag is not shut out", () => {
    const { track, onConfirm } = setup();

    fireEvent.keyDown(track, { key: "End" });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cannot be confirmed twice", () => {
    const { track, onConfirm } = setup();

    fireEvent.keyDown(track, { key: "End" });
    fireEvent.keyDown(track, { key: "End" });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ignores everything while its action is in flight", () => {
    const onConfirm = vi.fn();
    render(<SlideToConfirm label="สไลด์" onConfirm={onConfirm} pending />);

    fireEvent.keyDown(screen.getByRole("slider"), { key: "End" });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

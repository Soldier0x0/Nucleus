import { useEffect, useState } from "react";
import { headingFromField, headingTurn, type Heading } from "@/src/core/compass";

type MagnetometerSensor = {
  isAvailableAsync: () => Promise<boolean>;
  setUpdateInterval: (intervalMs: number) => void;
  addListener: (listener: (reading: { x: number; y: number }) => void) => { remove: () => void };
};

/** Live heading from the phone magnetometer. Nothing is stored or sent. */
export function useHeading(sensor: MagnetometerSensor): { heading: Heading | null; available: boolean | null } {
  const [heading, setHeading] = useState<Heading | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    let sub: { remove: () => void } | null = null;
    sensor
      .isAvailableAsync()
      .then((ok) => {
        if (!alive) return;
        setAvailable(ok);
        if (!ok) return;
        sensor.setUpdateInterval(120);
        sub = sensor.addListener(({ x, y }) => {
          if (!alive) return;
          const next = headingFromField(x, y);
          setHeading((current) => {
            if (current?.degrees === next?.degrees) return current;
            if (current && next && Math.abs(headingTurn(current.degrees, next.degrees) - current.degrees) < 3) return current;
            return next;
          });
        });
      })
      .catch(() => {
        if (alive) setAvailable(false);
      });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [sensor]);

  return { heading, available };
}

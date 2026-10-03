import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";

/** True only for the real document. Any other session leaves without an explanation. */
export function useRealSession(): boolean {
  const { session } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (session !== "real") router.replace("/");
  }, [session, router]);
  return session === "real";
}

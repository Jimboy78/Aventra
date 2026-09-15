import { Suspense } from "react";
import { PlayScreen } from "@/components/screens/PlayScreen";

export default function PlayPage() {
  return (
    <Suspense>
      <PlayScreen />
    </Suspense>
  );
}

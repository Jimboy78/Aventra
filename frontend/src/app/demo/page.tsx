import { Suspense } from "react";
import { DemoScreen } from "@/components/screens/DemoScreen";

export default function DemoPage() {
  return (
    <Suspense>
      <DemoScreen />
    </Suspense>
  );
}

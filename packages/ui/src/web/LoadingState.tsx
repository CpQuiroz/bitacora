import type { PropsLoadingState } from "../tipos";
import { Skeleton } from "./Skeleton";

// Nunca un spinner centrado en pantalla completa: esqueletos con la
// forma real del contenido. Sin `children`, 3 líneas genéricas.
export function LoadingState({ children }: PropsLoadingState) {
  return (
    <div className="flex flex-col gap-ds-3" aria-busy="true" aria-live="polite">
      {children ?? (
        <>
          <Skeleton alto={56} radio={16} />
          <Skeleton alto={56} radio={16} />
          <Skeleton alto={56} radio={16} />
        </>
      )}
    </div>
  );
}

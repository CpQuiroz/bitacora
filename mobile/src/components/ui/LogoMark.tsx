import Svg, { Path, Rect } from "react-native-svg";
import { useTema } from "../../theme";

// Marca de Bitácora — mismo glifo que el LogoMark de la web
// (web/src/components/Logo.tsx): recuadro de marca + dos líneas y un
// check. Usa el color de marca de la empresa (tema).
export function LogoMark({ size = 40 }: { size?: number }) {
  const t = useTema();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={9} fill={t.colores.brand} />
      <Path d="M10 11h9M10 16h6" stroke={t.colores.brandForeground} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M10 21.5l3 3 7-7.5"
        stroke={t.colores.brandForeground}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLAVE_ACTIVA = "biometria:activa";

/** ¿El equipo tiene lector de huella / Face ID y hay algo registrado? */
export async function biometriaDisponible(): Promise<boolean> {
  try {
    const [hardware, registrada] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && registrada;
  } catch {
    return false;
  }
}

/** Nombre para la UI: "huella", "Face ID", "reconocimiento facial"… */
export async function nombreBiometria(): Promise<string> {
  try {
    const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
    if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "huella";
    return "biometría";
  } catch {
    return "biometría";
  }
}

/** Pide la verificación biométrica. `true` si pasó. */
export async function pedirBiometria(motivo = "Desbloquea Bitácora"): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: "Cancelar",
      // Deja usar el PIN/patrón del teléfono como alternativa a la huella.
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

export async function biometriaActivada(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE_ACTIVA)) === "1";
  } catch {
    return false;
  }
}

export async function setBiometriaActivada(valor: boolean): Promise<void> {
  try {
    if (valor) await AsyncStorage.setItem(CLAVE_ACTIVA, "1");
    else await AsyncStorage.removeItem(CLAVE_ACTIVA);
  } catch {
    /* best-effort */
  }
}

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table, type ColumnaTabla } from "./Table";
import { StatusBadge } from "./StatusBadge";
import { Cifra } from "./Cifra";

type Equipo = { id: string; nombre: string; patente: string; estado: string; km: number };

const FILAS: Equipo[] = [
  { id: "1", nombre: "Tracto Camión International 9200", patente: "CFHGJ", estado: "en_curso", km: 412870 },
  { id: "2", nombre: "Camión 3/4 Hino 300", patente: "RKLP22", estado: "firmada", km: 98120 },
  { id: "3", nombre: "Furgón Peugeot Boxer", patente: "HTNW87", estado: "dada_de_baja", km: 210330 },
];

const COLUMNAS: ColumnaTabla<Equipo>[] = [
  { encabezado: "Equipo", celda: (f) => f.nombre },
  { encabezado: "Patente", celda: (f) => f.patente },
  { encabezado: "Estado", celda: (f) => <StatusBadge estado={f.estado} /> },
  { encabezado: "Kilometraje", celda: (f) => <Cifra>{f.km.toLocaleString("es-CL")} km</Cifra>, clase: "text-right" },
];

const meta = {
  title: "Primitivas/Table",
  component: Table<Equipo>,
  tags: ["autodocs"],
  args: {
    columnas: COLUMNAS,
    filas: FILAS,
    claveFila: (f: Equipo) => f.id,
    vacio: { titulo: "Todavía no hay equipos" },
  },
} satisfies Meta<typeof Table<Equipo>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConDatos: Story = {};

export const ConAcciones: Story = {
  args: {
    acciones: [
      { etiqueta: "Ver detalle", onPress: () => {} },
      { etiqueta: "Dar de baja", onPress: () => {}, tono: "peligro", oculta: (f: Equipo) => f.estado === "dada_de_baja" },
    ],
  },
};

export const FilaClickeable: Story = { args: { onFilaClick: () => {} } };
export const Cargando: Story = { args: { cargando: true } };
export const ConError: Story = { args: { error: "No se pudo cargar la lista de equipos.", onReintentar: () => {} } };
export const Vacio: Story = {
  args: { filas: [], vacio: { titulo: "Todavía no hay equipos", mensaje: "Agregá el primero desde \"Nuevo equipo\"." } },
};

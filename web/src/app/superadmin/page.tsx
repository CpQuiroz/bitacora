"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import type { Rubro } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { DataTable, type ColumnaTabla } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Button, Card, Input, Select, StatusBadge, Tag } from "@bitacora/ui/web";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

const RUBROS: { value: Rubro; label: string }[] = [
  { value: "transporte", label: "Transporte" },
  { value: "servicio_tecnico", label: "Servicio técnico / mantención" },
  { value: "cosmetologia", label: "Cosmetología / belleza" },
  { value: "otro", label: "Otro" },
];

type EmpresaListado = {
  id: string;
  nombre: string;
  plan: string;
  estado: string;
  creado_en: string;
  cantidad_usuarios: number;
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function SuperAdminEmpresasPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<EmpresaListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState<Rubro>("transporte");
  const [rut, setRut] = useState("");
  const [giro, setGiro] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [adminNombre, setAdminNombre] = useState("");
  const [adminCorreo, setAdminCorreo] = useState("");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  function abrirModal() {
    setNombre("");
    setRubro("transporte");
    setRut("");
    setGiro("");
    setTelefono("");
    setDireccion("");
    setAdminNombre("");
    setAdminCorreo("");
    setErrorCrear(null);
    setModalAbierto(true);
  }

  async function onCrear(e: FormEvent) {
    e.preventDefault();
    setErrorCrear(null);
    setCreando(true);
    const res = await superadminFetch("/api/superadmin/empresas", {
      method: "POST",
      body: JSON.stringify({
        nombre,
        rubro,
        rut: rut.trim() || undefined,
        giro: giro.trim() || undefined,
        telefono_empresa: telefono.trim() || undefined,
        direccion_calle: direccion.trim() || undefined,
        admin_nombre: adminNombre,
        admin_correo: adminCorreo,
      }),
    });
    setCreando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorCrear(body.error ?? "No se pudo crear la empresa");
      return;
    }
    const { empresa } = await res.json();
    setModalAbierto(false);
    router.push(`/superadmin/empresas/${empresa.id}`);
  }

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    (async () => {
      const res = await superadminFetch("/api/superadmin/empresas");
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/superadmin/login");
          return;
        }
        setError("No se pudieron cargar las empresas");
        return;
      }
      setEmpresas(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtradas = (empresas ?? []).filter((e) => e.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const columnas: ColumnaTabla<EmpresaListado>[] = [
    { header: "Nombre", cell: (e) => <span className="font-medium text-ds-text">{e.nombre}</span> },
    { header: "Fecha de alta", cell: (e) => new Date(e.creado_en).toLocaleDateString("es-CL") },
    { header: "Estado", cell: (e) => <StatusBadge estado={e.estado} /> },
    { header: "Plan", cell: (e) => <Tag>{e.plan}</Tag> },
    { header: "Usuarios", cell: (e) => e.cantidad_usuarios },
  ];

  return (
    <SuperAdminShell>
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Empresas clientes</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Listado y salud de cada empresa que usa Bitácora</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirModal}>
          Nueva empresa
        </Button>
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Nueva empresa" wide>
        <form onSubmit={onCrear} className="flex flex-col gap-ds-4">
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Input etiqueta="Nombre de la empresa" requerido valor={nombre} onCambio={setNombre} />
            <Select etiqueta="Rubro" valor={rubro} onCambio={(v) => setRubro(v as Rubro)} opciones={RUBROS.map((r) => ({ valor: r.value, etiqueta: r.label }))} />
            <Input etiqueta="RUT (opcional)" placeholder="76.123.456-7" valor={rut} onCambio={setRut} />
            <Input etiqueta="Giro (opcional)" valor={giro} onCambio={setGiro} />
            <Input etiqueta="Teléfono (opcional)" valor={telefono} onCambio={setTelefono} />
            <Input etiqueta="Dirección (opcional)" valor={direccion} onCambio={setDireccion} />
          </div>

          <div className="border-t border-ds-divider pt-ds-4">
            <p className="mb-ds-3 font-ds-body text-ds-small font-medium text-ds-text">Administrador inicial</p>
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <Input etiqueta="Nombre" requerido valor={adminNombre} onCambio={setAdminNombre} />
              <Input etiqueta="Correo" tipo="email" requerido valor={adminCorreo} onCambio={setAdminCorreo} />
            </div>
            <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text/60">Recibe una invitación por correo para activar su cuenta como admin de esta empresa.</p>
          </div>

          {errorCrear ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorCrear}</p> : null}
          <div className="flex gap-ds-2">
            <Button tipo="submit" cargando={creando}>
              Crear empresa
            </Button>
            <Button variante="ghost" onPress={() => setModalAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      <div className="my-ds-6">
        <Card>
          <div className="max-w-sm">
            <Input placeholder="Buscar por nombre…" valor={busqueda} onCambio={setBusqueda} />
          </div>
        </Card>
      </div>

      <DataTable
        columns={columnas}
        rows={filtradas}
        rowKey={(e) => e.id}
        loading={empresas === null && !error}
        error={error}
        actions={[{ label: "Ver salud →", onClick: (e) => router.push(`/superadmin/empresas/${e.id}`) }]}
        emptyState={{ icon: Briefcase, message: busqueda ? "Ninguna empresa coincide con la búsqueda." : "Todavía no hay empresas registradas." }}
      />
    </SuperAdminShell>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Rubro } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { DataTable, type ColumnaTabla } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { IconBriefcase, IconPlus } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

const RUBROS: { value: Rubro; label: string }[] = [
  { value: "transporte", label: "Transporte" },
  { value: "servicio_tecnico", label: "Servicio técnico / mantención" },
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
    { header: "Nombre", cell: (e) => <span className="font-medium text-foreground">{e.nombre}</span> },
    { header: "Fecha de alta", cell: (e) => new Date(e.creado_en).toLocaleDateString("es-CL") },
    { header: "Estado", cell: (e) => <Badge value={e.estado} /> },
    { header: "Plan", cell: (e) => <Badge value={e.plan} /> },
    { header: "Usuarios", cell: (e) => e.cantidad_usuarios },
  ];

  return (
    <SuperAdminShell>
      <PageHeader
        title="Empresas clientes"
        subtitle="Listado y salud de cada empresa que usa Bitácora"
        action={
          <Button type="button" onClick={abrirModal}>
            <IconPlus className="h-4 w-4" />
            Nueva empresa
          </Button>
        }
      />

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Nueva empresa" wide>
        <form onSubmit={onCrear} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre de la empresa</Label>
              <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Rubro</Label>
              <Select value={rubro} onChange={(e) => setRubro(e.target.value as Rubro)}>
                {RUBROS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>RUT (opcional)</Label>
              <Input type="text" placeholder="76.123.456-7" value={rut} onChange={(e) => setRut(e.target.value)} />
            </div>
            <div>
              <Label>Giro (opcional)</Label>
              <Input type="text" value={giro} onChange={(e) => setGiro(e.target.value)} />
            </div>
            <div>
              <Label>Teléfono (opcional)</Label>
              <Input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div>
              <Label>Dirección (opcional)</Label>
              <Input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-foreground">Administrador inicial</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nombre</Label>
                <Input type="text" required value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} />
              </div>
              <div>
                <Label>Correo</Label>
                <Input type="email" required value={adminCorreo} onChange={(e) => setAdminCorreo(e.target.value)} />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">Recibe una invitación por correo para activar su cuenta como admin de esta empresa.</p>
          </div>

          {errorCrear && <ErrorText>{errorCrear}</ErrorText>}
          <div className="flex gap-2">
            <Button type="submit" disabled={creando}>
              {creando ? "Creando…" : "Crear empresa"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      <Card className="my-6">
        <Input type="text" placeholder="Buscar por nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
      </Card>

      <DataTable
        columns={columnas}
        rows={filtradas}
        rowKey={(e) => e.id}
        loading={empresas === null && !error}
        error={error}
        actions={[{ label: "Ver salud →", onClick: (e) => router.push(`/superadmin/empresas/${e.id}`) }]}
        emptyState={{ icon: IconBriefcase, message: busqueda ? "Ninguna empresa coincide con la búsqueda." : "Todavía no hay empresas registradas." }}
      />
    </SuperAdminShell>
  );
}

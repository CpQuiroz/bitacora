"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { DataTable, type ColumnaTabla } from "@/components/DataTable";
import { Badge, Card, Input, PageHeader } from "@/components/ui";
import { IconBriefcase } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

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
      <PageHeader title="Empresas clientes" subtitle="Listado y salud de cada empresa que usa Bitácora" />

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
